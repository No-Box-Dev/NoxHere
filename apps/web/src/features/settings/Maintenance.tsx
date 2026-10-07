import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getRawJson, postRawJson } from "../../api/http";

type SyncStatus = { isStale?: boolean; lastSync?: string | null; resources?: Record<string, { lastSynced?: string | null }> };
type Failure = { id: number; op: string; delivery_id: string | null; error: string; occurred_at: string };
type CursorResult = { done?: boolean; cursor?: string; synced?: string; repos?: number };

async function runCursor(path: string, scope: { organizationId: string; projectId: string }, onProgress: (message: string) => void) {
  let cursor = "";
  let completed = 0;
  let hasMore = true;
  while (hasMore) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await postRawJson<CursorResult>(`${path}${cursor ? `${separator}cursor=${encodeURIComponent(cursor)}` : ""}`, {}, scope);
    completed += result.synced ? 1 : 0;
    onProgress(result.done ? `Completed ${completed || result.repos || 0} repositories` : `Processing ${result.cursor || "repository"}…`);
    hasMore = !result.done && Boolean(result.cursor);
    if (result.cursor) cursor = result.cursor;
  }
}

export function Maintenance({ organizationId, projectId, isAdmin }: { organizationId: string; projectId: string; isAdmin: boolean }) {
  const scope = { organizationId, projectId };
  const [progress, setProgress] = useState("");
  const status = useQuery({ queryKey: ["sync-status", organizationId, projectId], queryFn: ({ signal }) => getRawJson("/api/v1/sync", signal, scope) as Promise<SyncStatus> });
  const failures = useQuery({ queryKey: ["op-failures", organizationId], queryFn: ({ signal }) => getRawJson("/api/v1/op-failures?limit=25", signal, scope) as Promise<{ failures?: Failure[] }>, enabled: isAdmin });
  const run = useMutation({ mutationFn: (path: string) => runCursor(path, scope, setProgress), onSuccess: () => { void status.refetch(); void failures.refetch(); } });
  const backfill = useMutation({ mutationFn: () => postRawJson(`/api/v1/projects/${encodeURIComponent(projectId)}/backfill-prs`, { days: 30 }, scope), onSuccess: () => setProgress("Recent pull-request narratives queued") });
  return <div className="settings-stack">
    <section className="settings-card"><header><div><b>Synchronization health</b><p>Last successful GitHub synchronization and per-resource freshness.</p></div><span className={`connect-accordion-status ${status.data?.isStale ? "warning" : ""}`}>{status.isLoading ? "Loading" : status.data?.isStale ? "Stale" : "Current"}</span></header><p>{status.data?.lastSync ? `Last sync ${new Date(status.data.lastSync).toLocaleString()}` : "No completed synchronization recorded."}</p>{status.data?.resources ? <div className="maintenance-resources">{Object.entries(status.data.resources).map(([name, value]) => <span key={name}><b>{name}</b><small>{value.lastSynced ? new Date(value.lastSynced).toLocaleString() : "Waiting"}</small></span>)}</div> : null}</section>
    {isAdmin ? <section className="settings-card"><header><div><b>Recovery operations</b><p>Run bounded, server-rate-limited repair workflows.</p></div></header><div className="maintenance-actions"><button className="button" disabled={run.isPending} onClick={() => run.mutate("/api/v1/sync?scope=features")}>Sync features</button><button className="button" disabled={run.isPending} onClick={() => run.mutate("/api/v1/sync?force=true")}>Full GitHub resync</button><button className="button" disabled={run.isPending} onClick={() => run.mutate("/api/v1/sync-events")}>Backfill activity events</button><button className="button" disabled={backfill.isPending} onClick={() => backfill.mutate()}>Backfill PR narratives</button></div>{progress ? <p role="status">{progress}</p> : null}{run.error || backfill.error ? <small role="alert">{(run.error ?? backfill.error)?.message}</small> : null}</section> : null}
    {isAdmin ? <section className="settings-card"><header><div><b>Background failures</b><p>Failures captured from asynchronous operations.</p></div><button className="mini-button" onClick={() => void failures.refetch()}>Refresh</button></header>{failures.data?.failures?.length ? <div className="failure-list">{failures.data.failures.map((failure) => <article key={failure.id}><b>{failure.op}</b><time>{new Date(failure.occurred_at.replace(" ", "T") + (failure.occurred_at.includes("Z") ? "" : "Z")).toLocaleString()}</time><pre>{failure.error}</pre></article>)}</div> : <p>{failures.isLoading ? "Loading failures…" : "No recent background failures."}</p>}</section> : null}
  </div>;
}
