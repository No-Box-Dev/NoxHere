import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production gateway deployment config", () => {
  it("keeps the production app route in version-controlled infrastructure", () => {
    const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    const productionConfig = config.split('"env"')[0];

    expect(productionConfig).toContain('"workers_dev": false');
    expect(productionConfig).toContain('"pattern": "app.noxhere.com/*"');
    expect(productionConfig).toContain('"zone_name": "noxhere.com"');
  });
});
