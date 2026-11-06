import { StockMovementRemovalHold } from "./stock-movement-removal-hold.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { getFarmOperation } from "./farm-operational-stage24-api.ts";
import { authorize, createSecurityAuditEvent } from "./security-authority.ts";
import {
  createInventoryProcurementServices,
  deriveStockOnHand,
  isValidInventoryProcurementData,
  INVENTORY_PROCUREMENT_DEFINITIONS,
  type InventoryProcurementData,
  type InventoryProcurementKind,
} from "./inventory-procurement-stage24-core.ts";
import { D1ResourceRepository } from "./resource-workflow-stage24-d1.ts";
import {
  ResourceWorkflowError,
  type ResourceRecord,
} from "./resource-workflow-stage24.ts";

export const INVENTORY_PROCUREMENT_API = Object.freeze({
  "stock-movement": { view: "inventory.view" },
  "inventory-item": { view: "inventory.view" },
  "inventory-allocation": { view: "inventory.view" },
  "inventory-fulfillment-event": { view: "inventory.view" },
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
  });
}

function decode(row: Record<string, unknown>, kind: InventoryProcurementKind): ResourceRecord<InventoryProcurementData> | null {
  const states: Readonly<Record<InventoryProcurementKind, readonly string[]>> = {
    "stock-movement": ["draft", "posted", "voided"],
    "inventory-item": ["active", "inactive"],
    "inventory-allocation": ["reserved", "released"],
    "inventory-fulfillment-event": ["recorded"],
    supplier: ["active", "inactive"],
    "purchase-request": ["requested", "reviewed", "approved", "rejected", "cancelled"],
    "purchase-order": ["draft", "ordered", "partially-received", "received", "cancelled"],
  };
  if (
    typeof row.id !== "string" || !row.id.trim() ||
    row.resource_type !== INVENTORY_PROCUREMENT_DEFINITIONS[kind].resourceType ||
    typeof row.state !== "string" || !states[kind].includes(row.state) ||
    typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
    typeof row.subject_json !== "string" ||
    typeof row.data_json !== "string"
  ) return null;
  try {
    const subject: unknown = JSON.parse(row.subject_json);
    const data: unknown = JSON.parse(row.data_json);
    if (!subject || typeof subject !== "object" || Array.isArray(subject) ||
      (subject as Record<string, unknown>).resourceType !== INVENTORY_PROCUREMENT_DEFINITIONS[kind].resourceType ||
      (subject as Record<string, unknown>).resourceId !== row.id ||
      typeof (subject as Record<string, unknown>).companyKey !== "string" || !((subject as Record<string, unknown>).companyKey as string).trim() ||
      typeof (subject as Record<string, unknown>).locationKey !== "string" || !((subject as Record<string, unknown>).locationKey as string).trim() ||
      typeof (subject as Record<string, unknown>).departmentKey !== "string" || !((subject as Record<string, unknown>).departmentKey as string).trim() ||
      !isValidInventoryProcurementData(data, kind)) return null;
    return Object.freeze({
      id: row.id,
      resourceType: row.resource_type,
      state: row.state,
      revision: row.revision,
      subject,
      data,
    }) as ResourceRecord<InventoryProcurementData>;
  } catch {
    return null;
  }
}

async function visible(
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  record: ResourceRecord<InventoryProcurementData>,
  db: D1Database,
) {
  if (!authorize(principal, {
    channel: "api",
    action: "view",
    permission: inventoryProcurementViewPermission(kind),
    subject: record.subject,
  }).allowed) return false;
  if (kind !== "inventory-fulfillment-event" || record.data.kind !== "inventory-fulfillment-event") return true;
  const order = await db.prepare(
    "SELECT subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = 'sales-order' AND deleted_at IS NULL",
  ).bind(record.data.salesOrderId).first<{ subject_json: string; data_json: string }>();
  if (!order || typeof order.subject_json !== "string" || typeof order.data_json !== "string") return false;
  try {
    const orderSubject = JSON.parse(order.subject_json) as Record<string, unknown>;
    const orderData = JSON.parse(order.data_json) as Record<string, unknown>;
    return orderSubject.resourceType === "sales-order" && orderSubject.resourceId === record.data.salesOrderId &&
      orderSubject.companyKey === record.subject.companyKey && orderSubject.locationKey === record.subject.locationKey &&
      orderData.kind === "sales-order" && orderData.customerCode === record.data.customerCode &&
      authorize(principal, { channel: "api", action: "view", permission: "commercial.view", subject: orderSubject as never }).allowed;
  } catch {
    return false;
  }
}

async function rows(db: D1Database, kind: InventoryProcurementKind, id?: string) {
  const definition = INVENTORY_PROCUREMENT_DEFINITIONS[kind];
  if (id) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL",
    ).bind(id, definition.resourceType).all<Record<string, unknown>>();
    return (result.results || []).map((row) => decode(row, kind)).filter((record): record is ResourceRecord<InventoryProcurementData> => record !== null);
  }
  const records: ResourceRecord<InventoryProcurementData>[] = [];
  const pageSize = 200;
  let afterId = "";
  for (;;) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL AND id > ? ORDER BY id ASC LIMIT ?",
    ).bind(definition.resourceType, afterId, pageSize).all<Record<string, unknown>>();
    const page = result.results || [];
    records.push(...page.map((row) => decode(row, kind)).filter((record): record is ResourceRecord<InventoryProcurementData> => record !== null));
    const lastId = page.at(-1)?.id;
    if (typeof lastId === "string") afterId = lastId;
    if (page.length < pageSize) break;
  }
  return records;
}

function authorizeInventoryProcurementRead(
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
) {
  const scope = principal.organizationScope;
  const decision = authorize(principal, {
    channel: "api",
    action: "view",
    permission: inventoryProcurementViewPermission(kind),
    subject: scope ? {
      resourceType: INVENTORY_PROCUREMENT_DEFINITIONS[kind].resourceType,
      ownerId: principal.id,
      assigneeIds: [principal.id],
      companyKey: scope.companyKey,
      locationKey: scope.locationKey,
      departmentKey: scope.departmentKey,
    } : null,
  });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
}

async function requireVisibleEvidence(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: InventoryProcurementData,
) {
  const ids = ("evidenceIds" in data ? data.evidenceIds : undefined) || [];
  if (!ids.length) return;
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  const repository = new D1ResourceRepository<unknown>(db);
  for (const id of ids) {
    const evidence = await repository.transaction((transaction) => transaction.get(id));
    if (!evidence || evidence.resourceType !== "file-evidence" || evidence.state !== "active" || evidence.id !== id) {
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
    const evidenceSubject = evidence.subject;
    if (evidenceSubject.resourceType !== "file-evidence" || evidenceSubject.resourceId !== id ||
      evidenceSubject.companyKey !== scope.companyKey || evidenceSubject.locationKey !== scope.locationKey ||
      !authorize(principal, {
        channel: "api", action: "view", permission: "files.view", subject: evidenceSubject,
      }).allowed) {
      // Missing, inaccessible, malformed, and out-of-scope evidence stay indistinguishable.
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
  }
}

async function requireValidPurchaseOrderReferences(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: InventoryProcurementData,
) {
  if (data.kind !== "purchase-order") return;
  const repository = new D1ResourceRepository<InventoryProcurementData>(db);
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");

  const request = await repository.transaction((transaction) => transaction.get(data.requestId));
  const requestScope = request?.subject;
  const requestData = request?.data;
  if (!request || request.resourceType !== "purchase-request" || request.state !== "approved" ||
      requestScope?.resourceType !== "purchase-request" || requestScope.resourceId !== request.id ||
      requestScope.companyKey !== scope.companyKey || requestScope.locationKey !== scope.locationKey ||
      requestData?.kind !== "purchase-request" || requestData.itemCode !== data.itemCode ||
      requestData.quantity !== data.quantity || requestData.unit !== data.unit ||
      (requestData.supplierCode !== undefined && requestData.supplierCode !== data.supplierCode)) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }

  const supplier = (await rows(db, "supplier")).find((record) => {
    const recordScope = record.subject;
    return record.state === "active" && recordScope.companyKey === scope.companyKey &&
      recordScope.locationKey === scope.locationKey && record.data.kind === "supplier" &&
      record.data.status === "active" && record.data.supplierCode === data.supplierCode;
  });
  if (!supplier) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
}

async function getFeedManufacturingBatchForReceipt(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: Extract<InventoryProcurementData, { kind: "stock-movement" }>,
) {
  if (data.feedManufacturingBatchId === undefined) return null;
  const batch = await getFarmOperation(db, principal, "feed-manufacturing-batch", data.feedManufacturingBatchId);
  if (!batch || batch.data.kind !== "feed-manufacturing-batch" ||
      batch.subject.companyKey !== principal.organizationScope?.companyKey ||
      batch.subject.locationKey !== principal.organizationScope?.locationKey ||
      batch.data.finishedFeedItemCode !== data.itemCode ||
      batch.state === "draft") {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  return batch;
}

async function receiptHasCanonicalFeedBatchReference(
  db: D1Database,
  receipt: ResourceRecord<InventoryProcurementData>,
) {
  const result = await db.prepare(`
    SELECT data_json
    FROM resource_records
    WHERE resource_type = 'feed-manufacturing-batch' AND deleted_at IS NULL
      AND json_extract(subject_json, '$.companyKey') = ?
      AND json_extract(subject_json, '$.locationKey') = ?
      AND json_extract(data_json, '$.finishedFeedLotId') = ?
  `).bind(receipt.subject.companyKey, receipt.subject.locationKey, receipt.id).all<{ data_json: string }>();
  return (result.results || []).some((row) => {
    try {
      const data = JSON.parse(row.data_json) as Record<string, unknown>;
      return data.kind === "feed-manufacturing-batch" && data.finishedFeedLotId === receipt.id;
    } catch {
      return false;
    }
  });
}


/** QA PROTOTYPE ONLY: query canonical maker/checker release timestamp. */
async function verifiedFeedReleaseTime(db: D1Database, batchId: string, revision: number): Promise<number | null> {
  if (!batchId || !Number.isSafeInteger(revision) || revision < 2) return null;
  const audit = await db.prepare(
    "SELECT approval.occurred_at FROM resource_audit_events approval " +
    "JOIN resource_records batch ON batch.id = approval.resource_id " +
    "WHERE batch.id = ? AND batch.resource_type = 'feed-manufacturing-batch' " +
    "AND batch.state = 'released' AND batch.deleted_at IS NULL AND batch.revision = ? " +
    "AND batch.created_by IS NOT NULL AND batch.created_by != '' " +
    "AND approval.resource_type = 'feed-manufacturing-batch' " +
    "AND approval.action = 'approve' AND approval.permission = 'manufacturing.edit' AND approval.channel = 'api' " +
    "AND approval.actor_id IS NOT NULL AND approval.actor_id != '' AND approval.actor_id != batch.created_by " +
    "AND json_valid(approval.metadata_json) " +
    "AND json_extract(approval.metadata_json, '$.event') = 'resource.transitioned' " +
    "AND json_extract(approval.metadata_json, '$.from') = 'quality-hold' " +
    "AND json_extract(approval.metadata_json, '$.to') = 'released' AND json_extract(approval.metadata_json, '$.state') = 'released' " +
    "AND json_extract(approval.metadata_json, '$.approvalMode') = 'maker-checker' " +
    "AND json_extract(approval.metadata_json, '$.revision') = batch.revision " +
    "AND (SELECT COUNT(*) FROM resource_audit_events competing " +
    "WHERE competing.resource_id = batch.id AND competing.resource_type = 'feed-manufacturing-batch' " +
    "AND competing.action = 'approve') = 1",
  ).bind(batchId, revision).first<{ occurred_at: string }>();
  const ms = Date.parse(audit?.occurred_at || "");
  return Number.isFinite(ms) ? ms : null;
}
/** QA PROTOTYPE ONLY: recheck audit inside atomic D1 mutation. */
// Preserve every audit predicate while bounding SQLite expression depth.
// SQLite AND is associative (including three-valued NULL logic); constructing
// a balanced tree prevents the workerd D1 limit of 100 expression levels.
function balancedSqlAnd(terms: readonly string[]): string {
  if (terms.length === 1) return terms[0];
  const middle = Math.floor(terms.length / 2);
  return "(" + balancedSqlAnd(terms.slice(0, middle)) + " AND " +
    balancedSqlAnd(terms.slice(middle)) + ")";
}
function releaseAuditEvidenceSql(batch: string, asOf: string) {
  const tests = [
    "approved_audit.resource_id = " + batch + ".id",
    "approved_audit.resource_type = 'feed-manufacturing-batch'",
    "approved_audit.action = 'approve'",
    "approved_audit.permission = 'manufacturing.edit'",
    "approved_audit.channel = 'api'",
    "approved_audit.actor_id != ''",
    batch + ".created_by IS NOT NULL",
    batch + ".created_by != ''",
    "approved_audit.actor_id != " + batch + ".created_by",
    "(SELECT COUNT(*) FROM resource_audit_events competing WHERE " +
      "competing.resource_id = " + batch + ".id AND " +
      "competing.resource_type = 'feed-manufacturing-batch' AND competing.action = 'approve') = 1",
    "json_valid(approved_audit.metadata_json)",
    "json_extract(approved_audit.metadata_json, '$.event') = 'resource.transitioned'",
    "json_extract(approved_audit.metadata_json, '$.from') = 'quality-hold'",
    "json_extract(approved_audit.metadata_json, '$.to') = 'released'",
    "json_extract(approved_audit.metadata_json, '$.state') = 'released'",
    "json_extract(approved_audit.metadata_json, '$.approvalMode') = 'maker-checker'",
    "json_extract(approved_audit.metadata_json, '$.revision') = " + batch + ".revision",
    "julianday(approved_audit.occurred_at) <= julianday(" + asOf + ")",
  ];
  return "EXISTS (SELECT 1 FROM resource_audit_events approved_audit WHERE " +
    balancedSqlAnd(tests) + ")";
}
// Stage24 stock-movement approval projection for one atomic UPDATE. Preserve
// original maker/checker predicate and effective-date guard without deeply
// re-expanding the audit subquery at every receipt-lot/balance checkpoint.
function releaseAuditFromMaterializedEvidenceSql(batch: string, asOf: string) {
  return "EXISTS (SELECT 1 FROM qualified_feed_release_audits good " +
    "WHERE good.batch_id = " + batch + ".id " +
    "AND julianday(good.approved_at) <= julianday(" + asOf + "))";
}

async function requireValidReceiptLotAllocations(
  db: D1Database,
  current: ResourceRecord<InventoryProcurementData>,
) {
  if (current.data.kind !== "stock-movement" || current.data.movementType !== "issue" ||
      current.data.receiptLotAllocations === undefined) return;
  const movement = current.data;
  const allocations = movement.receiptLotAllocations || [];
  for (const allocation of allocations) {
    const receipt = (await rows(db, "stock-movement", allocation.receiptLotId))[0] || null;
    if (!receipt || receipt.state !== "posted" || receipt.data.kind !== "stock-movement" ||
        receipt.data.movementType !== "receipt" || receipt.subject.companyKey !== current.subject.companyKey ||
        receipt.subject.locationKey !== current.subject.locationKey || receipt.data.inventoryItemId !== movement.inventoryItemId ||
        receipt.data.itemCode !== movement.itemCode || receipt.data.locationKey !== movement.locationKey ||
        receipt.data.unit !== movement.unit) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["receipt lot is not an eligible source"]);
    }
    const receiptEffectiveAt = Date.parse(receipt.data.occurredAt);
    const issueEffectiveAt = Date.parse(movement.occurredAt);
    if (!Number.isFinite(receiptEffectiveAt) || !Number.isFinite(issueEffectiveAt) || receiptEffectiveAt > issueEffectiveAt) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["receipt lot is not effective yet"]);
    }
    if (receipt.data.feedManufacturingBatchId !== undefined) {
      const batch = await db.prepare(
        "SELECT id, revision, state, data_json, subject_json FROM resource_records WHERE id = ? AND resource_type = 'feed-manufacturing-batch' AND deleted_at IS NULL",
      ).bind(receipt.data.feedManufacturingBatchId).first<Record<string, unknown>>();
      let batchData: Record<string, unknown> | null = null;
      let batchSubject: Record<string, unknown> | null = null;
      try {
        batchData = batch && typeof batch.data_json === "string" ? JSON.parse(batch.data_json) as Record<string, unknown> : null;
        batchSubject = batch && typeof batch.subject_json === "string" ? JSON.parse(batch.subject_json) as Record<string, unknown> : null;
      } catch { /* handled by the fail-closed predicate below */ }
      if (!batch || batch.state !== "released" || batchData?.kind !== "feed-manufacturing-batch" ||
          batchData.finishedFeedLotId !== receipt.id || batchData.finishedFeedItemCode !== movement.itemCode ||
          batchSubject?.companyKey !== current.subject.companyKey || batchSubject?.locationKey !== current.subject.locationKey) {
        throw new ResourceWorkflowError("VALIDATION_FAILED", ["receipt lot is not an eligible source"]);
      }
      const approvedAt = await verifiedFeedReleaseTime(db, String(batch.id), Number(batch.revision));
      if (approvedAt === null || approvedAt > issueEffectiveAt) {
        throw new ResourceWorkflowError("VALIDATION_FAILED", ["finished-feed release was not effective for the stock issue"]);
      }
    } else if (await receiptHasCanonicalFeedBatchReference(db, receipt)) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["receipt lot is not an eligible source"]);
    }
    const issueRows = await rows(db, "stock-movement");
    const allocated = issueRows.filter((issue): issue is ResourceRecord<Extract<InventoryProcurementData, { kind: "stock-movement" }>> =>
      issue.state === "posted" && issue.data.kind === "stock-movement" && issue.data.movementType === "issue" &&
      issue.subject.companyKey === current.subject.companyKey && issue.subject.locationKey === current.subject.locationKey &&
      issue.data.inventoryItemId === movement.inventoryItemId && issue.data.itemCode === movement.itemCode &&
      issue.data.locationKey === movement.locationKey && issue.data.unit === movement.unit)
      .flatMap((issue) => issue.data.receiptLotAllocations || [])
      .filter((item) => item.receiptLotId === receipt.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (allocated + allocation.quantity > receipt.data.quantity + 1e-9) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["receipt lot quantity is already consumed"]);
    }
  }
}

async function requireNoFutureRunningBalanceDeficit(
  db: D1Database,
  current: ResourceRecord<InventoryProcurementData>,
) {
  if (current.data.kind !== "stock-movement" || current.data.movementType !== "issue") return;
  const movement = current.data;
  const issueAt = Date.parse(movement.occurredAt);
  if (!Number.isFinite(issueAt)) throw new ResourceWorkflowError("VALIDATION_FAILED", ["event date is invalid"]);
  const posted = (await rows(db, "stock-movement")).filter((record) =>
    record.state === "posted" && record.data.kind === "stock-movement" &&
    record.subject.companyKey === current.subject.companyKey && record.subject.locationKey === current.subject.locationKey &&
    record.data.inventoryItemId === movement.inventoryItemId && record.data.itemCode === movement.itemCode &&
    record.data.locationKey === movement.locationKey && record.data.unit === movement.unit &&
    (record.data.movementType === "receipt" || record.data.movementType === "issue"));
  const eligible: Array<{ occurredAt: number; quantity: number; movementType: "receipt" | "issue" }> = [];
  for (const record of posted) {
    if (record.data.kind !== "stock-movement") continue;
    const occurredAt = Date.parse(record.data.occurredAt);
    if (!Number.isFinite(occurredAt)) continue;
    if (record.data.movementType === "issue") {
      eligible.push({ occurredAt, quantity: record.data.quantity, movementType: "issue" });
      continue;
    }
    let eligibleAt = occurredAt;
    if (record.data.feedManufacturingBatchId !== undefined) {
      const batch = await db.prepare(
        "SELECT id, revision, state, data_json, subject_json FROM resource_records WHERE id = ? AND resource_type = 'feed-manufacturing-batch' AND deleted_at IS NULL",
      ).bind(record.data.feedManufacturingBatchId).first<Record<string, unknown>>();
      let data: Record<string, unknown> | null = null;
      let subject: Record<string, unknown> | null = null;
      try {
        data = batch && typeof batch.data_json === "string" ? JSON.parse(batch.data_json) as Record<string, unknown> : null;
        subject = batch && typeof batch.subject_json === "string" ? JSON.parse(batch.subject_json) as Record<string, unknown> : null;
      } catch { /* fail closed */ }
      if (!batch || batch.state !== "released" || data?.kind !== "feed-manufacturing-batch" ||
          (data.finishedFeedLotId !== undefined && data.finishedFeedLotId !== record.id) || data.finishedFeedItemCode !== movement.itemCode ||
          subject?.companyKey !== current.subject.companyKey || subject?.locationKey !== current.subject.locationKey) continue;
      const approvedAt = await verifiedFeedReleaseTime(db, String(batch.id), Number(batch.revision));
      if (approvedAt === null) continue;
      eligibleAt = Math.max(occurredAt, approvedAt);
    } else if (await receiptHasCanonicalFeedBatchReference(db, record)) continue;
    eligible.push({ occurredAt: eligibleAt, quantity: record.data.quantity, movementType: "receipt" });
  }
  eligible.push({ occurredAt: issueAt, quantity: movement.quantity, movementType: "issue" });
  const checkpoints = [...new Set(eligible.map((entry) => entry.occurredAt))].sort((a, b) => a - b);
  let balance = 0;
  for (const checkpoint of checkpoints) {
    for (const entry of eligible.filter((candidate) => candidate.occurredAt === checkpoint)) {
      balance += entry.movementType === "receipt" ? entry.quantity : -entry.quantity;
    }
    if (checkpoint >= issueAt && balance < -1e-9) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["issue would create a negative future stock checkpoint"]);
    }
  }
}

async function requireValidPurchaseRequestReferences(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: InventoryProcurementData,
) {
  if (data.kind !== "purchase-request" || data.supplierCode === undefined) return;
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const supplier = (await rows(db, "supplier")).find((record) => {
    const recordScope = record.subject;
    return record.state === "active" && recordScope.companyKey === scope.companyKey &&
      recordScope.locationKey === scope.locationKey && record.data.kind === "supplier" &&
      record.data.status === "active" && record.data.supplierCode === data.supplierCode;
  });
  if (!supplier) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
}

async function requireValidPurchaseOrderReceiptReference(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: InventoryProcurementData,
) {
  if (data.kind !== "stock-movement" || data.movementType !== "receipt" || data.purchaseOrderId === undefined) return;
  const order = (await rows(db, "purchase-order", data.purchaseOrderId))[0] || null;
  const scope = principal.organizationScope;
  if (!scope || !order || order.subject.companyKey !== scope.companyKey || order.subject.locationKey !== scope.locationKey ||
      !["ordered", "partially-received", "received"].includes(order.state) || order.data.kind !== "purchase-order" ||
      order.data.itemCode !== data.itemCode || order.data.unit !== data.unit || data.quantity > order.data.quantity) {
    // Keep missing, inaccessible and mismatched source records indistinguishable.
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
}

export async function listInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
) {
  authorizeInventoryProcurementRead(principal, kind);
  const records = await rows(db, kind);
  const result: ResourceRecord<InventoryProcurementData>[] = [];
  for (const record of records) if (await visible(principal, kind, record, db)) result.push(record);
  return result;
}

export type InventoryProcurementPage = Readonly<{
  items: readonly ResourceRecord<InventoryProcurementData>[];
  nextCursor: string | null;
}>;

/** Bounded keyset page; continuation tokens are based only on visible rows. */
export async function listInventoryProcurementPage(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  options: Readonly<{ cursor?: string; limit?: number }> = {},
): Promise<InventoryProcurementPage> {
  const limit = options.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      (options.cursor !== undefined && (typeof options.cursor !== "string" || options.cursor.length > 120))) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["pagination options are invalid"]);
  }
  authorizeInventoryProcurementRead(principal, kind);
  const records: ResourceRecord<InventoryProcurementData>[] = [];
  const pageSize = 200;
  let afterId = options.cursor ?? "";
  let hasMore = false;
  while (!hasMore) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL AND id > ? ORDER BY id ASC LIMIT ?",
    ).bind(INVENTORY_PROCUREMENT_DEFINITIONS[kind].resourceType, afterId, pageSize).all<Record<string, unknown>>();
    const page = result.results || [];
    for (const row of page) {
      if (typeof row.id === "string") afterId = row.id;
      const record = decode(row, kind);
      if (record && await visible(principal, kind, record, db)) records.push(record);
      if (records.length > limit) {
        records.pop();
        hasMore = true;
        break;
      }
    }
    if (hasMore || page.length < pageSize) break;
  }
  return Object.freeze({
    items: Object.freeze(records),
    nextCursor: hasMore ? records.at(-1)?.id ?? null : null,
  });
}

export async function getInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  id: string,
) {
  authorizeInventoryProcurementRead(principal, kind);
  const record = (await rows(db, kind, id))[0] || null;
  return record && await visible(principal, kind, record, db) ? record : null;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function getInventoryAvailability(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  inventoryItemId: string,
  locationKey: string,
) {
  authorizeInventoryProcurementRead(principal, "inventory-item");
  if (!locationKey.trim() || locationKey.length > 120) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["location is invalid"]);
  }
  const item = (await rows(db, "inventory-item", inventoryItemId))[0] || null;
  if (!item || !await visible(principal, "inventory-item", item, db) || item.state !== "active" ||
      item.data.kind !== "inventory-item") return null;
  const itemData = item.data;
  const matchingMovements: ResourceRecord<InventoryProcurementData>[] = [];
  for (const record of await rows(db, "stock-movement")) {
    if (record.data.kind === "stock-movement" && await visible(principal, "stock-movement", record, db) &&
        record.subject.companyKey === item.subject.companyKey &&
        record.subject.locationKey === item.subject.locationKey &&
        record.data.locationKey === locationKey && record.data.itemCode === itemData.itemCode) matchingMovements.push(record);
  }
  const hasAmbiguousLegacyMovements = matchingMovements.some(({ state, data }) =>
    state === "posted" && data.kind === "stock-movement" && data.inventoryItemId === undefined);
  let ambiguousFinishedFeed = false;
  const physicalMovements: ResourceRecord<InventoryProcurementData>[] = [];
  const eligibleMovements: ResourceRecord<InventoryProcurementData>[] = [];
  const quarantinedMovements: ResourceRecord<InventoryProcurementData>[] = [];
  for (const record of matchingMovements) {
    if (record.data.kind !== "stock-movement" || record.data.inventoryItemId !== item.id) continue;
    if (record.data.feedManufacturingBatchId !== undefined) {
      try {
        const batch = await getFeedManufacturingBatchForReceipt(db, principal, record.data);
        if (batch?.state === "quality-hold") {
          // A verified posted receipt is physically on hand even while its
          // finished-feed batch is quarantined. Keep it out of eligible stock
          // without hiding the truthful physical balance.
          physicalMovements.push(record);
          quarantinedMovements.push(record);
          continue;
        }
        if (!batch || batch.state !== "released" || batch.data.kind !== "feed-manufacturing-batch" ||
            batch.data.finishedFeedLotId !== record.id ||
            (await verifiedFeedReleaseTime(db, batch.id, batch.revision)) === null) {
          throw new ResourceWorkflowError("VALIDATION_FAILED", ["unverified feed release"]);
        }
        physicalMovements.push(record);
        eligibleMovements.push(record);
      } catch {
        ambiguousFinishedFeed = true;
      }
    } else if (record.data.movementType === "receipt" && await receiptHasCanonicalFeedBatchReference(db, record)) {
      // A historical finished-feed receipt can be linked from the Primary
      // manufacturing authority without carrying the reciprocal source ID.
      // Its provenance is therefore ambiguous and must not become saleable.
      ambiguousFinishedFeed = true;
      continue;
    } else {
      physicalMovements.push(record);
      eligibleMovements.push(record);
    }
  }
  let reservedQuantity = 0;
  for (const record of await rows(db, "inventory-allocation")) {
    if (record.state !== "reserved" || record.data.kind !== "inventory-allocation" ||
        !(await visible(principal, "inventory-allocation", record, db)) || record.subject.companyKey !== item.subject.companyKey ||
        record.subject.locationKey !== item.subject.locationKey || record.data.inventoryItemId !== item.id ||
        record.data.locationKey !== locationKey || record.data.unit !== itemData.unit) continue;
    reservedQuantity += record.data.quantity;
  }
  const physicalOnHand = hasAmbiguousLegacyMovements || ambiguousFinishedFeed
    ? Object.freeze({ state: "reconciliation-required" as const, quantity: null, unit: itemData.unit })
    : deriveStockOnHand(physicalMovements.map(({ state, data }) => ({
    state,
    data: data as Extract<InventoryProcurementData, { kind: "stock-movement" }>,
  })), itemData.itemCode, locationKey, itemData.unit);
  const eligibleOnHand = hasAmbiguousLegacyMovements || ambiguousFinishedFeed
    ? Object.freeze({ state: "reconciliation-required" as const, quantity: null, unit: itemData.unit })
    : deriveStockOnHand(eligibleMovements.map(({ state, data }) => ({
    state,
    data: data as Extract<InventoryProcurementData, { kind: "stock-movement" }>,
  })), itemData.itemCode, locationKey, itemData.unit);
  const inventoryState = eligibleOnHand.quantity === null || reservedQuantity > eligibleOnHand.quantity
    ? "reconciliation-required" as const : "allocatable" as const;
  const quarantined = hasAmbiguousLegacyMovements || ambiguousFinishedFeed
    ? null
    : deriveStockOnHand(quarantinedMovements.map(({ state, data }) => ({
    state,
    data: data as Extract<InventoryProcurementData, { kind: "stock-movement" }>,
  })), itemData.itemCode, locationKey, itemData.unit).quantity;
  return Object.freeze({
    inventoryItemId: item.id,
    itemCode: itemData.itemCode,
    name: itemData.name,
    locationKey,
    onHandState: physicalOnHand.state,
    onHandQuantity: physicalOnHand.quantity,
    availableQuantity: inventoryState === "allocatable" ? eligibleOnHand.quantity! - reservedQuantity : null,
    availabilityState: inventoryState,
    unit: physicalOnHand.unit,
    ...(quarantined !== null && quarantined > 0 ? { quarantinedQuantity: quarantined } : {}),
  });
}

/** Atomically reserves stock against the posted movement ledger. */
export async function allocateInventory(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  input: Readonly<{ salesOrderId: string; inventoryItemId: string; locationKey: string; quantity: number; unit: string; idempotencyKey: string }>,
) {
  authorizeInventoryProcurementRead(principal, "inventory-allocation");
  const definition = INVENTORY_PROCUREMENT_DEFINITIONS["inventory-allocation"];
  const subject = inventoryProcurementSubject(principal, "inventory-allocation");
  const writeDecision = authorize(principal, {
    channel: "api", action: "create", permission: definition.permissions.create!, subject,
  });
  if (!writeDecision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [writeDecision.code]);
  const data = { ...input, kind: "inventory-allocation" as const };
  if (!isValidInventoryProcurementData(data, "inventory-allocation")) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["inventory allocation is invalid"]);
  }
  const scope = principal.organizationScope;
  if (!scope || input.locationKey.length > 120) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const item = await getInventoryProcurement(db, principal, "inventory-item", input.inventoryItemId);
  if (!item || item.state !== "active" || item.data.kind !== "inventory-item" || item.data.unit !== input.unit ||
      item.subject.companyKey !== scope.companyKey || item.subject.locationKey !== scope.locationKey) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  const orderRow = await db.prepare(
    "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = 'sales-order' AND deleted_at IS NULL",
  ).bind(input.salesOrderId).first<Record<string, unknown>>();
  if (!orderRow || typeof orderRow.subject_json !== "string" || typeof orderRow.data_json !== "string") {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  let orderSubject: Record<string, unknown>;
  let orderData: Record<string, unknown>;
  try {
    orderSubject = JSON.parse(orderRow.subject_json) as Record<string, unknown>;
    orderData = JSON.parse(orderRow.data_json) as Record<string, unknown>;
  } catch { throw new ResourceWorkflowError("RESOURCE_NOT_FOUND"); }
  const orderSubjectForAuthorization = orderSubject as never;
  const orderVisible = authorize(principal, {
    channel: "api", action: "view", permission: "commercial.view", subject: orderSubject as never,
  }).allowed;
  const orderEditable = authorize(principal, {
    channel: "api", action: "edit", permission: "commercial.edit", subject: orderSubjectForAuthorization,
  }).allowed;
  if (!orderVisible || !orderEditable || orderSubject.resourceType !== "sales-order" || orderSubject.resourceId !== input.salesOrderId ||
      orderSubject.companyKey !== scope.companyKey || orderSubject.locationKey !== scope.locationKey ||
      orderRow.state !== "approved" || orderData.kind !== "sales-order" || orderData.inventoryItemId !== item.id ||
      orderData.itemCode !== item.data.itemCode || orderData.unit !== input.unit ||
      typeof orderData.quantity !== "number" || input.quantity > orderData.quantity) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  const dataJson = JSON.stringify(data);
  const recordId = crypto.randomUUID();
  const recordSubject = { ...subject, resourceId: recordId };
  const now = new Date().toISOString();
  const audit = createSecurityAuditEvent(principal, {
    channel: "api", action: "create", permission: "inventory.edit", subject: { ...recordSubject, resourceType: "inventory-allocation" },
  }, { event: "inventory.allocation.reserved", salesOrderId: input.salesOrderId, inventoryItemId: item.id }, now);

  // The reservation check and insert are one D1 batch. The ledger sum and
  // active reservations are re-evaluated by SQLite at commit time, preventing
  // two concurrent callers from both consuming the same remaining quantity.
  const insert = db.prepare(`
    INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at)
    SELECT ?, 'inventory-allocation', 'reserved', 1, ?, ?, ?, ?, ?, NULL
    WHERE EXISTS (
      SELECT 1 FROM resource_records so
      WHERE so.id = ? AND so.resource_type = 'sales-order' AND so.state = 'approved' AND so.deleted_at IS NULL
        AND json_extract(so.subject_json, '$.companyKey') = ?
        AND json_extract(so.subject_json, '$.locationKey') = ?
        AND json_extract(so.data_json, '$.kind') = 'sales-order'
        AND json_extract(so.data_json, '$.inventoryItemId') = ?
        AND json_extract(so.data_json, '$.itemCode') = ? AND json_extract(so.data_json, '$.unit') = ?
        AND COALESCE((SELECT SUM(CAST(json_extract(a.data_json, '$.quantity') AS REAL)) FROM resource_records a
          WHERE a.resource_type = 'inventory-allocation' AND a.state = 'reserved' AND a.deleted_at IS NULL
            AND json_extract(a.subject_json, '$.companyKey') = ? AND json_extract(a.subject_json, '$.locationKey') = ?
            AND json_extract(a.data_json, '$.salesOrderId') = so.id), 0) + ? <= CAST(json_extract(so.data_json, '$.quantity') AS REAL)
    )
    AND EXISTS (SELECT 1 FROM resource_records item WHERE item.id = ? AND item.resource_type = 'inventory-item'
      AND item.state = 'active' AND item.deleted_at IS NULL AND json_extract(item.subject_json, '$.companyKey') = ?
      AND json_extract(item.subject_json, '$.locationKey') = ? AND json_extract(item.data_json, '$.unit') = ?)
    AND NOT EXISTS (SELECT 1 FROM resource_records m WHERE m.resource_type = 'stock-movement' AND m.state = 'posted' AND m.deleted_at IS NULL
      AND json_extract(m.subject_json, '$.companyKey') = ? AND json_extract(m.subject_json, '$.locationKey') = ?
      AND json_extract(m.data_json, '$.itemCode') = ? AND json_extract(m.data_json, '$.locationKey') = ?
      AND json_extract(m.data_json, '$.movementType') IN ('adjustment', 'transfer'))
    AND NOT EXISTS (SELECT 1 FROM resource_records m WHERE m.resource_type = 'stock-movement' AND m.state = 'posted' AND m.deleted_at IS NULL
      AND json_extract(m.subject_json, '$.companyKey') = ? AND json_extract(m.subject_json, '$.locationKey') = ?
      AND json_extract(m.data_json, '$.itemCode') = ? AND json_extract(m.data_json, '$.locationKey') = ?
      AND json_extract(m.data_json, '$.inventoryItemId') IS NULL)
    AND (SELECT COALESCE(SUM(CASE json_extract(m.data_json, '$.movementType') WHEN 'receipt' THEN 1 ELSE -1 END * CAST(json_extract(m.data_json, '$.quantity') AS REAL)), 0)
      FROM resource_records m WHERE m.resource_type = 'stock-movement' AND m.state = 'posted' AND m.deleted_at IS NULL
        AND json_extract(m.subject_json, '$.companyKey') = ? AND json_extract(m.subject_json, '$.locationKey') = ?
        AND json_extract(m.data_json, '$.inventoryItemId') = ? AND json_extract(m.data_json, '$.locationKey') = ?
        AND json_extract(m.data_json, '$.unit') = ? AND json_extract(m.data_json, '$.movementType') IN ('receipt', 'issue')
        AND (json_extract(m.data_json, '$.feedManufacturingBatchId') IS NULL OR EXISTS (
          SELECT 1 FROM resource_records feed_batch
          WHERE feed_batch.id = json_extract(m.data_json, '$.feedManufacturingBatchId')
            AND feed_batch.resource_type = 'feed-manufacturing-batch' AND feed_batch.state = 'released'
            AND ${releaseAuditEvidenceSql("feed_batch", "strftime('%Y-%m-%dT%H:%M:%fZ','now')")}
            AND feed_batch.deleted_at IS NULL
            AND json_extract(feed_batch.subject_json, '$.companyKey') = json_extract(m.subject_json, '$.companyKey')
            AND json_extract(feed_batch.subject_json, '$.locationKey') = json_extract(m.subject_json, '$.locationKey')
            AND json_extract(feed_batch.data_json, '$.finishedFeedItemCode') = json_extract(m.data_json, '$.itemCode')
            AND json_extract(feed_batch.data_json, '$.finishedFeedLotId') = m.id
        )) AND NOT EXISTS (
          SELECT 1 FROM resource_records feed_batch_reference
          WHERE json_extract(m.data_json, '$.feedManufacturingBatchId') IS NULL
            AND feed_batch_reference.resource_type = 'feed-manufacturing-batch'
            AND feed_batch_reference.deleted_at IS NULL
            AND json_extract(feed_batch_reference.subject_json, '$.companyKey') = json_extract(m.subject_json, '$.companyKey')
            AND json_extract(feed_batch_reference.subject_json, '$.locationKey') = json_extract(m.subject_json, '$.locationKey')
            AND json_extract(feed_batch_reference.data_json, '$.finishedFeedLotId') = m.id
        ))
      - COALESCE((SELECT SUM(CAST(json_extract(a.data_json, '$.quantity') AS REAL)) FROM resource_records a
        WHERE a.resource_type = 'inventory-allocation' AND a.state = 'reserved' AND a.deleted_at IS NULL
          AND json_extract(a.subject_json, '$.companyKey') = ? AND json_extract(a.subject_json, '$.locationKey') = ?
          AND json_extract(a.data_json, '$.inventoryItemId') = ? AND json_extract(a.data_json, '$.locationKey') = ?), 0) >= ?
    AND NOT EXISTS (SELECT 1 FROM resource_records WHERE resource_type = 'inventory-allocation' AND deleted_at IS NULL
      AND json_extract(subject_json, '$.companyKey') = ? AND json_extract(subject_json, '$.locationKey') = ?
      AND json_extract(data_json, '$.idempotencyKey') = ?)
  `).bind(recordId, principal.id, JSON.stringify(recordSubject), dataJson, now, now,
    input.salesOrderId, scope.companyKey, scope.locationKey, item.id, item.data.itemCode, input.unit,
    scope.companyKey, scope.locationKey, input.quantity,
    item.id, scope.companyKey, scope.locationKey, input.unit,
    scope.companyKey, scope.locationKey, item.data.itemCode, input.locationKey,
    scope.companyKey, scope.locationKey, item.data.itemCode, input.locationKey,
    scope.companyKey, scope.locationKey, item.id, input.locationKey, input.unit,
    scope.companyKey, scope.locationKey, item.id, input.locationKey, input.quantity,
    scope.companyKey, scope.locationKey, input.idempotencyKey);
  const auditInsert = db.prepare(`INSERT INTO resource_audit_events
    (id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND revision = 1 AND deleted_at IS NULL)`)
    .bind(crypto.randomUUID(), audit.resourceId, audit.resourceType, audit.actorId, audit.action, audit.permission,
      audit.channel, audit.occurredAt, JSON.stringify(audit.metadata), recordId);
  let result: D1Result[];
  try { result = await db.batch([insert, auditInsert]); }
  catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      const existing = (await rows(db, "inventory-allocation")).find((record) =>
        record.data.kind === "inventory-allocation" && record.data.idempotencyKey === input.idempotencyKey &&
        record.subject.companyKey === scope.companyKey && record.subject.locationKey === scope.locationKey);
      if (existing && existing.data.kind === "inventory-allocation" &&
          existing.data.salesOrderId === input.salesOrderId && existing.data.inventoryItemId === item.id &&
          existing.data.locationKey === input.locationKey && existing.data.quantity === input.quantity && existing.data.unit === input.unit) return existing;
      if (existing) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
    }
    throw error;
  }
  if (Number(result[0]?.meta?.changes || 0) !== 1) {
    const existing = (await rows(db, "inventory-allocation")).find((record) =>
      record.data.kind === "inventory-allocation" && record.data.idempotencyKey === input.idempotencyKey &&
      record.subject.companyKey === scope.companyKey && record.subject.locationKey === scope.locationKey);
    if (existing && existing.data.kind === "inventory-allocation" &&
        existing.data.salesOrderId === input.salesOrderId && existing.data.inventoryItemId === item.id &&
        existing.data.locationKey === input.locationKey && existing.data.quantity === input.quantity && existing.data.unit === input.unit) return existing;
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["inventory is unavailable, ambiguous, or already reserved"]);
  }
  if (Number(result[1]?.meta?.changes || 0) !== 1) throw new Error("RESOURCE_AUDIT_NOT_WRITTEN");
  return Object.freeze({ id: recordId, resourceType: "inventory-allocation", state: "reserved", revision: 1,
    createdBy: principal.id, subject: recordSubject, data }) as ResourceRecord<InventoryProcurementData>;
}

/** Appends one fulfillment event only when its derived stage balance remains valid. */
async function recordInventoryFulfillmentEvent(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  id: string,
  subject: ReturnType<typeof inventoryProcurementSubject>,
  data: Extract<InventoryProcurementData, { kind: "inventory-fulfillment-event" }>,
) {
  const now = new Date().toISOString();
  const recordSubject = { ...subject, resourceId: id };
  const eventStage = data.eventType;
  const predecessorStage = eventStage === "packed" ? "picked"
    : eventStage === "dispatched" ? "packed"
      : eventStage === "delivered" ? "dispatched"
        : eventStage === "returned" ? "delivered" : null;
  const previousStageSql = predecessorStage
    ? `AND COALESCE((SELECT SUM(CAST(json_extract(prior.data_json, '$.quantity') AS REAL))
        FROM resource_records prior
        WHERE prior.resource_type = 'inventory-fulfillment-event' AND prior.state = 'recorded' AND prior.deleted_at IS NULL
          AND json_extract(prior.subject_json, '$.companyKey') = ? AND json_extract(prior.subject_json, '$.locationKey') = ?
          AND json_extract(prior.data_json, '$.inventoryAllocationId') = ?
          AND json_extract(prior.data_json, '$.eventType') = '${predecessorStage}'), 0)
      >= ? + COALESCE((SELECT SUM(CAST(json_extract(current.data_json, '$.quantity') AS REAL))
        FROM resource_records current
        WHERE current.resource_type = 'inventory-fulfillment-event' AND current.state = 'recorded' AND current.deleted_at IS NULL
          AND json_extract(current.subject_json, '$.companyKey') = ? AND json_extract(current.subject_json, '$.locationKey') = ?
          AND json_extract(current.data_json, '$.inventoryAllocationId') = ?
          AND json_extract(current.data_json, '$.eventType') = ?), 0)`
    : "";
  const correctionSql = eventStage === "correction"
    ? `AND EXISTS (SELECT 1 FROM resource_records original
        WHERE original.id = ? AND original.resource_type = 'inventory-fulfillment-event' AND original.state = 'recorded' AND original.deleted_at IS NULL
          AND json_extract(original.subject_json, '$.companyKey') = ? AND json_extract(original.subject_json, '$.locationKey') = ?
          AND json_extract(original.data_json, '$.inventoryAllocationId') = ?
          AND json_extract(original.data_json, '$.eventType') != 'correction')`
    : "";
  const audit = createSecurityAuditEvent(principal, {
    channel: "api", action: "create", permission: "inventory.edit",
    subject: { ...recordSubject, resourceType: "inventory-fulfillment-event" },
  }, { event: "inventory.fulfillment.recorded", eventType: eventStage,
    salesOrderId: data.salesOrderId, inventoryAllocationId: data.inventoryAllocationId,
    inventoryItemId: data.inventoryItemId, quantity: data.quantity }, now);
  const insertBase = `
    INSERT INTO resource_records
      (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at)
    SELECT ?, 'inventory-fulfillment-event', 'recorded', 1, ?, ?, ?, ?, ?, NULL
    WHERE EXISTS (SELECT 1 FROM resource_records allocation
      WHERE allocation.id = ? AND allocation.resource_type = 'inventory-allocation'
        AND allocation.state = 'reserved' AND allocation.deleted_at IS NULL
        AND json_extract(allocation.subject_json, '$.companyKey') = ? AND json_extract(allocation.subject_json, '$.locationKey') = ?
        AND json_extract(allocation.data_json, '$.salesOrderId') = ?
        AND json_extract(allocation.data_json, '$.inventoryItemId') = ?
        AND CAST(json_extract(allocation.data_json, '$.quantity') AS REAL) >= ?
        AND COALESCE((SELECT SUM(CAST(json_extract(stage.data_json, '$.quantity') AS REAL))
          FROM resource_records stage
          WHERE stage.resource_type = 'inventory-fulfillment-event' AND stage.state = 'recorded' AND stage.deleted_at IS NULL
            AND json_extract(stage.subject_json, '$.companyKey') = ? AND json_extract(stage.subject_json, '$.locationKey') = ?
            AND json_extract(stage.data_json, '$.inventoryAllocationId') = ?
            AND json_extract(stage.data_json, '$.eventType') = ?), 0) + ?
          <= CAST(json_extract(allocation.data_json, '$.quantity') AS REAL))
    ${previousStageSql}
    ${correctionSql}
  `;
  const values: unknown[] = [id, principal.id, JSON.stringify(recordSubject), JSON.stringify(data), now, now,
    data.inventoryAllocationId, subject.companyKey, subject.locationKey, data.salesOrderId, data.inventoryItemId, data.quantity,
    subject.companyKey, subject.locationKey, data.inventoryAllocationId, eventStage, data.quantity];
  if (predecessorStage) values.push(subject.companyKey, subject.locationKey, data.inventoryAllocationId, data.quantity,
    subject.companyKey, subject.locationKey, data.inventoryAllocationId, eventStage);
  if (eventStage === "correction") values.push(data.correctionOf, subject.companyKey, subject.locationKey, data.inventoryAllocationId);
  const insert = db.prepare(insertBase).bind(...values);
  const auditInsert = db.prepare(`
    INSERT INTO resource_audit_events
      (id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND resource_type = 'inventory-fulfillment-event' AND revision = 1 AND deleted_at IS NULL)
  `).bind(crypto.randomUUID(), audit.resourceId, audit.resourceType, audit.actorId, audit.action,
    audit.permission, audit.channel, audit.occurredAt, JSON.stringify(audit.metadata), id);
  let result: D1Result[];
  try {
    result = await db.batch([insert, auditInsert]);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      throw new ResourceWorkflowError("RESOURCE_EXISTS");
    }
    throw error;
  }
  if (Number(result[0]?.meta?.changes || 0) !== 1) {
    const existing = (await rows(db, "inventory-fulfillment-event")).find((record) =>
      record.data.kind === "inventory-fulfillment-event" &&
      record.data.idempotencyKey === data.idempotencyKey &&
      record.subject.companyKey === subject.companyKey && record.subject.locationKey === subject.locationKey);
    if (existing && existing.data.kind === "inventory-fulfillment-event" &&
        canonicalJson(existing.data) === canonicalJson(data)) return existing;
    if (existing) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["fulfillment stage quantity or order is invalid"]);
  }
  if (Number(result[1]?.meta?.changes || 0) !== 1) throw new Error("RESOURCE_AUDIT_NOT_WRITTEN");
  return Object.freeze({ id, resourceType: "inventory-fulfillment-event", state: "recorded", revision: 1,
    createdBy: principal.id, subject: recordSubject, data }) as ResourceRecord<InventoryProcurementData>;
}

export async function createInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  data: InventoryProcurementData,
) {
  if (kind === "inventory-allocation") {
    throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED", ["atomic-allocation-required"]);
  }
  const permission = INVENTORY_PROCUREMENT_DEFINITIONS[kind].permissions.create;
  if (!permission) throw new ResourceWorkflowError("PERMISSION_NOT_CONFIGURED");
  const id = crypto.randomUUID();
  const subject = inventoryProcurementSubject(principal, kind, id);
  const decision = authorize(principal, {
    channel: "api",
    action: "create",
    permission,
    subject,
  });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
  if (!isValidInventoryProcurementData(data, kind)) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["inventory record is invalid"]);
  }
  if (kind === "inventory-fulfillment-event" && data.kind === "inventory-fulfillment-event") {
    const existing = (await rows(db, "inventory-fulfillment-event")).find((record) =>
      record.data.kind === "inventory-fulfillment-event" &&
      record.data.idempotencyKey === data.idempotencyKey &&
      record.subject.companyKey === subject.companyKey && record.subject.locationKey === subject.locationKey);
    if (existing) {
      if (canonicalJson(existing.data) !== canonicalJson(data)) {
        throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      }
      return existing;
    }
  }
  if (kind === "stock-movement" && data.kind === "stock-movement" && data.receiptIdempotencyKey !== undefined) {
    const existing = (await rows(db, "stock-movement")).find((record) =>
      record.data.kind === "stock-movement" && record.data.receiptIdempotencyKey === data.receiptIdempotencyKey &&
      record.subject.companyKey === subject.companyKey && record.subject.locationKey === subject.locationKey);
    if (existing) {
      if (canonicalJson(existing.data) !== canonicalJson(data)) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      return existing;
    }
  }
  if (kind === "stock-movement" && data.kind === "stock-movement" && data.eggBatchId !== undefined) {
    const batch = await getFarmOperation(db, principal, "egg-batch", data.eggBatchId);
    if (!batch || batch.state !== "verified") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  if (kind === "inventory-fulfillment-event" && data.kind === "inventory-fulfillment-event") {
    const allocation = await getInventoryProcurement(db, principal, "inventory-allocation", data.inventoryAllocationId);
    if (!allocation || allocation.state !== "reserved" || allocation.data.kind !== "inventory-allocation" || allocation.data.salesOrderId !== data.salesOrderId || allocation.data.inventoryItemId !== data.inventoryItemId || allocation.data.quantity < data.quantity) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const order = await db.prepare("SELECT data_json, state, subject_json FROM resource_records WHERE id = ? AND resource_type = 'sales-order' AND deleted_at IS NULL").bind(data.salesOrderId).first<Record<string, unknown>>();
    if (!order || order.state !== "approved") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const orderData = JSON.parse(String(order.data_json)) as Record<string, unknown>;
    if (orderData.customerCode !== data.customerCode || orderData.eggBatchId !== data.eggBatchId) {
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
    if (data.eggBatchId !== undefined) {
      const batch = await getFarmOperation(db, principal, "egg-batch", data.eggBatchId);
      if (!batch || batch.state !== "verified") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
    if (data.eventType === "correction") {
      const original = await getInventoryProcurement(db, principal, "inventory-fulfillment-event", data.correctionOf!);
      if (!original || original.data.kind !== "inventory-fulfillment-event" || original.data.eventType === "correction" ||
          original.data.inventoryAllocationId !== data.inventoryAllocationId) {
        throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
      }
    }
  }
  if (kind === "stock-movement" && data.kind === "stock-movement" && data.inventoryItemId !== undefined) {
    const item = await getInventoryProcurement(db, principal, "inventory-item", data.inventoryItemId);
    if (!item || item.state !== "active" || item.data.kind !== "inventory-item" ||
        item.subject.companyKey !== subject.companyKey || item.subject.locationKey !== subject.locationKey ||
        item.data.itemCode !== data.itemCode || item.data.unit !== data.unit) {
      // Inaccessible, inactive, mismatched and missing items are indistinguishable.
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
  }
  if (kind === "stock-movement" && data.kind === "stock-movement" && data.feedManufacturingBatchId !== undefined) {
    await getFeedManufacturingBatchForReceipt(db, principal, data);
  }
  await requireValidPurchaseRequestReferences(db, principal, data);
  await requireValidPurchaseOrderReferences(db, principal, data);
  await requireValidPurchaseOrderReceiptReference(db, principal, data);
  await requireVisibleEvidence(db, principal, data);
  if (kind === "inventory-fulfillment-event" && data.kind === "inventory-fulfillment-event") {
    try {
      return await recordInventoryFulfillmentEvent(db, principal, id, subject, data);
    } catch (error) {
      if (error instanceof ResourceWorkflowError && error.code === "RESOURCE_EXISTS") {
        const existing = (await rows(db, "inventory-fulfillment-event")).find((record) =>
          record.data.kind === "inventory-fulfillment-event" &&
          record.data.idempotencyKey === data.idempotencyKey &&
          record.subject.companyKey === subject.companyKey && record.subject.locationKey === subject.locationKey);
    if (existing && existing.data.kind === "inventory-fulfillment-event" &&
        canonicalJson(existing.data) === canonicalJson(data)) return existing;
        throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      }
      throw error;
    }
  }
  const repository = new D1ResourceRepository<InventoryProcurementData>(db);
  const service = createInventoryProcurementServices(repository)[kind];
  try {
    return await service.create(principal, { id, subject, data });
  } catch (error) {
    if (kind === "inventory-fulfillment-event" && data.kind === "inventory-fulfillment-event" &&
        ((error instanceof ResourceWorkflowError && error.code === "RESOURCE_EXISTS") ||
          (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)))) {
      const existing = (await rows(db, "inventory-fulfillment-event")).find((record) =>
        record.data.kind === "inventory-fulfillment-event" &&
        record.data.idempotencyKey === data.idempotencyKey &&
        record.subject.companyKey === subject.companyKey && record.subject.locationKey === subject.locationKey);
        if (existing && existing.data.kind === "inventory-fulfillment-event" &&
            canonicalJson(existing.data) === canonicalJson(data)) return existing;
      throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
    }
    throw error;
  }
}

export async function transitionInventoryProcurement(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: InventoryProcurementKind,
  id: string,
  to: string,
  expectedRevision: number,
) {
  if (kind === "stock-movement" && to === "posted") {
    const scopeSubject = inventoryProcurementSubject(principal, kind);
    const collectionDecision = authorize(principal, {
      channel: "api", action: "edit", permission: "inventory.edit", subject: scopeSubject,
    });
    if (!collectionDecision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [collectionDecision.code]);
    const row = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = 'stock-movement' AND deleted_at IS NULL",
    ).bind(id).first<Record<string, unknown>>();
    if (!row) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const current = decode(row, "stock-movement");
    if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const decision = authorize(principal, {
      channel: "api", action: "edit", permission: "inventory.edit", subject: current.subject,
    });
    if (!decision.allowed) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    if (current.revision !== expectedRevision) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
    if (current.state !== "draft" || current.data.kind !== "stock-movement") {
      throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED");
    }

    const movement = current.data;
    await requireValidReceiptLotAllocations(db, current);
    await requireNoFutureRunningBalanceDeficit(db, current);
    if (movement.movementType === "issue") {
      const postedMovements = await rows(db, "stock-movement");
      for (const receipt of postedMovements) {
        if (receipt.state !== "posted" || receipt.data.kind !== "stock-movement" ||
            receipt.data.movementType !== "receipt" || receipt.data.feedManufacturingBatchId !== undefined ||
            receipt.data.inventoryItemId !== movement.inventoryItemId || receipt.data.itemCode !== movement.itemCode ||
            receipt.data.locationKey !== movement.locationKey || receipt.subject.companyKey !== current.subject.companyKey ||
            receipt.subject.locationKey !== current.subject.locationKey) continue;
        if (await receiptHasCanonicalFeedBatchReference(db, receipt)) {
          throw new ResourceWorkflowError("VALIDATION_FAILED", ["issue exceeds available unreserved stock"]);
        }
      }
    }
    const update = db.prepare(`
      WITH
        target AS MATERIALIZED (SELECT * FROM resource_records WHERE id = ?),
        qualified_feed_release_audits AS MATERIALIZED (
  SELECT batch.id AS batch_id, approved_audit.occurred_at AS approved_at
  FROM resource_records batch
  JOIN target ON json_extract(batch.subject_json, '$.companyKey') =
    json_extract(target.subject_json, '$.companyKey')
    AND json_extract(batch.subject_json, '$.locationKey') =
    json_extract(target.subject_json, '$.locationKey')
  JOIN resource_audit_events approved_audit ON approved_audit.resource_id = batch.id
  WHERE batch.resource_type = 'feed-manufacturing-batch'
    AND batch.state = 'released' AND batch.deleted_at IS NULL
    AND approved_audit.resource_type = 'feed-manufacturing-batch'
    AND approved_audit.action = 'approve'
    AND approved_audit.permission = 'manufacturing.edit'
    AND approved_audit.channel = 'api'
    AND approved_audit.actor_id != ''
    AND batch.created_by IS NOT NULL AND batch.created_by != ''
    AND approved_audit.actor_id != batch.created_by
    AND (
      SELECT COUNT(*) FROM resource_audit_events competing
      WHERE competing.resource_id = batch.id
        AND competing.resource_type = 'feed-manufacturing-batch'
        AND competing.action = 'approve'
    ) = 1
    AND json_valid(approved_audit.metadata_json)
    AND json_extract(approved_audit.metadata_json, '$.event') = 'resource.transitioned'
    AND json_extract(approved_audit.metadata_json, '$.from') = 'quality-hold'
    AND json_extract(approved_audit.metadata_json, '$.to') = 'released'
    AND json_extract(approved_audit.metadata_json, '$.state') = 'released'
    AND json_extract(approved_audit.metadata_json, '$.approvalMode') = 'maker-checker'
    AND json_extract(approved_audit.metadata_json, '$.revision') = batch.revision
),
        check_receipt_idempotency AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE         (
          json_extract(data_json, '$.receiptIdempotencyKey') IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM resource_records duplicate_receipt
            WHERE duplicate_receipt.resource_type = 'stock-movement' AND duplicate_receipt.state = 'posted'
              AND duplicate_receipt.deleted_at IS NULL AND duplicate_receipt.id != resource_records.id
              AND json_extract(duplicate_receipt.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
              AND json_extract(duplicate_receipt.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
              AND json_extract(duplicate_receipt.data_json, '$.receiptIdempotencyKey') = json_extract(resource_records.data_json, '$.receiptIdempotencyKey')
          )
        )
),
        check_purchase_order AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE         (
          json_extract(data_json, '$.movementType') != 'receipt'
          OR json_extract(data_json, '$.purchaseOrderId') IS NULL
          OR (
            COALESCE((
              SELECT SUM(CAST(json_extract(receipt.data_json, '$.quantity') AS REAL))
              FROM resource_records receipt
              WHERE receipt.resource_type = 'stock-movement' AND receipt.state = 'posted' AND receipt.deleted_at IS NULL
                AND json_extract(receipt.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(receipt.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(receipt.data_json, '$.movementType') = 'receipt'
                AND json_extract(receipt.data_json, '$.purchaseOrderId') = json_extract(resource_records.data_json, '$.purchaseOrderId')
                AND json_extract(receipt.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                AND json_extract(receipt.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
            ), 0) + CAST(json_extract(data_json, '$.quantity') AS REAL) <= COALESCE((
              SELECT CAST(json_extract(order_record.data_json, '$.quantity') AS REAL)
              FROM resource_records order_record
              WHERE order_record.id = json_extract(resource_records.data_json, '$.purchaseOrderId')
                AND order_record.resource_type = 'purchase-order' AND order_record.deleted_at IS NULL
                AND order_record.state IN ('ordered', 'partially-received', 'received')
                AND json_extract(order_record.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(order_record.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(order_record.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                AND json_extract(order_record.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
            ), -1)
          )
        )
),
        check_feed_lot AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE         (
          json_extract(data_json, '$.movementType') != 'receipt'
          OR json_extract(data_json, '$.feedManufacturingBatchId') IS NULL
          OR EXISTS (
            SELECT 1
            FROM resource_records feed_batch
            WHERE feed_batch.id = json_extract(resource_records.data_json, '$.feedManufacturingBatchId')
              AND feed_batch.resource_type = 'feed-manufacturing-batch'
              AND feed_batch.state IN ('quality-hold', 'released')
              AND feed_batch.deleted_at IS NULL
              AND json_extract(feed_batch.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
              AND json_extract(feed_batch.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
              AND json_extract(feed_batch.data_json, '$.finishedFeedItemCode') = json_extract(resource_records.data_json, '$.itemCode')
              AND (json_extract(feed_batch.data_json, '$.finishedFeedLotId') IS NULL
                OR json_extract(feed_batch.data_json, '$.finishedFeedLotId') = resource_records.id)
              AND COALESCE((
                SELECT SUM(CAST(json_extract(existing_receipt.data_json, '$.quantity') AS REAL))
                FROM resource_records existing_receipt
                WHERE existing_receipt.resource_type = 'stock-movement'
                  AND existing_receipt.state = 'posted'
                  AND existing_receipt.deleted_at IS NULL
                  AND json_extract(existing_receipt.data_json, '$.movementType') = 'receipt'
                  AND json_extract(existing_receipt.data_json, '$.feedManufacturingBatchId') = feed_batch.id
                  AND json_extract(existing_receipt.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                  AND json_extract(existing_receipt.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
              ), 0) + CAST(json_extract(resource_records.data_json, '$.quantity') AS REAL)
                <= CAST(json_extract(feed_batch.data_json, '$.outputQuantityKg') AS REAL)
          )
        )
),
        check_eligible_receipt_lots AS MATERIALIZED (
  SELECT receipt.id
  FROM target AS resource_records
  JOIN resource_records receipt ON 1=1
  WHERE receipt.resource_type = 'stock-movement' AND receipt.state = 'posted' AND receipt.deleted_at IS NULL
                  AND json_extract(receipt.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                  AND json_extract(receipt.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                  AND json_extract(receipt.data_json, '$.movementType') = 'receipt'
                  AND json_extract(receipt.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
                  AND json_extract(receipt.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                  AND json_extract(receipt.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                  AND json_extract(receipt.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                  AND julianday(json_extract(receipt.data_json, '$.occurredAt')) <= julianday(json_extract(resource_records.data_json, '$.occurredAt'))
                  AND (
                    (json_extract(receipt.data_json, '$.feedManufacturingBatchId') IS NULL AND NOT EXISTS (
                      SELECT 1 FROM resource_records linked_batch
                      WHERE linked_batch.resource_type = 'feed-manufacturing-batch' AND linked_batch.deleted_at IS NULL
                        AND json_extract(linked_batch.subject_json, '$.companyKey') = json_extract(receipt.subject_json, '$.companyKey')
                        AND json_extract(linked_batch.subject_json, '$.locationKey') = json_extract(receipt.subject_json, '$.locationKey')
                        AND json_extract(linked_batch.data_json, '$.finishedFeedLotId') = receipt.id
                    ))
                    OR EXISTS (
                      SELECT 1 FROM resource_records feed_batch
                      WHERE feed_batch.id = json_extract(receipt.data_json, '$.feedManufacturingBatchId')
                        AND feed_batch.resource_type = 'feed-manufacturing-batch' AND feed_batch.state = 'released'
                    AND ${releaseAuditFromMaterializedEvidenceSql("feed_batch", "json_extract(resource_records.data_json, '$.occurredAt')")}
                        AND feed_batch.deleted_at IS NULL
                        AND json_extract(feed_batch.subject_json, '$.companyKey') = json_extract(receipt.subject_json, '$.companyKey')
                        AND json_extract(feed_batch.subject_json, '$.locationKey') = json_extract(receipt.subject_json, '$.locationKey')
                        AND json_extract(feed_batch.data_json, '$.finishedFeedItemCode') = json_extract(receipt.data_json, '$.itemCode')
                        AND json_extract(feed_batch.data_json, '$.finishedFeedLotId') = receipt.id
                    )
                  )
),
        check_receipt_lot_source AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE json_extract(data_json, '$.movementType') != 'issue' OR json_type(json_extract(data_json, '$.receiptLotAllocations')) IS NULL OR NOT EXISTS (
              SELECT 1
              FROM json_each(json_extract(resource_records.data_json, '$.receiptLotAllocations')) allocation
              WHERE NOT EXISTS (SELECT 1 FROM check_eligible_receipt_lots good_receipt WHERE good_receipt.id = json_extract(allocation.value, '$.receiptLotId'))
            )
),
        check_receipt_lot_capacity AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE json_extract(data_json, '$.movementType') != 'issue' OR json_type(json_extract(data_json, '$.receiptLotAllocations')) IS NULL OR NOT EXISTS (
              SELECT 1
              FROM json_each(json_extract(resource_records.data_json, '$.receiptLotAllocations')) allocation
              JOIN resource_records receipt ON receipt.id = json_extract(allocation.value, '$.receiptLotId')
                AND receipt.resource_type = 'stock-movement' AND receipt.state = 'posted' AND receipt.deleted_at IS NULL
              WHERE COALESCE((
                SELECT SUM(CAST(json_extract(prior_allocation.value, '$.quantity') AS REAL))
                FROM resource_records prior_issue
                JOIN json_each(json_extract(prior_issue.data_json, '$.receiptLotAllocations')) prior_allocation
                WHERE prior_issue.resource_type = 'stock-movement' AND prior_issue.state = 'posted' AND prior_issue.deleted_at IS NULL
                  AND json_extract(prior_issue.data_json, '$.movementType') = 'issue'
                  AND json_extract(prior_issue.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                  AND json_extract(prior_issue.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                  AND json_extract(prior_issue.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
                  AND json_extract(prior_issue.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                  AND json_extract(prior_issue.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                  AND json_extract(prior_issue.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                  AND json_extract(prior_allocation.value, '$.receiptLotId') = receipt.id
              ), 0) + CAST(json_extract(allocation.value, '$.quantity') AS REAL) > CAST(json_extract(receipt.data_json, '$.quantity') AS REAL)
            )
),
        check_receipt_allocation AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE         (
          json_extract(data_json, '$.movementType') != 'issue'
          OR json_type(json_extract(data_json, '$.receiptLotAllocations')) IS NULL
          OR (
            json_type(json_extract(data_json, '$.receiptLotAllocations')) = 'array'
            AND ABS((SELECT COALESCE(SUM(CAST(json_extract(allocation.value, '$.quantity') AS REAL)), 0)
              FROM json_each(json_extract(resource_records.data_json, '$.receiptLotAllocations')) allocation)
              - CAST(json_extract(data_json, '$.quantity') AS REAL)) <= 0.000000001
          )
        )
),
        check_reservation AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE         (
          json_extract(data_json, '$.movementType') != 'issue'
          OR (
            json_extract(data_json, '$.inventoryItemId') IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM resource_records a
              JOIN resource_records item ON item.id = json_extract(a.data_json, '$.inventoryItemId')
                AND item.resource_type = 'inventory-item' AND item.deleted_at IS NULL
              WHERE a.resource_type = 'inventory-allocation' AND a.state = 'reserved' AND a.deleted_at IS NULL
                AND json_extract(a.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(a.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(a.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                AND json_extract(a.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                AND json_extract(item.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(item.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(item.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                AND json_extract(item.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
            )
          )
          OR (
            json_extract(data_json, '$.inventoryItemId') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM resource_records item
              WHERE item.id = json_extract(resource_records.data_json, '$.inventoryItemId')
                AND item.resource_type = 'inventory-item' AND item.state = 'active' AND item.deleted_at IS NULL
                AND json_extract(item.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(item.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(item.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                AND json_extract(item.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
            )
            AND NOT EXISTS (
              SELECT 1 FROM resource_records legacy
              WHERE legacy.resource_type = 'stock-movement' AND legacy.state = 'posted' AND legacy.deleted_at IS NULL
                AND json_extract(legacy.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(legacy.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(legacy.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                AND json_extract(legacy.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                AND json_extract(legacy.data_json, '$.inventoryItemId') IS NULL
            )
            AND NOT EXISTS (
              SELECT 1 FROM resource_records unclear
              WHERE unclear.resource_type = 'stock-movement' AND unclear.state = 'posted' AND unclear.deleted_at IS NULL
                AND json_extract(unclear.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(unclear.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(unclear.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
                AND json_extract(unclear.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                AND json_extract(unclear.data_json, '$.movementType') IN ('adjustment', 'transfer')
            )
            AND (
              SELECT COALESCE(SUM(CASE json_extract(ledger.data_json, '$.movementType')
                WHEN 'receipt' THEN CAST(json_extract(ledger.data_json, '$.quantity') AS REAL)
                WHEN 'issue' THEN -CAST(json_extract(ledger.data_json, '$.quantity') AS REAL) ELSE 0 END), 0)
              FROM resource_records ledger
              WHERE ledger.resource_type = 'stock-movement' AND ledger.state = 'posted' AND ledger.deleted_at IS NULL
                AND json_extract(ledger.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(ledger.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(ledger.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
                AND json_extract(ledger.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                AND json_extract(ledger.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                AND json_extract(ledger.data_json, '$.movementType') IN ('receipt', 'issue')
                AND julianday(json_extract(ledger.data_json, '$.occurredAt')) <= julianday(json_extract(resource_records.data_json, '$.occurredAt'))
                AND (json_extract(ledger.data_json, '$.feedManufacturingBatchId') IS NULL OR EXISTS (
                  SELECT 1 FROM resource_records feed_batch
                  WHERE feed_batch.id = json_extract(ledger.data_json, '$.feedManufacturingBatchId')
                    AND feed_batch.resource_type = 'feed-manufacturing-batch' AND feed_batch.state = 'released'
                    AND ${releaseAuditFromMaterializedEvidenceSql("feed_batch", "json_extract(resource_records.data_json, '$.occurredAt')")}
                    AND feed_batch.deleted_at IS NULL
                    AND json_extract(feed_batch.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                    AND json_extract(feed_batch.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                    AND json_extract(feed_batch.data_json, '$.finishedFeedItemCode') = json_extract(resource_records.data_json, '$.itemCode')
                    AND json_extract(feed_batch.data_json, '$.finishedFeedLotId') = ledger.id
                )) AND NOT EXISTS (
                  SELECT 1 FROM resource_records feed_batch_reference
                  WHERE json_extract(ledger.data_json, '$.feedManufacturingBatchId') IS NULL
                    AND feed_batch_reference.resource_type = 'feed-manufacturing-batch'
                    AND feed_batch_reference.deleted_at IS NULL
                    AND json_extract(feed_batch_reference.subject_json, '$.companyKey') = json_extract(ledger.subject_json, '$.companyKey')
                    AND json_extract(feed_batch_reference.subject_json, '$.locationKey') = json_extract(ledger.subject_json, '$.locationKey')
                    AND json_extract(feed_batch_reference.data_json, '$.finishedFeedLotId') = ledger.id
                )) - COALESCE((
              SELECT SUM(CAST(json_extract(a.data_json, '$.quantity') AS REAL))
              FROM resource_records a
              WHERE a.resource_type = 'inventory-allocation' AND a.state = 'reserved' AND a.deleted_at IS NULL
                AND json_extract(a.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(a.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(a.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
                AND json_extract(a.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                AND json_extract(a.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
             ), 0) >= CAST(json_extract(data_json, '$.quantity') AS REAL)
           )
         )
),
        -- A backdated issue must also leave enough stock in the current ledger
        -- for reservations that committed after its preflight reads. The
        -- allocation path uses this same current-ledger eligibility rule.
        check_current_reservation_balance AS MATERIALIZED (
          SELECT 1 FROM target AS resource_records
          WHERE json_extract(data_json, '$.movementType') != 'issue'
            OR json_extract(data_json, '$.inventoryItemId') IS NULL
            OR (
              SELECT COALESCE(SUM(CASE json_extract(ledger.data_json, '$.movementType')
                WHEN 'receipt' THEN CAST(json_extract(ledger.data_json, '$.quantity') AS REAL)
                WHEN 'issue' THEN -CAST(json_extract(ledger.data_json, '$.quantity') AS REAL) ELSE 0 END), 0)
              FROM resource_records ledger
              WHERE ledger.resource_type = 'stock-movement' AND ledger.state = 'posted' AND ledger.deleted_at IS NULL
                AND json_extract(ledger.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(ledger.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(ledger.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
                AND json_extract(ledger.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                AND json_extract(ledger.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                AND json_extract(ledger.data_json, '$.movementType') IN ('receipt', 'issue')
                AND (json_extract(ledger.data_json, '$.feedManufacturingBatchId') IS NULL OR EXISTS (
                  SELECT 1 FROM resource_records feed_batch
                  WHERE feed_batch.id = json_extract(ledger.data_json, '$.feedManufacturingBatchId')
                    AND feed_batch.resource_type = 'feed-manufacturing-batch' AND feed_batch.state = 'released'
                    AND ${releaseAuditFromMaterializedEvidenceSql("feed_batch", "strftime('%Y-%m-%dT%H:%M:%fZ','now')")}
                    AND feed_batch.deleted_at IS NULL
                    AND json_extract(feed_batch.subject_json, '$.companyKey') = json_extract(ledger.subject_json, '$.companyKey')
                    AND json_extract(feed_batch.subject_json, '$.locationKey') = json_extract(ledger.subject_json, '$.locationKey')
                    AND json_extract(feed_batch.data_json, '$.finishedFeedItemCode') = json_extract(ledger.data_json, '$.itemCode')
                    AND json_extract(feed_batch.data_json, '$.finishedFeedLotId') = ledger.id
                )) AND NOT EXISTS (
                  SELECT 1 FROM resource_records feed_batch_reference
                  WHERE json_extract(ledger.data_json, '$.feedManufacturingBatchId') IS NULL
                    AND feed_batch_reference.resource_type = 'feed-manufacturing-batch'
                    AND feed_batch_reference.deleted_at IS NULL
                    AND json_extract(feed_batch_reference.subject_json, '$.companyKey') = json_extract(ledger.subject_json, '$.companyKey')
                    AND json_extract(feed_batch_reference.subject_json, '$.locationKey') = json_extract(ledger.subject_json, '$.locationKey')
                    AND json_extract(feed_batch_reference.data_json, '$.finishedFeedLotId') = ledger.id
                )
            ) - COALESCE((
              SELECT SUM(CAST(json_extract(a.data_json, '$.quantity') AS REAL))
              FROM resource_records a
              WHERE a.resource_type = 'inventory-allocation' AND a.state = 'reserved' AND a.deleted_at IS NULL
                AND json_extract(a.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                AND json_extract(a.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                AND json_extract(a.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
                AND json_extract(a.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
            ), 0) >= CAST(json_extract(data_json, '$.quantity') AS REAL)
        ),
        check_historical_item_future_deficits AS MATERIALIZED (
  SELECT checkpoint.id AS checkpoint_id
  FROM target AS resource_records
  JOIN resource_records checkpoint ON checkpoint.resource_type = 'stock-movement' AND checkpoint.state = 'posted' AND checkpoint.deleted_at IS NULL
               AND json_extract(checkpoint.data_json, '$.movementType') = 'issue'
               AND json_extract(checkpoint.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
               AND json_extract(checkpoint.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
               AND json_extract(checkpoint.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId')
               AND json_extract(checkpoint.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
               AND json_extract(checkpoint.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
               AND json_extract(checkpoint.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
               AND julianday(json_extract(checkpoint.data_json, '$.occurredAt')) >= julianday(json_extract(resource_records.data_json, '$.occurredAt'))
  WHERE (
                 SELECT COALESCE(SUM(CASE json_extract(ledger.data_json, '$.movementType')
                   WHEN 'receipt' THEN CAST(json_extract(ledger.data_json, '$.quantity') AS REAL)
                   WHEN 'issue' THEN -CAST(json_extract(ledger.data_json, '$.quantity') AS REAL) ELSE 0 END), 0)
                 FROM resource_records ledger
                 WHERE (((ledger.resource_type = 'stock-movement' AND ledger.state = 'posted') AND (ledger.deleted_at IS NULL AND (json_extract(ledger.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey') AND json_extract(ledger.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')))) AND ((json_extract(ledger.data_json, '$.inventoryItemId') = json_extract(resource_records.data_json, '$.inventoryItemId') AND (json_extract(ledger.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode') AND json_extract(ledger.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey'))) AND (json_extract(ledger.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit') AND (json_extract(ledger.data_json, '$.movementType') IN ('receipt', 'issue') AND julianday(json_extract(ledger.data_json, '$.occurredAt')) <= julianday(json_extract(checkpoint.data_json, '$.occurredAt'))))))
                                  AND (
                 json_extract(ledger.data_json, '$.movementType') = 'issue'
                 OR (
                   json_extract(ledger.data_json, '$.feedManufacturingBatchId') IS NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM resource_records unlinked_batch
                     WHERE unlinked_batch.resource_type = 'feed-manufacturing-batch'
                       AND unlinked_batch.deleted_at IS NULL
                       AND json_extract(unlinked_batch.subject_json, '$.companyKey') = json_extract(ledger.subject_json, '$.companyKey')
                       AND json_extract(unlinked_batch.subject_json, '$.locationKey') = json_extract(ledger.subject_json, '$.locationKey')
                       AND json_extract(unlinked_batch.data_json, '$.finishedFeedLotId') = ledger.id
                   )
                 )
                 OR EXISTS (
                   SELECT 1 FROM resource_records approved_batch
                   WHERE (((approved_batch.id = json_extract(ledger.data_json, '$.feedManufacturingBatchId') AND (approved_batch.resource_type = 'feed-manufacturing-batch' AND approved_batch.state = 'released')) AND (approved_batch.deleted_at IS NULL AND (${releaseAuditFromMaterializedEvidenceSql("approved_batch", "json_extract(checkpoint.data_json, '$.occurredAt')")} AND json_extract(approved_batch.data_json, '$.kind') = 'feed-manufacturing-batch'))) AND ((json_extract(approved_batch.subject_json, '$.companyKey') = json_extract(ledger.subject_json, '$.companyKey') AND (json_extract(approved_batch.subject_json, '$.locationKey') = json_extract(ledger.subject_json, '$.locationKey') AND json_extract(approved_batch.data_json, '$.finishedFeedLotId') = ledger.id)) AND ((json_extract(approved_batch.data_json, '$.finishedFeedItemCode') = json_extract(ledger.data_json, '$.itemCode') AND json_extract(ledger.data_json, '$.unit') = 'kg') AND (json_type(approved_batch.data_json, '$.outputQuantityKg') IN ('integer', 'real') AND CAST(json_extract(approved_batch.data_json, '$.outputQuantityKg') AS REAL) >= CAST(json_extract(ledger.data_json, '$.quantity') AS REAL))))))
               )
               ) - CAST(json_extract(resource_records.data_json, '$.quantity') AS REAL) < -0.000000001
),
        check_historical_legacy AS MATERIALIZED (
  SELECT 1 FROM target AS resource_records WHERE          (
           json_extract(data_json, '$.movementType') != 'issue'
           OR json_extract(data_json, '$.inventoryItemId') IS NOT NULL
           OR (
             (
               SELECT COALESCE(SUM(CASE json_extract(ledger.data_json, '$.movementType')
                 WHEN 'receipt' THEN CAST(json_extract(ledger.data_json, '$.quantity') AS REAL)
                 WHEN 'issue' THEN -CAST(json_extract(ledger.data_json, '$.quantity') AS REAL) ELSE 0 END), 0)
               FROM resource_records ledger
               WHERE ledger.resource_type = 'stock-movement' AND ledger.state = 'posted' AND ledger.deleted_at IS NULL
                 AND json_extract(ledger.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                 AND json_extract(ledger.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                 AND json_extract(ledger.data_json, '$.inventoryItemId') IS NULL
                 AND json_extract(ledger.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                 AND json_extract(ledger.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                 AND json_extract(ledger.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                 AND json_extract(ledger.data_json, '$.movementType') IN ('receipt', 'issue')
                 AND julianday(json_extract(ledger.data_json, '$.occurredAt')) <= julianday(json_extract(resource_records.data_json, '$.occurredAt'))
             ) - CAST(json_extract(data_json, '$.quantity') AS REAL) >= -0.000000001
             AND NOT EXISTS (
               SELECT 1
               FROM resource_records checkpoint
               WHERE checkpoint.resource_type = 'stock-movement' AND checkpoint.state = 'posted' AND checkpoint.deleted_at IS NULL
                 AND json_extract(checkpoint.data_json, '$.movementType') = 'issue'
                 AND json_extract(checkpoint.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                 AND json_extract(checkpoint.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                 AND json_extract(checkpoint.data_json, '$.inventoryItemId') IS NULL
                 AND json_extract(checkpoint.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                 AND json_extract(checkpoint.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                 AND json_extract(checkpoint.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                 AND julianday(json_extract(checkpoint.data_json, '$.occurredAt')) >= julianday(json_extract(resource_records.data_json, '$.occurredAt'))
                 AND (
                   SELECT COALESCE(SUM(CASE json_extract(ledger.data_json, '$.movementType')
                     WHEN 'receipt' THEN CAST(json_extract(ledger.data_json, '$.quantity') AS REAL)
                     WHEN 'issue' THEN -CAST(json_extract(ledger.data_json, '$.quantity') AS REAL) ELSE 0 END), 0)
                   FROM resource_records ledger
                   WHERE ledger.resource_type = 'stock-movement' AND ledger.state = 'posted' AND ledger.deleted_at IS NULL
                     AND json_extract(ledger.subject_json, '$.companyKey') = json_extract(resource_records.subject_json, '$.companyKey')
                     AND json_extract(ledger.subject_json, '$.locationKey') = json_extract(resource_records.subject_json, '$.locationKey')
                     AND json_extract(ledger.data_json, '$.inventoryItemId') IS NULL
                     AND json_extract(ledger.data_json, '$.itemCode') = json_extract(resource_records.data_json, '$.itemCode')
                     AND json_extract(ledger.data_json, '$.locationKey') = json_extract(resource_records.data_json, '$.locationKey')
                     AND json_extract(ledger.data_json, '$.unit') = json_extract(resource_records.data_json, '$.unit')
                     AND json_extract(ledger.data_json, '$.movementType') IN ('receipt', 'issue')
                     AND julianday(json_extract(ledger.data_json, '$.occurredAt')) <= julianday(json_extract(checkpoint.data_json, '$.occurredAt'))
                 ) - CAST(json_extract(data_json, '$.quantity') AS REAL) >= -0.000000001
             )
           )
         )
)
      UPDATE resource_records SET state = 'posted', revision = revision + 1, updated_at = ?
      WHERE id = ? AND resource_type = 'stock-movement' AND state = 'draft' AND revision = ? AND deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM check_receipt_idempotency)
        AND EXISTS (SELECT 1 FROM check_purchase_order)
        AND EXISTS (SELECT 1 FROM check_feed_lot)
        AND EXISTS (SELECT 1 FROM check_receipt_lot_source)
        AND EXISTS (SELECT 1 FROM check_receipt_lot_capacity)
        AND EXISTS (SELECT 1 FROM check_receipt_allocation)
        AND EXISTS (SELECT 1 FROM check_reservation)
        AND EXISTS (SELECT 1 FROM check_current_reservation_balance)
        AND (json_extract(data_json, '$.movementType') != 'issue' OR NOT EXISTS (SELECT 1 FROM check_historical_item_future_deficits))
        AND EXISTS (SELECT 1 FROM check_historical_legacy)
    `).bind(id, new Date().toISOString(), id, expectedRevision);
    const audit = createSecurityAuditEvent(principal, {
      channel: "api", action: "edit", permission: "inventory.edit", subject: current.subject,
    }, { event: "inventory.stock-movement.posted", revision: expectedRevision + 1,
      movementType: movement.movementType, quantity: movement.quantity, unit: movement.unit });
    const auditInsert = db.prepare(`
      INSERT INTO resource_audit_events
        (id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE changes() = 1
         AND EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND state = 'posted' AND revision = ? AND deleted_at IS NULL)
    `).bind(crypto.randomUUID(), audit.resourceId, audit.resourceType, audit.actorId, audit.action,
      audit.permission, audit.channel, audit.occurredAt, JSON.stringify(audit.metadata), id, expectedRevision + 1);
    const result = await db.batch([update, auditInsert]);
    if (Number(result[0]?.meta?.changes || 0) !== 1) {
      const latest = await db.prepare(
        "SELECT revision, state FROM resource_records WHERE id = ? AND resource_type = 'stock-movement' AND deleted_at IS NULL",
      ).bind(id).first<{ revision: number; state: string }>();
      if (!latest) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
      if (latest.revision !== expectedRevision || latest.state !== "draft") {
        throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      }
      throw new ResourceWorkflowError("VALIDATION_FAILED", [movement.movementType === "receipt"
        ? "Receipt could not be posted. Check the receipt and its source details, then try again."
        : "issue exceeds available unreserved stock"]);
    }
    if (Number(result[1]?.meta?.changes || 0) !== 1) throw new Error("RESOURCE_AUDIT_NOT_WRITTEN");
    return Object.freeze({ ...current, state: "posted", revision: expectedRevision + 1 });
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
  const repository = new D1ResourceRepository<InventoryProcurementData>(db);
  const service = createInventoryProcurementServices(repository)[kind];
  await service.remove(principal, { id, expectedRevision });
  return { ok: true };
}

export function inventoryProcurementError(error: unknown) {
  if (error instanceof StockMovementRemovalHold) {
    return { status: 503, body: { error: error.code } };
  }
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
