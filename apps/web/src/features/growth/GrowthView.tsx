import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformApi } from "../../api/platform";
import { AsyncState } from "../../components/AsyncState";
import { ListRow } from "../../components/ListRow";
import { ServiceTabs } from "../../components/ServiceTabs";
import { Sparkline } from "../../components/Sparkline";
import { StatusTag } from "../../components/StatusTag";

type GrowthSubview = "overview" | "funnel" | "events";
type GrowthViewProps = { organizationId: string; projectId: string; view: GrowthSubview };

const tabs = [["overview", "Overview"], ["funnel", "Funnel"], ["events", "Events"]] as const;

export function GrowthView({ organizationId, projectId, view }: GrowthViewProps) {
  const base = `/${organizationId}/${projectId}/growth`;
  return <><ServiceTabs base={base} active={view} tabs={tabs} /><div className="workspace-view">
    {view === "events" ? <GrowthEvents organizationId={organizationId} projectId={projectId} /> : <GrowthDashboard organizationId={organizationId} projectId={projectId} view={view} />}
  </div></>;
}

function GrowthDashboard({ organizationId, projectId, view }: GrowthViewProps) {
  const [range, setRange] = useState("30d");
  const dashboard = useQuery({
    queryKey: ["growth", organizationId, projectId, "dashboard", range],
    queryFn: ({ signal }) => platformApi.growthDashboard(organizationId, projectId, range, signal),
  });
  return <AsyncState loading={dashboard.isLoading} error={dashboard.error}>{dashboard.data ? <>
    <div className="toolbar"><select aria-label="Time range" value={range} onChange={(event) => setRange(event.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="1y">This year</option></select><span className="toolbar-spacer" /><span>{dashboard.data.dateLabel}</span><StatusTag tone="positive">Growth data</StatusTag></div>
    {view === "overview" ? <div className="stat-grid">{dashboard.data.metrics.map((metric) => <article className="stat-card" key={metric.id}><span className="stat-card-head"><b>{metric.label}</b><small>{dashboard.data.range}</small></span><span className="stat-value"><strong>{metric.value.toLocaleString()}</strong></span><Sparkline points={metric.points} /></article>)}</div> : <Funnel funnel={dashboard.data.funnel} />}
  </> : null}</AsyncState>;
}

function Funnel({ funnel }: { funnel: { visits: number; signupIntents: number; trials: number; paid: number; cancelled: number; trialToPaidRate: number | null } }) {
  const stages = [
    ["Visits", funnel.visits],
    ["Signup intent", funnel.signupIntents],
    ["Trials", funnel.trials],
    ["Paid", funnel.paid],
  ] as const;
  const maximum = Math.max(1, ...stages.map(([, value]) => value));
  return <div className="growth-funnel"><div className="list-surface">{stages.map(([label, value], index) => <div className="list-row growth-funnel-row" key={label}><span className="row-symbol">{index + 1}</span><span className="list-copy"><b>{label}</b><progress max={maximum} value={value} aria-label={label} /></span><span className="list-meta"><strong>{value.toLocaleString()}</strong></span></div>)}</div><div className="stat-grid"><article className="stat-card"><span className="stat-card-head"><b>Trial to paid</b><small>Selected period</small></span><span className="stat-value"><strong>{funnel.trialToPaidRate === null ? "—" : `${(funnel.trialToPaidRate * 100).toFixed(1)}%`}</strong></span></article><article className="stat-card"><span className="stat-card-head"><b>Cancellations</b><small>Selected period</small></span><span className="stat-value"><strong>{funnel.cancelled.toLocaleString()}</strong></span></article></div></div>;
}

function GrowthEvents({ organizationId, projectId }: Omit<GrowthViewProps, "view">) {
  const events = useQuery({
    queryKey: ["growth", organizationId, projectId, "events"],
    queryFn: ({ signal }) => platformApi.growthEvents(organizationId, projectId, signal),
  });
  return <AsyncState loading={events.isLoading} error={events.error}>
    <div className="toolbar"><span>{events.data?.length ?? 0} events</span><span className="toolbar-spacer" /><StatusTag tone="positive">Receiving</StatusTag><button className="button" onClick={() => void events.refetch()}>Refresh</button></div>
    <div className="list-surface">{events.data?.map((event) => <ListRow key={event.id} symbol="↗" tone="positive" title={event.name.replaceAll(".", " ")} description={`${event.environment}${event.subject ? ` · ${event.subject}` : " · anonymous"}`} meta={<><StatusTag>{event.value.toLocaleString()}</StatusTag><span>{new Date(event.occurredAt).toLocaleString()}</span></>} />)}</div>
    {!events.data?.length ? <div className="empty-view"><h2>No growth events yet</h2><p>Website and subscription conversion events will appear here.</p></div> : null}
  </AsyncState>;
}
