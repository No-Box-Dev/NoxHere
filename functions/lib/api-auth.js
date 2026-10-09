import { compatibilityApiPath } from "./api-paths.js";

// Project API tokens have already passed NoxHere lifecycle, route, service,
// and project checks. Connector handlers may admit them to project reads
// without presenting them as organization administrators.
export function canReadProjectResource(data) {
  return Boolean(data?.isAdmin || data?.auth?.type === "api_token");
}

export async function apiTokenProjectResource(db, pathname, orgId, searchParams = new URLSearchParams(), selectedProjectId = /** @type {string | null} */ (null)) {
  pathname = compatibilityApiPath(pathname);
  if (pathname === "/api/cues/metrics" && searchParams.get("sourceId")) {
    const row = await db.prepare(
      "SELECT project_id FROM cue_sources WHERE org_id = ? AND id = ?",
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
    /^\/api\/projects\/([^/]+)\/(?:archive|routing|backfill-prs|retrieval|activity|incidents|issues|feedback|cue)(?:\/|$)/,
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
    // Project-scoped Planning records live in the split NoxTicket service.
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

  match = pathname.match(/^\/api\/spots\/sites\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM spot_sites WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/spots\/reports\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM spot_reports WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  match = pathname.match(/^\/api\/cues\/projects\/([^/]+)/);
  if (match) return { kind: "project", projectId: decodeURIComponent(match[1]) };

  match = pathname.match(/^\/api\/cues\/sources\/([^/]+)/);
  if (match) {
    const row = await db.prepare(
      "SELECT project_id FROM cue_sources WHERE org_id = ? AND id = ?",
    ).bind(orgId, decodeURIComponent(match[1])).first();
    return { kind: "resource", projectId: row?.project_id ?? null };
  }

  return null;
}

export function projectScopedApiTokenPathSupported(pathname, method) {
  const verb = method.toUpperCase();
  if (verb === "POST" && pathname === "/api/v1/developer-feedback") return true;
  if (verb === "POST" && pathname === "/api/v1/integrations/slack/messages") return true;
  if (verb === "GET" && /^\/api\/v1\/services(?:\/[^/]+(?:\/(?:setup|health))?)?$/.test(pathname)) return true;
  pathname = compatibilityApiPath(pathname);
  if (verb === "GET" && /^\/api\/projects\/[^/]+\/(?:activity|incidents|issues|feedback)$/.test(pathname)) return true;
  if (verb === "PATCH" && /^\/api\/projects\/[^/]+\/incidents\/inc_[a-f0-9]{32}$/.test(pathname)) return true;
  if (verb === "GET" && pathname === "/api/v1/feed") return true;
  if (verb === "GET" && /^\/api\/(?:issues|prs)(?:\/|$)/.test(pathname)) return true;
  if (verb === "POST" && /^\/api\/projects\/[^/]+\/backfill-prs$/.test(pathname)) return true;
  if (/^\/api\/spots\/sites(?:\/|$)/.test(pathname)) return true;
  if (verb === "PATCH" && /^\/api\/spots\/reports\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/cues\/sources(?:\/|$)/.test(pathname)) return true;
  if (verb === "GET" && (pathname === "/api/cues/events" || pathname === "/api/cues/metrics")) return true;
  if (/^\/api\/cues\/projects\/[^/]+\/metrics$/.test(pathname)) return true;
  return false;
}
