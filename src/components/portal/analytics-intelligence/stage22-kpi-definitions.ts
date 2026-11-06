// Stage 22 KPI definitions: what each farm and business measure means, how its period value is formed, which way
// a change is read, and which authoritative record must supply it. Pure data, no React and no fetching.
// A definition marked backend-pending has no connected authoritative producer yet. The resolver withholds its value
// instead of showing a fixture, an estimate or a zero.
import type {MetricUnit} from "./metric-contract";

export const STAGE22_METRIC_KEYS = [
  "egg-collection",
  "laying-rate",
  "mortality-count",
  "mortality-rate",
  "active-birds",
  "feed-consumption",
  "feed-conversion-ratio",
  "sales-revenue",
  "expenses",
  "profit",
  "profit-margin",
  "receivables",
] as const;

export type Stage22MetricKey = (typeof STAGE22_METRIC_KEYS)[number];

// amount: a total or snapshot in one unit. rate: weighted percentage (numerator / denominator x 100).
// ratio: weighted quotient with its own unit, such as feed per kg of output.
export type Stage22Kind = "amount" | "rate" | "ratio";

// "contextual" means a change is not a verdict by itself. Feed consumption depends on flock size and stage.
export type Stage22Polarity = "higher-is-better" | "lower-is-better" | "neutral" | "contextual";

export type Stage22RatioUnit = "kg feed per kg output";
export type Stage22Unit = MetricUnit | Stage22RatioUnit;

export type Stage22Availability = "contract-ready" | "backend-pending";

// The record a rate's numerator or denominator must be. A contract with another key, unit or aggregation is refused.
export type Stage22PartSpec = Readonly<{
  keys: readonly string[];
  unit: MetricUnit;
  aggregate: "sum" | "latest";
}>;

// Possible range for a calculated rate or ratio. An impossible value is an error, never a verified figure.
export type Stage22Bounds = Readonly<{min: number; max: number}>;

export type Stage22Definition = Readonly<{
  key: Stage22MetricKey;
  label: string;
  kind: Stage22Kind;
  unit: Stage22Unit;
  polarity: Stage22Polarity;
  // Amounts only. Rates and ratios are always weighted from their numerator and denominator, never averaged.
  aggregate: "sum" | "latest";
  // True only where a negative value has a real meaning (a profit or a loss). Counts, sales and expenses never go negative.
  allowNegative: boolean;
  // Metric keys a contract may carry for this amount. A record with any other key is not this measure.
  acceptedKeys: readonly string[];
  // The exact source name a verified producer writes, when one exists in code. Null where no producer is connected yet.
  expectedSource: string | null;
  // Rates and ratios only: the numerator and denominator records they are built from.
  parts: Readonly<{numerator: Stage22PartSpec; denominator: Stage22PartSpec}> | null;
  bounds: Stage22Bounds | null;
  basis: string;
  denominator: string | null;
  zeroRule: string;
  producer: string;
  availability: Stage22Availability;
  interpretation: string;
}>;

const SNAPSHOT_BASIS =
  "Each day of the period needs a verified end-of-day value. The period value is the last day, not a sum of days.";

const PERCENT_BOUNDS: Stage22Bounds = {min: 0, max: 100};

export const STAGE22_DEFINITIONS: Readonly<Record<Stage22MetricKey, Stage22Definition>> = {
  "egg-collection": {
    key: "egg-collection",
    label: "Eggs Collected",
    kind: "amount",
    unit: "eggs",
    polarity: "higher-is-better",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["egg-collection", "eggs-collected"],
    expectedSource: "Verified egg-batch records",
    parts: null,
    bounds: null,
    basis: "Sum of verified egg-batch quantities per calendar day. Every day in the period needs a verified value.",
    denominator: null,
    zeroRule: "A day with no verified batch is not recorded, which is not the same as zero. A verified zero is a true zero.",
    producer: "Verified egg-batch records from the farm-operations API",
    availability: "contract-ready",
    interpretation:
      "More eggs collected is favorable when the flock is steady. Read it with flock size and laying rate before calling it performance.",
  },
  "laying-rate": {
    key: "laying-rate",
    label: "Laying Rate",
    kind: "rate",
    unit: "%",
    polarity: "higher-is-better",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["laying-rate"],
    expectedSource: null,
    parts: {
      numerator: {keys: ["egg-collection", "eggs-collected"], unit: "eggs", aggregate: "sum"},
      denominator: {keys: ["live-layer-days"], unit: "birds", aggregate: "sum"},
    },
    bounds: PERCENT_BOUNDS,
    basis: "Total eggs collected divided by total hen-days, multiplied by 100. Weighted by day, not an average of daily percentages.",
    denominator: "Hen-days: the sum of verified live-layer counts on each day of the period.",
    zeroRule: "Zero eggs over verified hen-days is a true 0%. Missing or zero hen-days leave the rate unavailable.",
    producer: "Verified egg-batch records and verified daily live-layer counts (Daily Flock; backend pending)",
    availability: "backend-pending",
    interpretation: "A higher laying rate is favorable. Compare it in percentage points, not as a percent change of the rate.",
  },
  "mortality-count": {
    key: "mortality-count",
    label: "Mortality Count",
    kind: "amount",
    unit: "birds",
    polarity: "lower-is-better",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["mortality-count"],
    expectedSource: null,
    parts: null,
    bounds: null,
    basis: "Sum of verified mortality records per calendar day. Every day in the period needs a verified value.",
    denominator: null,
    zeroRule: "Zero deaths on a fully verified day is a true zero. An unrecorded day is not zero.",
    producer: "Verified daily mortality records (Daily Flock; backend pending)",
    availability: "backend-pending",
    interpretation:
      "Fewer deaths is favorable. Counts from periods with different bird numbers are not fair to compare; use the mortality rate.",
  },
  "mortality-rate": {
    key: "mortality-rate",
    label: "Mortality Rate",
    kind: "rate",
    unit: "%",
    polarity: "lower-is-better",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["mortality-rate"],
    expectedSource: null,
    parts: {
      numerator: {keys: ["mortality-count"], unit: "birds", aggregate: "sum"},
      denominator: {keys: ["live-bird-days"], unit: "birds", aggregate: "sum"},
    },
    bounds: PERCENT_BOUNDS,
    basis: "Total verified deaths divided by total bird-days, multiplied by 100. Weighted by day.",
    denominator: "Bird-days: the sum of verified live-bird counts on each day of the period.",
    zeroRule: "Zero deaths over verified bird-days is a true 0%. Missing or zero bird-days leave the rate unavailable.",
    producer: "Verified mortality records and verified daily live-bird counts (Daily Flock; backend pending)",
    availability: "backend-pending",
    interpretation: "A lower mortality rate is favorable. Compare it in percentage points.",
  },
  "active-birds": {
    key: "active-birds",
    label: "Active Birds",
    kind: "amount",
    unit: "birds",
    polarity: "contextual",
    aggregate: "latest",
    allowNegative: false,
    acceptedKeys: ["active-birds"],
    expectedSource: null,
    parts: null,
    bounds: null,
    basis: SNAPSHOT_BASIS,
    denominator: null,
    zeroRule: "Zero live birds is a true zero only when the house is verified empty. An unverified count is not zero.",
    producer: "Verified flock census from the Flocks module (backend pending)",
    availability: "backend-pending",
    interpretation:
      "A change depends on placements, sales and mortality. More birds is not automatically better; read it against the flock plan.",
  },
  "feed-consumption": {
    key: "feed-consumption",
    label: "Feed Consumption",
    kind: "amount",
    unit: "kg",
    polarity: "contextual",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["feed-consumption"],
    expectedSource: null,
    parts: null,
    bounds: null,
    basis: "Sum of verified feed issued or consumed in kg per calendar day. Every day in the period needs a verified value.",
    denominator: null,
    zeroRule: "A verified zero feed day is a true zero. Missing feed records are not zero consumption.",
    producer: "Verified feed-usage records from the Feed module (backend pending)",
    availability: "backend-pending",
    interpretation:
      "Lower feed is not automatically better. Read consumption against flock size, production and expected intake.",
  },
  "feed-conversion-ratio": {
    key: "feed-conversion-ratio",
    label: "Feed Conversion Ratio",
    kind: "ratio",
    unit: "kg feed per kg output",
    polarity: "lower-is-better",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["feed-conversion-ratio"],
    expectedSource: null,
    parts: {
      numerator: {keys: ["feed-consumption"], unit: "kg", aggregate: "sum"},
      denominator: {keys: ["egg-mass"], unit: "kg", aggregate: "sum"},
    },
    bounds: {min: 0, max: Number.POSITIVE_INFINITY},
    basis: "Total feed kg divided by total egg-mass kg over the period. Weighted, not an average of daily ratios.",
    denominator: "Egg mass: verified egg weights multiplied by verified eggs, in kg.",
    zeroRule: "No egg mass in verified records leaves the ratio unavailable. It is never shown as zero.",
    producer: "Verified feed-usage records and verified egg weights (backend pending)",
    availability: "backend-pending",
    interpretation:
      "A lower ratio means less feed for each kg of egg output, which is favorable for layers. Compare only within the same flock type.",
  },
  "sales-revenue": {
    key: "sales-revenue",
    label: "Sales Revenue",
    kind: "amount",
    unit: "NGN",
    polarity: "higher-is-better",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["sales-revenue"],
    expectedSource: null,
    parts: null,
    bounds: null,
    basis: "Sum of verified sales recognised in the period, in NGN. Every day in the period needs a verified value.",
    denominator: null,
    zeroRule: "Zero sales on a fully verified period is a true zero. An unrecorded period is not zero revenue.",
    producer: "Verified sales records from the Sales lane (backend pending)",
    availability: "backend-pending",
    interpretation: "Higher revenue is favorable. Check receivables before judging how much of it has been collected.",
  },
  expenses: {
    key: "expenses",
    label: "Expenses",
    kind: "amount",
    unit: "NGN",
    polarity: "lower-is-better",
    aggregate: "sum",
    allowNegative: false,
    acceptedKeys: ["expenses"],
    expectedSource: null,
    parts: null,
    bounds: null,
    basis: "Sum of verified expense records dated in the period, in NGN. Every day in the period needs a verified value.",
    denominator: null,
    zeroRule: "Zero expenses on a fully verified period is a true zero. An unrecorded period is not zero cost.",
    producer: "Verified expense records from the Finance lane (backend pending)",
    availability: "backend-pending",
    interpretation: "Higher expenses are unfavorable when output is flat. Read cost trends alongside production.",
  },
  profit: {
    key: "profit",
    label: "Profit",
    kind: "amount",
    unit: "NGN",
    polarity: "higher-is-better",
    aggregate: "sum",
    allowNegative: true,
    acceptedKeys: ["profit"],
    expectedSource: null,
    parts: null,
    bounds: null,
    basis:
      "Derived per day as verified sales revenue minus verified expenses, for the same scope and period. A day missing from either side stays missing.",
    denominator: null,
    zeroRule:
      "A verified zero profit is a true zero, and a negative value is a real loss. A day missing from either side leaves profit unavailable.",
    producer: "Derived from verified sales-revenue and expense records (backend pending)",
    availability: "backend-pending",
    interpretation:
      "Higher profit is favorable. It covers only recorded sales and recorded expenses, so unrecorded costs are not included.",
  },
  "profit-margin": {
    key: "profit-margin",
    label: "Profit Margin",
    kind: "rate",
    unit: "%",
    polarity: "higher-is-better",
    aggregate: "sum",
    allowNegative: true,
    acceptedKeys: ["profit-margin"],
    expectedSource: null,
    parts: {
      numerator: {keys: ["profit"], unit: "NGN", aggregate: "sum"},
      denominator: {keys: ["sales-revenue"], unit: "NGN", aggregate: "sum"},
    },
    // A margin can be negative (a loss) but cannot exceed 100% when expenses are never negative.
    bounds: {min: Number.NEGATIVE_INFINITY, max: 100},
    basis: "Profit divided by sales revenue for the same period, multiplied by 100. Weighted, not an average of daily margins.",
    denominator: "Sales revenue for the same period, in NGN.",
    zeroRule: "Zero revenue leaves the margin unavailable. It is never shown as 0%.",
    producer: "Derived profit and verified sales revenue (backend pending)",
    availability: "backend-pending",
    interpretation: "A higher margin is favorable. A negative margin is a loss and is shown as negative.",
  },
  receivables: {
    key: "receivables",
    label: "Receivables",
    kind: "amount",
    unit: "NGN",
    polarity: "lower-is-better",
    aggregate: "latest",
    allowNegative: false,
    acceptedKeys: ["receivables"],
    expectedSource: null,
    parts: null,
    bounds: null,
    basis: SNAPSHOT_BASIS,
    denominator: null,
    zeroRule: "A verified zero balance is a true zero. An unverified balance is not zero.",
    producer: "Verified receivables ledger from the Sales and Payments lanes (backend pending)",
    availability: "backend-pending",
    interpretation:
      "Lower outstanding balances are favorable. Receivables can rise with normal sales, so compare them with revenue.",
  },
};

export function getStage22Definition(key: Stage22MetricKey): Stage22Definition {
  return STAGE22_DEFINITIONS[key];
}
