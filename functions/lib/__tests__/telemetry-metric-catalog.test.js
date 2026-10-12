import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TELEMETRY_N1_METRIC_KEYS } from "../telemetry-project-metrics.js";

describe("Telemetry unified metric catalog", () => {
  it("defines every unified metric persisted by the digest", () => {
    const migrationDirectory = resolve(import.meta.dirname, "../../../migrations");
    const migration = readFileSync(resolve(
      migrationDirectory,
      readdirSync(migrationDirectory).find((name) => name.startsWith("0106_")),
    ), "utf8");
    for (const metricKey of TELEMETRY_N1_METRIC_KEYS) {
      expect(migration, `missing catalog definition for ${metricKey}`).toContain(`('${metricKey}'`);
    }
  });
});
