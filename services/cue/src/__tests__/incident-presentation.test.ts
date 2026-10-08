import { describe, expect, it } from "vitest";
import { buildGitHubIncident } from "../incident-presentation";

const input = {
  environment: "production",
  incidentKey: "auth.signup/dependency_unavailable/auth/auth_503/createaccount",
  title: "Sign up is unavailable",
  sourceName: "N1 App",
  firstSeenAt: "2026-10-08T10:00:00Z",
  lastSeenAt: "2026-10-08T10:01:00Z",
  occurrenceCount: 2,
  payloadJson: JSON.stringify({
    impact: "People cannot create accounts",
    message: "Auth returned 503",
    error: {
      name: "AuthError",
      code: "AUTH_503",
      status: 503,
      message: "Unavailable",
      stack: "AuthError: <unavailable>\n at createAccount (signup.ts:42:7)",
    },
    context: { release: "web-123", runtime: "browser", url: "https://app.example.test/signup" },
    diagnosis: {
      possibleCauses: ["The auth dependency is unavailable"],
      possibleFixes: ["Check the auth provider status"],
    },
  }),
};

describe("GitHub incident presentation", () => {
  it("builds the complete transport-safe issue presentation", () => {
    const result = buildGitHubIncident(input, { url: "https://github.com/acme/web/issues/1" });

    expect(result.marker).toBe(`<!-- noxcue-key: production/${input.incidentKey} -->`);
    expect(result.title).toBe("[NoxCue] Sign up is unavailable");
    expect(result.labels.map((label) => label.name)).toEqual(["noxcue", "incident"]);
    expect(result.latestRelease).toBe("web-123");
    expect(result.repeatComment).toContain("Occurrences: **2**");
    expect(result.body).toContain(`Incident key: \`${input.incidentKey}\``);
    expect(result.body).toContain("Previous occurrence: https://github.com/acme/web/issues/1");
    expect(result.body).toContain("has not changed the application or attempted a fix");
    expect(result.body).toContain("&lt;unavailable&gt;");
  });

  it("rejects malformed diagnostic payloads at the RPC boundary", () => {
    expect(() => buildGitHubIncident({ ...input, payloadJson: JSON.stringify({ impact: "Missing diagnosis" }) }))
      .toThrow("NoxCue incident has invalid diagnostic payload");
  });
});
