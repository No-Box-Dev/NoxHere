import { buildPrompt, response } from "./policy.js";

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const NARRATIVE_MAX_TOKENS = 2048;
const RELEASE_NOTES_MAX_TOKENS = 4096;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_OUTPUT_LENGTH = 800;
const MAX_TECHNICAL_OUTPUT_LENGTH = 1200;
const RELEASE_NOTES_MAX_OUTPUT_LENGTH = 2400;
const TIMEOUT_MS = 30_000;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 8_000;

export function generationInfo(available = false) {
  return response({
    model: MODEL,
    provider: "anthropic",
    available: Boolean(available),
  });
}

export async function generateContent(kind, input, systemOverride, apiKey) {
  const prompt = buildPrompt(kind, input, systemOverride).prompt;
  const completion = await complete(apiKey, prompt, {
    maxTokens: kind === "release_notes" ? RELEASE_NOTES_MAX_TOKENS : NARRATIVE_MAX_TOKENS,
    tag: kind === "release_notes" ? "release-notes" : "post",
  });

  if (!completion.ok) {
    return response({
      generation: {
        status: "unavailable",
        model: MODEL,
        errorCode: completion.reason,
      },
    });
  }

  if (kind === "release_notes") {
    const metadata = releaseMetadata(input?.event);
    const summary = limitText(
      enforceReleaseMetadata(completion.text, metadata),
      RELEASE_NOTES_MAX_OUTPUT_LENGTH,
    );
    return response({
      generation: { status: "generated", model: MODEL, output: { summary } },
    });
  }

  const generated = parseNarrativeOutput(completion.text, {
    projectName: input?.projectName,
    eventSummary: input?.event?.summary,
    payload: input?.event?.payload,
  });
  return response({
    generation: {
      status: "generated",
      model: MODEL,
      output: {
        summary: limitText(generated.social, MAX_OUTPUT_LENGTH),
        technicalSummary: limitText(generated.technicalSummary, MAX_TECHNICAL_OUTPUT_LENGTH),
      },
    },
  });
}

async function complete(apiKey, prompt, { maxTokens, tag }) {
  if (typeof apiKey !== "string" || !apiKey) return { ok: false, reason: "managed_key_missing" };

  let lastResult = { ok: false, reason: "unknown_error" };
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    const result = await probeCompletion(apiKey, prompt, maxTokens);
    if (result.ok) return result;
    lastResult = result;
    const isLast = attempt === RETRY_MAX_ATTEMPTS - 1;
    if (!isRetriable(result) || isLast) break;
    const delay = Math.floor(Math.random() * Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS));
    console.warn(JSON.stringify({
      event: "noxfeed_generation_retry",
      tag,
      reason: result.reason,
      status: result.status ?? null,
      attempt: attempt + 1,
      delayMs: delay,
    }));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.warn(JSON.stringify({
    event: "noxfeed_generation_failed",
    tag,
    reason: lastResult.reason,
    status: lastResult.status ?? null,
  }));
  return lastResult;
}

async function probeCompletion(apiKey, prompt, maxTokens) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }),
      signal: controller.signal,
    });
    if (!result.ok) {
      return { ok: false, reason: "provider_http_error", status: result.status };
    }
    const contentLength = Number(result.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) return { ok: false, reason: "provider_response_too_large" };
    const raw = await readBoundedText(result, MAX_RESPONSE_BYTES);
    if (raw == null) return { ok: false, reason: "provider_response_too_large" };
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "provider_bad_json" };
    }
    if (body?.stop_reason === "max_tokens") return { ok: false, reason: "provider_output_truncated" };
    const text = (body?.content ?? []).find((block) => block?.type === "text")?.text;
    if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "provider_no_text" };
    const sanitized = sanitizeNarrative(text);
    return sanitized ? { ok: true, text: sanitized } : { ok: false, reason: "provider_no_text" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { ok: false, reason: "provider_timeout" };
    return { ok: false, reason: "provider_network_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedText(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRetriable(result) {
  return result.reason === "provider_timeout"
    || result.reason === "provider_network_error"
    || (result.reason === "provider_http_error" && (result.status === 429 || result.status >= 500));
}

function sanitizeNarrative(text) {
  let value = String(text ?? "").trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

export function parseNarrativeOutput(text, context) {
  const raw = String(text ?? "").trim();
  let parsed = null;
  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const candidates = [unfenced];
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(unfenced.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      // Some providers preface otherwise-valid JSON; try the extracted object.
    }
  }

  const looksStructured = /^```(?:json)?\b/i.test(raw) || raw.startsWith("{") || /["']social["']\s*:/.test(raw);
  const social = typeof parsed?.social === "string" && parsed.social.trim()
    ? parsed.social.trim()
    : looksStructured
      ? buildFallbackSocial(context)
      : raw;
  const technicalSummary = normalizeTechnicalSummary(parsed?.technical)
    || buildFallbackTechnicalSummary(context);
  return { social, technicalSummary };
}

function buildFallbackSocial({ eventSummary, payload }) {
  return cleanSentence(payload?.pr?.title || eventSummary || "Engineering update");
}

function normalizeTechnicalSummary(value) {
  const lines = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  const cleaned = lines.map((line) => String(line).replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
  if (cleaned.length !== 3) return null;
  const labels = ["What it does", "How it works", "What it touches"];
  return cleaned.map((line, index) => {
    const content = line.replace(/^(what it does|how it works|what it touches)\s*:\s*/i, "");
    return `${labels[index]}: ${content}`;
  }).join("\n");
}

function buildFallbackTechnicalSummary({ projectName, eventSummary, payload }) {
  const pr = payload?.pr ?? {};
  const title = cleanSentence(pr.title || eventSummary || "Updates this pull request");
  const bodyLine = typeof pr.body === "string"
    ? pr.body.split(/\r?\n/).map(cleanSentence).find((line) => line.length > 12)
    : "";
  const how = bodyLine || "Updates the implementation described by the pull request";
  const stats = typeof pr.changed_files === "number"
    ? ` across ${pr.changed_files} changed file${pr.changed_files === 1 ? "" : "s"}`
    : "";
  const area = cleanSentence(projectName || "the project");
  return [
    `What it does: ${title}`,
    `How it works: ${how}`,
    `What it touches: ${area}${stats}`,
  ].join("\n");
}

function cleanSentence(value) {
  return String(value ?? "").replace(/^[-*#\s]+/, "").replace(/^PR\s+#\d+\s*:\s*/i, "").trim().replace(/[.!?]+$/, "");
}

function releaseMetadata(event = {}) {
  const pr = event?.payload?.pr ?? {};
  return {
    repo: event.repo,
    number: pr.number,
    title: pr.title,
    pr: {
      author: pr.author,
      merged_by: pr.merged_by ?? pr.author,
      head_ref: pr.head_ref,
      base_ref: pr.base_ref,
    },
    environment: event.environment,
  };
}

export function enforceReleaseMetadata(summary, metadata) {
  const fields = [
    ["Repository", metadata.repo],
    ["Pull Request", metadata.number ? `#${metadata.number}${metadata.title ? ` - ${metadata.title}` : ""}` : null],
    ["Author", metadata.pr.author ? `${metadata.pr.author} | Merged by: ${metadata.pr.merged_by ?? metadata.pr.author}` : null],
    ["Branch", metadata.pr.head_ref || metadata.pr.base_ref ? `${metadata.pr.head_ref ?? "?"} → ${metadata.pr.base_ref ?? "?"}` : null],
    ["Environment", metadata.environment],
  ].filter(([, value]) => value);
  const replacements = {
    "[repo]": metadata.repo,
    "[number]": metadata.number,
    "[title]": metadata.title,
    "[author]": metadata.pr.author,
    "[merger]": metadata.pr.merged_by ?? metadata.pr.author,
    "[head_ref]": metadata.pr.head_ref,
    "[base_ref]": metadata.pr.base_ref,
    "[environment]": metadata.environment,
  };
  let canonicalSummary = String(summary ?? "");
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (value != null && value !== "") canonicalSummary = canonicalSummary.replaceAll(placeholder, String(value));
  }
  const lines = canonicalSummary.split(/\r?\n/);
  for (const [label, value] of fields) {
    const pattern = new RegExp(`^${label}:`, "i");
    const index = lines.findIndex((line) => pattern.test(line.trim()));
    const line = `${label}: ${value}`;
    if (index >= 0) lines[index] = line;
    else {
      const sectionIndex = lines.findIndex((entry) => /^#{0,6}\s*Change Summary\s*$/i.test(entry.trim()));
      lines.splice(sectionIndex >= 0 ? sectionIndex : Math.min(1, lines.length), 0, line);
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function limitText(text, maxLength) {
  const trimmed = String(text ?? "").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…` : trimmed;
}
