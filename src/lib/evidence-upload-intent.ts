import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import type { EvidenceObjectStore } from "./files-evidence.ts";
import type { AuthorizationSubject } from "./security-authority.ts";
import { authorize } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";
import { DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, type DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";

/** An unknown put stays reserved: no timeout alone proves it cannot still finish. */
export function evidenceUploadIntent(db: D1Database, objects: EvidenceObjectStore, principal: AuthenticatedPrincipal,
  authority: DailyReportAuthority, subject: AuthorizationSubject, evidenceId: string) {
  const company=subject.companyKey, site=subject.locationKey, department=subject.departmentKey;
  if (!company || !site || !department || !/^[a-z0-9:_-]+$/.test(company) || !/^[a-z0-9:_-]+$/.test(site) || !/^[a-z0-9:_-]+$/.test(department) ||
      principal.id!==authority.accountId || principal.organizationScope?.companyKey!==company ||
      principal.organizationScope?.locationKey!==site || principal.organizationScope?.departmentKey!==department || subject.resourceType!=="file-evidence" || subject.resourceId!==evidenceId) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  const liveArgs=()=>dailyReportAuthorityParams(authority);
  const allowed=(action:"create"|"edit")=>authorize(principal,{channel:"api",action,permission:action==="create"?"files.create":"files.edit",subject}).allowed;
  async function reserve(objectKey:string,sha256:string,action:"create"|"edit") {
    if (!allowed(action)) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
    const result=await db.prepare("INSERT INTO evidence_upload_intents(object_key,evidence_id,company_key,site_key,department_key,actor_id,sha256,state,created_at) "+
      "SELECT ?,?,?,?,?,?,?,'reserved',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE "+DAILY_REPORT_AUTHORITY_SQL+
      " AND NOT EXISTS (SELECT 1 FROM daily_flock_recovery_active_holds WHERE company_key=? AND site_key=?)")
      .bind(objectKey,evidenceId,company,site,department,principal.id,sha256,...liveArgs(),company,site).run();
    if(Number(result.meta?.changes || 0)!==1)throw new ResourceWorkflowError("AUTHORIZATION_DENIED",["upload-not-admitted"]);
  }
  async function uploaded(objectKey:string) {
    const result=await db.prepare("UPDATE evidence_upload_intents SET state='uploaded' WHERE object_key=? AND actor_id=? AND evidence_id=? AND state='reserved'")
      .bind(objectKey,principal.id,evidenceId).run();
    if(Number(result.meta?.changes || 0)!==1)throw new Error("EVIDENCE_INTENT_NOT_RESERVED");
  }
  async function reconcile(objectKey:string) {
    if (!allowed("create") && !allowed("edit")) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
    // Claiming cleanup and the metadata trigger compete inside D1. Once claimed,
    // no later finalization can reference this key. Unknown puts stay reserved.
    await db.prepare("UPDATE evidence_upload_intents SET state='cleaning' WHERE object_key=? AND evidence_id=? AND actor_id=? AND company_key=? AND site_key=? AND department_key=? AND state='uploaded' AND "+
      DAILY_REPORT_AUTHORITY_SQL+" AND NOT EXISTS (SELECT 1 FROM resource_records r WHERE r.resource_type='file-evidence' AND "+
      "(json_valid(r.data_json)<>1 OR EXISTS (SELECT 1 FROM json_tree(r.data_json) j WHERE j.key IS NOT NULL GROUP BY j.parent,j.key HAVING count(*)>1) OR json_extract(r.data_json,'$.objectKey')=?))")
      .bind(objectKey,evidenceId,principal.id,company,site,department,...liveArgs(),objectKey).run();
    const row=await db.prepare("SELECT state FROM evidence_upload_intents WHERE object_key=? AND evidence_id=? AND actor_id=? AND company_key=? AND site_key=? AND department_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
      .bind(objectKey,evidenceId,principal.id,company,site,department,...liveArgs()).first<{state:string}>();
    if (!row) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
    if (row.state!=="cleaning") return row.state;
    await objects.delete(objectKey);
    await db.prepare("UPDATE evidence_upload_intents SET state='cleaned' WHERE object_key=? AND evidence_id=? AND actor_id=? AND state='cleaning'")
      .bind(objectKey,evidenceId,principal.id).run();
    return "cleaned";
  }
  return {reserve,uploaded,reconcile};
}

/** Lists only this actor's pending intents in the current, live scope. */
export async function listEvidenceUploadIntents(db:D1Database, principal:AuthenticatedPrincipal, authority:DailyReportAuthority, after="") {
  if (after && !/^evidence\/[0-9a-f-]{36}$/.test(after)) throw new ResourceWorkflowError("VALIDATION_FAILED");
  const scope=principal.organizationScope;
  if (!scope?.companyKey || !scope.locationKey || !scope.departmentKey || principal.id!==authority.accountId ||
      ![scope.companyKey,scope.locationKey,scope.departmentKey].every(x=>/^[a-z0-9:_-]+$/.test(x))) throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  const subject:AuthorizationSubject={resourceType:"file-evidence",companyKey:scope.companyKey,locationKey:scope.locationKey,departmentKey:scope.departmentKey,ownerId:principal.id,assigneeIds:[principal.id]};
  if (!["create","edit"].some(action=>authorize(principal,{channel:"api",action:action as "create"|"edit",permission:action==="create"?"files.create":"files.edit",subject}).allowed))
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  const rows=await db.prepare("SELECT object_key,evidence_id,state,created_at FROM evidence_upload_intents WHERE actor_id=? AND company_key=? AND site_key=? AND department_key=? AND state IN ('reserved','uploaded','cleaning') AND object_key>? AND "+DAILY_REPORT_AUTHORITY_SQL+" ORDER BY object_key LIMIT 101")
    .bind(principal.id,scope.companyKey,scope.locationKey,scope.departmentKey,after,...dailyReportAuthorityParams(authority)).all<{object_key:string;evidence_id:string;state:string;created_at:string}>();
  const live=await db.prepare("SELECT CASE WHEN "+DAILY_REPORT_AUTHORITY_SQL+" THEN 1 ELSE 0 END AS allowed").bind(...dailyReportAuthorityParams(authority)).first<{allowed:number}>();
  if(live?.allowed!==1)throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  const items=(rows.results || []).slice(0,100);
  return {items,next:(rows.results || []).length>100 ? items[items.length-1].object_key : null};
}

export async function retryEvidenceUploadCleanup(db:D1Database,objects:EvidenceObjectStore,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,objectKey:string) {
  if (!/^evidence\/[0-9a-f-]{36}$/.test(objectKey)) throw new ResourceWorkflowError("VALIDATION_FAILED");
  await listEvidenceUploadIntents(db,principal,authority);
  const scope=principal.organizationScope!;
  const row=await db.prepare("SELECT evidence_id FROM evidence_upload_intents WHERE object_key=? AND actor_id=? AND company_key=? AND site_key=? AND department_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
    .bind(objectKey,principal.id,scope.companyKey!,scope.locationKey!,scope.departmentKey!,...dailyReportAuthorityParams(authority)).first<{evidence_id:string}>();
  if(!row)throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  const subject:AuthorizationSubject={resourceType:"file-evidence",resourceId:row.evidence_id,companyKey:scope.companyKey,locationKey:scope.locationKey,departmentKey:scope.departmentKey,ownerId:principal.id,assigneeIds:[principal.id]};
  return evidenceUploadIntent(db,objects,principal,authority,subject,row.evidence_id).reconcile(objectKey);
}
