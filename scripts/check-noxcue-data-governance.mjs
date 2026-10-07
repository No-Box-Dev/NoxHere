import { readFile } from "node:fs/promises";

const inventory = JSON.parse(await readFile(new URL("../docs/noxcue-data-inventory.json", import.meta.url), "utf8"));
const governance = await readFile(new URL("../docs/NOXCUE_DATA_GOVERNANCE.md", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0105_noxcue_unified_tracking.sql", import.meta.url), "utf8");
const requiredTables = ["cue_tracked_events", "cue_source_keys", "cue_source_key_audit", "cue_source_audit"];
for (const table of requiredTables) {
  if (!inventory.stores.some((entry) => entry.table === table)) throw new Error(`Missing ${table} from data inventory`);
}
for (const phrase of ["HMAC-SHA256", "aggregateOnlySlack", "7–730", "contractual/platform decisions"]) {
  if (!governance.includes(phrase)) throw new Error(`Governance documentation is missing: ${phrase}`);
}
for (const fragment of ["retention_days", "cue_source_key_audit", "ON DELETE CASCADE"]) {
  if (!migration.includes(fragment)) throw new Error(`Governance migration is missing: ${fragment}`);
}
console.log(`NoxCue governance inventory verified (${inventory.stores.length} stores).`);
