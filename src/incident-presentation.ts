interface IncidentInput {
  environment: string; incidentKey: string; title: string; payloadJson: string;
  sourceName: string; firstSeenAt: string; lastSeenAt: string; occurrenceCount: number;
}

const LABELS = [
  { name: "noxcue", color: "6f42c1", description: "Detected by NoxCue" },
  { name: "incident", color: "d73a4a", description: "Application incident requiring investigation" },
];
const markdown = (value: unknown) => String(value ?? "").slice(0, 8_000).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("```", "''' ");
const short = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : null;

function payload(raw: string) {
  const value = JSON.parse(raw) as Record<string, any>;
  if (typeof value?.impact !== "string" || !value.diagnosis || !Array.isArray(value.diagnosis.possibleCauses) || !Array.isArray(value.diagnosis.possibleFixes)) throw new Error("NoxCue incident has invalid diagnostic payload");
  return {
    impact: value.impact.slice(0, 2_000), message: short(value.message, 2_000),
    error: value.error && typeof value.error === "object" ? { name: short(value.error.name, 120), code: short(value.error.code, 120), status: Number.isFinite(value.error.status) ? value.error.status : null, message: short(value.error.message, 2_000), stack: short(value.error.stack, 6_000) } : null,
    context: value.context && typeof value.context === "object" ? { release: short(value.context.release, 200), runtime: short(value.context.runtime, 200), url: short(value.context.url, 1_000) } : null,
    diagnosis: { possibleCauses: value.diagnosis.possibleCauses.slice(0, 8).map((item: unknown) => short(item, 500)).filter(Boolean), possibleFixes: value.diagnosis.possibleFixes.slice(0, 8).map((item: unknown) => short(item, 500)).filter(Boolean) },
  };
}

export function buildIncidentPresentation(input: IncidentInput, previous?: { url?: string | null } | null) {
  const detail = payload(input.payloadJson);
  const marker = `<!-- noxcue-key: ${input.environment}/${input.incidentKey} -->`;
  const causes = detail.diagnosis.possibleCauses.map((value: string | null) => `- ${markdown(value)}`).join("\n");
  const fixes = detail.diagnosis.possibleFixes.map((value: string | null) => `- ${markdown(value)}`).join("\n");
  const error = detail.error ? [detail.error.name, detail.error.code, detail.error.status ? `HTTP ${detail.error.status}` : null, detail.error.message].filter(Boolean).map(markdown).join(" · ") : "No structured error was supplied.";
  const stack = detail.error?.stack ? `\n<details>\n<summary>Redacted stack trace</summary>\n\n\`\`\`text\n${markdown(detail.error.stack)}\n\`\`\`\n</details>\n` : "";
  const body = `${marker}\n## Detected impact\n\n${markdown(detail.impact)}\n\n${detail.message ? `**Message:** ${markdown(detail.message)}\n\n` : ""}**Error:** ${error}\n${stack}\n\n## Context\n\n- Environment: \`${markdown(input.environment)}\`\n- Source: ${markdown(input.sourceName)}\n- Incident key: \`${markdown(input.incidentKey)}\`\n- First seen: ${input.firstSeenAt}\n- Last seen: ${input.lastSeenAt}\n- Occurrences: ${input.occurrenceCount}\n${detail.context?.release ? `- Latest release: \`${markdown(detail.context.release)}\`\n` : ""}${detail.context?.runtime ? `- Runtime: ${markdown(detail.context.runtime)}\n` : ""}${detail.context?.url ? `- Origin: ${markdown(detail.context.url)}\n` : ""}${previous?.url ? `- Previous occurrence: ${previous.url}\n` : ""}\n## Possible causes\n\n${causes}\n\n## Possible fixes to investigate\n\n${fixes}\n\n> NoxCue detected and explained this incident. It has not changed the application or attempted a fix.\n`;
  return {
    marker,
    title: `[NoxCue] ${input.title}`.slice(0, 256),
    body,
    labels: LABELS,
    latestRelease: detail.context?.release ?? null,
    repeatComment: `NoxCue observed this incident again. Occurrences: **${input.occurrenceCount}** · Last seen: ${input.lastSeenAt}.`,
  };
}
