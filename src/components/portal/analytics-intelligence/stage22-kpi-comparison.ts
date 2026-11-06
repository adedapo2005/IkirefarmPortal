// Stage 22 comparison calculations. Pure functions: no React, no fetching, no authorization.
// A zero is a real value. A missing, invalid or unverified value is reported as unavailable, never coerced to zero.
import {formatMetricValue, formatPercentChange, formatSignedChange} from "./metric-contract";
import type {Stage22Kind, Stage22Polarity, Stage22Unit} from "./stage22-kpi-definitions";

export type Stage22Interpretation = "favorable" | "unfavorable" | "neutral" | "contextual";
export type Stage22Direction = "up" | "down" | "flat";
export type Stage22ComparisonStatus = "ready" | "both-zero" | "previous-zero" | "unavailable";

export type Stage22Comparison = Readonly<{
  status: Stage22ComparisonStatus;
  reason: string | null;
  current: number | null;
  previous: number | null;
  // Amounts: the change in the metric's own unit. Rates: the same movement, in percentage points.
  absoluteChange: number | null;
  // Amounts only, and only when mathematically meaningful. Rates never get a relative percent (see compareRates).
  percentChange: number | null;
  // Rates only: current minus previous, in percentage points.
  percentagePointChange: number | null;
  direction: Stage22Direction | null;
  interpretation: Stage22Interpretation;
}>;

export type Stage22AmountInput = Readonly<{
  current: number | null;
  previous: number | null;
  polarity: Stage22Polarity;
  allowNegative: boolean;
}>;

export type Stage22Part = Readonly<{numerator: number | null; denominator: number | null}>;

const PAIR_REASON = "A current value and a previous value are both needed to compare.";
const NEGATIVE_REASON = "This measure cannot be negative, so the comparison is withheld.";
const RATE_RANGE_REASON = "A percentage must be between 0% and 100%, so the comparison is withheld.";
const ZERO_PREVIOUS_REASON = "The previous period is zero, so a percentage change is not shown.";
const NEGATIVE_BASE_REASON = "A percentage change is not meaningful from a negative base, so it is not shown.";

function isFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// The comparison shape for a pair that cannot be compared. The reason is always shown, never a made-up change.
export function unavailableComparison(
  reason: string,
  current: number | null = null,
  previous: number | null = null,
): Stage22Comparison {
  return {
    status: "unavailable",
    reason,
    current,
    previous,
    absoluteChange: null,
    percentChange: null,
    percentagePointChange: null,
    direction: null,
    interpretation: "neutral",
  };
}

export function directionOf(change: number): Stage22Direction {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

// Whether a change is good depends on what the measure means, not on its sign alone.
export function interpretChange(change: number, polarity: Stage22Polarity): Stage22Interpretation {
  if (change === 0 || polarity === "neutral") return "neutral";
  if (polarity === "contextual") return "contextual";
  const favorable = polarity === "higher-is-better" ? change > 0 : change < 0;
  return favorable ? "favorable" : "unfavorable";
}

// Amounts (money, counts, eggs, kg, or a ratio's own unit). Percent change is relative to the previous value.
export function compareAmounts({current, previous, polarity, allowNegative}: Stage22AmountInput): Stage22Comparison {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return unavailableComparison(PAIR_REASON, current, previous);
  if (!allowNegative && (current < 0 || previous < 0)) return unavailableComparison(NEGATIVE_REASON, current, previous);

  const change = current - previous;
  if (current === 0 && previous === 0) {
    return {
      status: "both-zero",
      reason: "Both periods are zero, so there is no change to measure.",
      current,
      previous,
      absoluteChange: 0,
      percentChange: null,
      percentagePointChange: null,
      direction: "flat",
      interpretation: "neutral",
    };
  }

  const base = {
    current,
    previous,
    absoluteChange: change,
    percentagePointChange: null,
    direction: directionOf(change),
    interpretation: interpretChange(change, polarity),
  } as const;

  if (previous === 0) return {...base, status: "previous-zero", reason: ZERO_PREVIOUS_REASON, percentChange: null};
  if (previous < 0) return {...base, status: "ready", reason: NEGATIVE_BASE_REASON, percentChange: null};
  return {...base, status: "ready", reason: null, percentChange: (change / previous) * 100};
}

// Rates in percent (0 to 100). The movement is reported in percentage points only. A relative percent of a rate
// (say, mortality rising from 2% to 3% as "+50%") reads as a bigger problem than it is, so it is not produced.
export function compareRates({current, previous, polarity, allowNegative = false}: Stage22AmountInput): Stage22Comparison {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return unavailableComparison(PAIR_REASON, current, previous);
  if (!allowNegative && (current < 0 || previous < 0)) return unavailableComparison(NEGATIVE_REASON, current, previous);
  if (current > 100 || previous > 100) return unavailableComparison(RATE_RANGE_REASON, current, previous);

  const change = current - previous;
  return {
    status: current === 0 && previous === 0 ? "both-zero" : "ready",
    reason: null,
    current,
    previous,
    absoluteChange: change,
    percentChange: null,
    percentagePointChange: change,
    direction: directionOf(change),
    interpretation: interpretChange(change, polarity),
  };
}

// Weighted quotient: total numerator over total denominator. Averaging daily or house-level rates would give a small
// day the same weight as a large one, so it is not done. Null when no verified denominator exists, never zero.
export function weightedRatio(parts: readonly Stage22Part[], allowNegativeNumerator = false): number | null {
  if (parts.length === 0) return null;
  let numerator = 0;
  let denominator = 0;
  for (const part of parts) {
    if (!isFiniteNumber(part.numerator) || !isFiniteNumber(part.denominator)) return null;
    if (part.denominator < 0 || (!allowNegativeNumerator && part.numerator < 0)) return null;
    numerator += part.numerator;
    denominator += part.denominator;
  }
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function weightedRatePct(parts: readonly Stage22Part[], allowNegativeNumerator = false): number | null {
  const ratio = weightedRatio(parts, allowNegativeNumerator);
  return ratio === null ? null : ratio * 100;
}

const ARROWS: Record<Stage22Direction, string> = {up: "↑", down: "↓", flat: "→"};
const INTERPRETATION_WORDS: Record<Stage22Interpretation, string> = {
  favorable: "Favorable.",
  unfavorable: "Unfavorable.",
  neutral: "",
  contextual: "Read in context.",
};

export function formatStage22Value(value: number | null, unit: Stage22Unit): string {
  if (value === null || !Number.isFinite(value)) return "Not recorded";
  if (unit === "kg feed per kg output") {
    return `${value.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg feed per kg output`;
  }
  return formatMetricValue(value, unit);
}

// Rates are read in percentage points, ratios keep their own unit, and amounts use the metric's unit.
export function formatStage22Change(change: number | null, unit: Stage22Unit, kind: Stage22Kind): string {
  if (change === null || !Number.isFinite(change)) return "Not comparable";
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  const magnitude = Math.abs(change);
  if (kind === "rate") {
    return `${sign}${magnitude.toLocaleString("en-US", {minimumFractionDigits: 1, maximumFractionDigits: 1})} percentage points`;
  }
  if (kind === "ratio") {
    return `${sign}${magnitude.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg feed per kg output`;
  }
  return formatSignedChange(change, unit as Exclude<Stage22Unit, "kg feed per kg output">);
}

// Plain-language sentence for a comparison. Example: "↑ +3,210 eggs (+3.6%). Compared with 88,662 eggs in the previous 30-day period."
export function describeComparison(
  comparison: Stage22Comparison,
  {unit, kind, previousLabel}: {unit: Stage22Unit; kind: Stage22Kind; previousLabel: string},
): string {
  if (comparison.status === "unavailable") return `Comparison not available. ${comparison.reason ?? ""}`.trim();
  if (comparison.status === "both-zero") return `→ No change. ${comparison.reason ?? ""}`.trim();

  const arrow = comparison.direction ? ARROWS[comparison.direction] : "";
  const change = formatStage22Change(comparison.absoluteChange, unit, kind);
  const percent = kind === "amount" && comparison.percentChange !== null
    ? ` (${formatPercentChange(comparison.percentChange)})`
    : "";
  const previous = `Compared with ${formatStage22Value(comparison.previous, unit)} in the ${previousLabel}.`;
  const note = comparison.reason ? ` ${comparison.reason}` : "";
  const interpretation = comparison.interpretation === "neutral" ? "" : ` ${INTERPRETATION_WORDS[comparison.interpretation]}`;
  return `${arrow} ${change}${percent}. ${previous}${note}${interpretation}`.replace(/\s+/g, " ").trim();
}
