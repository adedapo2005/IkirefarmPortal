/**
 * Stage 21D — read-only reference discovery from existing authenticated APIs.
 * The backend enforces principal, company/location and record permissions.
 * This module never writes, caches records, or promotes a fixture to production.
 */

type SuggestionSource = Readonly<{
  endpoint: string;
  resourceType: string;
  viewPermission: string;
  displayKeys: readonly string[];
  referenceKeys: readonly string[];
  label: string;
}>;

const sources: Readonly<Record<string, SuggestionSource>> = Object.freeze({
  eggs: { endpoint: "/api/portal/v7/farm-operations/flock", resourceType: "flock", viewPermission: "inventory.view", displayKeys: ["flockCode"], referenceKeys: ["flockCode"], label: "Flock" },
  vaccinations: { endpoint: "/api/portal/v7/farm-operations/flock", resourceType: "flock", viewPermission: "inventory.view", displayKeys: ["flockCode"], referenceKeys: ["flockCode"], label: "Flock" },
  procurement: { endpoint: "/api/portal/v7/inventory-procurement/supplier", resourceType: "supplier", viewPermission: "procurement.view", displayKeys: ["name", "supplierCode"], referenceKeys: ["supplierCode"], label: "Supplier" },
  suppliers: { endpoint: "/api/portal/v7/inventory-procurement/supplier", resourceType: "supplier", viewPermission: "procurement.view", displayKeys: ["name", "supplierCode"], referenceKeys: ["supplierCode"], label: "Supplier" },
  sales: { endpoint: "/api/portal/v7/commercial-finance/customer", resourceType: "customer", viewPermission: "commercial.view", displayKeys: ["name", "customerCode"], referenceKeys: ["customerCode"], label: "Customer" },
  customers: { endpoint: "/api/portal/v7/commercial-finance/customer", resourceType: "customer", viewPermission: "commercial.view", displayKeys: ["name", "customerCode"], referenceKeys: ["customerCode"], label: "Customer" },
  employees: { endpoint: "/api/portal/v7/people-hr/employee-record", resourceType: "hr-employee-record", viewPermission: "hr.employee.view", displayKeys: ["reference"], referenceKeys: ["reference"], label: "Employee reference" },
});

export type AuthorizedRecordSuggestion = Readonly<{
  id: string;
  label: string;
  reference: string;
  revision: number;
  source: "authenticated-record";
}>;

export type AuthorizedSuggestionsResult = Readonly<{
  status: "available" | "no-data" | "not-configured" | "enter-query" |
    "permission-required" | "authentication-required" | "unavailable";
  items: readonly AuthorizedRecordSuggestion[];
}>;

export function suggestionSource(formId: string): SuggestionSource | null {
  return Object.prototype.hasOwnProperty.call(sources, formId) ? sources[formId] : null;
}

const empty = (status: AuthorizedSuggestionsResult["status"]): AuthorizedSuggestionsResult => ({
  status, items: [],
});

function cleanText(data: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim() && value.length <= 160) return value.trim();
  }
  return "";
}

export function parseAuthorizedSuggestions(
  payload: unknown,
  source: SuggestionSource,
  query: string,
): AuthorizedSuggestionsResult {
  if (!payload || typeof payload !== "object" || !("items" in payload) ||
    !Array.isArray(payload.items) || !("state" in payload) ||
    !["available", "no-data"].includes(String(payload.state)) ||
    ("nextCursor" in payload && payload.nextCursor !== null && typeof payload.nextCursor !== "string")) {
    return empty("unavailable");
  }
  const accepted: AuthorizedRecordSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of payload.items) {
    if (!item || typeof item !== "object" ||
      typeof item.id !== "string" || !item.id ||
      typeof item.state !== "string" || item.resourceType !== source.resourceType ||
      !Number.isInteger(item.revision) || item.revision < 1 ||
      !item.data || typeof item.data !== "object" || Array.isArray(item.data)) {
      return empty("unavailable");
    }
    const record = item.data as Record<string, unknown>;
    const label = cleanText(record, source.displayKeys);
    const reference = cleanText(record, source.referenceKeys);
    if (!reference) continue; // Do not invent a reference from an opaque server ID.
    if (query && !(label + " " + reference).toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    accepted.push({ id: item.id, label: label || reference, reference, revision: item.revision, source: "authenticated-record" });
    if (accepted.length >= 8) break;
  }
  return { status: accepted.length ? "available" : "no-data", items: accepted };
}

export async function findAuthorizedRecordSuggestions(
  formId: string,
  rawQuery: string,
  hasViewPermission: (permission: string) => boolean,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<AuthorizedSuggestionsResult> {
  const source = suggestionSource(formId);
  if (!source) return empty("not-configured");
  if (!hasViewPermission(source.viewPermission)) return empty("permission-required");
  const query = rawQuery.trim().slice(0, 100);
  if (query.length < 2) return empty("enter-query");
  const url = source.endpoint + "?" + new URLSearchParams({ limit: "50", q: query });
  try {
    const response = await fetcher(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { accept: "application/json" },
      signal,
    });
    if (response.status === 401) return empty("authentication-required");
    if (!response.ok) return empty("unavailable");
    return parseAuthorizedSuggestions(await response.json() as unknown, source, query);
  } catch {
    return empty("unavailable");
  }
}
