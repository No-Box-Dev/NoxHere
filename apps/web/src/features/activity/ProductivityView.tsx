import { useQuery } from "@tanstack/react-query";
import { platformApi } from "../../api/platform";
import { AsyncState } from "../../components/AsyncState";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";

export function ProductivityView({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const stats = useQuery({
    queryKey: ["activity", organizationId, projectId, "productivity"],
    queryFn: ({ signal }) => platformApi.engineerStats(organizationId, projectId, signal),
  });
  const people = stats.data ? [...new Set([
    ...Object.keys(stats.data.openPRs), ...Object.keys(stats.data.reviewing), ...Object.keys(stats.data.approvalsGiven),
    ...Object.keys(stats.data.mergesOfOthers), ...Object.keys(stats.data.assignedIssues), ...Object.keys(stats.data.prsLast4Weeks),
    ...Object.keys(stats.data.commitsLast4Weeks), ...Object.keys(stats.data.issuesClosed),
  ])].sort((left, right) => left.localeCompare(right)) : [];
  const total = (values: Record<string, number>) => Object.values(values).reduce((sum, value) => sum + value, 0);
  const coverage = stats.data?.coverage ?? { approvalsGivenSince: null, mergedByKnown: 0, mergedPRs: 0, issuesClosedByKnown: 0, closedIssues: 0 };
  const audits = Object.entries(stats.data?.prAudits ?? {});
  const incompleteAudits = audits.filter(([, audit]) => audit.githubPRs !== audit.cachedAllPRs);
  const knownShare = (known: number, all: number) => all > 0 ? `${Math.round((known / all) * 100)}%` : "No history";
  return <AsyncState loading={stats.isLoading} error={stats.error}>{stats.data ? <>
    <div className="stat-grid productivity-summary">
      <ProductivityCard label="Open pull requests" value={total(stats.data.openPRs)} />
      <ProductivityCard label="PRs · last 4 weeks" value={total(stats.data.prsLast4Weeks)} />
      <ProductivityCard label="Commits · last 4 weeks" value={total(stats.data.commitsLast4Weeks)} />
      <ProductivityCard label="Reviews given" value={total(stats.data.approvalsGiven)} />
      <ProductivityCard label="Issues closed" value={total(stats.data.issuesClosed)} />
    </div>
    <div className="productivity-coverage" aria-label="Productivity data coverage">
      <div><b>Data coverage</b><p>{stats.data.freshness?.repositories ?? 0} connected repositories. Latest PR data: {formatFreshness(stats.data.freshness?.pullRequestsAt)}.</p></div>
      <StatusTag tone={coverage.mergedPRs === coverage.mergedByKnown ? "positive" : "warning"}>{knownShare(coverage.mergedByKnown, coverage.mergedPRs)} merge authors</StatusTag>
      <StatusTag tone={coverage.closedIssues === coverage.issuesClosedByKnown ? "positive" : "warning"}>{knownShare(coverage.issuesClosedByKnown, coverage.closedIssues)} issue closers</StatusTag>
      <StatusTag tone={incompleteAudits.length ? "warning" : "positive"}>{audits.length ? `${audits.length - incompleteAudits.length}/${audits.length} PR audits match` : "No PR audit run"}</StatusTag>
    </div>
    <div className="list-surface productivity-list">{people.map((person) => <ListRow key={person} symbol={person.slice(0, 1).toUpperCase()} title={person} description={`${stats.data!.commitsLast4Weeks[person] ?? 0} commits · ${stats.data!.prsLast4Weeks[person] ?? 0} PRs · ${stats.data!.approvalsGiven[person] ?? 0} approvals · ${stats.data!.issuesClosed[person] ?? 0} issues closed in tracked history`} meta={<><StatusTag>{stats.data!.openPRs[person] ?? 0} open PRs</StatusTag><StatusTag>{stats.data!.reviewing[person] ?? 0} reviews waiting</StatusTag><StatusTag>{stats.data!.assignedIssues[person] ?? 0} assigned issues</StatusTag></>} />)}</div>
    {!people.length ? <div className="empty-view"><h2>No productivity data yet</h2><p>Connect GitHub and sync project activity to populate engineering statistics.</p></div> : null}
  </> : null}</AsyncState>;
}

function formatFreshness(value?: string | null) {
  if (!value) return "not synced yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ProductivityCard({ label, value }: { label: string; value: number }) {
  return <article className="stat-card"><span className="stat-card-head"><b>{label}</b><small>Tracked project data</small></span><span className="stat-value"><strong>{value.toLocaleString()}</strong></span></article>;
}
