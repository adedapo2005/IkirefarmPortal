import { EggCorrectionHold, EGG_CORRECTION_HOLD } from "./egg-correction-hold.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import type { FarmWriteReceipt } from "./farm-write-receipt.ts";
import { transitionFarmOperation as transitionStage24FarmOperation } from "./farm-operational-stage24-api.ts";
import { assertEggWritePermission, resolveEggFlockForWrite } from "./stage24-release-egg-flock-integrity.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import {
  FARM_OPERATION_DEFINITIONS,
  createFarmOperationalServices,
  type FarmOperationData,
  type FarmOperationKind,
} from "./farm-operational-core.ts";
import { D1ResourceRepository } from "./resource-workflow-d1.ts";
import {
  ResourceWorkflowError,
  type ResourceRecord,
} from "./resource-workflow.ts";

export const FARM_OPERATION_API = Object.freeze({
  flock: { view: "inventory.view" },
  house: { view: "inventory.view" },
  breed: { view: "inventory.view" },
  "flock-transfer": { view: "inventory.view" },
  feed: { view: "farm.feed.view" },
  "water-check": { view: "farm.view" },
  "medication-administration": { view: "farm.health.view" },
  "mortality-record": { view: "farm.view" },
  "egg-batch": { view: "farm.eggs.view" },
  "health-event": { view: "farm.health.view" },
  vaccination: { view: "vaccination.view" },
} as const);

export function operationKind(value: string | undefined): FarmOperationKind | null {
  return value && Object.prototype.hasOwnProperty.call(FARM_OPERATION_API, value)
    ? value as FarmOperationKind
    : null;
}

export function operationViewPermission(kind: FarmOperationKind) {
  return FARM_OPERATION_API[kind].view;
}

export function operationSubject(
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  resourceId?: string,
) {
  const scope = principal.organizationScope;
  if (!scope) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  return Object.freeze({
    resourceType: FARM_OPERATION_DEFINITIONS[kind].resourceType,
    ...(resourceId ? { resourceId } : {}),
    companyKey: scope.companyKey,
    locationKey: scope.locationKey,
    departmentKey: scope.departmentKey,
  });
}

function decode(row: Record<string, unknown>): ResourceRecord<FarmOperationData> | null {
  if (typeof row.id !== "string" || typeof row.resource_type !== "string" ||
      typeof row.state !== "string" || typeof row.revision !== "number" ||
      typeof row.subject_json !== "string" || typeof row.data_json !== "string") return null;
  try {
    return Object.freeze({
      id: row.id,
      resourceType: row.resource_type,
      state: row.state,
      revision: row.revision,
      subject: JSON.parse(row.subject_json),
      data: JSON.parse(row.data_json),
    }) as ResourceRecord<FarmOperationData>;
  } catch {
    return null;
  }
}
// A DB row, unlike a navigation/collection request, is always an individual
// record. Its persisted subject must not contradict the authoritative DB ID
// or resource type. A missing legacy subject.resourceId can be bound from DB.
function hasBoundRecordIdentity(kind: FarmOperationKind, record: ResourceRecord<FarmOperationData>) {
  const subject = record.subject;
  const expectedType = FARM_OPERATION_DEFINITIONS[kind].resourceType;
  return record.resourceType === expectedType &&
    Boolean(record.data) && typeof record.data === "object" &&
    !Array.isArray(record.data) && record.data.kind === kind &&
    Boolean(subject) && typeof subject === "object" && !Array.isArray(subject) &&
    subject.resourceType === expectedType &&
    (subject.resourceId === undefined || subject.resourceId === record.id);
}
function visible(principal: AuthenticatedPrincipal, kind: FarmOperationKind, record: ResourceRecord<FarmOperationData>) {
  // Never let a malformed stored row take the relaxed collection-level path:
  // binding the actual DB ID enforces the full company + site requirement.
  if (!hasBoundRecordIdentity(kind, record)) return false;
  return authorize(principal, {
    channel: "api",
    action: "view",
    permission: operationViewPermission(kind),
    subject: { ...record.subject, resourceId: record.id },
  }).allowed;
}

async function rows(db: D1Database, kind: FarmOperationKind, id?: string) {
  const definition = FARM_OPERATION_DEFINITIONS[kind];
  if (id) {
    const result = await db.prepare("SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE id = ? AND resource_type = ? AND deleted_at IS NULL")
      .bind(id, definition.resourceType).all<Record<string, unknown>>();
    return (result.results || []).map(decode).filter((record): record is ResourceRecord<FarmOperationData> => record !== null);
  }
  // An initial LIMIT 200 previously hid authorised records whenever other
  // farms or newer records occupied the first page. D1 is read in bounded
  // pages; keep the existing server-side per-record permission/scope checks.
  const pageSize = 200;
  const records: ResourceRecord<FarmOperationData>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.prepare("SELECT id, resource_type, state, revision, subject_json, data_json FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?")
      .bind(definition.resourceType, pageSize, offset).all<Record<string, unknown>>();
    const page = result.results || [];
    records.push(...page.map(decode).filter((record): record is ResourceRecord<FarmOperationData> => record !== null));
    if (page.length < pageSize) break;
  }
  return records;
}

export async function listFarmOperations(db: D1Database, principal: AuthenticatedPrincipal, kind: FarmOperationKind) {
  const records = await rows(db, kind);
  return records.filter((record) => visible(principal, kind, record));
}

const OPERATIONS_SUMMARY_SPECS = [
  { id: "active-flocks", kind: "flock", state: "active", label: "Active Flocks", route: "flocks" },
  { id: "posted-feed", kind: "feed", state: "posted", label: "Posted Feed Movements", route: "feed" },
  { id: "open-health", kind: "health-event", state: "open", label: "Open Health Events", route: "health" },
  { id: "verified-eggs", kind: "egg-batch", state: "verified", label: "Verified Egg Batches", route: "eggs" },
  { id: "planned-vaccinations", kind: "vaccination", state: "planned", label: "Planned Vaccinations", route: "vaccinations" },
] as const;

const MAX_OPERATIONS_SUMMARY_ROWS = 20_000;

/**
 * Authenticated operational pulse for the current farm. Never use the public
 * gateway's all-company aggregations in an employee's workspace.
 *
 * We select only rows belonging to the current company AND location at D1,
 * then apply the ordinary per-record authority (including assigned/own
 * scopes) before counting. A successful empty read is explicitly no-data.
 * We refuse partial counts if the bounded query exceeds the safety limit.
 */
export async function getFarmOperationsSummary(db: D1Database, principal: AuthenticatedPrincipal) {
  const scope = principal.organizationScope;
  if (!scope?.companyKey || !scope.locationKey || !principal.farmAuthorized || principal.restriction === "disabled") {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  const hasScopedPermission = (permission: string) =>
    principal.permissions.includes(permission) &&
    !principal.deniedPermissions?.includes(permission) &&
    (Boolean(principal.permissionScopes[permission]) ||
      Boolean(principal.permissionScopeSets?.[permission]?.length));
  // The Owner role proves identity but never grants an operational module.
  if (!hasScopedPermission("farm.view")) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  const specs = OPERATIONS_SUMMARY_SPECS.filter((spec) =>
    hasScopedPermission(operationViewPermission(spec.kind)));
  if (!specs.length) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");

  const counts = new Map<string, { matched: number; total: number }>(
    specs.map((spec) => [spec.id, { matched: 0, total: 0 }]),
  );
  const recent: Array<{
    id: string; kind: string; label: string; route: string; state: string; updatedAt: string | null;
  }> = [];
  const types = specs.map((spec) => FARM_OPERATION_DEFINITIONS[spec.kind].resourceType);
  const placeholders = types.map(() => "?").join(",");
  const query =
    "SELECT id, resource_type, state, subject_json, updated_at FROM resource_records " +
    "WHERE deleted_at IS NULL AND resource_type IN (" + placeholders + ") " +
    "AND json_extract(subject_json, '$.companyKey') = ? " +
    "AND json_extract(subject_json, '$.locationKey') = ? " +
    "ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?";
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.prepare(query)
      .bind(...types, scope.companyKey, scope.locationKey, pageSize, offset)
      .all<Record<string, unknown>>();
    const page = result.results || [];
    if (offset + page.length > MAX_OPERATIONS_SUMMARY_ROWS) {
      throw new Error("OPERATIONS_SUMMARY_RECORD_LIMIT_EXCEEDED");
    }
    for (const row of page) {
      const spec = specs.find((candidate) => FARM_OPERATION_DEFINITIONS[candidate.kind].resourceType === row.resource_type);
      if (!spec || typeof row.subject_json !== "string" || typeof row.id !== "string" || typeof row.state !== "string") continue;
      let subject: unknown;
      try { subject = JSON.parse(row.subject_json); } catch { continue; }
      if (!subject || typeof subject !== "object" || Array.isArray(subject)) continue;
      const recordScope = subject as Record<string, unknown>;
      if (recordScope.companyKey !== scope.companyKey || recordScope.locationKey !== scope.locationKey) continue;
      if (!authorize(principal, {
        channel: "api", action: "view", permission: operationViewPermission(spec.kind),
        subject: subject as ReturnType<typeof operationSubject>,
      }).allowed) continue;
      const tally = counts.get(spec.id)!;
      tally.total += 1;
      if (row.state === spec.state) tally.matched += 1;
      if (recent.length < 8) {
        recent.push({
          id: row.id, kind: spec.kind, label: spec.label, route: spec.route,
          state: row.state,
          updatedAt: typeof row.updated_at === "string" && Number.isFinite(Date.parse(row.updated_at))
            ? row.updated_at : null,
        });
      }
    }
    if (page.length < pageSize) break;
  }
  const items = specs.map((spec) => ({
    id: spec.id, label: spec.label, route: spec.route,
    count: counts.get(spec.id)!.matched,
    authorizedRecords: counts.get(spec.id)!.total,
  }));
  return {
    state: items.some((item) => item.authorizedRecords > 0) ? "available" : "no-data",
    source: "Authenticated Cloudflare D1 farm records",
    generatedAt: new Date().toISOString(),
    items, recent,
  };
}

const ANALYTICS_RECORD_LIMIT = 5_000;

// SQLite JSON1 reads the FIRST duplicate object key, whereas JSON.parse
// retains the LAST. A verified egg row with two collectedAt keys can otherwise
// be excluded by SQL's date-window filter and silently certify partial totals.
// Detect ambiguity at any object depth, including legacy nested metadata.
// Feed malformed JSON to an empty JSON object only for this integrity probe;
// the existing decode() gate separately rejects the malformed verified row.
const VERIFIED_EGG_DUPLICATE_DATA_KEYS_SQL =
  "EXISTS (SELECT 1 FROM json_tree(" +
  "CASE WHEN json_valid(data_json) = 1 THEN data_json ELSE '{}' END" +
  ") AS tree WHERE tree.key IS NOT NULL " +
  "GROUP BY tree.parent, tree.key HAVING COUNT(*) > 1)";
// The same SQLite-first / JS-last ambiguity applies to persisted company and
// site identity. Consider an in-scope match at ANY duplicate top-level key
// position, but never authorize or count an ambiguous subject.
const VERIFIED_EGG_DUPLICATE_SUBJECT_KEYS_SQL =
  "EXISTS (SELECT 1 FROM json_tree(CASE WHEN json_valid(subject_json) = 1 THEN subject_json ELSE '{}' END) AS tree " +
  "WHERE tree.key IS NOT NULL GROUP BY tree.parent, tree.key HAVING COUNT(*) > 1)";

export async function listEggBatchesForAnalytics(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  startInclusive: string,
  endExclusive: string,
) {
  const start = Date.parse(startInclusive);
  const end = Date.parse(endExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["analytics date range is invalid"]);
  }
  const subject = operationSubject(principal, "egg-batch");
  const decision = authorize(principal, {
    channel: "api",
    action: "view",
    permission: operationViewPermission("egg-batch"),
    subject,
  });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");

  const scope = principal.organizationScope;
  // This endpoint is a single assigned-farm report; no role grants a company/site wildcard.
  if (!scope?.companyKey?.trim() || !scope?.locationKey?.trim()) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  // Bound valid dated records to the requested current/comparison window.
  // Keep verified records with undecodable timestamps or JSON visible to the
  // integrity gate; they cannot silently disappear as datetime(NULL).
  // Old, well-formed verified records must not consume the 5,000-row budget.
  const result = await db.prepare(
    "SELECT id, resource_type, state, revision, subject_json, data_json, " +
    "CASE WHEN " + VERIFIED_EGG_DUPLICATE_DATA_KEYS_SQL +
    " THEN 1 ELSE 0 END AS duplicate_data_keys, " +
    "CASE WHEN " + VERIFIED_EGG_DUPLICATE_SUBJECT_KEYS_SQL +
    " THEN 1 ELSE 0 END AS duplicate_subject_keys FROM resource_records " +
    "WHERE resource_type = ? AND state = 'verified' AND deleted_at IS NULL " +
    "AND json_valid(subject_json) = 1 " +
    "AND ((json_extract(subject_json, '$.companyKey') = ? " +
    "AND json_extract(subject_json, '$.locationKey') = ?) " +
    "OR (" + VERIFIED_EGG_DUPLICATE_SUBJECT_KEYS_SQL +
    " AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(subject_json) = 1 THEN subject_json ELSE '{}' END) AS c " +
    "WHERE c.key = 'companyKey' AND c.value = ?) " +
    "AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(subject_json) = 1 THEN subject_json ELSE '{}' END) AS s " +
    "WHERE s.key = 'locationKey' AND s.value = ?))) " +
    "AND ((json_valid(data_json) = 1 " +
    "AND datetime(json_extract(data_json, '$.collectedAt')) >= datetime(?) " +
    "AND datetime(json_extract(data_json, '$.collectedAt')) < datetime(?)) " +
    "OR json_valid(data_json) = 0 " +
    "OR (json_valid(data_json) = 1 " +
    "AND datetime(json_extract(data_json, '$.collectedAt')) IS NULL) " +
    "OR " + VERIFIED_EGG_DUPLICATE_DATA_KEYS_SQL + " " +
    "OR " + VERIFIED_EGG_DUPLICATE_SUBJECT_KEYS_SQL + ") " +
    "ORDER BY updated_at DESC, id ASC LIMIT ?"
  ).bind(
    FARM_OPERATION_DEFINITIONS["egg-batch"].resourceType,
    scope.companyKey,
    scope.locationKey,
    scope.companyKey,
    scope.locationKey,
    startInclusive,
    endExclusive,
    ANALYTICS_RECORD_LIMIT + 1,
  ).all<Record<string, unknown>>();
  if ((result.results || []).length > ANALYTICS_RECORD_LIMIT) {
    throw new Error("PRODUCTION_ANALYTICS_RECORD_LIMIT_EXCEEDED");
  }
  const records: ResourceRecord<FarmOperationData>[] = [];
  for (const row of result.results || []) {
    // An ambiguous verified row cannot be trusted even if JSON.parse produces
    // an otherwise valid payload. The SQL-side flag also covers rows whose
    // FIRST collectedAt key would have placed them outside the report window.
    if (row.duplicate_data_keys !== 0 || row.duplicate_subject_keys !== 0) {
      throw new Error("PRODUCTION_ANALYTICS_INVALID_SOURCE");
    }
    const record = decode(row);
    if (!record) {
      // A matching verified row is an evidence integrity failure, not a missing day.
      if (row.state === "verified") throw new Error("PRODUCTION_ANALYTICS_INVALID_SOURCE");
      continue;
    }
    // A decoded but contradictory verified record is an integrity failure.
    // Silently filtering it would certify an incomplete egg total as verified.
    if (!hasBoundRecordIdentity("egg-batch", record)) {
      // Wrong payload type or persisted identity cannot silently disappear
      // from a verified farm's egg-collection aggregate.
      throw new Error("PRODUCTION_ANALYTICS_INVALID_SOURCE");
    }
    if (visible(principal, "egg-batch", record)) records.push(record);
  }
  return records;
}

export async function getFarmOperation(db: D1Database, principal: AuthenticatedPrincipal, kind: FarmOperationKind, id: string) {
  const record = (await rows(db, kind, id))[0] || null;
  return record && visible(principal, kind, record) ? record : null;
}

export async function createFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  data: FarmOperationData,
  writeReceipt?: FarmWriteReceipt,
) {
  if (kind === "house" && data.kind === "house") {
    const houses = await listFarmOperations(db, principal, "house");
    if (houses.some((record) =>
      record.data.kind === "house"
      && record.data.houseCode.trim().toLocaleLowerCase() === data.houseCode.trim().toLocaleLowerCase()
    )) throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  if (kind === "flock" && data.kind === "flock") {
    const invalid = FARM_OPERATION_DEFINITIONS.flock.validate(data);
    if (invalid.length) throw new ResourceWorkflowError("VALIDATION_FAILED", invalid);
    const [houses, breeds, flocks] = await Promise.all([
      listFarmOperations(db, principal, "house"),
      listFarmOperations(db, principal, "breed"),
      listFarmOperations(db, principal, "flock"),
    ]);
    const normalize = (value: string) => value.trim().toLocaleLowerCase();
    const houseIdentity = normalize(data.house);
    const house = houses.find((record) =>
      record.data.kind === "house"
      && record.state === "active"
      && record.data.readinessStatus === "ready"
      && [record.data.houseCode, record.data.name].some((value) => normalize(value) === houseIdentity)
    );
    if (!house) throw new ResourceWorkflowError("VALIDATION_FAILED", ["Select an active, ready house from the authorised House Register"]);
    const breedIdentity = normalize(data.breed);
    const breed = breeds.find((record) =>
      record.data.kind === "breed"
      && record.state === "active"
      && record.data.species === data.species
      && [record.data.breedCode, record.data.name].some((value) => normalize(value) === breedIdentity)
    );
    if (!breed) throw new ResourceWorkflowError("VALIDATION_FAILED", ["Select an active breed matching the chosen species from Breed Management"]);
    if (data.sourceKind === "supplier") {
      const farm=principal.organizationScope;
      if (!farm?.companyKey || !farm.locationKey || !data.sourceSupplierId) {
        throw new ResourceWorkflowError("VALIDATION_FAILED", ["Select an active supplier registered in this farm"]);
      }
      // A source code and record ID submitted by a browser are not authority.
      // Resolve both against the actual D1 record in this company's site.
      const supplier=await db.prepare(
        "SELECT state, subject_json, data_json FROM resource_records WHERE id = ? " +
        "AND resource_type = 'supplier' AND deleted_at IS NULL " +
        "AND json_extract(subject_json, '$.companyKey') = ? " +
        "AND json_extract(subject_json, '$.locationKey') = ?",
      ).bind(data.sourceSupplierId, farm.companyKey, farm.locationKey)
        .first<{ state: string; subject_json: string; data_json: string }>();
      if (!supplier) throw new ResourceWorkflowError("VALIDATION_FAILED", ["Select an active supplier registered in this farm"]);
      let subject: Record<string, unknown>, details: Record<string, unknown>;
      try {
        subject=JSON.parse(supplier.subject_json) as Record<string, unknown>;
        details=JSON.parse(supplier.data_json) as Record<string, unknown>;
      } catch {
        throw new ResourceWorkflowError("VALIDATION_FAILED", ["Supplier record could not be verified"]);
      }
      if (!subject || !details || typeof subject !== "object" || typeof details !== "object" ||
          subject.companyKey !== farm.companyKey || subject.locationKey !== farm.locationKey ||
          !authorize(principal, {
            channel: "api", action: "view", permission: "procurement.view",
            subject: subject as AuthorizationSubject,
          }).allowed) {
        throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
      }
      if (supplier.state !== "active" || details.kind !== "supplier" ||
          details.status !== "active" || typeof details.supplierCode !== "string" ||
          normalize(details.supplierCode) !== normalize(data.source)) {
        throw new ResourceWorkflowError("VALIDATION_FAILED", ["Selected supplier is inactive or no longer matches the registered source"]);
      }
    }
    if (flocks.some((record) =>
      record.data.kind === "flock" && normalize(record.data.flockCode) === normalize(data.flockCode)
    )) throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  if (kind === "breed" && data.kind === "breed") {
    const breeds = await listFarmOperations(db, principal, "breed");
    if (breeds.some((record) =>
      record.data.kind === "breed"
      && record.data.breedCode.trim().toLocaleLowerCase() === data.breedCode.trim().toLocaleLowerCase()
    )) throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  if (kind === "flock-transfer" && data.kind === "flock-transfer") {
    const flocks = await listFarmOperations(db, principal, "flock");
    const flock = flocks.find((record) =>
      record.data.kind === "flock"
      && record.data.flockCode.trim().toLocaleLowerCase() === data.flockCode.trim().toLocaleLowerCase()
      && record.state === "active"
    );
    if (!flock) throw new ResourceWorkflowError("VALIDATION_FAILED", ["flock code does not identify an active authorized flock"]);
    if (
      flock.data.kind !== "flock"
      || flock.data.house.trim().toLocaleLowerCase() !== data.sourceHouse.trim().toLocaleLowerCase()
    ) throw new ResourceWorkflowError("VALIDATION_FAILED", ["source house does not match the active flock record"]);
    const houses = await listFarmOperations(db, principal, "house");
    const activeHouseAliases = new Set(houses
      .filter((record) => record.data.kind === "house" && record.state === "active")
      .flatMap((record) => record.data.kind === "house" ? [record.data.houseCode, record.data.name] : [])
      .map((value) => value.trim().toLocaleLowerCase()));
    if (!activeHouseAliases.has(data.sourceHouse.trim().toLocaleLowerCase()))
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["source house must identify an active authorized house"]);
    if (!activeHouseAliases.has(data.destinationHouse.trim().toLocaleLowerCase()))
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["destination house must identify an active authorized house"]);
    const transfers = await listFarmOperations(db, principal, "flock-transfer");
    if (transfers.some((record) =>
      record.data.kind === "flock-transfer"
      && record.data.transferCode.trim().toLocaleLowerCase() === data.transferCode.trim().toLocaleLowerCase()
    )) throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  let operationData = data;
  if (kind === "egg-batch" && data.kind === "egg-batch") {
    const invalid = FARM_OPERATION_DEFINITIONS["egg-batch"].validate(data);
    if (invalid.length) throw new ResourceWorkflowError("VALIDATION_FAILED", invalid);
    assertEggWritePermission(principal, "create");
    const parent = await resolveEggFlockForWrite(db, principal, data);
    operationData = Object.freeze({
      ...data, flockId: parent.id, flockCode: parent.flockCode, house: parent.house,
    });
  }
  const repository = new D1ResourceRepository<FarmOperationData>(db, undefined, undefined, writeReceipt);
  const service = createFarmOperationalServices(repository)[kind];
  const id = crypto.randomUUID();
  return service.create(principal, {
    id,
    subject: operationSubject(principal, kind, id),
    data: operationData,
  });
}

export async function updateFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  id: string,
  data: FarmOperationData,
  expectedRevision: number,
  writeReceipt?: FarmWriteReceipt,
) {
  const current = await getFarmOperation(db, principal, kind, id);
  if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");

  if (kind === "house" && data.kind === "house" && current.data.kind === "house") {
    if (current.data.houseCode !== data.houseCode)
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["house code cannot be changed"]);
  } else if (kind === "breed" && data.kind === "breed" && current.data.kind === "breed") {
    if (current.data.breedCode !== data.breedCode)
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["breed code cannot be changed"]);
  } else if (
    kind === "flock-transfer"
    && data.kind === "flock-transfer"
    && current.data.kind === "flock-transfer"
  ) {
    if (current.data.transferCode !== data.transferCode)
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["transfer code cannot be changed"]);
    if (current.state === "approved") {
      for (const key of ["flockCode", "sourceHouse", "destinationHouse", "birdCount", "plannedFor", "reason"] as const) {
        if (current.data[key] !== data[key])
          throw new ResourceWorkflowError("VALIDATION_FAILED", ["approved transfer plan cannot be changed"]);
      }
    }
  } else {
    throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  }

  const repository = new D1ResourceRepository<FarmOperationData>(db, undefined, undefined, writeReceipt);
  const service = createFarmOperationalServices(repository)[kind];
  return service.update(principal, {
    id,
    subject: operationSubject(principal, kind, id),
    data,
    expectedRevision,
  });
}

export async function transitionFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  id: string,
  to: string,
  expectedRevision: number,
  writeReceipt?: FarmWriteReceipt,
) {
  if ((kind as string) === "feed-manufacturing-batch") {
    return transitionStage24FarmOperation(db, principal, "feed-manufacturing-batch", id, to, expectedRevision);
  }
  if (kind === "house" && to === "active") {
    const current = await getFarmOperation(db, principal, kind, id);
    if (!current || current.data.kind !== "house")
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    if (current.data.readinessStatus !== "ready")
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["house readiness must be recorded as ready before activation"]);
  }
  if (kind === "flock-transfer" && to === "completed") {
    const current = await getFarmOperation(db, principal, kind, id);
    if (!current || current.data.kind !== "flock-transfer")
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    if (!Number.isInteger(current.data.reconciledBirdCount) || !current.data.completedAt)
      throw new ResourceWorkflowError("VALIDATION_FAILED", ["completion count and completion date are required"]);
  }
  // New production and old code-only drafts are resolved against an actual
  // active in-farm Flock before independent verification. Legacy reads remain.
  let originalEgg: Extract<FarmOperationData, { kind: "egg-batch" }> | null = null;
  let canonicalEgg: Awaited<ReturnType<typeof resolveEggFlockForWrite>> | null = null;
  if (kind === "egg-batch" && to === "verified") {
    assertEggWritePermission(principal, "approve", id);
    const current = (await rows(db, "egg-batch", id))[0] || null;
    const scope = principal.organizationScope;
    if (!current || !hasBoundRecordIdentity("egg-batch", current) ||
        !scope || current.subject.companyKey !== scope.companyKey ||
        current.subject.locationKey !== scope.locationKey ||
        current.data.kind !== "egg-batch" || current.state !== "draft") {
      throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
    }
    originalEgg = current.data;
    canonicalEgg = await resolveEggFlockForWrite(db, principal, originalEgg);
  }
  const repository = new D1ResourceRepository<FarmOperationData>(db, undefined, undefined, writeReceipt);
  const service = createFarmOperationalServices(repository)[kind];
  const source = canonicalEgg;
  const initial = originalEgg;
  return service.transition(principal, { id, to, expectedRevision },
    source && initial ? (current) => {
      if (current.data.kind !== "egg-batch" ||
          current.data.flockId !== initial.flockId ||
          current.data.flockCode !== initial.flockCode ||
          current.data.house !== initial.house ||
          current.data.collectedAt !== initial.collectedAt) {
        throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      }
      return Object.freeze({ ...current.data, flockId: source.id,
        flockCode: source.flockCode, house: source.house });
    } : undefined);
}

export async function deleteFarmOperation(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  kind: FarmOperationKind,
  id: string,
  expectedRevision: number,
) {
  const repository = new D1ResourceRepository<FarmOperationData>(db);
  const service = createFarmOperationalServices(repository)[kind];
  await service.remove(principal, { id, expectedRevision });
  return { ok: true };
}

export function operationError(error: unknown) {
  if (error instanceof EggCorrectionHold) return { status: 503, body: EGG_CORRECTION_HOLD };
  if (!(error instanceof ResourceWorkflowError)) {
    // D1 may wrap its SQLite error in one or more causes. Do not disclose
    // database contents; the named unique index is an explicit identity conflict.
    let cause: unknown = error;
    for (let depth = 0; depth < 5 && cause instanceof Error; depth++, cause = cause.cause) {
      if (/UNIQUE constraint failed/i.test(cause.message) && cause.message.includes("daily_flock_original_identity_0020"))
        return { status: 409, body: { error: "DAILY_FLOCK_REPORT_CONFLICT" } };
    }
    return { status: 503, body: { error: "FARM_OPERATION_UNAVAILABLE" } };
  }
  const hidden = new Set(["AUTHORIZATION_DENIED", "RESOURCE_NOT_FOUND", "RESOURCE_TYPE_MISMATCH"]);
  if (hidden.has(error.code)) return { status: 404, body: { error: "NOT_FOUND" } };
  if (error.code === "VALIDATION_FAILED") return { status: 422, body: { error: error.code, details: error.details } };
  if (error.code === "CONCURRENCY_CONFLICT" || error.code === "RESOURCE_EXISTS")
    return { status: 409, body: { error: error.code } };
  if (error.code === "TRANSITION_NOT_ALLOWED" || error.code === "PERMISSION_NOT_CONFIGURED")
    return { status: 422, body: { error: error.code } };
  return { status: 503, body: { error: "FARM_OPERATION_UNAVAILABLE" } };
}
