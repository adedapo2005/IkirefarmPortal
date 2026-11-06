import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize } from "./security-authority.ts";
import { ResourceWorkflowError, type ResourceRecord } from "./resource-workflow.ts";
import { FARM_OPERATION_DEFINITIONS, type FarmOperationData } from "./farm-operational-core.ts";
import { createFarmOperation, updateFarmOperation, transitionFarmOperation, operationSubject } from "./farm-operational-api.ts";
import { DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, type DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";
import type { FarmWriteReceipt, RecoverableFarmKind, RecoverableFarmAction } from "./farm-write-receipt.ts";

export type FarmWriteRequest = Readonly<{
  action: RecoverableFarmAction; recordId?: string; expectedRevision?: number; data?: FarmOperationData;
}>;
type ReceiptRow = {
  operation_id: string; actor_id: string; company_key: string; site_key: string; resource_type: RecoverableFarmKind;
  operation: RecoverableFarmAction | null; request_hash: string | null; state: string; record_json: string | null; audit_id: string | null;
};
export type FarmRecoveryOutcome =
  | { state: "unconfirmed" | "cancelled"; operationId: string }
  | { state: "committed"; operationId: string; action: RecoverableFarmAction; record: ResourceRecord<FarmOperationData> };

const invalid = () => new ResourceWorkflowError("VALIDATION_FAILED", ["Invalid Recovery Request"]);
const conflict = () => new ResourceWorkflowError("CONCURRENCY_CONFLICT", ["Operation Identifier Already Used"]);
function checkId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw invalid();
}
function scope(principal: AuthenticatedPrincipal, kind: RecoverableFarmKind, operationId: string) {
  checkId(operationId);
  if (!["breed", "house"].includes(kind) || !principal.id || !principal.organizationScope?.companyKey || !principal.organizationScope.locationKey)
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  const subject = operationSubject(principal, kind);
  for (const [action, permission] of [["view", "inventory.view"], ["edit", "inventory.edit"]] as const) {
    if (!authorize(principal, {channel:"api", action, permission, subject}).allowed)
      throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  return [operationId, principal.id, principal.organizationScope.companyKey, principal.organizationScope.locationKey, kind] as const;
}
async function live(db: D1Database, principal: AuthenticatedPrincipal, authority: DailyReportAuthority) {
  if (authority.accountId !== principal.id) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  const row = await db.prepare("SELECT CASE WHEN " + DAILY_REPORT_AUTHORITY_SQL + " THEN 1 ELSE 0 END AS allowed")
    .bind(...dailyReportAuthorityParams(authority)).first<{allowed:number}>();
  if (row?.allowed !== 1) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
}
async function readReceipt(db: D1Database, principal: AuthenticatedPrincipal, authority: DailyReportAuthority,
  kind: RecoverableFarmKind, operationId: string) {
  const identity = scope(principal, kind, operationId);
  await live(db, principal, authority);
  const row = await db.prepare(
    "SELECT * FROM farm_operation_receipts WHERE operation_id=? AND actor_id=? AND company_key=? AND site_key=? AND resource_type=? AND " +
    DAILY_REPORT_AUTHORITY_SQL,
  ).bind(...identity, ...dailyReportAuthorityParams(authority)).first<ReceiptRow>();
  await live(db, principal, authority);
  return row;
}
async function outcome(db: D1Database, principal: AuthenticatedPrincipal, authority: DailyReportAuthority,
  kind: RecoverableFarmKind, operationId: string, row: ReceiptRow | null): Promise<FarmRecoveryOutcome> {
  if (!row) return {state:"unconfirmed",operationId};
  if (row.state === "cancelled") return {state:"cancelled",operationId};
  if (row.state !== "committed" || !row.record_json || !row.audit_id || !row.operation) throw conflict();
  const record = JSON.parse(row.record_json) as ResourceRecord<FarmOperationData>;
  if (record?.resourceType !== kind || record.data?.kind !== kind || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      !record.id || !(kind === "house" ? ["active","inactive","maintenance"] : ["active","inactive"]).includes(record.state) ||
      record.subject?.companyKey !== row.company_key || record.subject?.locationKey !== row.site_key ||
      record.subject?.resourceType !== kind || record.subject?.resourceId !== record.id ||
      FARM_OPERATION_DEFINITIONS[kind].validate(record.data).length)
    throw conflict();
  if (!authorize(principal, {channel:"api",action:"view",permission:"inventory.view",subject:record.subject}).allowed)
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  // This immutable snapshot was verified against the actual row by the same
  // batch that committed it. Later revisions do not rewrite the earlier outcome.
  const audit = await db.prepare(
    "SELECT id FROM resource_audit_events WHERE id=? AND actor_id=? AND resource_id=? AND resource_type=? " +
    "AND json_extract(metadata_json,'$.revision')=? AND " + DAILY_REPORT_AUTHORITY_SQL,
  ).bind(row.audit_id, principal.id, record.id, kind, record.revision, ...dailyReportAuthorityParams(authority)).first();
  if (!audit) { await live(db, principal, authority); throw conflict(); }
  await live(db, principal, authority);
  return {state:"committed",operationId,action:row.operation,record};
}
export async function recoverFarmWrite(db: D1Database, principal: AuthenticatedPrincipal, authority: DailyReportAuthority,
  kind: RecoverableFarmKind, operationId: string): Promise<FarmRecoveryOutcome> {
  return outcome(db,principal,authority,kind,operationId,await readReceipt(db,principal,authority,kind,operationId));
}
export async function cancelFarmWrite(db: D1Database, principal: AuthenticatedPrincipal, authority: DailyReportAuthority,
  kind: RecoverableFarmKind, operationId: string): Promise<FarmRecoveryOutcome> {
  const identity = scope(principal,kind,operationId);
  await live(db,principal,authority);
  // Atomic insert competes with the mutation's receipt claim. If cancellation
  // wins, a delayed write's unique-key failure rolls its entire batch back.
  await db.prepare(
    "INSERT INTO farm_operation_receipts (operation_id,actor_id,company_key,site_key,resource_type,state,created_at) " +
    "SELECT ?,?,?,?,?,'cancelled',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE " + DAILY_REPORT_AUTHORITY_SQL +
    " ON CONFLICT(operation_id) DO NOTHING",
  ).bind(...identity,...dailyReportAuthorityParams(authority)).run();
  const result = await recoverFarmWrite(db,principal,authority,kind,operationId);
  // A global-ID collision owned by another scope is never disclosed or cleared.
  if (result.state === "unconfirmed") throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  return result;
}
function canonical(value: unknown, depth=0): unknown {
  if (depth > 20) throw invalid();
  if (Array.isArray(value)) return value.map(item => canonical(item,depth+1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([,item]) => item !== undefined).sort(([a],[b]) => a.localeCompare(b))
    .map(([key,item]) => [key,canonical(item,depth+1)]));
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
  throw invalid();
}
export async function executeRecoverableFarmWrite(db: D1Database, principal: AuthenticatedPrincipal, authority: DailyReportAuthority,
  kind: RecoverableFarmKind, operationId: string, input: FarmWriteRequest): Promise<ResourceRecord<FarmOperationData>> {
  const [,actorId,companyKey,siteKey] = scope(principal,kind,operationId);
  if (!["create","update","activate","deactivate","maintenance"].includes(input.action) || input.action === "maintenance" && kind !== "house") throw invalid();
  if (input.action === "create" ? Boolean(input.recordId || input.expectedRevision) :
      !input.recordId || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision! < 1) throw invalid();
  if ((input.action === "create" || input.action === "update") && (!input.data || input.data.kind !== kind)) throw invalid();
  if (input.action !== "create" && input.action !== "update" && input.data !== undefined) throw invalid();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical({version:1,kind,...input}))));
  const requestHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,"0")).join("");
  async function replay(row: ReceiptRow) {
    if (row.state !== "committed" || row.request_hash !== requestHash || row.operation !== input.action) throw conflict();
    const result = await outcome(db,principal,authority,kind,operationId,row);
    if (result.state !== "committed") throw conflict();
    return result.record;
  }
  const previous = await readReceipt(db,principal,authority,kind,operationId);
  if (previous) return replay(previous);
  const receipt: FarmWriteReceipt = {operationId,actorId,companyKey,siteKey,kind,action:input.action,requestHash,authority};
  try {
    if (input.action === "create") return await createFarmOperation(db,principal,kind,input.data!,receipt);
    if (input.action === "update") return await updateFarmOperation(db,principal,kind,input.recordId!,input.data!,input.expectedRevision!,receipt);
    const changed = await transitionFarmOperation(db,principal,kind,input.recordId!,input.action === "activate" ? "active" : input.action === "maintenance" ? "maintenance" : "inactive",input.expectedRevision!,receipt);
    if (changed.data.kind !== "breed" && changed.data.kind !== "house") throw conflict();
    return {...changed,data:changed.data};
  } catch (error) {
    // Another request may have won after our pre-read; only a matching durable
    // receipt can turn that race into success. No ordinary list read is proof.
    const completed = await readReceipt(db,principal,authority,kind,operationId);
    if (completed) return replay(completed);
    throw error;
  }
}
