import { z } from "zod";
import { getCtx } from "../../lib/db";
import { publishPlatformEvent } from "../../lib/platform-event-store";
import { v1Error, v1Response } from "../../lib/api-v1";

const MAX_REQUEST_BYTES = 12_000;
const HOURLY_LIMIT = 10;

const DeveloperFeedback = z.object({
  area: z.enum(["api", "documentation", "sdk", "product", "other"]),
  category: z.enum(["bug", "friction", "suggestion", "missing_capability", "other"]),
  summary: z.string().trim().min(1).max(240),
  details: z.string().trim().min(1).max(4_000),
  suggestedChange: z.string().trim().min(1).max(2_000).optional(),
  operationId: z.string().trim().min(1).max(160).optional(),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9._:-]{8,160}$/),
  client: z.object({
    name: z.string().trim().min(1).max(80),
    version: z.string().trim().min(1).max(40).optional(),
  }).strict().optional(),
}).strict();

interface Ctx {
  env: Pick<Env, "DB" | "TASK_QUEUE">;
  data: {
    orgId: number;
    projectId: string | null;
    userLogin: string;
    auth?: { type?: string; id?: string };
  };
  request: Request;
}

function sourceId(data: Ctx["data"]): string {
  return data.auth?.type && data.auth.id
    ? `${data.auth.type}:${data.auth.id}`
    : `member:${data.userLogin}`;
}

function containsSensitiveMaterial(input: z.infer<typeof DeveloperFeedback>): boolean {
  const text = JSON.stringify(input);
  return /(?:\bBearer\s+[A-Za-z0-9._~+/-]+=*|nox_(?:sk|at|rt|secret)_[A-Za-z0-9_-]+|gh[opurs]_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i.test(text);
}

async function boundedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) throw new Error("too_large");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_REQUEST_BYTES) throw new Error("too_large");
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function onRequestPost(context: Ctx): Promise<Response> {
  const data = getCtx(context) as Ctx["data"];
  if (!data.orgId || !data.projectId || !data.userLogin) {
    return v1Error("project_required", "Select one active project before submitting developer feedback", 400);
  }
  if (!context.request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return v1Error("unsupported_media_type", "Content-Type must be application/json", 415);
  }

  let input: unknown;
  try {
    input = await boundedJson(context.request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "too_large";
    return v1Error(
      tooLarge ? "payload_too_large" : "invalid_request",
      tooLarge ? "Feedback payload exceeds 12 KB" : "Request body must be valid JSON",
      tooLarge ? 413 : 400,
    );
  }
  const parsed = DeveloperFeedback.safeParse(input);
  if (!parsed.success) {
    return v1Error("validation_failed", "Developer feedback is invalid", 422, { issues: parsed.error.issues });
  }
  if (containsSensitiveMaterial(parsed.data)) {
    return v1Error("sensitive_content_rejected", "Remove credentials or secret material before submitting feedback", 422);
  }

  const submitter = sourceId(data);
  const rate = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM platform_events
      WHERE org_id = ? AND project_id = ? AND source_component = 'noxconnect.developer_feedback'
        AND source_id = ? AND received_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')`,
  ).bind(data.orgId, data.projectId, submitter).first<{ count: number }>();
  if (Number(rate?.count ?? 0) >= HOURLY_LIMIT) {
    return v1Error("rate_limited", "Developer feedback is limited to 10 submissions per hour", 429, undefined, {
      "Retry-After": "3600",
    });
  }

  const eventId = crypto.randomUUID();
  const occurredAt = new Date().toISOString();
  try {
    const publication = await publishPlatformEvent(context.env, {
      specVersion: 1,
      dataVersion: 1,
      id: eventId,
      type: "feedback.developer.submitted",
      orgId: data.orgId,
      projectId: data.projectId,
      source: { component: "noxconnect.developer_feedback", sourceId: submitter },
      subject: { type: "feedback.developer", id: eventId },
      actor: data.auth?.type === "api_token"
        ? { type: "system" }
        : { type: "member", id: data.userLogin },
      message: { title: parsed.data.summary, severity: parsed.data.impact === "high" ? "warning" : "info" },
      occurredAt,
      idempotencyKey: parsed.data.idempotencyKey,
      data: {
        area: parsed.data.area,
        category: parsed.data.category,
        details: parsed.data.details,
        ...(parsed.data.suggestedChange ? { suggestedChange: parsed.data.suggestedChange } : {}),
        ...(parsed.data.operationId ? { operationId: parsed.data.operationId } : {}),
        impact: parsed.data.impact,
        ...(parsed.data.client ? { client: parsed.data.client } : {}),
      },
    });
    return v1Response({
      apiVersion: 1,
      feedback: {
        id: publication.event.id,
        status: "received",
        duplicate: publication.duplicate,
        createdAt: publication.event.receivedAt,
      },
    }, 202);
  } catch (error) {
    console.error("[developer-feedback] submission failed", error);
    return v1Error("feedback_unavailable", "Developer feedback is temporarily unavailable", 503);
  }
}
