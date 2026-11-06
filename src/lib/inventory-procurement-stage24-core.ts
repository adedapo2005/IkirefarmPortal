import {
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRepository,
  type ResourceTransition,
} from "./resource-workflow-stage24.ts";

export type StockMovementData = Readonly<{
  kind: "stock-movement";
  /** Canonical item authority; itemCode remains the compatibility/display key. */
  inventoryItemId?: string;
  /** Canonical egg collection identity when this movement handles egg stock. */
  eggBatchId?: string;
  itemCode: string;
  locationKey: string;
  movementType: "receipt" | "issue" | "adjustment" | "transfer";
  /** Stable retry identity for a receipt sourced from a canonical purchase order. */
  receiptIdempotencyKey?: string;
  /** Canonical purchase-order record that explains this receipt. */
  purchaseOrderId?: string;
  /** Canonical feed-manufacturing batch that explains a finished-feed receipt. */
  feedManufacturingBatchId?: string;
  /** Immutable source lots consumed by a posted issue. */
  receiptLotAllocations?: readonly Readonly<{
    receiptLotId: string;
    quantity: number;
  }>[];
  quantity: number;
  unit: "unit" | "kg" | "bag" | "ton" | "litre";
  occurredAt: string;
  sourceReference?: string;
  evidenceIds?: readonly string[];
}>;

export type SupplierData = Readonly<{
  kind: "supplier";
  supplierCode: string;
  name: string;
  status: "active" | "inactive";
  contactEmail?: string;
  evidenceIds?: readonly string[];
}>;

export type InventoryItemData = Readonly<{
  kind: "inventory-item";
  itemCode: string;
  name: string;
  unit: StockMovementData["unit"];
  itemCategory?: "general" | "veterinary-medicine" | "vaccine";
  expiryDate?: string;
  evidenceIds?: readonly string[];
}>;

export type InventoryAllocationData = Readonly<{
  kind: "inventory-allocation";
  salesOrderId: string;
  inventoryItemId: string;
  locationKey: string;
  quantity: number;
  unit: StockMovementData["unit"];
  idempotencyKey: string;
}>;

/** Append-only internal fulfilment lineage. External carrier status is separate provider truth. */
export type InventoryFulfillmentEventData = Readonly<{
  kind: "inventory-fulfillment-event";
  salesOrderId: string;
  inventoryAllocationId: string;
  inventoryItemId: string;
  customerCode: string;
  eventType: "picked" | "packed" | "dispatched" | "delivered" | "returned" | "correction";
  quantity: number;
  occurredAt: string;
  eggBatchId?: string;
  evidenceIds?: readonly string[];
  correctionOf?: string;
  reason?: string;
  idempotencyKey: string;
}>;

export type StockAvailability = Readonly<{
  state: "on-hand-derived" | "reconciliation-required" | "invalid-balance";
  quantity: number | null;
  unit: StockMovementData["unit"];
}>;

/**
 * Derive a conservative balance from posted stock movements. Transfers and
 * adjustments need richer source/destination or adjustment-direction data;
 * until that exists, callers must not treat a partial sum as available stock.
 */
export function deriveStockOnHand(
  movements: readonly Readonly<{ state: string; data: StockMovementData }>[],
  itemCode: string,
  locationKey: string,
  unit: StockMovementData["unit"],
): StockAvailability {
  const matching = movements.filter(({ state, data }) => state === "posted" &&
    data.itemCode === itemCode && data.locationKey === locationKey && data.unit === unit);
  if (matching.some(({ data }) => data.movementType === "adjustment" || data.movementType === "transfer")) {
    return Object.freeze({ state: "reconciliation-required", quantity: null, unit });
  }
  const quantity = matching.reduce((balance, { data }) =>
    balance + (data.movementType === "receipt" ? data.quantity : -data.quantity), 0);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return Object.freeze({ state: "invalid-balance", quantity: null, unit });
  }
  return Object.freeze({ state: "on-hand-derived", quantity, unit });
}

export type PurchaseRequestData = Readonly<{
  kind: "purchase-request";
  requestCode: string;
  itemCode: string;
  quantity: number;
  unit: StockMovementData["unit"];
  requestedAt: string;
  neededBy?: string;
  supplierCode?: string;
  notes?: string;
  evidenceIds?: readonly string[];
}>;

export type PurchaseOrderData = Readonly<{
  kind: "purchase-order";
  orderCode: string;
  requestId: string;
  supplierCode: string;
  itemCode: string;
  quantity: number;
  unit: StockMovementData["unit"];
  currency: string;
  unitPrice: number;
  orderedAt: string;
  evidenceIds?: readonly string[];
}>;

export type InventoryProcurementData =
  | StockMovementData
  | InventoryItemData
  | InventoryAllocationData
  | InventoryFulfillmentEventData
  | SupplierData
  | PurchaseRequestData
  | PurchaseOrderData;

export type InventoryProcurementKind = InventoryProcurementData["kind"];
export type InventoryProcurementService = ResourceWorkflowService<InventoryProcurementData>;
export type InventoryProcurementServices =
  Readonly<Record<InventoryProcurementKind, InventoryProcurementService>>;

const units = ["unit", "kg", "bag", "ton", "litre"] as const;
const movementTypes = ["receipt", "issue", "adjustment", "transfer"] as const;

function bounded(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function validContactEmail(value: string) {
  if (!bounded(value, 320) || /\s/.test(value)) return false;
  const separator = value.indexOf("@");
  if (separator <= 0 || separator !== value.lastIndexOf("@") || separator === value.length - 1) return false;
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  if (local.length > 64 || domain.length > 253) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  return domain.split(".").every((label) =>
    label.length > 0 && label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

function positive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isoDate(value: unknown) {
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
    // ISO 8601 civil offsets are bounded to 14:00. Larger offsets parse in
    // some runtimes despite not representing a valid real-world timezone.
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return true;
}

function evidenceErrors(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return ["evidence ids are invalid"];
  return value.flatMap((id) => bounded(id, 120) ? [] : ["evidence ids are invalid"]);
}

function validateStockMovement(data: InventoryProcurementData) {
  if (data.kind !== "stock-movement") return ["data kind does not match stock movement"];
  const errors: string[] = [];
  if (data.inventoryItemId !== undefined && !bounded(data.inventoryItemId, 120)) errors.push("inventory item reference is invalid");
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (data.eggBatchId !== undefined && !bounded(data.eggBatchId, 120)) errors.push("egg batch reference is invalid");
  if (!bounded(data.locationKey, 120)) errors.push("location is invalid");
  if (!movementTypes.includes(data.movementType)) errors.push("movement type is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!units.includes(data.unit)) errors.push("unit is invalid");
  if (!isoDate(data.occurredAt)) errors.push("movement date is invalid");
  if (data.receiptIdempotencyKey !== undefined &&
      (!bounded(data.receiptIdempotencyKey, 160) || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u.test(data.receiptIdempotencyKey))) {
    errors.push("receipt idempotency key is invalid");
  }
  if (data.purchaseOrderId !== undefined && !bounded(data.purchaseOrderId, 120)) errors.push("purchase order reference is invalid");
  if (data.feedManufacturingBatchId !== undefined && !bounded(data.feedManufacturingBatchId, 120)) errors.push("feed manufacturing batch reference is invalid");
  if (data.movementType !== "receipt" && (data.receiptIdempotencyKey !== undefined || data.purchaseOrderId !== undefined)) {
    errors.push("purchase order receipt references are invalid");
  }
  if (data.receiptIdempotencyKey !== undefined && data.purchaseOrderId === undefined) {
    errors.push("purchase order reference is required for an idempotent receipt");
  }
  if (data.movementType !== "receipt" && data.feedManufacturingBatchId !== undefined) {
    errors.push("feed manufacturing batch reference is invalid");
  }
  if (data.receiptLotAllocations !== undefined) {
    if (data.movementType !== "issue" || !Array.isArray(data.receiptLotAllocations) ||
        data.receiptLotAllocations.length < 1 || data.receiptLotAllocations.length > 100) {
      errors.push("receipt lot allocations are invalid");
    } else {
      const lotIds = new Set<string>();
      let total = 0;
      for (const allocation of data.receiptLotAllocations) {
        if (!allocation || typeof allocation !== "object" ||
            !bounded(allocation.receiptLotId, 120) || lotIds.has(allocation.receiptLotId) ||
            !positive(allocation.quantity)) {
          errors.push("receipt lot allocations are invalid");
          continue;
        }
        lotIds.add(allocation.receiptLotId);
        total += allocation.quantity;
      }
      if (!Number.isFinite(total) || Math.abs(total - data.quantity) > 1e-9) {
        errors.push("receipt lot allocations must equal issue quantity");
      }
    }
  }
  if (data.sourceReference !== undefined && !bounded(data.sourceReference, 160))
    errors.push("source reference is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateSupplier(data: InventoryProcurementData) {
  if (data.kind !== "supplier") return ["data kind does not match supplier"];
  const errors: string[] = [];
  if (!bounded(data.supplierCode, 80)) errors.push("supplier code is invalid");
  if (!bounded(data.name, 160)) errors.push("supplier name is invalid");
  if (!["active", "inactive"].includes(data.status)) errors.push("supplier status is invalid");
  if (data.contactEmail !== undefined && !validContactEmail(data.contactEmail))
    errors.push("supplier contact is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateInventoryItem(data: InventoryProcurementData) {
  if (data.kind !== "inventory-item") return ["data kind does not match inventory item"];
  const errors: string[] = [];
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (!bounded(data.name, 160)) errors.push("item name is invalid");
  if (!units.includes(data.unit)) errors.push("unit is invalid");
  if (data.itemCategory !== undefined && !["general", "veterinary-medicine", "vaccine"].includes(data.itemCategory)) errors.push("item category is invalid");
  if (data.expiryDate !== undefined && !isoDate(data.expiryDate)) errors.push("expiry date is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateInventoryAllocation(data: InventoryProcurementData) {
  if (data.kind !== "inventory-allocation") return ["data kind does not match inventory allocation"];
  const errors: string[] = [];
  if (!bounded(data.salesOrderId, 120)) errors.push("sales order reference is invalid");
  if (!bounded(data.inventoryItemId, 120)) errors.push("inventory item reference is invalid");
  if (!bounded(data.locationKey, 120)) errors.push("location is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!units.includes(data.unit)) errors.push("unit is invalid");
  if (!bounded(data.idempotencyKey, 120) || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u.test(data.idempotencyKey)) {
    errors.push("idempotency key is invalid");
  }
  return errors;
}

function validateInventoryFulfillmentEvent(data: InventoryProcurementData) {
  if (data.kind !== "inventory-fulfillment-event") return ["data kind does not match fulfillment event"];
  const errors: string[] = [];
  if (!bounded(data.salesOrderId, 120) || !bounded(data.inventoryAllocationId, 120) || !bounded(data.inventoryItemId, 120)) errors.push("fulfillment references are invalid");
  if (!bounded(data.customerCode, 80)) errors.push("customer reference is invalid");
  if (!["picked", "packed", "dispatched", "delivered", "returned", "correction"].includes(data.eventType)) errors.push("fulfillment event type is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!isoDate(data.occurredAt)) errors.push("event date is invalid");
  if (data.eggBatchId !== undefined && !bounded(data.eggBatchId, 120)) errors.push("egg batch reference is invalid");
  if (data.correctionOf !== undefined && !bounded(data.correctionOf, 120)) errors.push("correction reference is invalid");
  if (data.reason !== undefined && !bounded(data.reason, 1000)) errors.push("reason is invalid");
  if (!bounded(data.idempotencyKey, 120) || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u.test(data.idempotencyKey)) errors.push("idempotency key is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  if (data.eventType === "correction" && (!data.correctionOf || !data.reason)) errors.push("correction evidence is required");
  return errors;
}

function validatePurchaseRequest(data: InventoryProcurementData) {
  if (data.kind !== "purchase-request") return ["data kind does not match purchase request"];
  const errors: string[] = [];
  if (!bounded(data.requestCode, 80)) errors.push("request code is invalid");
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!units.includes(data.unit)) errors.push("unit is invalid");
  if (!isoDate(data.requestedAt)) errors.push("request date is invalid");
  if (data.neededBy !== undefined && !isoDate(data.neededBy)) errors.push("needed-by date is invalid");
  if (data.supplierCode !== undefined && !bounded(data.supplierCode, 80))
    errors.push("supplier code is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("notes are invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validatePurchaseOrder(data: InventoryProcurementData) {
  if (data.kind !== "purchase-order") return ["data kind does not match purchase order"];
  const errors: string[] = [];
  if (!bounded(data.orderCode, 80)) errors.push("order code is invalid");
  if (!bounded(data.requestId, 120)) errors.push("request id is invalid");
  if (!bounded(data.supplierCode, 80)) errors.push("supplier code is invalid");
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!units.includes(data.unit)) errors.push("unit is invalid");
  if (!/^[A-Z]{3}$/.test(data.currency)) errors.push("currency is invalid");
  if (!nonNegative(data.unitPrice)) errors.push("unit price is invalid");
  if (!isoDate(data.orderedAt)) errors.push("order date is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

const transition = (
  from: string | readonly string[],
  to: string,
  action: ResourceTransition["action"],
  permission: string,
  approvalPermission?: string,
): ResourceTransition => ({ from, to, action, permission, approvalPermission });

export const INVENTORY_PROCUREMENT_DEFINITIONS:
  Readonly<Record<InventoryProcurementKind, ResourceDefinition<InventoryProcurementData>>> = {
  "stock-movement": {
    resourceType: "stock-movement",
    initialState: "draft",
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("draft", "posted", "edit", "inventory.edit"),
      transition("posted", "voided", "edit", "inventory.edit"),
    ],
    validate: validateStockMovement,
  },
  supplier: {
    resourceType: "supplier",
    initialState: "active",
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [transition("active", "inactive", "edit", "inventory.edit")],
    validate: validateSupplier,
  },
  "inventory-item": {
    resourceType: "inventory-item",
    initialState: "active",
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [transition("active", "inactive", "edit", "inventory.edit"), transition("inactive", "active", "edit", "inventory.edit")],
    validate: validateInventoryItem,
  },
  "inventory-allocation": {
    resourceType: "inventory-allocation",
    initialState: "reserved",
    permissions: { create: "inventory.edit", edit: "inventory.edit" },
    transitions: [transition("reserved", "released", "edit", "inventory.edit")],
    validate: validateInventoryAllocation,
  },
  "inventory-fulfillment-event": {
    resourceType: "inventory-fulfillment-event",
    initialState: "recorded",
    permissions: { create: "inventory.edit" },
    transitions: [],
    validate: validateInventoryFulfillmentEvent,
  },
  "purchase-request": {
    resourceType: "purchase-request",
    initialState: "requested",
    requireMakerChecker: true,
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("requested", "reviewed", "edit", "inventory.edit"),
      transition("reviewed", "approved", "approve", "inventory.edit", "procurement.approve"),
      transition("reviewed", "rejected", "edit", "inventory.edit"),
      transition(["requested", "reviewed"], "cancelled", "edit", "inventory.edit"),
    ],
    validate: validatePurchaseRequest,
  },
  "purchase-order": {
    resourceType: "purchase-order",
    initialState: "draft",
    requireMakerChecker: true,
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("draft", "ordered", "approve", "inventory.edit", "procurement.approve"),
      transition("ordered", "partially-received", "edit", "inventory.edit"),
      transition(["ordered", "partially-received"], "received", "edit", "inventory.edit"),
      transition(["draft", "ordered", "partially-received"], "cancelled", "edit", "inventory.edit"),
    ],
    validate: validatePurchaseOrder,
  },
};

export function isValidInventoryProcurementData(value: unknown, kind: InventoryProcurementKind): value is InventoryProcurementData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fields: Readonly<Record<InventoryProcurementKind, readonly string[]>> = {
    "stock-movement": ["kind", "inventoryItemId", "eggBatchId", "itemCode", "locationKey", "movementType", "quantity", "unit", "occurredAt", "sourceReference", "receiptIdempotencyKey", "purchaseOrderId", "feedManufacturingBatchId", "receiptLotAllocations", "evidenceIds"],
    supplier: ["kind", "supplierCode", "name", "status", "contactEmail", "evidenceIds"],
    "inventory-item": ["kind", "itemCode", "name", "unit", "itemCategory", "expiryDate", "evidenceIds"],
    "inventory-allocation": ["kind", "salesOrderId", "inventoryItemId", "locationKey", "quantity", "unit", "idempotencyKey"],
    "inventory-fulfillment-event": ["kind", "salesOrderId", "inventoryAllocationId", "inventoryItemId", "customerCode", "eventType", "quantity", "occurredAt", "eggBatchId", "evidenceIds", "correctionOf", "reason", "idempotencyKey"],
    "purchase-request": ["kind", "requestCode", "itemCode", "quantity", "unit", "requestedAt", "neededBy", "supplierCode", "notes", "evidenceIds"],
    "purchase-order": ["kind", "orderCode", "requestId", "supplierCode", "itemCode", "quantity", "unit", "currency", "unitPrice", "orderedAt", "evidenceIds"],
  };
  if (Object.keys(value).some((field) => !fields[kind].includes(field))) return false;
  return INVENTORY_PROCUREMENT_DEFINITIONS[kind].validate(value as InventoryProcurementData).length === 0;
}

export function createInventoryProcurementServices(
  repository: ResourceRepository<InventoryProcurementData>,
  now?: () => string,
): InventoryProcurementServices {
  return Object.freeze({
    "stock-movement": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["stock-movement"], repository, now,
    ),
    supplier: new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS.supplier, repository, now,
    ),
    "inventory-item": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["inventory-item"], repository, now,
    ),
    "inventory-allocation": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["inventory-allocation"], repository, now,
    ),
    "inventory-fulfillment-event": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["inventory-fulfillment-event"], repository, now,
    ),
    "purchase-request": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["purchase-request"], repository, now,
    ),
    "purchase-order": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["purchase-order"], repository, now,
    ),
  });
}
