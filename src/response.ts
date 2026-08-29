const CONTRACT = "noxcue.response" as const;
const VERSION = 1 as const;

export interface MetricComparison {
  yesterday: number | null;
  average30d: number | null;
  sampleDays: number;
  history?: Array<{ period: string; value: number }>;
}

export type MetricComparisons = Record<string, MetricComparison>;

const DISPLAY_METRICS = [
  { key: "users.new", label: "New users", kind: "count", group: "Growth" },
  { key: "users.total", label: "Total users", kind: "count", group: "Growth" },
  { key: "users.active.daily", label: "Daily active", kind: "count", group: "Engagement" },
  { key: "users.active.weekly", label: "Weekly active", kind: "count", group: "Engagement" },
  { key: "users.active.monthly", label: "Monthly active", kind: "count", group: "Engagement" },
  { key: "users.stickiness.dau_mau", label: "DAU / MAU", kind: "ratio", group: "Engagement" },
] as const;

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
) {
  requireText(sourceName, "sourceName", 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error("Invalid NoxCue period");
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) throw new Error("Invalid NoxCue metrics");
  const visibleMetrics = DISPLAY_METRICS.filter(({ key }) => {
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
  for (const group of ["Growth", "Engagement"] as const) {
    const groupMetrics = visibleMetrics.filter((metric) => metric.group === group);
    if (groupMetrics.length === 0) continue;
    const groupIcon = group === "Growth" ? "🌱" : "⚡";
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${groupIcon} ${group}*` } });
    blocks.push({
      type: "section",
      fields: groupMetrics.map((metric) => ({
        type: "mrkdwn",
        text: metricField(
          metric.label,
          metrics[metric.key]!,
          metric.kind,
          comparisons[metric.key],
        ),
      })),
    });
  }
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "NoxCue · 30-day trend · stored completed days only" }],
  });
  const newUsers = metrics["users.new"];
  const summary = typeof newUsers === "number"
    ? `${formatMetric(newUsers, "count", false)} new users`
    : `${visibleMetrics.length} user statistics`;
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
  kind: "count" | "ratio",
  comparison: MetricComparison | undefined,
): string {
  const yesterday = validComparisonValue(comparison?.yesterday)
    ? formatMetric(comparison.yesterday, kind, false)
    : "—";
  const average = validComparisonValue(comparison?.average30d)
    ? formatMetric(comparison.average30d, kind, true)
    : "—";
  const trend = lineSparkline(comparison?.history);
  return [
    `*${label}*`,
    `*${formatMetric(value, kind, false)}*  ${formatDelta(value, comparison?.yesterday, kind)}`,
    `${trend}  _30 days_`,
    `Yesterday ${yesterday} · 30d avg ${average}`,
  ].join("\n");
}

function lineSparkline(history: MetricComparison["history"]): string {
  const rawValues = (history ?? [])
    .map((point) => point?.value)
    .filter((value): value is number => validComparisonValue(value))
    .slice(-30);
  const values = compactTrend(rawValues, 24);
  if (values.length === 0) return "—";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rows = values.map((value) => min === max
    ? 2
    : Math.round(((max - value) / (max - min)) * 3));
  if (rows.length % 2 === 1) rows.push(rows.at(-1)!);
  const dotBits = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
  ] as const;
  let line = "";
  for (let index = 0; index < rows.length; index += 2) {
    const left = dotBits[rows[index]!]![0];
    const right = dotBits[rows[index + 1]!]![1];
    line += String.fromCodePoint(0x2800 + left + right);
  }
  return line;
}

function compactTrend(values: number[], targetPoints: number): number[] {
  if (values.length <= targetPoints) return values;
  return Array.from({ length: targetPoints }, (_, index) => {
    const start = Math.floor((index * values.length) / targetPoints);
    const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / targetPoints));
    const bucket = values.slice(start, end);
    return bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
  });
}

function formatDelta(value: number, yesterday: number | null | undefined, kind: "count" | "ratio"): string {
  if (!validComparisonValue(yesterday)) return "• new";
  const delta = value - yesterday;
  const epsilon = kind === "ratio" ? 0.0005 : 0.5;
  if (Math.abs(delta) < epsilon) return "→ flat";
  const direction = delta > 0 ? "▲" : "▼";
  const sign = delta > 0 ? "+" : "−";
  const amount = kind === "ratio"
    ? `${Math.abs(delta * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}pp`
    : Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${direction} ${sign}${amount}`;
}

function validComparisonValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function formatMetric(value: number, kind: "count" | "ratio", average: boolean): string {
  if (kind === "ratio") {
    return `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
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
