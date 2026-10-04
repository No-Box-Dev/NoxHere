import { publishSlackTransport } from "./transport-outbox";
import { getNoxTicketRepoName } from "./inactive-repos.js";
import { isAppEnabled } from "./apps.js";
import { buildNoxTicketActivityResponse, buildNoxTicketFeatureAddedResponse } from "../products/noxticket/response.js";

const TICKET_ACTIONS = new Set(["opened", "closed", "reopened"]);

export async function stageNoxTicketActivity(env, { orgId, ownerId, repo, action, issue, actor }) {
  const assignment = await env.DB.prepare(
    "SELECT project_id FROM project_repositories WHERE org_id = ? AND repo = ?",
  ).bind(orgId, repo).first();
  const projectId = assignment?.project_id ?? null;
  if (!projectId) return { skipped: "project_not_configured" };
  if (!(await isAppEnabled(env.DB, orgId, "noxticket", projectId))) return { skipped: "service_disabled" };
  if (!TICKET_ACTIONS.has(action) || !issue?.number) return { skipped: "unsupported_event" };
  const noxTicketRepo = await getNoxTicketRepoName(env.DB, orgId, projectId);
  if (repo !== noxTicketRepo || hasLabel(issue, "noxspot")) return { skipped: "not_noxticket" };
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
    ? (env.NOXTICKET_SERVICE?.buildFeatureAddedMessage
        ? await env.NOXTICKET_SERVICE.buildFeatureAddedMessage(featureAddedInput)
        : buildNoxTicketFeatureAddedResponse(featureAddedInput).message)
    : (env.NOXTICKET_SERVICE?.buildActivityMessage
        ? await env.NOXTICKET_SERVICE.buildActivityMessage({ orgId, repo, action, issue, actor })
        : buildNoxTicketActivityResponse({ orgId, repo, action, issue, actor }).message);
  const delivery = await publishSlackTransport(env, {
    orgId,
    projectId,
    route: "feature_delivery",
    idempotencyKey: `noxticket:${repo}:${issue.number}:${action}`,
    message,
  });
  return { queued: delivery.queued, outboxId: delivery.outboxId };
}

export async function stageNoxTicketFeatureAdded(env, { orgId, projectId, ownerId, feature, actor }) {
  if (!projectId) return { skipped: "project_not_configured" };
  if (!(await isAppEnabled(env.DB, orgId, "noxticket", projectId))) return { skipped: "service_disabled" };
  if (!feature?.number) return { skipped: "invalid_feature" };
  const input = { orgId, projectId, feature, actor };
  const message = env.NOXTICKET_SERVICE?.buildFeatureAddedMessage
    ? await env.NOXTICKET_SERVICE.buildFeatureAddedMessage(input)
    : buildNoxTicketFeatureAddedResponse(input).message;
  const delivery = await publishSlackTransport(env, {
    orgId,
    projectId,
    route: "feature_delivery",
    idempotencyKey: `noxticket:${projectId}:${feature.number}:created`,
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
  return body.replace(/\n?<!-- noxticket:metadata\n[\s\S]*?\n-->\s*$/, "").trim();
}
