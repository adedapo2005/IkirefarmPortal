import { ResourceWorkflowError, type ResourceRecord } from "./resource-workflow.ts";
import { DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, type DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";

export type DailyFlockReceipt = Readonly<{
  operationId:string; actorId:string; companyKey:string; siteKey:string;
  action:"create"|"update"|"submit"; requestHash:string; authority:DailyReportAuthority;
}>;

/** Claim and completion belong to the SAME D1 batch as mutation and audit. */
export function claimDailyFlockWrite(db:D1Database, receipt:DailyFlockReceipt) {
  if (receipt.authority.accountId !== receipt.actorId) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  return db.prepare(
    "INSERT INTO daily_flock_write_receipts(operation_id,actor_id,company_key,site_key,operation,request_hash,state,created_at) "+
    "VALUES(?,?,?,?,?,?,CASE WHEN "+DAILY_REPORT_AUTHORITY_SQL+" THEN 'pending' ELSE 'authority-denied' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
  ).bind(receipt.operationId,receipt.actorId,receipt.companyKey,receipt.siteKey,receipt.action,receipt.requestHash,
    ...dailyReportAuthorityParams(receipt.authority));
}
export function completeDailyFlockWrite<T>(db:D1Database, receipt:DailyFlockReceipt, record:ResourceRecord<T>, auditId:string) {
  if (record.resourceType !== "daily-flock-report" || record.subject.companyKey !== receipt.companyKey ||
      record.subject.locationKey !== receipt.siteKey || !auditId) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  return db.prepare(
    "UPDATE daily_flock_write_receipts SET state=CASE WHEN changes()=1 "+
    "AND EXISTS (SELECT 1 FROM resource_records r WHERE r.id=? AND r.resource_type='daily-flock-report' "+
    "AND r.revision=? AND r.state=? AND r.subject_json=? AND r.data_json=? AND r.deleted_at IS NULL) "+
    "AND EXISTS (SELECT 1 FROM resource_audit_events a WHERE a.id=? AND a.resource_id=? "+
    "AND a.resource_type='daily-flock-report' AND a.actor_id=? AND json_extract(a.metadata_json,'$.revision')=?) "+
    "AND "+DAILY_REPORT_AUTHORITY_SQL+" THEN 'committed' ELSE 'commit-proof-missing' END,record_json=?,audit_id=? "+
    "WHERE operation_id=? AND state='pending'",
  ).bind(record.id,record.revision,record.state,JSON.stringify(record.subject),JSON.stringify(record.data),
    auditId,record.id,receipt.actorId,record.revision,...dailyReportAuthorityParams(receipt.authority),
    JSON.stringify(record),auditId,receipt.operationId);
}
