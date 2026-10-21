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
  "subscription.reactivated",
] as const;

interface Ctx {
  env: { DB: D1Database };
  request: Request;
  params: { id: string };
  data: { orgId: number; projectId?: string | null };
}

interface GrowthRow { period: string; name: string; value: number }
interface GrowthUniqueRow { name: string; value: number }
interface GrowthAcquisitionRow {
  label: string;
  visitors: number;
  trials: number;
  paid: number;
  revenueMinor: number;
  currency: string | null;
}

function acquisitionSql(dimension: "channel" | "campaign" | "landing_path", allTime: boolean) {
  const label = dimension === "channel" ? "dimension.channel"
    : dimension === "campaign" ? "COALESCE(dimension.campaign, 'Unattributed')"
      : "COALESCE(dimension.landing_path, 'Unknown landing page')";
  return `SELECT ${label} AS label,
      COUNT(DISTINCT CASE WHEN dimension.name = 'website.page_visited'
        THEN COALESCE(dimension.visitor_hash, dimension.event_id) END) AS visitors,
      COUNT(DISTINCT CASE WHEN dimension.name = 'subscription.trial_started'
        THEN COALESCE(dimension.user_hash, dimension.visitor_hash, dimension.event_id) END) AS trials,
      COUNT(DISTINCT CASE WHEN dimension.name = 'subscription.paid_started'
        THEN COALESCE(dimension.user_hash, dimension.visitor_hash, dimension.event_id) END) AS paid,
      COALESCE(SUM(CASE WHEN dimension.name = 'subscription.paid_started'
        THEN dimension.amount_minor ELSE 0 END), 0) AS revenueMinor,
      CASE WHEN COUNT(DISTINCT dimension.currency) <= 1 THEN MAX(dimension.currency) END AS currency
    FROM growth_event_dimensions dimension
    JOIN telemetry_sources source ON source.id = dimension.source_id
   WHERE source.org_id = ? AND source.project_id = ? AND source.capability = 'growth'
     AND source.environment = 'production' AND source.enabled = 1
     ${allTime ? "" : "AND dimension.occurred_at >= datetime('now', ?)"}
   GROUP BY ${label}
   HAVING visitors > 0 OR trials > 0 OR paid > 0
   ORDER BY paid DESC, revenueMinor DESC, visitors DESC
   LIMIT 12`;
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId } = getCtx(context);
  const requestedProject = String(context.params.id || "");
  if (!projectId || projectId !== requestedProject) return errorResponse("Project scope mismatch", 403);
  const requestedRange = new URL(context.request.url).searchParams.get("range") || "30d";
  const range = requestedRange === "all" || Object.hasOwn(DAYS, requestedRange) ? requestedRange : "30d";
  const allTime = range === "all";
  let days = DAYS[range] ?? 1;
  if (allTime) {
    const earliest = await context.env.DB.prepare(
      `SELECT MIN(day) AS day FROM (
         SELECT event.period AS day
           FROM telemetry_tracked_events event
           JOIN telemetry_sources source ON source.id = event.source_id
          WHERE source.org_id = ? AND source.project_id = ? AND source.capability = 'growth'
            AND source.environment = 'production' AND source.enabled = 1
         UNION ALL
         SELECT date(dimension.occurred_at) AS day
           FROM growth_event_dimensions dimension
           JOIN telemetry_sources source ON source.id = dimension.source_id
          WHERE source.org_id = ? AND source.project_id = ? AND source.capability = 'growth'
            AND source.environment = 'production' AND source.enabled = 1
       )`,
    ).bind(orgId, projectId, orgId, projectId).first<{ day: string | null }>();
    if (earliest?.day) {
      const firstDay = Date.parse(`${earliest.day}T00:00:00Z`);
      if (Number.isFinite(firstDay)) days = Math.max(1, Math.floor((Date.now() - firstDay) / 86_400_000) + 1);
    }
  }
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

  const since = `-${days - 1} days`;
  const timeCondition = allTime ? "" : "AND dimension.occurred_at >= datetime('now', ?)";
  const dimensionBindings = (extra: unknown[] = []) => allTime ? [orgId, projectId, ...extra] : [orgId, projectId, since, ...extra];
  const [uniqueResult, channelsResult, campaignsResult, landingPagesResult] = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT dimension.name,
          COUNT(DISTINCT COALESCE(dimension.user_hash, dimension.visitor_hash, dimension.event_id)) AS value
         FROM growth_event_dimensions dimension
         JOIN telemetry_sources source ON source.id = dimension.source_id
        WHERE source.org_id = ? AND source.project_id = ? AND source.capability = 'growth'
          AND source.environment = 'production' AND source.enabled = 1
          ${timeCondition}
        GROUP BY dimension.name`,
    ).bind(...dimensionBindings()),
    context.env.DB.prepare(acquisitionSql("channel", allTime)).bind(...dimensionBindings()),
    context.env.DB.prepare(acquisitionSql("campaign", allTime)).bind(...dimensionBindings()),
    context.env.DB.prepare(acquisitionSql("landing_path", allTime)).bind(...dimensionBindings()),
  ]);

  const byName = new Map<string, GrowthRow[]>();
  for (const row of rows.results ?? []) {
    const records = byName.get(row.name) ?? [];
    records.push({ ...row, value: Number(row.value ?? 0) });
    byName.set(row.name, records);
  }
  const total = (name: string) => (byName.get(name) ?? []).reduce((sum, row) => sum + row.value, 0);
  const series = (name: string) => (byName.get(name) ?? []).map((row) => row.value);
  const unique = new Map((uniqueResult.results as unknown as GrowthUniqueRow[] | undefined)?.map((row) => [row.name, Number(row.value)]) ?? []);
  const count = (name: string) => unique.get(name) ?? total(name);
  const trials = count("subscription.trial_started");
  const paid = count("subscription.paid_started");
  const acquisitionRows = (result: D1Result<unknown>) => ((result.results ?? []) as unknown as GrowthAcquisitionRow[]).map((row) => ({
    label: row.label,
    visitors: Number(row.visitors ?? 0),
    trials: Number(row.trials ?? 0),
    paid: Number(row.paid ?? 0),
    revenueMinor: Number(row.revenueMinor ?? 0),
    currency: row.currency,
  }));
  const channels = acquisitionRows(channelsResult);
  const revenueCurrencies = [...new Set(channels.map((row) => row.currency).filter((currency): currency is string => Boolean(currency)))];
  const latestPeriod = (rows.results ?? []).at(-1)?.period ?? "No events";
  return jsonResponse({
    projectId,
    range,
    dateLabel: latestPeriod,
    metrics: [
      { id: "website.page_visited", label: "Unique visitors", value: count("website.page_visited"), points: series("website.page_visited") },
      { id: "website.demo_clicked", label: "Demo clicks", value: count("website.demo_clicked"), points: series("website.demo_clicked") },
      { id: "website.signup_clicked", label: "Signup intent", value: count("website.signup_clicked"), points: series("website.signup_clicked") },
      { id: "subscription.trial_started", label: "Trials started", value: trials, points: series("subscription.trial_started") },
      { id: "subscription.paid_started", label: "Paid conversions", value: paid, points: series("subscription.paid_started") },
      { id: "subscription.cancelled", label: "Cancellations", value: count("subscription.cancelled"), points: series("subscription.cancelled") },
      { id: "subscription.reactivated", label: "Reactivations", value: count("subscription.reactivated"), points: series("subscription.reactivated") },
    ],
    funnel: {
      visits: count("website.page_visited"),
      signupIntents: count("website.signup_clicked"),
      trials,
      paid,
      cancelled: count("subscription.cancelled"),
      trialToPaidRate: trials > 0 ? paid / trials : null,
    },
    revenue: {
      amountMinor: channels.reduce((sum, row) => sum + row.revenueMinor, 0),
      currency: revenueCurrencies.length === 1 ? revenueCurrencies[0] : null,
    },
    acquisition: {
      channels,
      campaigns: acquisitionRows(campaignsResult),
      landingPages: acquisitionRows(landingPagesResult),
    },
  });
}
