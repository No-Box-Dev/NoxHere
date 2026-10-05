import { describe, expect, it } from "vitest";
import {
  configureStagingDatabase,
  databaseIdFromList,
} from "./prepare-staging-feed-database.mjs";

const id = "11111111-2222-3333-4444-555555555555";

describe("staging Feed database preparation", () => {
  it("selects exactly the dedicated staging database", () => {
    expect(databaseIdFromList([
      { name: "noxconnect-staging", uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
      { name: "noxfeed-demo-staging", uuid: id },
    ])).toBe(id);
    expect(databaseIdFromList([], "noxfeed-demo-staging")).toBeNull();
  });

  it("updates only the staging Feed binding", () => {
    const config = `database_id = "production-id"

[env.staging]
name = "noxfeed-response-staging"

[[env.staging.d1_databases]]
binding = "DEMO_DB"
database_name = "wrong-shared-database"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "migrations"
`;
    const updated = configureStagingDatabase(config, id);
    expect(updated).toContain('database_id = "production-id"');
    expect(updated).toContain('database_name = "noxfeed-demo-staging"');
    expect(updated).toContain(`database_id = "${id}"`);
    expect(configureStagingDatabase(updated, id)).toBe(updated);
  });
});
