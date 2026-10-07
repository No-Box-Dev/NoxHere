import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const fixtures = JSON.parse(await readFile(new URL("../services/cue/packages/sdk-contract/track-wire-fixtures.json", import.meta.url), "utf8"));
const key = "identity-secret-key-that-is-at-least-32-bytes";
const protect = (value) => `h1_primary_${createHmac("sha256", key).update(value).digest("base64url")}`;
const identified = fixtures.find((fixture) => fixture.userId === "user-42");
if (!identified) throw new Error("Missing identified track fixture");
const wireIdentity = identified.protectedIdentity;
if (wireIdentity !== protect("user-42") || wireIdentity === identified.userId) {
  throw new Error("Identified telemetry did not protect the user before the wire boundary");
}
const browserTest = await readFile(new URL("../packages/sdk/src/telemetry/anonymous-activity.test.ts", import.meta.url), "utf8");
for (const fragment of ["website.page_visited", "userId", "localStorage", "sessionStorage"]) {
  if (!browserTest.includes(fragment)) throw new Error(`Anonymous browser boundary lacks proof for ${fragment}`);
}
const integration = spawnSync("npx", ["vitest", "run",
  "packages/sdk/src/telemetry/track.test.ts",
  "services/cue/src/__tests__/anonymous-events.test.ts",
  "functions/api/__tests__/noxcue-source-isolation.test.ts",
  "functions/lib/__tests__/noxcue-n1-metrics.test.ts",
  "services/scheduler/src/__tests__/noxcue-n1-report.test.ts",
  "functions/api/__tests__/noxcue-key-lifecycle.test.ts",
  "functions/api/__tests__/noxcue-data-governance.test.ts",
], { stdio: "inherit" });
if (integration.error) throw integration.error;
if (integration.status !== 0) throw new Error(`Local telemetry integration exited with ${integration.status}`);
console.log("Local telemetry integration verified identified, anonymous, isolation, reporting, key and governance boundaries.");
