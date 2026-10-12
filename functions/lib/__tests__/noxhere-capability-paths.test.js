import { describe, expect, it } from "vitest";
import { appForApiPath } from "../apps.js";
import { projectScopedApiTokenPathSupported } from "../api-auth.js";
import { projectIdInPath, serviceForProjectRequest } from "../request-project-scope.js";

describe("NoxHere capability paths", () => {
  const capabilities = {
    activity: "activity",
    incidents: "telemetry",
    issues: "activity",
    feedback: "feedback",
  };

  for (const [capability, service] of Object.entries(capabilities)) {
    it(`binds ${capability} to an explicit project and internal capability`, () => {
      const path = `/api/v1/projects/project-1/${capability}`;
      expect(projectIdInPath(path)).toBe("project-1");
      expect(serviceForProjectRequest(path)).toBe(service);
      expect(appForApiPath(path)).toBe(service);
      expect(projectScopedApiTokenPathSupported(path, "GET")).toBe(true);
    });
  }

  it("binds fixed-ID incident actions to Telemetry and the project", () => {
    const path = "/api/v1/projects/project-1/incidents/inc_0123456789abcdef0123456789abcdef";
    expect(projectIdInPath(path)).toBe("project-1");
    expect(serviceForProjectRequest(path)).toBe("telemetry");
    expect(appForApiPath(path)).toBe("telemetry");
    expect(projectScopedApiTokenPathSupported(path, "PATCH")).toBe(true);
  });

  it("retains project scoping for telemetry and retrieval routes", () => {
    expect(projectIdInPath("/api/v1/projects/project-1/telemetry/dashboard")).toBe("project-1");
    expect(appForApiPath("/api/v1/projects/project-1/telemetry/dashboard")).toBe("telemetry");
    expect(projectIdInPath("/api/v1/projects/project-1/retrieval")).toBe("project-1");
  });
});
