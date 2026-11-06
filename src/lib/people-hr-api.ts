import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize } from "./security-authority.ts";
import { PEOPLE_HR_DEFINITIONS, createPeopleHrServices, type PeopleHrData, type PeopleHrKind } from "./people-hr-core.ts";
import { D1ResourceRepository } from "./resource-workflow-d1.ts";
import { ResourceWorkflowError, type ResourceRecord } from "./resource-workflow.ts";

const VIEW_PERMISSION: Readonly<Record<PeopleHrKind, string>> = Object.freeze({
  "employee-record": "hr.employee.view",
  "leave-request": "hr.leave.view",
  "attendance-record": "hr.attendance.view",
  "attendance-session": "attendance.view",
  "payroll-batch": "hr.payroll.view",
  "recruitment-candidate": "hr.recruitment.view",
});

export function peopleHrKind(value: string | undefined): PeopleHrKind | null {
  return value && Object.prototype.hasOwnProperty.call(PEOPLE_HR_DEFINITIONS, value) ? value as PeopleHrKind : null;
}

export function peopleHrSubject(principal: AuthenticatedPrincipal, kind: PeopleHrKind, resourceId?: string, ownerId?: string) {
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  return Object.freeze({ resourceType: PEOPLE_HR_DEFINITIONS[kind].resourceType, ...(resourceId ? { resourceId } : {}), ...(ownerId ? { ownerId } : {}), companyKey: scope.companyKey, locationKey: scope.locationKey, departmentKey: scope.departmentKey });
}

function decode(row: Record<string, unknown>): ResourceRecord<PeopleHrData> | null {
  if (typeof row.id !== "string" || typeof row.resource_type !== "string" || typeof row.state !== "string" || typeof row.revision !== "number" || typeof row.subject_json !== "string" || typeof row.data_json !== "string") return null;
  try {
    return Object.freeze({ id: row.id, resourceType: row.resource_type, state: row.state, revision: row.revision, createdBy: typeof row.created_by === "string" ? row.created_by : null, subject: JSON.parse(row.subject_json), data: JSON.parse(row.data_json) }) as ResourceRecord<PeopleHrData>;
  } catch { return null; }
}

async function rows(db: D1Database, kind: PeopleHrKind, id?: string) {
  const definition = PEOPLE_HR_DEFINITIONS[kind];
  if (id) {
    const result = await db.prepare("SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL").bind(id, definition.resourceType).all<Record<string, unknown>>();
    return (result.results || []).map(decode).filter((record): record is ResourceRecord<PeopleHrData> => record !== null);
  }
  const records: ResourceRecord<PeopleHrData>[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.prepare("SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?").bind(definition.resourceType, pageSize, offset).all<Record<string, unknown>>();
    const page = result.results || [];
    records.push(...page.map(decode).filter((record): record is ResourceRecord<PeopleHrData> => record !== null));
    if (page.length < pageSize) break;
  }
  return records;
}

function visible(principal: AuthenticatedPrincipal, kind: PeopleHrKind, record: ResourceRecord<PeopleHrData>) {
  if (kind === "attendance-session") {
    if (record.data.subjectId !== principal.id) return false;
    return authorize(principal, { channel: "api", action: "view", permission: VIEW_PERMISSION[kind], subject: record.subject }).allowed
      || authorize(principal, { channel: "api", action: "view", permission: "attendance.create", subject: record.subject }).allowed;
  }
  return authorize(principal, { channel: "api", action: "view", permission: VIEW_PERMISSION[kind], subject: record.subject }).allowed;
}

export async function listPeopleHr(db: D1Database, principal: AuthenticatedPrincipal, kind: PeopleHrKind) {
  if (kind === "attendance-session") {
    const companyKey = principal.organizationScope?.companyKey;
    if (!companyKey) return [];
    // Bound the query to the authenticated employee before materializing records.
    // Keep the existing per-record authorization check as a second boundary.
    const records: ResourceRecord<PeopleHrData>[] = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const result = await db.prepare("SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL AND json_extract(subject_json, '$.companyKey') = ? AND json_extract(subject_json, '$.ownerId') = ? ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?")
        .bind(PEOPLE_HR_DEFINITIONS[kind].resourceType, companyKey, principal.id, pageSize, offset).all<Record<string, unknown>>();
      const page = result.results || [];
      records.push(...page.map(decode).filter((record): record is ResourceRecord<PeopleHrData> => record !== null));
      if (page.length < pageSize) break;
    }
    return records.filter((record) => visible(principal, kind, record));
  }
  return (await rows(db, kind)).filter((record) => visible(principal, kind, record));
}
export async function getPeopleHr(db: D1Database, principal: AuthenticatedPrincipal, kind: PeopleHrKind, id: string) {
  const record = (await rows(db, kind, id))[0] || null;
  return record && visible(principal, kind, record) ? record : null;
}
function serverTimestamp(now: Date) {
  const milliseconds = now.getTime();
  if (!Number.isFinite(milliseconds)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["server-time-invalid"]);
  return new Date(milliseconds).toISOString();
}

function attendanceEndTimestamp(occurredAt: string, now: Date) {
  const startedAt = Date.parse(occurredAt);
  const serverNow = now.getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(serverNow)) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["attendance-time-invalid"]);
  }
  return new Date(Math.max(serverNow, startedAt + 1_000)).toISOString();
}

export async function createPeopleHr(db: D1Database, principal: AuthenticatedPrincipal, kind: PeopleHrKind, data: PeopleHrData, now = new Date()) {
  const occurredAt = kind === "attendance-session" ? serverTimestamp(now) : data.occurredAt;
  const effectiveData: PeopleHrData = kind === "attendance-session"
    ? {
        ...data,
        kind: "attendance-session",
        reference: `ATT-${occurredAt}`,
        subjectId: principal.id,
        occurredAt,
        endedAt: undefined,
      }
    : data;
  if (kind === "attendance-session") {
    const scope = principal.organizationScope;
    if (!scope) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
    // Authorize the actual employee/company/site before querying whether a
    // shift exists. Otherwise revoked callers can distinguish 409 from 404.
    const permission = PEOPLE_HR_DEFINITIONS[kind].permissions.create;
    if (!permission) throw new ResourceWorkflowError("PERMISSION_NOT_CONFIGURED", ["create"]);
    const decision = authorize(principal, {
      channel: "api",
      action: "create",
      permission,
      subject: peopleHrSubject(principal, kind, undefined, effectiveData.subjectId),
    });
    if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
    // A targeted preflight makes repeat clicks friendly; the D1 guarded INSERT
    // is still the authoritative concurrent-write enforcement.
    const openSession = await db.prepare("SELECT id FROM resource_records WHERE resource_type = ? AND state = 'clocked-in' AND deleted_at IS NULL AND json_extract(subject_json, '$.companyKey') = ? AND json_extract(subject_json, '$.ownerId') = ? LIMIT 1")
      .bind("hr-attendance-session", scope.companyKey, principal.id).first<{ id: string }>();
    if (openSession) throw new ResourceWorkflowError("RESOURCE_EXISTS", ["open-attendance-session-exists"]);
  }
  // Leave requests use the self-service permission. Bind their subject to the
  // authenticated identity so a caller cannot submit a request for a coworker.
  const canManageLeave = kind === "leave-request" && authorize(principal, {
    channel: "api",
    action: "create",
    permission: "hr.leave.manage",
    subject: peopleHrSubject(principal, kind, undefined, effectiveData.subjectId),
  }).allowed;
  if (kind === "leave-request" && effectiveData.subjectId !== principal.id && !canManageLeave) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["self-service-subject-mismatch"]);
  }
  const service = createPeopleHrServices(new D1ResourceRepository<PeopleHrData>(db))[kind];
  const id = crypto.randomUUID();
  return service.create(principal, { id, subject: peopleHrSubject(principal, kind, id, effectiveData.subjectId), data: effectiveData });
}
export async function transitionPeopleHr(db: D1Database, principal: AuthenticatedPrincipal, kind: PeopleHrKind, id: string, to: string, expectedRevision: number, now = new Date()) {
  if (kind === "attendance-session") {
    // Permission and ownership precede state/revision validation in the generic
    // workflow. Do not disclose shift existence or let a broad permission
    // modify another employee's attendance.
    const permission = PEOPLE_HR_DEFINITIONS[kind].permissions.edit;
    if (!permission) throw new ResourceWorkflowError("PERMISSION_NOT_CONFIGURED", ["edit"]);
    const decision = authorize(principal, {
      channel: "api",
      action: "edit",
      permission,
      subject: peopleHrSubject(principal, kind, undefined, principal.id),
    });
    if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
    const ownVisibleRecord = await getPeopleHr(db, principal, kind, id);
    if (!ownVisibleRecord) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["attendance-session-not-found"]);
    // The resource workflow retains its in-transaction authorization and CAS.
  }
  const service = createPeopleHrServices(new D1ResourceRepository<PeopleHrData>(db))[kind];
  if (kind !== "attendance-session" || to !== "clocked-out") {
    return service.transition(principal, { id, to, expectedRevision });
  }

  return service.transition(principal, { id, to, expectedRevision }, (current) => ({
    ...current.data,
    endedAt: attendanceEndTimestamp(current.data.occurredAt, now),
  }));
}
export async function updatePeopleHr(db: D1Database, principal: AuthenticatedPrincipal, kind: PeopleHrKind, id: string, data: PeopleHrData, expectedRevision: number) {
  if (kind === "attendance-session") {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["attendance-session-server-managed"]);
  }
  const current = (await rows(db, kind, id))[0];
  if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const service = createPeopleHrServices(new D1ResourceRepository<PeopleHrData>(db))[kind];
  // Employee ownership and authorization scope are established at creation.
  // Editing business details must not reassign the record to another employee.
  return service.update(principal, {
    id,
    subject: current.subject,
    data: { ...data, subjectId: current.data.subjectId },
    expectedRevision,
  });
}
export async function deletePeopleHr(db: D1Database, principal: AuthenticatedPrincipal, kind: PeopleHrKind, id: string, expectedRevision: number) {
  if (kind === "attendance-session") {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["attendance-session-immutable"]);
  }
  await createPeopleHrServices(new D1ResourceRepository<PeopleHrData>(db))[kind].remove(principal, { id, expectedRevision });
  return { ok: true } as const;
}

export function peopleHrError(error: unknown) {
  if (!(error instanceof ResourceWorkflowError)) return { status: 503, body: { error: "PEOPLE_HR_UNAVAILABLE" } };
  if (["AUTHORIZATION_DENIED", "RESOURCE_NOT_FOUND", "RESOURCE_TYPE_MISMATCH"].includes(error.code)) return { status: 404, body: { error: "NOT_FOUND" } };
  if (error.code === "VALIDATION_FAILED") return { status: 422, body: { error: error.code, details: error.details } };
  if (["CONCURRENCY_CONFLICT", "RESOURCE_EXISTS"].includes(error.code)) return { status:  409, body: { error: error.code } };
  if (["TRANSITION_NOT_ALLOWED", "PERMISSION_NOT_CONFIGURED"].includes(error.code)) return { status: 422, body: { error: error.code } };
  return { status: 503, body: { error: "PEOPLE_HR_UNAVAILABLE" } };
}
