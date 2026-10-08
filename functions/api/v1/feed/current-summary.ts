import { getCtx, jsonResponse } from "../../../lib/db";
import { getActiveRepoNames } from "../../../lib/inactive-repos";

interface Ctx {
  env: { DB: D1Database };
  data: { orgId: number; orgLogin: string; projectId?: string | null };
}

interface MemberRow {
  login: string;
  avatar_url: string;
  kind: string;
}

interface PullRequestRow { id: number; repo: string; number: number; title: string; state: string; author: string; author_avatar: string | null; draft: number; html_url: string; updated_at: string }
interface IssueRow { id: number; repo: string; number: number; title: string; state: string; assignees_json: string; html_url: string; updated_at: string }

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, orgLogin, projectId } = getCtx(context);
  const activeRepos = await getActiveRepoNames(context.env.DB, orgId, orgLogin, projectId);
  const settingsRow = await context.env.DB.prepare(projectId
    ? "SELECT data FROM project_config WHERE org_id = ? AND project_id = ? AND key = 'settings'"
    : "SELECT data FROM config WHERE org_id = ? AND key = 'settings'")
    .bind(...(projectId ? [orgId, projectId] : [orgId]))
    .first<{ data?: string }>();
  let excludedMembers: string[] = [];
  try {
    const settings = settingsRow?.data ? JSON.parse(settingsRow.data) as { excludedMembers?: unknown } : null;
    if (Array.isArray(settings?.excludedMembers)) {
      excludedMembers = settings.excludedMembers.filter((value): value is string => typeof value === "string");
    }
  } catch { /* The config endpoint reports corrupt rows; keep this read surface available. */ }

  const repoSql = activeRepos.length ? `repo IN (${activeRepos.map(() => "?").join(",")})` : "0";
  const [members, pullRequests, issues] = await context.env.DB.batch([
    context.env.DB.prepare(
      "SELECT login, avatar_url, kind FROM members WHERE org_id = ? AND kind != 'bot' ORDER BY login",
    ).bind(orgId),
    context.env.DB.prepare(
      `SELECT id, repo, number, title, state, author, author_avatar, draft, html_url, updated_at
         FROM pull_requests WHERE org_id = ? AND state = 'open' AND ${repoSql}
        ORDER BY updated_at DESC`,
    ).bind(orgId, ...activeRepos),
    context.env.DB.prepare(
      `SELECT id, repo, number, title, state, assignees_json, html_url, updated_at
         FROM issues issue WHERE issue.org_id = ? AND issue.state = 'open' AND ${activeRepos.length ? `issue.repo IN (${activeRepos.map(() => "?").join(",")})` : "0"}
        ORDER BY updated_at DESC`,
    ).bind(orgId, ...activeRepos),
  ]);
  const excluded = new Set(excludedMembers.map((login) => login.toLowerCase()));
  const memberRows = (members.results as MemberRow[])
    .filter((member) => !excluded.has(member.login.toLowerCase()))
    .map((member) => ({ login: member.login, avatar_url: member.avatar_url, kind: member.kind === "bot" ? "bot" : "human" }));
  const prs = (pullRequests.results as PullRequestRow[]).map((row) => ({ ...row, draft: row.draft === 1 }));
  const issueRows = (issues.results as IssueRow[]).map((row) => ({ ...row, assignees: JSON.parse(row.assignees_json || "[]") }));
  const people = memberRows.map((member) => ({
    member,
    counts: {
      prs: prs.filter((item) => item.author.toLowerCase() === member.login.toLowerCase()).length,
      issues: issueRows.filter((item) => item.assignees.some((assignee: { login?: string }) => assignee.login?.toLowerCase() === member.login.toLowerCase())).length,
    },
  }));
  return jsonResponse({ people, members: memberRows, prs, issues: issueRows, excludedMembers });
}
