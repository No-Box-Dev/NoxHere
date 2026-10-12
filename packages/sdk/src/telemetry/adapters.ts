import type { TelemetryAdapterOptions, ServerTelemetryClient } from "./types.js";

type WebHandler<Args extends unknown[]> = (request: Request, ...args: Args) => Response | Promise<Response>;

function responseError(response: Response): Error & { status: number; code: string } {
  return Object.assign(new Error(`HTTP ${response.status} returned by the request handler`), {
    name: "HTTPResponseError", status: response.status, code: `HTTP_${response.status}`,
  });
}

function details(request: Request, options: TelemetryAdapterOptions, status?: number) {
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

export function withTelemetry<Args extends unknown[]>(telemetry: ServerTelemetryClient, handler: WebHandler<Args>, options: TelemetryAdapterOptions = {}): WebHandler<Args> {
  return async (request, ...args) => {
    try {
      const response = await handler(request, ...args);
      if (response.status >= 500) telemetry.capture(responseError(response), details(request, options, response.status));
      return response;
    } catch (error) {
      telemetry.capture(error, details(request, options));
      throw error;
    }
  };
}

interface PagesContext { request: Request; waitUntil(promise: Promise<unknown>): void }

export function withTelemetryPages<Context extends PagesContext>(
  telemetry: ServerTelemetryClient | ((context: Context) => ServerTelemetryClient),
  handler: (context: Context) => Response | Promise<Response>,
  options: TelemetryAdapterOptions = {},
): (context: Context) => Promise<Response> {
  return async (context) => {
    const client = typeof telemetry === "function" ? telemetry(context) : telemetry;
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

export function telemetryExpressErrorHandler(telemetry: ServerTelemetryClient, options: TelemetryAdapterOptions = {}) {
  return (error: unknown, request: ExpressRequest, _response: unknown, next: (error: unknown) => void): void => {
    const method = (request.method ?? "REQUEST").toUpperCase();
    telemetry.capture(error, {
      title: `${method} request failed`,
      component: options.component ?? "express.request",
      fatal: false,
      unhandled: true,
      attributes: { method, ...(options.route ? { route: options.route } : {}) },
    });
    next(error);
  };
}
