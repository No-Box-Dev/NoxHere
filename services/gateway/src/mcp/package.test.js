import { readFileSync, existsSync } from "node:fs";
import { test, expect } from "vitest";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("native MCP routes before the SPA and is documented as a separate transport", () => {
  const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  expect(wrangler).toMatch(/"run_worker_first"\s*:\s*\[\s*"\/mcp"/);
  const openapi = readJson("../../../../public/openapi.json");
  expect(openapi["x-mcp"]).toMatchObject({ path: "/mcp", transport: "streamable-http", protocolVersion: "2026-07-28" });
});

test("private plugin scaffold is credential-free and cannot masquerade as a verified connection", () => {
  const manifest = readJson("../../../../plugins/noxhere/plugin.json");
  const template = readJson("../../../../plugins/noxhere-mcp.template.json");
  expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  expect(manifest.extensions["com.openai"].interface.shortDescription.length).toBeLessThanOrEqual(30);
  expect(template.mcpServers.noxhere.extensions["com.openai"].auth).toEqual({ type: "api_key", headerScheme: "bearer" });
  expect(template.mcpServers.noxhere.url).toBe("REPLACE_ONLY_AFTER_ENDPOINT_DEPLOYMENT_AND_VERIFICATION");
  expect(template.mcpServers.noxhere).not.toHaveProperty("headers");
  expect(existsSync(new URL("../../../../plugins/noxhere/mcp.json", import.meta.url))).toBe(false);
});
