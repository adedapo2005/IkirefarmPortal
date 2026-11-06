import { addExactEggCounts, isExactEggCount } from "../components/portal/analytics-intelligence/exact-egg-count.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { operationSubject, operationViewPermission } from "./farm-operational-api.ts";
import { authorize } from "./security-authority.ts";
import { FARM_OPERATION_DEFINITIONS, isValidEggCollectionTimestamp, type FarmOperationData } from "./farm-operational-core.ts";
import { ResourceWorkflowError, type ResourceRecord } from "./resource-workflow.ts";
import type { MetricContract, MetricPoint } from "../components/portal/analytics-intelligence/metric-contract.ts";
import { EGGS_COLLECTED_SOURCE } from "../components/portal/analytics-intelligence/egg-collection.ts";

const DAY_MS = 86_400_000;
const FARM_TIME_ZONE = "Africa/Lagos";
type AuthorizedFarmScope = Readonly<{label: string; authorized: boolean}>;
const UNCONFIRMED_SCOPE: AuthorizedFarmScope = {label: "", authorized: false};

function assignedFarmScope(principal: AuthenticatedPrincipal): AuthorizedFarmScope {
  const scope = principal.organizationScope;
  const permission = "farm.eggs.view";
  const primaryScope = principal.permissionScopes?.[permission];
  const scopeSet = principal.permissionScopeSets?.[permission];
  const validScopes = new Set(["own", "assigned", "department", "all"]);
  // This metric is labelled for the whole site. Check the grant itself,
  // before reading records, so a restricted result cannot look site-wide
  // or reveal whether records outside the grant exist.
  const siteWide = scopeSet === undefined
    ? primaryScope === "all"
    : Array.isArray(scopeSet) && scopeSet.length > 0
      && scopeSet.every((value) => validScopes.has(value))
      && scopeSet[0] === primaryScope && scopeSet.includes("all");
  if (!scope?.companyKey?.trim() || !scope.locationKey?.trim()
    || !principal.farmAuthorized || principal.restriction !== "none"
    || !principal.permissions.includes(permission)
    || principal.deniedPermissions?.includes(permission) || !siteWide) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  // A normalized server-authenticated farm key, not a user-supplied display name.
  // A friendly label requires an independently resolved farm-master record.
  return {label: scope.locationKey, authorized: true};
}
export const PRODUCTION_ANALYTICS_WINDOWS = [7, 30, 90] as const;

export type ProductionAnalyticsWindow = (typeof PRODUCTION_ANALYTICS_WINDOWS)[number];

export type ProductionAnalyticsPayload = Readonly<{
  metric: MetricContract;
  connected: readonly ["egg-collection"];
  pending: readonly [
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
  ];
}>;

export const PRODUCTION_ANALYTICS_PENDING: ProductionAnalyticsPayload["pending"] = [
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

export function productionAnalyticsWindow(value: string | null): ProductionAnalyticsWindow {
  const parsed = Number(value);
  return PRODUCTION_ANALYTICS_WINDOWS.includes(parsed as ProductionAnalyticsWindow)
    ? parsed as ProductionAnalyticsWindow
    : 30;
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function calendarDate(value: string, timeZone = FARM_TIME_ZONE) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function eachDay(start: string, end: string, values: ReadonlyMap<string, number>): MetricPoint[] {
  const series: MetricPoint[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    series.push({ date, value: values.get(date) ?? null });
  }
  return series;
}

function unavailableMetric(
  now: Date,
  days: ProductionAnalyticsWindow,
  reason: string,
  farm: AuthorizedFarmScope = UNCONFIRMED_SCOPE,
): MetricContract {
  const end = calendarDate(now.toISOString()) || now.toISOString().slice(0, 10);
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  return {
    key: "egg-collection",
    label: "Eggs Collected",
    unit: "eggs",
    polarity: "higher-is-better",
    aggregate: "sum",
    scope: { level: "farm", label: farm.label, authorized: farm.authorized },
    source: { name: EGGS_COLLECTED_SOURCE, verified: false },
    status: "error",
    unavailableReason: reason,
    asOf: now.toISOString(),
    maxAgeHours: 24,
    period: { label: `Last ${days} days`, start, end },
    series: eachDay(start, end, new Map()),
    comparison: {
      period: { label: `Previous ${days} days`, start: previousStart, end: previousEnd },
      unit: "eggs",
      series: eachDay(previousStart, previousEnd, new Map()),
    },
    target: null,
    drilldown: { href: "#/eggs", permission: "farm.eggs.view", authorized: farm.authorized },
  };
}

export function buildEggCollectionMetric(
  records: readonly ResourceRecord<FarmOperationData>[],
  now: Date = new Date(),
  days: ProductionAnalyticsWindow = 30,
  farm: AuthorizedFarmScope = UNCONFIRMED_SCOPE,
): MetricContract {
  if (!farm.authorized || !farm.label.trim()) {
    return unavailableMetric(now, days, "The farm scope has not been verified.", farm);
  }
  const end = calendarDate(now.toISOString()) || now.toISOString().slice(0, 10);
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  const values = new Map<string, number>();
  let currentTotal = 0;
  let previousTotal = 0;
  const numericUnavailable = () => ({
    ...unavailableMetric(now, days, "Egg counts cannot be represented exactly, so totals and trends are unavailable.", farm),
    status: "unavailable" as const,
  });

  for (const record of records) {
    if (record.data.kind !== "egg-batch" || record.state !== "verified") continue;
    if (!isExactEggCount(record.data.quantity) ||
        !isExactEggCount(record.data.damagedCount) ||
        !isExactEggCount(record.data.rejectedCount)) return numericUnavailable();
    if (FARM_OPERATION_DEFINITIONS["egg-batch"].validate(record.data).length > 0) {
      return unavailableMetric(now, days, "A verified egg-batch record is invalid, so analytics are withheld.", farm);
    }
    const date = isValidEggCollectionTimestamp(record.data.collectedAt)
      ? calendarDate(record.data.collectedAt) : null;
    if (!date || !Number.isInteger(record.data.quantity) || record.data.quantity < 0) {
      return unavailableMetric(now, days, "A verified egg-batch record is invalid, so analytics are withheld.", farm);
    }
    if (date < previousStart || date > end) continue;
    if (Date.parse(record.data.collectedAt) > now.getTime()) {
      return unavailableMetric(now, days, "A verified egg-batch collection time is in the future, so analytics are withheld.", farm);
    }
    const dailyTotal = addExactEggCounts(values.get(date) ?? 0, record.data.quantity);
    const periodTotal = addExactEggCounts(date < start ? previousTotal : currentTotal, record.data.quantity);
    if (dailyTotal === null || periodTotal === null) return numericUnavailable();
    values.set(date, dailyTotal);
    if (date < start) previousTotal = periodTotal;
    else currentTotal = periodTotal;
  }

  return {
    key: "egg-collection",
    label: "Eggs Collected",
    unit: "eggs",
    polarity: "higher-is-better",
    aggregate: "sum",
    scope: { level: "farm", label: farm.label, authorized: farm.authorized },
    source: { name: EGGS_COLLECTED_SOURCE, verified: true },
    status: "ready",
    asOf: now.toISOString(),
    maxAgeHours: 24,
    period: { label: `Last ${days} days`, start, end },
    series: eachDay(start, end, values),
    comparison: {
      period: { label: `Previous ${days} days`, start: previousStart, end: previousEnd },
      unit: "eggs",
      series: eachDay(previousStart, previousEnd, values),
    },
    target: null,
    drilldown: { href: "#/eggs", permission: "farm.eggs.view", authorized: farm.authorized },
  };
}

export async function getProductionAnalytics(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  days: ProductionAnalyticsWindow,
  now: Date = new Date(),
): Promise<ProductionAnalyticsPayload> {
  const farm = assignedFarmScope(principal);
  const decision = authorize(principal, {
    channel: "api", action: "view", permission: operationViewPermission("egg-batch"),
    subject: operationSubject(principal, "egg-batch"),
  });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");

  // The table has no independent company/site columns for a malformed subject.
  // Withhold unconditionally: a conditional check could disclose an inaccessible
  // malformed row, while returning the scoped query would certify a partial total.
  // Do not query records until an authoritative, scope-safe coverage contract exists.
  void db;
  const metric = {
    ...unavailableMetric(now, days, "Egg-record coverage cannot be confirmed, so farm totals and trends are unavailable.", farm),
    status: "unavailable" as const,
  };
  return {metric, connected: ["egg-collection"], pending: PRODUCTION_ANALYTICS_PENDING};
}

export function productionAnalyticsError(error: unknown) {
  if (error instanceof ResourceWorkflowError && error.code === "AUTHORIZATION_DENIED") {
    return { status: 404, body: { error: "NOT_FOUND" } };
  }
  return { status: 503, body: { error: "PRODUCTION_ANALYTICS_UNAVAILABLE" } };
}
