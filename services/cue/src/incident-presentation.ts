import { z } from "zod";

const LABELS = [
  { name: "noxcue", color: "6f42c1", description: "Detected by NoxCue" },
  { name: "incident", color: "d73a4a", description: "Application incident requiring investigation" },
] as const;

const incidentPayloadSchema = z.object({
  impact: z.string(),
  message: z.string().optional(),
  error: z.object({
    name: z.string().optional(),
    message: z.string(),
    code: z.string().optional(),
    status: z.number().finite().optional(),
    stack: z.string().optional(),
  }).optional(),
  context: z.object({
    environment: z.string().optional(),
    release: z.string().optional(),
    runtime: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  diagnosis: z.object({
    possibleCauses: z.array(z.string()),
    possibleFixes: z.array(z.string()),
  }),
});

export interface GitHubIncidentInput {
  environment: string;
  incidentKey: string;
  title: string;
  payloadJson: string;
  sourceName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
}

export interface PreviousGitHubIncident {
  url: string;
}

export interface GitHubIncidentPresentation {
  marker: string;
  title: string;
  body: string;
  labels: Array<{ name: string; color: string; description: string }>;
  latestRelease: string | null;
  repeatComment: string;
}

export function buildGitHubIncident(
  input: GitHubIncidentInput,
  previous: PreviousGitHubIncident | null = null,
): GitHubIncidentPresentation {
  const payload = parsePayload(input.payloadJson);
  const marker = `<!-- noxcue-key: ${markdown(input.environment)}/${markdown(input.incidentKey)} -->`;
  const causes = payload.diagnosis.possibleCauses.map((value) => `- ${markdown(value)}`).join("\n");
  const fixes = payload.diagnosis.possibleFixes.map((value) => `- ${markdown(value)}`).join("\n");
  const error = payload.error
    ? [payload.error.name, payload.error.code, payload.error.status ? `HTTP ${payload.error.status}` : null, payload.error.message]
      .filter(Boolean).map(markdown).join(" · ")
    : "No structured error was supplied.";
  const stack = payload.error?.stack
    ? `\n<details>\n<summary>Redacted stack trace</summary>\n\n\`\`\`text\n${markdown(payload.error.stack)}\n\`\`\`\n</details>\n`
    : "";
  const body = `${marker}
## Detected impact

${markdown(payload.impact)}

${payload.message ? `**Message:** ${markdown(payload.message)}\n\n` : ""}**Error:** ${error}
${stack}

## Context

- Environment: \`${markdown(input.environment)}\`
- Source: ${markdown(input.sourceName)}
- Incident key: \`${markdown(input.incidentKey)}\`
- First seen: ${markdown(input.firstSeenAt)}
- Last seen: ${markdown(input.lastSeenAt)}
- Occurrences: ${input.occurrenceCount}
${payload.context?.release ? `- Latest release: \`${markdown(payload.context.release)}\`\n` : ""}${payload.context?.runtime ? `- Runtime: ${markdown(payload.context.runtime)}\n` : ""}${payload.context?.url ? `- Origin: ${markdown(payload.context.url)}\n` : ""}${previous ? `- Previous occurrence: ${markdown(previous.url)}\n` : ""}
## Possible causes

${causes}

## Possible fixes to investigate

${fixes}

> NoxCue detected and explained this incident. It has not changed the application or attempted a fix.
`;

  return {
    marker,
    title: `[NoxCue] ${input.title}`.slice(0, 256),
    body,
    labels: LABELS.map((label) => ({ ...label })),
    latestRelease: payload.context?.release ?? null,
    repeatComment: `NoxCue observed this incident again. Occurrences: **${input.occurrenceCount}** · Last seen: ${markdown(input.lastSeenAt)}.`,
  };
}

function parsePayload(raw: string) {
  try {
    const value = incidentPayloadSchema.parse(JSON.parse(raw));
    return {
      impact: value.impact.slice(0, 2_000),
      message: short(value.message, 2_000),
      error: value.error ? {
        name: short(value.error.name, 120),
        code: short(value.error.code, 120),
        status: value.error.status,
        message: value.error.message.slice(0, 2_000),
        stack: short(value.error.stack, 6_000),
      } : undefined,
      context: value.context ? {
        release: short(value.context.release, 200),
        runtime: short(value.context.runtime, 200),
        url: short(value.context.url, 1_000),
      } : undefined,
      diagnosis: {
        possibleCauses: value.diagnosis.possibleCauses.slice(0, 8).map((item) => item.slice(0, 500)).filter(Boolean),
        possibleFixes: value.diagnosis.possibleFixes.slice(0, 8).map((item) => item.slice(0, 500)).filter(Boolean),
      },
    };
  } catch {
    throw new Error("NoxCue incident has invalid diagnostic payload");
  }
}

function short(value: string | undefined, max: number): string | undefined {
  return value?.slice(0, max);
}

function markdown(value: unknown): string {
  return String(value ?? "").slice(0, 8_000)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll("```", "''' ");
}
