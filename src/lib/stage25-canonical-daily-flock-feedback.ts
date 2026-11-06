/** Presentation proof for the current canonical Daily Report API, never authorization. */
import { interpretOperationFeedback } from "./stage25-feedback-contract.ts";
import type { FeedbackResult } from "./stage25-feedback-contract.ts";

export type CanonicalDailyFlockOperation = "create-draft" | "update-draft" | "submit-report";
export type CanonicalDailyFlockEventKind = "mortality" | "medication" | "vaccination" | "feed";
export type CanonicalDailyFlockEventRef = Readonly<{
  kind: CanonicalDailyFlockEventKind; id: string; revision: number;
  sourceType?: "flock-movement" | "health-event" | "stage24-feed" | "stage24-vaccination";
}>;
export type CanonicalDailyFlockWriteData = Readonly<{
  kind: "daily-flock-report";
  flockId: string;
  flockCode: string;
  localDate: string;
  timeZone: "Africa/Lagos";
  eventRefs: readonly CanonicalDailyFlockEventRef[];
  physicalCount?: number;
  noneToday?: Readonly<Partial<Record<CanonicalDailyFlockEventKind, true>>>;
  notes?: string;
  deviceClass: "mobile" | "tablet" | "desktop" | "unknown";
  gps?: Readonly<{ state: "unavailable" | "declined" }>;
}>;
export type CanonicalDailyFlockRecordData = CanonicalDailyFlockWriteData & Readonly<{
  gps: Readonly<{ state: "unavailable" | "declined" }>;
  operatorSnapshot: Readonly<{ name: string; role: string }>;
}>;
export type CanonicalDailyFlockData = CanonicalDailyFlockRecordData;
export type CanonicalDailyFlockRecord = Readonly<{
  id: string;
  state: "draft" | "submitted" | "approved" | "rejected";
  revision: number;
  data: CanonicalDailyFlockData;
}>;
export type CanonicalDailyFlockExpectation = Readonly<{
  operation: CanonicalDailyFlockOperation;
  /** Exact outgoing data for Save; captured canonical report.data for Submit. */
  expectedData: unknown;
  expectedId?: string;
  expectedRevision?: number;
  expectedState?: "draft";
}>;
export type CanonicalDailyFlockFeedbackInput = CanonicalDailyFlockExpectation & Readonly<{
  httpStatus: number;
  body: unknown;
}>;

const kinds = ["mortality", "medication", "vaccination", "feed"] as const;
const operations = ["create-draft", "update-draft", "submit-report"] as const;
const fields = new Set(["kind", "flockId", "flockCode", "localDate", "timeZone", "eventRefs",
  "physicalCount", "noneToday", "notes", "deviceClass", "gps", "operatorSnapshot"]);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && Boolean(value.trim()) && value.length <= max;
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 1;
const reportId = (value: unknown): value is string =>
  typeof value === "string" && /^daily-flock-[0-9a-f]{64}$/.test(value);
const localDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
};
const noReceipt = (): FeedbackResult => ({
  state: "unconfirmed", tone: "warning", title: "Report Outcome Not Confirmed",
  message: "The Response Did Not Confirm The Requested Report And Details. Do Not Retry Until The Earlier Request Is Reconciled.",
  recordId: null, revision: null, auditId: null, occurredAt: null, canOpenRecord: false, canShowAudit: false,
});

type CapturedData = CanonicalDailyFlockWriteData & Readonly<{
  gps: Readonly<{ state: "unavailable" | "declined" }>;
  operatorSnapshot?: Readonly<{ name: string; role: string }>;
}>;

/** Validate and copy nested data. Sorting only reconciles the server's canonical ref order. */
function captureData(value: unknown, mode: "write-input" | "server-record"): CapturedData | null {
  if (!object(value) || Object.keys(value).some(key => !fields.has(key)) ||
      value.kind !== "daily-flock-report" || !text(value.flockId, 120) || !text(value.flockCode, 80) ||
      !localDay(value.localDate) || value.timeZone !== "Africa/Lagos" ||
      typeof value.deviceClass !== "string" || !["mobile", "tablet", "desktop", "unknown"].includes(value.deviceClass) ||
      !Array.isArray(value.eventRefs) || value.eventRefs.length > 25) return null;
  if (mode === "write-input" && Object.hasOwn(value, "operatorSnapshot")) return null;
  const refs: CanonicalDailyFlockEventRef[] = [];
  const seen = new Set<string>();
  for (const ref of value.eventRefs) {
    if (!object(ref) || Object.keys(ref).some(key => !["kind", "id", "revision", "sourceType"].includes(key)) ||
        !kinds.includes(ref.kind as CanonicalDailyFlockEventKind) || !text(ref.id, 160) || !revision(ref.revision)) return null;
    const validSource = ref.sourceType === undefined ||
      (ref.kind === "mortality" && ref.sourceType === "flock-movement") ||
      (ref.kind === "medication" && ref.sourceType === "health-event") ||
      (ref.kind === "feed" && ref.sourceType === "stage24-feed") ||
      (ref.kind === "vaccination" && ref.sourceType === "stage24-vaccination");
    if (!validSource) return null;
    const key = `${ref.kind}\u001f${ref.id}`;
    if (seen.has(key)) return null;
    seen.add(key);
    refs.push(Object.freeze({ kind: ref.kind as CanonicalDailyFlockEventKind, id: ref.id, revision: ref.revision,
      ...(ref.sourceType !== undefined ? { sourceType: ref.sourceType as NonNullable<CanonicalDailyFlockEventRef["sourceType"]> } : {}),
    }));
  }
  refs.sort((a, b) => a.kind === b.kind ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.kind < b.kind ? -1 : 1);
  let noneToday: Partial<Record<CanonicalDailyFlockEventKind, true>> | undefined;
  if (value.noneToday !== undefined) {
    if (!object(value.noneToday) || Object.keys(value.noneToday).some(key => !kinds.includes(key as CanonicalDailyFlockEventKind)) ||
        Object.values(value.noneToday).some(flag => flag !== true)) return null;
    noneToday = {};
    for (const kind of kinds) if (value.noneToday[kind] === true) noneToday[kind] = true;
    if (refs.some(ref => noneToday?.[ref.kind] === true)) return null;
    Object.freeze(noneToday);
  }
  if (value.physicalCount !== undefined && (!Number.isSafeInteger(value.physicalCount) || Number(value.physicalCount) < 0)) return null;
  if (value.notes !== undefined && !text(value.notes, 2000)) return null;
  const gps = value.gps === undefined && mode === "write-input" ? { state: "unavailable" } : value.gps;
  if (!object(gps) || Object.keys(gps).some(key => key !== "state") ||
      (gps.state !== "unavailable" && gps.state !== "declined")) return null;
  let operatorSnapshot: Readonly<{ name: string; role: string }> | undefined;
  if (mode === "server-record") {
    const snapshot = value.operatorSnapshot;
    if (!object(snapshot) || Object.keys(snapshot).some(key => !["name", "role"].includes(key)) ||
        !text(snapshot.name, 160) || !text(snapshot.role, 160)) return null;
    operatorSnapshot = Object.freeze({ name: snapshot.name, role: snapshot.role });
  }
  return Object.freeze({
    kind: "daily-flock-report", flockId: value.flockId, flockCode: value.flockCode,
    localDate: value.localDate, timeZone: "Africa/Lagos", eventRefs: Object.freeze(refs),
    ...(value.physicalCount !== undefined ? { physicalCount: value.physicalCount as number } : {}),
    ...(noneToday !== undefined ? { noneToday } : {}),
    ...(value.notes !== undefined ? { notes: value.notes as string } : {}),
    deviceClass: value.deviceClass as CanonicalDailyFlockWriteData["deviceClass"],
    gps: Object.freeze({ state: gps.state }), ...(operatorSnapshot ? { operatorSnapshot } : {}),
  });
}

/** Read an authenticated list/detail record. This parser never grants read or write permission. */
export function readCanonicalDailyFlockRecord(value: unknown): CanonicalDailyFlockRecord | null {
  if (!object(value) || !reportId(value.id) || !revision(value.revision) ||
      typeof value.state !== "string" || !["draft", "submitted", "approved", "rejected"].includes(value.state) ||
      (value.resourceType !== undefined && value.resourceType !== "daily-flock-report")) return null;
  // The current detail endpoint omits resourceType; data.kind and any supplied subject must agree.
  if (value.subject !== undefined && (!object(value.subject) || value.subject.resourceType !== "daily-flock-report" ||
      (value.subject.resourceId !== undefined && value.subject.resourceId !== value.id))) return null;
  const data = captureData(value.data, "server-record");
  if (!data?.operatorSnapshot) return null;
  return Object.freeze({ id: value.id, state: value.state as CanonicalDailyFlockRecord["state"],
    revision: value.revision, data: data as CanonicalDailyFlockData });
}

/** Captures caller expectations before async work so later form mutation cannot alter proof. */
export function captureCanonicalDailyFlockExpectation(input: CanonicalDailyFlockExpectation): CanonicalDailyFlockExpectation | null {
  if (!operations.includes(input.operation)) return null;
  const data = captureData(input.expectedData, input.operation === "submit-report" ? "server-record" : "write-input");
  if (!data) return null;
  if (input.operation === "create-draft") {
    if (input.expectedId !== undefined || input.expectedRevision !== undefined || input.expectedState !== undefined) return null;
  } else if (!reportId(input.expectedId) || !revision(input.expectedRevision) ||
      input.expectedRevision >= Number.MAX_SAFE_INTEGER || input.expectedState !== "draft") return null;
  return Object.freeze({ operation: input.operation, expectedData: data,
    ...(input.expectedId !== undefined ? { expectedId: input.expectedId } : {}),
    ...(input.expectedRevision !== undefined ? { expectedRevision: input.expectedRevision } : {}),
    ...(input.expectedState !== undefined ? { expectedState: input.expectedState } : {}),
  });
}

export function interpretCanonicalDailyFlockFeedback(input: CanonicalDailyFlockFeedbackInput): FeedbackResult {
  const action = input.operation === "submit-report" ? "submit" : input.operation === "create-draft" ? "create" : "update";
  if (!operations.includes(input.operation)) return noReceipt();
  if (input.httpStatus !== 200 && input.httpStatus !== 201) {
    const feedback = interpretOperationFeedback({ httpStatus: input.httpStatus, action, body: null });
    return feedback.state === "failed" ? noReceipt() : feedback;
  }
  const expected = captureCanonicalDailyFlockExpectation(input);
  if (!expected || input.httpStatus !== (input.operation === "create-draft" ? 201 : 200) || !object(input.body)) return noReceipt();
  const record = readCanonicalDailyFlockRecord(input.body);
  const nextState = input.operation === "submit-report" ? "submitted" : "draft";
  if (!record || record.state !== nextState) return noReceipt();
  if (input.operation === "create-draft") {
    // Canonical POST may replay an existing record at201; only draft@1 is a fresh-draft confirmation.
    if (record.revision !== 1) return noReceipt();
  } else if (record.id !== expected.expectedId || record.revision !== expected.expectedRevision! + 1) return noReceipt();
  const { operatorSnapshot: actualSnapshot, ...actualFields } = record.data;
  const captured = expected.expectedData as CapturedData;
  const { operatorSnapshot: expectedSnapshot, ...expectedFields } = captured;
  // Save resolves a case/space-insensitive input code to the register's exact code.
  // Submit does not normalize data, so its captured stored code must remain exact.
  const actualProof = input.operation === "submit-report" ? actualFields :
    { ...actualFields, flockCode: actualFields.flockCode.trim().toLowerCase() };
  const expectedProof = input.operation === "submit-report" ? expectedFields :
    { ...expectedFields, flockCode: expectedFields.flockCode.trim().toLowerCase() };
  if (JSON.stringify(actualProof) !== JSON.stringify(expectedProof) ||
      (expectedSnapshot && JSON.stringify(actualSnapshot) !== JSON.stringify(expectedSnapshot))) return noReceipt();
  const feedback = interpretOperationFeedback({ httpStatus: input.httpStatus, action,
    body: { ok: true, action, state: action === "submit" ? "submitted" : "saved", record: { id: record.id, revision: record.revision } },
    auditReadAuthorized: false,
  });
  if (feedback.state !== (action === "submit" ? "submitted" : "saved")) return noReceipt();
  return { ...feedback,
    title: input.operation === "submit-report" ? "Submitted For Review" : input.operation === "create-draft" ? "Draft Saved" : "Draft Changes Saved",
    message: input.operation === "submit-report" ? "The Server Confirmed Submission. Approval Is Still Required." :
      "The Server Confirmed This Draft And Its Details. It Has Not Been Submitted.",
    auditId: null, occurredAt: null, canShowAudit: false,
  };
}
