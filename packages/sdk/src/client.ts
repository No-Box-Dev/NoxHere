import { operationDefinitions, type OperationId, type ResourceNamespace } from "./operations.generated.js";
import type { operations } from "./schema.generated.js";

export interface NoxHereOptions {
  baseUrl?: string;
  token?: string;
  organization?: string;
  projectId?: string;
  csrfToken?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onRequest?: (event: NoxHereRequestEvent) => void | Promise<void>;
  onResponse?: (event: NoxHereResponseEvent) => void | Promise<void>;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface NoxHereRequestEvent {
  operationId: OperationId;
  method: string;
  url: string;
  attempt: number;
}

export interface NoxHereResponseEvent extends NoxHereRequestEvent {
  status?: number;
  durationMs: number;
  retrying: boolean;
  errorCode?: string;
}

interface RuntimeOperationInput {
  path?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | null | undefined | readonly (string | number | boolean)[]>;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

type ParameterValue<K extends OperationId, P extends "path" | "query"> =
  operations[K] extends { parameters: infer Params }
    ? P extends keyof Params ? Params[P] : never
    : never;

type ParameterPart<K extends OperationId, P extends "path" | "query"> =
  [Exclude<ParameterValue<K, P>, undefined>] extends [never] ? {} :
    undefined extends ParameterValue<K, P>
      ? { [Key in P]?: Exclude<ParameterValue<K, P>, undefined> }
      : { [Key in P]: ParameterValue<K, P> };

type RequestContent<K extends OperationId> = operations[K] extends { requestBody: infer Body }
  ? Body extends { content: infer Content }
    ? "multipart/form-data" extends keyof Content ? FormData : Content[keyof Content]
    : never
  : operations[K] extends { requestBody?: infer Body }
    ? Exclude<Body, undefined> extends { content: infer Content }
      ? "multipart/form-data" extends keyof Content ? FormData : Content[keyof Content]
      : never
    : never;

type BodyPart<K extends OperationId> = operations[K] extends { requestBody: unknown }
  ? { body: RequestContent<K> }
  : [RequestContent<K>] extends [never]
    ? {}
    : { body?: RequestContent<K> };

type SuccessStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206 | "2XX";
type SuccessResponse<K extends OperationId> = operations[K] extends { responses: infer Responses }
  ? Responses[keyof Responses & SuccessStatus]
  : never;
type ResponsePayload<Response> = Response extends { content: infer Content }
  ? "application/octet-stream" extends keyof Content
    ? ArrayBuffer
    : Content[keyof Content]
  : undefined;

export type OperationOutput<K extends OperationId> = ResponsePayload<SuccessResponse<K>>;
export type OperationInput<K extends OperationId = OperationId> = ParameterPart<K, "path"> &
  ParameterPart<K, "query"> & BodyPart<K> & {
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export class NoxHereApiError extends Error {
  public readonly code: string;
  public readonly requestId: string | null;
  public readonly retryAfter: number | null;
  public readonly retryable: boolean;

  constructor(
    public readonly status: number,
    public readonly operationId: OperationId,
    public readonly details: unknown,
    headers: Headers = new Headers(),
  ) {
    const structured = details && typeof details === "object" && "error" in details
      ? (details as { error?: unknown }).error : undefined;
    const error = structured && typeof structured === "object" ? structured as { code?: unknown; message?: unknown } : undefined;
    const message = typeof error?.message === "string" ? error.message
      : typeof structured === "string" ? structured
        : `NoxHere ${operationId} failed with HTTP ${status}`;
    super(message);
    this.name = "NoxHereApiError";
    this.code = typeof error?.code === "string" ? error.code : "request_failed";
    this.requestId = headers.get("x-request-id") ?? headers.get("x-nox-request-id");
    this.retryAfter = retryAfterMs(headers.get("retry-after"));
    this.retryable = retryableStatus(status);
  }
}

export class NoxHereTransportError extends Error {
  public readonly retryable = true;
  constructor(public readonly operationId: OperationId, public readonly cause: unknown) {
    super(`NoxHere ${operationId} could not reach the API`, { cause });
    this.name = "NoxHereTransportError";
  }
}

export type OperationArguments<K extends OperationId> = {} extends OperationInput<K>
  ? [input?: OperationInput<K>]
  : [input: OperationInput<K>];
export type Operation<K extends OperationId = OperationId> = (...args: OperationArguments<K>) => Promise<OperationOutput<K>>;
export type OperationMap = { readonly [K in OperationId]: Operation<K> };
type Definition = (typeof operationDefinitions)[number];
export type OperationIdFor<N extends ResourceNamespace> = Extract<Definition, { namespace: N }>["id"];
export type ResourceClient<N extends ResourceNamespace = ResourceNamespace> = Readonly<Pick<OperationMap, OperationIdFor<N>>>;

export interface NoxHereClient {
  readonly operations: OperationMap;
  readonly workspace: ResourceClient<"workspace">;
  readonly activity: ResourceClient<"activity">;
  readonly planning: ResourceClient<"planning">;
  readonly feedback: ResourceClient<"feedback">;
  readonly incidents: ResourceClient<"incidents">;
  readonly connect: ResourceClient<"workspace">;
  readonly feed: ResourceClient<"activity">;
  readonly ticket: ResourceClient<"planning">;
  readonly spot: ResourceClient<"feedback">;
  readonly cue: ResourceClient<"incidents">;
  request<K extends OperationId>(operationId: K, ...args: OperationArguments<K>): Promise<OperationOutput<K>>;
  withContext(context: { organization?: string; projectId?: string }): NoxHereClient;
}

function endpoint(baseUrl: string, pathTemplate: string, input: RuntimeOperationInput): URL {
  const path = pathTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = input.path?.[key];
    if (value === undefined || value === null || value === "") throw new TypeError(`Missing path parameter: ${key}`);
    return encodeURIComponent(String(value));
  });
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
  }
  return url;
}

async function payload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (type.includes("json")) return response.json();
  if (type.startsWith("text/")) return response.text();
  return response.arrayBuffer();
}

const SDK_VERSION = "0.2.0";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_RETRY_AFTER_MS = 30_000;

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? Math.max(0, seconds * 1_000) : Math.max(0, Date.parse(value) - Date.now());
  return Number.isFinite(delay) && delay <= MAX_RETRY_AFTER_MS ? Math.ceil(delay) : null;
}

function safeUrl(value: URL, input: RuntimeOperationInput): string {
  const copy = new URL(value);
  for (const key of copy.searchParams.keys()) {
    if (/token|key|secret|password|code/i.test(key)) copy.searchParams.set(key, "[redacted]");
  }
  for (const [key, raw] of Object.entries(input.path ?? {})) {
    if (/token|key|secret|password|code/i.test(key)) {
      copy.pathname = copy.pathname.replace(encodeURIComponent(String(raw)), "[redacted]");
    }
  }
  return copy.toString();
}

function requestSignal(caller: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; clear: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timeout = false;
  const abort = () => controller.abort(caller?.reason);
  caller?.addEventListener("abort", abort, { once: true });
  if (caller?.aborted) abort();
  const timer = setTimeout(() => { timeout = true; controller.abort(new Error("NoxHere request timed out")); }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timeout,
    clear: () => { clearTimeout(timer); caller?.removeEventListener("abort", abort); },
  };
}

export function createNoxHere(options: NoxHereOptions = {}): NoxHereClient {
  const baseUrl = new URL(options.baseUrl ?? "https://app.noxhere.com").href;
  const requestFetch = options.fetch ?? globalThis.fetch;
  if (!requestFetch) throw new TypeError("NoxHere requires a fetch implementation");
  const definitions = new Map(operationDefinitions.map((definition) => [definition.id, definition]));
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 2));
  const baseRetryDelay = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  const request = async <K extends OperationId>(operationId: K, ...args: OperationArguments<K>): Promise<OperationOutput<K>> => {
    const input = (args[0] ?? {}) as RuntimeOperationInput;
    const definition = definitions.get(operationId);
    if (!definition) throw new TypeError(`Unknown NoxHere operation: ${operationId}`);
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    headers.set("X-NoxHere-SDK", `typescript/${SDK_VERSION}`);
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
    if (options.organization) headers.set("X-Org", options.organization);
    if (options.projectId) headers.set("X-Project-ID", options.projectId);
    if (options.csrfToken) headers.set("X-CSRF-Token", options.csrfToken);
    new Headers(input.headers).forEach((value, key) => headers.set(key, value));
    let body: BodyInit | undefined;
    if (input.body !== undefined) {
      if (input.body instanceof FormData || input.body instanceof Blob || typeof input.body === "string" || input.body instanceof URLSearchParams || input.body instanceof ArrayBuffer) {
        body = input.body;
      } else {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(input.body);
      }
    }
    const operationBaseUrl = definition.servers[0]?.url ?? baseUrl;
    const url = endpoint(operationBaseUrl, definition.path, input);
    const safeToRetry = definition.changeSafety === "safe_read" || definition.changeSafety === "idempotent_with_event_key";
    for (let attempt = 1; ; attempt += 1) {
      const started = Date.now();
      const controlled = requestSignal(input.signal, timeoutMs);
      await options.onRequest?.({ operationId, method: definition.method, url: safeUrl(url, input), attempt });
      try {
        const response = await requestFetch(url, {
          method: definition.method, headers, body, signal: controlled.signal,
          credentials: options.token ? "omit" : "same-origin",
        });
        const result = await payload(response);
        const retrying = !response.ok && safeToRetry && retryableStatus(response.status) && attempt <= maxRetries;
        await options.onResponse?.({
          operationId, method: definition.method, url: safeUrl(url, input), attempt,
          status: response.status, durationMs: Date.now() - started, retrying,
          ...(!response.ok ? { errorCode: "http_error" } : {}),
        });
        if (response.ok) return result as OperationOutput<K>;
        const error = new NoxHereApiError(response.status, operationId, result, response.headers);
        if (!retrying) throw error;
        await sleep(error.retryAfter ?? baseRetryDelay * 2 ** (attempt - 1));
      } catch (error) {
        if (error instanceof NoxHereApiError) throw error;
        const retrying = safeToRetry && attempt <= maxRetries && !input.signal?.aborted;
        await options.onResponse?.({
          operationId, method: definition.method, url: safeUrl(url, input), attempt,
          durationMs: Date.now() - started, retrying,
          errorCode: controlled.timedOut() ? "timeout" : "network_error",
        });
        if (!retrying) throw new NoxHereTransportError(operationId, error);
        await sleep(baseRetryDelay * 2 ** (attempt - 1));
      } finally {
        controlled.clear();
      }
    }
  };

  const operations: Record<string, (input?: RuntimeOperationInput) => Promise<unknown>> = {};
  const resources: Record<ResourceNamespace, Record<string, (input?: RuntimeOperationInput) => Promise<unknown>>> = {
    workspace: {}, activity: {}, planning: {}, feedback: {}, incidents: {},
  };
  for (const definition of operationDefinitions) {
    const operation = (input?: RuntimeOperationInput) => (request as (id: OperationId, input?: RuntimeOperationInput) => Promise<unknown>)(definition.id, input);
    operations[definition.id] = operation;
    resources[definition.namespace][definition.id] = operation;
  }
  for (const resource of Object.values(resources)) Object.freeze(resource);
  Object.freeze(operations);
  const client = {
    operations: operations as unknown as OperationMap,
    ...resources,
    connect: resources.workspace,
    feed: resources.activity,
    ticket: resources.planning,
    spot: resources.feedback,
    cue: resources.incidents,
    request,
    withContext: (context: { organization?: string; projectId?: string }) => createNoxHere({ ...options, ...context }),
  } as unknown as NoxHereClient;
  return Object.freeze(client);
}
