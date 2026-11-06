import { addExactEggCounts, isExactEggCount } from "./exact-egg-count";
import type {EggBatchData} from "@/lib/farm-operational-core";
import {
  addDays,
  isIsoDate,
  type MetricContract,
  type MetricPeriod,
  type MetricPoint,
  type MetricScope,
} from "./metric-contract";

export const EGGS_COLLECTED_KEY = "eggs-collected";
export const EGGS_COLLECTED_SOURCE = "Verified egg-batch records";

export type VerifiedEggBatchRecord = Readonly<{
  state: string;
  data: EggBatchData;
}>;

export function unavailableEggsCollected(scope: MetricScope, period: MetricPeriod): MetricContract {
  return {
    key: EGGS_COLLECTED_KEY,
    label: "Eggs Collected",
    unit: "eggs",
    polarity: "higher-is-better",
    aggregate: "sum",
    scope,
    source: {name: EGGS_COLLECTED_SOURCE, verified: false},
    status: "unavailable",
    unavailableReason: "Verified collection records are needed before this value can be shown.",
    asOf: null,
    maxAgeHours: 24,
    period,
    series: [],
    comparison: null,
    target: null,
    drilldown: null,
  };
}

// Builds the Eggs Collected contract from records the existing farm-operations API already authorized.
// Only `verified` egg-batch records count. A day with no verified batch is a null (not recorded) point, never zero.
// A malformed verified batch makes the whole source an error, because its day total cannot be trusted.
export function eggsCollectedFromVerifiedBatches(input: {
  records: readonly VerifiedEggBatchRecord[];
  scope: MetricScope;
  period: MetricPeriod;
  snapshotAt: string;
  flockCode?: string;
}): MetricContract {
  const {start, end} = input.period;
  const base = unavailableEggsCollected(input.scope, input.period);
  const verified = {...base, source: {name: EGGS_COLLECTED_SOURCE, verified: true}, status: "ready" as const, unavailableReason: undefined, asOf: input.snapshotAt};
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return {...verified, series: []};

  const totals = new Map<string, number>();
  let malformed = false;
  let periodTotal = 0;
  for (const record of input.records) {
    if (record.state !== "verified" || record.data.kind !== "egg-batch") continue;
    if (input.flockCode && record.data.flockCode !== input.flockCode) continue;
    const {collectedAt, quantity} = record.data;
    if (!isExactEggCount(quantity)) return {...base, unavailableReason: "Egg counts cannot be represented exactly."};
    if (!isIsoDate(collectedAt)) {
      malformed = true;
      continue;
    }
    const dailyTotal = addExactEggCounts(totals.get(collectedAt) ?? 0, quantity);
    const nextPeriodTotal = collectedAt >= start && collectedAt <= end
      ? addExactEggCounts(periodTotal, quantity) : periodTotal;
    if (dailyTotal === null || nextPeriodTotal === null) {
      return {...base, unavailableReason: "Egg totals cannot be represented exactly."};
    }
    totals.set(collectedAt, dailyTotal);
    periodTotal = nextPeriodTotal;
  }

  const series: MetricPoint[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    series.push({date, value: totals.get(date) ?? null});
  }

  return {...verified, status: malformed ? "error" : "ready", series};
}
