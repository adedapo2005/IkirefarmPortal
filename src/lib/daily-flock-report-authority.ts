import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import {
  reconcileFlockMovementHistory,
  type FarmOperationData,
  type FlockMovementData,
} from "./farm-operational-stage24-core.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";

export const DAILY_FLOCK_REPORT_TIME_ZONE = "Africa/Lagos" as const;

export type DailyFlockReportData = Readonly<{
  kind: "daily-flock-report";
  flockId: string;
  flockCode: string;
  localDate: string;
  timeZone: "Africa/Lagos";
  eventRefs: readonly Readonly<{
    kind: "mortality" | "feed" | "medication" | "vaccination";
    id: string;
    revision: number;
    sourceType?: "flock-movement" | "health-event" | "stage24-feed" | "stage24-vaccination";
  }>[];
  physicalCount?: number;
  noneToday?: Readonly<{ mortality?: true; medication?: true; vaccination?: true; feed?: true }>;
  notes?: string;
  deviceClass: "mobile" | "tablet" | "desktop" | "unknown";
  gps?: Readonly<{ state: "consented" | "declined" | "unavailable"; latitude?: number; longitude?: number; accuracyM?: number; capturedAt?: string }>;
  operatorSnapshot?: Readonly<{ name: string; role: string }>;
  amendsReportId?: string;
  amendmentReason?: string;
}>;

export type DailyFlockSourceRecord = Readonly<{
  id: string;
  state: string;
  data: FarmOperationData | DailyFlockReportData;
}>;

export type DailyFlockMetric<T> = Readonly<{
  value?: T;
  status: "recorded" | "none-recorded" | "not-yet-recorded" | "awaiting-verification" | "unit-review-required";
  sourceIds: readonly string[];
}>;

function metric<T>(value: T | undefined, status: DailyFlockMetric<T>["status"], sourceIds: readonly string[]): DailyFlockMetric<T> {
  return Object.freeze({ ...(value === undefined ? {} : { value }), status, sourceIds: Object.freeze([...sourceIds]) });
}

function eventTime(data: FarmOperationData | DailyFlockReportData) {
  if (data.kind === "flock-movement") return data.occurredAt;
  if (data.kind === "feed") return data.occurredAt;
  if (data.kind === "health-event") return data.observedAt;
  if (data.kind === "vaccination") return data.administeredAt;
  return undefined;
}

function lagosDayWindow(localDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  const start = Date.parse(`${localDate}T00:00:00+01:00`);
  const calendar = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!match || !calendar || calendar.getUTCFullYear() !== Number(match[1]) || calendar.getUTCMonth() + 1 !== Number(match[2]) ||
      calendar.getUTCDate() !== Number(match[3]) || !Number.isFinite(start)) throw new RangeError("local report date is invalid");
  return Object.freeze({ start, end: start + 86_400_000 });
}

function within(record: DailyFlockSourceRecord, start: number, end: number) {
  const occurredAt = eventTime(record.data);
  if (!occurredAt) return false;
  const instant = Date.parse(occurredAt);
  return Number.isFinite(instant) && instant >= start && instant < end;
}

function approvedReportNone(report: DailyFlockSourceRecord | undefined, field: keyof NonNullable<DailyFlockReportData["noneToday"]>) {
  return report?.state === "approved" && report.data.kind === "daily-flock-report" && report.data.noneToday?.[field] === true;
}

function verifiedRecords(records: readonly DailyFlockSourceRecord[], flockId: string) {
  return records.filter((record) => {
    if (record.data.kind === "flock-movement") return record.state === "recorded" && record.data.flockId === flockId;
    if (record.data.kind === "feed") return record.state === "posted" && record.data.flockId === flockId;
    if (record.data.kind === "health-event") return ["open", "resolved"].includes(record.state) && record.data.flockId === flockId;
    if (record.data.kind === "vaccination") return record.state === "administered" && record.data.flockId === flockId;
    return false;
  });
}

/** Derives dashboard truth from canonical events. The rolling 24-hour window
 * and the Africa/Lagos report day are deliberately separate outputs. */
export function projectDailyFlockMetrics(input: Readonly<{
  flockId: string;
  openingCount: number;
  localDate: string;
  now: string;
  records: readonly DailyFlockSourceRecord[];
  approvedDailyReport?: DailyFlockSourceRecord;
  physicalCount?: number;
}>) {
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new RangeError("projection time is invalid");
  const day = lagosDayWindow(input.localDate);
  const rollingStart = now - 86_400_000;
  const eligible = input.records.filter((record) =>
    (record.data.kind === "flock-movement" || record.data.kind === "feed" || record.data.kind === "health-event" || record.data.kind === "vaccination") &&
    record.data.flockId === input.flockId);
  const verified = verifiedRecords(input.records, input.flockId);
  const rolling = verified.filter((record) => within(record, rollingStart, now + 1));
  const localDay = verified.filter((record) => within(record, day.start, day.end));
  const pendingRolling = eligible.filter((record) => !verified.includes(record) && within(record, rollingStart, now + 1));
  const pendingLocalDay = eligible.filter((record) => !verified.includes(record) && within(record, day.start, day.end));
  const movements = verified.flatMap((record) => record.data.kind === "flock-movement"
    ? [{ ...record.data, id: record.id }]
    : []);
  const reconciliation = reconcileFlockMovementHistory(input.openingCount, input.flockId, movements, input.physicalCount);
  const movementAdjustments = new Map(verified.flatMap((record) => record.data.kind === "flock-movement" &&
    (record.data.movementType === "correction" || record.data.movementType === "reversal") && record.data.correctionOf
    ? [[record.data.correctionOf, record] as const]
    : []));

  const mortalityMetric = (window: readonly DailyFlockSourceRecord[], pending: readonly DailyFlockSourceRecord[], none: boolean) => {
    const events = window.filter((record) => record.data.kind === "flock-movement" && record.data.movementType === "mortality");
    if (events.length) {
      const sourceIds: string[] = [];
      const value = events.reduce((sum, record) => {
        if (record.data.kind !== "flock-movement") return sum;
        sourceIds.push(record.id);
        const adjustment = movementAdjustments.get(record.id);
        if (adjustment?.data.kind === "flock-movement") sourceIds.push(adjustment.id);
        return sum + record.data.quantity - (adjustment?.data.kind === "flock-movement" ? adjustment.data.correctionDelta ?? 0 : 0);
      }, 0);
      return metric(value, "recorded", sourceIds);
    }
    const awaiting = pending.filter((record) => record.data.kind === "flock-movement" && record.data.movementType === "mortality");
    if (awaiting.length) return metric<number>(undefined, "awaiting-verification", awaiting.map((record) => record.id));
    return none ? metric(0, "none-recorded", []) : metric<number>(undefined, "not-yet-recorded", []);
  };
  const feedMetric = (window: readonly DailyFlockSourceRecord[], pending: readonly DailyFlockSourceRecord[], none: boolean) => {
    const events = window.filter((record) => record.data.kind === "feed" && record.data.useType === "consumption");
    const incompatible = events.filter((record) => record.data.kind === "feed" && record.data.unit === "bag");
    if (incompatible.length) return metric<number>(undefined, "unit-review-required", incompatible.map((event) => event.id));
    if (events.length) return metric(events.reduce((sum, record) => record.data.kind !== "feed" ? sum : sum + (record.data.unit === "ton" ? record.data.quantity * 1000 : record.data.quantity), 0), "recorded", events.map((event) => event.id));
    const awaiting = pending.filter((record) => record.data.kind === "feed" && record.data.useType === "consumption");
    if (awaiting.length) return metric<number>(undefined, "awaiting-verification", awaiting.map((record) => record.id));
    return none ? metric(0, "none-recorded", []) : metric<number>(undefined, "not-yet-recorded", []);
  };
  const treatmentMetric = (window: readonly DailyFlockSourceRecord[], pending: readonly DailyFlockSourceRecord[], none: boolean) => {
    const events = window.filter((record) => record.data.kind === "health-event" && record.data.eventType === "treatment");
    if (events.length) return metric(events.length, "recorded", events.map((event) => event.id));
    const awaiting = pending.filter((record) => record.data.kind === "health-event" && record.data.eventType === "treatment");
    if (awaiting.length) return metric<number>(undefined, "awaiting-verification", awaiting.map((record) => record.id));
    return none ? metric(0, "none-recorded", []) : metric<number>(undefined, "not-yet-recorded", []);
  };
  const vaccinationMetric = (window: readonly DailyFlockSourceRecord[], pending: readonly DailyFlockSourceRecord[], none: boolean) => {
    const events = window.filter((record) => record.data.kind === "vaccination");
    if (events.length) return metric(events.length, "recorded", events.map((event) => event.id));
    const awaiting = pending.filter((record) => record.data.kind === "vaccination");
    if (awaiting.length) return metric<number>(undefined, "awaiting-verification", awaiting.map((record) => record.id));
    return none ? metric(0, "none-recorded", []) : metric<number>(undefined, "not-yet-recorded", []);
  };
  const report = input.approvedDailyReport;
  return Object.freeze({
    timeZone: DAILY_FLOCK_REPORT_TIME_ZONE,
    rolling24Hours: Object.freeze({
      startedAt: new Date(rollingStart).toISOString(),
      endedAt: new Date(now).toISOString(),
      mortality: mortalityMetric(rolling, pendingRolling, false),
      feedConsumedKg: feedMetric(rolling, pendingRolling, false),
      medicationEvents: treatmentMetric(rolling, pendingRolling, false),
      vaccinationEvents: vaccinationMetric(rolling, pendingRolling, false),
    }),
    localDay: Object.freeze({
      localDate: input.localDate,
      startedAt: new Date(day.start).toISOString(),
      endedAt: new Date(day.end).toISOString(),
      approvalState: report?.state ?? "missing",
      mortality: mortalityMetric(localDay, pendingLocalDay, approvedReportNone(report, "mortality")),
      feedConsumedKg: feedMetric(localDay, pendingLocalDay, approvedReportNone(report, "feed")),
      medicationEvents: treatmentMetric(localDay, pendingLocalDay, approvedReportNone(report, "medication")),
      vaccinationEvents: vaccinationMetric(localDay, pendingLocalDay, approvedReportNone(report, "vaccination")),
    }),
    currentBirds: Object.freeze({
      calculated: reconciliation.calculatedClosing,
      ...(reconciliation.physicalCount === undefined ? {} : { physicalCount: reconciliation.physicalCount, variance: reconciliation.variance }),
      movementSourceIds: Object.freeze(movements.map((movement) => movement.id)),
    }),
  });
}

export type DailyReportProtectedField = "detail" | "audit" | "cost";

const FIELD_PERMISSION: Readonly<Record<DailyReportProtectedField, string>> = Object.freeze({
  detail: "farm.daily-report.detail.view",
  audit: "farm.daily-report.audit.view",
  cost: "farm.daily-report.cost.view",
});

export function authorizeDailyReportField(
  principal: AuthenticatedPrincipal,
  subject: AuthorizationSubject,
  field: DailyReportProtectedField,
) {
  const permission = FIELD_PERMISSION[field];
  const decision = authorize(principal, { channel: "api", action: "view", permission, subject });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
  return permission;
}

export function dailyReportStableIdentity(input: Readonly<{
  companyKey: string;
  locationKey: string;
  departmentKey: string;
  flockId: string;
  localDate: string;
  amendsReportId?: string;
}>) {
  // Department is deliberately excluded: one Farm/Site/flock/day remains one
  // record even when attendants and approvers belong to different teams.
  const fields = [input.companyKey, input.locationKey, input.flockId, input.localDate];
  if (input.amendsReportId) fields.push(input.amendsReportId);
  return fields.join("\u001f");
}

export function asFlockMovement(record: DailyFlockSourceRecord): (FlockMovementData & { id: string }) | null {
  return record.data.kind === "flock-movement" ? { ...record.data, id: record.id } : null;
}
