import { getInstallationToken, signAppJwt } from "../../../functions/lib/github-app.js";

interface GitHubInstallationEnvironment {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  DB: D1Database;
}

interface GitHubInstallation {
  id: number;
  account: { login: string; type?: string };
}

export async function discoverGitHubInstallation(
  env: GitHubInstallationEnvironment,
  ownerId: unknown,
): Promise<GitHubInstallation | null> {
  if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 255) {
    throw new Error("invalid_github_owner");
  }
  const jwt = await signAppJwt(env);
  const headers = {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "NoxHere",
  };
  for (const path of [
    `/orgs/${encodeURIComponent(ownerId)}/installation`,
    `/users/${encodeURIComponent(ownerId)}/installation`,
  ]) {
    const response = await fetch(`https://api.github.com${path}`, { headers });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`github_installation_discovery_${response.status}`);
    const data = await response.json<Record<string, unknown>>();
    const account = data.account as Record<string, unknown> | undefined;
    if (!Number.isInteger(data.id) || typeof account?.login !== "string") {
      throw new Error("github_installation_response_invalid");
    }
    return {
      id: Number(data.id),
      account: {
        login: account.login,
        ...(typeof account.type === "string" ? { type: account.type } : {}),
      },
    };
  }
  return null;
}

export async function listGitHubInstallationRepositories(
  env: GitHubInstallationEnvironment,
  installationId: unknown,
): Promise<string[]> {
  if (!Number.isInteger(installationId) || Number(installationId) <= 0) {
    throw new Error("invalid_github_installation");
  }
  const token = await getInstallationToken(env, Number(installationId));
  const repositories: string[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "NoxHere",
        },
      },
    );
    if (!response.ok) throw new Error(`github_installation_repositories_${response.status}`);
    const data = await response.json<{ repositories?: Array<{ full_name?: string }> }>();
    const pageRepositories = Array.isArray(data.repositories) ? data.repositories : [];
    for (const repository of pageRepositories) {
      if (typeof repository.full_name === "string") repositories.push(repository.full_name);
    }
    if (pageRepositories.length < 100) break;
  }
  return repositories;
}
