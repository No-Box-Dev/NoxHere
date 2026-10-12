import { describe, expect, it } from "vitest";
import { serviceForApiPath } from "../../../packages/authz/routes.js";
import { appForApiPath } from "../apps.js";

describe("shared authorization route registry", () => {
  for (const [path, service] of [
    ["/api/v1/tasks", "planning"],
    ["/api/v1/task-workflows", "planning"],
    ["/api/v1/projects/playnist/telemetry/dashboard", "telemetry"],
    ["/api/v1/feedback/project-overview", "feedback"],
    ["/api/v1/activity", "activity"],
  ]) {
    it(`${path} is consistently classified as ${service}`, () => {
      expect(serviceForApiPath(path)).toBe(service);
      expect(appForApiPath(path)).toBe(service);
    });
  }
});
