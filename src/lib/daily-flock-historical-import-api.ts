import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import {
  DAILY_FLOCK_IMPORT_PARSER_VERSION,
  parseDailyFlockHistoricalText,
  type HistoricalFlockCandidate,
  type HistoricalFlockImportParseResult,
} from "./daily-flock-historical-import-parser.ts";
import { dailyReportStableIdentity } from "./daily-flock-report-authority.ts";
import {
  validateDailyReportData,
  type DailyReportData as DailyFlockReportData,
} from "./stage24-current-release-daily-report.ts";
import {
  DAILY_REPORT_AUTHORITY_SQL,
  dailyReportAuthorityParams,
  DAILY_REPORT_FLOCK_ATWRITE_SQL,
  dailyReportFlockWriteParams,
  DAILY_REPORT_NONE_TODAY_PROOF_SQL,
  dailyReportNoneTodayProofParams,
  type DailyReportAuthority,
} from "./stage24-daily-report-d1-guard.ts";
import {
  createFarmOperationalServices,
  FARM_OPERATION_DEFINITIONS,
  reconcileFlockMovementHistory,
  type FarmOperationData,
  type FarmOperationKind,
} from "./farm-operational-stage24-core.ts";
import {
  getFarmOperation,
  listFarmOperations,
  operationSubject,
  requireFeedLineage,
  requireHealthFlockLineage,
  requireMedicineLineage,
} from "./farm-operational-stage24-api.ts";
import { FileEvidenceService, type EvidenceObjectStore } from "./files-evidence.ts";
import { evidenceUploadIntent } from "./evidence-upload-intent.ts";
import { D1ResourceRepository } from "./resource-workflow-d1.ts";
import { D1ResourceRepository as Stage24D1ResourceRepository } from "./resource-workflow-stage24-d1.ts";
import {
  ResourceWorkflowError,
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRecord,
} from "./resource-workflow.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";

const IMPORT_RESOURCE_TYPE = "daily-flock-import";
const MANAGEMENT_PERMISSION = "farm.daily-report.approve";
const MAX_DECISIONS = 500;

const IMPORT_AUTHORITIES = new WeakMap<object, DailyReportAuthority>();
export function bindDailyFlockImportAuthority(principal: AuthenticatedPrincipal, authority: DailyReportAuthority) {
  if (!authority?.sessionId || !authority?.fingerprint || authority.accountId !== principal.id) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["fresh-authorization-unavailable"]);
  IMPORT_AUTHORITIES.set(principal, Object.freeze({ ...authority }));
  return principal;
}
function requireImportAuthority(principal: AuthenticatedPrincipal) {
  const authority = IMPORT_AUTHORITIES.get(principal);
  if (!authority) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["fresh-authorization-unavailable"]);
  return authority;
}
async function verifiedImportRead<T>(db: D1Database, principal: AuthenticatedPrincipal, value: T): Promise<T> {
  const authority = requireImportAuthority(principal);
  const check = await db.prepare("SELECT CASE WHEN " + DAILY_REPORT_AUTHORITY_SQL + " THEN 1 ELSE 0 END AS authorized").bind(...dailyReportAuthorityParams(authority)).first<{ authorized: number }>();
  if (check?.authorized !== 1) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["fresh-authorization-unavailable"]);
  return value;
}

type PersistedSpan = Readonly<{ start: number; end: number }>;
type PersistedMessage = Readonly<{
  sourceHash: string;
  sourceSpan: PersistedSpan;
  sentAtLocal: string | null;
  messageDate: string | null;
  reportDate: string | null;
  attribution: Readonly<{ displayName: string | null; kind: string; verifiedActor: false }>;
  reviewRequired: boolean;
  uncertaintyReasons: readonly string[];
}>;
type PersistedCandidate = Omit<HistoricalFlockCandidate, "sourceSpan"> & Readonly<{ sourceSpan: PersistedSpan }>;

export type DailyFlockImportDecision = Readonly<{
  candidateId: string;
  action: "include" | "skip";
  confirmed: boolean;
  reason: string;
  reportDate?: string;
  occurredAt?: string;
  value?: number | string;
  unit?: "bird" | "kg" | "ton" | "ml" | "litre" | "dose" | "text";
  itemCode?: string;
  inventoryItemId?: string;
  stockMovementId?: string;
  medicineInventoryItemId?: string;
  vaccineCode?: string;
  notes?: string;
  housePen?: string;
  fromHousePen?: string;
  toHousePen?: string;
  withdrawalUntil?: string;
  withdrawalReason?: string;
}>;

export type DailyFlockImportData = Readonly<{
  kind: "daily-flock-import";
  flockId: string;
  flockCode: string;
  sourceEvidenceId: string;
  sourceEvidenceSha256: string;
  sourceHash: string;
  sourceName: string;
  parserVersion: typeof DAILY_FLOCK_IMPORT_PARSER_VERSION;
  format: HistoricalFlockImportParseResult["format"];
  importedAt: string;
  importerSnapshot: Readonly<{ id: string; name: string; role: string; deviceClass: "mobile" | "tablet" | "desktop" | "unknown" }>;
  messages: readonly PersistedMessage[];
  candidates: readonly PersistedCandidate[];
  decisions?: readonly DailyFlockImportDecision[];
  planHash?: string;
  publishedRecordIds?: readonly string[];
}>;

export type DailyFlockImportPreview = Readonly<{
  record: ResourceRecord<DailyFlockImportData>;
  preview: HistoricalFlockImportParseResult;
}>;

type CanonicalPlanItem = Readonly<{
  id: string;
  reportDate: string;
  kind: FarmOperationKind;
  data: FarmOperationData;
}>;

type DailyReportPlanItem = Readonly<{
  id: string;
  reportDate: string;
  data: DailyFlockReportData;
}>;

function bounded(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function validInstant(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day)) return false;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  const zone = match[8];
  if (zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return true;
}

function lagosLocalDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const read = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function validateImport(data: DailyFlockImportData): readonly string[] {
  const errors: string[] = [];
  if (!data || data.kind !== "daily-flock-import" || !bounded(data.flockId, 120) || !bounded(data.flockCode, 80)) errors.push("import flock identity is invalid");
  if (!bounded(data.sourceEvidenceId, 120) || !/^[a-f0-9]{64}$/.test(data.sourceEvidenceSha256) || !/^[a-f0-9]{64}$/.test(data.sourceHash)) errors.push("import source identity is invalid");
  if (!bounded(data.sourceName, 120) || data.parserVersion !== DAILY_FLOCK_IMPORT_PARSER_VERSION || !["whatsapp-export", "pasted-note"].includes(data.format)) errors.push("import source metadata is invalid");
  if (!validInstant(data.importedAt) || !bounded(data.importerSnapshot?.id, 180) || !bounded(data.importerSnapshot?.name, 160) ||
      !bounded(data.importerSnapshot?.role, 160) || !["mobile", "tablet", "desktop", "unknown"].includes(data.importerSnapshot?.deviceClass)) errors.push("import actor metadata is invalid");
  if (!Array.isArray(data.messages) || data.messages.length < 1 || data.messages.length > 500 || !Array.isArray(data.candidates) || data.candidates.length > MAX_DECISIONS) errors.push("import review data is invalid");
  if (data.decisions !== undefined && (!Array.isArray(data.decisions) || data.decisions.length > MAX_DECISIONS)) errors.push("import decisions are invalid");
  if ((data.planHash === undefined) !== (data.decisions === undefined) || (data.planHash !== undefined && !/^[a-f0-9]{64}$/.test(data.planHash))) errors.push("import publication plan is invalid");
  if (data.publishedRecordIds !== undefined && (!Array.isArray(data.publishedRecordIds) || data.publishedRecordIds.length > 1500 || data.publishedRecordIds.some((id) => !bounded(id, 160)))) errors.push("published record references are invalid");
  return errors;
}

const importDefinition = Object.freeze<ResourceDefinition<DailyFlockImportData>>({
  resourceType: IMPORT_RESOURCE_TYPE,
  initialState: "review",
  requireMakerChecker: true,
  mutableStates: ["review", "publishing"],
  permissions: { create: MANAGEMENT_PERMISSION, edit: MANAGEMENT_PERMISSION },
  transitions: [
    { from: "review", to: "publishing", action: "approve", permission: "farm.daily-report.edit", approvalPermission: MANAGEMENT_PERMISSION },
    { from: "review", to: "rejected", action: "approve", permission: "farm.daily-report.edit", approvalPermission: MANAGEMENT_PERMISSION },
    { from: "publishing", to: "published", action: "edit", permission: MANAGEMENT_PERMISSION },
  ],
  validate: validateImport,
});

function scope(principal: AuthenticatedPrincipal) {
  const value = principal.organizationScope;
  if (!value) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  return value;
}

function importSubject(principal: AuthenticatedPrincipal, id: string, ownerId = principal.id): AuthorizationSubject {
  const value = scope(principal);
  return Object.freeze({
    resourceType: IMPORT_RESOURCE_TYPE,
    resourceId: id,
    companyKey: value.companyKey,
    locationKey: value.locationKey,
    departmentKey: value.departmentKey,
    ownerId,
    assigneeIds: [ownerId],
  });
}

function managementAllowed(principal: AuthenticatedPrincipal, subject: AuthorizationSubject, action: "view" | "create" | "edit" = "view") {
  return authorize(principal, { channel: "api", action, permission: MANAGEMENT_PERMISSION, subject }).allowed;
}

function sameScope(principal: AuthenticatedPrincipal, subject: AuthorizationSubject) {
  const value = principal.organizationScope;
  return Boolean(value && subject.companyKey === value.companyKey && subject.locationKey === value.locationKey && subject.departmentKey === value.departmentKey);
}

function decodeImport(row: Record<string, unknown>): ResourceRecord<DailyFlockImportData> | null {
  try {
    if (row.resource_type !== IMPORT_RESOURCE_TYPE || typeof row.id !== "string" || typeof row.state !== "string" || typeof row.revision !== "number" || typeof row.subject_json !== "string" || typeof row.data_json !== "string") return null;
    const subject = JSON.parse(row.subject_json) as AuthorizationSubject;
    const data = JSON.parse(row.data_json) as DailyFlockImportData;
    if (subject.resourceType !== IMPORT_RESOURCE_TYPE || subject.resourceId !== row.id || validateImport(data).length) return null;
    return Object.freeze({ id: row.id, resourceType: IMPORT_RESOURCE_TYPE, state: row.state, revision: row.revision, createdBy: typeof row.created_by === "string" ? row.created_by : null, subject, data });
  } catch { return null; }
}

async function importRecord(db: D1Database, id: string) {
  const row = await db.prepare("SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL").bind(id, IMPORT_RESOURCE_TYPE).first<Record<string, unknown>>();
  return row ? decodeImport(row) : null;
}

function persistedParse(result: HistoricalFlockImportParseResult) {
  return Object.freeze({
    messages: Object.freeze(result.messages.map((message): PersistedMessage => Object.freeze({
      sourceHash: message.sourceHash,
      sourceSpan: Object.freeze({ start: message.sourceSpan.start, end: message.sourceSpan.end }),
      sentAtLocal: message.sentAtLocal,
      messageDate: message.messageDate,
      reportDate: message.reportDate,
      attribution: message.attribution,
      reviewRequired: message.reviewRequired,
      uncertaintyReasons: message.uncertaintyReasons,
    }))),
    candidates: Object.freeze(result.candidates.map((candidate): PersistedCandidate => Object.freeze({
      ...candidate,
      sourceSpan: Object.freeze({ start: candidate.sourceSpan.start, end: candidate.sourceSpan.end }),
    }))),
  });
}

async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function stableId(prefix: string, identity: string) {
  return `${prefix}-${await sha256(identity)}`;
}

function importService(db: D1Database, now?: () => string, authority?: DailyReportAuthority) {
  return new ResourceWorkflowService(importDefinition, new D1ResourceRepository<DailyFlockImportData>(db, now, authority), now);
}

export async function createDailyFlockImportPreview(
  db: D1Database,
  objects: EvidenceObjectStore,
  principal: AuthenticatedPrincipal,
  input: Readonly<{ flockId: string; sourceText: string; sourceName?: string; deviceClass?: "mobile" | "tablet" | "desktop" | "unknown" }>,
  now: () => string = () => new Date().toISOString(),
): Promise<DailyFlockImportPreview> {
  const authority = requireImportAuthority(principal);
  if (!bounded(input.flockId, 120) || typeof input.sourceText !== "string" || !input.sourceText.length ||
      (input.sourceName !== undefined && !bounded(input.sourceName, 120)) ||
      (input.deviceClass !== undefined && !["mobile", "tablet", "desktop", "unknown"].includes(input.deviceClass))) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["historical import preview input is invalid"]);
  }
  // Reject non-management callers before resolving a flock so the preview
  // endpoint cannot be used to probe canonical flock identifiers.
  if (!managementAllowed(principal, importSubject(principal, "daily-flock-import-preview"), "create")) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  const flock = await getFarmOperation(db, principal, "flock", input.flockId);
  if (!flock || !sameScope(principal, flock.subject) || flock.state !== "active" || flock.data.kind !== "flock") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const parsed = await parseDailyFlockHistoricalText(input.sourceText);
  const raw = new TextEncoder().encode(input.sourceText);
  const rawHash = await sha256(raw);
  const value = scope(principal);
  const id = await stableId("daily-flock-import", [value.companyKey, value.locationKey, value.departmentKey, flock.id, rawHash].join("\u001f"));
  const subject = importSubject(principal, id);
  if (!managementAllowed(principal, subject, "create")) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  const existing = await importRecord(db, id);
  if (existing) {
    if (!sameScope(principal, existing.subject) || !managementAllowed(principal, existing.subject)) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    return verifiedImportRead(db, principal, Object.freeze({ record: existing, preview: parsed }));
  }

  const sourceName = input.sourceName?.trim() || "daily-flock-report.txt";
  const evidenceId = await stableId("daily-flock-source", [value.companyKey, value.locationKey, value.departmentKey, flock.id, rawHash].join("\u001f"));
  const evidenceSubject: AuthorizationSubject = Object.freeze({
    resourceType: "file-evidence", resourceId: evidenceId, companyKey: value.companyKey,
    locationKey: value.locationKey, departmentKey: value.departmentKey, ownerId: principal.id, assigneeIds: [principal.id],
  });
  const intent = evidenceUploadIntent(db, objects, principal, authority, evidenceSubject, evidenceId);
  const evidence = new FileEvidenceService(new D1ResourceRepository(db, now, authority), objects, now, intent);
  let sourceEvidence;
  try {
    sourceEvidence = await evidence.upload(principal, { id: evidenceId, subject: evidenceSubject, originalName: sourceName, contentType: "text/plain", body: raw, expectedSha256: rawHash });
  } catch (error) {
    if (!(error instanceof ResourceWorkflowError && error.code === "RESOURCE_EXISTS")) throw error;
    sourceEvidence = await evidence.metadata(principal, evidenceId);
    if (sourceEvidence.sha256 !== rawHash) throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  const stored = persistedParse(parsed);
  const data: DailyFlockImportData = Object.freeze({
    kind: "daily-flock-import", flockId: flock.id, flockCode: flock.data.flockCode,
    sourceEvidenceId: evidenceId, sourceEvidenceSha256: sourceEvidence.sha256, sourceHash: parsed.sourceHash,
    sourceName, parserVersion: DAILY_FLOCK_IMPORT_PARSER_VERSION, format: parsed.format, importedAt: now(),
    importerSnapshot: Object.freeze({ id: principal.id, name: principal.displayName, role: principal.jobTitle || "Farm management", deviceClass: input.deviceClass || "unknown" }),
    messages: stored.messages, candidates: stored.candidates,
  });
  try {
    return verifiedImportRead(db, principal, Object.freeze({ record: await importService(db, now, authority).create(principal, { id, subject, data }), preview: parsed }));
  } catch (error) {
    if (!(error instanceof ResourceWorkflowError && error.code === "RESOURCE_EXISTS")) throw error;
    const raced = await importRecord(db, id);
    if (!raced || !sameScope(principal, raced.subject) || raced.data.sourceEvidenceSha256 !== rawHash) throw error;
    return verifiedImportRead(db, principal, Object.freeze({ record: raced, preview: parsed }));
  }
}

export async function getDailyFlockImport(db: D1Database, principal: AuthenticatedPrincipal, id: string) {
  requireImportAuthority(principal);
  if (!bounded(id, 160)) return verifiedImportRead(db, principal, null);
  if (!managementAllowed(principal, importSubject(principal, id))) return verifiedImportRead(db, principal, null);
  const record = await importRecord(db, id);
  const visible = record && sameScope(principal, record.subject) && managementAllowed(principal, record.subject) ? record : null;
  return verifiedImportRead(db, principal, visible);
}

const decisionFields = new Set([
  "candidateId", "action", "confirmed", "reason", "reportDate", "occurredAt", "value", "unit", "itemCode", "inventoryItemId",
  "stockMovementId", "medicineInventoryItemId", "vaccineCode", "notes", "housePen", "fromHousePen", "toHousePen", "withdrawalUntil", "withdrawalReason",
]);

function reviewedDecision(candidate: PersistedCandidate, raw: DailyFlockImportDecision): DailyFlockImportDecision {
  if (!raw || Object.keys(raw).some((field) => !decisionFields.has(field)) || raw.candidateId !== candidate.id || !["include", "skip"].includes(raw.action) ||
      raw.confirmed !== true || !bounded(raw.reason, 500)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["every candidate needs an explicit confirmed decision and reason"]);
  if (raw.action === "skip") return Object.freeze({ candidateId: raw.candidateId, action: "skip", confirmed: true, reason: raw.reason.trim() });
  const reportDate = raw.reportDate ?? candidate.reportDate;
  const value = raw.value ?? candidate.value;
  const sourceUnit = candidate.unit === "tonne" ? "ton" : candidate.unit;
  const unit = raw.unit ?? sourceUnit;
  if (!validDate(reportDate)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["included candidates require an unambiguous report date"]);
  if (candidate.explicitNone) {
    const expectedUnit = candidate.kind === "mortality" ? "bird" :
      candidate.kind === "medication-administered" || candidate.kind === "vaccination" ? "text" : null;
    if (value !== 0 || !expectedUnit || sourceUnit !== expectedUnit || unit !== expectedUnit) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["None Today requires its original zero value and category unit"]);
    }
    return Object.freeze({ ...raw, action: "include", confirmed: true, reportDate, value: 0, unit: expectedUnit, reason: raw.reason.trim() });
  }
  if (!validInstant(raw.occurredAt)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["included events require the time they actually happened"]);
  const start = Date.parse(`${reportDate}T00:00:00+01:00`);
  const instant = Date.parse(raw.occurredAt);
  if (instant < start || instant >= start + 86_400_000) throw new ResourceWorkflowError("VALIDATION_FAILED", ["event time must fall inside the reviewed Africa/Lagos report date"]);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new ResourceWorkflowError("VALIDATION_FAILED", ["included event value is invalid"]);
  const birdCount = ["placement", "mortality", "cull", "transfer-in", "transfer-out"].includes(candidate.kind);
  if (birdCount && (sourceUnit !== "bird" || unit !== "bird" || !Number.isSafeInteger(value))) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["bird movements require a whole number of birds"]);
  }
  if (candidate.kind === "feed-consumed" && (!["kg", "ton"].includes(sourceUnit) || unit !== sourceUnit)) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["feed requires its verified kg or tonne unit; bag or unverified conversion is not supported"]);
  }
  if (candidate.kind === "medication-administered" && (!["ml", "litre", "dose"].includes(sourceUnit) || unit !== sourceUnit)) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["medication requires the verified source unit"]);
  }
  if (candidate.kind === "vaccination" && (sourceUnit !== "dose" || unit !== "dose" || !Number.isSafeInteger(value))) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["vaccination requires a whole number of verified doses"]);
  }
  return Object.freeze({ ...raw, action: "include", confirmed: true, reportDate, occurredAt: raw.occurredAt, value, unit: unit as DailyFlockImportDecision["unit"], reason: raw.reason.trim() });
}

function movementType(kind: PersistedCandidate["kind"]): Extract<FarmOperationData, { kind: "flock-movement" }>["movementType"] | null {
  return kind === "placement" ? "placement" : kind === "mortality" ? "mortality" : kind === "cull" ? "cull" : kind === "transfer-in" ? "transfer-in" : kind === "transfer-out" ? "transfer-out" : null;
}

async function buildPlan(record: ResourceRecord<DailyFlockImportData>, decisions: readonly DailyFlockImportDecision[]) {
  if (!Array.isArray(decisions) || decisions.length !== record.data.candidates.length || decisions.length > MAX_DECISIONS) throw new ResourceWorkflowError("VALIDATION_FAILED", ["review every parser candidate exactly once"]);
  const byId = new Map(decisions.map((decision) => [decision?.candidateId, decision]));
  if (byId.size !== decisions.length) throw new ResourceWorkflowError("VALIDATION_FAILED", ["candidate decisions contain duplicates"]);
  const reviewed = record.data.candidates.map((candidate) => {
    const decision = byId.get(candidate.id);
    if (!decision) throw new ResourceWorkflowError("VALIDATION_FAILED", ["review every parser candidate exactly once"]);
    return reviewedDecision(candidate, decision);
  });
  const includedFingerprints = new Set<string>();
  const plan: CanonicalPlanItem[] = [];
  for (let index = 0; index < record.data.candidates.length; index += 1) {
    const candidate = record.data.candidates[index];
    const decision = reviewed[index];
    if (decision.action === "skip" || candidate.explicitNone) continue;
    if (candidate.duplicateOf || includedFingerprints.has(candidate.fingerprint)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["duplicate import candidates cannot both publish"]);
    includedFingerprints.add(candidate.fingerprint);
    const base = [record.subject.companyKey, record.subject.locationKey, record.data.flockId, candidate.fingerprint].join("\u001f");
    const movement = movementType(candidate.kind);
    if (movement) {
      const id = await stableId("daily-import-movement", base);
      const data: Extract<FarmOperationData, { kind: "flock-movement" }> = {
        kind: "flock-movement", flockId: record.data.flockId, flockCode: record.data.flockCode, movementType: movement,
        quantity: decision.value as number, occurredAt: decision.occurredAt!, reason: `Approved historical import: ${decision.reason}`,
        ...(decision.housePen ? { housePen: decision.housePen } : {}), ...(decision.fromHousePen ? { fromHousePen: decision.fromHousePen } : {}), ...(decision.toHousePen ? { toHousePen: decision.toHousePen } : {}),
      };
      plan.push({ id, reportDate: decision.reportDate!, kind: "flock-movement", data });
      if (movement === "mortality" || movement === "cull") {
        const healthId = await stableId("daily-import-health", base);
        plan.push({ id: healthId, reportDate: decision.reportDate!, kind: "health-event", data: {
          kind: "health-event", flockId: record.data.flockId, flockCode: record.data.flockCode, eventType: movement,
          observedAt: decision.occurredAt!, quantity: decision.value as number, movementId: id,
          notes: decision.notes?.trim() || (movement === "mortality" ? "Birds that died, confirmed during historical report review." : "Birds removed from the flock, confirmed during historical report review."),
          ...(decision.housePen ? { housePen: decision.housePen } : {}), evidenceIds: [record.data.sourceEvidenceId],
        } });
      }
      continue;
    }
    if (candidate.kind === "feed-consumed") {
      if (!bounded(decision.itemCode, 80) || !bounded(decision.inventoryItemId, 120) || !bounded(decision.stockMovementId, 120) || !["kg", "ton"].includes(decision.unit || "")) throw new ResourceWorkflowError("VALIDATION_FAILED", ["feed publication requires canonical Inventory item, issue movement, item code and kg or ton unit"]);
      plan.push({ id: await stableId("daily-import-feed", base), reportDate: decision.reportDate!, kind: "feed", data: {
        kind: "feed", itemCode: decision.itemCode, quantity: decision.value as number, unit: decision.unit as "kg" | "ton",
        inventoryItemId: decision.inventoryItemId, stockMovementId: decision.stockMovementId, flockId: record.data.flockId,
        flockCode: record.data.flockCode, useType: "consumption", occurredAt: decision.occurredAt!, evidenceIds: [record.data.sourceEvidenceId],
      } });
      continue;
    }
    if (candidate.kind === "medication-administered") {
      if (!bounded(decision.notes, 2000)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["medication publication requires confirmed treatment notes"]);
      const treatmentNotes = `${decision.notes.trim()}\nReviewed administered amount: ${decision.value} ${decision.unit}.`;
      if (treatmentNotes.length > 2000) throw new ResourceWorkflowError("VALIDATION_FAILED", ["treatment notes and amount exceed the supported length"]);
      plan.push({ id: await stableId("daily-import-treatment", base), reportDate: decision.reportDate!, kind: "health-event", data: {
        kind: "health-event", flockId: record.data.flockId, flockCode: record.data.flockCode, eventType: "treatment", observedAt: decision.occurredAt!, notes: treatmentNotes,
        ...(decision.medicineInventoryItemId ? { medicineInventoryItemId: decision.medicineInventoryItemId } : {}),
        ...(decision.withdrawalUntil ? { withdrawalUntil: decision.withdrawalUntil } : {}), ...(decision.withdrawalReason ? { withdrawalReason: decision.withdrawalReason } : {}),
        evidenceIds: [record.data.sourceEvidenceId],
      } });
      continue;
    }
    if (candidate.kind === "vaccination") {
      if (!bounded(decision.vaccineCode, 80) || !Number.isSafeInteger(decision.value)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["vaccination publication requires vaccine code and whole-number dose"]);
      plan.push({ id: await stableId("daily-import-vaccination", base), reportDate: decision.reportDate!, kind: "vaccination", data: {
        kind: "vaccination", flockId: record.data.flockId, flockCode: record.data.flockCode, vaccineCode: decision.vaccineCode, dose: decision.value as number,
        administeredAt: decision.occurredAt!, ...(decision.medicineInventoryItemId ? { medicineInventoryItemId: decision.medicineInventoryItemId } : {}),
      } });
    }
  }
  if (!reviewed.some((decision) => decision.action === "include")) throw new ResourceWorkflowError("VALIDATION_FAILED", ["publish at least one confirmed value or None Today decision"]);
  const planHash = await sha256(JSON.stringify(reviewed));
  return Object.freeze({ decisions: Object.freeze(reviewed), plan: Object.freeze(plan), planHash });
}

function validateDailyReportImport(data: DailyFlockReportData): readonly string[] {
  return validateDailyReportData(data);
}

async function buildDailyReportPlan(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  record: ResourceRecord<DailyFlockImportData>,
  decisions: readonly DailyFlockImportDecision[],
  plan: readonly CanonicalPlanItem[],
  requirePersistedSources: boolean,
): Promise<readonly DailyReportPlanItem[]> {
  const dates = new Set(decisions.flatMap((decision) => decision.action === "include" && decision.reportDate ? [decision.reportDate] : []));
  return Object.freeze(await Promise.all([...dates].sort().map(async (reportDate): Promise<DailyReportPlanItem> => {
    const eventRefs: DailyFlockReportData["eventRefs"][number][] = [];
    for (const item of plan.filter((entry) => entry.reportDate === reportDate)) {
      let category: DailyFlockReportData["eventRefs"][number]["kind"] | null = null;
      let sourceType: NonNullable<DailyFlockReportData["eventRefs"][number]["sourceType"]> | null = null;
      if (item.data.kind === "flock-movement" && item.data.movementType === "mortality") {
        category = "mortality"; sourceType = "flock-movement";
      } else if (item.data.kind === "health-event" && item.data.eventType === "treatment") {
        category = "medication"; sourceType = "health-event";
      } else if (item.data.kind === "feed" && item.data.useType === "consumption") {
        category = "feed"; sourceType = "stage24-feed";
      } else if (item.data.kind === "vaccination") {
        category = "vaccination"; sourceType = "stage24-vaccination";
      }
      // Placements, transfers, culls, and the linked mortality health note
      // remain import receipts; none is relabelled as a report metric.
      if (!category || !sourceType) continue;
      const source = await getFarmOperation(db, principal, item.kind, item.id);
      if (!source) {
        if (requirePersistedSources) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
        continue;
      }
      const targetState = item.kind === "feed" ? "posted" : item.kind === "vaccination" ? "administered" : FARM_OPERATION_DEFINITIONS[item.kind].initialState;
      if (!sameScope(principal, source.subject) ||
          !Number.isSafeInteger(source.revision) || source.revision < 1 ||
          JSON.stringify(source.data) !== JSON.stringify(item.data)) {
        throw new ResourceWorkflowError("RESOURCE_EXISTS", ["source does not match the approved import plan"]);
      }
      if (source.state !== targetState) {
        if (!requirePersistedSources && source.state === FARM_OPERATION_DEFINITIONS[item.kind].initialState) continue;
        throw new ResourceWorkflowError("RESOURCE_EXISTS", ["source is not in an allowed state"]);
      }
      eventRefs.push({ kind: category, id: source.id, revision: source.revision, sourceType });
    }
    const noneToday: { mortality?: true; feed?: true; medication?: true; vaccination?: true } = {};
    for (let index = 0; index < record.data.candidates.length; index += 1) {
      const candidate = record.data.candidates[index];
      const decision = decisions[index];
      if (decision.action !== "include" || decision.reportDate !== reportDate || !candidate.explicitNone) continue;
      if (candidate.kind === "mortality") noneToday.mortality = true;
      if (candidate.kind === "feed-consumed") noneToday.feed = true;
      if (candidate.kind === "medication-administered") noneToday.medication = true;
      if (candidate.kind === "vaccination") noneToday.vaccination = true;
    }
    const identity = dailyReportStableIdentity({
      companyKey: record.subject.companyKey!,
      locationKey: record.subject.locationKey!,
      departmentKey: record.subject.departmentKey!,
      flockId: record.data.flockId,
      localDate: reportDate,
    });
    const data: DailyFlockReportData = Object.freeze({
      kind: "daily-flock-report",
      flockId: record.data.flockId,
      flockCode: record.data.flockCode,
      localDate: reportDate,
      timeZone: "Africa/Lagos",
      eventRefs: Object.freeze(eventRefs),
      ...(Object.keys(noneToday).length ? { noneToday: Object.freeze({ ...noneToday }) } : {}),
      notes: "Approved historical import. Original source is retained as restricted evidence.",
      deviceClass: record.data.importerSnapshot.deviceClass,
      gps: Object.freeze({ state: "unavailable" as const }),
      operatorSnapshot: Object.freeze({ name: record.data.importerSnapshot.name, role: record.data.importerSnapshot.role }),
    });
    const errors = validateDailyReportImport(data);
    if (errors.length) throw new ResourceWorkflowError("VALIDATION_FAILED", errors);
    return Object.freeze({ id: await stableId("daily-flock", identity), reportDate, data });
  })));
}

async function approvedDailyReportExists(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  importRecordSnapshot: ResourceRecord<DailyFlockImportData>,
  report: DailyReportPlanItem,
) {
  requireImportAuthority(principal);
  const current = await db.prepare("SELECT id, state, revision, created_by, data_json, subject_json FROM resource_records WHERE id = ? AND resource_type = 'daily-flock-report' AND deleted_at IS NULL").bind(report.id).first<Record<string, unknown>>();
  if (!current) return false;
  let storedSubject: AuthorizationSubject | null = null;
  let storedData: unknown = null;
  try {
    storedSubject = typeof current.subject_json === "string" ? JSON.parse(current.subject_json) as AuthorizationSubject : null;
    storedData = typeof current.data_json === "string" ? JSON.parse(current.data_json) : null;
  } catch {
    throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  const liveImport = await getDailyFlockImport(db, principal, importRecordSnapshot.id);
  if (current.state !== "approved" || current.revision !== 1 || !storedSubject || !sameScope(principal, storedSubject) ||
      storedSubject.resourceType !== "daily-flock-report" || storedSubject.resourceId !== report.id ||
      current.created_by !== (importRecordSnapshot.createdBy || importRecordSnapshot.data.importerSnapshot.id) ||
      JSON.stringify(storedData) !== JSON.stringify(report.data) ||
      importRecordSnapshot.state !== "publishing" || !importRecordSnapshot.data.planHash ||
      !liveImport || liveImport.state !== "publishing" || liveImport.data.planHash !== importRecordSnapshot.data.planHash) {
    throw new ResourceWorkflowError("RESOURCE_EXISTS", ["a different daily report already exists for this Flock date; use the linked correction workflow before importing more events"]);
  }
  const events = (await db.prepare("SELECT actor_id, action, permission, metadata_json FROM resource_audit_events WHERE resource_id = ? AND resource_type = 'daily-flock-report'").bind(report.id).all<Record<string, unknown>>()).results || [];
  const expectedRefs = report.data.eventRefs.map((ref) => `${ref.kind}:${ref.id}`);
  const matches = (event: Record<string, unknown>, action: string, marker: string) => {
    if (event.action !== action || typeof event.metadata_json !== "string") return false;
    try {
      const metadata = JSON.parse(event.metadata_json) as Record<string, unknown>;
      return metadata.event === marker && metadata.importId === importRecordSnapshot.id &&
        metadata.planHash === importRecordSnapshot.data.planHash &&
        metadata.sourceEvidenceId === importRecordSnapshot.data.sourceEvidenceId &&
        metadata.localDate === report.reportDate && JSON.stringify(metadata.immutableEventRefs) === JSON.stringify(expectedRefs);
    } catch { return false; }
  };
  const creation = events.filter((event) => matches(event, "create", "daily-flock-report.imported") &&
    event.actor_id === current.created_by && event.permission === "farm.daily-report.edit");
  const approval = events.filter((event) => matches(event, "approve", "daily-flock-report.approved-from-import") &&
    event.permission === MANAGEMENT_PERMISSION);
  if (events.length !== 2 || creation.length !== 1 || approval.length !== 1) {
    throw new ResourceWorkflowError("RESOURCE_EXISTS", ["daily report provenance does not match the approved import plan"]);
  }
  return verifiedImportRead(db, principal, true);
}

async function preflightPlan(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  record: ResourceRecord<DailyFlockImportData>,
  plan: readonly CanonicalPlanItem[],
  dailyReports: readonly DailyReportPlanItem[],
) {
  const flock = await getFarmOperation(db, principal, "flock", record.data.flockId);
  if (!flock || !sameScope(principal, flock.subject) || flock.state !== "active" || flock.data.kind !== "flock" || flock.data.flockCode !== record.data.flockCode) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const currentMovements = (await listFarmOperations(db, principal, "flock-movement"))
    .filter((item) => sameScope(principal, item.subject));
  const proposedMovements = plan.filter((item) => item.kind === "flock-movement").map((item) => ({ id: item.id, ...(item.data as Extract<FarmOperationData, { kind: "flock-movement" }>) }));
  // A committed movement is reusable only on an already-approved publishing
  // plan, at the deterministic plan ID, with its exact scoped content/state.
  const reusable = new Set<string>();
  for (const proposed of proposedMovements) {
    const found = await getFarmOperation(db, principal, "flock-movement", proposed.id);
    if (!found) continue;
    const planned = plan.find((item) => item.id === proposed.id);
    if (!planned || record.state !== "publishing" || !record.data.planHash ||
        !sameScope(principal, found.subject) || found.id !== proposed.id ||
        found.resourceType !== "flock-movement" || found.state !== "recorded" ||
        JSON.stringify(found.data) !== JSON.stringify(planned.data)) {
      throw new ResourceWorkflowError("RESOURCE_EXISTS", ["existing movement does not match the approved import plan"]);
    }
    reusable.add(proposed.id);
  }
  const existingPlacement = currentMovements.some((item) => item.state === "recorded" &&
    item.data.kind === "flock-movement" && item.data.flockId === flock.id &&
    item.data.movementType === "placement" && !reusable.has(item.id));
  const proposedPlacement = proposedMovements.filter((item) => item.movementType === "placement");
  if (proposedPlacement.length > 1 || (proposedPlacement.length && existingPlacement) || (proposedPlacement[0] && proposedPlacement[0].quantity !== flock.data.birdCount)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["initial placement must match the Flock opening count and can be posted only once"]);
  for (const proposed of proposedMovements) {
    const proposedItem = plan.find((item) => item.id === proposed.id)!;
    const overlaps = currentMovements.some((item) => item.id !== proposed.id && item.state === "recorded" && item.data.kind === "flock-movement" &&
      item.data.flockId === flock.id && item.data.movementType === proposed.movementType && item.data.quantity === proposed.quantity &&
      lagosLocalDate(item.data.occurredAt) === proposedItem.reportDate);
    if (overlaps) throw new ResourceWorkflowError("RESOURCE_EXISTS", ["an existing Flock movement overlaps this reviewed import candidate"]);
  }
  const proposedFeed = plan.filter((item) => item.kind === "feed");
  const currentFeed = proposedFeed.length ? await listFarmOperations(db, principal, "feed") : [];
  for (const proposed of proposedFeed) {
    const data = proposed.data as Extract<FarmOperationData, { kind: "feed" }>;
    const overlaps = currentFeed.some((item) => item.id !== proposed.id && item.state === "posted" && item.data.kind === "feed" &&
      item.data.flockId === flock.id && item.data.itemCode === data.itemCode && item.data.quantity === data.quantity &&
      item.data.unit === data.unit && typeof item.data.occurredAt === "string" && lagosLocalDate(item.data.occurredAt) === proposed.reportDate);
    if (overlaps) throw new ResourceWorkflowError("RESOURCE_EXISTS", ["an existing Feed consumption record overlaps this reviewed import candidate"]);
  }
  const effective = currentMovements.flatMap((item) => item.state === "recorded" && item.data.kind === "flock-movement" && item.data.flockId === flock.id ? [{ id: item.id, ...item.data }] : []);
  reconcileFlockMovementHistory(flock.data.birdCount, flock.id, [
    ...effective, ...proposedMovements.filter((item) => !reusable.has(item.id)),
  ]);
  for (const item of plan) {
    const validation = FARM_OPERATION_DEFINITIONS[item.kind].validate(item.data);
    if (validation.length) throw new ResourceWorkflowError("VALIDATION_FAILED", validation);
    const definition = FARM_OPERATION_DEFINITIONS[item.kind];
    const subject = operationSubject(principal, item.kind, item.id);
    const permission = definition.permissions.create;
    if (!permission || !authorize(principal, { channel: "api", action: "create", permission, subject }).allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
    const existing = await getFarmOperation(db, principal, item.kind, item.id);
    if (existing) {
      const targetState = item.kind === "feed" ? "posted" : item.kind === "vaccination" ? "administered" : definition.initialState;
      if (record.state !== "publishing" || !record.data.planHash ||
          !sameScope(principal, existing.subject) || existing.id !== item.id ||
          existing.resourceType !== definition.resourceType ||
          JSON.stringify(existing.data) !== JSON.stringify(item.data) ||
          (existing.state !== targetState && existing.state !== definition.initialState)) {
        throw new ResourceWorkflowError("RESOURCE_EXISTS", ["existing record does not match the approved import plan"]);
      }
    }
    if (item.kind === "feed" && item.data.kind === "feed") await requireFeedLineage(db, principal, item.data);
    if (item.kind === "health-event" && item.data.kind === "health-event") {
      await requireHealthFlockLineage(db, principal, item.data);
      if (item.data.medicineInventoryItemId) await requireMedicineLineage(db, principal, item.data.medicineInventoryItemId, item.data.observedAt, ["veterinary-medicine", "vaccine"]);
    }
    if (item.kind === "vaccination" && item.data.kind === "vaccination" && item.data.medicineInventoryItemId) await requireMedicineLineage(db, principal, item.data.medicineInventoryItemId, item.data.administeredAt || new Date().toISOString(), ["vaccine", "veterinary-medicine"]);
  }
  // An approved report is an immutable snapshot. Detect a same-day aggregate
  // conflict before any canonical event is written so a failed import cannot
  // leave an unreferenced mortality, feed, health, or vaccination record.
  for (const report of dailyReports) await approvedDailyReportExists(db, principal, record, report);
}

async function ensureCanonicalOperation(db: D1Database, principal: AuthenticatedPrincipal, item: CanonicalPlanItem) {
  const existing = await getFarmOperation(db, principal, item.kind, item.id);
  const targetState = item.kind === "feed" ? "posted" : item.kind === "vaccination" ? "administered" : FARM_OPERATION_DEFINITIONS[item.kind].initialState;
  if (existing) {
    if (!sameScope(principal, existing.subject) || existing.id !== item.id ||
        existing.resourceType !== FARM_OPERATION_DEFINITIONS[item.kind].resourceType ||
        JSON.stringify(existing.data) !== JSON.stringify(item.data) ||
        (existing.state !== targetState && existing.state !== FARM_OPERATION_DEFINITIONS[item.kind].initialState)) {
      throw new ResourceWorkflowError("RESOURCE_EXISTS");
    }
    if (existing.state === targetState) return existing;
  }
  const services = createFarmOperationalServices(new Stage24D1ResourceRepository<FarmOperationData>(db, undefined, requireImportAuthority(principal)));
  const created = existing ?? await services[item.kind].create(principal, { id: item.id, subject: operationSubject(principal, item.kind, item.id), data: item.data });
  if (item.kind === "feed" && created.state === "draft") return services.feed.transition(principal, { id: item.id, to: "posted", expectedRevision: created.revision });
  if (item.kind === "vaccination" && created.state === "planned") return services.vaccination.transition(principal, { id: item.id, to: "administered", expectedRevision: created.revision });
  return created;
}

async function ensureApprovedDailyReport(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  record: ResourceRecord<DailyFlockImportData>,
  report: DailyReportPlanItem,
) {
  const { id, reportDate, data } = report;
  const authority = requireImportAuthority(principal);
  if (await approvedDailyReportExists(db, principal, record, report)) return id;
  const subject: AuthorizationSubject = Object.freeze({ ...operationSubject(principal, "flock", id), resourceType: "daily-flock-report", ownerId: record.createdBy || record.data.importerSnapshot.id, assigneeIds: [record.createdBy || record.data.importerSnapshot.id] });
  const edit = authorize(principal, { channel: "api", action: "create", permission: "farm.daily-report.edit", subject });
  const approval = authorize(principal, { channel: "api", action: "approve", permission: "farm.daily-report.edit", approvalPermission: MANAGEMENT_PERMISSION, subject });
  if (!edit.allowed || !approval.allowed || (!principal.isOwner && record.createdBy === principal.id)) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["maker-checker-required"]);
  const now = new Date().toISOString();
  const auditBase = { importId: record.id, planHash: record.data.planHash, sourceEvidenceId: record.data.sourceEvidenceId, localDate: reportDate, immutableEventRefs: data.eventRefs.map((ref) => `${ref.kind}:${ref.id}`) };
  try {
    const results = await db.batch([
      db.prepare(
        "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
        "SELECT ?, 'daily-flock-report', 'approved', 1, ?, ?, ?, ?, ?, NULL WHERE " +
        DAILY_REPORT_FLOCK_ATWRITE_SQL + " AND " + DAILY_REPORT_NONE_TODAY_PROOF_SQL + " AND " + DAILY_REPORT_AUTHORITY_SQL,
      ).bind(id, record.createdBy || record.data.importerSnapshot.id, JSON.stringify(subject), JSON.stringify(data), now, now,
        ...dailyReportFlockWriteParams({ subject, data }), ...dailyReportNoneTodayProofParams({ subject, data }),
        ...dailyReportAuthorityParams(authority)),
      db.prepare(
        "INSERT INTO resource_audit_events (id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json) " +
        "SELECT ?, ?, 'daily-flock-report', ?, 'create', 'farm.daily-report.edit', 'api', ?, ? " +
        "WHERE changes() = 1 AND EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND resource_type = 'daily-flock-report' AND state = 'approved' AND deleted_at IS NULL) AND " + DAILY_REPORT_AUTHORITY_SQL,
      ).bind(crypto.randomUUID(), id, record.createdBy || record.data.importerSnapshot.id, record.data.importedAt, JSON.stringify({ ...auditBase, event: "daily-flock-report.imported" }), id, ...dailyReportAuthorityParams(authority)),
      db.prepare(
        "INSERT INTO resource_audit_events (id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json) " +
        "SELECT ?, ?, 'daily-flock-report', ?, 'approve', ?, 'api', ?, ? " +
        "WHERE changes() = 1 AND EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND resource_type = 'daily-flock-report' AND state = 'approved' AND deleted_at IS NULL) AND " + DAILY_REPORT_AUTHORITY_SQL,
      ).bind(crypto.randomUUID(), id, principal.id, MANAGEMENT_PERMISSION, now, JSON.stringify({ ...auditBase, event: "daily-flock-report.approved-from-import" }), id, ...dailyReportAuthorityParams(authority)),
    ]);
    if (Number(results[0]?.meta?.changes || 0) !== 1 ||
        Number(results[1]?.meta?.changes || 0) !== 1 ||
        Number(results[2]?.meta?.changes || 0) !== 1) {
      throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["fresh-authorization-unavailable"]);
    }
  } catch (error) {
    if (error instanceof ResourceWorkflowError && error.code === "AUTHORIZATION_DENIED") throw error;
    if (!(await approvedDailyReportExists(db, principal, record, report))) throw error;
  }
  return id;
}

export async function publishDailyFlockImport(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  input: Readonly<{ id: string; expectedRevision: number; decisions: readonly DailyFlockImportDecision[] }>,
) {
  const authority = requireImportAuthority(principal);
  const current = await getDailyFlockImport(db, principal, input.id);
  if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const built = await buildPlan(current, input.decisions);
  if (current.state === "published") {
    if (current.data.planHash !== built.planHash) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
    return verifiedImportRead(db, principal, current);
  }
  if (!["review", "publishing"].includes(current.state)) throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED");
  if (current.state === "review" && current.revision !== input.expectedRevision) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
  if (current.state === "review" && current.createdBy === principal.id && !(principal.isOwner && principal.accessState === "owner")) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["maker-checker-required"]);
  if (current.state === "publishing" && current.data.planHash !== built.planHash) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
  const dailyReports = await buildDailyReportPlan(db, principal, current, built.decisions, built.plan, false);
  await preflightPlan(db, principal, current, built.plan, dailyReports);
  const service = importService(db, undefined, authority);
  let publishing = current;
  if (current.state === "review") {
    const updated = await service.update(principal, { id: current.id, subject: current.subject, expectedRevision: current.revision, data: Object.freeze({ ...current.data, decisions: built.decisions, planHash: built.planHash, publishedRecordIds: Object.freeze([]) }) });
    publishing = await service.transition(principal, { id: current.id, to: "publishing", expectedRevision: updated.revision });
  }
  const publishedIds: string[] = [];
  for (const item of built.plan) {
    await ensureCanonicalOperation(db, principal, item);
    publishedIds.push(item.id);
  }
  const finalDailyReports = await buildDailyReportPlan(db, principal, current, built.decisions, built.plan, true);
  for (const report of finalDailyReports) publishedIds.push(await ensureApprovedDailyReport(db, principal, publishing, report));
  const latest = await importRecord(db, publishing.id);
  if (!latest || latest.state !== "publishing" || !sameScope(principal, latest.subject)) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
  const updated = await service.update(principal, { id: latest.id, subject: latest.subject, expectedRevision: latest.revision, data: Object.freeze({ ...latest.data, publishedRecordIds: Object.freeze([...new Set(publishedIds)]) }) });
  return verifiedImportRead(db, principal, await service.transition(principal, { id: updated.id, to: "published", expectedRevision: updated.revision }));
}

export function dailyFlockImportError(error: unknown) {
  const candidate = error && typeof error === "object" ? error as { code?: unknown; details?: unknown } : null;
  const code = typeof candidate?.code === "string" ? candidate.code : null;
  if (!code) return { status: 503, body: { error: "DAILY_FLOCK_IMPORT_UNAVAILABLE" } } as const;
  const status = code === "AUTHORIZATION_DENIED" || code === "RESOURCE_NOT_FOUND" ? 404 : code === "CONCURRENCY_CONFLICT" || code === "RESOURCE_EXISTS" ? 409 : code === "TRANSITION_NOT_ALLOWED" ? 422 : 400;
  return { status, body: { error: code, details: candidate?.details } } as const;
}
