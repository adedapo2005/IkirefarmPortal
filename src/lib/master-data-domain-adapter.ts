/**
 * FarmPortal #107 / 108C: adapter boundary for existing typed domain records.
 *
 * Only domain records that are already master-like are projected here:
 * flock, house, breed, supplier and customer. Operational evidence such as
 * opening counts, movements, feed events and orders is deliberately rejected.
 *
 * The caller must first resolve the authenticated principal, apply the domain
 * API's visibility check and include updatedAt from the same D1 read. This
 * module performs no database read, write, migration or permission grant.
 */

import {
  canonicalizeMasterChoice,
  type MasterChoice,
  type MasterSelectorScope,
} from "./master-data-selector-core.ts";

export type MasterDomainRecord = Readonly<{
  id: string;
  resourceType: string;
  state: string;
  revision: number;
  subject: Readonly<Record<string, unknown>>;
  updatedAt: string;
  data: unknown;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const bounded = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum;

type Projection = Readonly<{
  code: string;
  name: string;
  type: "flock" | "house" | "breed" | "supplier" | "customer";
  active: boolean;
}>;

function projection(record: MasterDomainRecord): Projection | null {
  if (!isRecord(record.data) || record.data.kind !== record.resourceType) return null;
  const data = record.data;
  switch (record.resourceType) {
    case "flock":
      return bounded(data.flockCode, 80) && bounded(data.name, 120)
        ? { code: data.flockCode.trim(), name: data.name.trim(), type: "flock", active: record.state === "active" }
        : null;
    case "house":
      return bounded(data.houseCode, 80) && bounded(data.name, 120)
        ? { code: data.houseCode.trim(), name: data.name.trim(), type: "house", active: record.state === "active" }
        : null;
    case "breed":
      return bounded(data.breedCode, 80) && bounded(data.name, 120)
        ? { code: data.breedCode.trim(), name: data.name.trim(), type: "breed", active: record.state === "active" }
        : null;
    case "supplier":
      return bounded(data.supplierCode, 80) && bounded(data.name, 160) &&
        (data.status === "active" || data.status === "inactive")
        ? { code: data.supplierCode.trim(), name: data.name.trim(), type: "supplier",
            active: record.state === "active" && data.status === "active" }
        : null;
    case "customer":
      return bounded(data.customerCode, 80) && bounded(data.name, 160) &&
        (data.status === "active" || data.status === "inactive")
        ? { code: data.customerCode.trim(), name: data.name.trim(), type: "customer",
            active: record.state === "active" && data.status === "active" }
        : null;
    default:
      return null;
  }
}

/**
 * Project a previously authorised domain record to the minimal 108C choice.
 * Inactive or malformed records return null and must not be offered to a
 * selector. Operational records are not treated as master data.
 */
export function projectDomainMasterChoice(
  record: MasterDomainRecord,
  expectedScope: MasterSelectorScope,
  expectedType?: Projection["type"],
): MasterChoice | null {
  if (!record || !bounded(record.updatedAt, 80) ||
      !Number.isSafeInteger(record.revision) || record.revision < 1) return null;
  const companyKey = record.subject.companyKey;
  const siteKey = record.subject.locationKey;
  if (!bounded(companyKey, 160) ||
      (siteKey !== undefined && !bounded(siteKey, 160))) return null;
  const value = projection(record);
  if (!value || !value.active) return null;
  if (expectedType && value.type !== expectedType) return null;
  return canonicalizeMasterChoice({
    id: record.id,
    code: value.code,
    name: value.name,
    type: value.type,
    active: true,
    scope: {
      companyKey: companyKey.trim(),
      ...(siteKey === undefined ? {} : { siteKey: String(siteKey).trim() }),
    },
    revision: record.revision,
    updatedAt: record.updatedAt,
  }, expectedScope, expectedType);
}
