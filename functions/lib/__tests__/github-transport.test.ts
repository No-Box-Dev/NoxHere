import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTransportCommand } from "../../../shared/transport-commands";
const provider = vi.hoisted(() => ({ installationId: vi.fn(), token: vi.fn(), labels: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), comment: vi.fn(), upsert: vi.fn() }));
vi.mock("../github-app.js", () => ({ getInstallationIdForOrg: provider.installationId, getInstallationToken: provider.token }));
vi.mock("../github-issues.js", () => ({ ensureRepositoryLabels: provider.labels, findIssueByBodyMarker: provider.find, createRepositoryIssue: provider.create, updateRepositoryIssue: provider.update, createRepositoryIssueComment: provider.comment }));
vi.mock("../github-sync.js", () => ({ upsertIssue: provider.upsert }));
import { deliverGitHubTransport } from "../transports/github";

function db() {
  return { prepare: () => { const statement = { bind: () => statement, first: async () => ({ owner_id: "acme", repo: "checkout" }) }; return statement; } } as unknown as D1Database;
}
function command(operation: string, input: unknown) {
  return parseTransportCommand({ contract: "platform.transport-command", version: 1, commandId: "command-1", idempotencyKey: "incident:1", orgId: 7, projectId: "project-1", route: "incidents", requestedAt: "2026-10-04T00:00:00.000Z", operation, input });
}
describe("GitHub transport adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provider.installationId.mockResolvedValue(99);
    provider.token.mockResolvedValue("installation-secret");
    provider.find.mockResolvedValue(null);
    provider.create.mockResolvedValue({ number: 42, html_url: "https://github.com/acme/checkout/issues/42", state: "open" });
    provider.update.mockResolvedValue({ number: 42, html_url: "https://github.com/acme/checkout/issues/42", state: "closed" });
    provider.comment.mockResolvedValue({ id: 501, html_url: "https://github.com/acme/checkout/issues/42#issuecomment-501" });
  });
  it("creates in the centrally resolved repository", async () => {
    const input = command("github.issue.create", { issue: { title: "Incident", body: "Details", labels: [{ name: "incident" }] } });
    await expect(deliverGitHubTransport({ DB: db() }, input)).resolves.toMatchObject({ resourceType: "issue", resourceId: "42" });
    expect(provider.create).toHaveBeenCalledWith("installation-secret", "acme", "checkout", expect.objectContaining({ labels: ["incident"] }));
    expect(provider.upsert).toHaveBeenCalled();
  });
  it("updates, comments, and closes through one adapter", async () => {
    await deliverGitHubTransport({ DB: db() }, command("github.issue.update", { issueNumber: 42, issue: { state: "closed" } }));
    await deliverGitHubTransport({ DB: db() }, command("github.issue.comment", { issueNumber: 42, body: "Recovered" }));
    await deliverGitHubTransport({ DB: db() }, command("github.pull_request.close", { pullRequestNumber: 42 }));
    expect(provider.update).toHaveBeenCalledTimes(2);
    expect(provider.comment).toHaveBeenCalledOnce();
  });
  it("blocks when the GitHub App is absent", async () => {
    provider.installationId.mockResolvedValue(null);
    await expect(deliverGitHubTransport({ DB: db() }, command("github.issue.comment", { issueNumber: 42, body: "Hi" }))).rejects.toMatchObject({ code: "github_not_connected", disposition: "blocked" });
  });
  it("classifies outages as retryable without leaking credentials", async () => {
    provider.create.mockRejectedValue(Object.assign(new Error("unavailable"), { status: 503 }));
    const error = await deliverGitHubTransport({ DB: db() }, command("github.issue.create", { issue: { title: "Incident", body: "Details", labels: [] } })).catch((cause) => cause);
    expect(error).toMatchObject({ code: "github_http_503", disposition: "retryable" });
    expect(JSON.stringify(error)).not.toContain("installation-secret");
  });
});
