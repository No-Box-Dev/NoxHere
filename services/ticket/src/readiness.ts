export interface ReadinessResult {
  service: "noxticket";
  status: "ok";
  contractVersion: 1;
  schemaVersion: 3;
  buildSha: string;
}

// Exercise the columns used by the real feature, spec, and attachment paths.
// A process-only health check allowed an incompatible Worker to report healthy
// while every NoxTicket page request failed against D1.
export async function checkReadiness(db: D1Database, buildSha = "development"): Promise<ReadinessResult> {
  await db.prepare(`SELECT
    id, org_id, project_id, title, status, backlog, priority, state, plan,
    owners_json, status_history_json, created_by, created_at, updated_at, closed_at
    FROM features LIMIT 1`).first();
  await db.prepare(`SELECT
    id, org_id, project_id, feature_number, is_primary, title, description,
    links_json, archived, archived_at, created_by, created_at, updated_at
    FROM specs LIMIT 1`).first();
  await db.prepare(`SELECT
    id, org_id, spec_id, filename, content_type, size, r2_key, uploaded_by, uploaded_at
    FROM spec_attachments LIMIT 1`).first();

  return { service: "noxticket", status: "ok", contractVersion: 1, schemaVersion: 3, buildSha };
}
