import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { platformApi } from "../../../api/platform";
import { AsyncState } from "../../../components/AsyncState";
import { ListRow } from "../../../components/ListRow";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { StatusTag } from "../../../components/StatusTag";

type AlertsViewProps = { organizationId: string; projectId: string };
type AlertsSubview = "log" | "rules";

const segments = [
  { id: "log", label: "Alert log", description: "Triggered and resolved" },
  { id: "rules", label: "Alert rules", description: "What is being watched" },
] as const;

export function AlertsView({ organizationId, projectId }: AlertsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get("view") === "rules" ? "rules" : "log";
  const select = (view: AlertsSubview) => setSearchParams(view === "log" ? {} : { view });

  return (
    <div className="workspace-view">
      <SegmentedControl label="Alert views" value={selected} segments={segments} onChange={select} />
      {selected === "log" ? <AlertLog organizationId={organizationId} projectId={projectId} /> : <AlertRules organizationId={organizationId} projectId={projectId} />}
    </div>
  );
}

function AlertLog({ organizationId, projectId }: AlertsViewProps) {
  const alerts = useQuery({
    queryKey: ["cue", organizationId, projectId, "alerts"],
    queryFn: ({ signal }) => platformApi.cueAlerts(organizationId, projectId, signal),
  });
  const activeCount = alerts.data?.filter((alert) => alert.status === "active").length ?? 0;

  return (
    <AsyncState loading={alerts.isLoading} error={alerts.error}>
      <div className="toolbar compact-toolbar"><span className="toolbar-spacer" /><StatusTag tone="warning">{activeCount} active</StatusTag><button className="button" onClick={() => void alerts.refetch()}>Refresh</button></div>
      <div className="list-surface">
        {alerts.data?.map((alert) => (
          <ListRow key={alert.id} symbol={alert.status === "active" ? "!" : "✓"} tone={alert.status === "active" ? "danger" : "positive"} title={alert.title} description={`${alert.environment} · ${alert.summary}`} meta={<><StatusTag tone={alert.status === "active" ? "warning" : "positive"}>{alert.status === "active" ? "Active" : "Resolved"}</StatusTag><b>{alert.occurrences} {alert.occurrences === 1 ? "time" : "times"}</b><span>{alert.happenedAt}</span></>} onClick={() => undefined} />
        ))}
      </div>
    </AsyncState>
  );
}

function AlertRules({ organizationId, projectId }: AlertsViewProps) {
  const rules = useQuery({
    queryKey: ["cue", organizationId, projectId, "alert-rules"],
    queryFn: ({ signal }) => platformApi.cueAlertRules(organizationId, projectId, signal),
  });
  const enabledCount = rules.data?.filter((rule) => rule.enabled).length ?? 0;

  return (
    <AsyncState loading={rules.isLoading} error={rules.error}>
      <div className="toolbar compact-toolbar"><span className="toolbar-spacer" /><StatusTag tone="positive">{enabledCount} enabled</StatusTag></div>
      <div className="list-surface">
        {rules.data?.map((rule) => <ListRow key={rule.id} symbol={rule.kind.charAt(0).toUpperCase()} title={rule.name} description={`${rule.condition} · ${rule.environment}`} meta={<><StatusTag tone={rule.enabled ? "positive" : "neutral"}>{rule.enabled ? "On" : "Off"}</StatusTag><span className="mono">{rule.source}</span></>} />)}
      </div>
      <div className="callout"><div><b>No alert is currently configured for Staging</b><p>The alert log only contains alerts created by enabled rules.</p></div><StatusTag>Staging off</StatusTag></div>
    </AsyncState>
  );
}
