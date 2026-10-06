import type { NoxCueAdapterOptions, ServerNoxCueClient } from "./types.js";

type WebHandler<Args extends unknown[]> = (request: Request, ...args: Args) => Response | Promise<Response>;

function route(request: Request): string {
  try { return new URL(request.url).pathname; } catch { return "/"; }
}

function responseError(response: Response): Error & { status: number; code: string } {
  return Object.assign(new Error(`HTTP ${response.status} returned by the request handler`), {
    name: "HTTPResponseError", status: response.status, code: `HTTP_${response.status}`,
  });
}

function details(request: Request, options: NoxCueAdapterOptions, status?: number) {
  const pathname = route(request);
  return {
    title: `${request.method.toUpperCase()} ${pathname} failed`,
    message: status ? `The request handler returned HTTP ${status}.` : "The request handler threw an unexpected error.",
    component: options.component ?? "server.request",
    url: request.url,
    fatal: false,
    unhandled: true,
    attributes: { method: request.method.toUpperCase(), route: pathname, ...(status ? { status } : {}) },
  };
}

export function withNoxCue<Args extends unknown[]>(noxcue: ServerNoxCueClient, handler: WebHandler<Args>, options: NoxCueAdapterOptions = {}): WebHandler<Args> {
  return async (request, ...args) => {
    try {
      const response = await handler(request, ...args);
      if (response.status >= 500) noxcue.capture(responseError(response), details(request, options, response.status));
      return response;
    } catch (error) {
      noxcue.capture(error, details(request, options));
      throw error;
    }
  };
}

interface PagesContext { request: Request; waitUntil(promise: Promise<unknown>): void }

export function withNoxCuePages<Context extends PagesContext>(
  noxcue: ServerNoxCueClient | ((context: Context) => ServerNoxCueClient),
  handler: (context: Context) => Response | Promise<Response>,
  options: NoxCueAdapterOptions = {},
): (context: Context) => Promise<Response> {
  return async (context) => {
    const client = typeof noxcue === "function" ? noxcue(context) : noxcue;
    try {
      const response = await handler(context);
      if (response.status >= 500) context.waitUntil(client.error(responseError(response), details(context.request, options, response.status)));
      return response;
    } catch (error) {
      context.waitUntil(client.error(error, details(context.request, options)));
      throw error;
    }
  };
}

interface ExpressRequest { method?: string; originalUrl?: string; url?: string }

export function noxCueExpressErrorHandler(noxcue: ServerNoxCueClient, options: NoxCueAdapterOptions = {}) {
  return (error: unknown, request: ExpressRequest, _response: unknown, next: (error: unknown) => void): void => {
    const pathname = request.originalUrl ?? request.url ?? "/";
    noxcue.capture(error, {
      title: `${(request.method ?? "REQUEST").toUpperCase()} ${pathname} failed`,
      component: options.component ?? "express.request",
      ...(pathname.startsWith("http") ? { url: pathname } : {}),
      fatal: false,
      unhandled: true,
      attributes: { method: (request.method ?? "REQUEST").toUpperCase(), route: pathname.slice(0, 300) },
    });
    next(error);
  };
}
