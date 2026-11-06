import { StockMovementRemovalHold } from "./stock-movement-removal-hold.ts";
import {
  getInventoryAvailability as getStage24InventoryAvailability,
  allocateInventory as allocateStage24Inventory,
  listInventoryProcurementPage as listStage24InventoryProcurementPage,
  listInventoryProcurement as listStage24InventoryProcurement,
  getInventoryProcurement as getStage24InventoryProcurement,
  createInventoryProcurement as createStage24InventoryProcurement,
  transitionInventoryProcurement as transitionStage24InventoryProcurement,
  deleteInventoryProcurement as deleteStage24InventoryProcurement,
  inventoryProcurementError as stage24InventoryProcurementError,
} from "./inventory-procurement-stage24-api.ts";
import { ResourceWorkflowError as Stage24ResourceWorkflowError } from "./resource-workflow-stage24.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize, createSecurityAuditEvent } from "./security-authority.ts";
import {
  createInventoryProcurementServices,
  INVENTORY_PROCUREMENT_DEFINITIONS,
  type InventoryProcurementData,
  type InventoryProcurementKind,
  type PurchaseOrderData,
} from "./inventory-procurement-core.ts";
import { D1ResourceRepository } from "./resource-workflow-d1.ts";
import {
  ResourceWorkflowError,
  type ResourceRecord,
} from "./resource-workflow.ts";

// Translate Stage24 stock errors back into the canonical legacy error type.
async function withLegacyStockError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Stage24ResourceWorkflowError) {
      // Two Stage24-only workflow-policy errors are intentionally not part of
      // the older Inventory API's explicit failure-code contract.
      if (error.code === "WORKFLOW_POLICY_INVALID" || error.code === "INVALID_WORKFLOW_DEFINITION") throw error;
      throw new ResourceWorkflowError(error.code, error.details);
    }
    throw error;
  }
}

// Every canonical stock-movement record must retain the old shape while
// preserving the specialist's richer receipt-lot fields for source lineage.
function canonicalStockRecord(record: NonNullable<Awaited<ReturnType<typeof getStage24InventoryProcurement>>>): ResourceRecord<InventoryProcurementData> {
  if (record.data.kind !== "stock-movement") throw new ResourceWorkflowError("RESOURCE_TYPE_MISMATCH");
  return Object.freeze({ ...record, data: record.data });
}

export const INVENTORY_PROCUREMENT_API = Object.freeze({
  "stock-opening": { view: "inventory.view" },
  "stock-movement": { view: "inventory.view" },
  "medication-stock-movement": { view: "inventory.view" },
  equipment: { view: "assets.view" },
  supplier: { view: "procurement.view" },
  "purchase-request": { view: "procurement.view" },
  "purchase-order": { view: "procurement.view" },
} as const);

export function inventoryProcurementKind(value: string | undefined): InventoryProcurementKind | null {
  return value && Object.prototype.hasOwnProperty.call(INVENTORY_PROCUREMENT_API, value)
    ? value as InventoryProcurementKind
    : null;
}

export function inventoryProcurementViewPermission(kind: InventoryProcurementKind) {
  return INVENTORY_PROCUREMENT_API[kind].view;
}

export function inventoryProcurementSubject(
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  resourceId?: string,
) {
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  return Object.freeze({
    resourceType: INVENTORY_PROCUREMENT_DEFINITIONS[kind].resourceType,
    ...(resourceId ? { resourceId } : {}),
    companyKey: scope.companyKey,
    locationKey: scope.locationKey,
    departmentKey: scope.departmentKey,
    ...(kind === "stock-opening" ? { ownerId: principal.id } : {}),
  });
}

function decode(row: Record<string, unknown>): ResourceRecord<InventoryProcurementData> | null {
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
    }) as ResourceRecord<InventoryProcurementData>;
  } catch {
    return null;
  }
}

function visible(
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  record: ResourceRecord<InventoryProcurementData>,
) {
  return authorize(principal, {
    channel: "api",
    action: "view",
    permission: inventoryProcurementViewPermission(kind),
    subject: record.subject,
  }).allowed;
}

async function rows(
  db: D1Database,
  kind: InventoryProcurementKind,
  id?: string,
  scope?: { companyKey: string; locationKey: string },
) {
  const definition=INVENTORY_PROCUREMENT_DEFINITIONS[kind];
  if (!id && (kind==="stock-movement" || kind==="stock-opening") &&
      scope?.companyKey && scope.locationKey) {
    // Never apply per-user permissions after a LIMIT 200 across all farms.
    // Read the bounded, tenant/site-filtered full register in stable pages,
    // then apply normal own/assigned/department authorization per record.
    const all: ResourceRecord<InventoryProcurementData>[]=[];
    const size=200;
    for(let offset=0;;offset+=size){
      const result=await db.prepare(
        "SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records " +
        "WHERE resource_type = ? AND deleted_at IS NULL " +
        "AND json_extract(subject_json, '$.companyKey') = ? " +
        "AND json_extract(subject_json, '$.locationKey') = ? " +
        "ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?",
      ).bind(definition.resourceType,scope.companyKey,scope.locationKey,size,offset)
        .all<Record<string, unknown>>();
      const page=result.results||[];
      if(offset+page.length>10000)throw new Error("INVENTORY_RECORD_LIMIT");
      all.push(...page.map(decode).filter((row):row is ResourceRecord<InventoryProcurementData>=>row!==null));
      if(page.length<size)break;
    }
    return all;
  }
  const statement=id
    ? db.prepare("SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL")
      .bind(id,definition.resourceType)
    : db.prepare("SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC LIMIT 200")
      .bind(definition.resourceType);
  const result=await statement.all<Record<string, unknown>>();
  return (result.results||[]).map(decode).filter((record):record is ResourceRecord<InventoryProcurementData>=>record!==null);
}

export async function listInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
): Promise<ResourceRecord<InventoryProcurementData>[]> {
  if (kind === "stock-movement") {
    const records = await withLegacyStockError(() => listStage24InventoryProcurement(db, principal, kind));
    return records.map(canonicalStockRecord);
  }
  if (kind==="stock-opening" &&
      (!principal.organizationScope?.companyKey || !principal.organizationScope?.locationKey)) return [];
  const records = await rows(db, kind, undefined, principal.organizationScope ?? undefined);
  return records.filter((record) => visible(principal, kind, record));
}

export async function getInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  id: string,
): Promise<ResourceRecord<InventoryProcurementData> | null> {
  if (kind === "stock-movement") {
    const record = await withLegacyStockError(() => getStage24InventoryProcurement(db, principal, kind, id));
    return record ? canonicalStockRecord(record) : null;
  }
  const record = (await rows(db, kind, id))[0] || null;
  return record && visible(principal, kind, record) ? record : null;
}

export function assertPurchaseOrderReferences(
  data: PurchaseOrderData,
  request: ResourceRecord<InventoryProcurementData> | null,
  suppliers: readonly ResourceRecord<InventoryProcurementData>[],
  existingOrders: readonly ResourceRecord<InventoryProcurementData>[],
) {
  if (!request || request.data.kind !== "purchase-request") {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  const errors: string[] = [];
  if (request.state !== "approved") errors.push("purchase request must be approved");
  if (data.itemCode !== request.data.itemCode) errors.push("order item must match purchase request");
  if (data.unit !== request.data.unit) errors.push("order unit must match purchase request");
  if (request.data.supplierCode && data.supplierCode !== request.data.supplierCode) {
    errors.push("order supplier must match purchase request");
  }
  const supplier = suppliers.find((record) =>
    record.data.kind === "supplier" && record.data.supplierCode === data.supplierCode,
  );
  if (!supplier || supplier.data.kind !== "supplier") {
    errors.push("supplier is unavailable in the authorized scope");
  } else if (supplier.state !== "active" || supplier.data.status !== "active") {
    errors.push("supplier must be active");
  }
  const alreadyOrdered = existingOrders.reduce((total, record) =>
    record.data.kind === "purchase-order" &&
    record.data.requestId === request.id &&
    record.state !== "cancelled"
      ? total + record.data.quantity
      : total, 0);
  if (Number.isFinite(data.quantity) && alreadyOrdered + data.quantity > request.data.quantity) {
    errors.push("order quantity exceeds the approved request balance");
  }
  if (errors.length) throw new ResourceWorkflowError("VALIDATION_FAILED", errors);
}


type OpeningSourceReference = Readonly<{ id: string; revision: number }>;

function parseOpeningSourceReference(value: unknown): OpeningSourceReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id.trim() ||
      !Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 1) return null;
  return Object.freeze({ id: candidate.id.trim(), revision: Number(candidate.revision) });
}

function sameOpeningField(left: string, right: string) {
  return left.trim().toLocaleLowerCase("en-NG") === right.trim().toLocaleLowerCase("en-NG");
}

/**
 * Source-backed opening-count creation is intentionally separate from the
 * generic workflow create path. The conditional INSERT rechecks the
 * authenticated source ID, revision, scope and mapped fields in the same D1
 * batch as the new record and its audit receipt.
 */
async function createInventoryOpeningFromSource(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: Extract<InventoryProcurementData, { kind: "stock-opening" }>,
  source: OpeningSourceReference,
) {
  const scope = principal.organizationScope;
  if (!scope?.companyKey || !scope.locationKey) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  }
  const definition = INVENTORY_PROCUREMENT_DEFINITIONS["stock-opening"];
  const permission = definition.permissions.create;
  if (!permission) throw new ResourceWorkflowError("PERMISSION_NOT_CONFIGURED");
  const subject = inventoryProcurementSubject(principal, "stock-opening", crypto.randomUUID());
  const decision = authorize(principal, {
    channel: "api",
    action: "create",
    permission,
    subject,
  });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
  const validation = definition.validate(data);
  if (validation.length) throw new ResourceWorkflowError("VALIDATION_FAILED", validation);

  const visibleSource = await getInventoryProcurement(db, principal, "stock-opening", source.id);
  if (!visibleSource || visibleSource.resourceType !== "stock-opening" ||
      visibleSource.subject.companyKey !== scope.companyKey ||
      visibleSource.subject.locationKey !== scope.locationKey ||
      visibleSource.data.kind !== "stock-opening") {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  if (visibleSource.revision !== source.revision ||
      !["draft", "submitted"].includes(visibleSource.state)) {
    throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
  }
  if (!sameOpeningField(visibleSource.data.itemCode, data.itemCode) ||
      !sameOpeningField(visibleSource.data.locationKey, data.locationKey) ||
      visibleSource.data.unit !== data.unit) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", [
      "selected source no longer supports the mapped item, location or unit",
    ]);
  }

  const id = subject.resourceId!;
  const now = new Date().toISOString();
  const record = Object.freeze({
    id,
    resourceType: "stock-opening",
    state: "draft",
    revision: 1,
    createdBy: principal.id,
    subject,
    data,
  });
  const audit = createSecurityAuditEvent(
    principal,
    { channel: "api", action: "create", permission, subject },
    {
      event: "resource.created",
      state: record.state,
      revision: record.revision,
      sourceRecordId: source.id,
      sourceRevision: source.revision,
    },
    now,
  );
  const parameters = [
    record.id, record.resourceType, record.state, record.revision, record.createdBy,
    JSON.stringify(record.subject), JSON.stringify(record.data), now, now,
  ] as const;
  const insert = db.prepare(
    "INSERT INTO resource_records " +
    "(id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
    "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL " +
    "WHERE EXISTS (" +
    "SELECT 1 FROM resource_records AS source WHERE source.id = ? " +
    "AND source.resource_type = 'stock-opening' AND source.deleted_at IS NULL " +
    "AND source.revision = ? AND source.state IN ('draft','submitted') " +
    "AND json_extract(source.subject_json, '$.companyKey') = ? " +
    "AND json_extract(source.subject_json, '$.locationKey') = ? " +
    "AND json_extract(source.data_json, '$.kind') = 'stock-opening' " +
    "AND LOWER(TRIM(json_extract(source.data_json, '$.itemCode'))) = LOWER(TRIM(?)) " +
    "AND LOWER(TRIM(json_extract(source.data_json, '$.locationKey'))) = LOWER(TRIM(?)) " +
    "AND json_extract(source.data_json, '$.unit') = ?" +
    ") " +
    "AND NOT EXISTS (" +
    "SELECT 1 FROM resource_records AS existing WHERE existing.id = ? AND existing.deleted_at IS NULL" +
    ")",
  ).bind(
    ...parameters, source.id, source.revision, scope.companyKey, scope.locationKey,
    data.itemCode, data.locationKey, data.unit, id,
  );
  const auditInsert = db.prepare(
    "INSERT INTO resource_audit_events " +
    "(id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json) " +
    "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? " +
    "WHERE changes() = 1 AND EXISTS (" +
    "SELECT 1 FROM resource_records WHERE id = ? AND revision = 1 AND deleted_at IS NULL" +
    ")",
  ).bind(
    crypto.randomUUID(), id, audit.resourceType, audit.actorId, audit.action,
    audit.permission, audit.channel, audit.occurredAt, JSON.stringify(audit.metadata), id,
  );
  const results = await db.batch([insert, auditInsert]);
  const inserted = Number(results[0]?.meta?.changes || 0);
  if (inserted !== 1) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
  if (Number(results[1]?.meta?.changes || 0) !== 1) {
    throw new Error("RESOURCE_AUDIT_NOT_WRITTEN");
  }
  return record;
}

export async function createInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  data: InventoryProcurementData,
  source?: unknown,
) {
  if (kind === "stock-movement") {
    if (source !== undefined) throw new ResourceWorkflowError("VALIDATION_FAILED", ["stock movement source must be canonical"]);
    return withLegacyStockError(() => createStage24InventoryProcurement(db, principal, kind, data as never));
  }
  if (source !== undefined) {
    if (kind !== "stock-opening" || data.kind !== "stock-opening") {
      throw new ResourceWorkflowError("VALIDATION_FAILED", [
        "source reference is only supported for opening-count creation",
      ]);
    }
    const parsed = parseOpeningSourceReference(source);
    if (!parsed) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", [
        "source record ID and revision are required",
      ]);
    }
    return createInventoryOpeningFromSource(db, principal, data, parsed);
  }
  if (kind === "equipment" && data.kind === "equipment") {
    const existing = await listInventoryProcurement(db, principal, "equipment");
    const assetKey = data.assetCode.trim().toLocaleLowerCase();
    if (existing.some((record) =>
      record.data.kind === "equipment" &&
      record.data.assetCode.trim().toLocaleLowerCase() === assetKey
    )) throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  if (kind === "purchase-order" && data.kind === "purchase-order") {
    const [request, suppliers, existingOrders] = await Promise.all([
      getInventoryProcurement(db, principal, "purchase-request", data.requestId),
      listInventoryProcurement(db, principal, "supplier"),
      listInventoryProcurement(db, principal, "purchase-order"),
    ]);
    assertPurchaseOrderReferences(data, request, suppliers, existingOrders);
  }
  const repository = new D1ResourceRepository<InventoryProcurementData>(db);
  const service = createInventoryProcurementServices(repository)[kind];
  const id = crypto.randomUUID();
  return service.create(principal, {
    id,
    subject: inventoryProcurementSubject(principal, kind, id),
    data,
  });
}

export async function updateInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  id: string,
  data: InventoryProcurementData,
  expectedRevision: number,
) {
  if (kind !== "equipment" || data.kind !== "equipment") {
    throw new ResourceWorkflowError("RESOURCE_TYPE_MISMATCH");
  }
  const current = await getInventoryProcurement(db, principal, kind, id);
  if (!current || current.data.kind !== "equipment") {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  if (current.data.assetCode !== data.assetCode) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["asset code cannot be changed"]);
  }
  const repository = new D1ResourceRepository<InventoryProcurementData>(db);
  const service = createInventoryProcurementServices(repository)[kind];
  return service.update(principal, {
    id,
    subject: current.subject,
    data,
    expectedRevision,
  });
}

export async function transitionInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  id: string,
  to: string,
  expectedRevision: number,
) {
  if (kind === "stock-movement") return withLegacyStockError(() => transitionStage24InventoryProcurement(db, principal, kind, id, to, expectedRevision));
  if (kind === "equipment" && to === "active") {
    const current = await getInventoryProcurement(db, principal, kind, id);
    if (!current || current.data.kind !== "equipment") {
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
    if (current.data.condition !== "serviceable") {
      throw new ResourceWorkflowError(
        "VALIDATION_FAILED",
        ["equipment condition must be serviceable before return to service"],
      );
    }
  }
  const repository = new D1ResourceRepository<InventoryProcurementData>(db);
  const service = createInventoryProcurementServices(repository)[kind];
  return service.transition(principal, { id, to, expectedRevision });
}

export async function deleteInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  id: string,
  expectedRevision: number,
) {
  if (kind === "stock-movement") return withLegacyStockError(() => deleteStage24InventoryProcurement(db, principal, kind, id, expectedRevision));
  const repository = new D1ResourceRepository<InventoryProcurementData>(db);
  const service = createInventoryProcurementServices(repository)[kind];
  await service.remove(principal, { id, expectedRevision });
  return { ok: true };
}

export function inventoryProcurementError(error: unknown) {
  if (error instanceof StockMovementRemovalHold) {
    return { status: 503, body: { error: error.code } };
  }
  if (error instanceof Stage24ResourceWorkflowError) return stage24InventoryProcurementError(error);
  if (!(error instanceof ResourceWorkflowError)) {
    return { status: 503, body: { error: "INVENTORY_PROCUREMENT_UNAVAILABLE" } };
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
  return { status: 503, body: { error: "INVENTORY_PROCUREMENT_UNAVAILABLE" } };
}

// Stage24 compatibility bridge: preserve the existing Inventory API and
// delegate new stock contracts to the specialist's atomic implementation.
export async function getInventoryAvailability(...args: Parameters<typeof getStage24InventoryAvailability>) {
  return getStage24InventoryAvailability(...args);
}
export async function allocateInventory(...args: Parameters<typeof allocateStage24Inventory>) {
  return allocateStage24Inventory(...args);
}
export async function listInventoryProcurementPage(...args: Parameters<typeof listStage24InventoryProcurementPage>) {
  return listStage24InventoryProcurementPage(...args);
}
