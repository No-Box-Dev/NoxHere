import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { CueStat } from "../../../api/contracts";
import { platformApi } from "../../../api/platform";
import { AsyncState } from "../../../components/AsyncState";
import { ListRow } from "../../../components/ListRow";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { Sparkline } from "../../../components/Sparkline";
import { StatusTag } from "../../../components/StatusTag";

type StatsViewProps = { organizationId: string; projectId: string };
type StatsSubview = "dashboard" | "events";

const segments = [
  { id: "dashboard", label: "Dashboard", description: "Trends and totals" },
  { id: "events", label: "Stat events", description: "Incoming triggers" },
] as const;

export function StatsView({ organizationId, projectId }: StatsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get("view") === "events" ? "events" : "dashboard";
  const select = (view: StatsSubview) => setSearchParams(view === "dashboard" ? {} : { view });

  return (
    <div className="workspace-view">
      <SegmentedControl label="Stats views" value={selected} segments={segments} onChange={select} />
      {selected === "dashboard" ? <StatsDashboard organizationId={organizationId} projectId={projectId} /> : <StatEvents organizationId={organizationId} projectId={projectId} />}
    </div>
  );
}

function StatsDashboard({ organizationId, projectId }: StatsViewProps) {
  const [configuring, setConfiguring] = useState(false);
  const [range, setRange] = useState("30d");
  const dashboard = useQuery({
    queryKey: ["cue", organizationId, projectId, "dashboard", range],
    queryFn: ({ signal }) => platformApi.cueDashboard(organizationId, projectId, range, signal),
  });

  const exportCsv = () => {
    if (!dashboard.data) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Metric", "Value", "Change", "Context"], ...dashboard.data.stats.map((stat) => [stat.name, stat.value, stat.change, stat.context])];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `noxcue-${projectId}-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AsyncState loading={dashboard.isLoading} error={dashboard.error}>
      {dashboard.data ? <>
        <div className="toolbar">
          <select name="timeRange" aria-label="Time range" value={range} onChange={(event) => setRange(event.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="1y">This year</option></select>
          <span className="toolbar-spacer" /><span>{dashboard.data.dateLabel}</span><StatusTag tone="positive">{dashboard.data.reportStatus}</StatusTag><button className="button" onClick={() => setConfiguring(true)}>Configure actions</button><button className="button" onClick={exportCsv}>Export CSV</button>
        </div>
        <div className="stat-grid">
          {dashboard.data.stats.map((stat) => <StatCard key={stat.id} stat={stat} />)}
        </div>
        {configuring ? <EngagementActionsDialog organizationId={organizationId} projectId={projectId} onClose={() => setConfiguring(false)} /> : null}
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

function EngagementActionsDialog({ organizationId, projectId, onClose }: StatsViewProps & { onClose: () => void }) {
  const configured = useQuery({
    queryKey: ["cue", organizationId, projectId, "actions"],
    queryFn: ({ signal }) => platformApi.cueActions(organizationId, projectId, signal),
  });
  if (configured.data) return <EngagementActionsEditor organizationId={organizationId} projectId={projectId} onClose={onClose} initialActions={configured.data.actions} initialWindowDays={configured.data.windowDays} />;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="cue-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="cue-actions-title"><header><div><span className="eyebrow">STANDARD TEMPLATE</span><h2 id="cue-actions-title">Engagement actions</h2><p>Choose the three actions that show how actively people use your product.</p></div><button type="button" className="dialog-close" aria-label="Close action setup" onClick={onClose}>×</button></header><main><div className="cue-actions-loading">{configured.error instanceof Error ? configured.error.message : "Loading actions…"}</div></main><footer><button type="button" className="button" onClick={onClose}>Close</button></footer></div></div>;
}

function EngagementActionsEditor({ organizationId, projectId, onClose, initialActions, initialWindowDays }: StatsViewProps & { onClose: () => void; initialActions: Array<{ key: string; label: string }>; initialWindowDays: 7 | 14 | 30 }) {
  const queryClient = useQueryClient();
  const [actions, setActions] = useState(() => EMPTY_ACTIONS.map((empty, index) => initialActions[index]
    ? { label: initialActions[index].label, key: initialActions[index].key }
    : empty));
  const [copied, setCopied] = useState(false);
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(initialWindowDays);
  const save = useMutation({
    mutationFn: () => platformApi.setCueActions(organizationId, projectId, actions, windowDays),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cue", organizationId, projectId, "actions"] }),
        queryClient.invalidateQueries({ queryKey: ["cue", organizationId, projectId, "dashboard"] }),
      ]);
      onClose();
    },
  });
  const valid = actions.length >= 1 && actions.every((action) => action.label.trim() && /^custom\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){0,4}$/.test(action.key.trim()))
    && new Set(actions.map((action) => action.key.trim())).size === actions.length;
  const snippet = actions.filter((action) => action.key).map((action) => `await noxCue.activity("${action.key}", user.id);`).join("\n");

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
          <aside className="cue-template-output"><div><b>What NoxCue creates automatically</b><p>Each action gets a daily total plus a rolling {windowDays}-day engagement card with actions per active user, participation, and actions per participant.</p></div><pre><code>{snippet || "Your tracking calls will appear here."}</code></pre><button type="button" className="mini-button" disabled={!snippet} onClick={() => void navigator.clipboard.writeText(snippet).then(() => setCopied(true))}>{copied ? "Copied" : "Copy setup code"}</button></aside>
          <p className="cue-advanced-note">Need more than three? Additional custom activity metrics remain available through the API and advanced NoxCue settings.</p>
          {save.error ? <p className="form-error">{save.error.message}</p> : null}
      </main>
      <footer><button type="button" className="button" onClick={onClose}>Cancel</button><button type="button" className="button primary-button" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save actions"}</button></footer>
    </div>
  </div>;
}

function StatCard({ stat }: { stat: CueStat }) {
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

function StatEvents({ organizationId, projectId }: StatsViewProps) {
  const [type, setType] = useState("all");
  const [environment, setEnvironment] = useState("all");
  const events = useQuery({
    queryKey: ["cue", organizationId, projectId, "stat-events"],
    queryFn: ({ signal }) => platformApi.cueStatEvents(organizationId, projectId, signal),
  });

  const filtered = (events.data ?? []).filter((event) => (type === "all" || event.type === type) && (environment === "all" || event.environment.toLowerCase() === environment));
  const eventTypes = [...new Set((events.data ?? []).map((event) => event.type))];
  const environments = [...new Set((events.data ?? []).map((event) => event.environment))];
  return (
    <AsyncState loading={events.isLoading} error={events.error}>
      <div className="toolbar"><select name="eventType" aria-label="Event type" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All stat events</option>{eventTypes.map((value) => <option value={value} key={value}>{value}</option>)}</select><select name="eventEnvironment" aria-label="Environment" value={environment} onChange={(event) => setEnvironment(event.target.value)}><option value="all">All environments</option>{environments.map((value) => <option value={value.toLowerCase()} key={value}>{value}</option>)}</select><span className="toolbar-spacer" /><span>{filtered.length} events</span><StatusTag tone="positive">Receiving</StatusTag><button className="button" onClick={() => void events.refetch()}>Refresh</button></div>
      <div className="list-surface">
        {filtered.map((event) => <ListRow key={event.id} symbol="↗" tone="positive" title={event.name} description={<span className="mono">{event.type} · {event.subject} · {event.environment}</span>} meta={<><StatusTag tone="positive">Accepted</StatusTag><span>{event.receivedAt}</span></>} />)}
      </div>
      <div className="callout"><div><b>Events become stats</b><p>These accepted triggers feed the aggregated dashboard and daily report. Configure the tracked activities from the dashboard.</p></div></div>
    </AsyncState>
  );
}
