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
    expect(html).toContain('<script src="/developers.js" type="module"></script>');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(script).not.toContain("innerHTML");
  });

  it("keeps direct HTTP usage first-class and generated from OpenAPI", () => {
    expect(html).toContain("Use the HTTP API directly or choose an SDK");
    expect(html).toContain("JavaScript · direct fetch");
    expect(html).toContain("Python · direct requests");
    expect(html).toContain("copyable direct HTTP request for every operation");
    expect(html).toContain('href="/docs/direct-api.md">HTTP guide</a>');
    expect(script).toContain('import { buildCurlExample } from "./direct-api-examples.js"');
    expect(script).toContain('element("strong", "Direct HTTP · curl")');
  });

  it("derives the displayed operation count from the OpenAPI document", () => {
    expect(html).toContain('id="operation-total">Loading…</strong>');
    expect(script).toContain('operationTotal.textContent = `${operations.length} operations`');
  });

  it("documents the supported NoxHere auth boundary and stable Incidents gateway", () => {
    expect(guide).toContain("does not issue third-party OAuth client credentials");
    expect(guide).toContain("POST /api/v1/cues/public/events");
    expect(guide).toContain("honor `Retry-After`");
    expect(guide).toContain("Raw GitHub bearer tokens are rejected");
    expect(guide).toContain("opaque HttpOnly NoxHere session cookie");
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

  it("nudges agents toward bounded, actionable developer feedback", () => {
    expect(html).toContain('id="developer-feedback"');
    expect(html).toContain("developer-feedback:write");
    expect(guide).toContain("POST /api/v1/developer-feedback");
    expect(guide).toContain("Only report firsthand, actionable observations");
    expect(discovery).toContain("Do not post routine success reports");
    expect(discovery).toContain("never retry automatically except with that same key");
  });

  it("uses NoxHere and capability names as the public vocabulary", () => {
    expect(html).toContain("NoxHere API — Developer documentation");
    expect(html).toContain("NoxHere is one product");
    expect(html).not.toContain("NoxConnect is the public product");
    expect(guide).toContain("opaque HttpOnly NoxHere session cookie");
    expect(discovery).toContain("NoxHere is the public product");
  });

  it("documents the minimal, environment-scoped Incidents SDK compatibility flow", () => {
    expect(html).toContain('id="noxcue-sdk"');
    expect(html).toContain("npm install @noxhere/sdk");
    expect(html).toContain('from <span class="token-string">"@noxhere/sdk/telemetry/browser"</span>');
    expect(html).toContain('from <span class="token-string">"@noxhere/sdk/telemetry/server"</span>');
    expect(html).toContain("await noxcue.auth.signup");
    expect(html).toContain("await userCue.user.registered");
    expect(html).not.toContain("noxcue.identify({ id: user.id");
    expect(html).toContain("identityHashKey: process.env.NOXHERE_IDENTITY_HASH_KEY!");
    expect(html).toContain("Browser activity is count-only");
    expect(html).toContain("noxcue.forUser(user.id)");
    expect(html).toContain("Never ship a <code>nox_secret_…</code> key to a browser");
  });

  it("separates public Stats and Incidents vocabulary and publishes governance", () => {
    expect(html).toContain("Planning, Activity, Feedback, Stats, and Incidents capabilities");
    expect(html).toContain("<h3>Stats</h3>");
    expect(html).toContain("<h3>Incidents</h3>");
    expect(html).not.toContain("One API. Five focused");
    expect(guide).toContain("Stats sources:");
    expect(discovery).toContain("Telemetry data governance");
  });

  it("shows exact credential alternatives and automation scopes from OpenAPI", () => {
    expect(script).toContain("Accepted credentials");
    expect(script).toContain("Automation scope");
    expect(script).toContain("automation nox_sk_ token");
    expect(script).toContain("source X-Nox-Ingest-Key");
  });

  it("makes the NoxSpot signed-in identity integration explicit", () => {
    expect(html).toContain('id="noxspot-identity"');
    expect(html).toContain("cannot read a host website's login session");
    expect(html).toContain("NoxSpot.identify({");
    expect(html).toContain("NoxSpot.identify(null)");
    expect(html).toContain("getUser");
    expect(html).toContain("avatarUrl");
    expect(html).toContain("profile-picture URL");
    expect(guide).toContain("anonymous-by-default install snippet");
    expect(guide).toContain("Set `notifyOnResolution: true` only when the host has already obtained consent");
  });
});
