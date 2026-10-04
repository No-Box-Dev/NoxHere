import { getCtx, jsonResponse, errorResponse } from "../../lib/db";
import { getActiveRepoNames } from "../../lib/inactive-repos.js";
import { getNoxDb, type NoxDatabaseEnv } from "../../lib/nox-db";

interface Ctx {
  env: NoxDatabaseEnv;
  data: { orgId: number; orgLogin: string; projectId?: string | null };
  request?: Request;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parseCursor(value: string | null) {
  if (!value) return null;
  const separator = value.lastIndexOf(":");
  if (separator <= 0) return null;
  const updatedAt = value.slice(0, separator);
  const id = Number(value.slice(separator + 1));
  return updatedAt && Number.isInteger(id) && id > 0 ? { updatedAt, id } : null;
}

function identityKey(value: unknown) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseArray(value: unknown): unknown[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function captureDetails(payload: unknown) {
  try {
    const parsed = JSON.parse(String(payload || "{}"));
    const issueNumber = Number(parsed.githubIssueNumber ?? parsed.issueId);
    return {
      issueNumber: Number.isInteger(issueNumber) && issueNumber > 0 ? issueNumber : null,
      captureId: typeof parsed.captureId === "string" ? parsed.captureId : null,
      description: typeof parsed.description === "string" ? parsed.description : null,
      submittedBy: typeof parsed.reporter === "string" ? parsed.reporter : null,
      screenshotUrl: typeof parsed.screenshotUrl === "string" ? parsed.screenshotUrl : null,
      siteName: typeof parsed.siteName === "string" ? parsed.siteName : null,
      issueType: typeof parsed.issueType === "string" ? parsed.issueType : null,
      shareUrl: typeof parsed.shareUrl === "string" ? parsed.shareUrl : null,
    };
  } catch {
    return {
      issueNumber: null,
      captureId: null,
      description: null,
      submittedBy: null,
      screenshotUrl: null,
      siteName: null,
      issueType: null,
      shareUrl: null,
    };
  }
}

function issueBodyDetails(value: unknown) {
  const body = typeof value === "string" ? value : "";
  const image = body.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
  const captureAt = body.search(/^###\s+Capture\s*$/im);
  const endpoints = [image?.index, captureAt].filter((index): index is number => typeof index === "number" && index >= 0);
  const description = body.slice(0, endpoints.length ? Math.min(...endpoints) : body.length).trim() || null;
  const fields = new Map<string, string>();
  for (const match of body.matchAll(/^- \*\*([^*]+):\*\*\s*(.+)$/gm)) fields.set(match[1].trim().toLowerCase(), match[2].trim());
  const contextSections: Array<{ title: string; value: unknown }> = [];
  for (const match of body.matchAll(/<details><summary>([^<]+)<\/summary>\s*```json\s*([\s\S]*?)```\s*<\/details>/gi)) {
    try { contextSections.push({ title: match[1].trim(), value: JSON.parse(match[2]) }); } catch { /* Ignore malformed legacy context. */ }
  }
  return {
    description,
    screenshotUrl: image?.[1] ?? null,
    siteName: fields.get("site") ?? null,
    environment: fields.get("environment") ?? null,
    submittedBy: fields.get("reporter")?.replace(/^@/, "") ?? null,
    contextSections,
  };
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, orgLogin, projectId } = getCtx(context) as Ctx["data"];
  const db = getNoxDb(context.env);
  const url = new URL(context.request?.url ?? "https://nox.invalid/api/v1/spots/project-overview");
  const requestedLimit = Number(url.searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const pageSize = Number.isInteger(requestedLimit)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, requestedLimit))
    : DEFAULT_PAGE_SIZE;
  const requestedView = url.searchParams.get("view");
  const view = requestedView === "resolved" || requestedView === "open" ? requestedView : null;
  const cursor = parseCursor(url.searchParams.get("before"));
  const project = projectId ? await db.prepare(
    `SELECT id, name, repo FROM projects
      WHERE id = ? AND org_id = ? AND COALESCE(archived, 0) = 0`,
  ).bind(projectId, orgId).first<{ id: string; name: string; repo: string }>() : null;
  if (projectId && !project) return errorResponse("Project not found", 404);
  const projectRepositories = projectId ? await getActiveRepoNames(db, orgId, orgLogin, projectId) : [];
  const repositoryFilter = projectId
    ? projectRepositories.length > 0 ? ` AND repo IN (${projectRepositories.map(() => "?").join(",")})` : " AND 0"
    : "";
  const projectBinds = projectId ? [orgId, ...projectRepositories] : [orgId];
  const issueState = view === "resolved" ? "closed" : view === "open" ? "open" : null;
  const stateFilter = issueState ? " AND state = ?" : "";
  const cursorFilter = cursor ? " AND (updated_at < ? OR (updated_at = ? AND id < ?))" : "";
  const issueBinds = [...projectBinds, ...(issueState ? [issueState] : []), ...(cursor ? [cursor.updatedAt, cursor.updatedAt, cursor.id] : []), pageSize + 1];

  const [issues, captures, reports, activities, actors] = await db.batch([
    db.prepare(
      `SELECT id, repo, number, title, body, state, author, author_avatar, created_at, updated_at, closed_at,
              html_url, assignees_json, labels_json
         FROM issues
        WHERE org_id = ?${repositoryFilter}${stateFilter}${cursorFilter}
        ORDER BY updated_at DESC, id DESC LIMIT ?`,
    ).bind(...issueBinds),
    db.prepare(
      `SELECT repo, payload_json FROM events
        WHERE org_id = ?${repositoryFilter} AND type = 'spot:issue_created'
        ORDER BY created_at DESC LIMIT 1000`,
    ).bind(...projectBinds),
    db.prepare(
      `SELECT id, repo, issue_number, status, resolution_summary, resolved_at, resolved_by,
              notification_consent, notification_status, notification_last_error,
              notification_attempts, last_notified_at
         FROM spot_reports
        WHERE org_id = ?${repositoryFilter}
        ORDER BY updated_at DESC LIMIT 1000`,
    ).bind(...projectBinds),
    db.prepare(
      `SELECT activity.report_id, activity.kind, activity.actor, activity.summary, activity.created_at
         FROM spot_report_activity activity
         JOIN spot_reports report ON report.id = activity.report_id
        WHERE report.org_id = ?${projectId
          ? projectRepositories.length > 0 ? ` AND report.repo IN (${projectRepositories.map(() => "?").join(",")})` : " AND 0"
          : ""}
        ORDER BY activity.created_at DESC LIMIT 2000`,
    ).bind(...projectBinds),
    db.prepare(
      `SELECT actor.name, actor.avatar_url, user.login, user.name AS github_name, user.avatar_url AS github_avatar,
              EXISTS(SELECT 1 FROM gh_members member JOIN orgs org ON org.installation_id = member.installation_id
                      WHERE member.gh_user_id = user.id AND org.id = ?) AS is_member
         FROM actors actor
         LEFT JOIN gh_users user ON CAST(user.id AS TEXT) = actor.github_user_id
        WHERE actor.owner_id = ? AND actor.kind = 'human'`,
    ).bind(orgId, orgLogin),
  ]);

  const orgKey = identityKey(orgLogin);
  const internalByName = new Map<string, { login: string; name: string; avatarUrl: string | null }>();
  for (const row of actors.results ?? []) {
    const actor = row as Record<string, unknown>;
    const login = String(actor.login || actor.name || "");
    const name = String(actor.github_name || actor.name || login);
    const avatarUrl = actor.avatar_url ? String(actor.avatar_url) : actor.github_avatar ? String(actor.github_avatar) : null;
    if (!login) continue;
    const loginKey = identityKey(login);
    const organizationLogin = orgKey && loginKey.endsWith(orgKey) && loginKey.length > orgKey.length;
    if (actor.is_member !== 1 && !organizationLogin) continue;
    const identity = { login, name, avatarUrl };
    for (const candidate of [login, name, actor.name]) {
      const key = identityKey(candidate);
      if (key) internalByName.set(key, identity);
      if (orgKey && key.endsWith(orgKey) && key.length > orgKey.length) internalByName.set(key.slice(0, -orgKey.length), identity);
    }
  }

  const keyFor = (repo: unknown, number: unknown) => `${String(repo)}#${Number(number)}`;
  const details = new Map<string, ReturnType<typeof captureDetails>>();
  for (const row of captures.results ?? []) {
    const event = row as Record<string, unknown>;
    const capture = captureDetails(event.payload_json);
    const key = keyFor(event.repo, capture.issueNumber);
    if (capture.issueNumber && !details.has(key)) details.set(key, capture);
  }
  const reportByIssue = new Map<string, Record<string, unknown>>();
  for (const row of reports.results ?? []) {
    const report = row as Record<string, unknown>;
    reportByIssue.set(keyFor(report.repo, report.issue_number), report);
  }
  const activityByReport = new Map<string, Array<Record<string, unknown>>>();
  for (const row of activities.results ?? []) {
    const activity = row as Record<string, unknown>;
    const reportId = String(activity.report_id);
    const entries = activityByReport.get(reportId) ?? [];
    entries.push({
      kind: activity.kind,
      actor: activity.actor,
      summary: activity.summary,
      createdAt: activity.created_at,
    });
    activityByReport.set(reportId, entries);
  }
  const issueRows = (issues.results ?? []).slice(0, pageSize);
  const mappedIssues = issueRows.map((row) => {
    const issue = row as Record<string, unknown>;
    const issueKey = keyFor(issue.repo, issue.number);
    const detail = details.get(issueKey);
    const bodyDetail = issueBodyDetails(issue.body);
    const report = reportByIssue.get(issueKey);
    const labels = parseArray(issue.labels_json);
    const isNoxSpot = Boolean(report || detail || labels.some((label) => {
      if (!label || typeof label !== "object" || !("name" in label)) return false;
      return String((label as { name?: unknown }).name).toLowerCase() === "noxspot";
    }));
    const reportId = report?.id ? String(report.id) : detail?.captureId ?? null;
    const submittedBy = detail?.submittedBy ?? bodyDetail.submittedBy;
    const internalReporter = submittedBy ? internalByName.get(identityKey(submittedBy)) ?? null : null;
    return {
      id: reportId,
      repo: String(issue.repo),
      number: Number(issue.number),
      title: String(issue.title),
      state: String(issue.state),
      author: issue.author ? { login: String(issue.author), avatarUrl: issue.author_avatar ? String(issue.author_avatar) : null } : null,
      assignees: parseArray(issue.assignees_json),
      labels,
      source: isNoxSpot ? "noxspot" : "github",
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at,
      url: issue.html_url,
      description: detail?.description ?? bodyDetail.description,
      submittedBy,
      internalReporter,
      screenshotUrl: detail?.screenshotUrl ?? bodyDetail.screenshotUrl,
      siteName: detail?.siteName ?? bodyDetail.siteName,
      environment: bodyDetail.environment,
      contextSections: bodyDetail.contextSections,
      issueType: detail?.issueType ?? null,
      shareUrl: detail?.shareUrl ?? (issue.html_url ? String(issue.html_url) : null),
      reportStatus: issue.state === "closed" ? "resolved" : String(report?.status ?? "open"),
      resolutionSummary: report?.resolution_summary ?? null,
      resolvedAt: report?.resolved_at ?? issue.closed_at ?? null,
      resolvedBy: report?.resolved_by ?? null,
      notification: report ? {
        eligible: report.notification_consent === 1,
        status: report.notification_status,
        attempts: Number(report.notification_attempts ?? 0),
        lastError: report.notification_last_error ?? null,
        lastNotifiedAt: report.last_notified_at ?? null,
      } : { eligible: false, status: "not_requested", attempts: 0, lastError: null, lastNotifiedAt: null },
      activity: reportId ? activityByReport.get(reportId) ?? [] : [],
    };
  });
  const countStatus = (status: string) => mappedIssues.filter((issue) => issue.reportStatus === status).length;
  const lastIssue = issueRows.at(-1) as Record<string, unknown> | undefined;
  const nextCursor = (issues.results?.length ?? 0) > pageSize && lastIssue
    ? `${String(lastIssue.updated_at)}:${Number(lastIssue.id)}`
    : null;
  return jsonResponse({
    project: project ? { id: project.id, name: project.name, repo: project.repo, repositories: projectRepositories } : null,
    counts: {
      open: countStatus("open"),
      investigating: countStatus("investigating"),
      resolved: countStatus("resolved"),
      closed: mappedIssues.filter((issue) => issue.state === "closed").length,
    },
    issues: mappedIssues,
    nextCursor,
  });
}
