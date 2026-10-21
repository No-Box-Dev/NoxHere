import { describe, expect, it } from "vitest";
import { assertBootstrapScope, validateLoginAcceptanceConfig } from "./login-staging-acceptance.mjs";

const fixture = { org_login: "nox-staging-cert", project_id: "staging-cert-project" };

describe("production-shaped staging login acceptance", () => {
  it("only permits the declared staging origin and a complete release SHA", () => {
    expect(validateLoginAcceptanceConfig({
      baseUrl: "https://noxhere-staging.jasper-414.workers.dev",
      expectedSha: "a".repeat(40),
    })).toEqual([]);
    expect(validateLoginAcceptanceConfig({
      baseUrl: "https://app.noxhere.com",
      expectedSha: "short",
    })).toEqual([
      "base URL must be the declared staging origin https://noxhere-staging.jasper-414.workers.dev",
      "expected SHA must be a full Git commit SHA",
    ]);
  });

  it("accepts the selected organization and project", () => {
    expect(() => assertBootstrapScope({
      organization: { id: fixture.org_login },
      projects: [{ id: fixture.project_id }, { id: "another-project" }],
    }, fixture)).not.toThrow();
  });

  it("rejects an automation bootstrap that exposes another project", () => {
    expect(() => assertBootstrapScope({
      organization: { id: fixture.org_login },
      projects: [{ id: fixture.project_id }, { id: "escaped-project" }],
    }, fixture, { exactProject: true })).toThrow("automation bootstrap escaped project staging-cert-project");
  });
});
