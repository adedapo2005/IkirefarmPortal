import {
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRepository,
} from "./resource-workflow.ts";

// Pre-activation financial-integrity contract: the application has no public
// journal mutation endpoint. No legacy individual ledger entry is certified by this contract.
export const JOURNAL_POSTING_ENABLED = false as const;
export const JOURNAL_RECORD_TYPE = "finance-journal" as const;
export const JOURNAL_MINOR_UNIT_DIGITS = Object.freeze({
  NGN: 2, USD: 2, GBP: 2, EUR: 2, JPY: 0,
} as const);
export type JournalCurrency = keyof typeof JOURNAL_MINOR_UNIT_DIGITS;

export type BalancedJournalLine = Readonly<{
  lineId: string;
  accountCode: string;
  direction: "debit" | "credit";
  // Always canonical positive integer minor units. Never round a float.
  amountMinor: string;
}>;
export type BalancedJournalData = Readonly<{
  kind: "finance-journal";
  journalCode: string;
  memo: string;
  currency: JournalCurrency;
  occurredAt: string;
  sourceType: "manual";
  evidenceIds?: readonly string[];
  lines: readonly BalancedJournalLine[];
}>;
export type BalancedJournalTotals = Readonly<{
  currency: JournalCurrency;
  debitMinor: string;
  creditMinor: string;
  balanced: boolean;
  lineCount: number;
}>;
const codePattern = /^[A-Z0-9][A-Z0-9_.-]{1,39}$/;
const journalPattern = /^[A-Z][A-Z0-9-]{2,63}$/;
const minorPattern = /^[1-9][0-9]{0,15}$/;
const maxSafeMinor = BigInt(Number.MAX_SAFE_INTEGER);
const bounded = (x: unknown, max: number) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max;
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const hasOnly = (value: Record<string, unknown>, accepted: readonly string[]) =>
  Object.keys(value).every(key => accepted.includes(key));

function realTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m || !Number.isFinite(Date.parse(value))) return false;
  const [ ,year,month,day,hour,minute,second,zone] = m;
  const calendar = new Date(Date.UTC(Number(year), Number(month)-1, Number(day)));
  return calendar.getUTCFullYear() === Number(year) && calendar.getUTCMonth()+1 === Number(month)
    && calendar.getUTCDate() === Number(day)
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59
    && (zone === "Z" || (Number(zone.slice(1,3)) <= 23 && Number(zone.slice(4,6)) <= 59));
}
function validMinor(value: unknown): value is string {
  if (typeof value !== "string" || !minorPattern.test(value)) return false;
  try {
    const amount = BigInt(value);
    return amount > BigInt(0) && amount <= maxSafeMinor;
  } catch {
    return false;
  }
}

export function validateBalancedJournal(input: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(input) || !hasOnly(input, ["kind","journalCode","memo","currency","occurredAt","sourceType","evidenceIds","lines"])) {
    return ["journal shape is invalid"];
  }
  if (input.kind !== JOURNAL_RECORD_TYPE || typeof input.journalCode !== "string"
    || !journalPattern.test(input.journalCode)) errors.push("journal identity is invalid");
  if (!bounded(input.memo, 500)) errors.push("journal memo is required");
  if (typeof input.currency !== "string" ||
    !Object.prototype.hasOwnProperty.call(JOURNAL_MINOR_UNIT_DIGITS, input.currency)) {
    errors.push("journal currency is not supported");
  }
  if (!realTimestamp(input.occurredAt)) errors.push("journal timestamp is invalid");
  if (input.sourceType !== "manual") errors.push("journal source is not activated");
  if (input.evidenceIds !== undefined &&
    (!Array.isArray(input.evidenceIds) || input.evidenceIds.length > 20 ||
      !input.evidenceIds.every(id => bounded(id, 120)) ||
      new Set(input.evidenceIds).size !== input.evidenceIds.length)) {
    errors.push("journal evidence references are invalid");
  }
  if (!Array.isArray(input.lines) || input.lines.length < 2 || input.lines.length > 50) {
    errors.push("journal requires 2–50 lines");
    return errors;
  }
  const lineIds = new Set<string>();
  const accounts = new Set<string>();
  const debitAccounts = new Set<string>();
  const creditAccounts = new Set<string>();
  let debit = BigInt(0), credit = BigInt(0);
  input.lines.forEach((item, index) => {
    if (!isRecord(item) || !hasOnly(item, ["lineId","accountCode","direction","amountMinor"])
      || typeof item.lineId !== "string" || !codePattern.test(item.lineId)
      || typeof item.accountCode !== "string" || !codePattern.test(item.accountCode)
      || !["debit","credit"].includes(String(item.direction)) || !validMinor(item.amountMinor)) {
      errors.push("journal line " + (index + 1) + " is invalid");
      return;
    }
    if (lineIds.has(item.lineId)) errors.push("journal line identity is duplicated");
    lineIds.add(item.lineId);
    accounts.add(item.accountCode);
    if (item.direction === "debit") {
      debitAccounts.add(item.accountCode); debit += BigInt(item.amountMinor);
    } else {
      creditAccounts.add(item.accountCode); credit += BigInt(item.amountMinor);
    }
  });
  if (accounts.size < 2) errors.push("journal needs two distinct accounts");
  if ([...debitAccounts].some(account => creditAccounts.has(account)))
    errors.push("journal cannot balance an account against itself");
  if (debit === BigInt(0) || credit === BigInt(0)) errors.push("journal needs debits and credits");
  if (debit !== credit) errors.push("journal debits and credits do not balance");
  if (debit > maxSafeMinor || credit > maxSafeMinor) errors.push("journal minor-unit total exceeds safe limit");
  return errors;
}

export function balancedJournalTotals(value: unknown): BalancedJournalTotals {
  const errors = validateBalancedJournal(value);
  if (errors.length || !isRecord(value) || !Array.isArray(value.lines)) {
    throw new Error("FINANCE_JOURNAL_NOT_BALANCED");
  }
  const lines = value.lines as BalancedJournalLine[];
  const sum = (direction: "debit" | "credit") =>
    lines.filter(line => line.direction === direction).reduce((total,line) => total + BigInt(line.amountMinor), BigInt(0)).toString();
  return Object.freeze({
    currency: value.currency as JournalCurrency, debitMinor: sum("debit"),
    creditMinor: sum("credit"), balanced: true, lineCount: lines.length,
  });
}

export const BALANCED_JOURNAL_DEFINITION: ResourceDefinition<BalancedJournalData> = Object.freeze({
  resourceType: JOURNAL_RECORD_TYPE,
  initialState: "draft",
  requireMakerChecker: true,
  mutableStates: ["draft"],
  permissions: { create: "finance.create", edit: "finance.edit", delete: "finance.edit" },
  transitions: [
    { from: "draft", to: "submitted", action: "edit" as const, permission: "finance.edit" },
    { from: "submitted", to: "posted", action: "approve" as const, permission: "finance.edit", approvalPermission: "finance.approve" },
  ],
  validate: validateBalancedJournal,
});

export const createBalancedJournalWorkflow = (repository: ResourceRepository<BalancedJournalData>, now?: () => string) =>
  new ResourceWorkflowService(BALANCED_JOURNAL_DEFINITION, repository, now);
