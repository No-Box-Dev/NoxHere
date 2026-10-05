import { displayMetricsFor, formatDelta, formatMetric, type ActivityBreakdowns, type MetricComparisons } from "./response";

const SNAPSHOT_LIFETIME_DAYS = 35;
const CHART_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ChartSnapshot {
  sourceName: string;
  period: string;
  metrics: Record<string, number>;
  comparisons: MetricComparisons;
  metricLabels?: Record<string, string>;
  activityBreakdowns?: ActivityBreakdowns;
}

let wasmReady: Promise<void> | undefined;

export async function createChartSnapshot(db: D1Database, snapshot: ChartSnapshot): Promise<string> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SNAPSHOT_LIFETIME_DAYS * 86_400_000).toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO cue_chart_snapshots (id, payload_json, expires_at)
       VALUES (?1, ?2, ?3)`,
    ).bind(id, JSON.stringify(snapshot), expiresAt),
    db.prepare("DELETE FROM cue_chart_snapshots WHERE datetime(expires_at) <= datetime('now')"),
  ]);
  return id;
}

export async function handleChartImage(request: Request, db: D1Database): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/v1\/charts\/([^/]+)\.png$/);
  if (!match) return null;
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const id = match[1]!;
  if (!CHART_ID.test(id)) return new Response("Not found", { status: 404 });

  const row = await db.prepare(
    `SELECT payload_json
       FROM cue_chart_snapshots
      WHERE id = ?1 AND datetime(expires_at) > datetime('now')`,
  ).bind(id).first<{ payload_json: string }>();
  if (!row) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  let snapshot: ChartSnapshot;
  try {
    snapshot = JSON.parse(row.payload_json) as ChartSnapshot;
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const png = await renderChartPng(snapshot);
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function renderChartPng(snapshot: ChartSnapshot): Promise<Uint8Array> {
  const [{ initWasm, Resvg }, { default: resvgWasm }, { default: interRegular }, { default: interSemibold }] = await Promise.all([
    import("@resvg/resvg-wasm"),
    import("@resvg/resvg-wasm/index_bg.wasm"),
    import("@fontsource/inter/files/inter-latin-400-normal.woff2"),
    import("@fontsource/inter/files/inter-latin-600-normal.woff2"),
  ]);
  wasmReady ??= initWasm(resvgWasm);
  await wasmReady;
  const renderer = new Resvg(buildChartSvg(snapshot), {
    fitTo: { mode: "original" },
    font: {
      fontBuffers: [new Uint8Array(interRegular), new Uint8Array(interSemibold)],
      defaultFontFamily: "Inter",
      sansSerifFamily: "Inter",
    },
  });
  try {
    return renderer.render().asPng();
  } finally {
    renderer.free();
  }
}

export function buildChartSvg(snapshot: ChartSnapshot): string {
  const visible = displayMetricsFor(snapshot.metrics, snapshot.metricLabels).filter(({ key }) => validNumber(snapshot.metrics[key]));
  const width = 1000;
  const height = Math.max(190, Math.ceil(visible.length / 2) * 174 + 18);
  const cards = visible.map((metric, index) => {
    const x = 18 + (index % 2) * 491;
    const y = 18 + Math.floor(index / 2) * 174;
    const value = snapshot.metrics[metric.key]!;
    const comparison = snapshot.comparisons[metric.key];
    const breakdown = snapshot.activityBreakdowns?.[metric.key];
    if (breakdown) {
      const windowDays = breakdown.windowDays ?? 7;
      const values = (comparison?.history ?? [])
        .map((point) => point.value)
        .filter(validNumber)
        .slice(-30);
      const recent = values.slice(-windowDays);
      const average7d = recent.length > 0
        ? recent.reduce((sum, point) => sum + point, 0) / recent.length
        : null;
      const domain = chartDomain(values, average7d);
      const line = chartPath(values, x + 22, y + 91, 429, 35, domain);
      const averageY = average7d === null ? null : chartY(average7d, y + 91, 35, domain);
      return `
        <g>
          <rect x="${x}" y="${y}" width="473" height="156" rx="14" fill="#24272d"/>
          <text x="${x + 22}" y="${y + 31}" class="label">${escapeXml(metric.label)}</text>
          <text x="${x + 451}" y="${y + 30}" class="average" text-anchor="end">${average7d === null ? `${windowDays}d avg —` : `${windowDays}d avg ${escapeXml(formatMetric(average7d, "decimal", true))}`}</text>
          <text x="${x + 22}" y="${y + 70}" class="value">${escapeXml(formatMetric(value, "decimal", false))}</text>
          <text x="${x + 451}" y="${y + 67}" class="delta" text-anchor="end">${escapeXml(formatDelta(value, comparison?.yesterday, "decimal"))}</text>
          ${averageY === null ? "" : `<line x1="${x + 22}" y1="${averageY}" x2="${x + 451}" y2="${averageY}" stroke="#646b76" stroke-width="2" stroke-dasharray="6 7"/>`}
          ${line ? `<path d="${line}" fill="none" stroke="#7aa7ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
          ${line ? `<circle cx="${x + 451}" cy="${chartY(values.at(-1)!, y + 91, 35, domain)}" r="5" fill="#dce7ff" stroke="#7aa7ff" stroke-width="2"/>` : ""}
          <text x="${x + 22}" y="${y + 146}" class="detail">${escapeXml(formatPercent(breakdown.participationRate))} participated</text>
          <text x="${x + 451}" y="${y + 146}" class="detail" text-anchor="end">${escapeXml(formatDecimal(breakdown.actionsPerParticipant))} per participant</text>
        </g>`;
    }
    const values = (comparison?.history ?? [])
      .map((point) => point.value)
      .filter(validNumber)
      .slice(-30);
    const averageValue = validNumber(comparison?.average30d) ? comparison.average30d : null;
    const domain = chartDomain(values, averageValue);
    const line = chartPath(values, x + 22, y + 96, 447, 45, domain);
    const averageY = averageValue === null ? null : chartY(averageValue, y + 96, 45, domain);
    const average = validNumber(comparison?.average30d)
      ? `30d avg ${formatMetric(comparison.average30d, metric.kind, true)}`
      : "30d avg —";
    return `
      <g>
        <rect x="${x}" y="${y}" width="473" height="156" rx="14" fill="#24272d"/>
        <text x="${x + 22}" y="${y + 31}" class="label">${escapeXml(metric.label)}</text>
        <text x="${x + 451}" y="${y + 30}" class="average" text-anchor="end">${escapeXml(average)}</text>
        <text x="${x + 22}" y="${y + 72}" class="value">${escapeXml(formatMetric(value, metric.kind, false))}</text>
        <text x="${x + 451}" y="${y + 69}" class="delta" text-anchor="end">${escapeXml(formatDelta(value, comparison?.yesterday, metric.kind))}</text>
        <line x1="${x + 22}" y1="${y + 143}" x2="${x + 469}" y2="${y + 143}" stroke="#363a42"/>
        ${averageY === null ? "" : `<line x1="${x + 22}" y1="${averageY}" x2="${x + 469}" y2="${averageY}" stroke="#646b76" stroke-width="2" stroke-dasharray="6 7"/>`}
        ${line ? `<path d="${line}" fill="none" stroke="#7aa7ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
        ${line ? `<circle cx="${x + 469}" cy="${chartY(values.at(-1)!, y + 96, 45, domain)}" r="5" fill="#dce7ff" stroke="#7aa7ff" stroke-width="2"/>` : ""}
      </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" rx="18" fill="#1b1d22"/>
    <style>
      text { font-family: Inter, sans-serif; }
      .label { fill: #c7cbd2; font-size: 21px; font-weight: 600; }
      .value { fill: #f7f8fa; font-size: 36px; font-weight: 600; }
      .delta { fill: #c7cbd2; font-size: 17px; font-weight: 600; }
      .average { fill: #9499a3; font-size: 16px; }
      .detail { fill: #c7cbd2; font-size: 16px; font-weight: 600; }
    </style>
    ${cards}
  </svg>`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ChartDomain {
  min: number;
  max: number;
}

function chartDomain(values: number[], average: number | null): ChartDomain {
  const points = average === null ? values : [...values, average];
  if (points.length === 0) return { min: 0, max: 1 };
  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  const rawSpread = rawMax - rawMin;
  const padding = rawSpread === 0 ? Math.max(rawMax * 0.1, 1) : rawSpread * 0.12;
  return { min: Math.max(0, rawMin - padding), max: rawMax + padding };
}

function chartPath(
  values: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  domain: ChartDomain,
): string {
  if (values.length === 0) return "";
  return values.map((value, index) => {
    const px = values.length === 1 ? x + width : x + (index / (values.length - 1)) * width;
    const py = chartY(value, y, height, domain);
    return `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");
}

function chartY(value: number, y: number, height: number, domain: ChartDomain): number {
  return y + height - ((value - domain.min) / (domain.max - domain.min)) * height;
}

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
