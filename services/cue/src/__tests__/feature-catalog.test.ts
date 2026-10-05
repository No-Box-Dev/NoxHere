import { describe, expect, it, vi } from "vitest";
import { resolveFeature } from "../feature-catalog";

describe("feature catalog", () => {
  it("resolves standards without a database lookup", async () => {
    const prepare = vi.fn();
    const result = await resolveFeature({ NOX_DB: { prepare } } as unknown as Env,
      { orgId: 7, sourceId: "source-1", projectId: "playnist" }, "auth.signup");
    expect(result).toMatchObject({ key: "auth.signup", kind: "standard", label: "Sign up" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("resolves custom features from the linked project", async () => {
    const first = vi.fn(async () => ({
      label: "Publish journal",
      failure_message: "A user was prevented from publishing a journal entry.",
    }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const env = { NOX_DB: { prepare } } as unknown as Env;

    await expect(resolveFeature(env, { orgId: 7, sourceId: "source-1", projectId: "playnist" },
      "custom.journal.publish")).resolves.toMatchObject({
      key: "custom.journal.publish", kind: "custom", label: "Publish journal",
    });
    expect(bind).toHaveBeenCalledWith(7, "custom.journal.publish", "playnist", "playnist", "playnist", "source-1");
  });

  it("isolates custom features to the source when no project is linked", async () => {
    const first = vi.fn(async () => ({ label: "Publish journal", failure_message: "Publishing failed." }));
    const bind = vi.fn(() => ({ first }));
    const env = { NOX_DB: { prepare: vi.fn(() => ({ bind })) } } as unknown as Env;
    await resolveFeature(env, { orgId: 7, sourceId: "source-1", projectId: null }, "custom.journal.publish");
    expect(bind).toHaveBeenCalledWith(7, "custom.journal.publish", null, null, null, "source-1");
  });

  it("never treats an unknown standard-looking key as custom", async () => {
    const prepare = vi.fn();
    await expect(resolveFeature(
      { NOX_DB: { prepare } } as unknown as Env,
      { orgId: 7, sourceId: "source-1", projectId: null },
      "content.journal.publish",
    )).resolves.toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });
});
