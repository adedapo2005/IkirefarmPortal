import {
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRepository,
  type ResourceTransition,
} from "./resource-workflow.ts";

export type StockMovementData = Readonly<{
  kind: "stock-movement";
  itemCode: string;
  locationKey: string;
  movementType: "receipt" | "issue" | "adjustment" | "transfer";
  quantity: number;
  unit: "unit" | "kg" | "bag" | "ton" | "litre";
  occurredAt: string;
  sourceReference?: string;
  evidenceIds?: readonly string[];
}>;

/** A witnessed baseline is evidence, NOT a current stock-on-hand balance. */
export type StockOpeningData = Readonly<{
  kind: "stock-opening";
  itemCode: string;
  locationKey: string;
  unit: StockMovementData["unit"];
  openingQuantity: number;
  countedAt: string;
  basis: "physical-count" | "signed-register";
  sourceReference: string;
  witnessName: string;
  evidenceIds?: readonly string[];
  notes?: string;
}>;

export type MedicationStockMovementData = Readonly<{
  kind: "medication-stock-movement";
  medicationCode: string;
  batchNumber: string;
  locationKey: string;
  movementType: "receipt" | "issue" | "adjustment" | "wastage";
  quantity: number;
  unit: "dose" | "ml" | "l" | "g" | "tablet";
  occurredAt: string;
  expiryDate?: string;
  sourceReference?: string;
  notes?: string;
  evidenceIds?: readonly string[];
}>;

export type EquipmentData = Readonly<{
  kind: "equipment";
  assetCode: string;
  name: string;
  category: "machinery" | "power" | "water" | "environmental" | "processing" | "transport" | "safety" | "other";
  serialNumber?: string;
  locationKey: string;
  condition: "serviceable" | "needs-attention" | "out-of-service";
  assignedTo?: string;
  acquiredAt?: string;
  lastServicedAt?: string;
  nextServiceDueAt?: string;
  notes?: string;
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
  | StockOpeningData
  | MedicationStockMovementData
  | EquipmentData
  | SupplierData
  | PurchaseRequestData
  | PurchaseOrderData;

export type InventoryProcurementKind = InventoryProcurementData["kind"];
export type InventoryProcurementService = ResourceWorkflowService<InventoryProcurementData>;
export type InventoryProcurementServices =
  Readonly<Record<InventoryProcurementKind, InventoryProcurementService>>;

const units = ["unit", "kg", "bag", "ton", "litre"] as const;
const movementTypes = ["receipt", "issue", "adjustment", "transfer"] as const;
const medicationMovementTypes = ["receipt", "issue", "adjustment", "wastage"] as const;
const medicationUnits = ["dose", "ml", "l", "g", "tablet"] as const;
const equipmentCategories = ["machinery", "power", "water", "environmental", "processing", "transport", "safety", "other"] as const;
const equipmentConditions = ["serviceable", "needs-attention", "out-of-service"] as const;

function bounded(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function positive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function dateOnly(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function evidenceErrors(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return ["evidence ids are invalid"];
  return value.flatMap((id) => bounded(id, 120) ? [] : ["evidence ids are invalid"]);
}

function validateStockMovement(data: InventoryProcurementData) {
  if (data.kind !== "stock-movement") return ["data kind does not match stock movement"];
  const errors: string[] = [];
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (!bounded(data.locationKey, 120)) errors.push("location is invalid");
  if (!movementTypes.includes(data.movementType)) errors.push("movement type is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!units.includes(data.unit)) errors.push("unit is invalid");
  if (!isoDate(data.occurredAt)) errors.push("movement date is invalid");
  if (data.sourceReference !== undefined && !bounded(data.sourceReference, 160))
    errors.push("source reference is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateStockOpening(data: InventoryProcurementData) {
  if (data.kind !== "stock-opening") return ["data kind does not match opening stock"];
  const errors: string[] = [];
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (!bounded(data.locationKey, 120)) errors.push("store or location is invalid");
  if (!units.includes(data.unit)) errors.push("stock unit is invalid");
  if (!nonNegative(data.openingQuantity)) errors.push("opening stock quantity must be zero or greater");
  if (!isoDate(data.countedAt)) errors.push("stock count date is invalid");
  if (!["physical-count", "signed-register"].includes(data.basis))
    errors.push("verified count basis is required");
  if (!bounded(data.sourceReference, 160))
    errors.push("signed count sheet or reconciliation reference is required");
  if (!bounded(data.witnessName, 160))
    errors.push("independent witness is required");
  if (data.notes !== undefined && !bounded(data.notes, 1000))
    errors.push("notes are invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateMedicationStockMovement(data: InventoryProcurementData) {
  if (data.kind !== "medication-stock-movement") return ["data kind does not match medication stock movement"];
  const errors: string[] = [];
  if (!bounded(data.medicationCode, 80)) errors.push("medication code is invalid");
  if (!bounded(data.batchNumber, 120)) errors.push("batch number is invalid");
  if (!bounded(data.locationKey, 120)) errors.push("location is invalid");
  if (!medicationMovementTypes.includes(data.movementType)) errors.push("movement type is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!medicationUnits.includes(data.unit)) errors.push("unit is invalid");
  if (!isoDate(data.occurredAt)) errors.push("movement date is invalid");
  if (data.expiryDate !== undefined && !dateOnly(data.expiryDate)) errors.push("expiry date is invalid");
  if (data.movementType === "receipt" && !dateOnly(data.expiryDate)) errors.push("expiry date is required for receipts");
  if (dateOnly(data.expiryDate) && isoDate(data.occurredAt) && Date.parse(data.expiryDate!) < Date.parse(data.occurredAt))
    errors.push("expiry date cannot be before the movement date");
  if (data.sourceReference !== undefined && !bounded(data.sourceReference, 160)) errors.push("source reference is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("notes are invalid");
  if ((data.movementType === "adjustment" || data.movementType === "wastage") && !bounded(data.notes, 1000))
    errors.push("notes are required for adjustments and wastage");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateEquipment(data: InventoryProcurementData) {
  if (data.kind !== "equipment") return ["data kind does not match equipment"];
  const errors: string[] = [];
  if (!bounded(data.assetCode, 80)) errors.push("asset code is invalid");
  if (!bounded(data.name, 160)) errors.push("equipment name is invalid");
  if (!equipmentCategories.includes(data.category)) errors.push("equipment category is invalid");
  if (data.serialNumber !== undefined && !bounded(data.serialNumber, 120)) errors.push("serial number is invalid");
  if (!bounded(data.locationKey, 120)) errors.push("location is invalid");
  if (!equipmentConditions.includes(data.condition)) errors.push("equipment condition is invalid");
  if (data.assignedTo !== undefined && !bounded(data.assignedTo, 160)) errors.push("assignment is invalid");
  if (data.acquiredAt !== undefined && !dateOnly(data.acquiredAt)) errors.push("acquired date is invalid");
  if (data.lastServicedAt !== undefined && !dateOnly(data.lastServicedAt)) errors.push("last service date is invalid");
  if (data.nextServiceDueAt !== undefined && !dateOnly(data.nextServiceDueAt)) errors.push("next service due date is invalid");
  if (dateOnly(data.lastServicedAt) && dateOnly(data.nextServiceDueAt) &&
      Date.parse(data.nextServiceDueAt!) < Date.parse(data.lastServicedAt!)) {
    errors.push("next service due date cannot be before last service date");
  }
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("notes are invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateSupplier(data: InventoryProcurementData) {
  if (data.kind !== "supplier") return ["data kind does not match supplier"];
  const errors: string[] = [];
  if (!bounded(data.supplierCode, 80)) errors.push("supplier code is invalid");
  if (!bounded(data.name, 160)) errors.push("supplier name is invalid");
  if (!["active", "inactive"].includes(data.status)) errors.push("supplier status is invalid");
  if (data.contactEmail !== undefined && !bounded(data.contactEmail, 320))
    errors.push("supplier contact is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
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
  "stock-opening": {
    resourceType: "stock-opening",
    initialState: "draft",
    mutableStates: ["draft"],
    requireMakerChecker: true,
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("draft", "submitted", "edit", "inventory.edit"),
      transition("submitted", "approved", "approve", "inventory.edit", "inventory.approve"),
      transition(["draft", "submitted"], "cancelled", "edit", "inventory.edit"),
    ],
    validate: validateStockOpening,
  },
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
  "medication-stock-movement": {
    resourceType: "medication-stock-movement",
    initialState: "draft",
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("draft", "posted", "edit", "inventory.edit"),
      transition("posted", "voided", "edit", "inventory.edit"),
    ],
    validate: validateMedicationStockMovement,
  },
  equipment: {
    resourceType: "equipment",
    initialState: "active",
    mutableStates: ["active", "maintenance"],
    permissions: { create: "assets.edit", edit: "assets.edit", delete: "assets.edit" },
    transitions: [
      transition("active", "maintenance", "edit", "assets.edit"),
      transition("maintenance", "active", "edit", "assets.edit"),
      transition(["active", "maintenance"], "retired", "edit", "assets.edit"),
    ],
    validate: validateEquipment,
  },
  supplier: {
    resourceType: "supplier",
    initialState: "active",
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [transition("active", "inactive", "edit", "inventory.edit")],
    validate: validateSupplier,
  },
  "purchase-request": {
    resourceType: "purchase-request",
    initialState: "requested",
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

export function createInventoryProcurementServices(
  repository: ResourceRepository<InventoryProcurementData>,
  now?: () => string,
): InventoryProcurementServices {
  return Object.freeze({
    "stock-opening": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["stock-opening"], repository, now,
    ),
    "stock-movement": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["stock-movement"], repository, now,
    ),
    "medication-stock-movement": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["medication-stock-movement"], repository, now,
    ),
    equipment: new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS.equipment, repository, now,
    ),
    supplier: new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS.supplier, repository, now,
    ),
    "purchase-request": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["purchase-request"], repository, now,
    ),
    "purchase-order": new ResourceWorkflowService(
      INVENTORY_PROCUREMENT_DEFINITIONS["purchase-order"], repository, now,
    ),
  });
}
