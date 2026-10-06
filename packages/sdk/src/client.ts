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
  constructor(
    public readonly status: number,
    public readonly operationId: OperationId,
    public readonly details: unknown,
  ) {
    super(`NoxHere ${operationId} failed with HTTP ${status}`);
    this.name = "NoxHereApiError";
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

export function createNoxHere(options: NoxHereOptions = {}): NoxHereClient {
  const baseUrl = new URL(options.baseUrl ?? "https://app.noxhere.com").href;
  const requestFetch = options.fetch ?? globalThis.fetch;
  if (!requestFetch) throw new TypeError("NoxHere requires a fetch implementation");
  const definitions = new Map(operationDefinitions.map((definition) => [definition.id, definition]));

  const request = async <K extends OperationId>(operationId: K, ...args: OperationArguments<K>): Promise<OperationOutput<K>> => {
    const input = (args[0] ?? {}) as RuntimeOperationInput;
    const definition = definitions.get(operationId);
    if (!definition) throw new TypeError(`Unknown NoxHere operation: ${operationId}`);
    const headers = new Headers(options.headers);
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
    const response = await requestFetch(endpoint(baseUrl, definition.path, input), {
      method: definition.method,
      headers,
      body,
      signal: input.signal,
      credentials: options.token ? "omit" : "same-origin",
    });
    const result = await payload(response);
    if (!response.ok) throw new NoxHereApiError(response.status, operationId, result);
    return result as OperationOutput<K>;
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
  return Object.freeze({
    operations: operations as unknown as OperationMap,
    ...resources,
    connect: resources.workspace,
    feed: resources.activity,
    ticket: resources.planning,
    spot: resources.feedback,
    cue: resources.incidents,
    request,
  }) as unknown as NoxHereClient;
}
