import { z } from "zod";

export const APPLE_METRIC_KEYS = [
  "apple.downloads.total",
  "apple.downloads.first_time",
  "apple.downloads.redownloads",
  "apple.installations",
  "apple.deletions",
  "apple.sessions",
  "apple.crashes",
] as const;

const appleMetricsSchema = z.object({
  "apple.downloads.total": z.number().finite().optional(),
  "apple.downloads.first_time": z.number().finite().optional(),
  "apple.downloads.redownloads": z.number().finite().optional(),
  "apple.installations": z.number().finite().optional(),
  "apple.deletions": z.number().finite().optional(),
  "apple.sessions": z.number().finite().optional(),
  "apple.crashes": z.number().finite().optional(),
}).strict().refine((metrics) => Object.values(metrics).some((value) => value !== undefined), {
  message: "At least one Apple metric is required",
});

export const appleAnalyticsBatchSchema = z.object({
  version: z.literal(1),
  provider: z.literal("apple-app-store-connect"),
  organizationId: z.number().int().positive(),
  sourceId: z.string().trim().min(1).max(120),
  batchId: z.string().trim().min(1).max(240),
  values: z.array(z.object({
    period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    metrics: appleMetricsSchema,
  }).strict()).min(1).max(62),
}).strict();

export type AppleAnalyticsBatch = z.infer<typeof appleAnalyticsBatchSchema>;

interface ExistingContributionRow {
  period: string;
  metric_key: string;
}

export async function ingestAppleAnalyticsBatch(db: D1Database, input: unknown) {
  const batch = appleAnalyticsBatchSchema.parse(input);
  const source = await db.prepare(
    `SELECT id FROM cue_sources
      WHERE id = ? AND org_id = ? AND enabled = 1 AND environment = 'production'`,
  ).bind(batch.sourceId, batch.organizationId).first<{ id: string }>();
  if (!source) throw new Error("apple_source_not_found");

  const existing = await db.prepare(
    `SELECT period, metric_key FROM cue_external_metric_contributions
      WHERE source_id = ? AND provider = ? AND batch_id = ?`,
  ).bind(batch.sourceId, batch.provider, batch.batchId).all<ExistingContributionRow>();

  const affected = new Set<string>();
  const affectedPeriods = new Set<string>();
  for (const row of existing.results ?? []) {
    affected.add(`${row.period}\u0000${row.metric_key}`);
    affectedPeriods.add(row.period);
  }
  for (const value of batch.values) {
    affectedPeriods.add(value.period);
    for (const [metricKey, metricValue] of Object.entries(value.metrics)) {
      if (metricValue !== undefined) affected.add(`${value.period}\u0000${metricKey}`);
    }
  }

  const now = new Date().toISOString();
  const contributions = batch.values.flatMap((value) => Object.entries(value.metrics)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(([metricKey, metricValue]) => ({ period: value.period, metricKey, value: metricValue })));
  const periodsJson = JSON.stringify([...affectedPeriods]);
  const statements = [db.prepare(
    `DELETE FROM cue_external_metric_contributions
      WHERE source_id = ? AND provider = ? AND batch_id = ?`,
  ).bind(batch.sourceId, batch.provider, batch.batchId)];
  statements.push(db.prepare(
    `INSERT INTO cue_external_metric_contributions
       (org_id, source_id, provider, batch_id, period, metric_key, value, created_at, updated_at)
     SELECT ?, ?, ?, ?,
            json_extract(item.value, '$.period'),
            json_extract(item.value, '$.metricKey'),
            CAST(json_extract(item.value, '$.value') AS REAL), ?, ?
       FROM json_each(?) AS item`,
  ).bind(
    batch.organizationId, batch.sourceId, batch.provider, batch.batchId,
    now, now, JSON.stringify(contributions),
  ));
  statements.push(db.prepare(
    `DELETE FROM cue_daily_metrics
      WHERE source_id = ?
        AND metric_key IN (${APPLE_METRIC_KEYS.map(() => "?").join(", ")})
        AND period IN (SELECT value FROM json_each(?))`,
  ).bind(batch.sourceId, ...APPLE_METRIC_KEYS, periodsJson));
  statements.push(db.prepare(
    `INSERT INTO cue_daily_metrics
       (org_id, source_id, period, metric_key, value, origin, formula_version, reported_at, updated_at)
     SELECT org_id, source_id, period, metric_key, SUM(value), 'reported', NULL, ?, ?
       FROM cue_external_metric_contributions
      WHERE source_id = ? AND provider = ?
        AND period IN (SELECT value FROM json_each(?))
      GROUP BY org_id, source_id, period, metric_key`,
  ).bind(now, now, batch.sourceId, batch.provider, periodsJson));

  await db.batch(statements);
  return { ok: true, affectedMetrics: affected.size };
}
