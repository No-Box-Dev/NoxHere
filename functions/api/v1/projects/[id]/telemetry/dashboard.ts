import { getCtx, jsonResponse, errorResponse } from "../../../../../lib/db";

const DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
interface Ctx { env: { DB: D1Database }; request: Request; params: { id: string }; data: { orgId: number; projectId?: string | null } }
interface MetricBreakdown { actionLabel: string; windowDays: number; totalActions: number; activeUsers: number; participatingUsers: number; participationRate: number; actionsPerParticipant: number }
interface MetricRow { metric_key: string; label: string; unit: string; period: string; value: number; comparison_value?: number | null; breakdown?: MetricBreakdown }
interface CustomMetricRow { metric_key: string; label: string; period: string; daily_events: number; weekly_events: number; weekly_active: number; weekly_participants: number; previous_weekly_events: number; previous_weekly_active: number }

function activityLabel(label: string) {
  return label.replace(/\s+(written|added|created|completed)$/i, "").trim() || label;
}

export async function onRequestGet(context: Ctx) {
  const { orgId, projectId } = getCtx(context);
  const requestedProject = String(context.params.id || "");
  if (!projectId || projectId !== requestedProject) return errorResponse("Project scope mismatch", 403);
  const range = new URL(context.request.url).searchParams.get("range") || "30d";
  const days = DAYS[range] ?? 30;
  const setting = await context.env.DB.prepare(
    `SELECT window_days FROM cue_engagement_settings WHERE org_id = ? AND project_id = ?`,
  ).bind(orgId, projectId).first<{ window_days: number }>();
  const windowDays = Number(setting?.window_days ?? 7);
  const currentStart = `-${windowDays - 1} days`;
  const previousStart = `-${windowDays * 2 - 1} days`;
  const previousEnd = `-${windowDays} days`;
  const [storedRows, customRows] = await Promise.all([
    context.env.DB.prepare(
      `SELECT metric.metric_key, definition.label, definition.unit, metric.period, metric.value
         FROM cue_daily_metrics metric
         JOIN cue_sources source ON source.id = metric.source_id
         JOIN cue_metric_definitions definition ON definition.key = metric.metric_key
         JOIN cue_project_metric_settings setting
           ON setting.project_id = source.project_id AND setting.metric_key = metric.metric_key
        WHERE source.org_id = ? AND source.project_id = ? AND source.environment = 'production'
          AND source.enabled = 1 AND setting.enabled = 1
          AND metric.metric_key NOT LIKE 'custom.%'
          AND metric.period >= date('now', ?)
        ORDER BY metric.metric_key, metric.period ASC`,
    ).bind(orgId, projectId, `-${days - 1} days`).all<MetricRow>(),
    context.env.DB.prepare(
      `WITH RECURSIVE periods(period) AS (
         SELECT date('now', ?)
         UNION ALL SELECT date(period, '+1 day') FROM periods WHERE period < date('now')
       ), project_sources(id) AS (
         SELECT id FROM cue_sources
          WHERE org_id = ? AND project_id = ? AND environment = 'production' AND enabled = 1
       ), definitions(metric_key, label) AS (
         SELECT DISTINCT metric.metric_key, metric.label
           FROM cue_custom_metrics metric
          WHERE metric.org_id = ? AND metric.enabled = 1
            AND (metric.project_id = ? OR metric.source_id IN (SELECT id FROM project_sources))
       )
       SELECT periods.period, definitions.metric_key, definitions.label,
         (SELECT COUNT(*) FROM cue_activity_events activity
           WHERE activity.source_id IN (SELECT id FROM project_sources)
             AND activity.metric_key = definitions.metric_key
             AND activity.period = periods.period) AS daily_events,
         (SELECT COUNT(*) FROM cue_activity_events activity
           WHERE activity.source_id IN (SELECT id FROM project_sources)
             AND activity.metric_key = definitions.metric_key
             AND activity.period BETWEEN date(periods.period, ?) AND periods.period) AS weekly_events,
         (SELECT COUNT(DISTINCT active.subject_hash) FROM cue_user_active_days active
           WHERE active.source_id IN (SELECT id FROM project_sources)
             AND active.period BETWEEN date(periods.period, ?) AND periods.period) AS weekly_active,
         (SELECT COUNT(DISTINCT activity.subject_hash) FROM cue_activity_events activity
           WHERE activity.source_id IN (SELECT id FROM project_sources)
             AND activity.metric_key = definitions.metric_key
             AND activity.period BETWEEN date(periods.period, ?) AND periods.period
             AND EXISTS (
               SELECT 1 FROM cue_user_active_days active
                WHERE active.source_id = activity.source_id
                  AND active.subject_hash = activity.subject_hash
                  AND active.period BETWEEN date(periods.period, ?) AND periods.period
             )) AS weekly_participants,
         (SELECT COUNT(*) FROM cue_activity_events activity
           WHERE activity.source_id IN (SELECT id FROM project_sources)
             AND activity.metric_key = definitions.metric_key
             AND activity.period BETWEEN date(periods.period, ?) AND date(periods.period, ?)) AS previous_weekly_events,
         (SELECT COUNT(DISTINCT active.subject_hash) FROM cue_user_active_days active
           WHERE active.source_id IN (SELECT id FROM project_sources)
             AND active.period BETWEEN date(periods.period, ?) AND date(periods.period, ?)) AS previous_weekly_active
       FROM periods CROSS JOIN definitions
       ORDER BY definitions.metric_key, periods.period`,
    ).bind(`-${days - 1} days`, orgId, projectId, orgId, projectId,
      currentStart, currentStart, currentStart, currentStart,
      previousStart, previousEnd, previousStart, previousEnd).all<CustomMetricRow>(),
  ]);

  const rows: MetricRow[] = [...(storedRows.results ?? [])];
  for (const row of customRows.results ?? []) {
    rows.push({ metric_key: row.metric_key, label: row.label, unit: "count", period: row.period, value: Number(row.daily_events ?? 0) });
    const weeklyActive = Number(row.weekly_active ?? 0);
    const weeklyTotal = Number(row.weekly_events ?? 0);
    const participants = Number(row.weekly_participants ?? 0);
    const previousWeeklyActive = Number(row.previous_weekly_active ?? 0);
    if (weeklyActive > 0) rows.push({
      metric_key: `${row.metric_key}.per_mau`,
      label: `${activityLabel(row.label)} per active user`,
      unit: "decimal",
      period: row.period,
      value: weeklyTotal / weeklyActive,
      comparison_value: previousWeeklyActive > 0 ? Number(row.previous_weekly_events ?? 0) / previousWeeklyActive : null,
      breakdown: {
        actionLabel: activityLabel(row.label).toLowerCase(), windowDays, totalActions: weeklyTotal,
        activeUsers: weeklyActive, participatingUsers: participants,
        participationRate: participants / weeklyActive,
        actionsPerParticipant: participants > 0 ? weeklyTotal / participants : 0,
      },
    });
  }

  const grouped = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const records = grouped.get(String(row.metric_key)) ?? [];
    records.push(row);
    grouped.set(String(row.metric_key), records);
  }
  const stats = [...grouped.entries()].map(([id, records]) => {
    const latest = records.at(-1)!;
    const previous = records.at(-2) ?? latest;
    const value = Number(latest.value);
    const perMau = id.endsWith(".per_mau");
    const prior = perMau && latest.comparison_value != null ? Number(latest.comparison_value) : Number(previous.value);
    const delta = value - prior;
    const ratio = latest.unit === "ratio";
    const percent = prior === 0 ? 0 : Math.abs((delta / prior) * 100);
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "same";
    const arrow = delta > 0 ? "↑" : "↓";
    const comparisonPeriod = perMau ? `previous ${windowDays} days` : "yesterday";
    const change = perMau && latest.comparison_value == null
      ? `No previous ${windowDays}-day baseline`
      : perMau && prior === 0 && value > 0
        ? `New vs previous ${windowDays} days`
        : delta === 0
          ? `Same as ${comparisonPeriod}`
          : ratio
            ? `${arrow} ${Math.abs(delta * 100).toFixed(1)}pp vs ${comparisonPeriod}`
            : perMau
              ? `${arrow} ${percent.toFixed(1)}% vs ${comparisonPeriod}`
              : `${arrow} ${Math.abs(delta).toLocaleString()} · ${percent.toFixed(1)}% vs ${comparisonPeriod}`;
    const average = records.reduce((sum, row) => sum + Number(row.value), 0) / records.length;
    return {
      id, name: String(latest.label),
      value: ratio ? `${(value * 100).toFixed(1)}%` : perMau ? value.toFixed(2) : value.toLocaleString(),
      context: perMau ? `Last ${windowDays} days` : `${days}d avg ${ratio ? `${(average * 100).toFixed(1)}%` : average.toFixed(1)}`,
      change, direction, points: records.map((row) => Number(row.value)),
      ...(latest.breakdown ? { breakdown: latest.breakdown } : {}),
    };
  });
  const latestPeriod = rows.reduce((latest, row) => row.period > latest ? row.period : latest, "");
  return jsonResponse({ range, dateLabel: latestPeriod || "No reports", reportStatus: stats.length ? "Reported" : "Waiting", stats });
}
