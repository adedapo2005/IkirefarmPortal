import {
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRepository,
  type ResourceTransition,
} from "./resource-workflow.ts";

export type CustomerData = Readonly<{
  kind: "customer";
  customerCode: string;
  name: string;
  status: "active" | "inactive";
  contactEmail?: string;
  phone?: string;
  evidenceIds?: readonly string[];
}>;

export type SalesOrderData = Readonly<{
  kind: "sales-order";
  orderCode: string;
  customerCode: string;
  itemCode: string;
  quantity: number;
  unit: "unit" | "kg" | "bag" | "ton" | "litre";
  currency: string;
  unitPrice: number;
  orderedAt: string;
  evidenceIds?: readonly string[];
}>;

export type RevenueData = Readonly<{
  kind: "revenue";
  revenueCode: string;
  sourceType: "customer" | "sales-order" | "other";
  sourceId?: string;
  description: string;
  amount: number;
  currency: string;
  recordedAt: string;
  paymentStatus: "pending" | "partial" | "received";
  evidenceIds?: readonly string[];
}>;

export type ExpenseData = Readonly<{
  kind: "expense";
  expenseCode: string;
  category: string;
  amount: number;
  currency: string;
  incurredAt: string;
  description: string;
  evidenceIds?: readonly string[];
}>;

export type LedgerEntryData = Readonly<{
  kind: "ledger-entry";
  entryCode: string;
  accountCode: string;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  occurredAt: string;
  sourceType: "sales-order" | "expense" | "manual";
  sourceId?: string;
  evidenceIds?: readonly string[];
}>;

export type CommercialFinanceData =
  | CustomerData
  | SalesOrderData
  | RevenueData
  | ExpenseData
  | LedgerEntryData;
export type CommercialFinanceKind = CommercialFinanceData["kind"];
export type CommercialFinanceService = ResourceWorkflowService<CommercialFinanceData>;
export type CommercialFinanceServices =
  Readonly<Record<CommercialFinanceKind, CommercialFinanceService>>;

const units = ["unit", "kg", "bag", "ton", "litre"] as const;
const directions = ["debit", "credit"] as const;
const sourceTypes = ["sales-order", "expense", "manual"] as const;
const revenueSourceTypes = ["customer", "sales-order", "other"] as const;
const revenuePaymentStatuses = ["pending", "partial", "received"] as const;

function bounded(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function positive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// Values are persisted as numbers, so enforce ISO currency minor-unit precision
// and safe integer storage at the smallest unit.
const zeroMinorUnits = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"]);
const threeMinorUnits = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

function monetary(value: unknown, currency: string, allowZero = false) {
  const scale = zeroMinorUnits.has(currency) ? 1 : threeMinorUnits.has(currency) ? 1000 : 100;
  if (typeof value !== "number" || !Number.isFinite(value) || !(allowZero ? value >= 0 : value > 0))
    return false;

  // Check decimal precision from the canonical decimal spelling. Multiplying
  // a valid value such as 0.29 by 100 can produce 28.999999999999996 in IEEE
  // 754, so a direct integer check incorrectly rejects normal currency input.
  const [coefficient, exponentText] = value.toString().toLowerCase().split("e");
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = `${whole}${fraction}`;
  const decimalPlaces = fraction.length - exponent;
  const scalePlaces = scale === 1000 ? 3 : scale === 100 ? 2 : 0;
  const shift = scalePlaces - decimalPlaces;
  let minorUnits: bigint;
  try {
    const coefficientValue = BigInt(digits);
    if (shift >= 0) {
      minorUnits = coefficientValue * (BigInt(10) ** BigInt(shift));
    } else {
      const divisor = BigInt(10) ** BigInt(-shift);
      if (coefficientValue % divisor !== BigInt(0)) return false;
      minorUnits = coefficientValue / divisor;
    }
  } catch {
    return false;
  }
  return minorUnits <= BigInt(Number.MAX_SAFE_INTEGER);
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
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return false;
  return true;
}

function evidenceErrors(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return ["evidence ids are invalid"];
  return value.flatMap((id) => bounded(id, 120) ? [] : ["evidence ids are invalid"]);
}

function commonErrors(data: CommercialFinanceData, kind: CommercialFinanceKind) {
  return data.kind === kind ? [] : ["data kind does not match resource"];
}

function validateCustomer(data: CommercialFinanceData) {
  const errors = commonErrors(data, "customer");
  if (data.kind !== "customer") return errors;
  if (!bounded(data.customerCode, 80)) errors.push("customer code is invalid");
  if (!bounded(data.name, 160)) errors.push("customer name is invalid");
  if (![ "active", "inactive" ].includes(data.status)) errors.push("customer status is invalid");
  if (data.contactEmail !== undefined && (!bounded(data.contactEmail, 320) || !data.contactEmail.includes("@")))
    errors.push("customer contact is invalid");
  if (data.phone !== undefined && !bounded(data.phone, 80)) errors.push("customer phone is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateSalesOrder(data: CommercialFinanceData) {
  const errors = commonErrors(data, "sales-order");
  if (data.kind !== "sales-order") return errors;
  if (!bounded(data.orderCode, 80)) errors.push("order code is invalid");
  if (!bounded(data.customerCode, 80)) errors.push("customer code is invalid");
  if (!bounded(data.itemCode, 80)) errors.push("item code is invalid");
  if (!positive(data.quantity)) errors.push("quantity is invalid");
  if (!units.includes(data.unit)) errors.push("unit is invalid");
  if (!/^[A-Z]{3}$/.test(data.currency)) errors.push("currency is invalid");
  if (!monetary(data.unitPrice, data.currency, true)) errors.push("unit price is invalid");
  if (!isoDate(data.orderedAt)) errors.push("order date is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateRevenue(data: CommercialFinanceData) {
  const errors = commonErrors(data, "revenue");
  if (data.kind !== "revenue") return errors;
  if (!bounded(data.revenueCode, 80)) errors.push("revenue code is invalid");
  if (!revenueSourceTypes.includes(data.sourceType)) errors.push("revenue source type is invalid");
  if (data.sourceType === "other" && data.sourceId !== undefined) errors.push("other revenue cannot reference a business record");
  if (data.sourceType !== "other" && data.sourceId === undefined) errors.push("revenue source id is required");
  if (data.sourceId !== undefined && !bounded(data.sourceId, 120)) errors.push("revenue source id is invalid");
  if (!bounded(data.description, 1000)) errors.push("revenue description is invalid");
  if (!monetary(data.amount, data.currency)) errors.push("revenue amount is invalid");
  if (!/^[A-Z]{3}$/.test(data.currency)) errors.push("currency is invalid");
  if (!isoDate(data.recordedAt)) errors.push("revenue date is invalid");
  if (!revenuePaymentStatuses.includes(data.paymentStatus)) errors.push("payment status is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateExpense(data: CommercialFinanceData) {
  const errors = commonErrors(data, "expense");
  if (data.kind !== "expense") return errors;
  if (!bounded(data.expenseCode, 80)) errors.push("expense code is invalid");
  if (!bounded(data.category, 120)) errors.push("expense category is invalid");
  if (!monetary(data.amount, data.currency)) errors.push("expense amount is invalid");
  if (!/^[A-Z]{3}$/.test(data.currency)) errors.push("currency is invalid");
  if (!isoDate(data.incurredAt)) errors.push("expense date is invalid");
  if (!bounded(data.description, 1000)) errors.push("expense description is invalid");
  errors.push(...evidenceErrors(data.evidenceIds));
  return errors;
}

function validateLedgerEntry(data: CommercialFinanceData) {
  const errors = commonErrors(data, "ledger-entry");
  if (data.kind !== "ledger-entry") return errors;
  if (!bounded(data.entryCode, 80)) errors.push("entry code is invalid");
  if (!bounded(data.accountCode, 80)) errors.push("account code is invalid");
  if (!directions.includes(data.direction)) errors.push("entry direction is invalid");
  if (!monetary(data.amount, data.currency)) errors.push("entry amount is invalid");
  if (!/^[A-Z]{3}$/.test(data.currency)) errors.push("currency is invalid");
  if (!isoDate(data.occurredAt)) errors.push("entry date is invalid");
  if (!sourceTypes.includes(data.sourceType)) errors.push("source type is invalid");
  if (data.sourceType === "manual" && data.sourceId !== undefined) errors.push("manual entries cannot reference a business source");
  if (data.sourceType !== "manual" && data.sourceId === undefined) errors.push("business source id is required");
  if (data.sourceId !== undefined && !bounded(data.sourceId, 120)) errors.push("source id is invalid");
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

export const COMMERCIAL_FINANCE_DEFINITIONS:
  Readonly<Record<CommercialFinanceKind, ResourceDefinition<CommercialFinanceData>>> = {
  customer: {
    resourceType: "customer",
    initialState: "active",
    mutableStates: ["active", "inactive"],
    permissions: { create: "commercial.edit", edit: "commercial.edit", delete: "commercial.edit" },
    transitions: [transition("active", "inactive", "edit", "commercial.edit")],
    validate: validateCustomer,
  },
  "sales-order": {
    resourceType: "sales-order",
    initialState: "draft",
    requireMakerChecker: true,
    mutableStates: ["draft", "rejected"],
    permissions: { create: "commercial.edit", edit: "commercial.edit", delete: "commercial.edit" },
    transitions: [
      transition("draft", "submitted", "edit", "commercial.edit"),
      transition("submitted", "approved", "approve", "commercial.edit", "commercial.approve"),
      transition("submitted", "rejected", "edit", "commercial.edit"),
      transition("rejected", "draft", "edit", "commercial.edit"),
      transition("approved", "fulfilled", "edit", "commercial.edit"),
      transition(["draft", "submitted", "approved"], "cancelled", "edit", "commercial.edit"),
    ],
    validate: validateSalesOrder,
  },
  revenue: {
    resourceType: "revenue",
    initialState: "draft",
    requireMakerChecker: true,
    mutableStates: ["draft", "rejected"],
    permissions: { create: "finance.create", edit: "finance.edit", delete: "finance.edit" },
    transitions: [
      transition("draft", "submitted", "edit", "finance.edit"),
      transition("submitted", "confirmed", "approve", "finance.edit", "finance.approve"),
      transition("submitted", "rejected", "edit", "finance.edit"),
      transition("rejected", "draft", "edit", "finance.edit"),
      transition(["draft", "submitted"], "cancelled", "edit", "finance.edit"),
    ],
    validate: validateRevenue,
  },
  expense: {
    resourceType: "expense",
    initialState: "draft",
    requireMakerChecker: true,
    mutableStates: ["draft", "rejected"],
    permissions: { create: "finance.create", edit: "finance.edit", delete: "finance.edit" },
    transitions: [
      transition("draft", "submitted", "edit", "finance.edit"),
      transition("submitted", "approved", "approve", "finance.edit", "finance.approve"),
      transition("submitted", "rejected", "edit", "finance.edit"),
      transition("rejected", "draft", "edit", "finance.edit"),
      // Posting commits an approved expense into the finance ledger, so it is
      // a second financial approval step and must be performed by a checker.
      transition("approved", "posted", "approve", "finance.edit", "finance.approve"),
      transition(["draft", "submitted"], "cancelled", "edit", "finance.edit"),
    ],
    validate: validateExpense,
  },
  "ledger-entry": {
    resourceType: "ledger-entry",
    initialState: "draft",
    requireMakerChecker: true,
    mutableStates: ["draft"],
    permissions: { create: "finance.create", edit: "finance.edit", delete: "finance.edit" },
    transitions: [
      transition("draft", "posted", "approve", "finance.edit", "finance.approve"),
      transition("posted", "reversed", "approve", "finance.edit", "finance.approve"),
    ],
    validate: validateLedgerEntry,
  },
};

export function createCommercialFinanceServices(
  repository: ResourceRepository<CommercialFinanceData>,
  now?: () => string,
): CommercialFinanceServices {
  return Object.freeze({
    customer: new ResourceWorkflowService(COMMERCIAL_FINANCE_DEFINITIONS.customer, repository, now),
    "sales-order": new ResourceWorkflowService(COMMERCIAL_FINANCE_DEFINITIONS["sales-order"], repository, now),
    revenue: new ResourceWorkflowService(COMMERCIAL_FINANCE_DEFINITIONS.revenue, repository, now),
    expense: new ResourceWorkflowService(COMMERCIAL_FINANCE_DEFINITIONS.expense, repository, now),
    "ledger-entry": new ResourceWorkflowService(COMMERCIAL_FINANCE_DEFINITIONS["ledger-entry"], repository, now),
  });
}
