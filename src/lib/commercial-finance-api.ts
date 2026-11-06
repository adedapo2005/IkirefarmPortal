import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize } from "./security-authority.ts";
import {
  COMMERCIAL_FINANCE_DEFINITIONS,
  createCommercialFinanceServices,
  type CommercialFinanceData,
  type CommercialFinanceKind,
} from "./commercial-finance-core.ts";
import { D1ResourceRepository } from "./resource-workflow-d1.ts";
import {
  ResourceWorkflowError,
  type ResourceRecord,
} from "./resource-workflow.ts";

export const COMMERCIAL_FINANCE_API = Object.freeze({
  customer: { view: "commercial.view" },
  "sales-order": { view: "commercial.view" },
  revenue: { view: "finance.view" },
  expense: { view: "finance.view" },
  "ledger-entry": { view: "finance.view" },
} as const);

export function commercialFinanceKind(value: string | undefined): CommercialFinanceKind | null {
  return value && Object.prototype.hasOwnProperty.call(COMMERCIAL_FINANCE_API, value)
    ? value as CommercialFinanceKind
    : null;
}

export function commercialFinanceViewPermission(kind: CommercialFinanceKind) {
  return COMMERCIAL_FINANCE_API[kind].view;
}

export function commercialFinanceSubject(
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
  resourceId?: string,
) {
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  return Object.freeze({
    resourceType: COMMERCIAL_FINANCE_DEFINITIONS[kind].resourceType,
    ...(resourceId ? { resourceId } : {}),
    companyKey: scope.companyKey,
    locationKey: scope.locationKey,
    departmentKey: scope.departmentKey,
  });
}

function decode(row: Record<string, unknown>): ResourceRecord<CommercialFinanceData> | null {
  if (
    typeof row.id !== "string" ||
    typeof row.resource_type !== "string" ||
    typeof row.state !== "string" ||
    typeof row.revision !== "number" ||
    typeof row.subject_json !== "string" ||
    typeof row.data_json !== "string"
  ) return null;
  try {
    return Object.freeze({
      id: row.id,
      resourceType: row.resource_type,
      state: row.state,
      revision: row.revision,
      createdBy: typeof row.created_by === "string" ? row.created_by : null,
      subject: JSON.parse(row.subject_json),
      data: JSON.parse(row.data_json),
    }) as ResourceRecord<CommercialFinanceData>;
  } catch {
    return null;
  }
}

function visible(
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
  record: ResourceRecord<CommercialFinanceData>,
) {
  return authorize(principal, {
    channel: "api",
    action: "view",
    permission: commercialFinanceViewPermission(kind),
    subject: record.subject,
  }).allowed;
}

async function rows(db: D1Database, kind: CommercialFinanceKind, id?: string) {
  const definition = COMMERCIAL_FINANCE_DEFINITIONS[kind];
  if (id) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL",
    ).bind(id, definition.resourceType).all<Record<string, unknown>>();
    return (result.results || [])
      .map(decode)
      .filter((record): record is ResourceRecord<CommercialFinanceData> => record !== null);
  }

  // Keep authorization filtering server side while walking every page. A fixed
  // first-page limit silently hid older records from authorized finance users.
  const records: ResourceRecord<CommercialFinanceData>[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?",
    ).bind(definition.resourceType, pageSize, offset).all<Record<string, unknown>>();
    const page = result.results || [];
    records.push(...page
      .map(decode)
      .filter((record): record is ResourceRecord<CommercialFinanceData> => record !== null));
    if (page.length < pageSize) break;
  }
  return records;
}

export async function listCommercialFinance(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
) {
  const records = await rows(db, kind);
  return records.filter((record) => visible(principal, kind, record));
}

export async function getCommercialFinance(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
  id: string,
) {
  const record = (await rows(db, kind, id))[0] || null;
  return record && visible(principal, kind, record) ? record : null;
}

export async function createCommercialFinance(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
  data: CommercialFinanceData,
) {
  if (kind === "revenue" && data.kind === "revenue" && data.sourceType !== "other" && data.sourceId) {
    const sourceKind = data.sourceType === "customer" ? "customer" : "sales-order";
    const source = await getCommercialFinance(db, principal, sourceKind, data.sourceId);
    if (!source) {
      // Do not disclose whether an inaccessible customer or sales order exists.
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
  }
  if (kind === "ledger-entry" && data.kind === "ledger-entry" && data.sourceId) {
    const sourceKind = data.sourceType === "sales-order"
      ? "sales-order"
      : data.sourceType === "expense" ? "expense" : null;
    const source = sourceKind
      ? await getCommercialFinance(db, principal, sourceKind, data.sourceId)
      : null;
    if (!source) {
      // Do not disclose whether an inaccessible source exists.
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
  }
  const repository = new D1ResourceRepository<CommercialFinanceData>(db);
  const service = createCommercialFinanceServices(repository)[kind];
  const id = crypto.randomUUID();
  return service.create(principal, {
    id,
    subject: commercialFinanceSubject(principal, kind, id),
    data,
  });
}

export async function updateCommercialFinance(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
  id: string,
  data: CommercialFinanceData,
  expectedRevision: number,
) {
  const current = (await rows(db, kind, id))[0];
  if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  if (kind === "revenue" && data.kind === "revenue" && data.sourceType !== "other" && data.sourceId) {
    const sourceKind = data.sourceType === "customer" ? "customer" : "sales-order";
    const source = await getCommercialFinance(db, principal, sourceKind, data.sourceId);
    if (!source) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  if (kind === "ledger-entry" && data.kind === "ledger-entry" && data.sourceId) {
    const sourceKind = data.sourceType === "sales-order"
      ? "sales-order"
      : data.sourceType === "expense" ? "expense" : null;
    const source = sourceKind
      ? await getCommercialFinance(db, principal, sourceKind, data.sourceId)
      : null;
    if (!source) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  const repository = new D1ResourceRepository<CommercialFinanceData>(db);
  const service = createCommercialFinanceServices(repository)[kind];
  // Keep the persisted authorization scope and maker identity immutable. The
  // payload contains business data only; revision checks prevent lost updates.
  return service.update(principal, {
    id,
    subject: current.subject,
    data,
    expectedRevision,
  });
}

export async function transitionCommercialFinance(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
  id: string,
  to: string,
  expectedRevision: number,
) {
  const repository = new D1ResourceRepository<CommercialFinanceData>(db);
  const service = createCommercialFinanceServices(repository)[kind];
  return service.transition(principal, { id, to, expectedRevision });
}

export async function deleteCommercialFinance(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: CommercialFinanceKind,
  id: string,
  expectedRevision: number,
) {
  const repository = new D1ResourceRepository<CommercialFinanceData>(db);
  const service = createCommercialFinanceServices(repository)[kind];
  await service.remove(principal, { id, expectedRevision });
  return { ok: true };
}

export function commercialFinanceError(error: unknown) {
  if (!(error instanceof ResourceWorkflowError)) {
    return { status: 503, body: { error: "COMMERCIAL_FINANCE_UNAVAILABLE" } };
  }
  const hidden = new Set(["AUTHORIZATION_DENIED", "RESOURCE_NOT_FOUND", "RESOURCE_TYPE_MISMATCH"]);
  if (hidden.has(error.code)) return { status: 404, body: { error: "NOT_FOUND" } };
  if (error.code === "VALIDATION_FAILED") {
    return { status: 422, body: { error: error.code, details: error.details } };
  }
  if (error.code === "CONCURRENCY_CONFLICT" || error.code === "RESOURCE_EXISTS") {
    return { status: 409, body: { error: error.code } };
  }
  if (error.code === "TRANSITION_NOT_ALLOWED" || error.code === "PERMISSION_NOT_CONFIGURED") {
    return { status: 422, body: { error: error.code } };
  }
  return { status: 503, body: { error: "COMMERCIAL_FINANCE_UNAVAILABLE" } };
}
