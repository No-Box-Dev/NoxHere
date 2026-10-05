import { describe, expect, it } from "vitest";
import { checkReadiness } from "../readiness";
import { createTestD1 } from "./d1";

describe("NoxTicket readiness", () => {
  it("checks the schema used by the live data paths", async () => {
    await expect(checkReadiness(createTestD1())).resolves.toEqual({
      service: "noxticket",
      status: "ok",
      contractVersion: 1,
      schemaVersion: 3,
      buildSha: "development",
    });
  });

  it("fails if the bound database has an incompatible feature schema", async () => {
    const db = {
      prepare: () => ({
        first: async () => { throw new Error("no such column: project_id"); },
      }),
    } as unknown as D1Database;

    await expect(checkReadiness(db)).rejects.toThrow("no such column: project_id");
  });
});
