import { publishSlackTransport } from "./transport-outbox";
import { getPlanningRepoName } from "./inactive-repos.js";
import { isAppEnabled } from "./apps.js";
import { buildPlanningActivityResponse, buildPlanningFeatureAddedResponse } from "../products/planning/response.js";

const TICKET_ACTIONS = new Set(["opened", "closed", "reopened"]);

export async function stagePlanningActivity(env, { orgId, ownerId, repo, action, issue, actor }) {
  const assignment = await env.DB.prepare(
    "SELECT project_id FROM project_repositories WHERE org_id = ? AND repo = ?",
  ).bind(orgId, repo).first();
  const projectId = assignment?.project_id ?? null;
  if (!projectId) return { skipped: "project_not_configured" };
  if (!(await isAppEnabled(env.DB, orgId, "planning", projectId))) return { skipped: "service_disabled" };
  if (!TICKET_ACTIONS.has(action) || !issue?.number) return { skipped: "unsupported_event" };
  const planningRepo = await getPlanningRepoName(env.DB, orgId, projectId);
  if (repo !== planningRepo || hasLabel(issue, "feedback")) return { skipped: "not_planning" };
  const featureAddedInput = {
    orgId,
    projectId,
    actor: actor || "GitHub",
    feature: {
      number: issue.number,
      title: issue.title,
      description: featureDescription(issue.body),
      backlog: hasLabel(issue, "backlog"),
    },
  };
  const message = action === "opened"
    ? (env.PLANNING_SERVICE?.buildFeatureAddedMessage
        ? await env.PLANNING_SERVICE.buildFeatureAddedMessage(featureAddedInput)
        : buildPlanningFeatureAddedResponse(featureAddedInput).message)
    : (env.PLANNING_SERVICE?.buildActivityMessage
        ? await env.PLANNING_SERVICE.buildActivityMessage({ orgId, repo, action, issue, actor })
        : buildPlanningActivityResponse({ orgId, repo, action, issue, actor }).message);
  const delivery = await publishSlackTransport(env, {
    orgId,
    projectId,
    route: "feature_delivery",
    idempotencyKey: `planning:${repo}:${issue.number}:${action}`,
    message,
  });
  return { queued: delivery.queued, outboxId: delivery.outboxId };
}

export async function stagePlanningFeatureAdded(env, { orgId, projectId, ownerId, feature, actor }) {
  if (!projectId) return { skipped: "project_not_configured" };
  if (!(await isAppEnabled(env.DB, orgId, "planning", projectId))) return { skipped: "service_disabled" };
  if (!feature?.number) return { skipped: "invalid_feature" };
  const input = { orgId, projectId, feature, actor };
  const message = env.PLANNING_SERVICE?.buildFeatureAddedMessage
    ? await env.PLANNING_SERVICE.buildFeatureAddedMessage(input)
    : buildPlanningFeatureAddedResponse(input).message;
  const delivery = await publishSlackTransport(env, {
    orgId,
    projectId,
    route: "feature_delivery",
    idempotencyKey: `planning:${projectId}:${feature.number}:created`,
    message,
  });
  return { queued: delivery.queued, outboxId: delivery.outboxId };
}

function hasLabel(issue, expected) {
  return (issue?.labels ?? []).some((label) =>
    String(typeof label === "string" ? label : label?.name ?? "").toLowerCase() === expected);
}

function featureDescription(body) {
  if (typeof body !== "string") return "";
  return body.replace(/\n?<!-- planning:metadata\n[\s\S]*?\n-->\s*$/, "").trim();
}
