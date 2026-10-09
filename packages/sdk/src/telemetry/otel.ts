import type { DeliveryResult, ServerNoxCueClient } from "./types.js";

export interface NoxCueReadableSpan {
  attributes?: Readonly<Record<string, unknown>>;
}

export interface NoxCueSpanProcessor {
  onStart(): void;
  onEnd(span: NoxCueReadableSpan): void;
  forceFlush(): Promise<DeliveryResult[]>;
  shutdown(): Promise<DeliveryResult[]>;
}

/**
 * Minimal OpenTelemetry-compatible span processor for explicitly marked
 * product events. It ignores every span unless `noxhere.event.name` and
 * `noxhere.user.id` are both present, so request paths and health data are
 * never captured automatically.
 */
export function createNoxCueSpanProcessor(client: ServerNoxCueClient): NoxCueSpanProcessor {
  return {
    onStart: () => undefined,
    onEnd: (span) => {
      const attributes = span.attributes ?? {};
      const name = attributes["noxhere.event.name"];
      const userId = attributes["noxhere.user.id"];
      if (typeof name !== "string" || typeof userId !== "string") return;
      const values = Object.entries(attributes).flatMap(([key, value]) => key.startsWith("noxhere.event.attribute.")
        && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        ? [[key.slice("noxhere.event.attribute.".length), value] as const]
        : []);
      void client.track(name as `custom.${string}`, { userId, attributes: Object.fromEntries(values) });
    },
    forceFlush: () => client.flush(),
    shutdown: async () => {
      const deliveries = await client.flush();
      client.close();
      return deliveries;
    },
  };
}
