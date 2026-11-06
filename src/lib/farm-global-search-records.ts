/**
 * Stage21 NAV-08: render-safe projection for the existing authenticated D1
 * master selector. This is not a new search database or security authority.
 * The server must still resolve the session and authorize each source record.
 */
import type { Page, Persona } from "./portal-model.ts";
import { has } from "./portal-model.ts";

const MAX_SERVER_RECORDS = 16;
const routeForType = Object.freeze({
  flock: "flock-management",
  house: "houses",
  breed: "breed-management",
  supplier: "suppliers",
  customer: "customers",
} as const);

export type AuthorizedGlobalRecord = Readonly<{
  id: string;
  name: string;
  code?: string;
  type: keyof typeof routeForType;
  route: string;
  routeLabel: string;
}>;

type RecordPage = Readonly<{
  items: readonly AuthorizedGlobalRecord[];
  hasMore: boolean;
}>;

const noRecords: RecordPage = Object.freeze({ items: Object.freeze([]), hasMore: false });
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const boundedText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
};

/**
 * No record is allowed onto the command palette unless it is active,
 * server-projected, in the currently verified company/site, and has a
 * destination in the current render's permission-filtered page list.
 * Untrusted server fields (including raw data, scope and audit metadata)
 * never become client result properties.
 */
export function projectAuthorizedMasterRecords(
  payload: unknown,
  person: Persona,
  permittedPages: readonly Pick<Page, "id" | "title">[],
): RecordPage {
  if (person.principalSource !== "authenticated" || !person.farm ||
      person.restriction !== "none" ||
      !["owner", "assigned"].includes(person.accessState || "") ||
      !has(person, "search.view")) return noRecords;

  const company = boundedText(person.organizationScope?.companyKey, 160);
  const site = boundedText(person.organizationScope?.locationKey, 160);
  if (!company || !site || !isObject(payload) ||
      payload.source !== "authenticated-master-data" ||
      !Number.isInteger(payload.pageSize) || Number(payload.pageSize) < 1 ||
      Number(payload.pageSize) > MAX_SERVER_RECORDS ||
      typeof payload.hasMore !== "boolean" ||
      !Array.isArray(payload.items) ||
      payload.items.length > MAX_SERVER_RECORDS ||
      payload.items.length > Number(payload.pageSize)) return noRecords;

  const permitted = new Map(permittedPages.map((page) => [page.id, page.title]));
  const seen = new Set<string>();
  const items: AuthorizedGlobalRecord[] = [];
  for (const item of payload.items) {
    if (!isObject(item) || item.active !== true ||
        !isObject(item.scope) || item.scope.companyKey !== company ||
        item.scope.siteKey !== site ||
        !Number.isSafeInteger(item.revision) || Number(item.revision) < 1) continue;
    const id = boundedText(item.id, 160);
    const name = boundedText(item.name, 160);
    const type = boundedText(item.type, 80);
    const updatedAt = boundedText(item.updatedAt, 80);
    if (!id || !name || !type || !updatedAt ||
        !Number.isFinite(Date.parse(updatedAt)) ||
        !Object.prototype.hasOwnProperty.call(routeForType, type)) continue;
    const recordType = type as keyof typeof routeForType;
    const route = routeForType[recordType];
    const routeLabel = permitted.get(route);
    if (!routeLabel || seen.has(type + ":" + id)) continue;
    const code = item.code === undefined ? undefined : boundedText(item.code, 160);
    if (item.code !== undefined && !code) continue;
    seen.add(type + ":" + id);
    items.push(Object.freeze({
      id, name, ...(code ? { code } : {}), type: recordType, route, routeLabel,
    }));
  }
  return Object.freeze({ items: Object.freeze(items), hasMore: payload.hasMore });
}
