import {
  FORBIDDEN_PLATFORM_EVENT_KEYS,
  MAX_PLATFORM_EVENT_BYTES,
  PLATFORM_EVENT_DATA_VERSION,
  PLATFORM_EVENT_SPEC_VERSION,
  PLATFORM_EVENT_TYPES,
} from "./events.generated.js";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PlatformEventType = (typeof PLATFORM_EVENT_TYPES)[number];
export type PlatformEventActor =
  | { type: "member" | "github_user"; id: string }
  | { type: "anonymous"; idHash?: `sha256:${string}` }
  | { type: "system" };

export interface PlatformEventEnvelope<TType extends PlatformEventType = PlatformEventType, TData extends Record<string, JsonValue> = Record<string, JsonValue>> {
  specVersion: typeof PLATFORM_EVENT_SPEC_VERSION;
  dataVersion: typeof PLATFORM_EVENT_DATA_VERSION;
  id: string;
  type: TType;
  orgId: number;
  projectId: string;
  source: { component: string; sourceId?: string };
  subject: { type: string; id: string };
  actor?: PlatformEventActor;
  context?: { environment?: "development" | "preview" | "staging" | "production"; release?: string; requestId?: string; url?: string };
  message?: { title: string; summary?: string; severity?: "info" | "warning" | "error" };
  occurredAt: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
  data: TData;
}

export type CreatePlatformEvent<TType extends PlatformEventType, TData extends Record<string, JsonValue>> =
  Omit<PlatformEventEnvelope<TType, TData>, "specVersion" | "dataVersion" | "id" | "occurredAt"> & {
    id?: string;
    occurredAt?: string;
  };

const forbidden = new Set<string>(FORBIDDEN_PLATFORM_EVENT_KEYS);

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function forbiddenPaths(value: unknown, path = "$", found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbiddenPaths(item, `${path}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (forbidden.has(normalizedKey(key))) found.push(childPath);
      forbiddenPaths(child, childPath, found);
    }
  }
  return found;
}

function eventUuid(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("Creating a platform event requires crypto.randomUUID()");
  }
  return crypto.randomUUID();
}

export function createPlatformEvent<TType extends PlatformEventType, TData extends Record<string, JsonValue>>(
  input: CreatePlatformEvent<TType, TData>,
): PlatformEventEnvelope<TType, TData> {
  if (!(PLATFORM_EVENT_TYPES as readonly string[]).includes(input.type)) throw new Error(`Unknown platform event type: ${input.type}`);
  if (!Number.isInteger(input.orgId) || input.orgId <= 0) throw new Error("orgId must be a positive integer");
  if (!input.projectId.trim() || !input.idempotencyKey.trim()) throw new Error("projectId and idempotencyKey are required");
  const event = {
    ...input,
    specVersion: PLATFORM_EVENT_SPEC_VERSION,
    dataVersion: PLATFORM_EVENT_DATA_VERSION,
    id: input.id ?? eventUuid(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  } as PlatformEventEnvelope<TType, TData>;
  const privatePaths = forbiddenPaths(event);
  if (privatePaths.length) throw new Error(`Platform events cannot contain credentials or direct private identities: ${privatePaths.join(", ")}`);
  const serialized = JSON.stringify(event);
  if (new TextEncoder().encode(serialized).byteLength > MAX_PLATFORM_EVENT_BYTES) {
    throw new Error(`Platform event exceeds ${MAX_PLATFORM_EVENT_BYTES} bytes`);
  }
  return event;
}

export { MAX_PLATFORM_EVENT_BYTES, PLATFORM_EVENT_DATA_VERSION, PLATFORM_EVENT_SPEC_VERSION, PLATFORM_EVENT_TYPES };
