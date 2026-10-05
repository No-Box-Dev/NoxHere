import { operationDefinitions, type OperationId, type ResourceNamespace } from "./operations.generated.js";

export interface NoxHereOptions {
  baseUrl?: string;
  token?: string;
  organization?: string;
  projectId?: string;
  csrfToken?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit;
}

export interface OperationInput {
  path?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | null | undefined | readonly (string | number | boolean)[]>;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

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

export type Operation = (input?: OperationInput) => Promise<unknown>;
export type OperationMap = Record<OperationId, Operation>;
export type ResourceClient = Readonly<Record<string, Operation>>;

export interface NoxHereClient {
  readonly operations: OperationMap;
  readonly workspace: ResourceClient;
  readonly activity: ResourceClient;
  readonly planning: ResourceClient;
  readonly feedback: ResourceClient;
  readonly incidents: ResourceClient;
  readonly connect: ResourceClient;
  readonly feed: ResourceClient;
  readonly ticket: ResourceClient;
  readonly spot: ResourceClient;
  readonly cue: ResourceClient;
  request(operationId: OperationId, input?: OperationInput): Promise<unknown>;
}

function endpoint(baseUrl: string, pathTemplate: string, input: OperationInput): URL {
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

  const request = async (operationId: OperationId, input: OperationInput = {}): Promise<unknown> => {
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
    return result;
  };

  const operations = {} as OperationMap;
  const resources: Record<ResourceNamespace, Record<string, Operation>> = {
    workspace: {}, activity: {}, planning: {}, feedback: {}, incidents: {},
  };
  for (const definition of operationDefinitions) {
    const operation = (input?: OperationInput) => request(definition.id, input);
    operations[definition.id] = operation;
    resources[definition.namespace][definition.id] = operation;
  }
  for (const resource of Object.values(resources)) Object.freeze(resource);
  Object.freeze(operations);
  return Object.freeze({
    operations,
    ...resources,
    connect: resources.workspace,
    feed: resources.activity,
    ticket: resources.planning,
    spot: resources.feedback,
    cue: resources.incidents,
    request,
  });
}
