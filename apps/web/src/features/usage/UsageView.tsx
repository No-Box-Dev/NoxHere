import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TelemetryStat } from "../../api/contracts";
import { platformApi } from "../../api/platform";
import { AsyncState } from "../../components/AsyncState";
import { ListRow } from "../../components/ListRow";
import { ServiceTabs } from "../../components/ServiceTabs";
import { Sparkline } from "../../components/Sparkline";
import { StatusTag } from "../../components/StatusTag";
import { ALL_FILTER_VALUE, useFilterPreference } from "../../lib/filterPreferences";

type ProjectScope = { organizationId: string; projectId: string };
type UsageViewProps = ProjectScope & { actorId: string; canConfigure?: boolean };
type UsageSubview = "overview" | "engagement" | "events";
const timeRangeValues = [ALL_FILTER_VALUE, "7d", "30d", "90d", "1y"] as const;

const tabs = [
  ["overview", "Overview"],
  ["engagement", "Engagement"],
  ["events", "Events"],
] as const;

export function UsageView({ organizationId, projectId, actorId, canConfigure = false, view = "overview" }: UsageViewProps & { view?: UsageSubview }) {
  const base = `/${organizationId}/${projectId}/usage`;
  return (
    <>
      <ServiceTabs base={base} active={view} tabs={tabs} />
      <div className="workspace-view">
        {view === "overview" ? <UsageDashboard organizationId={organizationId} projectId={projectId} actorId={actorId} canConfigure={canConfigure} mode="overview" /> : view === "engagement" ? <UsageDashboard organizationId={organizationId} projectId={projectId} actorId={actorId} canConfigure={canConfigure} mode="engagement" /> : <UsageEvents organizationId={organizationId} projectId={projectId} actorId={actorId} />}
      </div>
    </>
  );
}

function UsageDashboard({ organizationId, projectId, actorId, canConfigure = false, mode }: UsageViewProps & { mode: "overview" | "engagement" }) {
  const [configuring, setConfiguring] = useState(false);
  const [range, setRange] = useFilterPreference({ actorId, organizationId, projectId, filterId: `usage.${mode}.time-range` }, timeRangeValues);
  const dashboard = useQuery({
    queryKey: ["usage", organizationId, projectId, "dashboard", range],
    queryFn: ({ signal }) => platformApi.usageDashboard(organizationId, projectId, range, signal),
  });

  const exportCsv = () => {
    if (!dashboard.data) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const visibleStats = dashboard.data.stats.filter((stat) => mode === "engagement" ? stat.id.startsWith("custom.") : !stat.id.startsWith("custom."));
    const rows = [["Metric", "Value", "Change", "Context"], ...visibleStats.map((stat) => [stat.name, stat.value, stat.change, stat.context])];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `noxhere-usage-${mode}-${projectId}-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AsyncState loading={dashboard.isLoading} error={dashboard.error}>
      {dashboard.data ? <>
        <div className="toolbar">
          <select name="timeRange" aria-label="Time range" value={range} onChange={(event) => setRange(event.target.value)}><option value="all">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="1y">This year</option></select>
          <span className="toolbar-spacer" /><span>{dashboard.data.dateLabel}</span><StatusTag tone="positive">{dashboard.data.reportStatus}</StatusTag>{mode === "engagement" && canConfigure ? <button className="button" onClick={() => setConfiguring(true)}>Configure actions</button> : null}<button className="button" onClick={exportCsv}>Export CSV</button>
        </div>
        <div className="stat-grid">
          {dashboard.data.stats.filter((stat) => mode === "engagement" ? stat.id.startsWith("custom.") : !stat.id.startsWith("custom.")).map((stat) => <StatCard key={stat.id} stat={stat} />)}
        </div>
        {mode === "engagement" && configuring && canConfigure ? <EngagementActionsDialog organizationId={organizationId} projectId={projectId} onClose={() => setConfiguring(false)} /> : null}
      </> : null}
    </AsyncState>
  );
}

const EMPTY_ACTIONS = [
  { label: "", key: "" },
  { label: "", key: "" },
  { label: "", key: "" },
];

function actionKey(label: string) {
  const slug = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return slug ? `custom.${slug}` : "";
}

function EngagementActionsDialog({ organizationId, projectId, onClose }: ProjectScope & { onClose: () => void }) {
  const configured = useQuery({
    queryKey: ["usage", organizationId, projectId, "actions"],
    queryFn: ({ signal }) => platformApi.usageActions(organizationId, projectId, signal),
  });
  if (configured.data) return <EngagementActionsEditor organizationId={organizationId} projectId={projectId} onClose={onClose} initialActions={configured.data.actions} initialWindowDays={configured.data.windowDays} />;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="cue-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="cue-actions-title"><header><div><span className="eyebrow">STANDARD TEMPLATE</span><h2 id="cue-actions-title">Engagement actions</h2><p>Choose the three actions that show how actively people use your product.</p></div><button type="button" className="dialog-close" aria-label="Close action setup" onClick={onClose}>×</button></header><main><div className="cue-actions-loading">{configured.error instanceof Error ? configured.error.message : "Loading actions…"}</div></main><footer><button type="button" className="button" onClick={onClose}>Close</button></footer></div></div>;
}

function EngagementActionsEditor({ organizationId, projectId, onClose, initialActions, initialWindowDays }: ProjectScope & { onClose: () => void; initialActions: Array<{ key: string; label: string }>; initialWindowDays: 7 | 14 | 30 }) {
  const queryClient = useQueryClient();
  const [actions, setActions] = useState(() => EMPTY_ACTIONS.map((empty, index) => initialActions[index]
    ? { label: initialActions[index].label, key: initialActions[index].key }
    : empty));
  const [copied, setCopied] = useState(false);
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(initialWindowDays);
  const save = useMutation({
    mutationFn: () => platformApi.setUsageActions(organizationId, projectId, actions, windowDays),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["usage", organizationId, projectId, "actions"] }),
        queryClient.invalidateQueries({ queryKey: ["usage", organizationId, projectId, "dashboard"] }),
      ]);
      onClose();
    },
  });
  const valid = actions.length >= 1 && actions.every((action) => action.label.trim() && /^custom\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){0,4}$/.test(action.key.trim()))
    && new Set(actions.map((action) => action.key.trim())).size === actions.length;
  const snippet = actions.filter((action) => action.key).map((action) => `await telemetry.activity("${action.key}", user.id);`).join("\n");

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="cue-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="cue-actions-title">
      <header><div><span className="eyebrow">STANDARD TEMPLATE</span><h2 id="cue-actions-title">Engagement actions</h2><p>Choose the three actions that show how actively people use your product.</p></div><button type="button" className="dialog-close" aria-label="Close action setup" onClick={onClose}>×</button></header>
      <main>
          <div className="cue-template-controls"><div><b>Template settings</b><p>Start with the suggested activities, then adapt them to your product.</p></div><label className="field-label">Engagement timeframe<select aria-label="Engagement timeframe" value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value) as 7 | 14 | 30)}><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select></label></div>
          <div className="cue-action-list">
            {actions.map((action, index) => <section className="cue-action-row" key={index}>
              <span className="cue-action-number">{index + 1}</span>
              <label className="field-label">Action name<input value={action.label} placeholder={["Comments written", "Journals added", "Reviews written"][index]} onChange={(event) => {
                const label = event.target.value;
                setActions((current) => current.map((item, itemIndex) => itemIndex === index
                  ? { label, key: !item.key || item.key === actionKey(item.label) ? actionKey(label) : item.key }
                  : item));
              }} /></label>
              <label className="field-label">Tracking key<input className="mono" value={action.key} placeholder={["custom.comments.written", "custom.journals.added", "custom.reviews.written"][index]} onChange={(event) => setActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value.toLowerCase().replace(/\s+/g, ".") } : item))} /></label>
              {actions.length > 1 ? <button type="button" className="mini-button cue-action-remove" aria-label={`Remove ${action.label || `action ${index + 1}`}`} onClick={() => setActions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button> : null}
            </section>)}
          </div>
          {actions.length < 3 ? <button type="button" className="button cue-add-action" onClick={() => setActions((current) => [...current, { label: "", key: "" }])}>+ Add activity</button> : null}
          <aside className="cue-template-output"><div><b>What Usage creates automatically</b><p>Each action gets a daily total plus a rolling {windowDays}-day engagement card with actions per active user, participation, and actions per participant.</p></div><pre><code>{snippet || "Your tracking calls will appear here."}</code></pre><button type="button" className="mini-button" disabled={!snippet} onClick={() => void navigator.clipboard.writeText(snippet).then(() => setCopied(true))}>{copied ? "Copied" : "Copy setup code"}</button></aside>
          <p className="cue-advanced-note">Need more than three? Additional product actions remain available through the Usage API.</p>
          {save.error ? <p className="form-error">{save.error.message}</p> : null}
      </main>
      <footer><button type="button" className="button" onClick={onClose}>Cancel</button><button type="button" className="button primary-button" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save actions"}</button></footer>
    </div>
  </div>;
}

function StatCard({ stat }: { stat: TelemetryStat }) {
  const breakdown = stat.breakdown;
  if (!breakdown) return <article className="stat-card">
    <span className="stat-card-head"><b>{stat.name}</b><small>{stat.context}</small></span>
    <span className="stat-value"><strong>{stat.value}</strong><small className={stat.direction}>{stat.change}</small></span>
    <Sparkline points={stat.points} />
  </article>;
  const participation = Math.min(1, breakdown.participationRate);
  return <article className="stat-card stat-card-engagement">
    <span className="stat-card-head"><b>{stat.name}</b><small>{stat.context}</small></span>
    <span className="stat-value stat-engagement-value">
      <span><strong>{stat.value}</strong><small>per active user</small></span>
      <small className={stat.direction}>{stat.change}</small>
    </span>
    <p className="stat-equation"><b>{breakdown.totalActions.toLocaleString()}</b> {breakdown.actionLabel} <span>÷</span> <b>{breakdown.activeUsers.toLocaleString()}</b> active users</p>
    <div className="stat-participation">
      <span><b>{(breakdown.participationRate * 100).toFixed(1)}%</b><small>participated</small></span>
      <progress max={1} value={participation} aria-label={`${breakdown.actionLabel} participation`} />
      <span><b>{breakdown.actionsPerParticipant.toFixed(2)}</b><small>per participant</small></span>
    </div>
  </article>;
}

function UsageEvents({ organizationId, projectId, actorId }: UsageViewProps) {
  const events = useQuery({
    queryKey: ["usage", organizationId, projectId, "events"],
    queryFn: ({ signal }) => platformApi.usageEvents(organizationId, projectId, signal),
  });

  const eventTypes = [...new Set((events.data ?? []).map((event) => event.type))];
  const environments = [...new Set((events.data ?? []).map((event) => event.environment))];
  const environmentValues = environments.map((value) => value.toLowerCase());
  const loaded = !events.isLoading;
  const [type, setType] = useFilterPreference(
    { actorId, organizationId, projectId, filterId: "usage.event-type" },
    loaded ? [ALL_FILTER_VALUE, ...eventTypes] : undefined,
  );
  const [environment, setEnvironment] = useFilterPreference(
    { actorId, organizationId, projectId, filterId: "usage.environment" },
    loaded ? [ALL_FILTER_VALUE, ...environmentValues] : undefined,
  );
  const filtered = (events.data ?? []).filter((event) => (type === ALL_FILTER_VALUE || event.type === type) && (environment === ALL_FILTER_VALUE || event.environment.toLowerCase() === environment));
  return (
    <AsyncState loading={events.isLoading} error={events.error}>
      <div className="toolbar"><select name="eventType" aria-label="Event type" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All usage events</option>{eventTypes.map((value) => <option value={value} key={value}>{value}</option>)}</select><select name="eventEnvironment" aria-label="Environment" value={environment} onChange={(event) => setEnvironment(event.target.value)}><option value="all">All environments</option>{environments.map((value) => <option value={value.toLowerCase()} key={value}>{value}</option>)}</select><span className="toolbar-spacer" /><span>{filtered.length} events</span><StatusTag tone="positive">Receiving</StatusTag><button className="button" onClick={() => void events.refetch()}>Refresh</button></div>
      <div className="list-surface">
        {filtered.map((event) => <ListRow key={event.id} symbol="↗" tone="positive" title={event.name} description={<span className="mono">{event.type} · {event.subject} · {event.environment}</span>} meta={<><StatusTag tone="positive">Accepted</StatusTag><span>{event.receivedAt}</span></>} />)}
      </div>
      <div className="callout"><div><b>Events become usage signals</b><p>Accepted user and product actions feed the Usage overview and engagement reports.</p></div></div>
    </AsyncState>
  );
}
