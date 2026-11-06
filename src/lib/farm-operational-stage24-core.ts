import {
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRepository,
  type ResourceTransition,
} from "./resource-workflow-stage24.ts";

export type FlockData = Readonly<{
  kind: "flock";
  flockCode: string;
  species: "chicken" | "turkey" | "duck";
  birdCount: number;
  /** Biological stage is additive to the compatible active/closed workflow state. */
  lifecycleStage?: "placed" | "brooding" | "rearing" | "laying" | "depleted" | "closed";
}>;

/** Append-only event attached to the canonical flock resource. The flock's
 * opaque resource ID is the relation key; flockCode is retained for display. */
export type FlockMovementData = Readonly<{
  kind: "flock-movement";
  flockId: string;
  flockCode: string;
  movementType: "placement" | "addition" | "transfer-in" | "transfer-out" | "mortality" | "cull" | "sale" | "disposal" | "correction" | "reversal";
  quantity: number;
  occurredAt: string;
  housePen?: string;
  fromHousePen?: string;
  toHousePen?: string;
  correctionOf?: string;
  /** Signed bird-count effect for a correction/reversal. Ordinary events use quantity. */
  correctionDelta?: number;
  reason?: string;
}>;

/** Everyday wording for employee-facing flock forms and summaries. */
export const FLOCK_EMPLOYEE_LABELS = Object.freeze({
  openingCount: "Number of Birds at Start",
  placement: "Birds Put Into This House/Pen",
  transferIn: "Birds Moved In",
  transferOut: "Birds Moved Out",
  mortality: "Birds That Died",
  cull: "Birds Removed From the Flock",
  sale: "Birds Sold or Removed",
  correction: "Correct Previous Entry",
  reversal: "Reverse Previous Entry",
  expectedLive: "Expected Birds Remaining",
  physicalCount: "Birds Counted on the Farm",
  variance: "Difference in Bird Count",
  effectiveTime: "When It Actually Happened",
  entryTime: "When It Was Recorded",
} as const);

export type FeedData = Readonly<{
  kind: "feed";
  itemCode: string;
  quantity: number;
  unit: "kg" | "bag" | "ton";
  /** New consumption/wastage entries cross-link to Inventory and Flock authorities. */
  inventoryItemId?: string;
  stockMovementId?: string;
  flockId?: string;
  flockCode?: string;
  useType?: "consumption" | "wastage";
  occurredAt?: string;
  evidenceIds?: readonly string[];
}>;

export type FeedFormulaData = Readonly<{
  kind: "feed-formula";
  formulaCode: string;
  version: number;
  finishedFeedItemCode: string;
  ingredients: readonly Readonly<{
    inventoryItemId: string;
    itemCode: string;
    quantityKg: number;
  }>[];
  evidenceIds?: readonly string[];
}>;

/** Immutable production fact. Inventory remains authoritative for the linked
 * raw-material and finished-feed quantities; this record preserves batch
 * traceability and the actual manufacturing mass balance. */
export type FeedManufacturingBatchData = Readonly<{
  kind: "feed-manufacturing-batch";
  batchCode: string;
  formulaId: string;
  formulaVersion: number;
  rawMaterialLotIds: readonly string[];
  inputQuantityKg: number;
  outputQuantityKg: number;
  wasteQuantityKg: number;
  finishedFeedItemCode: string;
  finishedFeedLotId?: string;
  qualityReference?: string;
  producedAt: string;
  evidenceIds?: readonly string[];
}>;

export type EggBatchData = Readonly<{
  kind: "egg-batch";
  /** Canonical flock resource ID for new lineage. Optional while legacy batches
   * continue to resolve through their existing human-readable flockCode. */
  flockId?: string;
  flockCode: string;
  quantity: number;
  collectedAt: string;
}>;

/** Append-only correction evidence for an immutable verified collection. */
export type EggBatchAdjustmentData = Readonly<{
  kind: "egg-batch-adjustment";
  batchId: string;
  quantityDelta: number;
  reason: string;
  recordedAt: string;
}>;

export type HealthEventData = Readonly<{
  kind: "health-event";
  flockCode: string;
  /** Mortality and culling remain health records, while the linked flock
   * movement is the count-changing source of truth. */
  eventType: "observation" | "treatment" | "mortality" | "cull";
  observedAt: string;
  notes: string;
  flockId?: string;
  quantity?: number;
  movementId?: string;
  housePen?: string;
  cause?: string;
  disposalMethod?: string;
  medicineInventoryItemId?: string;
  withdrawalUntil?: string;
  withdrawalReason?: string;
  evidenceIds?: readonly string[];
}>;

export type VaccinationData = Readonly<{
  kind: "vaccination";
  flockId?: string;
  flockCode: string;
  vaccineCode: string;
  dose: number;
  administeredAt?: string;
  medicineInventoryItemId?: string;
}>;

export type FarmOperationData =
  | FlockData
  | FlockMovementData
  | FeedData
  | FeedFormulaData
  | FeedManufacturingBatchData
  | EggBatchData
  | EggBatchAdjustmentData
  | HealthEventData
  | VaccinationData;

export type FarmOperationKind = FarmOperationData["kind"];
export type FarmOperationService = ResourceWorkflowService<FarmOperationData>;
export type FarmOperationServices = Readonly<Record<FarmOperationKind, FarmOperationService>>;

/** Canonical stock equations. Callers supply verified ledger totals; this module
 * never treats an absent provider or physical count as an authoritative value. */
export type FarmStockMovements = Readonly<{
  opening: number;
  additions?: number;
  transfersIn?: number;
  sales?: number;
  transfersOut?: number;
  mortality?: number;
  culls?: number;
  receipts?: number;
  issuedOrConsumed?: number;
  wastage?: number;
  collections?: number;
  dispatches?: number;
  damage?: number;
  approvedCorrections?: number;
}>;

export type FarmStockEquationResult = Readonly<{
  calculatedClosing: number;
  physicalCount?: number;
  variance?: number;
}>;

function stockQuantity(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function stockEquation(movements: FarmStockMovements, increases: readonly (keyof FarmStockMovements)[], decreases: readonly (keyof FarmStockMovements)[], physicalCount?: number): FarmStockEquationResult {
  const allowed = new Set(["opening", "approvedCorrections", ...increases, ...decreases]);
  if (!movements || typeof movements !== "object" || !stockQuantity(movements.opening) ||
      Object.entries(movements).some(([key, value]) => !allowed.has(key) || (key !== "opening" && key !== "approvedCorrections" && !stockQuantity(value))) ||
      (movements.approvedCorrections !== undefined && !Number.isSafeInteger(movements.approvedCorrections)) ||
      (physicalCount !== undefined && !stockQuantity(physicalCount))) {
    throw new RangeError("stock movements must be safe integer quantities");
  }
  // Aggregate with integer precision. Valid individual movements can exceed
  // Number.MAX_SAFE_INTEGER in total even when offsetting movements leave a
  // representable closing balance.
  const total = (keys: readonly (keyof FarmStockMovements)[]) => keys.reduce((sum, key) => sum + BigInt(movements[key] ?? 0), BigInt(0));
  const exactClosing = BigInt(movements.opening) + total(increases) - total(decreases) + BigInt(movements.approvedCorrections ?? 0);
  if (exactClosing < BigInt(0) || exactClosing > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("calculated closing stock is invalid");
  const calculatedClosing = Number(exactClosing);
  return Object.freeze({
    calculatedClosing,
    ...(physicalCount === undefined ? {} : { physicalCount, variance: physicalCount - calculatedClosing }),
  });
}

export function reconcileFlockStock(movements: FarmStockMovements, physicalCount?: number) {
  return stockEquation(movements, ["additions", "transfersIn"], ["sales", "transfersOut", "mortality", "culls"], physicalCount);
}

/** Reconcile an opening flock count against its immutable movement history.
 * Corrections require an explicit signed adjustment contract and therefore
 * fail closed here instead of being guessed as an increase or decrease. */
export function reconcileFlockMovementHistory(
  openingCount: number,
  flockId: string,
  movements: readonly (FlockMovementData & Readonly<{ id?: string }> )[],
  physicalCount?: number,
) {
  if (!nonNegativeInteger(openingCount) || !required(flockId) || !Array.isArray(movements)) {
    throw new RangeError("flock movement history is invalid");
  }
  const totals = {
    additions: 0,
    transfersIn: 0,
    sales: 0,
    transfersOut: 0,
    mortality: 0,
    culls: 0,
    approvedCorrections: 0,
  };
  const fields: Readonly<Record<FlockMovementData["movementType"], keyof typeof totals | null>> = {
    placement: "additions",
    addition: "additions",
    "transfer-in": "transfersIn",
    "transfer-out": "transfersOut",
    mortality: "mortality",
    cull: "culls",
    sale: "sales",
    disposal: "culls",
    correction: null,
    reversal: null,
  };
  const ordered = [...movements].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) ||
    String(a.id ?? "").localeCompare(String(b.id ?? "")));
  let openingPlacementSeen = false;
  let runningBalance = BigInt(openingCount);
  for (const movement of ordered) {
    const movementData = Object.fromEntries(Object.entries(movement ?? {}).filter(([key]) => key !== "id"));
    if (!movement || movement.flockId !== flockId || !isValidFarmOperationData(movementData, "flock-movement")) {
      throw new RangeError("flock movement history is invalid");
    }
    const validMovement = movement as FlockMovementData;
    if (validMovement.movementType === "placement" && !openingPlacementSeen) {
      // The opening flock count and its linked placement event describe the
      // same birds. Keep the event for history, but do not count them twice.
      openingPlacementSeen = true;
      if (validMovement.quantity !== openingCount) throw new RangeError("opening placement does not match opening count");
      continue;
    }
    if (validMovement.movementType === "correction" || validMovement.movementType === "reversal") {
      if (!Number.isSafeInteger(validMovement.correctionDelta) || validMovement.correctionDelta === 0) {
        throw new RangeError("flock movement correction direction is undefined");
      }
      const exact = BigInt(totals.approvedCorrections) + BigInt(validMovement.correctionDelta!);
      if (exact < BigInt(Number.MIN_SAFE_INTEGER) || exact > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("flock movement total is unsafe");
      runningBalance += BigInt(validMovement.correctionDelta!);
      if (runningBalance < BigInt(0)) throw new RangeError("flock live-bird balance cannot be negative");
      totals.approvedCorrections = Number(exact);
      continue;
    }
    const field = fields[validMovement.movementType];
    if (!field) throw new RangeError("flock movement correction direction is undefined");
    const decreases = ["sales", "transfersOut", "mortality", "culls"].includes(field);
    runningBalance += BigInt(decreases ? -validMovement.quantity : validMovement.quantity);
    if (runningBalance < BigInt(0)) throw new RangeError("flock live-bird balance cannot be negative");
    const next = totals[field] + validMovement.quantity;
    if (!Number.isSafeInteger(next)) throw new RangeError("flock movement total is unsafe");
    totals[field] = next;
  }
  return reconcileFlockStock({ opening: openingCount, ...totals }, physicalCount);
}

export type FlockClosureDecision = Readonly<{ allowed: boolean; ownerOverride: boolean; reason?: string }>;

export function assessFlockClosure(
  reconciliation: FarmStockEquationResult,
  options: Readonly<{ ownerOverride?: boolean; reason?: string }> = {},
): FlockClosureDecision {
  if (reconciliation.physicalCount === undefined) throw new RangeError("physical bird count is required before closure");
  if (reconciliation.variance === 0) return Object.freeze({ allowed: true, ownerOverride: false });
  if (options.ownerOverride !== true || typeof options.reason !== "string" || !required(options.reason)) {
    return Object.freeze({ allowed: false, ownerOverride: false });
  }
  return Object.freeze({ allowed: true, ownerOverride: true, reason: options.reason.trim() });
}

export function reconcileFeedStock(movements: FarmStockMovements, physicalCount?: number) {
  return stockEquation(movements, ["receipts", "transfersIn"], ["issuedOrConsumed", "transfersOut", "wastage"], physicalCount);
}

export function reconcileEggStock(movements: FarmStockMovements, physicalCount?: number) {
  return stockEquation(movements, ["collections", "transfersIn"], ["sales", "dispatches", "transfersOut", "damage", "wastage"], physicalCount);
}

function required(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function positive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER;
}

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
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
  return value.flatMap((id) => typeof id === "string" && id.trim().length > 0 && id.length <= 120 ? [] : ["evidence ids are invalid"]);
}

function validateFlock(data: FarmOperationData) {
  if (data.kind !== "flock") return ["data kind does not match flock"];
  const errors: string[] = [];
  if (!required(data.flockCode)) errors.push("flock code is required");
  if (!["chicken", "turkey", "duck"].includes(data.species)) errors.push("species is invalid");
  // A flock may reach zero through recorded mortality, culling, sales, or
  // disposal while it is being reconciled; zero is a valid closing count.
  if (!nonNegativeInteger(data.birdCount)) errors.push("bird count is invalid");
  if (data.lifecycleStage !== undefined && !["placed", "brooding", "rearing", "laying", "depleted", "closed"].includes(data.lifecycleStage)) errors.push("lifecycle stage is invalid");
  return errors;
}

function validateFlockMovement(data: FarmOperationData) {
  if (data.kind !== "flock-movement") return ["data kind does not match flock movement"];
  const errors: string[] = [];
  if (!required(data.flockId) || data.flockId.length > 120) errors.push("flock identity is invalid");
  if (!required(data.flockCode)) errors.push("flock code is required");
  if (!["placement", "addition", "transfer-in", "transfer-out", "mortality", "cull", "sale", "disposal", "correction", "reversal"].includes(data.movementType)) errors.push("movement type is invalid");
  if (!positive(data.quantity) || !Number.isSafeInteger(data.quantity)) errors.push("movement quantity is invalid");
  if (!isoDate(data.occurredAt)) errors.push("movement date is invalid");
  for (const field of [data.housePen, data.fromHousePen, data.toHousePen, data.correctionOf, data.reason]) {
    if (field !== undefined && (typeof field !== "string" || field.trim().length === 0 || field.length > 200)) errors.push("movement detail is invalid");
  }
  if ((data.movementType === "correction" || data.movementType === "reversal") &&
      (!required(data.correctionOf) || !required(data.reason) || !Number.isSafeInteger(data.correctionDelta) || data.correctionDelta === 0)) errors.push("correction reference, signed direction, and reason are required");
  if (data.movementType === "transfer-in" && !required(data.toHousePen)) errors.push("transfer destination is required");
  if (data.movementType === "transfer-out" && !required(data.fromHousePen)) errors.push("transfer source is required");
  return errors;
}

function validateFeed(data: FarmOperationData) {
  if (data.kind !== "feed") return ["data kind does not match feed"];
  const errors: string[] = [];
  if (!required(data.itemCode)) errors.push("item code is required");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!["kg", "bag", "ton"].includes(data.unit)) errors.push("unit is invalid");
  for (const reference of [data.inventoryItemId, data.stockMovementId, data.flockId]) {
    if (reference !== undefined && (!required(reference) || reference.length > 120)) errors.push("feed reference is invalid");
  }
  if (data.flockCode !== undefined && (!required(data.flockCode) || data.flockCode.length > 80)) errors.push("flock code is invalid");
  if (data.useType !== undefined && !["consumption", "wastage"].includes(data.useType)) errors.push("feed use type is invalid");
  if (data.occurredAt !== undefined && !isoDate(data.occurredAt)) errors.push("feed event date is invalid");
  const linkedFields = [data.inventoryItemId, data.stockMovementId, data.flockId, data.flockCode, data.useType, data.occurredAt];
  if (linkedFields.some((field) => field !== undefined) && linkedFields.some((field) => field === undefined)) {
    errors.push("linked feed consumption requires inventory, flock, use type, and event date");
  }
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateFeedFormula(data: FarmOperationData) {
  if (data.kind !== "feed-formula") return ["data kind does not match feed formula"];
  const errors: string[] = [];
  if (!required(data.formulaCode) || data.formulaCode.length > 80) errors.push("formula code is invalid");
  if (!Number.isSafeInteger(data.version) || data.version < 1) errors.push("formula version is invalid");
  if (!required(data.finishedFeedItemCode) || data.finishedFeedItemCode.length > 80) errors.push("finished feed item is invalid");
  if (!Array.isArray(data.ingredients) || data.ingredients.length < 1 || data.ingredients.length > 100) errors.push("formula ingredients are invalid");
  else for (const ingredient of data.ingredients) {
    if (!ingredient || !required(ingredient.inventoryItemId) || !required(ingredient.itemCode) || !positive(ingredient.quantityKg)) errors.push("formula ingredient is invalid");
  }
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateFeedManufacturingBatch(data: FarmOperationData) {
  if (data.kind !== "feed-manufacturing-batch") return ["data kind does not match feed manufacturing batch"];
  const errors: string[] = [];
  if (!required(data.batchCode) || data.batchCode.length > 80) errors.push("batch code is invalid");
  if (!required(data.formulaId) || data.formulaId.length > 120) errors.push("formula reference is invalid");
  if (!Number.isSafeInteger(data.formulaVersion) || data.formulaVersion < 1) errors.push("formula version is invalid");
  if (!Array.isArray(data.rawMaterialLotIds) || data.rawMaterialLotIds.length < 1 || data.rawMaterialLotIds.length > 100 || data.rawMaterialLotIds.some((id) => !required(id) || id.length > 120)) errors.push("raw material lots are invalid");
  if (!positive(data.inputQuantityKg) || !positive(data.outputQuantityKg) || !nonNegativeInteger(data.wasteQuantityKg)) errors.push("batch quantities are invalid");
  if (Number.isSafeInteger(data.inputQuantityKg) && Number.isSafeInteger(data.outputQuantityKg) && Number.isSafeInteger(data.wasteQuantityKg) && data.inputQuantityKg !== data.outputQuantityKg + data.wasteQuantityKg) errors.push("batch input must equal finished feed plus waste");
  if (!required(data.finishedFeedItemCode) || data.finishedFeedItemCode.length > 80) errors.push("finished feed item is invalid");
  for (const reference of [data.finishedFeedLotId, data.qualityReference]) if (reference !== undefined && (!required(reference) || reference.length > 160)) errors.push("batch reference is invalid");
  if (!isoDate(data.producedAt)) errors.push("production date is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateEggBatch(data: FarmOperationData) {
  if (data.kind !== "egg-batch") return ["data kind does not match egg batch"];
  const errors: string[] = [];
  if (data.flockId !== undefined && !required(data.flockId)) errors.push("flock ID is invalid");
  if (!required(data.flockCode)) errors.push("flock code is required");
  if (!nonNegativeInteger(data.quantity)) errors.push("quantity is invalid");
  if (!isoDate(data.collectedAt)) errors.push("collection date is invalid");
  return errors;
}

function validateEggBatchAdjustment(data: FarmOperationData) {
  if (data.kind !== "egg-batch-adjustment") return ["data kind does not match egg batch adjustment"];
  if (!required(data.batchId) || data.batchId.length > 120) return ["batch reference is invalid"];
  if (!Number.isSafeInteger(data.quantityDelta) || data.quantityDelta === 0) return ["quantity adjustment is invalid"];
  if (!required(data.reason) || data.reason.length > 500) return ["reason is invalid"];
  if (!isoDate(data.recordedAt)) return ["recorded date is invalid"];
  return [];
}

function validateHealthEvent(data: FarmOperationData) {
  if (data.kind !== "health-event") return ["data kind does not match health event"];
  const errors: string[] = [];
  if (!required(data.flockCode)) errors.push("flock code is required");
  if (!["observation", "treatment", "mortality", "cull"].includes(data.eventType)) errors.push("event type is invalid");
  if (!isoDate(data.observedAt)) errors.push("observation date is invalid");
  if (!required(data.notes) || data.notes.length > 2000) errors.push("notes are required and must be 2000 characters or fewer");
  for (const reference of [data.flockId, data.movementId]) {
    if (reference !== undefined && (!required(reference) || reference.length > 120)) errors.push("health event reference is invalid");
  }
  if (data.medicineInventoryItemId !== undefined && (!required(data.medicineInventoryItemId) || data.medicineInventoryItemId.length > 120)) errors.push("medicine stock reference is invalid");
  if (data.withdrawalUntil !== undefined && !isoDate(data.withdrawalUntil)) errors.push("withdrawal end date is invalid");
  if (data.withdrawalReason !== undefined && (!required(data.withdrawalReason) || data.withdrawalReason.length > 500)) errors.push("withdrawal reason is invalid");
  if (data.eventType !== "treatment" && (data.medicineInventoryItemId !== undefined || data.withdrawalUntil !== undefined || data.withdrawalReason !== undefined)) errors.push("medicine and withdrawal details require a treatment record");
  if (data.withdrawalUntil !== undefined && data.withdrawalReason === undefined) errors.push("withdrawal reason is required");
  for (const field of [data.housePen, data.cause, data.disposalMethod]) {
    if (field !== undefined && (!required(field) || field.length > 200)) errors.push("health event detail is invalid");
  }
  if (data.quantity !== undefined && !positive(data.quantity)) errors.push("health event quantity is invalid");
  const countLinkFields = [data.flockId, data.quantity, data.movementId];
  if (data.eventType === "mortality" || data.eventType === "cull") {
    if (countLinkFields.some((field) => field === undefined)) errors.push("mortality or culling records require flock, quantity, and linked movement");
  } else if (data.quantity !== undefined || data.movementId !== undefined) {
    errors.push("only mortality or culling records may change the bird count");
  }
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateVaccination(data: FarmOperationData) {
  if (data.kind !== "vaccination") return ["data kind does not match vaccination"];
  const errors: string[] = [];
  if (data.flockId !== undefined && (!required(data.flockId) || data.flockId.length > 120)) errors.push("flock identity is invalid");
  if (!required(data.flockCode)) errors.push("flock code is required");
  if (!required(data.vaccineCode)) errors.push("vaccine code is required");
  if (!positive(data.dose)) errors.push("dose is invalid");
  if (data.administeredAt !== undefined && !isoDate(data.administeredAt)) errors.push("administration date is invalid");
  if (data.medicineInventoryItemId !== undefined && (!required(data.medicineInventoryItemId) || data.medicineInventoryItemId.length > 120)) errors.push("medicine stock reference is invalid");
  return errors;
}

const farmOperationFields: Readonly<Record<FarmOperationKind, readonly string[]>> = {
  flock: ["kind", "flockCode", "species", "birdCount", "lifecycleStage"],
  "flock-movement": ["kind", "flockId", "flockCode", "movementType", "quantity", "occurredAt", "housePen", "fromHousePen", "toHousePen", "correctionOf", "correctionDelta", "reason"],
  feed: ["kind", "itemCode", "quantity", "unit", "inventoryItemId", "stockMovementId", "flockId", "flockCode", "useType", "occurredAt", "evidenceIds"],
  "feed-formula": ["kind", "formulaCode", "version", "finishedFeedItemCode", "ingredients", "evidenceIds"],
  "feed-manufacturing-batch": ["kind", "batchCode", "formulaId", "formulaVersion", "rawMaterialLotIds", "inputQuantityKg", "outputQuantityKg", "wasteQuantityKg", "finishedFeedItemCode", "finishedFeedLotId", "qualityReference", "producedAt", "evidenceIds"],
  "egg-batch": ["kind", "flockId", "flockCode", "quantity", "collectedAt"],
  "egg-batch-adjustment": ["kind", "batchId", "quantityDelta", "reason", "recordedAt"],
  "health-event": ["kind", "flockCode", "eventType", "observedAt", "notes", "flockId", "quantity", "movementId", "housePen", "cause", "disposalMethod", "medicineInventoryItemId", "withdrawalUntil", "withdrawalReason", "evidenceIds"],
  vaccination: ["kind", "flockId", "flockCode", "vaccineCode", "dose", "administeredAt", "medicineInventoryItemId"],
};

/** Validate stored/API rows at the persistence boundary as strictly as writes. */
export function isValidFarmOperationData(value: unknown, kind: FarmOperationKind): value is FarmOperationData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as FarmOperationData;
  if (data.kind !== kind || !Object.keys(data).every((field) => farmOperationFields[kind].includes(field))) return false;
  const validate = FARM_OPERATION_DEFINITIONS[kind].validate;
  return validate(data).length === 0;
}

const transition = (
  from: string,
  to: string,
  action: ResourceTransition["action"],
  permission: string,
  approvalPermission?: string,
): ResourceTransition => ({ from, to, action, permission, approvalPermission });

export const FARM_OPERATION_DEFINITIONS: Readonly<Record<FarmOperationKind, ResourceDefinition<FarmOperationData>>> = {
  flock: {
    resourceType: "flock",
    initialState: "active",
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [transition("active", "closed", "edit", "inventory.edit")],
    validate: validateFlock,
  },
  "flock-movement": {
    resourceType: "flock-movement",
    initialState: "recorded",
    mutableStates: [],
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [],
    validate: validateFlockMovement,
  },
  feed: {
    resourceType: "feed",
    initialState: "draft",
    permissions: { create: "farm.feed.edit", edit: "farm.feed.edit", delete: "farm.feed.edit" },
    transitions: [transition("draft", "posted", "edit", "farm.feed.edit")],
    validate: validateFeed,
  },
  "feed-formula": {
    resourceType: "feed-formula",
    initialState: "draft",
    mutableStates: ["draft"],
    requireMakerChecker: true,
    permissions: { create: "manufacturing.edit", edit: "manufacturing.edit", delete: "manufacturing.edit" },
    transitions: [transition("draft", "approved", "approve", "manufacturing.edit", "manufacturing.approve")],
    validate: validateFeedFormula,
  },
  "feed-manufacturing-batch": {
    resourceType: "feed-manufacturing-batch",
    initialState: "draft",
    mutableStates: ["draft"],
    requireMakerChecker: true,
    permissions: { create: "manufacturing.edit", edit: "manufacturing.edit", delete: "manufacturing.edit" },
    transitions: [
      transition("draft", "quality-hold", "edit", "manufacturing.edit"),
      transition("quality-hold", "released", "approve", "manufacturing.edit", "manufacturing.approve"),
    ],
    validate: validateFeedManufacturingBatch,
  },
  "egg-batch": {
    resourceType: "egg-batch",
    initialState: "draft",
    requireMakerChecker: true,
    // A verified collection is an immutable traceability fact. Corrections
    // must be represented by append-only evidence that references the batch.
    mutableStates: ["draft"],
    permissions: { create: "farm.eggs.edit", edit: "farm.eggs.edit", delete: "farm.eggs.edit" },
    transitions: [transition("draft", "verified", "approve", "farm.eggs.edit", "farm.eggs.approve")],
    validate: validateEggBatch,
  },
  "egg-batch-adjustment": {
    resourceType: "egg-batch-adjustment",
    initialState: "draft",
    requireMakerChecker: true,
    mutableStates: ["draft"],
    permissions: { create: "farm.eggs.edit", edit: "farm.eggs.edit", delete: "farm.eggs.edit" },
    transitions: [transition("draft", "verified", "approve", "farm.eggs.edit", "farm.eggs.approve")],
    validate: validateEggBatchAdjustment,
  },
  "health-event": {
    resourceType: "health-event",
    initialState: "open",
    permissions: { create: "farm.health.edit", edit: "farm.health.edit", delete: "farm.health.edit" },
    transitions: [transition("open", "resolved", "edit", "farm.health.edit")],
    validate: validateHealthEvent,
  },
  vaccination: {
    resourceType: "vaccination",
    initialState: "planned",
    permissions: { create: "vaccination.edit", edit: "vaccination.edit", delete: "vaccination.edit" },
    transitions: [transition("planned", "administered", "edit", "vaccination.edit")],
    validate: validateVaccination,
  },
};

export function createFarmOperationalServices(
  repository: ResourceRepository<FarmOperationData>,
  now?: () => string,
): FarmOperationServices {
  return Object.freeze({
    flock: new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS.flock, repository, now),
    "flock-movement": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["flock-movement"], repository, now),
    feed: new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS.feed, repository, now),
    "feed-formula": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["feed-formula"], repository, now),
    "feed-manufacturing-batch": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["feed-manufacturing-batch"], repository, now),
    "egg-batch": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["egg-batch"], repository, now),
    "egg-batch-adjustment": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["egg-batch-adjustment"], repository, now),
    "health-event": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["health-event"], repository, now),
    vaccination: new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS.vaccination, repository, now),
  });
}
