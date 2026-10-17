import { z } from "zod";
import { DEFAULT_BOARD_STAGES } from "./board-stages.js";
import type { ServiceId } from "./service-capabilities";

const Stage = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
}).strict();

const Branding = z.object({
  name: z.string().trim().min(1).max(120),
  logoUrl: z.string().trim().url().max(2048).refine((value) => new URL(value).protocol === "https:", "Logo URLs must use HTTPS").nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  buttonText: z.string().trim().min(1).max(40),
  fontPreset: z.enum(["system", "playnist", "humanist", "editorial", "mono"]),
}).strict();

const PATCH_SCHEMAS = {
  noxhere: z.object({
    newRepositoryPolicy: z.enum(["include", "exclude"]).optional(),
    branding: Branding.optional(),
  }).strict(),
  planning: z.object({
    featureRepository: z.string().trim().min(1).max(100).nullable().optional(),
    workflow: z.object({ stages: z.array(Stage) }).strict().optional(),
  }).strict(),
  activity: z.object({
    releaseNotesPrompt: z.string().max(20_000).nullable().optional(),
  }).strict(),
  feedback: z.object({}).strict(),
  telemetry: z.object({}).strict(),
} satisfies Record<ServiceId, z.ZodType>;

export type NoxSettings = Record<string, unknown> & {
  newRepoDefault?: "include" | "exclude";
  planningRepo?: string;
  boardStages?: Array<{ id: string; label: string; color: string }>;
  releaseNotesPrompt?: string;
  branding?: z.infer<typeof Branding>;
  slack?: Record<string, unknown> & { activityProjectId?: string };
};

export function parseSettings(raw: string | null): NoxSettings {
  if (raw == null) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings must be a JSON object");
  }
  return value as NoxSettings;
}

export function serviceConfig(service: ServiceId, settings: NoxSettings) {
  switch (service) {
    case "noxhere":
      return {
        newRepositoryPolicy: settings.newRepoDefault ?? "include",
        branding: settings.branding ?? null,
      };
    case "planning":
      return {
        featureRepository: settings.planningRepo?.trim() || "noxhere",
        workflow: { stages: settings.boardStages ?? DEFAULT_BOARD_STAGES },
      };
    case "activity":
      return {
        releaseNotesPrompt: settings.releaseNotesPrompt ?? null,
      };
    case "feedback":
    case "telemetry":
      return {};
  }
}

export function parseServiceConfigPatch(service: ServiceId, value: unknown) {
  return PATCH_SCHEMAS[service].safeParse(value);
}

export function applyServiceConfigPatch(service: ServiceId, current: NoxSettings, patch: Record<string, unknown>): NoxSettings {
  const next: NoxSettings = structuredClone(current);
  if (service === "noxhere") {
    if (patch.newRepositoryPolicy) next.newRepoDefault = patch.newRepositoryPolicy as "include" | "exclude";
    if (patch.branding) next.branding = patch.branding as NoxSettings["branding"];
  }
  if (service === "planning") {
    if (Object.hasOwn(patch, "featureRepository")) {
      if (patch.featureRepository === null) delete next.planningRepo;
      else next.planningRepo = patch.featureRepository as string;
    }
    const workflow = patch.workflow as { stages: NoxSettings["boardStages"] } | undefined;
    if (workflow) next.boardStages = workflow.stages;
  }
  if (service === "activity") {
    if (Object.hasOwn(patch, "releaseNotesPrompt")) {
      if (patch.releaseNotesPrompt === null || !(patch.releaseNotesPrompt as string).trim()) delete next.releaseNotesPrompt;
      else next.releaseNotesPrompt = patch.releaseNotesPrompt as string;
    }
  }
  return next;
}

export function serviceConfigLinks(service: ServiceId) {
  const base = `/api/v1/services/${service}`;
  const resources: Record<ServiceId, Record<string, string>> = {
    noxhere: { connections: "/api/v1/integrations/connections", repositories: "/api/v1/projects", people: "/api/v1/actors" },
    planning: { features: "/api/v1/features", tasks: "/api/v1/tasks", specifications: "/api/v1/specs" },
    activity: { feed: "/api/v1/activity", aiSettings: "/api/v1/llm-settings" },
    feedback: { sites: "/api/v1/feedback/sites" },
    telemetry: { sources: "/api/v1/telemetry/sources", metrics: "/api/v1/telemetry/metrics" },
  };
  return { self: `${base}/config`, setup: `${base}/setup`, health: `${base}/health`, resources: resources[service] };
}

export function serviceConfigMetadata(service: ServiceId) {
  const fields: Record<ServiceId, string[]> = {
    noxhere: ["newRepositoryPolicy", "branding"],
    planning: ["featureRepository", "workflow.stages"],
    activity: ["releaseNotesPrompt"],
    feedback: [],
    telemetry: [],
  };
  const resourceScoped = service === "feedback" || service === "telemetry";
  return {
    mode: resourceScoped ? "resource" as const : "service" as const,
    writable: !resourceScoped,
    writableFields: fields[service],
  };
}

export async function settingsRevision(raw: string | null): Promise<string> {
  const bytes = new TextEncoder().encode(raw == null ? "noxhere:settings:missing" : raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
