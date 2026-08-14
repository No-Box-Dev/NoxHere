export interface NoxAlertOptions {
  endpoint: string;
  ingestKey: string;
  service: string;
  environment: string;
  release?: string;
}

interface ErrorContext {
  route?: string;
  tags?: Record<string, string>;
  traceId?: string;
  spanId?: string;
}

const lastSent = new Map<string, number>();
const CLIENT_DUPLICATE_WINDOW_MS = 10_000;

export function createNoxAlert(options: NoxAlertOptions) {
  async function capture(reason: unknown, context: ErrorContext = {}): Promise<void> {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const localFingerprint = `${error.name}:${error.message}:${error.stack?.split("\n")[1] ?? ""}`;
    const now = Date.now();
    if (now - (lastSent.get(localFingerprint) ?? 0) < CLIENT_DUPLICATE_WINDOW_MS) return;
    lastSent.set(localFingerprint, now);
    if (lastSent.size > 1_000) {
      const oldest = lastSent.keys().next().value as string | undefined;
      if (oldest) lastSent.delete(oldest);
    }

    const response = await fetch(`${options.endpoint.replace(/\/$/, "")}/v1/errors`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "X-Nox-Ingest-Key": options.ingestKey,
      },
      body: JSON.stringify({
        version: 1,
        eventId: crypto.randomUUID(),
        occurredAt: new Date(now).toISOString(),
        service: options.service,
        environment: options.environment,
        release: options.release,
        error: { type: error.name, message: error.message, stack: error.stack },
        page: { url: window.location.href, route: context.route },
        trace: context.traceId ? { traceId: context.traceId, spanId: context.spanId } : undefined,
        tags: context.tags,
      }),
    });
    if (!response.ok && response.status !== 429) {
      throw new Error(`NoxAlert rejected the error (${response.status})`);
    }
  }

  function installGlobalHandlers(): () => void {
    // Reporting failures must never create another unhandled rejection and
    // recursively report themselves.
    const onError = (event: ErrorEvent) => {
      void capture(event.error ?? event.message).catch(() => undefined);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      void capture(event.reason).catch(() => undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }

  return { capture, installGlobalHandlers };
}
