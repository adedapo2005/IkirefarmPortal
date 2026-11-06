/** Canonical Daily Report presentation data. These helpers never grant authority. */
import {
  captureCanonicalDailyFlockExpectation,
  readCanonicalDailyFlockRecord,
} from "./stage25-canonical-daily-flock-feedback.ts";
import type {
  CanonicalDailyFlockEventKind,
  CanonicalDailyFlockRecord,
  CanonicalDailyFlockWriteData,
} from "./stage25-canonical-daily-flock-feedback.ts";

export type EligibleDailyFlock = Readonly<{
  id: string;
  flockCode: string;
  species: "chicken" | "duck" | "turkey";
  house: string;
  placementDate: string;
}>;
export type DailyFlockChoice = Readonly<{
  id: string;
  flockCode: string;
  eligible: boolean;
  placementDate?: string;
}>;
export type BuildDailyFlockDraftInput = Readonly<{
  flock: DailyFlockChoice | null | undefined;
  localDate: string;
  physicalCount: string;
  noneToday: Partial<Record<CanonicalDailyFlockEventKind, boolean>>;
  notes: string;
  deviceClass: CanonicalDailyFlockWriteData["deviceClass"];
  editingReport?: CanonicalDailyFlockRecord | null;
}>;
export type DailyFlockMetric = Readonly<{
  status: "not-yet-recorded" | "none-recorded" | "awaiting-verification" | "recorded";
  value?: number;
  sourceIds: readonly string[];
}>;
type DailyFlockMetrics = Readonly<{
  mortality: DailyFlockMetric;
  feedConsumedKg: DailyFlockMetric;
  medicationEvents: DailyFlockMetric;
  vaccinationEvents: DailyFlockMetric;
}>;
export type DailyFlockProjection = Readonly<{
  timeZone: "Africa/Lagos";
  localDay: DailyFlockMetrics & Readonly<{
    localDate: string;
    approvalState: "approved" | "missing" | "source-conflict";
  }>;
  rolling24Hours: DailyFlockMetrics;
  currentBirds: Readonly<{
    physicalCount?: number;
    reconciliationState: "not-yet-source-reconciled";
  }>;
  flockPlacement?: Readonly<{
    openingBirds: number;
    placementDate: string;
    sourceId: string;
    sourceRevision: number;
  }>;
}>;

const eventKinds = ["mortality", "medication", "vaccination", "feed"] as const;
const metricKeys = ["mortality", "feedConsumedKg", "medicationEvents", "vaccinationEvents"] as const;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every(key => keys.includes(key));
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && Boolean(value.trim()) && value.length <= max;
const localDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
};
const consistentList = (value: Record<string, unknown>): boolean =>
  Array.isArray(value.items) && value.nextCursor === null &&
  value.state === (value.items.length ? "available" : "no-data");

/** Accept only a complete canonical history response; never turn a failed read into an empty list. */
export function readCanonicalDailyFlockHistory(value: unknown): readonly CanonicalDailyFlockRecord[] | null {
  if (!object(value) || !onlyKeys(value, ["items", "nextCursor", "state"]) || !consistentList(value)) return null;
  const records: CanonicalDailyFlockRecord[] = [];
  const ids = new Set<string>();
  for (const item of value.items as unknown[]) {
    const record = readCanonicalDailyFlockRecord(item);
    if (!record || ids.has(record.id)) return null;
    ids.add(record.id);
    records.push(record);
  }
  return Object.freeze(records);
}

/** Eligibility comes from the authenticated active register, including Flocks with no earlier report. */
export function readEligibleDailyFlocks(value: unknown): readonly EligibleDailyFlock[] | null {
  if (!object(value) || !onlyKeys(value, ["items", "nextCursor", "state", "source", "requiresPreviousDailyReport"]) ||
      !consistentList(value) || value.source !== "Authenticated Active Flock Register" ||
      value.requiresPreviousDailyReport !== false) return null;
  const flocks: EligibleDailyFlock[] = [];
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const item of value.items as unknown[]) {
    if (!object(item) || !onlyKeys(item, ["id", "flockCode", "species", "house", "placementDate"]) ||
        !text(item.id, 120) || !text(item.flockCode, 80) || !text(item.house, 120) || !localDay(item.placementDate) ||
        (item.species !== "chicken" && item.species !== "duck" && item.species !== "turkey")) return null;
    const code = item.flockCode.trim().toLowerCase();
    if (ids.has(item.id) || codes.has(code)) return null;
    ids.add(item.id);
    codes.add(code);
    flocks.push(Object.freeze({ id: item.id, flockCode: item.flockCode, species: item.species,
      house: item.house, placementDate: item.placementDate }));
  }
  return Object.freeze(flocks);
}

/** Merge by immutable Flock identity; historical visibility never implies current write eligibility. */
export function mergeDailyFlocks(
  eligible: readonly EligibleDailyFlock[], history: readonly CanonicalDailyFlockRecord[],
): readonly DailyFlockChoice[] {
  const choices = new Map<string, DailyFlockChoice>();
  for (const flock of eligible) if (!choices.has(flock.id)) choices.set(flock.id,
    Object.freeze({ id: flock.id, flockCode: flock.flockCode, eligible: true, placementDate: flock.placementDate }));
  for (const report of history) if (!choices.has(report.data.flockId)) choices.set(report.data.flockId,
    Object.freeze({ id: report.data.flockId, flockCode: report.data.flockCode, eligible: false }));
  return Object.freeze([...choices.values()]);
}

/** A refresh may add earlier choices without invalidating the operator's selected Flock. */
export function reconcileDailyFlockSelection(
  choices: readonly DailyFlockChoice[], previousId: string,
): Readonly<{ id: string; contextChanged: boolean }> {
  const selected = choices.find(choice => choice.id === previousId) ??
    choices.find(choice => choice.eligible) ?? choices[0];
  const id = selected?.id ?? "";
  return Object.freeze({ id, contextChanged: id !== previousId });
}

/** Build only editable input. Existing structured source links and the stored GPS decision are retained. */
export function buildDailyFlockDraft(input: BuildDailyFlockDraftInput): Readonly<{
  data: CanonicalDailyFlockWriteData | null; error: string | null;
}> {
  const fail = (error: string) => Object.freeze({ data: null, error });
  const flock = input.flock;
  if (!flock || flock.eligible !== true || !text(flock.id, 120) || !text(flock.flockCode, 80) ||
      !localDay(flock.placementDate)) return fail("Select An Eligible Flock From The Active Register.");
  if (!localDay(input.localDate)) return fail("Enter A Valid Reporting Date.");
  if (input.localDate < flock.placementDate) return fail("The Reporting Date Cannot Be Before The Flock Placement Date.");
  const editing = input.editingReport == null ? null : readCanonicalDailyFlockRecord(input.editingReport);
  if (input.editingReport != null && !editing) return fail("The Existing Report Details Could Not Be Confirmed.");
  if (editing && editing.state !== "draft") return fail("Only A Draft Report Can Be Edited.");
  if (editing && (editing.data.flockId !== flock.id || editing.data.localDate !== input.localDate))
    return fail("The Flock And Reporting Date Cannot Be Changed For An Existing Draft.");
  if (typeof input.physicalCount !== "string") return fail("Enter A Whole Physical Count Of Zero Or More, Or Leave It Blank.");
  const physicalText = input.physicalCount.trim();
  const physicalCount = physicalText ? Number(physicalText) : undefined;
  if (physicalText && (!/^\d+$/.test(physicalText) || !Number.isSafeInteger(physicalCount) || Number(physicalCount) < 0))
    return fail("Enter A Whole Physical Count Of Zero Or More, Or Leave It Blank.");
  if (typeof input.notes !== "string" || input.notes.length > 2000) return fail("Keep Notes To 2,000 Characters Or Fewer.");
  if (!object(input.noneToday) || !onlyKeys(input.noneToday, eventKinds) ||
      Object.values(input.noneToday).some(flag => typeof flag !== "boolean")) return fail("Review The None Today Selections.");
  const eventRefs = editing?.data.eventRefs ?? Object.freeze([]);
  const noneToday: Partial<Record<CanonicalDailyFlockEventKind, true>> = {};
  for (const kind of eventKinds) if (input.noneToday[kind] === true) {
    if (eventRefs.some(ref => ref.kind === kind))
      return fail("None Today Conflicts With An Existing Linked Event. Keep The Event Link And Review The Selection.");
    noneToday[kind] = true;
  }
  const data: CanonicalDailyFlockWriteData = {
    kind: "daily-flock-report", flockId: flock.id, flockCode: flock.flockCode,
    localDate: input.localDate, timeZone: "Africa/Lagos", eventRefs,
    ...(physicalCount !== undefined ? { physicalCount } : {}),
    ...(Object.keys(noneToday).length ? { noneToday } : {}),
    ...(input.notes.trim() ? { notes: input.notes } : {}),
    deviceClass: input.deviceClass,
    gps: editing?.data.gps ?? { state: "unavailable" },
  };
  const captured = captureCanonicalDailyFlockExpectation(editing ? {
    operation: "update-draft", expectedData: data, expectedId: editing.id,
    expectedRevision: editing.revision, expectedState: "draft",
  } : { operation: "create-draft", expectedData: data });
  if (!captured) return fail("Review The Report Details Before Saving The Draft.");
  return Object.freeze({ data: captured.expectedData as CanonicalDailyFlockWriteData, error: null });
}

function readMetric(value: unknown): DailyFlockMetric | null {
  if (!object(value) || !onlyKeys(value, ["status", "value", "sourceIds"]) || !Array.isArray(value.sourceIds) ||
      value.sourceIds.length > 25 || value.sourceIds.some(id => !text(id, 160)) ||
      new Set(value.sourceIds).size !== value.sourceIds.length) return null;
  const ids = Object.freeze([...value.sourceIds]) as readonly string[];
  if (value.status === "recorded") {
    if (typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0 || !ids.length) return null;
    return Object.freeze({ status: "recorded", value: value.value, sourceIds: ids });
  }
  if (value.status === "none-recorded") {
    if (value.value !== 0 || ids.length) return null;
    return Object.freeze({ status: "none-recorded", value: 0, sourceIds: ids });
  }
  if ((value.status !== "not-yet-recorded" && value.status !== "awaiting-verification") ||
      Object.hasOwn(value, "value") || ids.length) return null;
  return Object.freeze({ status: value.status, sourceIds: ids });
}

function readMetrics(value: Record<string, unknown>): DailyFlockMetrics | null {
  const mortality = readMetric(value.mortality);
  const feedConsumedKg = readMetric(value.feedConsumedKg);
  const medicationEvents = readMetric(value.medicationEvents);
  const vaccinationEvents = readMetric(value.vaccinationEvents);
  return mortality && feedConsumedKg && medicationEvents && vaccinationEvents ?
    Object.freeze({ mortality, feedConsumedKg, medicationEvents, vaccinationEvents }) : null;
}

/** No numerical coercion, invented rolling totals, or calculated bird-count fallback is accepted. */
export function readDailyFlockProjection(value: unknown, expectedLocalDate: string): DailyFlockProjection | null {
  if (!localDay(expectedLocalDate) || !object(value) ||
      !onlyKeys(value, ["timeZone", "localDay", "rolling24Hours", "currentBirds", "flockPlacement"]) || value.timeZone !== "Africa/Lagos" ||
      !object(value.localDay) || !onlyKeys(value.localDay, ["localDate", "approvalState", ...metricKeys]) ||
      value.localDay.localDate !== expectedLocalDate || !object(value.rolling24Hours) ||
      !onlyKeys(value.rolling24Hours, metricKeys) || !object(value.currentBirds) ||
      !onlyKeys(value.currentBirds, ["physicalCount", "reconciliationState"]) ||
      value.currentBirds.reconciliationState !== "not-yet-source-reconciled") return null;
  const approvalState = value.localDay.approvalState;
  if (approvalState !== "approved" && approvalState !== "missing" && approvalState !== "source-conflict") return null;
  const daily = readMetrics(value.localDay);
  const rolling = readMetrics(value.rolling24Hours);
  if (!daily || !rolling || metricKeys.some(key => rolling[key].status !== "not-yet-recorded")) return null;
  const hasPhysicalCount = Object.hasOwn(value.currentBirds, "physicalCount");
  const physicalCount = value.currentBirds.physicalCount;
  if (hasPhysicalCount && (!Number.isSafeInteger(physicalCount) || Number(physicalCount) < 0)) return null;
  const hasFlockPlacement = Object.hasOwn(value, "flockPlacement");
  const flockPlacement = value.flockPlacement;
  if (hasFlockPlacement && (!object(flockPlacement) ||
      !onlyKeys(flockPlacement, ["openingBirds", "placementDate", "sourceId", "sourceRevision"]) ||
      !Number.isSafeInteger(flockPlacement.openingBirds) || Number(flockPlacement.openingBirds) < 1 ||
      !localDay(flockPlacement.placementDate) || String(flockPlacement.placementDate) > expectedLocalDate ||
      !text(flockPlacement.sourceId, 120) || !Number.isSafeInteger(flockPlacement.sourceRevision) ||
      Number(flockPlacement.sourceRevision) < 1)) return null;
  // A contradictory daily envelope is rejected in full, so no stale local-day value or event source ID can survive.
  if (approvalState === "source-conflict" &&
      (hasPhysicalCount || metricKeys.some(key => daily[key].status !== "awaiting-verification"))) return null;
  if (approvalState === "missing" &&
      (hasPhysicalCount || metricKeys.some(key => daily[key].status !== "not-yet-recorded"))) return null;
  return Object.freeze({ timeZone: "Africa/Lagos",
    localDay: Object.freeze({ localDate: expectedLocalDate, approvalState, ...daily }),
    rolling24Hours: rolling,
    currentBirds: Object.freeze({ reconciliationState: "not-yet-source-reconciled",
      ...(hasPhysicalCount ? { physicalCount: physicalCount as number } : {}) }),
    ...(hasFlockPlacement ? { flockPlacement: Object.freeze({
      openingBirds: (flockPlacement as Record<string, unknown>).openingBirds as number,
      placementDate: (flockPlacement as Record<string, unknown>).placementDate as string,
      sourceId: (flockPlacement as Record<string, unknown>).sourceId as string,
      sourceRevision: (flockPlacement as Record<string, unknown>).sourceRevision as number,
    }) } : {}),
  });
}

export function formatDailyFlockMetric(metric: DailyFlockMetric): string {
  const captured = readMetric(metric);
  if (!captured) return "Awaiting Verification";
  if (captured.status === "recorded" || captured.status === "none-recorded") return String(captured.value);
  return captured.status === "not-yet-recorded" ? "Not Yet Recorded" : "Awaiting Verification";
}

export function labelDailyFlockMetric(metric: DailyFlockMetric): string {
  const captured = readMetric(metric);
  if (!captured) return "Awaiting Verification";
  switch (captured.status) {
    case "recorded": return "Recorded";
    case "none-recorded": return "None Recorded";
    case "not-yet-recorded": return "Not Yet Recorded";
    case "awaiting-verification": return "Awaiting Verification";
  }
}
