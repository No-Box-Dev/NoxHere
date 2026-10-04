import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findTransportBoundaryViolations } from "./check-transport-boundaries.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

async function fixture(file, source) {
  const root = await mkdtemp(join(tmpdir(), "transport-boundary-"));
  temporary.push(root);
  await mkdir(join(root, "functions"), { recursive: true });
  await writeFile(join(root, "functions", file), source);
  return root;
}

describe("transport boundary checker", () => {
  it("rejects a Slack mutation from a producer", async () => {
    const root = await fixture("producer.ts", "await postSlackMessage(token, channel, message);");
    await expect(findTransportBoundaryViolations({ root, provider: "slack", roots: ["functions"] }))
      .resolves.toEqual([{ file: "functions/producer.ts", line: 1, reason: "Slack message mutation helper" }]);
  });

  it("rejects direct Slack mutation endpoints", async () => {
    const root = await fixture("producer.ts", "await call('chat.update');");
    const violations = await findTransportBoundaryViolations({ root, provider: "slack", roots: ["functions"] });
    expect(violations).toHaveLength(1);
  });

  it("rejects legacy Slack outbox producers", async () => {
    const root = await fixture("producer.ts", "await stageSlackDelivery(db, input);");
    const violations = await findTransportBoundaryViolations({ root, provider: "slack", roots: ["functions"] });
    expect(violations[0]?.reason).toBe("Legacy Slack outbox staging");
  });

  it("allows code that only publishes a transport command", async () => {
    const root = await fixture("producer.ts", "await publishTransportCommand(env, command);");
    await expect(findTransportBoundaryViolations({ root, provider: "slack", roots: ["functions"] })).resolves.toEqual([]);
  });

  it("rejects a GitHub mutation from a producer", async () => {
    const root = await fixture("producer.ts", "await createRepositoryIssue(token, owner, repo, issue);");
    const violations = await findTransportBoundaryViolations({ root, provider: "github", roots: ["functions"] });
    expect(violations).toEqual([{ file: "functions/producer.ts", line: 1, reason: "GitHub mutation helper" }]);
  });
});
