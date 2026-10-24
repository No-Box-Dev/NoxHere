import { DeliveryHealth } from "../../components/DeliveryHealth";
import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import type { GithubMember, PlanningFeatureRecord } from "../../api/contracts";
import { getRawJson, postRawJson } from "../../api/http";
import { platformApi } from "../../api/platform";
import { useConfirmDialog } from "../../components/ConfirmDialog";
import { ListRow } from "../../components/ListRow";
import { ServiceTabs } from "../../components/ServiceTabs";
import { StatusTag } from "../../components/StatusTag";
import type { PlatformOutletContext } from "../../app/platform-context";
import { Button } from "@/components/ui/button";

const tabs = [["current", "Current work"], ["opened", "Pull requests"], ["merged", "Releases"]] as const;
type WorkItem = { id: number; repo: string; number: number; title: string; state: string; author?: string; author_avatar?: string; assignees?: Array<{ login: string; avatar_url?: string }>; html_url?: string; updated_at?: string; draft?: boolean };
type CurrentResult = { prs: WorkItem[]; issues: WorkItem[]; features: WorkItem[]; members: GithubMember[]; excludedMembers: string[]; planningEnabled: boolean; planningUnavailable: boolean };
type CurrentSummary = { prs: WorkItem[]; issues: WorkItem[]; members: GithubMember[]; excludedMembers: string[] };
type FeedEvent = { id: string; type: string; createdAt: string; repo: string; summary: string; technicalSummary: string; actor: { login: string; name: string | null; avatarUrl: string | null }; pr: { number: number; title: string; url: string } | null };
type FeedResult = { events?: FeedEvent[]; releaseNotes?: FeedEvent[]; nextCursor?: string | null };
type QuickView = "opened" | "merged";

export default function ActivityPage() {
  const { organizationId = "", projectId = "", view = "current", person } = useParams();
  const { bootstrap, members, membersError, retryMembers } = useOutletContext<PlatformOutletContext>();
  const project = bootstrap.projects.find((item) => item.id === projectId);
  const planningEnabled = true;
  const isFeedStream = view === "opened" || view === "merged";
  const isLegacyDashboard = view === "dashboard" || view === "productivity";
  const isSettings = view === "settings";
  const scope = { organizationId, projectId };
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["activity", organizationId, projectId, view, planningEnabled],
    queryFn: async ({ signal }) => {
      const [summary, planning] = await Promise.all([
        getRawJson("/api/v1/activity/current-summary", signal, scope) as Promise<CurrentSummary>,
        // Planning enriches the Current view, but it is not required to show
        // GitHub PRs and issues. Keep the core workload usable if that
        // capability is temporarily unavailable.
        planningEnabled
          ? platformApi.planningFeatures(organizationId, projectId, signal).then((features) => ({ features, unavailable: false })).catch((error: unknown) => {
            if (signal.aborted) throw error;
            return { features: [], unavailable: true };
          })
          : Promise.resolve({ features: [], unavailable: false }),
      ]);
      const features = (planning.features as PlanningFeatureRecord[]).filter((feature) => feature.state === "open").map((feature) => ({
        id: Number(feature.id ?? feature.number), repo: project?.name ?? "Planning", number: feature.number, title: feature.title, state: feature.state,
        assignees: feature.assignees, html_url: feature.html_url ?? undefined, updated_at: feature.updated_at ?? undefined,
      }));
      return { prs: summary.prs ?? [], issues: summary.issues ?? [], features, members: summary.members ?? [], excludedMembers: summary.excludedMembers ?? [], planningEnabled: planningEnabled && !planning.unavailable, planningUnavailable: planning.unavailable } satisfies CurrentResult;
    },
    enabled: !isFeedStream && !isSettings && !isLegacyDashboard,
  });
  const stream = useInfiniteQuery({
    queryKey: ["feed-stream", organizationId, projectId, view],
    enabled: isFeedStream,
    initialPageParam: "",
    queryFn: ({ signal, pageParam }) => {
      const mode = view === "opened" ? "opened" : "merged";
      const before = pageParam ? `&before=${encodeURIComponent(pageParam)}` : "";
      return getRawJson(`/api/v1/activity?mode=${mode}&limit=20${before}`, signal, scope) as Promise<FeedResult>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const releaseNotes = useQuery({
    queryKey: ["activity", organizationId, projectId, "release-notes"],
    queryFn: ({ signal }) => getRawJson("/api/v1/activity?mode=release-notes", signal, scope) as Promise<FeedResult>,
    enabled: view === "merged",
  });
  const prefetchView = useCallback((nextView: string) => {
    if (nextView !== "opened" && nextView !== "merged") return;
    const quickView = nextView as QuickView;
    void queryClient.prefetchInfiniteQuery({
      queryKey: ["feed-stream", organizationId, projectId, quickView],
      initialPageParam: "",
      queryFn: ({ signal }) => getRawJson(`/api/v1/activity?mode=${quickView}&limit=20`, signal, { organizationId, projectId }) as Promise<FeedResult>,
      getNextPageParam: (lastPage: FeedResult) => lastPage.nextCursor ?? undefined,
    });
    if (quickView === "merged") {
      void queryClient.prefetchQuery({
        queryKey: ["activity", organizationId, projectId, "release-notes"],
        queryFn: ({ signal }) => getRawJson("/api/v1/activity?mode=release-notes", signal, { organizationId, projectId }) as Promise<FeedResult>,
      });
    }
  }, [organizationId, projectId, queryClient]);

  const base = `/${organizationId}/${projectId}/activity`;
  if (isSettings) return <Navigate replace to={`/${organizationId}/${projectId}/settings/notifications`} />;
  if (isLegacyDashboard) return <Navigate replace to={`/${organizationId}/${projectId}/dashboard/overview`} />;
  const streamEvents = stream.data?.pages.flatMap((page) => page.events ?? []) ?? [];
  return <section><ServiceTabs base={base} active={view} tabs={tabs} onIntent={prefetchView} /><div className="workspace-view feed-view">
    <DeliveryHealth organizationId={organizationId} projectId={projectId} />
    {(!isFeedStream && !isLegacyDashboard && query.isLoading) || (isFeedStream && stream.isLoading) ? <Empty title="Loading delivery" detail="Reading project delivery…" /> : null}
    {(!isFeedStream && !isLegacyDashboard && query.isError && !query.data) || (isFeedStream && stream.isError && !stream.data) ? <Empty title="Delivery is unavailable" detail="Project delivery could not be loaded. Try refreshing this page." /> : null}
    {query.data?.planningUnavailable && view === "current" ? <p role="status">Partial workload: Planning is unavailable. Feature counts are omitted; GitHub pull requests and issues are still shown.</p> : null}
    {membersError && view === "current" ? <p role="status">People could not be refreshed. Workload coverage may be incomplete. <button className="button" onClick={retryMembers}>Retry people</button></p> : null}
    {releaseNotes.isError && view === "merged" ? <p role="status">Release notes are unavailable. The pull request feed is still shown.</p> : null}
    {stream.isError && stream.data ? <p role="status">Delivery refresh failed. Previously loaded items are shown.</p> : null}
    {query.isError && query.data ? <p role="status">Workload refresh failed. Previously loaded items are shown.</p> : null}
    {query.data && view === "current" ? <Current data={{ ...(query.data as CurrentResult), members }} base={base} person={person} scope={scope} isAdmin={bootstrap.actor.isAdmin} /> : null}
    {stream.data && isFeedStream ? <Events events={streamEvents} releaseNotes={releaseNotes.data?.events ?? []} label={view} hasNextPage={stream.hasNextPage} loadingMore={stream.isFetchingNextPage} onLoadMore={() => void stream.fetchNextPage()} /> : null}
  </div></section>;
}

function Empty({ title, detail }: { title: string; detail: string }) { return <div className="empty-view" role="status"><h2>{title}</h2><p>{detail}</p></div>; }
function Current({ data, base, person, scope, isAdmin }: { data: CurrentResult; base: string; person?: string; scope: { organizationId: string; projectId: string }; isAdmin: boolean }) {
  const excluded = useMemo(() => new Set(data.excludedMembers.map(normalizeLogin)), [data.excludedMembers]);
  const people = useMemo(() => data.members.filter((member) => member.kind === "human" && !excluded.has(normalizeLogin(member.login))).map((member) => {
    const prGroups = splitPullRequests(data.prs, member.login);
    return {
      member,
      ...prGroups,
      issues: data.issues.filter((item) => assignedTo(item, member.login)),
      features: data.planningEnabled ? data.features.filter((item) => assignedTo(item, member.login)) : [],
    };
  }).sort((a, b) => workloadTotal(b) - workloadTotal(a) || a.member.login.localeCompare(b.member.login)), [data, excluded]);
  if (person) {
    const selected = people.find((entry) => normalizeLogin(entry.member.login) === normalizeLogin(person));
    return selected ? <PersonWork person={selected} base={base} planningEnabled={data.planningEnabled} scope={scope} isAdmin={isAdmin} /> : <Empty title="Person not found" detail="This person is not tracked for the selected project." />;
  }
  if (!people.length) return <Empty title="No tracked people" detail="Track project members in Settings to show their current workload here." />;
  return <div className="list-surface feed-people">{people.map((entry) => <Link className="list-row feed-person-row" key={entry.member.login} to={`${base}/current/${encodeURIComponent(entry.member.login)}`}>
    <span className="feed-person-avatar">{entry.member.avatar_url ? <img src={entry.member.avatar_url} alt="" loading="lazy" /> : initials(entry.member.login)}</span>
    <span className="list-copy"><b>{entry.member.login}</b><small>{workloadTotal(entry)} open items</small></span>
    <span className="feed-person-counts"><CountBadge count={entry.openPrs.length} singular="open PR" plural="open PRs" /><CountBadge count={entry.drafts.length} singular="draft" plural="drafts" /><CountBadge count={entry.issues.length} singular="issue" plural="issues" />{data.planningEnabled ? <CountBadge count={entry.features.length} singular="feature" plural="features" /> : null}<i aria-hidden="true">→</i></span>
  </Link>)}</div>;
}
function CountBadge({ count, singular, plural }: { count: number; singular: string; plural: string }) { const label = count === 1 ? singular : plural; return <span aria-label={`${count} ${label}`}><b>{count}</b> {label}</span>; }
function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <section className="feed-group"><header><h3>{title}</h3><span>{count}</span></header><div className="list-surface">{children}</div></section>; }
function WorkRow({ item, kind, scope, isAdmin }: { item: WorkItem; kind: "PR" | "Issue" | "Feature"; scope: { organizationId: string; projectId: string }; isAdmin: boolean }) { return <ListRow symbol={kind === "PR" ? "↳" : kind === "Feature" ? "F" : "○"} title={item.title} description={`${item.repo} · #${item.number}`} meta={<>{item.html_url ? <a className="feed-item-link" href={item.html_url} target="_blank" rel="noreferrer">Open ↗</a> : null}{kind === "PR" && isAdmin ? <PullRequestActions item={item} scope={scope} /> : null}<StatusTag tone={item.draft ? "neutral" : "positive"}>{item.draft ? "Draft" : kind}</StatusTag></>} />; }

type PersonWorkload = { member: GithubMember; openPrs: WorkItem[]; drafts: WorkItem[]; issues: WorkItem[]; features: WorkItem[] };
function PersonWork({ person, base, planningEnabled, scope, isAdmin }: { person: PersonWorkload; base: string; planningEnabled: boolean; scope: { organizationId: string; projectId: string }; isAdmin: boolean }) {
  return <div className="feed-person-page"><Link className="feed-back-link" to={`${base}/current`}>← All people</Link><header><span className="feed-person-avatar large">{person.member.avatar_url ? <img src={person.member.avatar_url} alt="" /> : initials(person.member.login)}</span><div><h2>{person.member.login}</h2><p>{workloadTotal(person)} open items assigned</p></div></header>
    <Group title="Open pull requests" count={person.openPrs.length}>{person.openPrs.length ? person.openPrs.map((item) => <WorkRow key={`pr-${item.id}`} item={item} kind="PR" scope={scope} isAdmin={isAdmin} />) : <p className="feed-empty-group">No open pull requests.</p>}</Group>
    <Group title="Draft pull requests" count={person.drafts.length}>{person.drafts.length ? person.drafts.map((item) => <WorkRow key={`draft-${item.id}`} item={item} kind="PR" scope={scope} isAdmin={isAdmin} />) : <p className="feed-empty-group">No draft pull requests.</p>}</Group>
    <Group title="Open issues" count={person.issues.length}>{person.issues.length ? person.issues.map((item) => <WorkRow key={`issue-${item.id}`} item={item} kind="Issue" scope={scope} isAdmin={isAdmin} />) : <p className="feed-empty-group">No open issues.</p>}</Group>
    {planningEnabled ? <Group title="Open features" count={person.features.length}>{person.features.length ? person.features.map((item) => <WorkRow key={`feature-${item.id}`} item={item} kind="Feature" scope={scope} isAdmin={isAdmin} />) : <p className="feed-empty-group">No open features.</p>}</Group> : null}
  </div>;
}

function PullRequestActions({ item, scope }: { item: WorkItem; scope: { organizationId: string; projectId: string } }) {
  const queryClient = useQueryClient();
  const { confirm, confirmation } = useConfirmDialog();
  const mutation = useMutation({
    mutationFn: ({ action }: { action: "close" | "merge" }) => action === "merge"
      ? postRawJson("/api/v1/prs/merge", { repo: item.repo, number: item.number, method: "squash" }, scope)
      : postRawJson("/api/v1/prs/close", { repo: item.repo, number: item.number }, scope),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity", scope.organizationId, scope.projectId] }),
  });
  const act = (action: "close" | "merge") => void confirm({
    title: `${action === "merge" ? "Merge" : "Close"} ${item.repo} #${item.number}?`,
    detail: action === "merge"
      ? "NoxHere will squash-merge the current head through the GitHub App. GitHub branch rules and required checks still apply."
      : "This closes the pull request without merging it.",
    confirmLabel: action === "merge" ? "Merge pull request" : "Close pull request",
    destructive: action === "close",
  }).then((confirmed) => { if (confirmed) mutation.mutate({ action }); });
  return <>
    <Button type="button" size="sm" disabled={mutation.isPending} onClick={() => act("merge")}>{mutation.isPending ? "Working…" : "Merge"}</Button>
    <button type="button" className="mini-button destructive" disabled={mutation.isPending} onClick={() => act("close")}>Close</button>
    {mutation.error ? <small role="alert">{mutation.error.message}</small> : null}
    {confirmation}
  </>;
}

function normalizeLogin(value?: string) { return (value ?? "").trim().toLowerCase(); }
function assignedTo(item: WorkItem, login: string) { const target = normalizeLogin(login); return (item.assignees ?? []).some((assignee) => normalizeLogin(assignee.login) === target); }
function splitPullRequests(items: WorkItem[], login: string) {
  const target = normalizeLogin(login);
  const openPrs: WorkItem[] = [];
  const drafts: WorkItem[] = [];
  for (const item of items) {
    if (normalizeLogin(item.author) !== target) continue;
    (item.draft ? drafts : openPrs).push(item);
  }
  return { openPrs, drafts };
}
function workloadTotal(person: Pick<PersonWorkload, "openPrs" | "drafts" | "issues" | "features">) { return person.openPrs.length + person.drafts.length + person.issues.length + person.features.length; }
function initials(value: string) { return value.slice(0, 2).toUpperCase(); }
function Events({ events, releaseNotes, label, hasNextPage, loadingMore, onLoadMore }: { events: FeedEvent[]; releaseNotes: FeedEvent[]; label: string; hasNextPage: boolean; loadingMore: boolean; onLoadMore: () => void }) {
  if (!events.length) return <Empty title={`No ${label} records`} detail="Events will appear after NoxHere receives them for this project." />;
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

