import type { CueEnvironment } from "./environment";
import type { CueFeatureResult, FeatureDiagnosis } from "./feature-health";

const DYNAMIC_VALUE = /\b(?:[0-9a-f]{8}-[0-9a-f-]{27,}|\d{4}-\d{2}-\d{2}t\S+|\d{6,})\b/gi;
const LINE_COLUMN = /:\d+(?::\d+)?\b/g;
const NON_KEY = /[^a-z0-9._-]+/g;

export interface IncidentSource {
  org_id: number;
  owner_id: string;
  source_id: string;
  source_name: string;
  project_id: string | null;
  environment: CueEnvironment;
}

interface IncidentPayload {
  impact: string;
  message?: string | undefined;
  error?: { name?: string | undefined; message: string; code?: string | undefined; status?: number | undefined; stack?: string | undefined } | undefined;
  context?: { environment?: string | undefined; release?: string | undefined; runtime?: string | undefined; url?: string | undefined } | undefined;
  diagnosis: FeatureDiagnosis;
}

export interface GithubIncident {
  key: string;
  kind: "feature" | "error" | "endpoint";
  title: string;
  occurredAt: string;
  payload: IncidentPayload;
}

export function readableKeySegment(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(DYNAMIC_VALUE, "dynamic")
    .replace(LINE_COLUMN, "")
    .replace(NON_KEY, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 64);
  return normalized || fallback;
}

export function explicitIncidentKey(value: string): string {
  return value.split("/").slice(0, 6)
    .map((part) => readableKeySegment(part, "unknown"))
    .join("/")
    .slice(0, 240);
}

function operationFromStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const frame = stack.split("\n").map((line) => line.trim()).find((line) => /^at\s+/i.test(line));
  const match = frame?.match(/^at\s+(?:async\s+)?([^\s(]+)/i);
  return match?.[1];
}

export function featureIncidentKey(event: CueFeatureResult): string {
  const code = event.error?.code ?? (event.error?.status ? `http_${event.error.status}` : undefined);
  const component = code?.split(/[._-]/, 1)[0] ?? event.error?.name;
  const operation = operationFromStack(event.error?.stack);
  return [
    readableKeySegment(event.feature, "feature"),
    readableKeySegment(event.reason, "unknown_reason"),
    readableKeySegment(component, "unknown_component"),
    readableKeySegment(code, "unknown_code"),
    ...(operation ? [readableKeySegment(operation, "unknown_operation")] : []),
  ].join("/").slice(0, 240);
}

export function errorIncidentKey(event: {
  title: string;
  error?: { name?: string | undefined; code?: string | undefined; status?: number | undefined; stack?: string | undefined } | undefined;
  data: { fingerprint?: string | undefined; component?: string | undefined; errorCode?: string | undefined };
}): string {
  if (event.data.fingerprint) return explicitIncidentKey(event.data.fingerprint);
  const code = event.data.errorCode ?? event.error?.code ?? (event.error?.status ? `http_${event.error.status}` : undefined);
  const operation = operationFromStack(event.error?.stack);
  return [
    "error.occurred",
    readableKeySegment(event.data.component ?? event.error?.name, "unknown_component"),
    readableKeySegment(code, "unknown_code"),
    readableKeySegment(operation ?? event.title, "unknown_operation"),
  ].join("/").slice(0, 240);
}

export async function stageGithubIncident(env: Env, source: IncidentSource, incident: GithubIncident): Promise<boolean> {
  if (!source.project_id) return false;
  const setting = await env.NOX_DB.prepare(
    `SELECT enabled, environments_json FROM cue_github_issue_settings
      WHERE org_id = ? AND project_id = ?`,
  ).bind(source.org_id, source.project_id).first<{ enabled: number; environments_json: string }>();
  if (!setting || setting.enabled !== 1 || !enabledEnvironment(setting.environments_json, source.environment)) return false;
  const candidateId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.NOX_DB.prepare(
    `INSERT INTO cue_github_incidents
       (id, org_id, project_id, source_id, environment, incident_key, kind, title,
        payload_json, first_seen_at, last_seen_at, occurrence_count, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?)
     ON CONFLICT(project_id, environment, incident_key) DO UPDATE SET
       source_id = excluded.source_id,
       kind = excluded.kind,
       title = excluded.title,
       payload_json = excluded.payload_json,
       last_seen_at = excluded.last_seen_at,
       occurrence_count = cue_github_incidents.occurrence_count + 1,
       status = CASE WHEN cue_github_incidents.status = 'processing' THEN 'processing' ELSE 'pending' END,
       last_error = NULL,
       updated_at = excluded.updated_at`,
  ).bind(
    candidateId, source.org_id, source.project_id, source.source_id, source.environment,
    incident.key, incident.kind, incident.title, JSON.stringify(incident.payload),
    incident.occurredAt, incident.occurredAt, now,
  ).run();
  const row = await env.NOX_DB.prepare(
    `SELECT id FROM cue_github_incidents
      WHERE project_id = ? AND environment = ? AND incident_key = ?`,
  ).bind(source.project_id, source.environment, incident.key).first<{ id: string }>();
  if (!row?.id) return false;
  try {
    await env.NOX_TASKS.send({
      type: "noxcue_github_issue",
      incidentId: row.id,
      ownerId: source.owner_id,
      deliveryId: `noxcue:${row.id}:${now}`,
    });
    await env.NOX_DB.prepare(
      "UPDATE cue_github_incidents SET last_queued_at = ? WHERE id = ?",
    ).bind(now, row.id).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      message: "NoxCue GitHub incident queue failed; NoxConnect recovery will retry",
      incidentId: row.id,
      error: error instanceof Error ? error.message : String(error),
    }));
    return false;
  }
}

function enabledEnvironment(raw: string, environment: CueEnvironment): boolean {
  try {
    const values: unknown = JSON.parse(raw);
    return Array.isArray(values) && values.includes(environment);
  } catch {
    return false;
  }
}
