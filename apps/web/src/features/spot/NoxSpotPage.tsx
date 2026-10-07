import { useInfiniteQuery } from "@tanstack/react-query";
import { Navigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import type { Bootstrap } from "../../api/contracts";
import { getRawJson } from "../../api/http";
import { ServiceTabs } from "../../components/ServiceTabs";
import { StatusTag } from "../../components/StatusTag";
import { NoxSpotMessaging } from "./NoxSpotMessaging";
import { NoxSpotWidgets } from "./NoxSpotWidgets";

const tabs = [["issues", "Open"], ["resolved", "Resolved"], ["widgets", "Widgets"], ["messaging", "Messaging"]] as const;
const SPOT_POLL_INTERVAL_MS = 10_000;
const SPOT_MAX_POLL_INTERVAL_MS = 60_000;
type SpotActivity = { kind: string; actor: string | null; summary: string | null; createdAt: string };
type SpotNotification = { eligible: boolean; status: string; attempts: number; lastError: string | null; lastNotifiedAt: string | null };
type SpotIssue = {
  id: string | null;
  repo: string;
  number: number;
  title: string;
  description: string | null;
  submittedBy: string | null;
  internalReporter: { login: string; name: string; avatarUrl: string | null } | null;
  reportStatus: string;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  url: string | null;
  shareUrl: string | null;
  screenshotUrl: string | null;
  siteName: string | null;
  issueType: string | null;
  environment: string | null;
  contextSections: Array<{ title: string; value: unknown }>;
  author: { login: string; avatarUrl: string | null } | null;
  labels: Array<{ name?: string; color?: string }>;
  source: "noxspot" | "github";
  activity: SpotActivity[];
  notification: SpotNotification;
};
type SpotPage = { issues?: SpotIssue[]; nextCursor?: string | null };

export default function NoxSpotPage() {
  const { organizationId = "no-box-dev", projectId = "playnist", view = "issues" } = useParams();
  const { bootstrap } = useOutletContext<{ bootstrap: Bootstrap }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isGuest = bootstrap.actor.accessLevel === "guest";
  const sourceParam = searchParams.get("source");
  const source: "all" | "noxspot" | "github" = sourceParam === "noxspot" || sourceParam === "github" ? sourceParam : "all";
  const base = `/${organizationId}/${projectId}/spot`;
  const query = useInfiniteQuery({
    queryKey: ["spot", organizationId, projectId, view],
    initialPageParam: "",
    queryFn: ({ signal, pageParam }) => {
      const pageView = view === "resolved" ? "resolved" : "open";
      const before = pageParam ? `&before=${encodeURIComponent(pageParam)}` : "";
      return getRawJson(`/api/v1/spots/project-overview?view=${pageView}&limit=50${before}`, signal, { organizationId, projectId }) as Promise<SpotPage>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: view === "issues" || view === "resolved",
    refetchInterval: (current) => (current.state.data?.pages.length ?? 0) > 1
      ? false
      : Math.min(
        SPOT_POLL_INTERVAL_MS * (2 ** Math.min(current.state.fetchFailureCount, 3)),
        SPOT_MAX_POLL_INTERVAL_MS,
      ),
    refetchIntervalInBackground: false,
  });
  const visible = (query.data?.pages.flatMap((page) => page.issues ?? []) ?? [])
    .filter((issue) => source === "all" || issue.source === source);
  if (isGuest && (view === "widgets" || view === "messaging")) return <Navigate replace to={`${base}/issues`} />;
  const visibleTabs = isGuest ? tabs.filter(([id]) => id === "issues" || id === "resolved") : tabs;
  const showsReports = view === "issues" || view === "resolved";
  const refreshActions = query.data && showsReports ? <>
    <select className="spot-source-filter" aria-label="Issue source" value={source} onChange={(event) => {
      const next = new URLSearchParams(searchParams);
      if (event.target.value === "all") next.delete("source"); else next.set("source", event.target.value);
      setSearchParams(next);
    }}><option value="all">All sources</option><option value="noxspot">Feedback</option><option value="github">GitHub</option></select>
    <StatusTag tone={query.isError ? "warning" : "positive"}>{query.isError ? "Refresh delayed" : "Live"}</StatusTag>
    <span>{visible.length} {view === "resolved" ? "resolved" : "open"}</span>
    <span role="status" aria-live="polite">{query.isFetching ? "Checking NoxConnect…" : `Updated ${formatUpdatedAt(query.dataUpdatedAt)}`}</span>
    <button className="button compact-button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Refreshing…" : "Refresh"}</button>
  </> : null;
  return <section><ServiceTabs base={base} active={view} tabs={visibleTabs} actions={refreshActions} /><div className="workspace-view">
    {query.isLoading ? <Empty title="Loading feedback" detail="Reading project feedback…" /> : null}
    {query.isError && !query.data ? <Empty title="Feedback is unavailable" detail="The feedback API could not be reached. No placeholder reports are being shown." /> : null}
    {query.data && showsReports ? <>
      {visible.length ? <div className="spot-reports">{visible.map((issue) => <SpotReport key={`${issue.repo}-${issue.number}`} issue={issue} resolved={view === "resolved"} />)}</div> : <Empty title={`No ${view === "issues" ? "open" : "resolved"} issues`} detail={source === "all" ? "Issues from GitHub and Feedback will appear here." : `No ${source === "noxspot" ? "Feedback" : "GitHub"} issues match this view.`} />}
      {query.hasNextPage ? <div className="feed-pagination"><button type="button" className="button" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</button></div> : null}
    </> : null}
    {view === "widgets" ? <NoxSpotWidgets organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} /> : null}
    {view === "messaging" ? <NoxSpotMessaging organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} /> : null}
  </div></section>;
}

function Empty({ title, detail }: { title: string; detail: string }) { return <div className="empty-view" role="status"><h2>{title}</h2><p>{detail}</p></div>; }

function SpotReport({ issue, resolved }: { issue: SpotIssue; resolved: boolean }) {
  const reporter = issue.submittedBy || issue.author?.login || "Anonymous reporter";
  const date = issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : null;
  return <details className="spot-report">
    <summary>
      <span className="spot-report-avatar">{issue.internalReporter?.avatarUrl ? <img src={issue.internalReporter.avatarUrl} alt={reporter} loading="lazy" /> : reporter.charAt(0).toUpperCase()}</span>
      <span className="spot-report-summary">
        <b>{issue.title}</b>
        <small>{issue.siteName || issue.repo} · #{issue.number} · {reporter}{date ? ` · ${date}` : ""}</small>
      </span>
      <span className="spot-report-meta"><StatusTag>{issue.source === "noxspot" ? "Feedback" : "GitHub"}</StatusTag><StatusTag tone={resolved ? "positive" : "warning"}>{issue.reportStatus}</StatusTag></span>
      <span className="spot-report-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="spot-report-detail">
      {issue.screenshotUrl ? <a className="spot-report-image" href={issue.screenshotUrl} target="_blank" rel="noreferrer"><img src={issue.screenshotUrl} alt={`Screenshot attached to ${issue.title}`} loading="lazy" /><span>Open full image ↗</span></a> : null}
      <div className="spot-report-copy">
        <section>
          <span className="spot-detail-label">Report</span>
          <p>{issue.description || "No written description was captured with this report."}</p>
          <div className="spot-report-tags">
            {issue.issueType ? <span>{issue.issueType}</span> : null}
            {issue.environment ? <span>{issue.environment}</span> : null}
            {issue.labels?.filter((label) => label.name && label.name.toLowerCase() !== "noxspot").map((label) => <span key={label.name}>{label.name}</span>)}
          </div>
        </section>
        {issue.contextSections?.length ? <section>
          <span className="spot-detail-label">Captured context</span>
          <div className="spot-context">{issue.contextSections.map((section) => <details key={section.title}><summary>{section.title}<span>⌄</span></summary><pre>{JSON.stringify(section.value, null, 2)}</pre></details>)}</div>
        </section> : null}
        {resolved ? <section className="spot-resolution">
          <span className="spot-detail-label">Resolution</span>
          <p>{issue.resolutionSummary || "This report was closed in GitHub."}</p>
          {issue.resolvedAt ? <small>Resolved {new Date(issue.resolvedAt).toLocaleDateString()}{issue.resolvedBy ? ` by ${issue.resolvedBy}` : ""}</small> : null}
        </section> : null}
        {issue.activity?.length ? <section>
          <span className="spot-detail-label">Activity</span>
          <div className="spot-activity">{issue.activity.map((activity, index) => <span key={`${activity.kind}-${activity.createdAt}-${index}`}><b>{humanize(activity.kind)}</b><small>{activity.summary || activity.actor || "Updated"} · {new Date(activity.createdAt).toLocaleDateString()}</small></span>)}</div>
        </section> : null}
        <footer className="spot-report-actions">
          {issue.url ? <a href={issue.url} target="_blank" rel="noreferrer">Open GitHub issue ↗</a> : null}
          {issue.shareUrl && issue.shareUrl !== issue.url ? <a href={issue.shareUrl} target="_blank" rel="noreferrer">Open shared report ↗</a> : null}
          {issue.notification?.eligible ? <span>Reporter message: {humanize(issue.notification.status)}</span> : null}
        </footer>
      </div>
    </div>
  </details>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUpdatedAt(value: number) {
  if (!value) return "just now";
  const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}
