export interface ActivityScope {
  orgId: number;
  sourceId: string;
  projectId: string | null;
}

interface CustomActivityMetricRow {
  label: string;
}

export interface ResolvedActivityMetric {
  key: string;
  label: string;
}

export async function resolveActivityMetric(
  env: Env,
  scope: ActivityScope,
  key: string,
): Promise<ResolvedActivityMetric | null> {
  if (!key.startsWith("custom.")) return null;
  const metric = await env.NOX_DB.prepare(
    `SELECT label
       FROM cue_custom_metrics
      WHERE org_id = ? AND metric_key = ? AND enabled = 1
        AND ((? IS NOT NULL AND project_id = ?)
          OR (? IS NULL AND source_id = ?))`,
  ).bind(scope.orgId, key, scope.projectId, scope.projectId, scope.projectId, scope.sourceId)
    .first<CustomActivityMetricRow>();
  return metric ? { key, label: metric.label } : null;
}
