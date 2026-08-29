export interface NoxCueOptions {
  endpoint: string;
  ingestKey: string;
}

export interface ErrorCueInput {
  title: string;
  message?: string;
  occurredAt?: string;
  url?: string;
  idempotencyKey?: string;
  data?: {
    errorCode?: string;
    fingerprint?: string;
    component?: string;
    environment?: string;
    affectedUser?: string;
    fatal?: boolean;
    unhandled?: boolean;
  };
}

export function createNoxCue(options: NoxCueOptions) {
  async function post(body: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${options.endpoint.replace(/\/$/, "")}/v1/events`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "X-Nox-Ingest-Key": options.ingestKey,
      },
      body: JSON.stringify({ version: 1, ...body }),
    });
    if (!response.ok) throw new Error(`NoxCue rejected the event (${response.status})`);
    const result = await response.json() as { eventId: string };
    return result.eventId;
  }

  return {
    userRegistered: (userId: string, occurredAt?: string) =>
      post({ type: "user.registered", userId, ...(occurredAt ? { occurredAt } : {}) }),
    userActive: (userId: string, occurredAt?: string) =>
      post({ type: "user.active", userId, ...(occurredAt ? { occurredAt } : {}) }),
    error: (input: ErrorCueInput) => post({ type: "error.occurred", ...input }),
  };
}
