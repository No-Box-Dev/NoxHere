import type { TransportCommand } from "../../../shared/transport-commands";
import { getInstallationIdForOrg, getInstallationToken } from "../github-app.js";
import { upsertIssue } from "../github-sync.js";
import { createRepositoryIssue, createRepositoryIssueComment, ensureRepositoryLabels, findIssueByBodyMarker, updateRepositoryIssue } from "../github-issues.js";
import { TransportExecutionError } from "../transport-outbox";

type GitHubCommand = Extract<TransportCommand, { operation: `github.${string}` }>;
interface GitHubTransportEnvironment { DB: D1Database; GITHUB_APP_ID?: string; GITHUB_APP_PRIVATE_KEY?: string }

function githubError(error: unknown): TransportExecutionError {
  const candidate = error as { status?: unknown; message?: unknown };
  const status = Number(candidate?.status ?? 0);
  const message = typeof candidate?.message === "string" ? candidate.message : "GitHub delivery failed";
  if ([401, 403, 404].includes(status)) return new TransportExecutionError(message, `github_http_${status}`, "blocked");
  if (status === 429 || status >= 500 || status === 0) return new TransportExecutionError(message, status ? `github_http_${status}` : "github_delivery_failed", "retryable");
  return new TransportExecutionError(message, `github_http_${status}`, "failed");
}

async function resolveProject(db: D1Database, command: GitHubCommand) {
  const row = await db.prepare(
    `SELECT project.repo, org.github_login AS owner_id FROM projects project
       JOIN orgs org ON org.id = project.org_id
      WHERE project.id = ? AND project.org_id = ? AND COALESCE(project.archived, 0) = 0 LIMIT 1`,
  ).bind(command.projectId, command.orgId).first<{ repo: string; owner_id: string }>();
  if (!row?.repo || !row.owner_id) throw new TransportExecutionError("GitHub destination project is unavailable", "github_project_not_found", "blocked");
  return { ownerId: row.owner_id, repo: row.repo };
}

export async function deliverGitHubTransport(env: GitHubTransportEnvironment, rawCommand: TransportCommand) {
  if (!rawCommand.operation.startsWith("github.")) throw new TransportExecutionError(`GitHub adapter cannot execute ${rawCommand.operation}`, "wrong_transport_provider", "failed");
  const command = rawCommand as GitHubCommand;
  const project = await resolveProject(env.DB, command);
  const installationId = await getInstallationIdForOrg(env.DB, command.orgId);
  if (!installationId) throw new TransportExecutionError("GitHub App is not installed for this organization", "github_not_connected", "blocked");
  try {
    const token = await getInstallationToken(env, installationId);
    if (command.operation === "github.issue.create") {
      const marker = command.input.idempotencyMarker;
      let issue = marker ? await findIssueByBodyMarker(token, project.ownerId, project.repo, marker) : null;
      if (!issue) {
        await ensureRepositoryLabels(token, project.ownerId, project.repo, command.input.issue.labels);
        const body = marker && !command.input.issue.body.includes(marker)
          ? `${command.input.issue.body}\n\n${marker}`
          : command.input.issue.body;
        issue = await createRepositoryIssue(token, project.ownerId, project.repo, {
          ...command.input.issue, body, labels: command.input.issue.labels.map((label) => label.name),
        });
      }
      await upsertIssue(env.DB, command.orgId, project.repo, issue);
      return { resourceType: "issue" as const, resourceId: String(issue.number), url: issue.html_url, state: issue.state };
    }
    if (command.operation === "github.issue.update") {
      const input = command.input.issue;
      if (input.labels) await ensureRepositoryLabels(token, project.ownerId, project.repo, input.labels);
      const issue = await updateRepositoryIssue(token, project.ownerId, project.repo, command.input.issueNumber, { ...input, labels: input.labels?.map((label) => label.name) });
      await upsertIssue(env.DB, command.orgId, project.repo, issue);
      return { resourceType: "issue" as const, resourceId: String(issue.number), url: issue.html_url, state: issue.state };
    }
    if (command.operation === "github.issue.comment") {
      const comment = await createRepositoryIssueComment(token, project.ownerId, project.repo, command.input.issueNumber, command.input.body);
      return { resourceType: "comment" as const, resourceId: String(comment.id), url: comment.html_url };
    }
    const pullRequest = await updateRepositoryIssue(token, project.ownerId, project.repo, command.input.pullRequestNumber, { state: "closed" });
    return { resourceType: "pull_request" as const, resourceId: String(pullRequest.number), url: pullRequest.html_url, state: pullRequest.state };
  } catch (error) {
    if (error instanceof TransportExecutionError) throw error;
    throw githubError(error);
  }
}
