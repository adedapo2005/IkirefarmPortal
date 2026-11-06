import {
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRepository,
  type ResourceTransition,
} from "./resource-workflow.ts";

export type FlockData = Readonly<{
  kind: "flock";
  flockCode: string;
  name: string;
  species: "chicken" | "turkey" | "duck";
  breed: string;
  house: string;
  placementDate: string;
  source: string;
  // Optional for legacy placements; new records explicitly identify whether
  // the source is linked to an active supplier master or merely documented.
  sourceKind?: "supplier" | "other";
  sourceSupplierId?: string;
  birdCount: number;
}>;

export type HouseData = Readonly<{
  kind: "house";
  houseCode: string;
  name: string;
  housingSystem: "deep-litter" | "battery-cage" | "aviary" | "brooder" | "free-range" | "other";
  capacityBirds: number;
  zone: string;
  readinessStatus: "ready" | "restricted" | "not-ready" | "unverified";
  sanitationStatus: "recorded-clean" | "attention-required" | "unverified";
  lastSanitizedOn?: string;
  source: string;
  notes?: string;
  evidenceIds?: readonly string[];
}>;

export type BreedData = Readonly<{
  kind: "breed";
  breedCode: string;
  name: string;
  species: "chicken" | "turkey" | "duck";
  productionClass: "layer" | "broiler" | "dual-purpose" | "breeding" | "other";
  source: string;
  notes?: string;
  evidenceIds?: readonly string[];
}>;

export type FlockTransferData = Readonly<{
  kind: "flock-transfer";
  transferCode: string;
  flockCode: string;
  sourceHouse: string;
  destinationHouse: string;
  birdCount: number;
  plannedFor: string;
  reason: string;
  evidenceIds?: readonly string[];
  reconciledBirdCount?: number;
  completedAt?: string;
  completionNotes?: string;
}>;

export type FeedData = Readonly<{
  kind: "feed";
  itemCode: string;
  movementType: "received" | "issued" | "consumed" | "wastage" | "adjustment";
  quantity: number;
  unit: "kg" | "bag" | "ton";
  location: string;
  occurredAt: string;
  flockCode?: string;
  reference?: string;
  notes?: string;
}>;

export type WaterCheckData = Readonly<{
  kind: "water-check";
  house: string;
  flockCode?: string;
  source: string;
  availability: "available" | "interrupted" | "unavailable";
  meterReadingLitres?: number;
  qualityStatus: "clear" | "attention" | "not-checked";
  checkedAt: string;
  notes?: string;
  actionTaken?: string;
}>;

export type MedicationAdministrationData = Readonly<{
  kind: "medication-administration";
  flockCode: string;
  house: string;
  medicationCode: string;
  batchNumber: string;
  doseQuantity: number;
  doseUnit: "dose" | "ml" | "l" | "g" | "tablet";
  administrationMethod: string;
  reason: string;
  administeredAt: string;
  instructionReference: string;
  withdrawalEndDate?: string;
  notes?: string;
}>;

export type MortalityRecordData = Readonly<{
  kind: "mortality-record";
  flockCode: string;
  house: string;
  birdCount: number;
  discoveredAt: string;
  causeStatus: "unknown" | "observed" | "under-review";
  causeDescription?: string;
  disposition?: string;
  escalationReference?: string;
  notes: string;
  actionTaken?: string;
}>;

export type EggBatchData = Readonly<{
  kind: "egg-batch";
  /** New and newly verified rows persist a server-resolved real Flock ID. Legacy read compatibility remains. */
  flockId?: string;
  flockCode: string;
  house: string;
  collectionRound: "morning" | "midday" | "evening" | "other";
  quantity: number;
  damagedCount: number;
  rejectedCount: number;
  collectedAt: string;
  notes?: string;
}>;

export type HealthEventData = Readonly<{
  kind: "health-event";
  flockCode: string;
  house: string;
  eventType: "observation" | "treatment" | "mortality";
  severity: "low" | "moderate" | "high" | "critical";
  observedAt: string;
  affectedBirds: number;
  notes: string;
  actionTaken?: string;
}>;

export type VaccinationData = Readonly<{
  kind: "vaccination";
  flockCode: string;
  house: string;
  vaccineCode: string;
  batchNumber: string;
  dose: number;
  doseUnit: "dose" | "ml" | "l";
  administrationMethod: string;
  administeredAt: string;
  reference?: string;
  notes?: string;
}>;

export type FarmOperationData =
  | FlockData
  | HouseData
  | BreedData
  | FlockTransferData
  | FeedData
  | WaterCheckData
  | MedicationAdministrationData
  | MortalityRecordData
  | EggBatchData
  | HealthEventData
  | VaccinationData;

export type FarmOperationKind = FarmOperationData["kind"];
export type FarmOperationService = ResourceWorkflowService<FarmOperationData>;
export type FarmOperationServices = Readonly<Record<FarmOperationKind, FarmOperationService>>;

function bounded(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function dateOnly(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function positive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function nonNegativeInteger(value: unknown) {
  return nonNegative(value) && Number.isInteger(value);
}

function isoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Egg evidence must be a real Gregorian calendar timestamp with an explicit
// timezone. Date.parse alone silently normalizes dates such as February 30.
export function isValidEggCollectionTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > maxDays[month - 1]) return false;
  const offset = match[7];
  if (offset !== "Z") {
    const offsetHours = Number(offset.slice(1, 3));
    const offsetMinutes = Number(offset.slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function validateFlock(data: FarmOperationData) {
  if (data.kind !== "flock") return ["data kind does not match flock"];
  const errors: string[] = [];
  if (!bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (!bounded(data.name, 120)) errors.push("flock name is invalid");
  if (!["chicken", "turkey", "duck"].includes(data.species)) errors.push("species is invalid");
  if (!bounded(data.breed, 120)) errors.push("breed is invalid");
  if (!bounded(data.house, 120)) errors.push("house is invalid");
  if (!dateOnly(data.placementDate)) errors.push("placement date is invalid");
  if (!bounded(data.source, 160)) errors.push("source is invalid");
  if (data.sourceKind !== undefined && !["supplier", "other"].includes(data.sourceKind)) {
    errors.push("flock source classification is invalid");
  }
  if (data.sourceKind === "supplier" && !bounded(data.sourceSupplierId, 160)) {
    errors.push("registered supplier record is required");
  }
  if (data.sourceKind !== "supplier" && data.sourceSupplierId !== undefined) {
    errors.push("an unlinked source cannot claim a supplier identity");
  }
  if (!positive(data.birdCount) || !Number.isInteger(data.birdCount)) errors.push("bird count is invalid");
  return errors;
}

function validateHouse(data: FarmOperationData) {
  if (data.kind !== "house") return ["data kind does not match house"];
  const errors: string[] = [];
  if (!bounded(data.houseCode, 80)) errors.push("house code is invalid");
  if (!bounded(data.name, 120)) errors.push("house name is invalid");
  if (!["deep-litter", "battery-cage", "aviary", "brooder", "free-range", "other"].includes(data.housingSystem))
    errors.push("housing system is invalid");
  if (!positive(data.capacityBirds) || !Number.isInteger(data.capacityBirds)) errors.push("house capacity is invalid");
  if (!bounded(data.zone, 120)) errors.push("house zone is invalid");
  if (!["ready", "restricted", "not-ready", "unverified"].includes(data.readinessStatus))
    errors.push("readiness status is invalid");
  if (!["recorded-clean", "attention-required", "unverified"].includes(data.sanitationStatus))
    errors.push("sanitation status is invalid");
  if (data.lastSanitizedOn !== undefined && !dateOnly(data.lastSanitizedOn)) errors.push("last sanitized date is invalid");
  if (!bounded(data.source, 160)) errors.push("house source is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("house notes are invalid");
  if (data.evidenceIds !== undefined && (
    !Array.isArray(data.evidenceIds)
    || data.evidenceIds.length > 20
    || data.evidenceIds.some((value) => !bounded(value, 160))
  )) errors.push("evidence identifiers are invalid");
  return errors;
}

function validateBreed(data: FarmOperationData) {
  if (data.kind !== "breed") return ["data kind does not match breed"];
  const errors: string[] = [];
  if (!bounded(data.breedCode, 80)) errors.push("breed code is invalid");
  if (!bounded(data.name, 120)) errors.push("breed name is invalid");
  if (!["chicken", "turkey", "duck"].includes(data.species)) errors.push("species is invalid");
  if (!["layer", "broiler", "dual-purpose", "breeding", "other"].includes(data.productionClass))
    errors.push("production class is invalid");
  if (!bounded(data.source, 160)) errors.push("breed source is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("breed notes are invalid");
  if (data.evidenceIds !== undefined && (
    !Array.isArray(data.evidenceIds)
    || data.evidenceIds.length > 20
    || data.evidenceIds.some((value) => !bounded(value, 160))
  )) errors.push("evidence identifiers are invalid");
  return errors;
}

function validateFlockTransfer(data: FarmOperationData) {
  if (data.kind !== "flock-transfer") return ["data kind does not match flock transfer"];
  const errors: string[] = [];
  if (!bounded(data.transferCode, 80)) errors.push("transfer code is invalid");
  if (!bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (!bounded(data.sourceHouse, 120)) errors.push("source house is invalid");
  if (!bounded(data.destinationHouse, 120)) errors.push("destination house is invalid");
  if (
    bounded(data.sourceHouse, 120)
    && bounded(data.destinationHouse, 120)
    && data.sourceHouse.trim().toLocaleLowerCase() === data.destinationHouse.trim().toLocaleLowerCase()
  ) errors.push("destination house must differ from source house");
  if (!positive(data.birdCount) || !Number.isInteger(data.birdCount)) errors.push("transfer bird count is invalid");
  if (!isoDate(data.plannedFor)) errors.push("planned transfer date is invalid");
  if (!bounded(data.reason, 1000)) errors.push("transfer reason is invalid");
  if (data.evidenceIds !== undefined && (
    !Array.isArray(data.evidenceIds)
    || data.evidenceIds.length > 20
    || data.evidenceIds.some((value) => !bounded(value, 160))
  )) errors.push("evidence identifiers are invalid");
  if (data.reconciledBirdCount !== undefined && (
    !positive(data.reconciledBirdCount) || !Number.isInteger(data.reconciledBirdCount)
  )) errors.push("reconciled bird count is invalid");
  if (data.completedAt !== undefined && !isoDate(data.completedAt)) errors.push("completion date is invalid");
  if (data.completionNotes !== undefined && !bounded(data.completionNotes, 1000))
    errors.push("completion notes are invalid");
  if (
    data.reconciledBirdCount !== undefined
    && Number.isInteger(data.reconciledBirdCount)
    && data.reconciledBirdCount !== data.birdCount
    && !bounded(data.completionNotes, 1000)
  ) errors.push("completion notes are required when counts differ");
  return errors;
}

function validateFeed(data: FarmOperationData) {
  if (data.kind !== "feed") return ["data kind does not match feed"];
  const errors: string[] = [];
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (!["received", "issued", "consumed", "wastage", "adjustment"].includes(data.movementType))
    errors.push("movement type is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!["kg", "bag", "ton"].includes(data.unit)) errors.push("unit is invalid");
  if (!bounded(data.location, 120)) errors.push("location is invalid");
  if (!isoDate(data.occurredAt)) errors.push("movement date is invalid");
  if (data.flockCode !== undefined && !bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (data.reference !== undefined && !bounded(data.reference, 160)) errors.push("reference is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("movement notes are invalid");
  if (data.movementType === "adjustment" && !bounded(data.notes, 1000)) errors.push("adjustment notes are required");
  return errors;
}

function validateWaterCheck(data: FarmOperationData) {
  if (data.kind !== "water-check") return ["data kind does not match water check"];
  const errors: string[] = [];
  if (!bounded(data.house, 120)) errors.push("house is invalid");
  if (data.flockCode !== undefined && !bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (!bounded(data.source, 120)) errors.push("water source is invalid");
  if (!["available", "interrupted", "unavailable"].includes(data.availability))
    errors.push("water availability is invalid");
  if (data.meterReadingLitres !== undefined && !nonNegative(data.meterReadingLitres))
    errors.push("meter reading is invalid");
  if (!["clear", "attention", "not-checked"].includes(data.qualityStatus))
    errors.push("visual check status is invalid");
  if (!isoDate(data.checkedAt)) errors.push("water check date is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("water check notes are invalid");
  if (data.actionTaken !== undefined && !bounded(data.actionTaken, 1000)) errors.push("action taken is invalid");
  if ((data.availability !== "available" || data.qualityStatus === "attention") && !bounded(data.notes, 1000))
    errors.push("exception notes are required");
  return errors;
}

function validateMedicationAdministration(data: FarmOperationData) {
  if (data.kind !== "medication-administration") return ["data kind does not match medication administration"];
  const errors: string[] = [];
  if (!bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (!bounded(data.house, 120)) errors.push("house is invalid");
  if (!bounded(data.medicationCode, 120)) errors.push("medication code is invalid");
  if (!bounded(data.batchNumber, 120)) errors.push("batch number is invalid");
  if (!positive(data.doseQuantity)) errors.push("dose quantity is invalid");
  if (!["dose", "ml", "l", "g", "tablet"].includes(data.doseUnit)) errors.push("dose unit is invalid");
  if (!bounded(data.administrationMethod, 120)) errors.push("administration method is invalid");
  if (!bounded(data.reason, 1000)) errors.push("administration reason is invalid");
  if (!isoDate(data.administeredAt)) errors.push("administration date is invalid");
  if (!bounded(data.instructionReference, 160)) errors.push("instruction reference is invalid");
  if (data.withdrawalEndDate !== undefined && !dateOnly(data.withdrawalEndDate))
    errors.push("withdrawal end date is invalid");
  if (
    isoDate(data.administeredAt)
    && data.withdrawalEndDate !== undefined
    && dateOnly(data.withdrawalEndDate)
    && Date.parse(data.withdrawalEndDate + "T23:59:59Z") < Date.parse(data.administeredAt)
  ) errors.push("withdrawal end date precedes administration");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("medication notes are invalid");
  return errors;
}

function validateMortalityRecord(data: FarmOperationData) {
  if (data.kind !== "mortality-record") return ["data kind does not match mortality record"];
  const errors: string[] = [];
  if (!bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (!bounded(data.house, 120)) errors.push("house is invalid");
  if (!positive(data.birdCount) || !Number.isInteger(data.birdCount)) errors.push("mortality count is invalid");
  if (!isoDate(data.discoveredAt)) errors.push("discovery date is invalid");
  if (!["unknown", "observed", "under-review"].includes(data.causeStatus))
    errors.push("cause status is invalid");
  if (data.causeDescription !== undefined && !bounded(data.causeDescription, 500))
    errors.push("cause description is invalid");
  if (data.causeStatus === "observed" && !bounded(data.causeDescription, 500))
    errors.push("observed cause description is required");
  if (data.disposition !== undefined && !bounded(data.disposition, 240)) errors.push("disposition is invalid");
  if (data.escalationReference !== undefined && !bounded(data.escalationReference, 160))
    errors.push("escalation reference is invalid");
  if (!bounded(data.notes, 1000)) errors.push("mortality notes are invalid");
  if (data.actionTaken !== undefined && !bounded(data.actionTaken, 1000)) errors.push("action taken is invalid");
  return errors;
}

function validateEggBatch(data: FarmOperationData) {
  if (data.kind !== "egg-batch") return ["data kind does not match egg batch"];
  const errors: string[] = [];
  if (!bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (data.flockId !== undefined && !bounded(data.flockId, 120)) errors.push("flock identity is invalid");
  if (!bounded(data.house, 120)) errors.push("house is invalid");
  if (!["morning", "midday", "evening", "other"].includes(data.collectionRound))
    errors.push("collection round is invalid");
  if (!nonNegativeInteger(data.quantity)) errors.push("quantity is invalid");
  if (!nonNegativeInteger(data.damagedCount)) errors.push("damaged count is invalid");
  if (!nonNegativeInteger(data.rejectedCount)) errors.push("rejected count is invalid");
  if (
    nonNegativeInteger(data.quantity)
    && nonNegativeInteger(data.damagedCount)
    && nonNegativeInteger(data.rejectedCount)
    && data.damagedCount + data.rejectedCount > data.quantity
  ) errors.push("egg condition counts exceed total collection");
  if (!isValidEggCollectionTimestamp(data.collectedAt)) errors.push("collection date is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("collection notes are invalid");
  return errors;
}

function validateHealthEvent(data: FarmOperationData) {
  if (data.kind !== "health-event") return ["data kind does not match health event"];
  const errors: string[] = [];
  if (!bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (!bounded(data.house, 120)) errors.push("house is invalid");
  if (!["observation", "treatment", "mortality"].includes(data.eventType)) errors.push("event type is invalid");
  if (!["low", "moderate", "high", "critical"].includes(data.severity)) errors.push("severity is invalid");
  if (!isoDate(data.observedAt)) errors.push("observation date is invalid");
  if (!nonNegativeInteger(data.affectedBirds)) errors.push("affected bird count is invalid");
  if (!bounded(data.notes, 2000)) errors.push("observation notes are invalid");
  if (data.actionTaken !== undefined && (typeof data.actionTaken !== "string" || data.actionTaken.length > 1000))
    errors.push("immediate action is invalid");
  return errors;
}

function validateVaccination(data: FarmOperationData) {
  if (data.kind !== "vaccination") return ["data kind does not match vaccination"];
  const errors: string[] = [];
  if (!bounded(data.flockCode, 80)) errors.push("flock code is invalid");
  if (!bounded(data.house, 120)) errors.push("house is invalid");
  if (!bounded(data.vaccineCode, 120)) errors.push("vaccine code is invalid");
  if (!bounded(data.batchNumber, 120)) errors.push("batch number is invalid");
  if (!positive(data.dose)) errors.push("dose is invalid");
  if (!["dose", "ml", "l"].includes(data.doseUnit)) errors.push("dose unit is invalid");
  if (!bounded(data.administrationMethod, 120)) errors.push("administration method is invalid");
  if (!isoDate(data.administeredAt)) errors.push("administration date is invalid");
  if (data.reference !== undefined && !bounded(data.reference, 160)) errors.push("reference is invalid");
  if (data.notes !== undefined && !bounded(data.notes, 1000)) errors.push("vaccination notes are invalid");
  return errors;
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
  house: {
    resourceType: "house",
    initialState: "inactive",
    mutableStates: ["inactive", "active", "maintenance"],
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("inactive", "active", "edit", "inventory.edit"),
      transition("active", "maintenance", "edit", "inventory.edit"),
      transition("active", "inactive", "edit", "inventory.edit"),
      transition("maintenance", "active", "edit", "inventory.edit"),
      transition("maintenance", "inactive", "edit", "inventory.edit"),
    ],
    validate: validateHouse,
  },
  breed: {
    resourceType: "breed",
    initialState: "active",
    mutableStates: ["active", "inactive"],
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("active", "inactive", "edit", "inventory.edit"),
      transition("inactive", "active", "edit", "inventory.edit"),
    ],
    validate: validateBreed,
  },
  "flock-transfer": {
    resourceType: "flock-transfer",
    initialState: "planned",
    requireMakerChecker: true,
    mutableStates: ["planned", "approved"],
    permissions: { create: "inventory.edit", edit: "inventory.edit", delete: "inventory.edit" },
    transitions: [
      transition("planned", "approved", "approve", "inventory.edit", "inventory.approve"),
      transition("planned", "cancelled", "edit", "inventory.edit"),
      transition("approved", "completed", "edit", "inventory.edit"),
      transition("approved", "cancelled", "approve", "inventory.edit", "inventory.approve"),
    ],
    validate: validateFlockTransfer,
  },
  feed: {
    resourceType: "feed",
    initialState: "draft",
    permissions: { create: "farm.feed.edit", edit: "farm.feed.edit", delete: "farm.feed.edit" },
    transitions: [transition("draft", "posted", "edit", "farm.feed.edit")],
    validate: validateFeed,
  },
  "water-check": {
    resourceType: "water-check",
    initialState: "recorded",
    permissions: { create: "farm.create", edit: "farm.create", delete: "farm.create" },
    transitions: [transition("recorded", "reviewed", "edit", "farm.create")],
    validate: validateWaterCheck,
  },
  "medication-administration": {
    resourceType: "medication-administration",
    initialState: "recorded",
    permissions: { create: "farm.health.edit", edit: "farm.health.edit", delete: "farm.health.edit" },
    transitions: [transition("recorded", "reviewed", "edit", "farm.health.edit")],
    validate: validateMedicationAdministration,
  },
  "mortality-record": {
    resourceType: "mortality-record",
    initialState: "open",
    permissions: { create: "farm.create", edit: "farm.create", delete: "farm.create" },
    transitions: [transition("open", "reviewed", "edit", "farm.create")],
    validate: validateMortalityRecord,
  },
  "egg-batch": {
    resourceType: "egg-batch",
    initialState: "draft",
    requireMakerChecker: true,
    permissions: { create: "farm.eggs.edit", edit: "farm.eggs.edit", delete: "farm.eggs.edit" },
    transitions: [transition("draft", "verified", "approve", "farm.eggs.edit", "farm.eggs.approve")],
    validate: validateEggBatch,
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
    house: new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS.house, repository, now),
    breed: new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS.breed, repository, now),
    "flock-transfer": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["flock-transfer"], repository, now),
    feed: new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS.feed, repository, now),
    "water-check": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["water-check"], repository, now),
    "medication-administration": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["medication-administration"], repository, now),
    "mortality-record": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["mortality-record"], repository, now),
    "egg-batch": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["egg-batch"], repository, now),
    "health-event": new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS["health-event"], repository, now),
    vaccination: new ResourceWorkflowService(FARM_OPERATION_DEFINITIONS.vaccination, repository, now),
  });
}

// Canonical-source validation for Stage24 feed lineage; retained legacy kinds stay unchanged.
export { isValidFarmOperationData } from "./farm-operational-stage24-core.ts";
