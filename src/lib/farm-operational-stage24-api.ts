import { EggCorrectionHold, EGG_CORRECTION_HOLD, holdEggCorrectionWrites } from "./egg-correction-hold.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize } from "./security-authority.ts";
import {
  FARM_OPERATION_DEFINITIONS,
  createFarmOperationalServices,
  isValidFarmOperationData,
  assessFlockClosure,
  reconcileFlockMovementHistory,
  type FarmOperationData,
  type FarmOperationKind,
} from "./farm-operational-stage24-core.ts";
import { D1ResourceRepository } from "./resource-workflow-stage24-d1.ts";
import {
  ResourceWorkflowError,
  type ResourceRecord,
} from "./resource-workflow-stage24.ts";
import { isValidInventoryProcurementData } from "./inventory-procurement-stage24-core.ts";
import {
  FARM_OPERATION_DEFINITIONS as CURRENT_FARM_OPERATION_DEFINITIONS,
  type FarmOperationData as CurrentFarmOperationData,
} from "./farm-operational-core.ts";

export const FARM_OPERATION_API = Object.freeze({
  flock: { view: "inventory.view" },
  "flock-movement": { view: "inventory.view" },
  feed: { view: "farm.feed.view" },
  "feed-formula": { view: "manufacturing.view" },
  "feed-manufacturing-batch": { view: "manufacturing.view" },
  "egg-batch": { view: "farm.eggs.view" },
  "egg-batch-adjustment": { view: "farm.eggs.view" },
  "health-event": { view: "farm.health.view" },
  vaccination: { view: "vaccination.view" },
} as const);

export function operationKind(value: string | undefined): FarmOperationKind | null {
  return value && Object.prototype.hasOwnProperty.call(FARM_OPERATION_API, value)
    ? value as FarmOperationKind
    : null;
}

export function operationViewPermission(kind: FarmOperationKind) {
  return FARM_OPERATION_API[kind].view;
}

/** `farm.view` is the retained pre-inventory permission for Flock reads.
 * Keep it read-only and scope-bound while new principals migrate to
 * `inventory.view`; it never grants create, edit, delete, or transition rights. */
function effectiveViewPermission(principal: AuthenticatedPrincipal, kind: FarmOperationKind) {
  const canonical = operationViewPermission(kind);
  if (principal.permissions.includes(canonical)) return canonical;
  if (kind === "flock" && principal.permissions.includes("farm.view") && principal.permissionScopes["farm.view"])
    return "farm.view";
  return canonical;
}

export function operationSubject(
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  resourceId?: string,
) {
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  return Object.freeze({
    resourceType: FARM_OPERATION_DEFINITIONS[kind].resourceType,
    ...(resourceId ? { resourceId } : {}),
    companyKey: scope.companyKey,
    locationKey: scope.locationKey,
    departmentKey: scope.departmentKey,
  });
}

function authorizeOperationView(
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  resourceId?: string,
) {
  const subject = operationSubject(principal, kind, resourceId);
  const decision = authorize(principal, {
    channel: "api",
    action: "view",
    permission: effectiveViewPermission(principal, kind),
    subject: {
      ...subject,
      ownerId: principal.id,
      assigneeIds: [principal.id],
    },
  });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
}

function decode(row: Record<string, unknown>, kind: FarmOperationKind): ResourceRecord<FarmOperationData> | null {
  const states: Readonly<Record<FarmOperationKind, readonly string[]>> = {
    flock: ["active", "closed"],
    "flock-movement": ["recorded"],
    feed: ["draft", "posted"],
    "feed-formula": ["draft", "approved"],
    "feed-manufacturing-batch": ["draft", "quality-hold", "released"],
    "egg-batch": ["draft", "verified"],
    "egg-batch-adjustment": ["draft", "verified"],
    "health-event": ["open", "resolved"],
    vaccination: ["planned", "administered"],
  };
  if (typeof row.id !== "string" || !row.id.trim() ||
      row.resource_type !== FARM_OPERATION_DEFINITIONS[kind].resourceType ||
      typeof row.state !== "string" || !states[kind].includes(row.state) ||
      typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
      typeof row.subject_json !== "string" || typeof row.data_json !== "string") return null;
  try {
    const subject: unknown = JSON.parse(row.subject_json);
    const data: unknown = JSON.parse(row.data_json);
    if (!subject || typeof subject !== "object" || Array.isArray(subject)) return null;
    const scope = subject as Record<string, unknown>;
    const currentFlockFields = new Set([
      "kind", "flockCode", "name", "species", "breed", "house", "placementDate",
      "source", "sourceKind", "sourceSupplierId", "birdCount",
    ]);
    const currentFlockValid = kind === "flock" && !!data && typeof data === "object" &&
      !Array.isArray(data) && Object.keys(data).every((field) => currentFlockFields.has(field)) &&
      CURRENT_FARM_OPERATION_DEFINITIONS.flock.validate(data as CurrentFarmOperationData).length === 0;
    if (scope.resourceType !== FARM_OPERATION_DEFINITIONS[kind].resourceType || scope.resourceId !== row.id ||
        typeof scope.companyKey !== "string" || !scope.companyKey.trim() ||
        typeof scope.locationKey !== "string" || !scope.locationKey.trim() ||
        typeof scope.departmentKey !== "string" || !scope.departmentKey.trim() ||
        (!isValidFarmOperationData(data, kind) && !currentFlockValid)) return null;
    return Object.freeze({
      id: row.id,
      resourceType: row.resource_type,
      state: row.state,
      revision: row.revision,
      subject,
      data,
    }) as ResourceRecord<FarmOperationData>;
  } catch {
    return null;
  }
}
function visible(principal: AuthenticatedPrincipal, kind: FarmOperationKind, record: ResourceRecord<FarmOperationData>) {
  return authorize(principal, {
    channel: "api",
    action: "view",
    permission: effectiveViewPermission(principal, kind),
    subject: record.subject,
  }).allowed;
}

async function rows(db: D1Database, kind: FarmOperationKind, id?: string) {
  const definition = FARM_OPERATION_DEFINITIONS[kind];
  if (id) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL",
    ).bind(id, definition.resourceType).all<Record<string, unknown>>();
    return (result.results || []).map((row) => decode(row, kind)).filter((record): record is ResourceRecord<FarmOperationData> => record !== null);
  }

  // Walk every page so authorized operators do not silently lose older records.
  // Scope filtering remains server-side in listFarmOperations for every row.
  const records: ResourceRecord<FarmOperationData>[] = [];
  const pageSize = 200;
  let afterId = "";
  for (;;) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL AND id > ? ORDER BY id ASC LIMIT ?",
    ).bind(definition.resourceType, afterId, pageSize).all<Record<string, unknown>>();
    const page = result.results || [];
    records.push(...page.map((row) => decode(row, kind)).filter((record): record is ResourceRecord<FarmOperationData> => record !== null));
    const lastId = page.at(-1)?.id;
    if (typeof lastId === "string") afterId = lastId;
    if (page.length < pageSize) break;
  }
  return records;
}

/**
 * Feed Management owns the flock/consumption context, while Inventory owns
 * the item and quantity movement. A linked feed entry must prove both sides
 * inside the caller's scope before it can be written.
 */
export async function requireFeedLineage(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: Extract<FarmOperationData, { kind: "feed" }>,
) {
  const linked = [data.inventoryItemId, data.stockMovementId, data.flockId, data.flockCode, data.useType, data.occurredAt];
  if (linked.every((value) => value === undefined)) return;
  if (linked.some((value) => value === undefined)) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");

  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const read = async (id: string, resourceType: string) => {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL",
    ).bind(id, resourceType).all<Record<string, unknown>>();
    const row = result.results?.[0];
    if (!row || row.id !== id || row.resource_type !== resourceType || typeof row.subject_json !== "string" || typeof row.data_json !== "string") return null;
    try {
      const subject = JSON.parse(row.subject_json) as Record<string, unknown>;
      const parsed = JSON.parse(row.data_json);
      if (subject.resourceType !== resourceType || subject.resourceId !== id || subject.companyKey !== scope.companyKey || subject.locationKey !== scope.locationKey || subject.departmentKey !== scope.departmentKey) return null;
      if (!authorize(principal, { channel: "api", action: "view", permission: "inventory.view", subject: subject as never }).allowed) return null;
      return { row, subject, data: parsed };
    } catch { return null; }
  };

  const item = await read(data.inventoryItemId!, "inventory-item");
  if (!item || item.row.state !== "active" || !isValidInventoryProcurementData(item.data, "inventory-item") || item.data.kind !== "inventory-item" || item.data.itemCode !== data.itemCode || item.data.unit !== data.unit) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  const movement = await read(data.stockMovementId!, "stock-movement");
  if (!movement || movement.row.state !== "posted" || !isValidInventoryProcurementData(movement.data, "stock-movement") || movement.data.kind !== "stock-movement" || movement.data.movementType !== "issue" || movement.data.inventoryItemId !== data.inventoryItemId || movement.data.itemCode !== data.itemCode || movement.data.unit !== data.unit || movement.data.quantity < data.quantity) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  const flock = await getFarmOperation(db, principal, "flock", data.flockId!);
  if (!flock || flock.state !== "active" || flock.data.kind !== "flock" || flock.data.flockCode !== data.flockCode) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
}

/** Health records may retain legacy flock-code-only history, but any new
 * canonical flock link must resolve to the same scoped, active flock. This
 * keeps the longitudinal health workspace tied to the one flock authority
 * without leaking whether a foreign flock exists. */
export async function requireHealthFlockLineage(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  data: Extract<FarmOperationData, { kind: "health-event" }>,
) {
  if (data.flockId === undefined) return;
  const flock = await getFarmOperation(db, principal, "flock", data.flockId);
  if (!flock || flock.state !== "active" || flock.data.kind !== "flock" || flock.data.flockCode !== data.flockCode) {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
}

async function readScopedInventoryItem(db: D1Database, principal: AuthenticatedPrincipal, id: string) {
  const scope = principal.organizationScope;
  if (!scope) return null;
  const result = await db.prepare("SELECT id, resource_type, state, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = 'inventory-item' AND deleted_at IS NULL").bind(id).all<Record<string, unknown>>();
  const row = result.results?.[0];
  if (!row || row.id !== id || typeof row.subject_json !== "string" || typeof row.data_json !== "string") return null;
  try {
    const subject = JSON.parse(row.subject_json) as Record<string, unknown>;
    const data = JSON.parse(row.data_json);
    if (subject.resourceType !== "inventory-item" || subject.resourceId !== id || subject.companyKey !== scope.companyKey || subject.locationKey !== scope.locationKey || subject.departmentKey !== scope.departmentKey ||
        !authorize(principal, { channel: "api", action: "view", permission: "inventory.view", subject: subject as never }).allowed || !isValidInventoryProcurementData(data, "inventory-item")) return null;
    return { row, data };
  } catch { return null; }
}

export async function requireMedicineLineage(db: D1Database, principal: AuthenticatedPrincipal, itemId: string, eventTime: string, categories: readonly ("veterinary-medicine" | "vaccine")[]) {
  const item = await readScopedInventoryItem(db, principal, itemId);
  if (!item || item.row.state !== "active" || item.data.kind !== "inventory-item" || (item.data.itemCategory !== "veterinary-medicine" && item.data.itemCategory !== "vaccine") || !categories.includes(item.data.itemCategory) || (item.data.expiryDate !== undefined && Date.parse(item.data.expiryDate) < Date.parse(eventTime))) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
}

export async function listFarmOperations(db: D1Database, principal: AuthenticatedPrincipal, kind: FarmOperationKind) {
  authorizeOperationView(principal, kind);
  const records = await rows(db, kind);
  return records.filter((record) => visible(principal, kind, record));
}

export type FarmOperationPage = Readonly<{
  items: readonly ResourceRecord<FarmOperationData>[];
  nextCursor: string | null;
}>;

function farmOperationSearchText(record: ResourceRecord<FarmOperationData>, kind: FarmOperationKind) {
  const data = record.data as Record<string, unknown>;
  const subject = record.subject as Record<string, unknown>;
  const byKind: Readonly<Record<FarmOperationKind, readonly unknown[]>> = {
    flock: [data.flockCode, data.species],
    "flock-movement": [data.flockCode, data.movementType, data.occurredAt],
    feed: [data.itemCode, data.unit],
    "egg-batch": [data.flockCode, data.collectedAt],
    "egg-batch-adjustment": [data.batchId, data.reason, data.recordedAt],
    "health-event": [data.flockCode, data.eventType, data.observedAt],
    vaccination: [data.flockCode, data.vaccineCode, data.administeredAt],
    "feed-formula": [data.formulaCode, data.finishedFeedItemCode, data.version],
    "feed-manufacturing-batch": [data.batchCode, data.formulaId, data.finishedFeedItemCode, data.producedAt],
  };
  return [record.id, record.state, subject.locationKey, ...byKind[kind]]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("en-US");
}

function validFarmSearch(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 && !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Bounded keyset page; continuation tokens are based only on visible rows. */
export async function listFarmOperationsPage(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  options: Readonly<{ cursor?: string; limit?: number; search?: string }> = {},
): Promise<FarmOperationPage> {
  const limit = options.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      (options.cursor !== undefined && (typeof options.cursor !== "string" || options.cursor.length > 120)) ||
      (options.search !== undefined && (!validFarmSearch(options.search) || !options.search.trim()))) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["pagination options are invalid"]);
  }
  authorizeOperationView(principal, kind);
  const search = options.search?.trim().toLocaleLowerCase("en-US");
  const records: ResourceRecord<FarmOperationData>[] = [];
  const pageSize = 200;
  let afterId = options.cursor ?? "";
  let hasMore = false;
  while (!hasMore) {
    const result = await db.prepare(
      "SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL AND id > ? ORDER BY id ASC LIMIT ?",
    ).bind(FARM_OPERATION_DEFINITIONS[kind].resourceType, afterId, pageSize).all<Record<string, unknown>>();
    const page = result.results || [];
    for (const row of page) {
      if (typeof row.id === "string") afterId = row.id;
      const record = decode(row, kind);
      if (record && visible(principal, kind, record) &&
          (!search || farmOperationSearchText(record, kind).includes(search))) records.push(record);
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

export async function getFarmOperation(db: D1Database, principal: AuthenticatedPrincipal, kind: FarmOperationKind, id: string) {
  try {
    authorizeOperationView(principal, kind, id);
  } catch (error) {
    if (error instanceof ResourceWorkflowError && error.code === "AUTHORIZATION_DENIED") return null;
    throw error;
  }
  const record = (await rows(db, kind, id))[0] || null;
  return record && visible(principal, kind, record) ? record : null;
}

export async function createFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  data: FarmOperationData,
) {
  holdEggCorrectionWrites(kind);
  if (kind === "feed-manufacturing-batch" && data.kind === "feed-manufacturing-batch") {
    const formula = await getFarmOperation(db, principal, "feed-formula", data.formulaId);
    if (!formula || formula.data.kind !== "feed-formula" || formula.state !== "approved" || formula.data.version !== data.formulaVersion || formula.data.finishedFeedItemCode !== data.finishedFeedItemCode) {
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
  }
  if (kind === "feed" && data.kind === "feed") await requireFeedLineage(db, principal, data);
  if (kind === "health-event" && data.kind === "health-event") await requireHealthFlockLineage(db, principal, data);
  if (kind === "health-event" && data.kind === "health-event" && data.medicineInventoryItemId) await requireMedicineLineage(db, principal, data.medicineInventoryItemId, data.observedAt, ["veterinary-medicine", "vaccine"]);
  if (kind === "vaccination" && data.kind === "vaccination" && data.flockId !== undefined) {
    const flock = await getFarmOperation(db, principal, "flock", data.flockId);
    if (!flock || flock.state !== "active" || flock.data.kind !== "flock" || flock.data.flockCode !== data.flockCode) {
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
  }
  if (kind === "vaccination" && data.kind === "vaccination" && data.medicineInventoryItemId) await requireMedicineLineage(db, principal, data.medicineInventoryItemId, data.administeredAt ?? new Date().toISOString(), ["vaccine", "veterinary-medicine"]);
  if (kind === "egg-batch" && data.kind === "egg-batch" && data.flockId !== undefined) {
    const flock = await getFarmOperation(db, principal, "flock", data.flockId);
    if (!flock || flock.data.kind !== "flock" || flock.data.flockCode !== data.flockCode)
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  if (kind === "egg-batch-adjustment" && data.kind === "egg-batch-adjustment") {
    const batch = await getFarmOperation(db, principal, "egg-batch", data.batchId);
    if (!batch || batch.state !== "verified") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const adjustments = await listFarmOperations(db, principal, "egg-batch-adjustment");
    const priorDelta = adjustments
      .filter((record) => record.state === "verified" && record.data.kind === "egg-batch-adjustment" && record.data.batchId === data.batchId)
      .reduce((total, record) => total + (record.data.kind === "egg-batch-adjustment" ? record.data.quantityDelta : 0), 0);
    const adjustedQuantity = batch.data.kind === "egg-batch" ? batch.data.quantity + priorDelta + data.quantityDelta : -1;
    if (!Number.isSafeInteger(priorDelta) || !Number.isSafeInteger(adjustedQuantity) || adjustedQuantity < 0) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["adjusted batch quantity is invalid"]);
    }
  }
  if (kind === "health-event" && data.kind === "health-event" &&
      (data.eventType === "mortality" || data.eventType === "cull") && data.flockId && data.quantity !== undefined && data.movementId) {
    const flock = await getFarmOperation(db, principal, "flock", data.flockId);
    const movement = await getFarmOperation(db, principal, "flock-movement", data.movementId);
    const expectedMovementType = data.eventType === "mortality" ? "mortality" : "cull";
    if (!flock || flock.state !== "active" || flock.data.kind !== "flock" || flock.data.flockCode !== data.flockCode ||
        !movement || movement.state !== "recorded" || movement.data.kind !== "flock-movement" ||
        movement.data.flockId !== data.flockId || movement.data.flockCode !== data.flockCode ||
        movement.data.movementType !== expectedMovementType || movement.data.quantity !== data.quantity ||
        movement.data.occurredAt !== data.observedAt) {
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
  }
  if (kind === "flock-movement") {
    const movement = data as Extract<FarmOperationData, { kind: "flock-movement" }>;
    const flock = await getFarmOperation(db, principal, "flock", movement.flockId);
    if (!flock || flock.data.kind !== "flock" || flock.data.flockCode !== movement.flockCode || flock.state !== "active")
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }
  const repository = new D1ResourceRepository<FarmOperationData>(db);
  const service = createFarmOperationalServices(repository)[kind];
  const id = crypto.randomUUID();
  return service.create(principal, {
    id,
    subject: operationSubject(principal, kind, id),
    data,
  });
}

export async function transitionFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  id: string,
  to: string,
  expectedRevision: number,
  closure?: Readonly<{ finalPhysicalCount?: number; ownerOverride?: boolean; reason?: string }>,
) {
  holdEggCorrectionWrites(kind);
  let auditMetadata: Record<string, unknown> | undefined;
  if (kind === "flock" && to === "closed") {
    const flock = await getFarmOperation(db, principal, "flock", id);
    if (!flock || flock.data.kind !== "flock") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const finalPhysicalCount = closure?.finalPhysicalCount;
    if (typeof finalPhysicalCount !== "number" || !Number.isSafeInteger(finalPhysicalCount) || finalPhysicalCount < 0) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["final physical bird count is required"]);
    }
    const movements = (await listFarmOperations(db, principal, "flock-movement"))
      .flatMap((record) => record.data.kind === "flock-movement" && record.data.flockId === id
        ? [{ ...record.data, id: record.id }]
        : []);
    const reconciliation = reconcileFlockMovementHistory(flock.data.birdCount, id, movements, finalPhysicalCount);
    const decision = assessFlockClosure(reconciliation, {
      ownerOverride: closure?.ownerOverride,
      reason: closure?.reason,
    });
    if (!decision.allowed) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["bird records must match the physical count before closure"]);
    }
    if (decision.ownerOverride && (principal.isOwner !== true || principal.accessState !== "owner")) {
      throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["owner-authority-required"]);
    }
    auditMetadata = {
      eventType: "flock.closure-reconciliation",
      calculatedClosing: reconciliation.calculatedClosing,
      finalPhysicalCount: reconciliation.physicalCount,
      birdCountDifference: reconciliation.variance,
      ...(decision.ownerOverride ? {
        ownerOverride: true,
        ownerOverrideReason: decision.reason,
      } : {}),
    };
  }
  if (kind === "egg-batch-adjustment" && to === "verified") {
    const adjustment = await getFarmOperation(db, principal, kind, id);
    if (!adjustment || adjustment.data.kind !== "egg-batch-adjustment") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const batchId = adjustment.data.batchId;
    const batch = await getFarmOperation(db, principal, "egg-batch", batchId);
    if (!batch || batch.state !== "verified" || batch.data.kind !== "egg-batch") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    const priorDelta = (await listFarmOperations(db, principal, kind))
      .filter((record) => record.id !== id && record.state === "verified" && record.data.kind === "egg-batch-adjustment" && record.data.batchId === batchId)
      .reduce((total, record) => total + (record.data.kind === "egg-batch-adjustment" ? record.data.quantityDelta : 0), 0);
    const adjustedQuantity = batch.data.quantity + priorDelta + adjustment.data.quantityDelta;
    if (!Number.isSafeInteger(priorDelta) || !Number.isSafeInteger(adjustedQuantity) || adjustedQuantity < 0) {
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["adjusted batch quantity is invalid"]);
    }
  }
  const repository = new D1ResourceRepository<FarmOperationData>(db);
  const service = createFarmOperationalServices(repository)[kind];
  return service.transition(principal, { id, to, expectedRevision, auditMetadata });
}

export async function updateFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  id: string,
  data: FarmOperationData,
  expectedRevision: number,
) {
  const repository = new D1ResourceRepository<FarmOperationData>(db);
  const service = createFarmOperationalServices(repository)[kind];
  return service.update(principal, {
    id,
    subject: operationSubject(principal, kind, id),
    data,
    expectedRevision,
  });
}

export async function deleteFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  id: string,
  expectedRevision: number,
) {
  const repository = new D1ResourceRepository<FarmOperationData>(db);
  const service = createFarmOperationalServices(repository)[kind];
  await service.remove(principal, { id, expectedRevision });
  return { ok: true };
}

export function operationError(error: unknown) {
  if (error instanceof EggCorrectionHold) return { status: 503, body: EGG_CORRECTION_HOLD };
  if (!(error instanceof ResourceWorkflowError)) return { status: 503, body: { error: "FARM_OPERATION_UNAVAILABLE" } };
  const hidden = new Set(["AUTHORIZATION_DENIED", "RESOURCE_NOT_FOUND", "RESOURCE_TYPE_MISMATCH"]);
  if (hidden.has(error.code)) return { status: 404, body: { error: "NOT_FOUND" } };
  if (error.code === "VALIDATION_FAILED") return { status: 422, body: { error: error.code, details: error.details } };
  if (error.code === "CONCURRENCY_CONFLICT" || error.code === "RESOURCE_EXISTS")
    return { status: 409, body: { error: error.code } };
  if (error.code === "TRANSITION_NOT_ALLOWED" || error.code === "PERMISSION_NOT_CONFIGURED")
    return { status: 422, body: { error: error.code } };
  return { status: 503, body: { error: "FARM_OPERATION_UNAVAILABLE" } };
}
