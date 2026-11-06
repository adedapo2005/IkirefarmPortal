// Day inspection for the trend chart. Pure functions: the chart, a keyboard day stepper and tests all use the same rules.
import type {MetricPolarity, TrendRow} from "./metric-contract";

export type DayInspection = Readonly<{
  date: string;
  value: number | null;
  previous: number | null;
  // Present only when both the day and its comparable previous-period day have a verified value.
  difference: number | null;
  differencePct: number | null;
}>;

// The day shown before any selection: the latest day with a verified value, otherwise the last day in the window.
export function defaultInspectedDate(rows: readonly TrendRow[]): string | null {
  if (rows.length === 0) return null;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].value !== null) return rows[index].date;
  }
  return rows[rows.length - 1].date;
}

// Resolves the requested day to a day in the current window. An unknown day falls back to the default.
export function resolveInspectedDate(rows: readonly TrendRow[], requested: string | null): string | null {
  if (requested !== null && rows.some((row) => row.date === requested)) return requested;
  return defaultInspectedDate(rows);
}

export function inspectDay(rows: readonly TrendRow[], date: string | null): DayInspection | null {
  const row = date === null ? undefined : rows.find((item) => item.date === date);
  if (!row) return null;
  const hasBoth = row.value !== null && row.previous !== null;
  const difference = hasBoth ? (row.value as number) - (row.previous as number) : null;
  return {
    date: row.date,
    value: row.value,
    previous: row.previous,
    difference,
    differencePct: difference === null || row.previous === 0 ? null : (difference / (row.previous as number)) * 100,
  };
}

// Moves the inspected day by one window day, clamped to the first and last day. Returns the same day at either end.
export function stepInspectedDay(rows: readonly TrendRow[], current: string | null, step: 1 | -1): string | null {
  const resolved = resolveInspectedDate(rows, current);
  if (resolved === null) return null;
  const index = rows.findIndex((row) => row.date === resolved);
  const next = Math.min(rows.length - 1, Math.max(0, index + step));
  return rows[next].date;
}

export function canStepInspectedDay(rows: readonly TrendRow[], current: string | null, step: 1 | -1): boolean {
  const resolved = resolveInspectedDate(rows, current);
  if (resolved === null) return false;
  const index = rows.findIndex((row) => row.date === resolved);
  return step === 1 ? index < rows.length - 1 : index > 0;
}

export type DifferenceDirection = "up" | "down" | "flat";
// Favourable or unfavourable depends on the metric's polarity, so a rise in a cost metric is not shown as good news.
export type DifferenceTone = "favourable" | "unfavourable" | "neutral";

export function differenceTone(difference: number | null, polarity: MetricPolarity): {direction: DifferenceDirection; tone: DifferenceTone} | null {
  if (difference === null || !Number.isFinite(difference)) return null;
  if (difference === 0 || polarity === "neutral") {
    return {direction: difference === 0 ? "flat" : difference > 0 ? "up" : "down", tone: "neutral"};
  }
  const direction: DifferenceDirection = difference > 0 ? "up" : "down";
  const improving = polarity === "higher-is-better" ? difference > 0 : difference < 0;
  return {direction, tone: improving ? "favourable" : "unfavourable"};
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Short calendar label for a YYYY-MM-DD day, for example "17 Oct".
export function formatInspectionDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}
