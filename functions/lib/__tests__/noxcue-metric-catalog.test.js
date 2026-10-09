import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOXCUE_N1_METRIC_KEYS } from "../noxcue-project-metrics.js";

describe("NoxCue unified metric catalog", () => {
  it("defines every unified metric persisted by the digest", () => {
    const migration = readFileSync(
      new URL("../../../migrations/0106_noxcue_unified_metric_definitions.sql", import.meta.url),
      "utf8",
    );
    for (const metricKey of NOXCUE_N1_METRIC_KEYS) {
      expect(migration, `missing catalog definition for ${metricKey}`).toContain(`('${metricKey}'`);
    }
  });
});
