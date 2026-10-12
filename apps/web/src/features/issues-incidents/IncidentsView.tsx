import { useQuery } from "@tanstack/react-query";
import { platformApi } from "../../api/platform";
import { AsyncState } from "../../components/AsyncState";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";

type IncidentsViewProps = { organizationId: string; projectId: string; view?: "alerts" | "rules" };

export function IncidentsView({ organizationId, projectId, view = "alerts" }: IncidentsViewProps) {
  return (
    <div className="workspace-view">
      {view === "alerts" ? <AlertLog organizationId={organizationId} projectId={projectId} /> : <AlertRules organizationId={organizationId} projectId={projectId} />}
    </div>
  );
}

function AlertLog({ organizationId, projectId }: IncidentsViewProps) {
  const alerts = useQuery({
    queryKey: ["telemetry", organizationId, projectId, "alerts"],
    queryFn: ({ signal }) => platformApi.telemetryAlerts(organizationId, projectId, signal),
  });
  const activeCount = alerts.data?.filter((alert) => alert.status === "active").length ?? 0;

  return (
    <AsyncState loading={alerts.isLoading} error={alerts.error}>
      <div className="toolbar compact-toolbar"><span className="toolbar-spacer" /><StatusTag tone="warning">{activeCount} active</StatusTag><button className="button" onClick={() => void alerts.refetch()}>Refresh</button></div>
      <div className="list-surface">
        {alerts.data?.map((alert) => (
          <ListRow key={alert.id} symbol={alert.status === "active" ? "!" : "✓"} tone={alert.status === "active" ? "danger" : "positive"} title={alert.title} description={`${alert.environment} · ${alert.summary}`} meta={<><StatusTag tone={alert.status === "active" ? "warning" : "positive"}>{alert.status === "active" ? "Active" : "Resolved"}</StatusTag><b>{alert.occurrences} {alert.occurrences === 1 ? "time" : "times"}</b><span>{alert.happenedAt}</span></>} />
        ))}
      </div>
    </AsyncState>
  );
}

function AlertRules({ organizationId, projectId }: IncidentsViewProps) {
  const rules = useQuery({
    queryKey: ["telemetry", organizationId, projectId, "alert-rules"],
    queryFn: ({ signal }) => platformApi.telemetryAlertRules(organizationId, projectId, signal),
  });
  const enabledCount = rules.data?.filter((rule) => rule.enabled).length ?? 0;
  const stagingEnabled = rules.data?.some((rule) => rule.enabled && rule.environment.toLowerCase() === "staging") ?? false;

  return (
    <AsyncState loading={rules.isLoading} error={rules.error}>
      <div className="toolbar compact-toolbar"><span className="toolbar-spacer" /><StatusTag tone="positive">{enabledCount} enabled</StatusTag></div>
      <div className="list-surface">
        {rules.data?.map((rule) => <ListRow key={rule.id} symbol={rule.kind.charAt(0).toUpperCase()} title={rule.name} description={`${rule.condition} · ${rule.environment}`} meta={<><StatusTag tone={rule.enabled ? "positive" : "neutral"}>{rule.enabled ? "On" : "Off"}</StatusTag><span className="mono">{rule.source}</span></>} />)}
      </div>
      {!stagingEnabled ? <div className="callout"><div><b>No alert is currently configured for Staging</b><p>The alert log only contains alerts created by enabled rules.</p></div><StatusTag>Staging off</StatusTag></div> : null}
    </AsyncState>
  );
}
