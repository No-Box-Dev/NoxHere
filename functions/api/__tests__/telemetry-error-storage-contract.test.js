import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = resolve(process.cwd(), "migrations");
const storageMigration = readFileSync(resolve(
  migrationDirectory,
  readdirSync(migrationDirectory).find((name) => name.startsWith("0094_")),
), "utf8");
const namingMigration = readFileSync(resolve(
  migrationDirectory,
  "0115_standardize_capability_schema.sql",
), "utf8");

describe("Telemetry grouped-error storage contract", () => {
  it("uses a source/event receipt as the exact deduplication boundary", () => {
    expect(storageMigration).toContain("PRIMARY KEY (source_id, event_id)");
    expect(storageMigration).toContain("ingest_token TEXT NOT NULL");
    expect(namingMigration).toContain("idx_telemetry_error_receipts_expiry");
    expect(namingMigration).toContain("UPDATE telemetry_error_receipts");
    expect(namingMigration).toContain("SET event_id = 'telemetry_' || substr(event_id, 5)");
  });

  it("retains group evidence and hashed membership without an occurrence body table", () => {
    expect(storageMigration).toContain("sample_json TEXT");
    expect(storageMigration).toContain("first_release TEXT");
    expect(storageMigration).toContain("last_release TEXT");
    expect(storageMigration).toContain("user_hash    TEXT NOT NULL");
    expect(storageMigration).not.toMatch(/CREATE TABLE\s+\w*_error_occurrences/i);
    expect(storageMigration).not.toMatch(/\b(email|user_id|error_json|payload_json)\b/i);
  });
});
