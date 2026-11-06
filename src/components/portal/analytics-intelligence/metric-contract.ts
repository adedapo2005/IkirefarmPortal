import { addExactEggCounts, isExactEggCount } from "./exact-egg-count";
import { loggedInstant } from "../../../lib/logged-instant";
// Typed input contract for authorized analytics metrics. Pure functions only:
// no React, no fetching. Missing, unverified or unauthorized data is never
// coerced to zero; it is reported through the resolved status instead.

export type MetricStatus = "loading" | "ready" | "empty" | "unavailable" | "stale" | "error";
export type MetricProducerStatus = "loading" | "ready" | "unavailable" | "error";
export type MetricUnit = "eggs" | "birds" | "kg" | "litres" | "NGN" | "%";
export type MetricPolarity = "higher-is-better" | "lower-is-better" | "neutral";
export type MetricAggregate = "sum" | "latest";
export type MetricTrend = "up" | "down" | "flat" | "none";
export type MetricTone = "positive" | "negative" | "neutral";

// `authorized` must come from the verified context that supplied the records (the server-side permission check),
// never from a frontend default.
export type MetricScope = Readonly<{
  level: "farm" | "house" | "batch";
  label: string;
  authorized: boolean;
}>;

export type MetricSource = Readonly<{
  name: string;
  verified: boolean;
}>;

export type MetricPeriod = Readonly<{
  label: string;
  start: string | null;
  end: string | null;
}>;

// `date` is a calendar day (YYYY-MM-DD). `value` is null when no verified value exists for that day.
export type MetricPoint = Readonly<{
  date: string;
  value: number | null;
}>;

export type MetricComparison = Readonly<{
  period: MetricPeriod;
  unit: MetricUnit;
  series: readonly MetricPoint[];
}>;

export type MetricTarget = Readonly<{
  value: number;
  unit: MetricUnit;
  verified: boolean;
}>;

export type MetricDrilldown = Readonly<{
  href: string;
  permission: string;
  authorized: boolean;
}>;

export type MetricContract = Readonly<{
  key: string;
  label: string;
  unit: MetricUnit;
  polarity: MetricPolarity;
  aggregate: MetricAggregate;
  scope: MetricScope;
  source: MetricSource;
  status: MetricProducerStatus;
  unavailableReason?: string;
  // ISO 8601 instant at which the verified records were read.
  asOf: string | null;
  maxAgeHours: number;
  period: MetricPeriod;
  series: readonly MetricPoint[];
  comparison?: MetricComparison | null;
  target?: MetricTarget | null;
  drilldown?: MetricDrilldown | null;
}>;

export type ComparisonCheck = Readonly<{
  valid: boolean;
  reason: string | null;
}>;

export type MetricView = Readonly<{
  status: MetricStatus;
  reason: string | null;
  unit: MetricUnit;
  value: number | null;
  previous: number | null;
  change: number | null;
  changePct: number | null;
  trend: MetricTrend;
  tone: MetricTone;
  comparison: ComparisonCheck | null;
  target: Readonly<{value: number; progressPct: number | null}> | null;
  canDrilldown: boolean;
}>;

export type TrendState = Readonly<{
  status: MetricStatus;
  reason: string | null;
}>;

export type TrendRow = Readonly<{
  date: string;
  value: number | null;
  previous: number | null;
}>;

// verifiedDays counts only days with a finite verified value. A dated row whose value is null is not verified,
// so it appears in missingDates.
export type PeriodCoverage = Readonly<{
  expectedDays: number;
  verifiedDays: number;
  missingDates: readonly string[];
}>;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const CLOCK_SKEW_MS = 5 * 60_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const UNIT_FORMAT: Record<MetricUnit, {prefix: string; suffix: string; decimals: number; label: string}> = {
  eggs: {prefix: "", suffix: " eggs", decimals: 0, label: "eggs"},
  birds: {prefix: "", suffix: " birds", decimals: 0, label: "birds"},
  kg: {prefix: "", suffix: " kg", decimals: 1, label: "kg"},
  litres: {prefix: "", suffix: " litres", decimals: 1, label: "litres"},
  NGN: {prefix: "₦", suffix: "", decimals: 0, label: "NGN"},
  "%": {prefix: "", suffix: "%", decimals: 1, label: "%"},
};

export const UNAVAILABLE_DEFAULT_REASON = "Verified records are needed before this value can be shown.";

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// Inclusive day count between two calendar days; 1 for a single day.
export function daysInclusive(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
}

function hasValidPeriod(period: MetricPeriod): period is MetricPeriod & {start: string; end: string} {
  return isIsoDate(period.start) && isIsoDate(period.end) && period.start <= period.end;
}

// A value is valid when it is missing (null) or a finite number. Count and mass units cannot be negative.
function isValidValue(value: number | null, unit: MetricUnit): boolean {
  if (value === null) return true;
  if (unit === "eggs") return isExactEggCount(value);
  return typeof value === "number" && Number.isFinite(value) && (unit === "NGN" || value >= 0);
}

function hasInvalidDate(series: readonly MetricPoint[]): boolean {
  return series.some((point) => !isIsoDate(point.date));
}

function hasInvalidValue(series: readonly MetricPoint[], unit: MetricUnit): boolean {
  return series.some((point) => !isValidValue(point.value, unit));
}

// More than one record for the same calendar day means the source is ambiguous, so no total or trend is trusted.
function hasDuplicateDate(series: readonly MetricPoint[]): boolean {
  const seen = new Set<string>();
  for (const point of series) {
    if (!isIsoDate(point.date)) continue;
    if (seen.has(point.date)) return true;
    seen.add(point.date);
  }
  return false;
}

// Reports which calendar days of the reporting period have a verified value. A total needs every day verified.
export function periodCoverage(series: readonly MetricPoint[], period: MetricPeriod): PeriodCoverage {
  if (!hasValidPeriod(period)) return {expectedDays: 0, verifiedDays: 0, missingDates: []};
  const verified = new Set(
    series
      .filter((point) => isIsoDate(point.date) && point.date >= period.start && point.date <= period.end)
      .filter((point) => point.value !== null && Number.isFinite(point.value))
      .map((point) => point.date),
  );
  const missingDates: string[] = [];
  for (let date = period.start; date <= period.end; date = addDays(date, 1)) {
    if (!verified.has(date)) missingDates.push(date);
  }
  return {
    expectedDays: daysInclusive(period.start, period.end),
    verifiedDays: verified.size,
    missingDates,
  };
}

export function checkComparison(
  current: MetricPeriod,
  comparison: MetricComparison,
  unit: MetricUnit,
): ComparisonCheck {
  if (!hasValidPeriod(current) || !hasValidPeriod(comparison.period)) {
    return {valid: false, reason: "Comparison period dates are invalid."};
  }
  if (comparison.unit !== unit) return {valid: false, reason: "Comparison unit does not match this metric."};
  if (daysInclusive(current.start, current.end) !== daysInclusive(comparison.period.start, comparison.period.end)) {
    return {valid: false, reason: "Comparison period length differs from the reporting period."};
  }
  if (comparison.period.end >= current.start) {
    return {valid: false, reason: "Comparison period overlaps the reporting period."};
  }
  if (hasInvalidDate(comparison.series)) return {valid: false, reason: "Previous-period records contain an invalid date."};
  if (hasDuplicateDate(comparison.series)) return {valid: false, reason: "Previous-period records contain duplicate days."};
  if (hasInvalidValue(comparison.series, unit)) return {valid: false, reason: unit === "eggs"
    ? "Previous egg counts cannot be represented exactly."
    : "Previous-period records contain an invalid value."};
  return {valid: true, reason: null};
}

// Null when the metric has no comparison; otherwise whether the supplied comparison may be used.
export function checkMetricComparison(metric: MetricContract): ComparisonCheck | null {
  if (!metric.comparison) return null;
  const checked = checkComparison(metric.period, metric.comparison, metric.unit);
  if (checked.valid && metric.unit === "eggs" && metric.aggregate === "sum" &&
      !hasExactEggSum(pointsInPeriod(metric.comparison.series, metric.comparison.period))) {
    return {valid: false, reason: "The previous egg total cannot be represented exactly."};
  }
  return checked;
}

function sortedPoints(series: readonly MetricPoint[]): MetricPoint[] {
  return series
    .filter((point) => isIsoDate(point.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function pointsInPeriod(series: readonly MetricPoint[], period: MetricPeriod): MetricPoint[] {
  if (!hasValidPeriod(period)) return [];
  return sortedPoints(series).filter((point) => point.date >= period.start && point.date <= period.end);
}

// Missing days are still handled by periodCoverage. This check refuses
// non-exact egg values and any partial or complete sum beyond the safe range.
function hasExactEggSum(points: readonly MetricPoint[]): boolean {
  let total = 0;
  for (const point of points) {
    if (point.value === null) continue;
    const next = addExactEggCounts(total, point.value);
    if (next === null) return false;
    total = next;
  }
  return true;
}

// Returns null when any day in the period lacks a verified value, so partial totals are never shown.
export function aggregateValues(points: readonly MetricPoint[], mode: MetricAggregate): number | null {
  if (points.length === 0) return null;
  if (points.some((point) => point.value === null || !Number.isFinite(point.value))) return null;
  if (mode === "latest") return points[points.length - 1].value;
  return points.reduce((total, point) => total + (point.value as number), 0);
}

function changeFor(current: number | null, previous: number | null) {
  if (current === null || previous === null) return {change: null, changePct: null};
  const change = current - previous;
  return {change, changePct: previous === 0 ? null : (change / previous) * 100};
}

function toneFor(change: number | null, polarity: MetricPolarity): MetricTone {
  if (change === null || change === 0 || polarity === "neutral") return "neutral";
  const improving = polarity === "higher-is-better" ? change > 0 : change < 0;
  return improving ? "positive" : "negative";
}

function trendFor(change: number | null): MetricTrend {
  if (change === null) return "none";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

function isStale(metric: MetricContract, now: Date): boolean {
  return (now.getTime() - Date.parse(metric.asOf as string)) / HOUR_MS > metric.maxAgeHours;
}

// Conditions that withhold every value. Checked in this order: producer status, verified source, authorized scope,
// reporting period, record integrity, then snapshot time. Authorization is never inferred from the frontend.
function withholding(metric: MetricContract, now: Date): {status: MetricStatus; reason: string} | null {
  if (metric.status === "loading") return {status: "loading", reason: "Loading verified records."};
  if (metric.status === "error") return {status: "error", reason: "Records could not be loaded. Try again later."};
  if (metric.status === "unavailable") {
    return {status: "unavailable", reason: metric.unavailableReason || UNAVAILABLE_DEFAULT_REASON};
  }
  if (!metric.source.verified) return {status: "unavailable", reason: "Source is not verified. Values are withheld."};
  if (!metric.scope.authorized) {
    return {status: "unavailable", reason: "Not authorized for this scope. Values are withheld."};
  }
  if (!hasValidPeriod(metric.period)) return {status: "error", reason: "Reporting period is missing or invalid."};
  if (hasInvalidDate(metric.series)) return {status: "error", reason: "A record date is invalid."};
  if (hasDuplicateDate(metric.series)) return {status: "error", reason: "More than one verified record exists for a day."};
  if (metric.unit === "eggs" &&
      (hasInvalidValue(metric.series, metric.unit) ||
       (metric.aggregate === "sum" && !hasExactEggSum(pointsInPeriod(metric.series, metric.period))) ||
       (metric.target?.verified && metric.target.unit === "eggs" && !isExactEggCount(metric.target.value)))) {
    return {status: "unavailable", reason: "Egg counts or totals cannot be represented exactly."};
  }
  if (hasInvalidValue(metric.series, metric.unit)) return {status: "error", reason: "A verified record value is invalid."};
  if (!Number.isFinite(metric.maxAgeHours) || metric.maxAgeHours <= 0) {
    return {status: "error", reason: "The freshness limit is invalid."};
  }
  if (!isInstant(metric.asOf)) {
    return {status: "unavailable", reason: "The snapshot time is missing or invalid, so freshness cannot be shown."};
  }
  if (Date.parse(metric.asOf) > now.getTime() + CLOCK_SKEW_MS) {
    return {status: "error", reason: "The snapshot time is in the future."};
  }
  return null;
}

// Resolves the KPI total. A total is shown only when every day of the reporting period has exactly one verified value,
// and the previous-period total is shown only under the same rule.
export function resolveMetric(metric: MetricContract, now: Date = new Date()): MetricView {
  const canDrilldown = Boolean(metric.drilldown?.authorized && metric.scope.authorized);
  const comparison = metric.scope.authorized ? checkMetricComparison(metric) : null;
  const withheld = (status: MetricStatus, reason: string | null): MetricView => ({
    status,
    reason,
    unit: metric.unit,
    value: null,
    previous: null,
    change: null,
    changePct: null,
    trend: "none",
    tone: "neutral",
    comparison,
    target: null,
    canDrilldown,
  });

  const blocked = withholding(metric, now);
  if (blocked) return withheld(blocked.status, blocked.reason);

  const current = pointsInPeriod(metric.series, metric.period);
  if (current.length === 0) return withheld("empty", "No verified records in this period.");

  const coverage = periodCoverage(metric.series, metric.period);
  if (coverage.missingDates.length > 0) {
    return withheld(
      "unavailable",
      `${coverage.missingDates.length} of ${coverage.expectedDays} days in this period have no verified value, so the total is not shown.`,
    );
  }

  const value = aggregateValues(current, metric.aggregate);
  if (value === null) return withheld("unavailable", "Some days in this period have no verified value, so the total is not shown.");

  let previous: number | null = null;
  if (metric.comparison && comparison?.valid) {
    const previousCoverage = periodCoverage(metric.comparison.series, metric.comparison.period);
    if (previousCoverage.missingDates.length === 0) {
      previous = aggregateValues(pointsInPeriod(metric.comparison.series, metric.comparison.period), metric.aggregate);
    }
  }

  const {change, changePct} = changeFor(value, previous);
  const target = metric.target && metric.target.verified && metric.target.unit === metric.unit && metric.target.value > 0
    ? {value: metric.target.value, progressPct: (value / metric.target.value) * 100}
    : null;

  const stale = isStale(metric, now);
  return {
    status: stale ? "stale" : "ready",
    reason: stale ? `The verified snapshot is older than ${metric.maxAgeHours} hours.` : null,
    unit: metric.unit,
    value,
    previous,
    change,
    changePct,
    trend: trendFor(change),
    tone: toneFor(change, metric.polarity),
    comparison,
    target,
    canDrilldown,
  };
}

// Resolves whether a daily trend can be drawn. Unlike the KPI total, missing days do not stop the chart:
// verified days are plotted and missing days are gaps. Only a period with no verified value is empty.
export function resolveTrendState(metric: MetricContract, now: Date = new Date()): TrendState {
  const blocked = withholding(metric, now);
  if (blocked) return blocked;
  const current = pointsInPeriod(metric.series, metric.period);
  if (!current.some((point) => point.value !== null)) return {status: "empty", reason: "No verified records in this period."};
  return isStale(metric, now)
    ? {status: "stale", reason: `The verified snapshot is older than ${metric.maxAgeHours} hours.`}
    : {status: "ready", reason: null};
}

// Day-by-day rows for the chart and its data table. Only days the supplied data covers are included,
// so a window longer than the records simply shows what exists. Missing days are null, never zero.
export function trendRows(metric: MetricContract, windowDays: number): TrendRow[] {
  if (!hasValidPeriod(metric.period)) return [];
  if (metric.unit === "eggs" && (hasInvalidValue(metric.series, metric.unit) ||
      (metric.aggregate === "sum" && !hasExactEggSum(pointsInPeriod(metric.series, metric.period))))) return [];
  const series = sortedPoints(metric.series);
  if (series.length === 0) return [];

  const days = Math.max(1, Math.floor(windowDays));
  const earliest = series[0].date;
  const windowStart = addDays(metric.period.end, -(days - 1));
  // A chart window may be requested beyond the reporting period, but it must never
  // disclose rows from an older source range that is outside this metric contract.
  const firstPermittedDate = windowStart > metric.period.start
    ? windowStart
    : metric.period.start;
  const start = firstPermittedDate > earliest ? firstPermittedDate : earliest;
  const values = new Map(series.map((point) => [point.date, point.value] as const));

  // Previous-period values are aligned by day offset, so day N of this window is compared with day N of the earlier period.
  const comparison = metric.comparison && checkMetricComparison(metric)?.valid
    ? metric.comparison
    : null;
  const shift = comparison && hasValidPeriod(comparison.period) && hasValidPeriod(metric.period)
    ? daysInclusive(comparison.period.start, metric.period.start) - 1
    : 0;
  const previousValues = comparison
    ? new Map(sortedPoints(comparison.series).map((point) => [point.date, point.value] as const))
    : null;

  const rows: TrendRow[] = [];
  for (let date = start; date <= metric.period.end; date = addDays(date, 1)) {
    const previousDate = addDays(date, -shift);
    const inPreviousPeriod = comparison !== null
      && hasValidPeriod(comparison.period)
      && previousDate >= comparison.period.start
      && previousDate <= comparison.period.end;
    rows.push({
      date,
      value: values.get(date) ?? null,
      previous: previousValues && inPreviousPeriod ? (previousValues.get(previousDate) ?? null) : null,
    });
  }
  return rows;
}

// Hiding a series is refused when it is the last visible one, so the chart always keeps a series on screen.
export function toggleSeries<K extends string>(hidden: readonly K[], key: K, seriesKeys: readonly K[]): K[] {
  if (hidden.includes(key)) return hidden.filter((item) => item !== key);
  const remaining = seriesKeys.filter((item) => item !== key && !hidden.includes(item));
  if (remaining.length === 0) return [...hidden];
  return [...hidden, key];
}

export function formatMetricValue(value: number | null, unit: MetricUnit): string {
  if (value === null || !Number.isFinite(value)) return "Not recorded";
  const format = UNIT_FORMAT[unit];
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(value).toLocaleString("en-US", {maximumFractionDigits: format.decimals});
  return `${sign}${format.prefix}${digits}${format.suffix}`;
}

export function formatSignedChange(change: number | null, unit: MetricUnit): string {
  if (change === null || !Number.isFinite(change)) return "Not comparable";
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  const format = UNIT_FORMAT[unit];
  return `${sign}${format.prefix}${Math.abs(change).toLocaleString("en-US", {maximumFractionDigits: format.decimals})}${format.suffix}`;
}

export function formatPercentChange(changePct: number | null, previousValue?: number | null): string {
  if (changePct === null || !Number.isFinite(changePct)) {
    return previousValue === 0
      ? "percentage change unavailable because the previous value is zero"
      : "percentage change unavailable";
  }
  const sign = changePct > 0 ? "+" : changePct < 0 ? "-" : "";
  return `${sign}${Math.abs(changePct).toLocaleString("en-US", {maximumFractionDigits: 1})}%`;
}

export function formatAsOf(asOf: string | null): string {
  const time = loggedInstant(asOf);
  return time ? `Nigeria Time: ${time.nigeria}\nNew York Time: ${time.newYork}` : "Recorded time unavailable or time zone unconfirmed";
}

export function unitLabel(unit: MetricUnit): string {
  return UNIT_FORMAT[unit].label;
}
