/**
 * FarmPortal #107 / 108C: authenticated master-data selector backend.
 *
 * This is a read-only adapter over the existing resource_records D1 table.
 * It does not create a new master-data table, seed data, permission, writer,
 * migration or shared database mutation. The route caller must still keep
 * this endpoint behind the portal session boundary.
 */

import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import {
  ResourceWorkflowError,
} from "./resource-workflow.ts";
import {
  projectDomainMasterChoice,
  type MasterDomainRecord,
} from "./master-data-domain-adapter.ts";
import {
  selectMasterChoices,
  type MasterSelectorPage,
  type MasterSelectorQuery,
  type MasterSelectorScope,
} from "./master-data-selector-core.ts";

export const MASTER_SELECTOR_RESOURCE_TYPES = [
  "flock",
  "house",
  "breed",
  "supplier",
  "customer",
] as const;

type MasterSelectorResourceType = (typeof MASTER_SELECTOR_RESOURCE_TYPES)[number];

const MASTER_SELECTOR_PERMISSION: Readonly<Record<MasterSelectorResourceType, string>> = Object.freeze({
  flock: "inventory.view",
  house: "inventory.view",
  breed: "inventory.view",
  supplier: "procurement.view",
  customer: "commercial.view",
});

const MAX_MASTER_SELECTOR_RECORDS = 5_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const text = (value: unknown, maximum: number): string | null =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum
    ? value.trim()
    : null;

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function masterResourceType(value: unknown): MasterSelectorResourceType | null {
  return typeof value === "string" &&
    (MASTER_SELECTOR_RESOURCE_TYPES as readonly string[]).includes(value)
    ? value as MasterSelectorResourceType
    : null;
}

function selectorScope(principal: AuthenticatedPrincipal): MasterSelectorScope {
  const companyKey = text(principal.organizationScope?.companyKey, 160);
  const siteKey = text(principal.organizationScope?.locationKey, 160);
  if (!companyKey || !siteKey || principal.restriction === "disabled" || !principal.farmAuthorized) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["master-selector-scope-missing"]);
  }
  return { companyKey, siteKey };
}

function authorizationSubject(
  resourceType: MasterSelectorResourceType,
  id: string,
  raw: Record<string, unknown>,
): AuthorizationSubject | null {
  const companyKey = text(raw.companyKey, 160);
  const locationKey = text(raw.locationKey, 160);
  if (!companyKey || !locationKey) return null;
  const ownerId = raw.ownerId === undefined ? undefined : text(raw.ownerId, 160);
  const departmentKey = raw.departmentKey === undefined ? undefined : text(raw.departmentKey, 160);
  const assigneeIds = raw.assigneeIds === undefined
    ? undefined
    : Array.isArray(raw.assigneeIds) && raw.assigneeIds.every((item) => typeof item === "string" && item.length <= 160)
      ? raw.assigneeIds as string[]
      : null;
  if (assigneeIds === null) return null;
  return {
    resourceType,
    resourceId: id,
    companyKey,
    locationKey,
    ...(ownerId ? { ownerId } : {}),
    ...(departmentKey ? { departmentKey } : {}),
    ...(assigneeIds ? { assigneeIds } : {}),
  };
}

function decodeRow(row: Record<string, unknown>): MasterDomainRecord | null {
  const id = text(row.id, 160);
  const resourceType = masterResourceType(row.resource_type);
  const state = text(row.state, 80);
  const revision = row.revision;
  const updatedAt = text(row.updated_at, 80);
  const subject = parseJson(row.subject_json);
  const data = parseJson(row.data_json);
  if (!id || !resourceType || !state || !updatedAt ||
      !Number.isSafeInteger(revision) || Number(revision) < 1 ||
      !isRecord(subject) || !isRecord(data)) return null;
  return {
    id,
    resourceType,
    state,
    revision: Number(revision),
    subject,
    updatedAt,
    data,
  };
}

function invalidSelectorQuery() {
  return new ResourceWorkflowError("VALIDATION_FAILED", ["master selector query is invalid"]);
}

/**
 * Read active, same-company/site, authorised master-like records and apply
 * the tested selector search/paging contract. Operational evidence records are
 * never projected by the domain adapter.
 */
export async function getMasterSelectorPage(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  query: MasterSelectorQuery,
): Promise<MasterSelectorPage> {
  const scope = selectorScope(principal);
  const validation = selectMasterChoices([], query, scope);
  if (!validation) throw invalidSelectorQuery();
  if (query.type !== undefined && !masterResourceType(query.type)) {
    throw invalidSelectorQuery();
  }

  const requestedTypes = query.type
    ? [query.type as MasterSelectorResourceType]
    : [...MASTER_SELECTOR_RESOURCE_TYPES];
  const placeholders = requestedTypes.map(() => "?").join(",");
  const result = await db.prepare(
    "SELECT id, resource_type, state, revision, subject_json, data_json, updated_at " +
    "FROM resource_records " +
    "WHERE deleted_at IS NULL " +
    "AND resource_type IN (" + placeholders + ") " +
    "AND json_extract(subject_json, '$.companyKey') = ? " +
    "AND json_extract(subject_json, '$.locationKey') = ? " +
    "ORDER BY updated_at DESC, id ASC LIMIT ?",
  ).bind(...requestedTypes, scope.companyKey, scope.siteKey, MAX_MASTER_SELECTOR_RECORDS + 1)
    .all<Record<string, unknown>>();

  const rows = result.results || [];
  if (rows.length > MAX_MASTER_SELECTOR_RECORDS) {
    throw new Error("MASTER_SELECTOR_RECORD_LIMIT_EXCEEDED");
  }

  const choices = [];
  for (const row of rows) {
    const decoded = decodeRow(row);
    const decodedType = decoded && masterResourceType(decoded.resourceType);
    if (!decoded || !decodedType || decodedType !== row.resource_type) continue;
    // Do not trust the SQL predicate as the only boundary. This explicit
    // check prevents an owner short-circuit in the generic authorizer from
    // turning malformed/cross-scope rows into selector results.
    if (decoded.subject.companyKey !== scope.companyKey ||
        decoded.subject.locationKey !== scope.siteKey) continue;

    const subject = authorizationSubject(decodedType, decoded.id, decoded.subject);
    if (!subject || !authorize(principal, {
      channel: "api",
      action: "view",
      permission: MASTER_SELECTOR_PERMISSION[decodedType],
      subject,
    }).allowed) continue;

    const choice = projectDomainMasterChoice(
      decoded,
      scope,
      query.type as MasterSelectorResourceType | undefined,
    );
    if (choice) choices.push(choice);
  }

  return selectMasterChoices(choices, query, scope)!;
}

export function masterDataSelectorError(error: unknown) {
  if (error instanceof ResourceWorkflowError) {
    if (error.code === "AUTHORIZATION_DENIED") {
      return { body: { error: "NOT_FOUND" }, status: 404 as const };
    }
    if (error.code === "VALIDATION_FAILED") {
      return { body: { error: "INVALID_MASTER_SELECTOR" }, status: 422 as const };
    }
  }
  if (error instanceof Error && error.message === "MASTER_SELECTOR_RECORD_LIMIT_EXCEEDED") {
    return { body: { error: "MASTER_SELECTOR_TOO_LARGE" }, status: 503 as const };
  }
  return { body: { error: "MASTER_SELECTOR_UNAVAILABLE" }, status: 503 as const };
}