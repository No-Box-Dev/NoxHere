import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getRawJson } from "../api/http";
import { StatusTag } from "./StatusTag";

const syncSchema = z.object({ isStale: z.boolean(), lastSync: z.string().nullable() });

export function DeliveryHealth({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const query = useQuery({
    queryKey: ["delivery", organizationId, projectId, "sync-status"],
    queryFn: async ({ signal }) => syncSchema.parse(await getRawJson("/api/v1/sync", signal, { organizationId, projectId })),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const sync = query.data;
  const timestamp = sync?.lastSync && Number.isFinite(Date.parse(sync.lastSync)) ? sync.lastSync : null;
  return <div className="toolbar" role="status" aria-label="Delivery sync status">
    <StatusTag tone={query.isError || sync?.isStale ? "warning" : "neutral"}>{query.isError ? "Sync status unavailable" : query.isPending ? "Checking sync…" : !timestamp ? "No sync recorded" : sync?.isStale ? "Organization sync is older than 5 minutes" : "Organization sync is recent"}</StatusTag>
    {timestamp ? <span>Oldest organization resource sync: {new Date(timestamp).toLocaleString()}</span> : null}
    {query.isError && query.data ? <span>Previously loaded sync information is shown.</span> : null}
    <button className="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Checking…" : "Check sync"}</button>
  </div>;
}
