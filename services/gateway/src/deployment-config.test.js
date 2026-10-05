import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production gateway deployment config", () => {
  it("keeps the existing custom-domain route outside routine Worker deploys", () => {
    const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    const productionConfig = config.split('"env"')[0];

    expect(productionConfig).toContain('"workers_dev": false');
    expect(productionConfig).not.toMatch(/"routes?"\s*:/);
  });
});
