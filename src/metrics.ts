import { z } from "zod";

export const REPORTED_METRIC_KEYS = [
  "users.total",
  "users.new",
  "users.activated",
  "users.deleted",
  "users.churned",
  "users.active.daily",
  "users.active.weekly",
  "users.active.monthly",
  "auth.logins.success",
  "auth.logins.failed",
] as const;

export const CALCULATED_METRIC_KEYS = [
  "errors.total",
  "errors.unique",
  "errors.affected_users",
  "errors.fatal",
  "errors.unhandled",
  "users.net_growth",
  "users.growth_rate",
  "users.activation_rate",
  "auth.login_success_rate",
  "users.stickiness.dau_mau",
] as const;

export type ReportedMetricKey = typeof REPORTED_METRIC_KEYS[number];
export type CalculatedMetricKey = typeof CALCULATED_METRIC_KEYS[number];
export type MetricKey = ReportedMetricKey | CalculatedMetricKey;
export type ReportedMetrics = Partial<Record<ReportedMetricKey, number>>;
export type CalculatedMetrics = Partial<Record<CalculatedMetricKey, number>>;

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional();

export const reportedMetricsSchema = z.object({
  "users.total": count,
  "users.new": count,
  "users.activated": count,
  "users.deleted": count,
  "users.churned": count,
  "users.active.daily": count,
  "users.active.weekly": count,
  "users.active.monthly": count,
  "auth.logins.success": count,
  "auth.logins.failed": count,
}).strict().superRefine((metrics, ctx) => {
  if (Object.values(metrics).every((value) => value === undefined)) {
    ctx.addIssue({ code: "custom", message: "At least one daily metric is required" });
  }
  const dau = metrics["users.active.daily"];
  const wau = metrics["users.active.weekly"];
  const mau = metrics["users.active.monthly"];
  if (dau !== undefined && wau !== undefined && dau > wau) {
    ctx.addIssue({ code: "custom", message: "DAU cannot exceed WAU" });
  }
  if (wau !== undefined && mau !== undefined && wau > mau) {
    ctx.addIssue({ code: "custom", message: "WAU cannot exceed MAU" });
  }
});

const roundRatio = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function calculateDailyMetrics(
  reported: ReportedMetrics,
  priorTotal: number | null,
): CalculatedMetrics {
  const calculated: CalculatedMetrics = {};
  const newUsers = reported["users.new"];
  const activated = reported["users.activated"];
  const deleted = reported["users.deleted"] ?? 0;
  const churned = reported["users.churned"] ?? 0;
  if (newUsers !== undefined) {
    const netGrowth = newUsers - deleted - churned;
    calculated["users.net_growth"] = netGrowth;
    if (priorTotal !== null && priorTotal > 0) {
      calculated["users.growth_rate"] = roundRatio(netGrowth / priorTotal);
    }
    if (activated !== undefined && newUsers > 0) {
      calculated["users.activation_rate"] = roundRatio(activated / newUsers);
    }
  }
  const successfulLogins = reported["auth.logins.success"];
  const failedLogins = reported["auth.logins.failed"];
  if (successfulLogins !== undefined && failedLogins !== undefined && successfulLogins + failedLogins > 0) {
    calculated["auth.login_success_rate"] = roundRatio(successfulLogins / (successfulLogins + failedLogins));
  }
  const dau = reported["users.active.daily"];
  const mau = reported["users.active.monthly"];
  if (dau !== undefined && mau !== undefined && mau > 0) {
    calculated["users.stickiness.dau_mau"] = roundRatio(dau / mau);
  }
  return calculated;
}

export function localPeriodAt(value: Date | string, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function assertDailyPeriod(period: string, timezone: string, now = new Date()): void {
  const today = localPeriodAt(now, timezone);
  const periodMs = Date.parse(`${period}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(periodMs) || period > today) throw new Error("invalid_metric_period");
  if (todayMs - periodMs > 31 * 86_400_000) throw new Error("metric_backfill_too_old");
}
