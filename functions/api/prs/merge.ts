import { z } from "zod";
import { getCtx, jsonResponse, errorResponse } from "../../lib/db";
import { getInstallationIdForOrg, getInstallationToken } from "../../lib/github-app";
import { validate } from "../../lib/validate";

interface Env {
  DB: D1Database;
  CONNECTIONS?: { getGitHubInstallationToken(installationId: number): Promise<string> };
}

interface Ctx {
  env: Env;
  data: { orgId: number; orgLogin: string; isAdmin: boolean };
  request: Request;
}

const MergeBody = z.object({
  repo: z.string().regex(/^[\w.-]+$/, "Invalid repo name").max(100),
  number: z.number().int().positive(),
  method: z.enum(["merge", "squash", "rebase"]).default("squash"),
});

// POST /api/v1/prs/merge — merge a PR through the organization GitHub App.
// GitHub remains the source of truth for required reviews, checks, rulesets,
// merge queues, conflicts, and whether the selected merge method is allowed.
export async function onRequestPost(context: Ctx): Promise<Response> {
  const { orgId, orgLogin, isAdmin } = getCtx(context) as {
    orgId: number;
    orgLogin: string;
    isAdmin: boolean;
  };
  if (!orgLogin) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);

  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const parsed = validate(MergeBody, rawBody);
  if (!parsed.ok) return parsed.response;
  const { repo, number, method } = parsed.data;

  const installationId = await getInstallationIdForOrg(context.env.DB, orgId);
  if (!installationId) return errorResponse("GitHub App not installed for this org", 412);

  let token: string;
  try {
    token = await getInstallationToken(context.env, installationId);
  } catch (error) {
    console.error("[prs/merge] install token fetch failed", { msg: (error as Error)?.message });
    return errorResponse("Failed to acquire GitHub App token", 500);
  }

  const root = `https://api.github.com/repos/${encodeURIComponent(orgLogin)}/${encodeURIComponent(repo)}/pulls/${number}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "NoxHere",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Read the current head immediately before merging and pass it back as a
  // precondition. A push racing the confirmation dialog must fail safely.
  const pullResponse = await fetch(root, { headers });
  const pull = await pullResponse.json().catch(() => ({})) as {
    message?: string;
    state?: string;
    merged?: boolean;
    head?: { sha?: string };
  };
  if (!pullResponse.ok) {
    return errorResponse(pull.message || `GitHub API error: ${pullResponse.status}`, pullResponse.status);
  }
  if (pull.merged) return errorResponse("Pull request is already merged", 409);
  if (pull.state !== "open") return errorResponse("Pull request is not open", 409);
  if (!pull.head?.sha) return errorResponse("GitHub did not return the pull request head revision", 502);

  const mergeResponse = await fetch(`${root}/merge`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ merge_method: method, sha: pull.head.sha }),
  });
  const result = await mergeResponse.json().catch(() => ({})) as {
    message?: string;
    merged?: boolean;
    sha?: string;
  };
  if (!mergeResponse.ok || result.merged !== true) {
    const status = mergeResponse.ok ? 409 : mergeResponse.status;
    return errorResponse(result.message || "GitHub did not merge the pull request", status);
  }

  await context.env.DB.prepare(
    `UPDATE pull_requests
        SET state = 'closed', merged_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE org_id = ? AND repo = ? AND number = ?`,
  ).bind(orgId, repo, number).run();

  return jsonResponse({ ok: true, repo, number, state: "merged", method, sha: result.sha ?? null });
}
