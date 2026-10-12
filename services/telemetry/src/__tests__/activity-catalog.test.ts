import { describe, expect, it, vi } from "vitest";
import { resolveActivityMetric } from "../activity-catalog";

describe("activity metric catalog", () => {
  it("resolves a registered project metric", async () => {
    const first = vi.fn(async () => ({ label: "Journals added" }));
    const bind = vi.fn(() => ({ first }));
    const env = { NOX_DB: { prepare: vi.fn(() => ({ bind })) } } as unknown as Env;
    await expect(resolveActivityMetric(env, {
      orgId: 7, sourceId: "source-1", projectId: "playnist",
    }, "custom.journals.added")).resolves.toEqual({ key: "custom.journals.added", label: "Journals added" });
    expect(bind).toHaveBeenCalledWith(7, "custom.journals.added", "playnist", "playnist", "playnist", "source-1");
  });

  it("does not create arbitrary standard-looking metrics", async () => {
    const prepare = vi.fn();
    await expect(resolveActivityMetric({ NOX_DB: { prepare } } as unknown as Env, {
      orgId: 7, sourceId: "source-1", projectId: null,
    }, "journals.added")).resolves.toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });
});
