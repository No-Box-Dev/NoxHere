import { useQuery } from "@tanstack/react-query";
import { platformApi } from "../../api/platform";
import { AsyncState } from "../AsyncState";
import { ListRow } from "../ListRow";
import { StatusTag } from "../StatusTag";

export function AlertRules({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const rules = useQuery({
    queryKey: ["issues", organizationId, projectId, "alert-rules"],
    queryFn: ({ signal }) => platformApi.issueAlertRules(organizationId, projectId, signal),
  });
  const enabledCount = rules.data?.filter((rule) => rule.enabled).length ?? 0;
  const stagingEnabled = rules.data?.some((rule) => rule.enabled && rule.environment.toLowerCase() === "staging") ?? false;

  return <AsyncState loading={rules.isLoading} error={rules.error}>
    <div className="toolbar compact-toolbar"><span className="toolbar-spacer" /><StatusTag tone="positive">{enabledCount} enabled</StatusTag></div>
    <div className="list-surface">
      {rules.data?.map((rule) => <ListRow key={rule.id} symbol={rule.kind.charAt(0).toUpperCase()} title={rule.name} description={`${rule.condition} · ${rule.environment}`} meta={<><StatusTag tone={rule.enabled ? "positive" : "neutral"}>{rule.enabled ? "On" : "Off"}</StatusTag><span className="mono">{rule.source}</span></>} />)}
    </div>
    {!stagingEnabled ? <div className="callout"><div><b>No alert is currently configured for Staging</b><p>The alert log only contains alerts created by enabled rules.</p></div><StatusTag>Staging off</StatusTag></div> : null}
  </AsyncState>;
}
