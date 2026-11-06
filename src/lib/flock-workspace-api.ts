import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";

type Row = { id: string; resource_type: string; state: string; subject_json: string; data_json: string; updated_at: string | null };
type HouseOption = { id: string; code: string; name: string; capacityBirds: number; readiness: string };
type BreedOption = { id: string; code: string; name: string; species: "chicken" | "turkey" | "duck"; productionClass: string };
type FlockSnapshot = { id: string; code: string; name: string; breed: string; house: string; openingBirds: number; placementDate: string; state: string };
const types = ["flock", "house", "breed", "flock-transfer"] as const;
const MAX_ROWS = 10000;
// Bound the database response before it crosses the D1/Worker boundary.
// The byte budget counts raw UTF-8 bytes, not JSON-serialized response bytes.
const MAX_SNAPSHOT_CANDIDATES = 12000;
const MAX_SNAPSHOT_RAW_BYTES = 4_000_000;
const clean = (x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === "object" && !Array.isArray(x));
const saneText = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 160;
const permitted = (p: AuthenticatedPrincipal, subject: AuthorizationSubject) =>
  authorize(p, { channel: "api", action: "view", permission: "inventory.view", subject }).allowed;

/** Current-farm Flock Control: authoritative, scope-filtered and never a stock estimate. */
export async function getFlockWorkspace(db: D1Database, principal: AuthenticatedPrincipal) {
  const scope = principal.organizationScope;
  const owner = principal.isOwner && principal.accessState === "owner";
  // Never perform an assigned/own-scope authorization against a placeholder
  // subject: those scopes must be checked on each real stored record below.
  if (!scope?.companyKey || !scope.locationKey || !principal.farmAuthorized ||
      principal.restriction === "disabled" || principal.deniedPermissions?.includes("inventory.view") ||
      (!owner && (!principal.permissions.includes("inventory.view") || !principal.permissionScopes["inventory.view"]))) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  const configuredScopes = principal.permissionScopeSets?.["inventory.view"];
  const primaryScope = principal.permissionScopes["inventory.view"];
  // Only discard a department candidate when it is provably outside the
  // sole effective scope. Unusual or ambiguous subjects stay for authorize().
  // This depends on security-authority.ts department normalization; reverify on changes.
  const departmentOnly = Array.isArray(configuredScopes)
    ? (configuredScopes.length ? configuredScopes.every((entry) => entry === "department") : primaryScope === "department")
    : configuredScopes === undefined && primaryScope === "department";
  // One statement is one SQLite read snapshot. The sentinel count belongs to
  // that same snapshot and makes an oversized or truncated response fail closed.
  const sql = "WITH scoped AS (SELECT id, resource_type, state, subject_json, data_json, updated_at FROM resource_records " +
    "WHERE deleted_at IS NULL AND resource_type IN ('flock','house','breed','flock-transfer') " +
    // A subject which cannot be decoded cannot establish company/site or
    // record authority. Do not let such unrelated rows break this query.
    "AND CASE WHEN json_valid(subject_json) THEN json_extract(subject_json, '$.companyKey') END = ? " +
    "AND CASE WHEN json_valid(subject_json) THEN json_extract(subject_json, '$.locationKey') END = ? " +
    // Duplicate keys, escaped NUL and non-canonical department values are
    // ambiguous here: retain them for the existing JavaScript authorization.
    "AND (? = 0 OR instr(lower(subject_json), char(92) || 'u0000') > 0 " +
    "OR (SELECT COUNT(*) FROM json_each(CASE WHEN json_valid(subject_json) THEN subject_json ELSE '{}' END) " +
    "WHERE key = 'departmentKey') <> 1 " +
    "OR CASE WHEN json_valid(subject_json) THEN " +
    "(json_type(subject_json, '$.departmentKey') = 'text' AND " +
    "(json_extract(subject_json, '$.departmentKey') = ? OR " +
    "json_extract(subject_json, '$.departmentKey') GLOB '*[^a-z0-9:_-]*')) ELSE 1 END) " +
    "), bounds AS (SELECT COUNT(*) AS candidate_count, COALESCE(SUM(" +
    "COALESCE(length(CAST(id AS BLOB)),0) + COALESCE(length(CAST(resource_type AS BLOB)),0) + " +
    "COALESCE(length(CAST(state AS BLOB)),0) + COALESCE(length(CAST(subject_json AS BLOB)),0) + " +
    "COALESCE(length(CAST(data_json AS BLOB)),0) + COALESCE(length(CAST(updated_at AS BLOB)),0)),0) AS raw_bytes FROM scoped) " +
    "SELECT id, resource_type, state, subject_json, data_json, updated_at, " +
    "0 AS snapshot_marker, NULL AS expected_count FROM scoped " +
    "WHERE (SELECT candidate_count FROM bounds) <= ? AND (SELECT raw_bytes FROM bounds) <= ? UNION ALL " +
    "SELECT NULL, NULL, NULL, NULL, NULL, NULL, 1, candidate_count FROM bounds";
  let activeFlocks = 0, recordedOpeningBirds = 0, activeHouses = 0, readyHouses = 0;
  let transfersToReview = 0, approvedTransfers = 0, authorisedRecords = 0, authorisedRows = 0;
  const houses: HouseOption[] = [];
  const breeds: BreedOption[] = [];
  const flockRecords: {record: FlockSnapshot; updatedAt: string | null}[] = [];
  const result = await db.prepare(sql).bind(scope.companyKey, scope.locationKey,
    departmentOnly ? 1 : 0, scope.departmentKey || "", MAX_SNAPSHOT_CANDIDATES, MAX_SNAPSHOT_RAW_BYTES)
    .all<Row & {snapshot_marker: number; expected_count: number | null}>();
  if ((result as {success?: unknown}).success === false || !Array.isArray(result.results)) {
    throw new Error("FLOCK_WORKSPACE_INCOMPLETE_READ");
  }
  const rows = result.results;
  const markers = rows.filter((row) => row?.snapshot_marker === 1);
  const expected = markers[0]?.expected_count;
  if (markers.length !== 1 || typeof expected !== "number" || !Number.isSafeInteger(expected) || expected < 0 ||
      rows.length !== expected + 1 || rows.some((row) => row?.snapshot_marker !== 0 && row?.snapshot_marker !== 1)) {
    throw new Error("FLOCK_WORKSPACE_INCOMPLETE_READ");
  }
  for (const row of rows) {
    if (row.snapshot_marker === 1) continue;
    if (!row || typeof row.id !== "string" || !types.includes(row.resource_type as typeof types[number])) continue;
    let subject: unknown;
    try { subject = JSON.parse(row.subject_json); } catch { continue; }
    if (!clean(subject) || subject.companyKey !== scope.companyKey ||
        subject.locationKey !== scope.locationKey || !saneText(subject.resourceType) ||
        !permitted(principal, subject as AuthorizationSubject)) continue;
    // The limit is on authorised rows, not on other people's records.
    // Always reject an over-limit result instead of presenting a subtotal.
    if (++authorisedRows > MAX_ROWS) throw new Error("FLOCK_WORKSPACE_SIZE_LIMIT");
    let data: unknown;
    try { data = JSON.parse(row.data_json); } catch { throw new Error("FLOCK_WORKSPACE_INVALID_DATA"); }
    if (!clean(data)) throw new Error("FLOCK_WORKSPACE_INVALID_DATA");
    if (data.kind !== row.resource_type) throw new Error("FLOCK_WORKSPACE_INVALID_KIND");
    authorisedRecords++;
    if (row.resource_type === "flock") {
      if (!saneText(data.flockCode) || !saneText(data.name) || !saneText(data.breed) ||
          !saneText(data.house) || !saneText(data.placementDate) ||
          !Number.isSafeInteger(data.birdCount) || Number(data.birdCount) <= 0) throw new Error("FLOCK_WORKSPACE_INVALID_FLOCK");
      if (row.state === "active") {
        activeFlocks++;
        recordedOpeningBirds += Number(data.birdCount);
        if (!Number.isSafeInteger(recordedOpeningBirds)) throw new Error("FLOCK_WORKSPACE_COUNT_OVERFLOW");
      }
      flockRecords.push({
        record: {id: row.id, code: String(data.flockCode), name: String(data.name), breed: String(data.breed),
          house: String(data.house), openingBirds: Number(data.birdCount),
          placementDate: String(data.placementDate), state: row.state},
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
      });
      // Keep the original most-recent-first display and ID tie-breaker.
      flockRecords.sort((a, b) => a.updatedAt === b.updatedAt
        ? (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0)
        : a.updatedAt === null ? 1 : b.updatedAt === null ? -1 : a.updatedAt > b.updatedAt ? -1 : 1);
      if (flockRecords.length > 6) flockRecords.pop();
    } else if (row.resource_type === "house") {
      if (row.state === "active") {
        activeHouses++;
        if (data.readinessStatus === "ready") readyHouses++;
        if (data.readinessStatus === "ready" && saneText(data.houseCode) && saneText(data.name) && Number.isSafeInteger(data.capacityBirds) &&
            Number(data.capacityBirds) > 0 && houses.length < 500) {
          houses.push({ id: row.id, code: data.houseCode, name: data.name,
            capacityBirds: Number(data.capacityBirds), readiness: String(data.readinessStatus ?? "unverified") });
        }
      }
    } else if (row.resource_type === "breed") {
      if (row.state === "active" && saneText(data.breedCode) && saneText(data.name) &&
          (data.species === "chicken" || data.species === "turkey" || data.species === "duck") &&
          breeds.length < 500) {
        breeds.push({ id: row.id, code: data.breedCode, name: data.name, species: data.species,
          productionClass: String(data.productionClass ?? "other") });
      }
    } else if (row.resource_type === "flock-transfer") {
      if (row.state === "planned") transfersToReview++;
      if (row.state === "approved") approvedTransfers++;
    }
  }
  if (houses.length >= 500 || breeds.length >= 500) {
    // A truncated selector must never suggest that an unknown reference is valid.
    throw new Error("FLOCK_WORKSPACE_REFERENCE_LIMIT");
  }
  houses.sort((a,b) => a.name.localeCompare(b.name, "en-NG"));
  breeds.sort((a,b) => a.name.localeCompare(b.name, "en-NG"));
  return {
    state: authorisedRecords > 0 ? "available" as const : "no-data" as const,
    coverage: "unverified" as const,
    source: "Authenticated Cloudflare D1 farm records",
    asOf: new Date().toISOString(),
    measures: { activeFlocks, recordedOpeningBirds, activeHouses, readyHouses, transfersToReview, approvedTransfers },
    houses, breeds, recentFlocks: flockRecords.map((item) => item.record), authorisedRecords,
    meaning: "Opening birds are initial placement counts; they are not a reconciled live bird balance.",
  };
}
