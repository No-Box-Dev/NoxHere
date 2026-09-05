import { afterEach, describe, expect, it, vi } from "vitest";
import { createNoxCue, safeErrorDetails } from "./noxcue";

describe("NoxCue diagnostic context", () => {
  afterEach(() => vi.restoreAllMocks());

  it("redacts common secrets and personal data from error evidence", () => {
    const error = new Error("Login failed for person@example.com token=super-secret");
    error.stack = "Error: token=super-secret at https://app.example.com/login?password=hunter2";

    expect(safeErrorDetails(error)).toMatchObject({
      name: "Error",
      message: "Login failed for [redacted-email] token=[redacted]",
      stack: "Error: token=[redacted] at https://app.example.com/login?password=[redacted]",
    });
  });

  it("automatically reports timing, environment, release and safe failure details", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ eventId: "event-1" }), { status: 202 }));
    const noxcue = createNoxCue({
      endpoint: "https://api.noxcue.dev",
      ingestKey: `nox_pub_${"a".repeat(43)}`,
      environment: "staging",
      release: "playnist@2026.09.05",
    });
    const failure = Object.assign(new Error("Provider failed with api_key=private"), { status: 503, code: "AUTH_UPSTREAM" });

    await expect(noxcue.auth.signup(async () => { throw failure; })).rejects.toThrow("Provider failed");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const request = fetchMock.mock.calls[0]![1]!;
    const event = JSON.parse(String(request.body));
    expect(event).toMatchObject({
      type: "feature.result", feature: "auth.signup", outcome: "failure",
      reason: "dependency_unavailable", message: "Provider failed with api_key=[redacted]",
      context: { environment: "staging", release: "playnist@2026.09.05", runtime: "server" },
      error: { name: "Error", message: "Provider failed with api_key=[redacted]", code: "AUTH_UPSTREAM" },
    });
    expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(event)).not.toContain("api_key=private");
  });
});
