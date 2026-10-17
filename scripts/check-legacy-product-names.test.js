import { describe, expect, it } from "vitest";
import { findLegacyProductNameViolations } from "./check-legacy-product-names.mjs";

const legacy = (...parts) => parts.join("");

describe("legacy product-name boundary", () => {
  it("rejects retired names in active code and paths", () => {
    const file = `src/${legacy("nox", "cue")}.ts`;
    const violations = findLegacyProductNameViolations([file], () => `const table = "${legacy("cue", "_sources")}";`);
    expect(violations).toHaveLength(2);
  });

  it("allows immutable migrations and the compatibility ledger", () => {
    const files = [
      `migrations/0001_${legacy("nox", "spot")}.sql`,
      "services/gateway/migrations/0001_control_plane.sql",
      "docs/LEGACY_COMPATIBILITY.md",
    ];
    expect(findLegacyProductNameViolations(files, () => legacy("nox", "ticket"))).toEqual([]);
  });

  it("allows only the installed macOS client compatibility token", () => {
    const file = "packages/contracts/native-clients.ts";
    expect(findLegacyProductNameViolations([file], () => `"${legacy("nox", "feed")}-mac"`)).toEqual([]);
    expect(findLegacyProductNameViolations([file], () => `"${legacy("nox", "feed")}-worker"`)).toHaveLength(1);
  });
});
