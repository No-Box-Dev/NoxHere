export type IngestionSource = {
  enabled: boolean;
  lastEventAt: string | null;
  keys: Array<{ revokedAt: string | null }>;
};

export const RECENT_ACTIVITY_MS = 24 * 60 * 60 * 1000;

export function ingestionHealth(sources: IngestionSource[], now: number) {
  if (!sources.length) return { label: "Setup required", lastEventAt: null };
  const enabled = sources.filter((source) => source.enabled);
  if (!enabled.length) return { label: "Ingestion paused", lastEventAt: null };
  const ready = enabled.filter((source) => source.keys.some((key) => !key.revokedAt));
  if (!ready.length) return { label: "Ingest key required", lastEventAt: null };
  const times = ready.map((source) => source.lastEventAt ? Date.parse(source.lastEventAt) : NaN)
    .filter((time) => Number.isFinite(time) && time <= now);
  const latest = times.length ? Math.max(...times) : null;
  const partial = ready.length < sources.length;
  const label = latest === null ? "Waiting for events"
    : now - latest <= RECENT_ACTIVITY_MS ? "Recent activity" : "No activity in 24h";
  return { label: partial ? `${label} · some sources need attention` : label,
    lastEventAt: latest === null ? null : new Date(latest).toISOString() };
}
