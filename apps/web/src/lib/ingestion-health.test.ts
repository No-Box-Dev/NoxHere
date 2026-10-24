import { describe, expect, it } from "vitest";
import { ingestionHealth, RECENT_ACTIVITY_MS } from "./ingestion-health";

const now = Date.parse("2026-10-24T12:00:00Z");
const source = { enabled: true, lastEventAt: null, keys: [{ revokedAt: null }] };

describe("ingestion health", () => {
  it("distinguishes missing setup, paused ingestion, missing credentials and no events", () => {
    expect(ingestionHealth([], now).label).toBe("Setup required");
    expect(ingestionHealth([{ ...source, enabled: false }], now).label).toBe("Ingestion paused");
    expect(ingestionHealth([{ ...source, keys: [{ revokedAt: "2026-10-23" }] }], now).label).toBe("Ingest key required");
    expect(ingestionHealth([source], now).label).toBe("Waiting for events");
  });
  it("expires recent activity and rejects invalid or future timestamps as evidence", () => {
    const at = (time: number) => ({ ...source, lastEventAt: new Date(time).toISOString() });
    expect(ingestionHealth([at(now - RECENT_ACTIVITY_MS)], now).label).toBe("Recent activity");
    expect(ingestionHealth([at(now - RECENT_ACTIVITY_MS - 1)], now).label).toBe("No activity in 24h");
    expect(ingestionHealth([at(now + 1)], now).lastEventAt).toBeNull();
    expect(ingestionHealth([{ ...source, lastEventAt: "invalid" }], now).lastEventAt).toBeNull();
  });
  it("does not let a disabled source hide an active source failure", () => {
    const result = ingestionHealth([source, { ...source, enabled: false, lastEventAt: new Date(now).toISOString() }], now);
    expect(result.label).toBe("Waiting for events · some sources need attention");
    expect(result.lastEventAt).toBeNull();
  });
});
