// Read-only projection of authorized Finance entries. This is NOT a balanced journal.
export type FinanceLedgerEntry = Readonly<{
  id: string;
  revision: number;
  state: "draft" | "posted" | "reversed";
  entryCode: string;
  accountCode: string;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  occurredAt: string;
  sourceType: "manual" | "sales-order" | "expense";
  sourceId?: string;
  evidenceCount: number;
}>;

export type FinanceLedgerListing = Readonly<{
  state: "available" | "no-data";
  entries: FinanceLedgerEntry[];
  nextCursor: string | null;
}>;

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

export function parseFinanceLedgerListing(payload: unknown): FinanceLedgerListing {
  if (!object(payload) || !Array.isArray(payload.items)
    || !["available", "no-data"].includes(String(payload.state))
    || (payload.nextCursor !== null && typeof payload.nextCursor !== "string")) {
    throw new Error("FINANCE_LEDGER_INVALID_RESPONSE");
  }
  if (payload.items.length > 10000) throw new Error("FINANCE_LEDGER_OVERSIZED_RESPONSE");
  if (payload.state === "no-data" && payload.items.length) throw new Error("FINANCE_LEDGER_INCONSISTENT_STATE");
  const seen = new Set<string>();
  const entries: FinanceLedgerEntry[] = payload.items.map((item: unknown) => {
    if (!object(item) || item.resourceType !== "ledger-entry" || !bounded(item.id, 120)
      || !Number.isInteger(item.revision) || Number(item.revision) < 1
      || !["draft", "posted", "reversed"].includes(String(item.state))
      || !object(item.data)) throw new Error("FINANCE_LEDGER_INVALID_RECORD");
    const data = item.data;
    if (seen.has(item.id)) throw new Error("FINANCE_LEDGER_DUPLICATE_RECORD");
    seen.add(item.id);
    if (data.kind !== "ledger-entry" || !bounded(data.entryCode, 80)
      || !bounded(data.accountCode, 80)
      || !["debit", "credit"].includes(String(data.direction))
      || typeof data.amount !== "number" || !Number.isFinite(data.amount)
      || data.amount <= 0 || data.amount > Number.MAX_SAFE_INTEGER
      || typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency)
      || !bounded(data.occurredAt, 40) || Number.isNaN(Date.parse(data.occurredAt))
      || !["manual", "sales-order", "expense"].includes(String(data.sourceType))
      || (data.sourceType === "manual" && data.sourceId !== undefined)
      || (data.sourceType !== "manual" && !bounded(data.sourceId, 120))
      || (data.evidenceIds !== undefined
        && (!Array.isArray(data.evidenceIds) || data.evidenceIds.length > 20
          || !data.evidenceIds.every((id: unknown) => bounded(id, 120))))) {
      throw new Error("FINANCE_LEDGER_INVALID_RECORD");
    }
    return {
      id: item.id,
      revision: Number(item.revision),
      state: item.state as FinanceLedgerEntry["state"],
      entryCode: data.entryCode,
      accountCode: data.accountCode,
      direction: data.direction as FinanceLedgerEntry["direction"],
      amount: data.amount,
      currency: data.currency,
      occurredAt: data.occurredAt,
      sourceType: data.sourceType as FinanceLedgerEntry["sourceType"],
      ...(typeof data.sourceId === "string" ? { sourceId: data.sourceId } : {}),
      evidenceCount: Array.isArray(data.evidenceIds) ? data.evidenceIds.length : 0,
    };
  });
  return { state: payload.state as FinanceLedgerListing["state"], entries,
    nextCursor: payload.nextCursor };
}

export const formatFinanceLedgerAmount = (entry: FinanceLedgerEntry) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: entry.currency,
    currencyDisplay: "symbol" }).format(entry.amount);

export const formatFinanceLedgerDate = (iso: string) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
  }).format(new Date(iso));
