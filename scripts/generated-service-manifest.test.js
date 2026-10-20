import { describe, expect, it } from "vitest";
import { platformServices } from "../config/platform-services.mjs";
import { renderGeneratedServiceManifest, validateServiceManifest } from "./generated-service-manifest.mjs";

function cloneManifest() {
  return structuredClone(platformServices);
}

describe("generated platform service manifest", () => {
  it("validates and renders deterministic gateway routes", () => {
    const first = renderGeneratedServiceManifest();
    const second = renderGeneratedServiceManifest();
    expect(first).toEqual(second);
    expect(first.typescript).toContain("matchesGatewayRoute");
    expect(JSON.parse(first.json).services.at(-1)).toMatchObject({ id: "gateway", promoteVersion: true });
  });

  it("rejects deployment order gaps", () => {
    const manifest = cloneManifest();
    manifest.services[2].deployOrder = 8;
    expect(() => validateServiceManifest(manifest)).toThrow("deployOrder for activity must be 2");
  });

  it("rejects bindings to unknown workers", () => {
    const manifest = cloneManifest();
    manifest.bindings.gateway.production.NOXHERE = "missing-worker";
    expect(() => validateServiceManifest(manifest)).toThrow("targets unknown worker missing-worker");
  });

  it("requires the gateway to promote last", () => {
    const manifest = cloneManifest();
    manifest.services.at(-1).promoteVersion = false;
    expect(() => validateServiceManifest(manifest)).toThrow("gateway must be the final version-promoted service");
  });
});
