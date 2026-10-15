import { readFile, readdir } from "node:fs/promises";

const inventory = JSON.parse(await readFile(new URL("../docs/telemetry-data-inventory.json", import.meta.url), "utf8"));
const governance = await readFile(new URL("../docs/TELEMETRY_DATA_GOVERNANCE.md", import.meta.url), "utf8");
// Historical migration filenames are immutable once released. Locate the
// relevant migration by its neutral purpose instead of retaining a legacy
// product name in active tooling.
const migrationsUrl = new URL("../migrations/", import.meta.url);
const trackingMigration = (await readdir(migrationsUrl)).find((name) => name.endsWith("_unified_tracking.sql"));
if (!trackingMigration) throw new Error("Unified tracking migration is missing");
const migration = await readFile(new URL(trackingMigration, migrationsUrl), "utf8");
const schemaMigration = await readFile(new URL("0115_standardize_capability_schema.sql", migrationsUrl), "utf8");
const requiredTables = ["telemetry_tracked_events", "telemetry_source_keys", "telemetry_source_key_audit", "telemetry_source_audit"];
for (const table of requiredTables) {
  if (!inventory.stores.some((entry) => entry.table === table)) throw new Error(`Missing ${table} from data inventory`);
  if (!schemaMigration.includes(`RENAME TO ${table}`)) throw new Error(`Canonical schema migration is missing: ${table}`);
}
for (const phrase of ["HMAC-SHA256", "aggregateOnlySlack", "7–730", "contractual/platform decisions"]) {
  if (!governance.includes(phrase)) throw new Error(`Governance documentation is missing: ${phrase}`);
}
for (const fragment of ["retention_days", "ON DELETE CASCADE"]) {
  if (!migration.includes(fragment)) throw new Error(`Governance migration is missing: ${fragment}`);
}
console.log(`Telemetry governance inventory verified (${inventory.stores.length} stores).`);
