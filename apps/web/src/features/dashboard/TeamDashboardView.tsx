import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EngineerActivity, EngineerStats, GithubMember } from "../../api/contracts";
import { platformApi } from "../../api/platform";
import { AsyncState } from "../../components/AsyncState";
import { StatusTag } from "../../components/StatusTag";
import { ALL_FILTER_VALUE, useFilterPreference } from "../../lib/filterPreferences";

type DashboardProps = {
  organizationId: string;
  projectId: string;
  actorLogin: string;
  members: GithubMember[];
  membersLoading: boolean;
  membersError: Error | null;
};
type TimelineRange = "days" | "months";
type TimelineScope = "all" | "person";
type ActivityPair = { current: EngineerActivity; previous: EngineerActivity };
type TimelinePoint = { key: string; label: string; pullRequests: number; commits: number };

export function TeamDashboardView({ organizationId, projectId, actorLogin, members, membersLoading, membersError }: DashboardProps) {
  const [range, setRange] = useState<TimelineRange>("days");
  const [scope, setScope] = useFilterPreference<TimelineScope>({ actorId: actorLogin, organizationId, projectId, filterId: "dashboard.activity-scope" }, [ALL_FILTER_VALUE, "person"]);
  const stats = useQuery({
    queryKey: ["activity", organizationId, projectId, "team-dashboard", "stats"],
    queryFn: ({ signal }) => platformApi.engineerStats(organizationId, projectId, signal),
  });
  const settings = useQuery({
    queryKey: ["platform", "project-settings", organizationId, projectId],
    queryFn: ({ signal }) => platformApi.projectSettings(organizationId, projectId, signal),
  });
  const excluded = useMemo(() => new Set((settings.data?.excludedMembers ?? []).map(normalizeLogin)), [settings.data?.excludedMembers]);
  const people = useMemo(() => stats.data ? members
    .filter((member) => member.kind === "human" && !excluded.has(normalizeLogin(member.login)) && hasTrackedActivity(stats.data, member.login))
    .sort((left, right) => score(stats.data!, right.login) - score(stats.data!, left.login) || left.login.localeCompare(right.login)) : [], [excluded, members, stats.data]);
  const [selectedLogin, setSelectedLogin] = useFilterPreference(
    { actorId: actorLogin, organizationId, projectId, filterId: "dashboard.developer" },
    stats.isLoading ? undefined : [actorLogin, ...people.map((person) => person.login)],
    actorLogin,
  );
  const effectiveLogin = people.some((person) => normalizeLogin(person.login) === normalizeLogin(selectedLogin))
    ? selectedLogin
    : people.find((person) => normalizeLogin(person.login) === normalizeLogin(actorLogin))?.login ?? people[0]?.login ?? "";
  const months = useMemo(() => recentMonthKeys(new Date()), []);
  const activities = useQuery({
    queryKey: ["activity", organizationId, projectId, "team-dashboard", "timeline", months.current, months.previous, ...people.map((person) => person.login)],
    queryFn: async ({ signal }) => {
      const rows = await Promise.all(people.map(async (person) => {
        const [current, previous] = await Promise.all([
          platformApi.engineerActivity(organizationId, projectId, person.login, months.current, signal),
          platformApi.engineerActivity(organizationId, projectId, person.login, months.previous, signal),
        ]);
        return [person.login, { current, previous }] as const;
      }));
      return Object.fromEntries(rows) as Record<string, ActivityPair>;
    },
    enabled: people.length > 0,
    staleTime: 5 * 60_000,
  });

  const selectedActivities = scope === "person" && effectiveLogin
    ? activities.data?.[effectiveLogin] ? [activities.data[effectiveLogin]] : []
    : Object.values(activities.data ?? {});
  const timeline = range === "days" ? dailyTimeline(selectedActivities) : monthlyTimeline(selectedActivities);
  const dataError = stats.error ?? settings.error ?? membersError;

  return <AsyncState loading={stats.isLoading || settings.isLoading || membersLoading} error={dataError}>
    {stats.data ? <div className="team-dashboard">
      <header className="team-dashboard-header">
        <div><span className="eyebrow">Workspace dashboard</span><h2>Team pulse</h2><p>Delivery and workload across verified organization members.</p></div>
        <StatusTag tone="positive">Live workload</StatusTag>
      </header>

      <section className="team-summary-grid" aria-label="Current team workload">
        <SummaryCard label="Open PRs" value={sumForPeople(stats.data.openPRs, people)} detail="ready for review" />
        <SummaryCard label="Waiting reviews" value={sumForPeople(stats.data.reviewing, people)} detail="assigned reviewers" />
        <SummaryCard label="Assigned issues" value={sumForPeople(stats.data.assignedIssues, people)} detail="open work" />
        <SummaryCard label="Contributors" value={people.length} detail="verified members" />
      </section>

      <section className="team-timeline-section" aria-labelledby="team-activity-title">
        <header className="team-section-header">
          <div><span className="eyebrow">PR and commit activity</span><h3 id="team-activity-title">{range === "days" ? "Last 30 days" : "Last 12 months"}</h3></div>
          <div className="team-dashboard-controls">
            <Segmented label="Activity scope" value={scope} options={[["all", "All people"], ["person", "Person"]]} onChange={setScope} />
            {scope === "person" ? <label className="team-person-select"><span className="visually-hidden">Developer</span><select aria-label="Developer" value={effectiveLogin} onChange={(event) => setSelectedLogin(event.target.value)}>{people.map((person) => <option key={person.login} value={person.login}>@{person.login}</option>)}</select></label> : null}
            <Segmented label="Chart interval" value={range} options={[["days", "Day"], ["months", "Month"]]} onChange={setRange} />
          </div>
        </header>
        <div className="team-chart-card">
          <div className="team-chart-legend"><Legend color="brand" label="PRs opened" value={sumPoints(timeline, "pullRequests")} /><Legend color="green" label="Commits" value={sumPoints(timeline, "commits")} /></div>
          {activities.isLoading ? <div className="team-chart-empty" role="status"><span className="spinner" />Loading activity…</div>
            : activities.error ? <div className="team-chart-empty error" role="alert">Timeline unavailable: {activities.error.message}</div>
              : timeline.every((point) => point.pullRequests === 0 && point.commits === 0) ? <div className="team-chart-empty">No PR or commit activity in this period.</div>
                : <ActivityChart points={timeline} />}
        </div>
      </section>

      <section aria-labelledby="contribution-distribution-title">
        <SectionTitle id="contribution-distribution-title" title="Contribution distribution" detail="Last four weeks · verified members" />
        <div className="team-contribution-list">{people.map((person) => <ContributionBar key={person.login} person={person} value={score(stats.data!, person.login)} maximum={Math.max(...people.map((entry) => score(stats.data!, entry.login)), 1)} isMe={normalizeLogin(person.login) === normalizeLogin(actorLogin)} />)}</div>
      </section>

      <section aria-labelledby="developer-contribution-title">
        <SectionTitle id="developer-contribution-title" title="Developer contribution" detail="Verified members" />
        <div className="team-developer-list">{people.map((person) => <DeveloperRow key={person.login} person={person} stats={stats.data!} isMe={normalizeLogin(person.login) === normalizeLogin(actorLogin)} />)}</div>
      </section>

      <DataCoverage stats={stats.data} memberCount={people.length} excludedCount={excluded.size} />
      {!people.length ? <div className="empty-view"><h2>No engineering data yet</h2><p>Connect GitHub and sync tracked repositories to populate the team dashboard.</p></div> : null}
    </div> : null}
  </AsyncState>;
}

function SummaryCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article className="team-summary-card" aria-label={`${label}, ${value}, ${detail}`}><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{detail}</small></article>;
}

function Segmented<Value extends string>({ label, value, options, onChange }: { label: string; value: Value; options: readonly (readonly [Value, string])[]; onChange: (value: Value) => void }) {
  return <div className="team-segmented" role="group" aria-label={label}>{options.map(([id, text]) => <button type="button" key={id} className={value === id ? "active" : ""} aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>)}</div>;
}

function Legend({ color, label, value }: { color: "brand" | "green"; label: string; value: number }) {
  return <span className={`team-legend ${color}`}><i />{label.toUpperCase()} <b>{value.toLocaleString()}</b></span>;
}

function ActivityChart({ points }: { points: TimelinePoint[] }) {
  const width = 960;
  const height = 220;
  const top = 18;
  const bottom = 34;
  const chartHeight = height - top - bottom;
  const maximum = Math.max(...points.flatMap((point) => [point.pullRequests, point.commits]), 1);
  const groupWidth = width / points.length;
  const barWidth = Math.max(2, Math.min(11, groupWidth * .3));
  const labelEvery = points.length > 20 ? 5 : 1;
  return <div className="team-chart-scroll"><svg className="team-activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Activity chart with ${points.length} periods`}>
    <title>Pull requests opened and commits by period</title>
    {[0, .5, 1].map((step) => <line key={step} x1="0" x2={width} y1={top + chartHeight * step} y2={top + chartHeight * step} className="chart-grid-line" />)}
    {points.map((point, index) => {
      const center = groupWidth * index + groupWidth / 2;
      const prHeight = point.pullRequests / maximum * chartHeight;
      const commitHeight = point.commits / maximum * chartHeight;
      return <g key={point.key}><title>{point.label}: {point.pullRequests} PRs opened, {point.commits} commits</title>
        <rect className="chart-bar pr" x={center - barWidth - 1} y={top + chartHeight - prHeight} width={barWidth} height={prHeight} rx="1" />
        <rect className="chart-bar commit" x={center + 1} y={top + chartHeight - commitHeight} width={barWidth} height={commitHeight} rx="1" />
        {index % labelEvery === 0 || index === points.length - 1 ? <text x={center} y={height - 10} textAnchor="middle">{point.label}</text> : null}
      </g>;
    })}
  </svg></div>;
}

function SectionTitle({ id, title, detail }: { id: string; title: string; detail: string }) {
  return <header className="team-list-title"><h3 id={id}>{title}</h3><span>{detail}</span></header>;
}

function ContributionBar({ person, value, maximum, isMe }: { person: GithubMember; value: number; maximum: number; isMe: boolean }) {
  return <article className="team-contribution-row"><Avatar person={person} /><div><header><b>@{person.login}</b>{isMe ? <small>You</small> : null}<strong>{value.toLocaleString()}</strong></header><progress max={maximum} value={value} aria-label={`${person.login} contribution score`} /></div></article>;
}

function DeveloperRow({ person, stats, isMe }: { person: GithubMember; stats: EngineerStats; isMe: boolean }) {
  return <article className="team-developer-row"><Avatar person={person} /><div className="team-developer-copy"><span><b>@{person.login}</b>{isMe ? <small>You</small> : null}</span><p>{stats.commitsLast4Weeks[person.login] ?? 0} commits · {stats.prsLast4Weeks[person.login] ?? 0} PRs · {stats.approvalsGiven[person.login] ?? 0} approvals · {stats.issuesClosed[person.login] ?? 0} issues closed</p></div><div className="team-workload"><span><b>{stats.openPRs[person.login] ?? 0}</b> open PRs</span><span><b>{stats.reviewing[person.login] ?? 0}</b> reviews</span><span><b>{stats.assignedIssues[person.login] ?? 0}</b> issues</span></div></article>;
}

function Avatar({ person }: { person: GithubMember }) {
  return <span className="team-avatar">{person.avatar_url ? <img src={person.avatar_url} alt="" loading="lazy" /> : person.login.slice(0, 1).toUpperCase()}</span>;
}

function DataCoverage({ stats, memberCount, excludedCount }: { stats: EngineerStats; memberCount: number; excludedCount: number }) {
  const freshness = stats.freshness;
  const oldest = oldestFreshness(freshness);
  return <section className="team-data-coverage" aria-labelledby="data-coverage-title"><header><h3 id="data-coverage-title">Data coverage</h3><StatusTag tone={oldest ? "positive" : "warning"}>{oldest ? "Synced" : "Waiting for data"}</StatusTag></header><div>
    <CoverageCell label="Repositories" value={freshness?.repositories?.toLocaleString() ?? "–"} detail="connected" />
    <CoverageCell label="Members" value={memberCount.toLocaleString()} detail="with activity" />
    <CoverageCell label="Excluded" value={excludedCount.toLocaleString()} detail="People & access" />
    <CoverageCell label="Oldest source" value={oldest ? relativeDate(oldest) : "–"} detail="data freshness" />
  </div></section>;
}

function CoverageCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <span><small>{label}</small><b>{value}</b><em>{detail}</em></span>;
}

function hasTrackedActivity(stats: EngineerStats, login: string) {
  return [stats.openPRs, stats.reviewing, stats.approvalsGiven, stats.mergesOfOthers, stats.assignedIssues, stats.prsLast4Weeks, stats.commitsLast4Weeks, stats.issuesClosed]
    .some((values) => Object.hasOwn(values, login));
}
function normalizeLogin(value: string) { return value.trim().toLowerCase(); }
function score(stats: EngineerStats, login: string) { return (stats.commitsLast4Weeks[login] ?? 0) + (stats.prsLast4Weeks[login] ?? 0) + (stats.approvalsGiven[login] ?? 0) + (stats.issuesClosed[login] ?? 0); }
function sumForPeople(values: Record<string, number>, people: GithubMember[]) { return people.reduce((sum, person) => sum + (values[person.login] ?? 0), 0); }
function sumPoints(points: TimelinePoint[], key: "pullRequests" | "commits") { return points.reduce((sum, point) => sum + point[key], 0); }
function dateKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; }
function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }
function recentMonthKeys(now: Date) { const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)); return { current: monthKey(now), previous: monthKey(previous) }; }
function dailyTimeline(activities: ActivityPair[]): TimelinePoint[] {
  const now = new Date();
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (29 - index)));
    const key = dateKey(date);
    const values = activities.map((activity) => key.startsWith(activity.current.month) ? activity.current : activity.previous);
    return { key, label: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(date), pullRequests: values.reduce((sum, item) => sum + (item.prsOpened[key] ?? 0), 0), commits: values.reduce((sum, item) => sum + (item.commits[key] ?? 0), 0) };
  });
}
function monthlyTimeline(activities: ActivityPair[]): TimelinePoint[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    const key = monthKey(date);
    return { key, label: new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" }).format(date), pullRequests: activities.reduce((sum, item) => sum + (item.current.monthlyOpened[key] ?? 0), 0), commits: activities.reduce((sum, item) => sum + (item.current.monthlyCommits[key] ?? 0), 0) };
  });
}
function oldestFreshness(freshness: EngineerStats["freshness"]) {
  const dates = [freshness?.pullRequestsAt, freshness?.issuesAt, freshness?.commitsAt, freshness?.eventsAt].flatMap((value) => {
    if (!value) return [];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? [] : [date];
  });
  return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
}
function relativeDate(date: Date) {
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) < 1) return "Today";
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(days, "day");
}
