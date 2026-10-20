import { describe, expect, it } from "vitest";
import { buildAppBootstrap, scopeBootstrapProjects } from "../app-bootstrap";

describe("authenticated application bootstrap", () => {
  it("returns one scoped application model without credentials", () => {
    const result = buildAppBootstrap(
      "acme",
      { login: "owner", org: "Acme", isAdmin: true, accessLevel: "member" },
      [{ id: "project-1", name: "App", org: "acme", repo: "app", archived: 0, routing_enabled: 1 }],
      { github: { connected: true }, slack: { connected: true, teamName: "Acme Slack" } },
    );

    expect(result).toMatchObject({
      apiVersion: 1,
      actor: { id: "owner", isAdmin: true, accessLevel: "member" },
      organization: { id: "acme", name: "Acme" },
      projects: [{
        id: "project-1",
        connections: [
          { provider: "github", label: "acme/app", status: "connected" },
          { provider: "slack", label: "Acme Slack", status: "connected" },
        ],
      }],
    });
    const keys: string[] = [];
    JSON.stringify(result, (key, value) => { if (key) keys.push(key); return value; });
    expect(keys).not.toContain("token");
    expect(keys).not.toContain("secret");
    expect(keys).not.toContain("credential");
  });

  it("maps legacy Telemetry guest access and omits unavailable projects", () => {
    const result = buildAppBootstrap(
      "acme",
      { login: "guest", accessLevel: "guest", allowedServices: ["feedback", "telemetry"] },
      [
        { id: "active", name: "Active", routing_enabled: 1 },
        { id: "disabled", name: "Disabled", routing_enabled: 0 },
        { id: "archived", name: "Archived", routing_enabled: 1, archived: 1 },
      ],
      null,
    );

    expect(result.actor).toMatchObject({
      role: "guest",
      allowedServiceIds: ["feedback", "growth", "usage", "issues"],
    });
    expect(result.projects.map((project) => project.id)).toEqual(["active"]);
  });

  it("limits automation bootstrap to the token's exact project", () => {
    const rows = [{ id: "allowed", name: "Allowed" }, { id: "other", name: "Other" }];
    expect(scopeBootstrapProjects(rows, "api_token", "allowed")).toEqual([rows[0]]);
    expect(scopeBootstrapProjects(rows, "session", "allowed")).toEqual(rows);
    expect(scopeBootstrapProjects(rows, "api_token", null)).toEqual([]);
  });
});
