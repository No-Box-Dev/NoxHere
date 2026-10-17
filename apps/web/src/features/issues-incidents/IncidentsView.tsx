import { useState } from "react";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const alerts = useQuery({
    queryKey: ["issues", organizationId, projectId, "incidents"],
    queryFn: ({ signal }) => platformApi.issueIncidents(organizationId, projectId, signal),
  });
  const activeCount = alerts.data?.filter((alert) => alert.status === "active").length ?? 0;

  return (
    <AsyncState loading={alerts.isLoading} error={alerts.error}>
      <div className="toolbar compact-toolbar"><span className="toolbar-spacer" /><StatusTag tone="warning">{activeCount} active</StatusTag><button className="button" onClick={() => void alerts.refetch()}>Refresh</button></div>
      <div className="list-surface">
        {alerts.data?.map((alert) => {
          const selected = selectedId === alert.id;
          const diagnostic = alert.diagnostics;
          return <div key={alert.id}>
            <ListRow symbol={alert.status === "active" ? "!" : "✓"} tone={alert.status === "active" ? "danger" : "positive"} title={alert.title} description={`${alert.environment} · ${alert.summary}`} onClick={() => setSelectedId(selected ? null : alert.id)} meta={<><StatusTag tone={alert.status === "active" ? "warning" : "positive"}>{alert.status === "active" ? "Active" : "Resolved"}</StatusTag><b>{alert.occurrences} {alert.occurrences === 1 ? "time" : "times"}</b><span>{alert.happenedAt}</span></>} />
            {selected && diagnostic ? <section className="incident-diagnostics" aria-label="Latest incident diagnostics">
              <dl>
                <dt>Event ID</dt><dd><code>{diagnostic.eventId ?? "Unavailable"}</code></dd>
                <dt>Release</dt><dd><code>{diagnostic.context.release ?? "Unavailable"}</code></dd>
                <dt>Runtime</dt><dd>{diagnostic.context.runtime ?? "Unknown"}</dd>
                <dt>Error</dt><dd>{[diagnostic.error.code, diagnostic.error.status, diagnostic.error.message].filter((value) => value !== null).join(" · ") || diagnostic.message || "No message"}</dd>
                {diagnostic.url ? <><dt>Route</dt><dd><code>{diagnostic.url}</code></dd></> : null}
              </dl>
              {Object.keys(diagnostic.attributes).length ? <pre>{JSON.stringify(diagnostic.attributes, null, 2)}</pre> : null}
              {diagnostic.error.stack ? <pre>{diagnostic.error.stack}</pre> : null}
            </section> : null}
          </div>;
        })}
      </div>
    </AsyncState>
  );
}
