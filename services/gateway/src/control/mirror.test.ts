import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "./auth";
import { mirrorAndOverlayResponse } from "./mirror";

function project(index: number) {
  return {
    id: `project-${index}`,
    name: `Project ${index}`,
    enabled: true,
    archived: false,
    repositories: [`repo-${index}`],
  };
}

function database(batch: (statements: D1PreparedStatement[]) => Promise<unknown>) {
  return {
    prepare(sql: string) {
      const statement = {
        sql,
        binds: [] as unknown[],
        bind(...binds: unknown[]) { statement.binds = binds; return statement; },
        async first() { return null; },
      };
      return statement;
    },
    batch,
  } as unknown as D1Database;
}

const auth: AuthContext = {
  credentialType: "session",
  credentialId: "session-1",
  principalId: "github:1",
  userLogin: "admin",
  userId: 1,
  orgId: 7,
  orgLogin: "acme",
  isAdmin: true,
  projectId: null,
  scopes: [],
  connectionId: null,
  accessLevel: "member",
  guestAccess: null,
};

describe("control-plane project mirroring", () => {
  it("returns repository settings before background mirror writes complete", async () => {
    let release = () => {};
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const batch = vi.fn(async () => blocked);
    let backgroundWork: Promise<unknown> | undefined;
    const response = Response.json({ projects: [project(1)], repositories: ["repo-1"] });

    const result = await mirrorAndOverlayResponse(
      new Request("https://app.noxhere.com/api/v1/projects/routing"),
      response,
      database(batch),
      auth,
      (work) => { backgroundWork = work; },
    );

    expect(result).toBe(response);
    expect(backgroundWork).toBeDefined();
    release();
    await backgroundWork;
    expect(batch).toHaveBeenCalledOnce();
  });

  it("batches large project maps instead of writing every project separately", async () => {
    const batchSizes: number[] = [];
    const response = Response.json({ projects: Array.from({ length: 100 }, (_, index) => project(index)), repositories: [] });

    await mirrorAndOverlayResponse(
      new Request("https://app.noxhere.com/api/v1/projects/routing"),
      response,
      database(async (statements) => { batchSizes.push(statements.length); return []; }),
      auth,
    );

    expect(batchSizes.length).toBeGreaterThan(1);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(75);
    expect(batchSizes.reduce((total, size) => total + size, 0)).toBe(300);
  });

  it("keeps a successful settings response when background mirroring fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let backgroundWork: Promise<unknown> | undefined;
    const response = Response.json({ projects: [project(1)], repositories: ["repo-1"] });

    const result = await mirrorAndOverlayResponse(
      new Request("https://app.noxhere.com/api/v1/projects/routing"),
      response,
      database(async () => { throw new Error("control database unavailable"); }),
      auth,
      (work) => { backgroundWork = work; },
    );

    expect(result.status).toBe(200);
    await expect(backgroundWork).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("control_plane_mirror_failed"));
    error.mockRestore();
  });
});
