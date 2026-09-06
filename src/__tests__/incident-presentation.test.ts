import { describe, expect, it } from "vitest";
import { buildIncidentPresentation } from "../incident-presentation";

describe("NoxCue GitHub incident presentation", () => {
  it("owns bounded incident copy without accepting provider credentials", () => {
    const response = buildIncidentPresentation({
      environment: "production",
      incidentKey: "auth/signup",
      title: "Sign up failed",
      sourceName: "Web",
      firstSeenAt: "2026-09-05T10:00:00Z",
      lastSeenAt: "2026-09-05T10:01:00Z",
      occurrenceCount: 2,
      payloadJson: JSON.stringify({
        impact: "People cannot sign up <script>",
        context: { release: "web-1" },
        diagnosis: { possibleCauses: ["Dependency failed"], possibleFixes: ["Inspect dependency health"] },
      }),
    }, { url: "https://github.com/acme/app/issues/1" });
    expect(response).toMatchObject({ title: "[NoxCue] Sign up failed", latestRelease: "web-1" });
    expect(response.body).toContain("&lt;script&gt;");
    expect(response.body).toContain("Previous occurrence: https://github.com/acme/app/issues/1");
    expect(JSON.stringify(response)).not.toMatch(/authorization|api[_-]?key|token/i);
  });
});
