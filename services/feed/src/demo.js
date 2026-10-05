const DEMO_LOGIN = "reviewer-demo";
const DEMO_ORG = "NoxFeed-Demo";
const SESSION_TTL_SECONDS = 24 * 60 * 60;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function handleDemoRequest(request, db) {
  const url = new URL(request.url);
  // The native client uses NoxConnect's canonical versioned contract. Keep
  // the isolated demo transport compatible without duplicating handlers.
  if (url.pathname.startsWith("/api/v1/")) {
    url.pathname = url.pathname.replace(/^\/api\/v1\//, "/api/");
  }

  if (url.pathname === "/api/demo/session") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    return createSession(db);
  }

  const authorized = await authorize(request, db);
  if (!authorized) return json({ error: "invalid_demo_session" }, 401);

  if (request.method !== "GET") {
    return json({
      error: "demo_read_only",
      message: "This action is disabled in the read-only NoxFeed demo.",
    }, 403);
  }

  if (url.pathname === "/api/auth/profile") {
    const user = { login: DEMO_LOGIN, name: "NoxFeed Reviewer", avatar_url: null };
    const orgs = [{ id: 1, login: DEMO_ORG, avatar_url: null }];
    const scope = url.searchParams.get("scope");
    return json(scope === "user" ? { user } : scope === "orgs" ? { orgs } : { user, orgs });
  }
  if (url.pathname === "/api/integrations/status") {
    return json({ github: { connected: true, bootstrapping: false } });
  }
  if (url.pathname === "/api/me") {
    return json({ login: DEMO_LOGIN, org: DEMO_ORG, isAdmin: true });
  }
  if (url.pathname === "/api/actors") return listActors(db);
  if (url.pathname === "/api/projects") return listProjects(db);
  if (url.pathname === "/api/members") return listMembers(db);
  if (url.pathname === "/api/engineer-stats") return engineerStats(db);
  if (url.pathname === "/api/search") return globalSearch(db, url);
  if (url.pathname === "/api/config/settings") return json({ excludedMembers: [] });
  if (url.pathname === "/api/events") return listEvents(db, url);
  if (url.pathname === "/api/prs") return listPullRequests(db, url);
  if (url.pathname === "/api/issues") return listIssues(db, url);

  const prMatch = url.pathname.match(/^\/api\/prs\/([^/]+)\/(\d+)$/);
  if (prMatch) return getPullRequest(db, decodeURIComponent(prMatch[1]), Number(prMatch[2]));

  return json({ error: "not_found" }, 404);
}

async function createSession(db) {
  await db.prepare("DELETE FROM demo_sessions WHERE expires_at <= unixepoch()").run();
  await db.prepare(
    "DELETE FROM demo_sessions WHERE token_hash IN (SELECT token_hash FROM demo_sessions ORDER BY created_at DESC LIMIT -1 OFFSET 4999)",
  ).run();
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await sha256(token);
  await db.prepare(
    "INSERT INTO demo_sessions (token_hash, expires_at) VALUES (?, unixepoch() + ?)",
  ).bind(tokenHash, SESSION_TTL_SECONDS).run();
  return json({
    access_token: token,
    expires_in: SESSION_TTL_SECONDS,
    account: { login: DEMO_LOGIN, name: "NoxFeed Reviewer", avatar_url: null },
    organization: { id: 1, login: DEMO_ORG, avatar_url: null },
    mode: "demo",
    read_only: true,
  });
}

async function authorize(request, db) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (token.length < 40 || token.length > 200) return false;
  const row = await db.prepare(
    "SELECT 1 AS valid FROM demo_sessions WHERE token_hash = ? AND expires_at > unixepoch()",
  ).bind(await sha256(token)).first();
  return row?.valid === 1;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function listActors(db) {
  const { results } = await db.prepare(
    "SELECT id, name, github_login, avatar_url, kind FROM actors ORDER BY name",
  ).all();
  return json({ actors: results });
}

async function listProjects(db) {
  const { results } = await db.prepare(
    "SELECT id, name, slug, org, repo, archived FROM projects ORDER BY name",
  ).all();
  return json({ projects: results });
}

async function listMembers(db) {
  const { results } = await db.prepare(
    "SELECT login, avatar_url, kind FROM members ORDER BY sort_order, login",
  ).all();
  return json(results);
}

async function engineerStats(db) {
  const [prs, issues] = await db.batch([
    db.prepare("SELECT author, draft, requested_reviewers_json FROM pull_requests WHERE state = 'open'"),
    db.prepare("SELECT assignees_json FROM issues WHERE state = 'open'"),
  ]);
  const openPRs = {};
  const openNonDraftPRs = {};
  const reviewing = {};
  const assignedIssues = {};
  for (const row of prs.results ?? []) {
    openPRs[row.author] = (openPRs[row.author] ?? 0) + 1;
    if (!row.draft) openNonDraftPRs[row.author] = (openNonDraftPRs[row.author] ?? 0) + 1;
    for (const reviewer of parseArray(row.requested_reviewers_json)) {
      const login = typeof reviewer === "string" ? reviewer : reviewer?.login;
      if (login) reviewing[login] = (reviewing[login] ?? 0) + 1;
    }
  }
  for (const row of issues.results ?? []) {
    for (const login of parseArray(row.assignees_json)) {
      if (typeof login === "string") assignedIssues[login] = (assignedIssues[login] ?? 0) + 1;
    }
  }
  return json({ openPRs, openNonDraftPRs, reviewing, assignedIssues });
}

async function globalSearch(db, url) {
  const query = (url.searchParams.get("q") || "").trim();
  if (!query || query.length > 200) return json({ error: "invalid_query" }, 400);
  const needle = query.toLowerCase().replace(/^@/, "");
  const like = `%${escapeLike(needle)}%`;
  const exactNumber = /^#?\d+$/.test(needle) ? Number(needle.replace(/^#/, "")) : null;
  const [people, prs, issues, events] = await db.batch([
    db.prepare("SELECT login, avatar_url FROM members WHERE kind != 'bot' AND LOWER(login) LIKE ? ESCAPE '\\' LIMIT 12").bind(like),
    db.prepare("SELECT * FROM pull_requests WHERE LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(author) LIKE ? ESCAPE '\\' OR LOWER(repo) LIKE ? ESCAPE '\\' OR number = ? LIMIT 16").bind(like, like, like, exactNumber ?? -1),
    db.prepare("SELECT * FROM issues WHERE LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(author) LIKE ? ESCAPE '\\' OR LOWER(repo) LIKE ? ESCAPE '\\' OR number = ? LIMIT 16").bind(like, like, like, exactNumber ?? -1),
    db.prepare("SELECT * FROM events WHERE type IN ('narrative', 'release_notes') AND (LOWER(summary) LIKE ? ESCAPE '\\' OR LOWER(repo) LIKE ? ESCAPE '\\') LIMIT 16").bind(like, like),
  ]);
  const results = [];
  for (const row of people.results ?? []) results.push(searchResult("person", `person:${row.login}`, `@${row.login}`, "Person", row, needle, exactNumber));
  for (const row of prs.results ?? []) results.push(searchResult("pull_request", `pr:${row.id}`, row.title, `${row.repo} #${row.number} · ${row.author}`, row, needle, exactNumber));
  for (const row of issues.results ?? []) results.push(searchResult("issue", `issue:${row.id}`, row.title, `${row.repo} #${row.number} · ${row.author}`, row, needle, exactNumber));
  for (const row of events.results ?? []) {
    const kind = row.type === "release_notes" ? "release_note" : "post";
    results.push(searchResult(kind, `${kind}:${row.id}`, row.summary, `${row.repo}${row.pr_number ? ` #${row.pr_number}` : ""}`, row, needle, exactNumber));
  }
  results.sort((a, b) => b.score - a.score);
  const limit = Math.min(60, Math.max(1, positiveInt(url.searchParams.get("limit")) || 40));
  return json({ query, results: results.slice(0, limit) });
}

function searchResult(kind, id, title, subtitle, row, needle, exactNumber) {
  const normalized = title.toLowerCase().replace(/^@/, "");
  let score = { person: 30, pull_request: 24, issue: 20, post: 12, release_note: 12 }[kind] ?? 0;
  if (exactNumber != null && (row.number === exactNumber || row.pr_number === exactNumber)) score += 1000;
  if (normalized === needle) score += 500;
  else if (normalized.startsWith(needle)) score += 260;
  else if (normalized.includes(needle)) score += 130;
  return {
    id, kind, title, subtitle,
    repo: row.repo ?? null,
    number: row.number ?? row.pr_number ?? null,
    state: row.state ?? null,
    url: row.html_url ?? null,
    avatarUrl: row.avatar_url ?? row.author_avatar ?? null,
    login: kind === "person" ? row.login : row.author ?? null,
    createdAt: row.updated_age_seconds == null && row.age_seconds == null ? null : relativeISO(row.updated_age_seconds ?? row.age_seconds),
    score,
  };
}

async function listEvents(db, url) {
  const conditions = [];
  const bindings = [];
  const type = url.searchParams.get("type");
  const repo = url.searchParams.get("repo");
  const prNumber = positiveInt(url.searchParams.get("pr_number"));
  const actorId = url.searchParams.get("actor_id");
  const projectId = url.searchParams.get("project_id");
  const before = positiveInt(url.searchParams.get("before"));
  const requestedLimit = Math.min(positiveInt(url.searchParams.get("limit")) || 50, 200);
  // Keep feed pages compact enough for the menu-bar UI while allowing the
  // larger, N1-shaped fixture to feel like a real workspace. PR timelines and
  // notification polling remain uncapped because they omit the feed query.
  const limit = type ? Math.min(requestedLimit, 8) : requestedLimit;

  if (type) { conditions.push("feed_mode = ?"); bindings.push(type); }
  if (repo) { conditions.push("repo = ?"); bindings.push(repo); }
  if (prNumber) { conditions.push("pr_number = ?"); bindings.push(prNumber); }
  if (actorId) { conditions.push("actor_id = ?"); bindings.push(actorId); }
  if (projectId) { conditions.push("project_id = ?"); bindings.push(projectId); }
  if (before) { conditions.push("id < ?"); bindings.push(before); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const statement = db.prepare(
    `SELECT id, type, source, actor_id, project_id, org, repo, summary, age_seconds, payload_json
     FROM events ${where} ORDER BY id DESC LIMIT ?`,
  ).bind(...bindings, limit + 1);
  const { results } = await statement.all();
  const hasMore = results.length > limit;
  const page = results.slice(0, limit).map(eventWire);
  return json({ events: page, nextCursor: hasMore ? String(page.at(-1)?.id) : null });
}

async function listPullRequests(db, url) {
  const conditions = [];
  const bindings = [];
  const state = url.searchParams.get("state");
  const author = url.searchParams.get("author");
  if (state) { conditions.push("state = ?"); bindings.push(state); }
  if (author) { conditions.push("author = ?"); bindings.push(author); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await db.prepare(
    `SELECT * FROM pull_requests ${where} ORDER BY updated_age_seconds ASC`,
  ).bind(...bindings).all();
  return json({ data: results.map(prWire), totalCount: results.length, page: 1, pageSize: results.length });
}

async function getPullRequest(db, repo, number) {
  const row = await db.prepare(
    "SELECT * FROM pull_requests WHERE repo = ? AND number = ?",
  ).bind(repo, number).first();
  return row ? json({ pr: prWire(row) }) : json({ error: "not_found" }, 404);
}

async function listIssues(db, url) {
  const state = url.searchParams.get("state");
  const assignee = url.searchParams.get("assignee");
  const repos = url.searchParams.get("repos");
  const conditions = [];
  const bindings = [];
  if (state) { conditions.push("state = ?"); bindings.push(state); }
  if (assignee) { conditions.push("assignees_json LIKE ?"); bindings.push(`%\"${escapeLike(assignee)}\"%`); }
  if (repos) {
    const requested = repos.split(",").map((repo) => repo.trim()).filter(Boolean);
    if (requested.length) {
      conditions.push(`repo IN (${requested.map(() => "?").join(",")})`);
      bindings.push(...requested);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await db.prepare(
    `SELECT * FROM issues ${where} ORDER BY updated_age_seconds ASC`,
  ).bind(...bindings).all();
  return json({ data: results.map(issueWire), totalCount: results.length, page: 1, pageSize: results.length });
}

function eventWire(row) {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    actor_id: row.actor_id,
    project_id: row.project_id,
    org: row.org,
    repo: row.repo,
    summary: row.summary,
    created_at: relativeISO(row.age_seconds),
    payload_json: row.payload_json,
  };
}

function prWire(row) {
  return {
    id: row.id,
    repo: row.repo,
    number: row.number,
    title: row.title,
    state: row.state,
    author: row.author,
    author_avatar: row.author_avatar,
    draft: Boolean(row.draft),
    head_ref: row.head_ref,
    created_at: relativeISO(row.created_age_seconds),
    updated_at: relativeISO(row.updated_age_seconds),
    html_url: row.html_url,
    merged_at: row.merged_age_seconds == null ? null : relativeISO(row.merged_age_seconds),
    requested_reviewers: parseArray(row.requested_reviewers_json),
  };
}

function issueWire(row) {
  const assignees = parseArray(row.assignees_json).map((assignee) =>
    typeof assignee === "string" ? { login: assignee, avatar_url: null } : assignee,
  );
  const labels = parseArray(row.labels_json).map((label) =>
    typeof label === "string" ? { name: label, color: null } : label,
  );
  return {
    id: row.id,
    repo: row.repo,
    number: row.number,
    title: row.title,
    state: row.state,
    author: row.author,
    author_avatar: row.author_avatar,
    created_at: relativeISO(row.created_age_seconds),
    updated_at: relativeISO(row.updated_age_seconds),
    closed_at: null,
    html_url: row.html_url,
    assignees,
    labels,
  };
}

function relativeISO(ageSeconds) {
  return new Date(Date.now() - Number(ageSeconds || 0) * 1000).toISOString();
}

function parseArray(value) {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function positiveInt(value) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function escapeLike(value) {
  return String(value).replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const demoConstants = { login: DEMO_LOGIN, org: DEMO_ORG };
