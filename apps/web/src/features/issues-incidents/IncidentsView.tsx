import { useQuery } from "@tanstack/react-query";
import { platformApi } from "../../api/platform";
import { AsyncState } from "../../components/AsyncState";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";

type IncidentsViewProps = { organizationId: string; projectId: string; view?: "alerts" | "rules" };

export function IncidentsView({ organizationId, projectId, view = "alerts" }: IncidentsViewProps) {
  return (
    <div className="workspace-view">
      {view === "alerts" ? <AlertLog organizationId={organizationId} projectId={projectId} /> : null}
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
