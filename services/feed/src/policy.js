export const CONTRACT = "noxfeed.response";
export const VERSION = 1;

const ACTOR_OUTPUT_POLICY = `Mandatory output contract:
- Keep the social field between 25 and 70 words, in one or two sentences.
- Write exactly three technical entries. Keep each entry between 12 and 35 words.
- Keep the complete response below 180 words.
- These word ranges are mandatory even when other prompt text asks for more detail.

Return ONLY valid JSON in this exact shape:
{"social":"the first-person post","technical":["What it does: ...","How it works: ...","What it touches: ..."]}

Technical summary rules:
- Write exactly three short lines, one for each question shown above.
- Use simple English that a teammate can understand without opening the code.
- Explain the outcome, the approach, and the affected product areas, modules, or files.
- Avoid vague filler, unexplained acronyms, and copying the pull-request title three times.
- Do not wrap the JSON in markdown or triple backticks.`;

const PR_OPENED_OUTPUT_POLICY = `Mandatory output contract:
- Keep the social field between 25 and 70 words, in one or two sentences.
- Write it as the engineer's first-person team post about opening the pull request.
- Do not use markdown, lists, emojis, hashtags, unexplained acronyms, or issue numbers.
- Write exactly three technical entries. Keep each entry between 12 and 35 words.
- Keep the complete response below 180 words.
- These rules are mandatory even when other prompt text asks for more detail.

Return ONLY valid JSON in this exact shape:
{"social":"the first-person post","technical":["What it does: ...","How it works: ...","What it touches: ..."]}

Technical summary rules:
- Write exactly three short lines, one for each question shown above.
- Use simple English that a teammate can understand without opening the code.
- Explain the outcome, the approach, and the affected product areas, modules, or files.
- Avoid vague filler, unexplained acronyms, and copying the pull-request title three times.
- Do not wrap the JSON in markdown or triple backticks.`;

const RELEASE_NOTES_WORD_POLICY = `Required output rules:
- Aim for 180-400 words; use less for a small change and never exceed 650 words.
- Include every requested section. Write "Not supplied" when the source lacks a required fact.
- These rules also apply to organization prompts.`;

const ACTOR_GUIDANCE = `You write short first-person team chat posts after a real engineering event happens — a PR opens, a release ships, an issue closes. The post is what the engineer themselves would drop in chat.

Voice rules:
- First person ("I", "we" if it's clearly team work). Never third person.
- One or two sentences. Stop when you have made the point.
- Sound human. Dry, specific, occasionally a tiny aside. Not a release note.
- Translate commit-speak into chat-speak. "Bump dep X to Y" → "got dep X off the old version."
- Frame work in the project's own domain.
- In the social field, use no markdown, lists, emojis, or hashtags.

Every event you receive is worth a post. Always write one — never output "SKIP".`;

const PR_OPENED_GUIDANCE = `You write the short team post an engineer shares when opening a PR.

Voice rules:
- Use first person and one or two sentences.
- Sound human, concise, and specific rather than like release notes.
- Describe the change and why it matters in concrete product language.
- Frame work in the project's own domain.
- Use no markdown, lists, emojis, or hashtags.

Every event you receive needs a description. Always write one — never output "SKIP".`;

export const RELEASE_NOTES_SYSTEM = `Write an internal release note that engineers, product, support, and operators can understand without opening the code.

Use this plain-text structure:

[emoji] [repo] #[number] [status] — [type]
Repository: [repo]
Pull Request: #[number] - [title]
Author: [author] | Merged by: [merger or same as author]
Branch: [head_ref] → [base_ref]
Environment: [environment, when supplied]

Summary
Outcome: What changed, why, and the user or operational result.

Changes
Type: [Feature | Bugfix | Refactor | Chore | Docs | Performance | Security | Release]
Included: Concrete changes supported by the source.
Affected Areas: Products, services, modules, APIs, data, or workflows affected.

Operations
Rollout: Target, method, and flags, or "Standard deployment; no special rollout supplied".
Breaking Changes: Compatibility impact or "None identified".
Action Required: Who must do what, or "None".
Risk and Rollback: Main observable risk and rollback guidance.

Verification
Validation: Completed checks, or "Not supplied".
Monitor: One or two useful signals.
Known Issues: Known limitations or "None reported".

Reference: [pull-request URL, or #number]

Rules:
- Use plain text, one label per line, and one appropriate status emoji.
- Lead with outcomes; keep implementation and operational detail specific.
- Use only supplied facts. Do not infer changes from branch names or generic promotion titles.
- Separate facts from recommendations. Never invent validation, safety, impact, or rollback claims.
- Preserve useful identifiers, links, flags, and component names.
- Always produce a release note; never output "SKIP".`;

export const RELEASE_NOTES_SYSTEM_WITH_POLICY = joinSystem(RELEASE_NOTES_SYSTEM, RELEASE_NOTES_WORD_POLICY);

export function getDefaultPrompt(kind) {
  if (kind !== "release_notes") throw new Error("Invalid NoxFeed prompt kind");
  return response({ prompt: { system: RELEASE_NOTES_SYSTEM_WITH_POLICY } });
}

export function buildPrompt(kind, args, systemOverride) {
  requireObject(args, "prompt input");
  const releaseNotes = kind === "release_notes";
  if (!releaseNotes && kind !== "actor" && kind !== "pr_opened") throw new Error("Invalid NoxFeed prompt kind");
  const lines = releaseNotes ? [`Project: ${args.projectName}`] : [`You are ${args.actorName}.`];
  if (!releaseNotes && args.actorTone?.trim()) lines.push(`Tone: ${args.actorTone.trim()}`);
  if (!releaseNotes) lines.push(`Project: ${args.projectName}`);
  const instruction = releaseNotes
    ? "Write the release note."
    : kind === "pr_opened" ? "Write the opened post in your own voice and the three-part plain-English summary." : "Write the post in your own voice.";
  lines.push("", "Event:", formatEventLine(args.event), "", instruction);
  const customGuidance = cleanOverride(systemOverride);
  const defaultSystem = releaseNotes ? RELEASE_NOTES_SYSTEM : kind === "pr_opened" ? PR_OPENED_GUIDANCE : ACTOR_GUIDANCE;
  const mandatoryPolicy = releaseNotes
    ? RELEASE_NOTES_WORD_POLICY
    : kind === "pr_opened" ? PR_OPENED_OUTPUT_POLICY : ACTOR_OUTPUT_POLICY;
  return response({ prompt: { system: joinSystem(customGuidance || defaultSystem, mandatoryPolicy), user: lines.join("\n") } });
}

export function buildSlackResponse(kind, input) {
  requireObject(input, "Slack input");
  const prUrl = safeHttpUrl(input.prUrl);
  let message;
  if (kind === "release_notes") {
    const header = input.projectName ? `*Release note* — \`${escapeMrkdwn(input.projectName)}\`` : "*Release note*";
    const note = input.summary ?? "(no release note)";
    const post = input.post && typeof input.post === "object" && !Array.isArray(input.post)
      ? input.post
      : null;
    const blocks = [];
    if (post?.summary) {
      const postHeader = [post.actorName ? `*${escapeMrkdwn(post.actorName)}*` : "*Unknown*"];
      if (input.projectName) postHeader.push(`\`${escapeMrkdwn(input.projectName)}\``);
      const avatarUrl = safeHttpUrl(post.avatarUrl);
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `${postHeader.join("  •  ")}\n${escapeMrkdwn(post.summary)}` },
        ...(avatarUrl ? { accessory: { type: "image", image_url: avatarUrl, alt_text: post.actorName || "actor" } } : {}),
      });
      if (post.technicalSummary) {
        const points = String(post.technicalSummary).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 3);
        blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Plain-English summary*\n${points.map((point) => `• ${escapeMrkdwn(point)}`).join("\n")}` } });
      }
      blocks.push({ type: "divider" });
    }
    blocks.push(
      { type: "section", text: { type: "mrkdwn", text: header } },
      ...splitSlackText(sanitizeForCodeFence(note), 2800).map((chunk) => (
        { type: "section", text: { type: "mrkdwn", text: "```\n" + chunk + "\n```" } }
      )),
    );
    if (prUrl) blocks.push(actionBlock(prUrl, input.prNumber));
    message = { text: stripForFallback([post?.summary, input.summary].filter(Boolean).join(" — ")), blocks };
  } else if (kind === "posts") {
    const header = [input.actorName ? `*${escapeMrkdwn(input.actorName)}*` : "*Unknown*"];
    if (input.projectName) header.push(`\`${escapeMrkdwn(input.projectName)}\``);
    const avatarUrl = safeHttpUrl(input.avatarUrl);
    const blocks = [{
      type: "section",
      text: { type: "mrkdwn", text: `${header.join("  •  ")}\n${escapeMrkdwn(input.summary || "(no summary)")}` },
      ...(avatarUrl ? { accessory: { type: "image", image_url: avatarUrl, alt_text: input.actorName || "actor" } } : {}),
    }];
    if (prUrl) blocks.push(actionBlock(prUrl, input.prNumber));
    message = { text: stripForFallback(input.summary), blocks };
  } else throw new Error("Invalid NoxFeed Slack kind");
  return response({ message });
}

export function buildTestResponse(orgLogin, stream = "all") {
  if (typeof orgLogin !== "string" || !orgLogin.trim() || orgLogin.length > 200) throw new Error("Invalid NoxFeed org login");
  const label = stream === "posts" ? "Posts" : stream === "release_notes" ? "Release Notes" : "posts and release notes";
  const textLabel = stream === "posts" ? "posts" : stream === "release_notes" ? "release notes" : "delivery";
  return response({ message: {
    text: stream === "all" ? `NoxFeed delivery test for ${orgLogin}` : `NoxFeed ${textLabel} delivery test for ${orgLogin}`,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: `*NoxFeed — ${escapeMrkdwn(label)} test*\nDelivery for \`${escapeMrkdwn(orgLogin)}\` is working.` } }],
  } });
}

export function response(value) { return { contract: CONTRACT, version: VERSION, ...value }; }
function joinSystem(guidance, policy) { return `${String(guidance).trim()}\n\n${String(policy).trim()}`; }
function actionBlock(url, number) { return { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: number ? `View PR #${number}` : "View PR" }, url }] }; }
function requireObject(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid NoxFeed ${label}`); }
function cleanOverride(value) { return typeof value === "string" && value.trim() ? value.trim().slice(0, 20_000) : null; }
function safeHttpUrl(value) { if (typeof value !== "string" || !value.trim()) return null; try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 3000) : null; } catch { return null; } }
function escapeMrkdwn(value) { return String(value ?? "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]); }
function stripForFallback(value) { return truncate(String(value ?? "").replace(/\s+/g, " ").trim(), 140); }
function truncate(value, max) { const text = String(value ?? ""); return text.length > max ? text.slice(0, max - 1) + "…" : text; }
function sanitizeForCodeFence(value) { return String(value ?? "").replace(/`{3,}/g, (match) => match.split("").join("​")); }
function splitSlackText(value, max) {
  const remaining = String(value ?? "").trim() || "(no release note)";
  const chunks = [];
  let rest = remaining;
  while (rest.length > max) {
    const newline = rest.lastIndexOf("\n", max);
    const boundary = newline > max / 2 ? newline : max;
    chunks.push(rest.slice(0, boundary).trimEnd());
    rest = rest.slice(boundary).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
function formatEventLine(event = {}) {
  const time = String(event.created_at || "").slice(11, 19);
  const data = event.payload ?? {};
  const bits = [];
  if (["github:pr:opened", "github:pr:merged", "github:pr:closed", "github:pr:reopened"].includes(event.type)) {
    const pr = data.pr ?? {};
    bits.push(event.type === "github:pr:merged" ? "PR merged" : event.type === "github:pr:closed" ? "PR closed (no merge)" : event.type === "github:pr:reopened" ? "PR reopened" : "PR opened");
    if (pr.number) bits.push(`#${pr.number}`);
    if (pr.title) bits.push(`"${pr.title}"`);
    if (event.repo) bits.push(`repository: ${event.repo}`);
    if (pr.author) bits.push(`author: ${pr.author}`);
    if (pr.merged_by) bits.push(`merged by: ${pr.merged_by}`);
    if (pr.head_ref || pr.base_ref) bits.push(`branch: ${pr.head_ref ?? "?"} → ${pr.base_ref ?? "?"}`);
    if (event.environment) bits.push(`environment: ${event.environment}`);
    if (pr.html_url) bits.push(`url: ${String(pr.html_url).slice(0, 1000)}`);
    if (Array.isArray(pr.labels) && pr.labels.length) bits.push(`labels: ${pr.labels.map((label) => typeof label === "string" ? label : label?.name).filter(Boolean).slice(0, 20).join(", ")}`);
    if (pr.changed_files != null || pr.additions != null) bits.push(`(+${pr.additions ?? 0} −${pr.deletions ?? 0}, ${pr.changed_files ?? "?"} files)`);
    if (typeof pr.body === "string") {
      const body = pr.body.trim();
      if (body) bits.push(`description:\n${body.slice(0, 6000)}`);
    }
  } else if (event.type === "github:push") {
    const commits = data.commits ?? [];
    bits.push(`push to ${String(data.ref ?? "").replace("refs/heads/", "") || "?"}`, `${commits.length} commit${commits.length === 1 ? "" : "s"}`);
    const first = commits[0]?.message?.split("\n")[0];
    if (first) bits.push(`"${first.slice(0, 160)}"`);
  } else if (event.type === "github:release:published") bits.push("release", event.summary ?? "");
  else if (event.type === "github:issue:opened" || event.type === "github:issue:closed") bits.push(event.type.replace("github:", ""), `"${event.summary ?? ""}"`);
  else bits.push(event.type, `"${event.summary ?? ""}"`);
  return `- ${time} ${event.type} ${bits.join(" ")}`;
}
