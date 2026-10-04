import { describe, expect, it } from "vitest";
import { appForApiPath } from "../apps.js";
import { projectScopedApiTokenPathSupported } from "../api-auth.js";
import { projectIdInPath, serviceForProjectRequest } from "../request-project-scope.js";

describe("NoxConnect capability paths", () => {
  const capabilities = {
    activity: "noxfeed",
    incidents: "noxcue",
    issues: "noxfeed",
    feedback: "noxspot",
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

  it("binds fixed-ID incident actions to NoxCue and the project", () => {
    const path = "/api/v1/projects/project-1/incidents/inc_0123456789abcdef0123456789abcdef";
    expect(projectIdInPath(path)).toBe("project-1");
    expect(serviceForProjectRequest(path)).toBe("noxcue");
    expect(appForApiPath(path)).toBe("noxcue");
    expect(projectScopedApiTokenPathSupported(path, "PATCH")).toBe(true);
  });

  it("retains project scoping for existing cue and retrieval routes", () => {
    expect(projectIdInPath("/api/v1/projects/project-1/cue/dashboard")).toBe("project-1");
    expect(appForApiPath("/api/v1/projects/project-1/cue/dashboard")).toBe("noxcue");
    expect(projectIdInPath("/api/v1/projects/project-1/retrieval")).toBe("project-1");
  });
});
