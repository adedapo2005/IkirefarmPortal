// Stage 22 KPI resolver: turns authorized, server-verified metric contracts into one presentation-ready result with its
// status, comparison and provenance. It reuses the existing metric-contract checks (verified source, authorized scope,
// full daily coverage, duplicates, freshness) instead of re-implementing them. Authorization itself is the server's job;
// this layer only trusts the `authorized` flag the server supplied on each contract.
//
// Before any value is read, each record must be the record this measure uses (key, unit and aggregation), and a rate's
// numerator and denominator must share scope and reporting periods. A calculated rate outside its possible range is an
// error. Duplicate days are never collapsed silently, in current or comparison periods.
import {
  periodCoverage,
  resolveMetric,
  type MetricContract,
  type MetricPeriod,
  type MetricPoint,
  type MetricStatus,
  type MetricView,
  type MetricUnit,
} from "./metric-contract";
import {
  compareAmounts,
  compareRates,
  unavailableComparison,
  weightedRatio,
  type Stage22Comparison,
} from "./stage22-kpi-comparison";
import type {Stage22Definition, Stage22PartSpec} from "./stage22-kpi-definitions";

export type Stage22KpiStatus = MetricStatus | "backend-pending";

export type Stage22Sources =
  | Readonly<{kind: "amount"; metric: MetricContract}>
  | Readonly<{kind: "rate" | "ratio"; numerator: MetricContract; denominator: MetricContract}>;

export type Stage22Provenance = Readonly<{
  source: string;
  scope: string | null;
  // The earliest snapshot time among the records used. Null when any record has no snapshot time.
  asOf: string | null;
  maxAgeHours: number | null;
  verifiedDays: number | null;
  expectedDays: number | null;
  currentPeriod: MetricPeriod | null;
  previousPeriod: MetricPeriod | null;
}>;

export type Stage22KpiView = Readonly<{
  key: Stage22Definition["key"];
  label: string;
  unit: Stage22Definition["unit"];
  kind: Stage22Definition["kind"];
  status: Stage22KpiStatus;
  statusLabel: string;
  reason: string | null;
  value: number | null;
  comparison: Stage22Comparison;
  provenance: Stage22Provenance;
  // True only when the definition has a connected producer and the value may be shown (fresh or stale, never guessed).
  mountable: boolean;
}>;

// Plain-language labels for analytics states. Technical wording such as "source-gated" is not shown to people.
export const STAGE22_STATUS_LABELS: Readonly<Record<Stage22KpiStatus, string>> = {
  ready: "Verified",
  stale: "Verified, but older than the freshness limit",
  empty: "No verified records in this period",
  unavailable: "Waiting for verified information",
  loading: "Loading verified records",
  error: "Records need review before use",
  "backend-pending": "Source not connected yet",
};

const STATUS_RANK: Readonly<Record<MetricStatus, number>> = {
  ready: 0,
  stale: 1,
  empty: 2,
  unavailable: 3,
  loading: 4,
  error: 5,
};

const PENDING_REASON = "The authoritative source for this measure is not connected yet, so no value is shown.";

type Assembled = Readonly<{
  status: Stage22KpiStatus;
  reason: string | null;
  value: number | null;
  comparison: Stage22Comparison;
  contracts: readonly MetricContract[];
  verifiedDays: number | null;
  expectedDays: number | null;
  previousPeriod: MetricPeriod | null;
}>;

function earliestAsOf(contracts: readonly MetricContract[]): string | null {
  let earliest: string | null = null;
  for (const contract of contracts) {
    if (!contract.asOf) return null;
    if (earliest === null || Date.parse(contract.asOf) < Date.parse(earliest)) earliest = contract.asOf;
  }
  return earliest;
}

function assemble(definition: Stage22Definition, parts: Assembled): Stage22KpiView {
  const first = parts.contracts[0];
  return {
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    kind: definition.kind,
    status: parts.status,
    statusLabel: STAGE22_STATUS_LABELS[parts.status],
    reason: parts.reason,
    value: parts.value,
    comparison: parts.comparison,
    provenance: {
      source: parts.contracts.length > 0 ? parts.contracts.map((contract) => contract.source.name).join(" ÷ ") : definition.producer,
      scope: first ? first.scope.label : null,
      asOf: earliestAsOf(parts.contracts),
      maxAgeHours: first ? Math.min(...parts.contracts.map((contract) => contract.maxAgeHours)) : null,
      verifiedDays: parts.verifiedDays,
      expectedDays: parts.expectedDays,
      currentPeriod: first ? first.period : null,
      previousPeriod: parts.previousPeriod,
    },
    mountable: definition.availability === "contract-ready" && (parts.status === "ready" || parts.status === "stale"),
  };
}

function pendingView(definition: Stage22Definition): Stage22KpiView {
  return {
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    kind: definition.kind,
    status: "backend-pending",
    statusLabel: STAGE22_STATUS_LABELS["backend-pending"],
    reason: PENDING_REASON,
    value: null,
    comparison: unavailableComparison("No comparison is shown until the source is connected."),
    provenance: {
      source: definition.producer,
      scope: null,
      asOf: null,
      maxAgeHours: null,
      verifiedDays: null,
      expectedDays: null,
      currentPeriod: null,
      previousPeriod: null,
    },
    mountable: false,
  };
}

// A record refused before any value is read. Nothing from it is shown, so provenance names only the producer.
function refusedView(definition: Stage22Definition, reason: string): Stage22KpiView {
  return assemble(definition, {
    status: "error",
    reason,
    value: null,
    comparison: unavailableComparison(reason),
    contracts: [],
    verifiedDays: null,
    expectedDays: null,
    previousPeriod: null,
  });
}

// Refuses a record that is not the one this measure uses: wrong key, unit or aggregation.
function identityProblem(spec: Stage22PartSpec, contract: MetricContract): string | null {
  if (!spec.keys.includes(contract.key)) {
    return `The records supplied are "${contract.key}", which is not a record for this measure, so no value is shown.`;
  }
  if (contract.unit !== spec.unit) {
    return `The records are in ${contract.unit}, but this measure needs ${spec.unit}, so no value is shown.`;
  }
  if (contract.aggregate !== spec.aggregate) {
    return `The records are aggregated as ${contract.aggregate}, but this measure needs ${spec.aggregate}, so no value is shown.`;
  }
  return null;
}

// A verified record must come from the producer the definition names, when one is connected.
function producerProblem(definition: Stage22Definition, contract: MetricContract): string | null {
  if (definition.expectedSource === null || !contract.source.verified) return null;
  return contract.source.name === definition.expectedSource
    ? null
    : "The verified records do not come from the producer for this measure, so no value is shown.";
}

function samePeriod(a: MetricPeriod | null, b: MetricPeriod | null): boolean {
  if (a === null || b === null) return a === b;
  return a.start === b.start && a.end === b.end;
}

// A rate is only meaningful when numerator and denominator cover the same scope and the same current and comparison periods.
function sameBinding(a: MetricContract, b: MetricContract): boolean {
  return a.scope.level === b.scope.level
    && a.scope.label === b.scope.label
    && samePeriod(a.period, b.period)
    && samePeriod(a.comparison?.period ?? null, b.comparison?.period ?? null);
}

function previousReason(metric: MetricContract, view: MetricView): string {
  if (!metric.comparison) return "No previous period was supplied, so no comparison is shown.";
  if (view.comparison && !view.comparison.valid) return view.comparison.reason ?? "The previous period cannot be compared.";
  return "The previous period has no complete verified total, so no comparison is shown.";
}

function coverageOf(metric: MetricContract) {
  const coverage = periodCoverage(metric.series, metric.period);
  return {verifiedDays: coverage.verifiedDays, expectedDays: coverage.expectedDays};
}

function resolveAmount(definition: Stage22Definition, metric: MetricContract, now: Date): Stage22KpiView {
  // Only amount definitions reach here, so their unit is a metric unit rather than the ratio unit.
  const identity = identityProblem(
    {keys: definition.acceptedKeys, unit: definition.unit as MetricUnit, aggregate: definition.aggregate},
    metric,
  ) ?? producerProblem(definition, metric);
  if (identity) return refusedView(definition, identity);

  const view = resolveMetric(metric, now);
  const comparison = view.value === null
    ? unavailableComparison("The current value is not available, so no comparison is shown.")
    : view.previous === null
      ? unavailableComparison(previousReason(metric, view), view.value)
      : compareAmounts({
        current: view.value,
        previous: view.previous,
        polarity: definition.polarity,
        allowNegative: definition.allowNegative,
      });
  return assemble(definition, {
    status: view.status,
    reason: view.reason,
    value: view.value,
    comparison,
    contracts: [metric],
    ...coverageOf(metric),
    previousPeriod: metric.comparison?.period ?? null,
  });
}

// Rates and ratios: weighted from verified numerator and denominator totals. The worst status of the two wins.
function resolveQuotient(
  definition: Stage22Definition,
  sources: Readonly<{numerator: MetricContract; denominator: MetricContract}>,
  now: Date,
): Stage22KpiView {
  if (!definition.parts) return refusedView(definition, "This measure has no numerator and denominator definition.");
  const identity = identityProblem(definition.parts.numerator, sources.numerator)
    ?? identityProblem(definition.parts.denominator, sources.denominator);
  if (identity) return refusedView(definition, identity);
  if (!sameBinding(sources.numerator, sources.denominator)) {
    return refusedView(
      definition,
      "The numerator and denominator come from different scopes or reporting periods, so no rate is shown.",
    );
  }

  const numerator = resolveMetric(sources.numerator, now);
  const denominator = resolveMetric(sources.denominator, now);
  const worst = STATUS_RANK[numerator.status] >= STATUS_RANK[denominator.status] ? numerator : denominator;
  const scale = definition.kind === "rate" ? 100 : 1;
  const bounds = definition.bounds;
  const outOfRange = (candidate: number | null) => bounds !== null
    && candidate !== null
    && (candidate < bounds.min || candidate > bounds.max);

  const ratio = numerator.value === null || denominator.value === null
    ? null
    : weightedRatio([{numerator: numerator.value, denominator: denominator.value}], definition.allowNegative);
  const value = ratio === null ? null : ratio * scale;

  const previousRatio = numerator.previous === null || denominator.previous === null
    ? null
    : weightedRatio([{numerator: numerator.previous, denominator: denominator.previous}], definition.allowNegative);
  const previousCalculated = previousRatio === null ? null : previousRatio * scale;

  const coverageNumerator = coverageOf(sources.numerator);
  const coverageDenominator = coverageOf(sources.denominator);
  const shared = {
    contracts: [sources.numerator, sources.denominator],
    verifiedDays: Math.min(coverageNumerator.verifiedDays, coverageDenominator.verifiedDays),
    expectedDays: coverageNumerator.expectedDays,
    previousPeriod: sources.numerator.comparison?.period ?? null,
  } as const;

  if (numerator.value === null || denominator.value === null) {
    const reason = worst.reason ?? "The current value is not available, so no comparison is shown.";
    return assemble(definition, {
      ...shared,
      status: worst.status === "ready" || worst.status === "stale" ? "unavailable" : worst.status,
      reason,
      value: null,
      comparison: unavailableComparison(reason),
    });
  }

  if (value === null) {
    const reason = "No verified denominator in this period, so this value is not shown.";
    return assemble(definition, {...shared, status: "unavailable", reason, value: null, comparison: unavailableComparison(reason)});
  }

  // An impossible rate (for example 150% laying rate) means the records are wrong. It is never announced as verified.
  if (outOfRange(value)) {
    return refusedView(definition, "The calculated value is outside its possible range, so it is not shown. Check the records.");
  }

  // A previous value outside its range is withheld, but the current value remains valid on its own.
  const previous = outOfRange(previousCalculated) ? null : previousCalculated;
  const previousOutOfRange = previousCalculated !== null && previous === null;

  let comparison: Stage22Comparison;
  if (previous === null) {
    const reason = previousOutOfRange
      ? "The previous period is outside its possible range, so no comparison is shown."
      : numerator.previous === null
        ? previousReason(sources.numerator, numerator)
        : previousReason(sources.denominator, denominator);
    comparison = unavailableComparison(reason, value);
  } else if (definition.kind === "rate") {
    comparison = compareRates({
      current: value,
      previous,
      polarity: definition.polarity,
      allowNegative: definition.allowNegative,
    });
  } else {
    comparison = compareAmounts({
      current: value,
      previous,
      polarity: definition.polarity,
      allowNegative: definition.allowNegative,
    });
  }

  return assemble(definition, {
    ...shared,
    status: worst.status,
    reason: worst.reason,
    value,
    comparison,
  });
}

// Resolves one KPI. A definition without a connected producer is withheld as backend-pending, whatever records are
// supplied, so a fixture can never appear as live data. A mismatched kind of records is an error, not a best guess.
export function resolveStage22Kpi(
  definition: Stage22Definition,
  sources: Stage22Sources,
  now: Date = new Date(),
): Stage22KpiView {
  if (definition.availability === "backend-pending") return pendingView(definition);
  if (sources.kind !== definition.kind) {
    return refusedView(definition, "The supplied records do not match this measure, so no value is shown.");
  }
  return sources.kind === "amount"
    ? resolveAmount(definition, sources.metric, now)
    : resolveQuotient(definition, sources, now);
}

function hasUniqueDates(series: readonly MetricPoint[]): boolean {
  return new Set(series.map((point) => point.date)).size === series.length;
}

function subtractDaily(revenue: readonly MetricPoint[], expenses: readonly MetricPoint[]): MetricPoint[] {
  const costs = new Map(expenses.map((point) => [point.date, point.value] as const));
  return revenue.map((point) => {
    const cost = costs.get(point.date);
    const value = point.value === null || cost === undefined || cost === null ? null : point.value - cost;
    return {date: point.date, value};
  });
}

// Profit is recorded revenue minus recorded expenses, day by day. It is derived only when both sides share scope and
// periods (current and comparison), the records are the revenue and expense records, and no day appears twice on either
// side in either period. Duplicates are refused, never collapsed, because collapsing hides which figure was kept.
export function deriveStage22Profit(revenue: MetricContract, expenses: MetricContract): MetricContract {
  const sameScope = revenue.scope.label === expenses.scope.label && revenue.scope.level === expenses.scope.level;
  const sameCurrentPeriod = samePeriod(revenue.period, expenses.period);
  const sameComparisonPeriod = samePeriod(revenue.comparison?.period ?? null, expenses.comparison?.period ?? null);
  const recordsMatch = revenue.key === "sales-revenue" && expenses.key === "expenses";
  const noDuplicates = [
    revenue.series,
    expenses.series,
    revenue.comparison?.series ?? [],
    expenses.comparison?.series ?? [],
  ].every(hasUniqueDates);
  const aligned = sameScope
    && sameCurrentPeriod
    && sameComparisonPeriod
    && recordsMatch
    && revenue.unit === "NGN"
    && expenses.unit === "NGN"
    && noDuplicates;

  const unavailableReason = aligned
    ? undefined
    : !noDuplicates
      ? "A day appears more than once in the revenue or expense records, so profit cannot be derived without guessing which figure is correct."
      : "Revenue and expenses must be the matching records for the same scope, periods and currency before profit is derived.";
  const status = !aligned ? "error" : revenue.status !== "ready" ? revenue.status : expenses.status;
  const asOf = revenue.asOf && expenses.asOf
    ? (Date.parse(revenue.asOf) <= Date.parse(expenses.asOf) ? revenue.asOf : expenses.asOf)
    : null;

  return {
    key: "profit",
    label: "Profit",
    unit: "NGN",
    polarity: "higher-is-better",
    aggregate: "sum",
    scope: {...revenue.scope, authorized: revenue.scope.authorized && expenses.scope.authorized},
    source: {
      name: `${revenue.source.name} less ${expenses.source.name}`,
      verified: revenue.source.verified && expenses.source.verified,
    },
    status,
    unavailableReason,
    asOf,
    maxAgeHours: Math.min(revenue.maxAgeHours, expenses.maxAgeHours),
    period: revenue.period,
    series: aligned ? subtractDaily(revenue.series, expenses.series) : [],
    comparison: aligned && revenue.comparison && expenses.comparison
      ? {
        period: revenue.comparison.period,
        unit: "NGN",
        series: subtractDaily(revenue.comparison.series, expenses.comparison.series),
      }
      : null,
    target: null,
    drilldown: null,
  };
}
