import { compatibilityApiPath } from "./api-paths.js";

// Project API tokens have already passed NoxHere lifecycle, route, service,
// and project checks. Connector handlers may admit them to project reads
// without presenting them as organization administrators.
export function canReadProjectResource(data) {
  return Boolean(data?.isAdmin || data?.auth?.type === "api_token");
}

export async function apiTokenProjectResource(db, pathname, orgId, searchParams = new URLSearchParams(), selectedProjectId = /** @type {string | null} */ (null)) {
  pathname = compatibilityApiPath(pathname);
  if (pathname === "/api/telemetry/metrics" && searchParams.get("sourceId")) {
    const row = await db.prepare(
      "SELECT project_id FROM telemetry_sources WHERE org_id = ? AND id = ?",
    ).bind(orgId, searchParams.get("sourceId")).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }
  let match = pathname.match(/^\/api\/projects\/routing\/([^/]+)$/);
  if (match) return { kind: "project", projectId: decodeURIComponent(match[1]) };
  // Match only project-resource routes. A broad `/api/projects/:id` match
  // mistakes collection routes such as `/api/projects/routing` for a project
  // whose ID is "routing", causing valid scoped requests to be concealed as
  // cross-project access.
  match = pathname.match(
    /^\/api\/projects\/([^/]+)\/(?:archive|routing|backfill-prs|retrieval|activity|incidents|issues|feedback|telemetry)(?:\/|$)/,
  );
  if (match) return { kind: "project", projectId: decodeURIComponent(match[1]) };

  match = pathname.match(/^\/api\/(?:issues|prs)\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM project_repositories WHERE org_id = ? AND repo = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/features\/([^/]+)/);
  if (match) {
    const number = Number.parseInt(decodeURIComponent(match[1]), 10);
    if (!Number.isInteger(number)) return { kind: "resource", projectId: null };
    // Project-scoped Planning records live in the split Planning service.
    // The local features table is only a compatibility projection and can be
    // absent or stale, so it cannot authorize or reject the service record.
    if (selectedProjectId) return { kind: "resource", projectId: selectedProjectId };
    const row = await db.prepare(
      "SELECT project_id FROM features WHERE org_id = ? AND number = ? ORDER BY project_id LIMIT 1",
    ).bind(orgId, number).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/specs\/([^/]+)/);
  if (match) {
    const id = Number.parseInt(decodeURIComponent(match[1]), 10);
    const row = Number.isInteger(id) ? await db.prepare(
      "SELECT project_id FROM specs WHERE org_id = ? AND id = ?",
    ).bind(orgId, id).first() : null;
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/events\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM events WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/feedback\/sites\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM spot_sites WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/feedback\/reports\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM spot_reports WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/feedback\/assets\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM feedback_assets WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/telemetry\/projects\/([^/]+)/);
  if (match) return { kind: "project", projectId: decodeURIComponent(match[1]) };

  match = pathname.match(/^\/api\/telemetry\/sources\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM telemetry_sources WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  return null;
}

export function projectScopedApiTokenPathSupported(pathname, method) {
  const verb = method.toUpperCase();
  if (verb === "GET" && pathname === "/api/v1/bootstrap") return true;
  if (verb === "POST" && (pathname === "/api/v1/telemetry/public/events"
      || pathname === "/api/telemetry/public/v1/events")) return true;
  if (verb === "POST" && pathname === "/api/v1/developer-feedback") return true;
  if (verb === "POST" && pathname === "/api/v1/integrations/slack/messages") return true;
  if (verb === "POST" && pathname === "/api/v1/slack/test") return true;
  if (verb === "GET" && pathname === "/api/v1/slack/channels") return true;
  if (verb === "GET" && /^\/api\/v1\/services(?:\/[^/]+(?:\/(?:setup|health|config))?)?$/.test(pathname)) return true;
  if (/^\/api\/v1\/(?:features|tasks|task-workflows|specs|assign|issue-state|planning)(?:\/|$)/.test(pathname)) return true;
  pathname = compatibilityApiPath(pathname);
  if (verb === "GET" && /^\/api\/projects\/[^/]+\/(?:activity|incidents|issues|feedback)$/.test(pathname)) return true;
  if (verb === "PATCH" && /^\/api\/projects\/[^/]+\/incidents\/inc_[a-f0-9]{32}$/.test(pathname)) return true;
  if (verb === "GET" && pathname === "/api/v1/activity") return true;
  if (verb === "GET" && /^\/api\/(?:issues|prs)(?:\/|$)/.test(pathname)) return true;
  if (verb === "POST" && /^\/api\/projects\/[^/]+\/backfill-prs$/.test(pathname)) return true;
  if (/^\/api\/feedback\/sites(?:\/|$)/.test(pathname)) return true;
  if (verb === "PATCH" && /^\/api\/feedback\/reports\/[^/]+$/.test(pathname)) return true;
  if ((verb === "GET" || verb === "HEAD") && /^\/api\/feedback\/assets\/[^/]+$/.test(pathname)) return true;
  if (verb === "GET" && /^\/api\/feedback\/reports\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/telemetry\/sources(?:\/|$)/.test(pathname)) return true;
  if (verb === "GET" && pathname === "/api/telemetry/github-issues") return true;
  if (verb === "GET" && (pathname === "/api/telemetry/events" || pathname === "/api/telemetry/metrics")) return true;
  if (/^\/api\/telemetry\/projects\/[^/]+\/metrics$/.test(pathname)) return true;
  return false;
}
