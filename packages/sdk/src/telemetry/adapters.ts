import type { NoxCueAdapterOptions, ServerNoxCueClient } from "./types.js";

type WebHandler<Args extends unknown[]> = (request: Request, ...args: Args) => Response | Promise<Response>;

function responseError(response: Response): Error & { status: number; code: string } {
  return Object.assign(new Error(`HTTP ${response.status} returned by the request handler`), {
    name: "HTTPResponseError", status: response.status, code: `HTTP_${response.status}`,
  });
}

function details(request: Request, options: NoxCueAdapterOptions, status?: number) {
  const method = request.method.toUpperCase();
  return {
    title: `${method} request failed`,
    message: status ? `The request handler returned HTTP ${status}.` : "The request handler threw an unexpected error.",
    component: options.component ?? "server.request",
    fatal: false,
    unhandled: true,
    attributes: { method, ...(options.route ? { route: options.route } : {}), ...(status ? { status } : {}) },
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
    const method = (request.method ?? "REQUEST").toUpperCase();
    noxcue.capture(error, {
      title: `${method} request failed`,
      component: options.component ?? "express.request",
      fatal: false,
      unhandled: true,
      attributes: { method, ...(options.route ? { route: options.route } : {}) },
    });
    next(error);
  };
}
