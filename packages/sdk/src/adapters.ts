import type { NoxCueAdapterOptions, ServerNoxCueClient } from "./types.js";

type WebHandler<Args extends unknown[]> = (request: Request, ...args: Args) => Response | Promise<Response>;

function route(request: Request): string {
  try { return new URL(request.url).pathname; }
  catch { return "/"; }
}

function responseError(response: Response): Error & { status: number; code: string } {
  return Object.assign(new Error(`HTTP ${response.status} returned by the request handler`), {
    name: "HTTPResponseError",
    status: response.status,
    code: `HTTP_${response.status}`,
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

/** Wrap Fetch/Next.js-style handlers without changing their result or error. */
export function withNoxCue<Args extends unknown[]>(
  noxcue: ServerNoxCueClient,
  handler: WebHandler<Args>,
  options: NoxCueAdapterOptions = {},
): WebHandler<Args> {
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

interface PagesContext<Env> {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
}

type PagesClient<Env> = ServerNoxCueClient | ((context: PagesContext<Env>) => ServerNoxCueClient);

/** Cloudflare Pages adapter that keeps delivery alive after the response. */
export function withNoxCuePages<Env>(
  noxcue: PagesClient<Env>,
  handler: (context: PagesContext<Env>) => Response | Promise<Response>,
  options: NoxCueAdapterOptions = {},
): (context: PagesContext<Env>) => Promise<Response> {
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
type ExpressNext = (error?: unknown) => void;

/** Express-compatible terminal error middleware; always forwards the error. */
export function noxCueExpressErrorHandler(noxcue: ServerNoxCueClient, options: NoxCueAdapterOptions = {}) {
  return (error: unknown, request: ExpressRequest, _response: unknown, next: ExpressNext): void => {
    const pathname = request.originalUrl ?? request.url ?? "/";
    const errorUrl = pathname.startsWith("http") ? { url: pathname } : {};
    noxcue.capture(error, {
      title: `${(request.method ?? "REQUEST").toUpperCase()} ${pathname} failed`,
      component: options.component ?? "express.request",
      ...errorUrl,
      fatal: false,
      unhandled: true,
      attributes: { method: (request.method ?? "REQUEST").toUpperCase(), route: pathname.slice(0, 300) },
    });
    next(error);
  };
}
