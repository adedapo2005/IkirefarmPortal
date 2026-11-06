import { ResourceWorkflowError, type ResourceRecord } from "./resource-workflow.ts";
import { DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, type DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";

export type RecoverableFarmKind = "breed" | "house";
export type RecoverableFarmAction = "create" | "update" | "activate" | "deactivate" | "maintenance";
export type FarmWriteReceipt = Readonly<{
  operationId: string;
  actorId: string;
  companyKey: string;
  siteKey: string;
  kind: RecoverableFarmKind;
  action: RecoverableFarmAction;
  requestHash: string;
  authority: DailyReportAuthority;
}>;

/** The first statement in the SAME D1 batch as the actual mutation and audit.
 * A duplicate ID (including a cancellation tombstone) aborts the entire batch.
 * A failed live-authority predicate violates the state CHECK and also aborts.
 * Pending rows are never committed independently. */
export function claimFarmWrite(db: D1Database, receipt: FarmWriteReceipt) {
  if (receipt.authority.accountId !== receipt.actorId)
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  return db.prepare(
    "INSERT INTO farm_operation_receipts " +
    "(operation_id, actor_id, company_key, site_key, resource_type, operation, request_hash, state, created_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN " + DAILY_REPORT_AUTHORITY_SQL +
    " THEN 'pending' ELSE 'authority-denied' END, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
  ).bind(receipt.operationId, receipt.actorId, receipt.companyKey, receipt.siteKey,
    receipt.kind, receipt.action, receipt.requestHash, ...dailyReportAuthorityParams(receipt.authority));
}

/** Must immediately follow the guarded audit INSERT. A zero-row mutation or
 * audit cannot leave a pending/success receipt: CHECK failure rolls back ALL
 * statements, including the claim, resource mutation and audit. */
export function completeFarmWrite<T>(
  db: D1Database, receipt: FarmWriteReceipt, record: ResourceRecord<T>, auditId: string,
) {
  if (record.resourceType !== receipt.kind || record.subject.companyKey !== receipt.companyKey ||
      record.subject.locationKey !== receipt.siteKey || !auditId)
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  return db.prepare(
    "UPDATE farm_operation_receipts SET state = CASE WHEN changes() = 1 " +
    "AND EXISTS (SELECT 1 FROM resource_records r WHERE r.id = ? AND r.resource_type = ? " +
    "AND r.revision = ? AND r.state = ? AND r.subject_json = ? AND r.data_json = ? AND r.deleted_at IS NULL) " +
    "AND EXISTS (SELECT 1 FROM resource_audit_events a WHERE a.id = ? AND a.resource_id = ? " +
    "AND a.resource_type = ? AND a.actor_id = ? AND json_extract(a.metadata_json,'$.revision') = ?) " +
    "AND " + DAILY_REPORT_AUTHORITY_SQL +
    " THEN 'committed' ELSE 'commit-proof-missing' END, record_json = ?, audit_id = ? " +
    "WHERE operation_id = ? AND state = 'pending'",
  ).bind(record.id, record.resourceType, record.revision, record.state, JSON.stringify(record.subject),
    JSON.stringify(record.data), auditId, record.id, record.resourceType, receipt.actorId, record.revision,
    ...dailyReportAuthorityParams(receipt.authority), JSON.stringify(record), auditId, receipt.operationId);
}
