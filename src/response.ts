const CONTRACT = "noxcue.response" as const;
const VERSION = 1 as const;

export interface MetricComparison {
  yesterday: number | null;
  average30d: number | null;
  sampleDays: number;
  history?: Array<{ period: string; value: number }>;
}

export type MetricComparisons = Record<string, MetricComparison>;

export interface DisplayMetric {
  key: string;
  label: string;
  kind: "count" | "ratio" | "decimal";
  group: "Growth" | "Engagement" | "App Store" | "Activity";
}

export const DISPLAY_METRICS: DisplayMetric[] = [
  { key: "users.new", label: "New users", kind: "count", group: "Growth" },
  { key: "users.total", label: "Total users", kind: "count", group: "Growth" },
  { key: "users.active.daily", label: "Daily active", kind: "count", group: "Engagement" },
  { key: "users.active.weekly", label: "Weekly active", kind: "count", group: "Engagement" },
  { key: "users.active.monthly", label: "Monthly active", kind: "count", group: "Engagement" },
  { key: "users.stickiness.dau_mau", label: "DAU / MAU", kind: "ratio", group: "Engagement" },
  { key: "apple.downloads.total", label: "App Store downloads", kind: "count", group: "App Store" },
  { key: "apple.downloads.first_time", label: "First-time downloads", kind: "count", group: "App Store" },
  { key: "apple.downloads.redownloads", label: "Redownloads", kind: "count", group: "App Store" },
  { key: "apple.installations", label: "App installations", kind: "count", group: "App Store" },
  { key: "apple.deletions", label: "App deletions", kind: "count", group: "App Store" },
  { key: "apple.sessions", label: "App sessions (opt-in)", kind: "count", group: "App Store" },
  { key: "apple.crashes", label: "App crashes (opt-in)", kind: "count", group: "App Store" },
];

export function displayMetricsFor(metrics: Record<string, number>, labels: Record<string, string> = {}): DisplayMetric[] {
  const custom = Object.keys(metrics)
    .filter((key) => key.startsWith("custom."))
    .sort()
    .map((key) => {
      const perUser = key.endsWith(".per_user");
      const base = key.replace(/^custom\./, "").replace(/\.per_user$/, "");
      const words = base.split(".").join(" ").replace(/_/g, " ");
      const fallback = `${words.charAt(0).toUpperCase()}${words.slice(1)}${perUser ? " / user" : ""}`;
      const label = labels[key]?.trim() || fallback;
      return { key, label, kind: perUser ? "decimal" as const : "count" as const, group: "Activity" as const };
    });
  return [...DISPLAY_METRICS, ...custom];
}

export function buildTestResponse(orgLogin: string) {
  requireText(orgLogin, "orgLogin", 200);
  return {
    contract: CONTRACT,
    version: VERSION,
    message: {
      text: `NoxCue delivery test for ${orgLogin}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "NoxCue delivery test", emoji: true } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Important moments from *${escapeMrkdwn(orgLogin)}* can reach this channel.`,
          },
        },
      ],
    },
  };
}

export function buildDigestResponse(
  sourceName: string,
  period: string,
  metrics: Record<string, number>,
  comparisons: MetricComparisons = {},
  chartImageUrl?: string,
  narration?: string,
  metricLabels: Record<string, string> = {},
) {
  requireText(sourceName, "sourceName", 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error("Invalid NoxCue period");
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) throw new Error("Invalid NoxCue metrics");
  const visibleMetrics = displayMetricsFor(metrics, metricLabels).filter(({ key }) => {
    const value = metrics[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  });
  if (visibleMetrics.length === 0) {
    throw new Error("NoxCue digest has no supported user statistics");
  }
  const displayDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${period}T00:00:00Z`));
  const blocks: Array<Record<string, unknown>> = [
    { type: "header", text: { type: "plain_text", text: `📊 ${sourceName} · Daily pulse`, emoji: true } },
    { type: "context", elements: [{ type: "mrkdwn", text: `${displayDate} · UTC · completed day` }] },
  ];
  if (narration) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `✨ *In brief*\n${escapeMrkdwn(narration)}` },
    });
  }
  if (chartImageUrl) {
    blocks.push({
      type: "image",
      image_url: chartImageUrl,
      alt_text: chartAltText(sourceName, visibleMetrics, metrics, comparisons),
    });
  }
  if (!chartImageUrl) {
    for (const group of ["Growth", "Engagement", "App Store", "Activity"] as const) {
      const groupMetrics = visibleMetrics.filter((metric) => metric.group === group);
      if (groupMetrics.length === 0) continue;
      const groupIcon = group === "Growth" ? "🌱" : group === "Engagement" ? "⚡" : group === "App Store" ? "🍎" : "✍️";
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${groupIcon} ${group}*` } });
      blocks.push({
        type: "section",
        fields: groupMetrics.map((metric) => ({
          type: "mrkdwn",
          text: metricField(metric.label, metrics[metric.key]!, metric.kind, comparisons[metric.key]),
        })),
      });
    }
  }
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "NoxCue · Solid: daily values · Dashed: 30d average · completed days only" }],
  });
  const newUsers = metrics["users.new"];
  const summary = typeof newUsers === "number"
    ? `${formatMetric(newUsers, "count", false)} new users`
    : `${visibleMetrics.length} daily statistics`;
  return {
    contract: CONTRACT,
    version: VERSION,
    kind: "daily_digest" as const,
    message: {
      text: `${sourceName}: ${summary} on ${period}`,
      blocks,
    },
  };
}

function metricField(
  label: string,
  value: number,
  kind: DisplayMetric["kind"],
  comparison: MetricComparison | undefined,
): string {
  const yesterday = validComparisonValue(comparison?.yesterday)
    ? formatMetric(comparison.yesterday, kind, false)
    : "—";
  const average = validComparisonValue(comparison?.average30d)
    ? formatMetric(comparison.average30d, kind, true)
    : "—";
  return [
    `*${label}*`,
    `*${formatMetric(value, kind, false)}*  ${formatDelta(value, comparison?.yesterday, kind)}`,
    `Yesterday ${yesterday} · 30d avg ${average}`,
  ].join("\n");
}

function chartAltText(
  sourceName: string,
  visibleMetrics: DisplayMetric[],
  metrics: Record<string, number>,
  comparisons: MetricComparisons,
): string {
  const summary = visibleMetrics
    .map((metric) => {
      const comparison = comparisons[metric.key];
      const average = validComparisonValue(comparison?.average30d)
        ? formatMetric(comparison.average30d, metric.kind, true)
        : "unavailable";
      return `${metric.label}: ${formatMetric(metrics[metric.key]!, metric.kind, false)}, ${formatDelta(metrics[metric.key]!, comparison?.yesterday, metric.kind)}, 30-day average ${average}`;
    })
    .join("; ");
  return `${sourceName} 30-day product statistics chart. ${summary}`.slice(0, 2000);
}

export function formatDelta(value: number, yesterday: number | null | undefined, kind: DisplayMetric["kind"]): string {
  if (!validComparisonValue(yesterday)) return "No prior day";
  const delta = value - yesterday;
  const epsilon = kind === "ratio" ? 0.0005 : kind === "decimal" ? 0.005 : 0.5;
  if (Math.abs(delta) < epsilon) return "Same as yesterday";
  const direction = delta > 0 ? "↑" : "↓";
  if (kind === "ratio") {
    const points = Math.abs(delta * 100).toLocaleString("en-US", { maximumFractionDigits: 1 });
    return `${direction} ${points}pp vs yesterday`;
  }
  if (kind === "decimal") {
    const amount = Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 2 });
    return `${direction} ${amount} vs yesterday`;
  }
  const amount = Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const percent = yesterday > 0
    ? ` · ${(Math.abs(delta) / yesterday * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
    : "";
  return `${direction} ${amount}${percent} vs yesterday`;
}

function validComparisonValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function formatMetric(value: number, kind: DisplayMetric["kind"], average: boolean): string {
  if (kind === "ratio") {
    return `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  }
  if (kind === "decimal") {
    return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: average && !Number.isInteger(value) ? 1 : 0,
    maximumFractionDigits: average ? 1 : 0,
  });
}

function requireText(value: unknown, field: string, maxLength: number): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`Invalid NoxCue ${field}`);
  }
}

function escapeMrkdwn(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
