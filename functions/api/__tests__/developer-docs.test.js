import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve("public/developers.html"), "utf8");
const script = readFileSync(resolve("public/developers.js"), "utf8");
const guide = readFileSync(resolve("public/docs/ai-setup.md"), "utf8");
const discovery = readFileSync(resolve("public/llms.txt"), "utf8");

describe("developer documentation", () => {
  it("treats project selection as optional request context", () => {
    expect(html).not.toContain("projectScope");
    expect(html).toContain("Omit <code>X-Project-ID</code> for organization-wide data");
    expect(html).toContain("revision_conflict");
  });

  it("loads behavior from an external CSP-compatible script", () => {
    expect(html).toContain('<script src="/developers.js" defer></script>');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(script).not.toContain("innerHTML");
  });

  it("derives the displayed operation count from the OpenAPI document", () => {
    expect(html).toContain('id="operation-total">Loading…</strong>');
    expect(script).toContain('operationTotal.textContent = `${operations.length} operations`');
  });

  it("documents the supported NoxConnect auth boundary and stable Incidents gateway", () => {
    expect(guide).toContain("does not issue third-party OAuth client credentials");
    expect(guide).toContain("POST /api/v1/cues/public/events");
    expect(guide).toContain("honor `Retry-After`");
    expect(guide).toContain("Raw GitHub bearer tokens are rejected");
    expect(guide).toContain("opaque HttpOnly NoxConnect session cookie");
  });

  it("gives agents an explicit supervised and headless connection flow", () => {
    expect(html).toContain('id="cli"');
    expect(html).toContain("npm install --global noxconnect");
    expect(html).toContain("noxconnect use YOUR_ORGANIZATION/YOUR_PROJECT");
    expect(html).toContain("Do not automate the human login");
    expect(guide).toContain("Supervised local agent");
    expect(guide).toContain("Headless agent or CI");
    expect(guide).toContain("Never ask a user to paste a token");
    expect(discovery).toContain("The complete CLI reference is at `/developers#cli`");
  });

  it("uses NoxConnect and capability names as the public vocabulary", () => {
    expect(html).toContain("NoxConnect API — Developer documentation");
    expect(html).toContain("Planning, Activity, Feedback, and Incidents");
    expect(html).not.toContain("NoxHere is the public platform");
    expect(html).not.toContain("NoxConnect is private connection plumbing");
    expect(guide).not.toContain("opaque HttpOnly NoxHere session cookie");
    expect(discovery).not.toContain("NoxConnect is the shared connection");
  });

  it("documents the minimal, environment-scoped Incidents SDK compatibility flow", () => {
    expect(html).toContain('id="noxcue-sdk"');
    expect(html).toContain("npm install @noxcue/sdk");
    expect(html).toContain('from <span class="token-string">"@noxcue/sdk/browser"</span>');
    expect(html).toContain('from <span class="token-string">"@noxcue/sdk/server"</span>');
    expect(html).toContain("await noxcue.auth.signup");
    expect(html).toContain("await noxcue.user.registered");
    expect(html).toContain("Never ship a <code>nox_secret_…</code> key to a browser");
  });

  it("makes the NoxSpot signed-in identity integration explicit", () => {
    expect(html).toContain('id="noxspot-identity"');
    expect(html).toContain("cannot read a host website's login session");
    expect(html).toContain("NoxSpot.identify({");
    expect(html).toContain("NoxSpot.identify(null)");
    expect(html).toContain("getReporter");
    expect(guide).toContain("anonymous-by-default install snippet");
    expect(guide).toContain("Set `notifyOnResolution: true` only when the host has already obtained consent");
  });
});
