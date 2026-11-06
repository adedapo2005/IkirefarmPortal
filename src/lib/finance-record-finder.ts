import { parseFinanceLedgerListing, type FinanceLedgerEntry } from "./finance-ledger-evidence.ts";

export const financeFinderKinds = ["revenue", "expense", "ledger-entry"] as const;
export type FinanceFinderKind = (typeof financeFinderKinds)[number];

export type FinanceFinderRecord = Readonly<{
  key: string;
  id: string;
  kind: FinanceFinderKind;
  code: string;
  state: string;
  revision: number;
  occurredAt: string;
  amount: number;
  currency: string;
  evidenceCount: number;
  summary: string;
  sourceType?: string;
  sourceId?: string;
  direction?: "debit" | "credit";
  accountCode?: string;
  category?: string;
  paymentStatus?: "pending" | "partial" | "received";
}>;

export type FinanceFinderPage = Readonly<{
  records: readonly FinanceFinderRecord[];
  nextCursor: string | null;
  state: "available" | "no-data";
}>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const validCurrency = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value);
const zeroMinor = new Set(["BIF","CLP","DJF","GNF","ISK","JPY","KMF","KRW","PYG","RWF","UGX","UYI","VND","VUV","XAF","XOF","XPF"]);
const threeMinor = new Set(["BHD","IQD","JOD","KWD","LYD","OMR","TND"]);
function validAmount(amount: unknown, currency: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || !validCurrency(currency)) return false;
  const places = zeroMinor.has(currency) ? 0 : threeMinor.has(currency) ? 3 : 2;
  const [coefficient, exp] = amount.toString().toLowerCase().split("e");
  const [whole, decimal = ""] = coefficient.split(".");
  const precision = decimal.length - Number(exp ?? 0);
  const shift = places - precision;
  try {
    const digits = BigInt(whole + decimal);
    const minor = shift >= 0 ? digits * (BigInt(10) ** BigInt(shift)) :
      digits % (BigInt(10) ** BigInt(-shift)) === BigInt(0) ? digits / (BigInt(10) ** BigInt(-shift)) : -BigInt(1);
    return minor > BigInt(0) && minor <= BigInt(Number.MAX_SAFE_INTEGER);
  } catch { return false; }
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || Number.isNaN(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, zone] = parts;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return calendar.getUTCFullYear() === Number(year) && calendar.getUTCMonth() + 1 === Number(month)
    && calendar.getUTCDate() === Number(day) && Number(hour) <= 23 && Number(minute) <= 59
    && Number(second) <= 59 && (zone === "Z" ||
      (Number(zone.slice(1,3)) <= 23 && Number(zone.slice(4,6)) <= 59));
}
const stateValues: Record<FinanceFinderKind, readonly string[]> = {
  revenue: ["draft", "submitted", "confirmed", "rejected", "cancelled"],
  expense: ["draft", "submitted", "approved", "posted", "rejected", "cancelled"],
  "ledger-entry": ["draft", "posted", "reversed"],
};

const bad = (): never => { throw new Error("FINANCE_FINDER_INVALID_SOURCE"); };

function baseRecord(item: unknown, kind: FinanceFinderKind) {
  if (!isObject(item) || !bounded(item.id, 120) || item.resourceType !== kind
    || !Number.isInteger(item.revision) || Number(item.revision) < 1
    || !stateValues[kind].includes(String(item.state)) || !isObject(item.data)
    || item.data.kind !== kind || !validAmount(item.data.amount, item.data.currency)
    || !validCurrency(item.data.currency)) return bad();
  const evidence = item.data.evidenceIds;
  if (evidence !== undefined && (!Array.isArray(evidence) || evidence.length > 20
    || !evidence.every((x: unknown) => bounded(x, 120)))) return bad();
  return {
    id: item.id,
    key: kind + ":" + item.id,
    kind,
    state: item.state as string,
    revision: item.revision as number,
    amount: item.data.amount as number,
    currency: item.data.currency,
    evidenceCount: Array.isArray(evidence) ? evidence.length : 0,
    data: item.data,
  };
}

export function parseFinanceFinderPage(kind: FinanceFinderKind, payload: unknown): FinanceFinderPage {
  if (!financeFinderKinds.includes(kind) || !isObject(payload) || !Array.isArray(payload.items)
    || !["available", "no-data"].includes(String(payload.state))
    || (payload.nextCursor !== null && typeof payload.nextCursor !== "string")
    || payload.items.length > 2000
    || (payload.state === "no-data" && payload.items.length > 0)) return bad();

  if (kind === "ledger-entry") {
    const parsed = parseFinanceLedgerListing(payload);
    if (parsed.entries.some(entry => !validAmount(entry.amount, entry.currency) || !validDate(entry.occurredAt))) return bad();
    return {
      state: parsed.state,
      nextCursor: parsed.nextCursor,
      records: parsed.entries.map((entry: FinanceLedgerEntry): FinanceFinderRecord => ({
        key: "ledger-entry:" + entry.id,
        id: entry.id,
        kind: "ledger-entry",
        code: entry.entryCode,
        state: entry.state,
        revision: entry.revision,
        occurredAt: entry.occurredAt,
        amount: entry.amount,
        currency: entry.currency,
        evidenceCount: entry.evidenceCount,
        summary: "Ledger entry for account " + entry.accountCode,
        direction: entry.direction,
        accountCode: entry.accountCode,
        sourceType: entry.sourceType,
        ...(entry.sourceId ? { sourceId: entry.sourceId } : {}),
      })),
    };
  }

  const seen = new Set<string>();
  const records: FinanceFinderRecord[] = payload.items.map((item: unknown) => {
    const record = baseRecord(item, kind);
    if (seen.has(record.id)) return bad();
    seen.add(record.id);
    const d = record.data;
    if (kind === "revenue") {
      if (!bounded(d.revenueCode, 80) || !bounded(d.description, 1000)
        || !validDate(d.recordedAt)
        || !["customer", "sales-order", "other"].includes(String(d.sourceType))
        || !["pending", "partial", "received"].includes(String(d.paymentStatus))
        || (d.sourceType === "other" && d.sourceId !== undefined)
        || (d.sourceType !== "other" && !bounded(d.sourceId, 120))) return bad();
      return {
        key: record.key, id: record.id, kind, state: record.state, revision: record.revision,
        code: d.revenueCode, occurredAt: d.recordedAt, amount: record.amount, currency: record.currency,
        evidenceCount: record.evidenceCount, summary: d.description, sourceType: d.sourceType as string,
        ...(typeof d.sourceId === "string" ? { sourceId: d.sourceId } : {}),
        paymentStatus: d.paymentStatus as FinanceFinderRecord["paymentStatus"],
      };
    }
    if (!bounded(d.expenseCode, 80) || !bounded(d.description, 1000)
      || !bounded(d.category, 120) || !validDate(d.incurredAt)) return bad();
    return {
      key: record.key, id: record.id, kind, state: record.state, revision: record.revision,
      code: d.expenseCode, occurredAt: d.incurredAt, amount: record.amount,
      currency: record.currency, evidenceCount: record.evidenceCount,
      summary: d.description, category: d.category,
    };
  });
  return { records, state: payload.state as FinanceFinderPage["state"], nextCursor: payload.nextCursor as string | null };
}

// Refuse partial or inconsistent source results. These are record lists, never accounting journals.
export function combineFinanceFinderPages(pages: readonly FinanceFinderPage[]): readonly FinanceFinderRecord[] {
  if (pages.length !== financeFinderKinds.length || pages.some(p => p.nextCursor !== null)) return bad();
  const all = pages.flatMap(p => p.records);
  const keys = new Set(all.map(r => r.key));
  if (keys.size !== all.length) return bad();
  return [...all].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.key.localeCompare(b.key));
}

export function matchesFinanceFinderRecord(record: FinanceFinderRecord, query: string) {
  const words = [record.code, record.id, record.summary, record.kind, record.state,
    record.accountCode, record.sourceId, record.sourceType, record.currency,
    record.category, record.paymentStatus].filter(Boolean).join(" ").toLocaleLowerCase();
  return words.includes(query.trim().toLocaleLowerCase());
}

export function financeFinderMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount);
}
export function financeFinderWAT(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
}
