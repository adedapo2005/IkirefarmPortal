/**
 * FarmPortal Issue #107 / 108C: canonical selector core.
 *
 * This module is deliberately transport- and database-neutral. It gives the
 * existing backend owner one tested normalisation/paging boundary without
 * adding a route, writer, migration, seed data or permission. The caller must
 * resolve the authenticated principal and source records before calling it.
 */

export type MasterSelectorScope = Readonly<{
  companyKey: string;
  siteKey?: string;
}>;

export type MasterChoice = Readonly<{
  id: string;
  code?: string;
  name: string;
  type: string;
  unit?: string;
  active: true;
  scope: MasterSelectorScope;
  revision: number;
  updatedAt: string;
}>;

export type MasterSelectorQuery = Readonly<{
  q: string;
  type?: string;
  limit?: number;
  cursor?: string;
}>;

export type MasterSelectorPage = Readonly<{
  source: "authenticated-master-data";
  items: readonly MasterChoice[];
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}>;

export const MASTER_SELECTOR_PAGE_SIZE = 16;
const MAX_QUERY_LENGTH = 100;
const CURSOR_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean && clean.length <= max ? clean : null;
};

const normalizeKey = (value: string) => value.trim().toLocaleLowerCase("en-NG");

const validTimestamp = (value: string) => Number.isFinite(Date.parse(value));

const scopeKey = (scope: MasterSelectorScope) =>
  scope.companyKey.trim() + String.fromCharCode(0) + (scope.siteKey ?? "").trim();

function encodeCursor(value: Readonly<{ offset: number; q: string; type: string; scope: string }>) {
  const encoded = JSON.stringify({ v: CURSOR_VERSION, ...value });
  const bytes = new TextEncoder().encode(encoded);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCursor(value: unknown): { offset: number; q: string; type: string; scope: string } | null {
  if (typeof value !== "string" || value.length > 512 || !value) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(parsed) || parsed.v !== CURSOR_VERSION ||
        !Number.isSafeInteger(parsed.offset) || Number(parsed.offset) < 0 ||
        typeof parsed.q !== "string" || typeof parsed.type !== "string" ||
        typeof parsed.scope !== "string") return null;
    return {
      offset: Number(parsed.offset),
      q: parsed.q,
      type: parsed.type,
      scope: parsed.scope,
    };
  } catch {
    return null;
  }
}

/**
 * Convert one backend record into the deliberately minimal selector shape.
 * Any missing, inactive, cross-scope or malformed record is rejected.
 */
export function canonicalizeMasterChoice(
  value: unknown,
  expectedScope: MasterSelectorScope,
  expectedType?: string,
): MasterChoice | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 160);
  const name = text(value.name, 160);
  const type = text(value.type, 80);
  const companyKey = text(isRecord(value.scope) ? value.scope.companyKey : null, 160);
  const siteKey = isRecord(value.scope) && value.scope.siteKey !== undefined
    ? text(value.scope.siteKey, 160)
    : null;
  const code = value.code === undefined ? undefined : text(value.code, 160);
  const unit = value.unit === undefined ? undefined : text(value.unit, 80);
  const revision = value.revision;
  const updatedAt = text(value.updatedAt, 80);
  if (!id || !name || !type || !companyKey || !updatedAt ||
      !validTimestamp(updatedAt) || value.active !== true ||
      !Number.isSafeInteger(revision) || Number(revision) < 1 ||
      companyKey !== expectedScope.companyKey.trim() ||
      (expectedScope.siteKey ?? "").trim() !== (siteKey ?? "").trim() ||
      (expectedType && type !== expectedType)) return null;
  return Object.freeze({
    id,
    ...(code ? { code } : {}),
    name,
    type,
    ...(unit ? { unit } : {}),
    active: true,
    scope: Object.freeze({
      companyKey,
      ...(siteKey ? { siteKey } : {}),
    }),
    revision: Number(revision),
    updatedAt,
  });
}

/**
 * Apply the 108C search/limit/cursor semantics to already authorised records.
 * The database adapter remains responsible for tenant filtering and should
 * pass only records visible to the authenticated principal.
 */
export function selectMasterChoices(
  records: readonly MasterChoice[],
  query: MasterSelectorQuery,
  scope: MasterSelectorScope,
): MasterSelectorPage | null {
  const q = text(query.q, MAX_QUERY_LENGTH);
  if (!q || q.length < 2) return null;
  const type = query.type === undefined ? "" : text(query.type, 80);
  if (query.type !== undefined && !type) return null;
  const requestedLimit = query.limit === undefined ? MASTER_SELECTOR_PAGE_SIZE : query.limit;
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 ||
      requestedLimit > MASTER_SELECTOR_PAGE_SIZE) return null;
  const normalizedQ = normalizeKey(q);
  const normalizedType = type ? normalizeKey(type) : "";
  const expectedScope = scopeKey(scope);
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (query.cursor && (!cursor || cursor.q !== normalizedQ ||
      cursor.type !== normalizedType || cursor.scope !== expectedScope)) return null;
  const offset = cursor?.offset ?? 0;
  const matching = records
    .filter(item => item.active &&
      scopeKey(item.scope) === expectedScope &&
      (!normalizedType || normalizeKey(item.type) === normalizedType) &&
      [item.code, item.name].filter(Boolean).some(value => normalizeKey(value!).includes(normalizedQ)))
    .sort((left, right) =>
      normalizeKey(left.name).localeCompare(normalizeKey(right.name), "en-NG") ||
      left.id.localeCompare(right.id));
  const items = matching.slice(offset, offset + requestedLimit);
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < matching.length;
  return Object.freeze({
    source: "authenticated-master-data",
    items: Object.freeze(items),
    pageSize: requestedLimit,
    hasMore,
    nextCursor: hasMore
      ? encodeCursor({ offset: nextOffset, q: normalizedQ, type: normalizedType, scope: expectedScope })
      : null,
  });
}
