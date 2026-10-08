import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useOutletContext, useParams } from "react-router-dom";
import type { Bootstrap, GithubMember, TicketFeatureRecord } from "../../api/contracts";
import { getRawJson } from "../../api/http";
import { platformApi } from "../../api/platform";
import { ListRow } from "../../components/ListRow";
import { ServiceTabs } from "../../components/ServiceTabs";
import { StatusTag } from "../../components/StatusTag";
import { NoxFeedSettings } from "./NoxFeedSettings";

const tabs = [["current", "Current"], ["opened", "Opened"], ["merged", "Merged"], ["issues", "Issues"], ["settings", "Settings"]] as const;
type WorkItem = { id: number; repo: string; number: number; title: string; state: string; author?: string; author_avatar?: string; assignees?: Array<{ login: string; avatar_url?: string }>; html_url?: string; updated_at?: string; draft?: boolean };
type PageResult = { data?: WorkItem[] };
type CurrentResult = { prs: WorkItem[]; issues: WorkItem[]; features: WorkItem[]; members: GithubMember[]; excludedMembers: string[]; ticketEnabled: boolean };
type CurrentSummary = { prs: WorkItem[]; issues: WorkItem[]; members: GithubMember[]; excludedMembers: string[] };
type FeedEvent = { id: string; type: string; createdAt: string; repo: string; summary: string; technicalSummary: string; actor: { login: string; name: string | null; avatarUrl: string | null }; pr: { number: number; title: string; url: string } | null };
type FeedResult = { events?: FeedEvent[]; releaseNotes?: FeedEvent[]; nextCursor?: string | null };
type QuickView = "opened" | "merged" | "issues";

export default function NoxFeedPage() {
  const { organizationId = "", projectId = "", view = "current", person } = useParams();
  const { bootstrap } = useOutletContext<{ bootstrap: Bootstrap }>();
  const project = bootstrap.projects.find((item) => item.id === projectId);
  const ticketEnabled = true;
  const isFeedStream = view === "opened" || view === "merged";
  const isSettings = view === "settings";
  const scope = { organizationId, projectId };
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["feed", organizationId, projectId, view, ticketEnabled],
    queryFn: async ({ signal }) => {
      if (view === "issues") return getRawJson("/api/v1/issues?state=open&page_size=100", signal, scope) as Promise<PageResult>;
      const [summary, featureRecords] = await Promise.all([
        getRawJson("/api/v1/feed/current-summary", signal, scope) as Promise<CurrentSummary>,
        ticketEnabled ? platformApi.ticketFeatures(organizationId, projectId, signal) : Promise.resolve([]),
      ]);
      const features = (featureRecords as TicketFeatureRecord[]).filter((feature) => feature.state === "open").map((feature) => ({
        id: Number(feature.id ?? feature.number), repo: project?.name ?? "Planning", number: feature.number, title: feature.title, state: feature.state,
        assignees: feature.assignees, html_url: feature.html_url ?? undefined, updated_at: feature.updated_at ?? undefined,
      }));
      return { prs: summary.prs ?? [], issues: summary.issues ?? [], features, members: summary.members ?? [], excludedMembers: summary.excludedMembers ?? [], ticketEnabled } satisfies CurrentResult;
    },
    enabled: !isFeedStream && !isSettings,
  });
  const stream = useInfiniteQuery({
    queryKey: ["feed-stream", organizationId, projectId, view],
    enabled: isFeedStream,
    initialPageParam: "",
    queryFn: ({ signal, pageParam }) => {
      const mode = view === "opened" ? "opened" : "merged";
      const before = pageParam ? `&before=${encodeURIComponent(pageParam)}` : "";
      return getRawJson(`/api/v1/feed?mode=${mode}&limit=20${before}`, signal, scope) as Promise<FeedResult>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const releaseNotes = useQuery({
    queryKey: ["feed", organizationId, projectId, "release-notes"],
    queryFn: ({ signal }) => getRawJson("/api/v1/feed?mode=release-notes", signal, scope) as Promise<FeedResult>,
    enabled: view === "merged",
  });
  const prefetchView = useCallback((nextView: string) => {
    if (nextView !== "opened" && nextView !== "merged" && nextView !== "issues") return;
    const quickView = nextView as QuickView;
    if (quickView === "issues") {
      void queryClient.prefetchQuery({
        queryKey: ["feed", organizationId, projectId, quickView, ticketEnabled],
        queryFn: ({ signal }) => getRawJson("/api/v1/issues?state=open&page_size=100", signal, { organizationId, projectId }) as Promise<PageResult>,
      });
      return;
    }
    void queryClient.prefetchInfiniteQuery({
      queryKey: ["feed-stream", organizationId, projectId, quickView],
      initialPageParam: "",
      queryFn: ({ signal }) => getRawJson(`/api/v1/feed?mode=${quickView}&limit=20`, signal, { organizationId, projectId }) as Promise<FeedResult>,
      getNextPageParam: (lastPage: FeedResult) => lastPage.nextCursor ?? undefined,
    });
    if (quickView === "merged") {
      void queryClient.prefetchQuery({
        queryKey: ["feed", organizationId, projectId, "release-notes"],
        queryFn: ({ signal }) => getRawJson("/api/v1/feed?mode=release-notes", signal, { organizationId, projectId }) as Promise<FeedResult>,
      });
    }
  }, [organizationId, projectId, queryClient, ticketEnabled]);

  const base = `/${organizationId}/${projectId}/feed`;
  const streamEvents = stream.data?.pages.flatMap((page) => page.events ?? []) ?? [];
  return <section><ServiceTabs base={base} active={view} tabs={tabs} onIntent={prefetchView} /><div className="workspace-view feed-view">
    {(!isFeedStream && query.isLoading) || (isFeedStream && stream.isLoading) ? <Empty title="Loading activity" detail="Reading project activity…" /> : null}
    {(!isFeedStream && query.isError) || (isFeedStream && stream.isError) ? <Empty title="Activity is unavailable" detail="The project activity API could not be reached. No placeholder activity is being shown." /> : null}
    {query.data && view === "current" ? <Current data={query.data as CurrentResult} base={base} person={person} /> : null}
    {stream.data && isFeedStream ? <Events events={streamEvents} releaseNotes={releaseNotes.data?.events ?? []} label={view} hasNextPage={stream.hasNextPage} loadingMore={stream.isFetchingNextPage} onLoadMore={() => void stream.fetchNextPage()} /> : null}
    {query.data && view === "issues" ? <Issues items={(query.data as PageResult).data ?? []} /> : null}
    {isSettings ? <NoxFeedSettings organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} /> : null}
  </div></section>;
}

function Empty({ title, detail }: { title: string; detail: string }) { return <div className="empty-view" role="status"><h2>{title}</h2><p>{detail}</p></div>; }
function Current({ data, base, person }: { data: CurrentResult; base: string; person?: string }) {
  const excluded = useMemo(() => new Set(data.excludedMembers.map(normalizeLogin)), [data.excludedMembers]);
  const people = useMemo(() => data.members.filter((member) => member.kind === "human" && !excluded.has(normalizeLogin(member.login))).map((member) => ({
    member,
    prs: data.prs.filter((item) => normalizeLogin(item.author) === normalizeLogin(member.login)),
    issues: data.issues.filter((item) => assignedTo(item, member.login)),
    features: data.ticketEnabled ? data.features.filter((item) => assignedTo(item, member.login)) : [],
  })).sort((a, b) => workloadTotal(b) - workloadTotal(a) || a.member.login.localeCompare(b.member.login)), [data, excluded]);
  if (person) {
    const selected = people.find((entry) => normalizeLogin(entry.member.login) === normalizeLogin(person));
    return selected ? <PersonWork person={selected} base={base} ticketEnabled={data.ticketEnabled} /> : <Empty title="Person not found" detail="This person is not tracked for the selected project." />;
  }
  if (!people.length) return <Empty title="No tracked people" detail="Track project members in Settings to show their current workload here." />;
  return <div className="list-surface feed-people">{people.map((entry) => <Link className="list-row feed-person-row" key={entry.member.login} to={`${base}/current/${encodeURIComponent(entry.member.login)}`}>
    <span className="feed-person-avatar">{entry.member.avatar_url ? <img src={entry.member.avatar_url} alt="" loading="lazy" /> : initials(entry.member.login)}</span>
    <span className="list-copy"><b>{entry.member.login}</b><small>{workloadTotal(entry)} open items</small></span>
    <span className="feed-person-counts"><span><b>{entry.prs.length}</b> PRs</span><span><b>{entry.issues.length}</b> issues</span>{data.ticketEnabled ? <span><b>{entry.features.length}</b> features</span> : null}<i aria-hidden="true">→</i></span>
  </Link>)}</div>;
}
function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <section className="feed-group"><header><h3>{title}</h3><span>{count}</span></header><div className="list-surface">{children}</div></section>; }
function WorkRow({ item, kind }: { item: WorkItem; kind: "PR" | "Issue" | "Feature" }) { return <ListRow symbol={kind === "PR" ? "↳" : kind === "Feature" ? "F" : "○"} title={item.title} description={`${item.repo} · #${item.number}`} meta={<>{item.html_url ? <a className="feed-item-link" href={item.html_url} target="_blank" rel="noreferrer">Open ↗</a> : null}<StatusTag tone={item.draft ? "neutral" : "positive"}>{item.draft ? "Draft" : kind}</StatusTag></>} />; }

type PersonWorkload = { member: GithubMember; prs: WorkItem[]; issues: WorkItem[]; features: WorkItem[] };
function PersonWork({ person, base, ticketEnabled }: { person: PersonWorkload; base: string; ticketEnabled: boolean }) {
  return <div className="feed-person-page"><Link className="feed-back-link" to={`${base}/current`}>← All people</Link><header><span className="feed-person-avatar large">{person.member.avatar_url ? <img src={person.member.avatar_url} alt="" /> : initials(person.member.login)}</span><div><h2>{person.member.login}</h2><p>{workloadTotal(person)} open items assigned</p></div></header>
    <Group title="Open pull requests" count={person.prs.length}>{person.prs.length ? person.prs.map((item) => <WorkRow key={`pr-${item.id}`} item={item} kind="PR" />) : <p className="feed-empty-group">No open pull requests.</p>}</Group>
    <Group title="Open issues" count={person.issues.length}>{person.issues.length ? person.issues.map((item) => <WorkRow key={`issue-${item.id}`} item={item} kind="Issue" />) : <p className="feed-empty-group">No open issues.</p>}</Group>
    {ticketEnabled ? <Group title="Open features" count={person.features.length}>{person.features.length ? person.features.map((item) => <WorkRow key={`feature-${item.id}`} item={item} kind="Feature" />) : <p className="feed-empty-group">No open features.</p>}</Group> : null}
  </div>;
}

function normalizeLogin(value?: string) { return (value ?? "").trim().toLowerCase(); }
function assignedTo(item: WorkItem, login: string) { const target = normalizeLogin(login); return (item.assignees ?? []).some((assignee) => normalizeLogin(assignee.login) === target); }
function workloadTotal(person: Pick<PersonWorkload, "prs" | "issues" | "features">) { return person.prs.length + person.issues.length + person.features.length; }
function initials(value: string) { return value.slice(0, 2).toUpperCase(); }
function Events({ events, releaseNotes, label, hasNextPage, loadingMore, onLoadMore }: { events: FeedEvent[]; releaseNotes: FeedEvent[]; label: string; hasNextPage: boolean; loadingMore: boolean; onLoadMore: () => void }) {
  if (!events.length) return <Empty title={`No ${label} records`} detail="Events will appear after NoxConnect receives them for this project." />;
  const notesByPR = new Map(releaseNotes.filter((note) => note.pr).map((note) => [note.pr!.number, note]));
  return <><div className="feed-posts">{events.map((event) => <PostCard key={event.id} event={event} releaseNote={label === "merged" && event.pr ? notesByPR.get(event.pr.number) : undefined} />)}</div>{hasNextPage ? <div className="feed-pagination"><button type="button" className="button" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "Loading…" : "Load more"}</button></div> : null}</>;
}

function PostCard({ event, releaseNote }: { event: FeedEvent; releaseNote?: FeedEvent }) {
  const displayName = event.actor.name || event.actor.login || "unknown";
  const initial = displayName.charAt(0).toUpperCase() || "?";
  return <article className="feed-post-card">
    <header className="feed-post-header">
      <span className="feed-post-avatar">{event.actor.avatarUrl ? <img src={event.actor.avatarUrl} alt="" loading="lazy" /> : initial}</span>
      <span className="feed-post-author"><b>{displayName}</b><span className="feed-post-pills"><span>{event.repo}</span><span>pr:{event.type}</span></span></span>
      <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleDateString()}</time>
    </header>
    <div className="feed-post-body">{event.summary || "(no summary)"}</div>
    <PlainEnglishSummary text={event.technicalSummary} />
    {event.pr?.url ? <a className="feed-post-link" href={event.pr.url} target="_blank" rel="noreferrer"><span>↗</span>{event.pr.title || `View PR #${event.pr.number} on GitHub`}</a> : null}
    {releaseNote?.summary ? <details className="feed-release-note"><summary>Release notes <span>⌄</span></summary><div><p>{releaseNote.summary}</p></div></details> : null}
  </article>;
}
function PlainEnglishSummary({ text }: { text: string }) {
  const items = text.split(/\r?\n/).map((line) => line.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 3).map((line) => {
    const match = line.match(/^(What it does|How it works|What it touches)\s*:\s*(.*)$/i);
    return match ? { label: match[1], detail: match[2] } : { label: "Summary", detail: line };
  });
  if (!items.length) return null;
  return <section className="feed-plain-summary" aria-label="Plain-English summary"><span>Plain-English summary</span><ol>{items.map((item, index) => <li key={`${item.label}-${index}`}><b>{item.label}</b><p>{item.detail}</p></li>)}</ol></section>;
}
function Issues({ items }: { items: WorkItem[] }) { return items.length ? <div className="list-surface">{items.map((item) => <WorkRow key={item.id} item={item} kind="Issue" />)}</div> : <Empty title="No open issues" detail="Issues returned by NoxConnect will appear here." />; }
