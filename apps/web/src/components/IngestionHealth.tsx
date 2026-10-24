import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { getRawJson } from "../api/http";
import { ingestionHealth } from "../lib/ingestion-health";
import { StatusTag } from "./StatusTag";

const sourcesSchema = z.object({ sources: z.array(z.object({
  enabled: z.boolean(), lastEventAt: z.string().nullable(),
  keys: z.array(z.object({ revokedAt: z.string().nullable() })),
})) });

export function IngestionHealth({ organizationId, projectId, capability, canConfigure = false }: {
  organizationId: string; projectId: string; capability: "growth" | "usage"; canConfigure?: boolean;
}) {
  const query = useQuery({
    queryKey: [capability, organizationId, projectId, "sources"],
    queryFn: async ({ signal }) => sourcesSchema.parse(await getRawJson(`/api/v1/${capability}/sources`, signal, { organizationId, projectId })),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const health = query.data ? ingestionHealth(query.data.sources, Date.now()) : null;
  const label = query.isError ? "Source status unavailable" : query.isPending ? "Checking sources…" : health?.label ?? "Source status unavailable";
  return <div className="toolbar" role="status" aria-label={`${capability === "growth" ? "Growth" : "Usage"} ingestion status`}>
    <StatusTag tone={query.isError ? "warning" : "neutral"}>{label}</StatusTag>
    {health?.lastEventAt ? <span>Last accepted event: {new Date(health.lastEventAt).toLocaleString()}</span> : null}
    {query.isError && query.data ? <span>Previously loaded source information is shown.</span> : null}
    {query.dataUpdatedAt ? <span>Last checked: {new Date(query.dataUpdatedAt).toLocaleTimeString()}</span> : null}
    <button className="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Checking…" : "Check sources"}</button>
    {canConfigure ? <Link className="button" to={`/${encodeURIComponent(organizationId)}/${encodeURIComponent(projectId)}/settings/integrations/${capability}`}>Manage sources</Link> : null}
  </div>;
}
