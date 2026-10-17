import { getCtx, jsonResponse, errorResponse } from "../../../../../lib/db";

const DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
const EVENT_NAMES = [
  "website.page_visited",
  "website.demo_clicked",
  "website.signup_clicked",
  "website.pricing_clicked",
  "website.login_clicked",
  "website.contact_clicked",
  "subscription.trial_started",
  "subscription.paid_started",
  "subscription.cancelled",
] as const;

interface Ctx {
  env: { DB: D1Database };
  request: Request;
  params: { id: string };
  data: { orgId: number; projectId?: string | null };
}

interface GrowthRow { period: string; name: string; value: number }

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId } = getCtx(context);
  const requestedProject = String(context.params.id || "");
  if (!projectId || projectId !== requestedProject) return errorResponse("Project scope mismatch", 403);
  const requestedRange = new URL(context.request.url).searchParams.get("range") || "30d";
  const range = Object.hasOwn(DAYS, requestedRange) ? requestedRange : "30d";
  const days = DAYS[range]!;
  const rows = await context.env.DB.prepare(
    `WITH RECURSIVE periods(period) AS (
       SELECT date('now', ?)
       UNION ALL SELECT date(period, '+1 day') FROM periods WHERE period < date('now')
     ), project_sources(id) AS (
       SELECT id FROM telemetry_sources
        WHERE org_id = ? AND project_id = ? AND capability = 'growth'
          AND environment = 'production' AND enabled = 1
     ), names(name) AS (VALUES ${EVENT_NAMES.map(() => "(?)").join(", ")})
     SELECT periods.period, names.name,
       COALESCE((SELECT SUM(event.value) FROM telemetry_tracked_events event
         WHERE event.source_id IN (SELECT id FROM project_sources)
           AND event.name = names.name AND event.period = periods.period), 0) AS value
     FROM periods CROSS JOIN names
     ORDER BY periods.period, names.name`,
  ).bind(`-${days - 1} days`, orgId, projectId, ...EVENT_NAMES).all<GrowthRow>();

  const byName = new Map<string, GrowthRow[]>();
  for (const row of rows.results ?? []) {
    const records = byName.get(row.name) ?? [];
    records.push({ ...row, value: Number(row.value ?? 0) });
    byName.set(row.name, records);
  }
  const total = (name: string) => (byName.get(name) ?? []).reduce((sum, row) => sum + row.value, 0);
  const series = (name: string) => (byName.get(name) ?? []).map((row) => row.value);
  const trials = total("subscription.trial_started");
  const paid = total("subscription.paid_started");
  const latestPeriod = (rows.results ?? []).at(-1)?.period ?? "No events";
  return jsonResponse({
    projectId,
    range,
    dateLabel: latestPeriod,
    metrics: [
      { id: "website.page_visited", label: "Page visits", value: total("website.page_visited"), points: series("website.page_visited") },
      { id: "website.demo_clicked", label: "Demo clicks", value: total("website.demo_clicked"), points: series("website.demo_clicked") },
      { id: "website.signup_clicked", label: "Signup clicks", value: total("website.signup_clicked"), points: series("website.signup_clicked") },
      { id: "subscription.trial_started", label: "Trials started", value: trials, points: series("subscription.trial_started") },
      { id: "subscription.paid_started", label: "Paid conversions", value: paid, points: series("subscription.paid_started") },
      { id: "subscription.cancelled", label: "Cancellations", value: total("subscription.cancelled"), points: series("subscription.cancelled") },
    ],
    funnel: {
      visits: total("website.page_visited"),
      signupIntents: total("website.signup_clicked"),
      trials,
      paid,
      cancelled: total("subscription.cancelled"),
      trialToPaidRate: trials > 0 ? paid / trials : null,
    },
  });
}
