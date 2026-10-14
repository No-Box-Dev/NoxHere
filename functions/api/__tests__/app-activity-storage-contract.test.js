import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("App activity storage contract", () => {
  it("has a production migration for its durable activity state", () => {
    const migration = readFileSync(resolve(process.cwd(), "migrations/0113_app_user_activity.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS telemetry_app_user_activity");
    expect(migration).toContain("PRIMARY KEY (app_id, github_login)");
  });
});
