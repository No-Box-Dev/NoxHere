import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import openapi from "../../../public/openapi.json";

const wrapperMethods = {
  getJson: "get", getRawJson: "get", getBlob: "get",
  postJson: "post", postRawJson: "post", postFormJson: "post",
  putJson: "put", patchJson: "patch", deleteJson: "delete",
};
const gatewayIdentityPaths = new Set(["/api/auth/profile", "/api/auth/email/request"]);

describe("first-party client API parity", () => {
  it("uses only versioned, documented API operations", () => {
    const calls = clientApiCalls(join(process.cwd(), "apps/web/src"));
    expect(calls.length).toBeGreaterThan(25);
    const errors = [];
    for (const call of calls) {
      if (gatewayIdentityPaths.has(call.path)) continue;
      if (!/^\/api\/v1\//.test(call.path)) {
        errors.push(`${call.method.toUpperCase()} ${call.path} from ${call.file} is unversioned`);
        continue;
      }
      const match = Object.entries(openapi.paths).find(([documentedPath]) => pathsMatch(call.path, documentedPath));
      if (!match) errors.push(`${call.method.toUpperCase()} ${call.path} from ${call.file} is absent from OpenAPI`);
      else if (!match[1][call.method]) errors.push(`${call.method.toUpperCase()} ${call.path} from ${call.file} is not documented`);
    }
    expect(errors).toEqual([]);
  });
});

function clientApiCalls(root) {
  const calls = [];
  for (const file of walk(root).filter((candidate) => !candidate.includes(".test."))) {
    const source = readFileSync(file, "utf8");
    for (const [wrapper, defaultMethod] of Object.entries(wrapperMethods)) {
      const expression = new RegExp(`\\b${wrapper}(?:<[^;]*?>)?\\s*\\(\\s*([\\\"'\\\`])([\\s\\S]*?)\\1(?:\\s*,\\s*\\{([\\s\\S]{0,500}?)\\})?`, "g");
      for (const match of source.matchAll(expression)) {
        if (!match[2].startsWith("/api/")) continue;
        const explicit = match[3]?.match(/method\s*:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/i)?.[1]?.toLowerCase();
        calls.push({ method: explicit ?? defaultMethod, path: match[2], file });
      }
    }
    const fetchExpression = /\bfetch\(\s*(["'`])(\/api\/[\s\S]*?)\1\s*(?:,\s*\{([\s\S]{0,500}?)\}\s*)?\)/g;
    for (const match of source.matchAll(fetchExpression)) {
      const method = match[3]?.match(/method\s*:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/i)?.[1]?.toLowerCase() ?? "get";
      calls.push({ method, path: match[2], file });
    }
  }
  return calls;
}

function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function pathsMatch(clientPath, documentedPath) {
  const client = clientPath.split("?", 1)[0].split("/").filter(Boolean);
  const documented = documentedPath.split("/").filter(Boolean);
  return client.length === documented.length && client.every((segment, index) => {
    if (/^\{[^}]+\}$/.test(documented[index])) return true;
    if (segment.includes("${")) return false;
    return segment === documented[index];
  });
}
