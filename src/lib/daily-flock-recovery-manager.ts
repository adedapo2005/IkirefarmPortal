import type {AuthenticatedPrincipal} from "./authenticated-principal.ts";
import type {EvidenceObjectStore} from "./files-evidence.ts";
import {authorize, type AuthorizationSubject} from "./security-authority.ts";
import {ResourceWorkflowError} from "./resource-workflow.ts";
import {DAILY_REPORT_AUTHORITY_SQL,dailyReportAuthorityParams,type DailyReportAuthority} from "./stage24-daily-report-d1-guard.ts";

const permission="farm.daily-report.recovery.manage";
const invalid=()=>new ResourceWorkflowError("VALIDATION_FAILED");
const denied=()=>new ResourceWorkflowError("AUTHORIZATION_DENIED");
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
function manager(principal:AuthenticatedPrincipal,authority:DailyReportAuthority,id:string) {
 const s=principal.organizationScope;
 if(!uuid(id) || !s?.companyKey || !s.locationKey || !s.departmentKey || principal.id!==authority.accountId ||
   ![s.companyKey,s.locationKey,s.departmentKey].every(x=>/^[a-z0-9:_-]+$/.test(x))) throw denied();
 const subject:AuthorizationSubject={resourceType:"daily-flock-recovery-site",resourceId:id,companyKey:s.companyKey,locationKey:s.locationKey,departmentKey:s.departmentKey};
 const decision=authorize(principal,{channel:"api",action:"edit",permission,subject});
 const scopes=principal.permissionScopeSets?.[permission] || [principal.permissionScopes[permission]];
 // A site hold affects departments beyond the operator's own department.
 if(!decision.allowed || !scopes.includes("all"))throw denied();
 return {subject,company:s.companyKey,site:s.locationKey};
}
async function live(db:D1Database,authority:DailyReportAuthority){
 const row=await db.prepare("SELECT CASE WHEN "+DAILY_REPORT_AUTHORITY_SQL+" THEN 1 ELSE 0 END AS ok").bind(...dailyReportAuthorityParams(authority)).first<{ok:number}>();
 if(row?.ok!==1)throw denied();
}
export async function openRecoverySiteHold(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,id:string,reason:string){
 const {company,site}=manager(principal,authority,id);
 if(typeof reason!=="string" || !reason.trim() || reason.trim().length>300)throw invalid();
 await db.prepare("INSERT INTO daily_flock_recovery_site_holds(id,company_key,site_key,opened_by,opened_at,reason) "+
  "SELECT ?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),? WHERE "+DAILY_REPORT_AUTHORITY_SQL+" ON CONFLICT(id) DO NOTHING")
  .bind(id,company,site,principal.id,reason.trim(),...dailyReportAuthorityParams(authority)).run();
 const row=await db.prepare("SELECT id,company_key,site_key,opened_by,reason FROM daily_flock_recovery_active_holds WHERE id=? AND company_key=? AND site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(id,company,site,...dailyReportAuthorityParams(authority)).first<{id:string;opened_by:string;reason:string}>();
 await live(db,authority);
 if(!row || row.opened_by!==principal.id || row.reason!==reason.trim())throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
 return {id,state:"held",earlierRequest:"unconfirmed"};
}

export async function recordRecoveryReview(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,
 id:string,holdId:string,evidenceId:string,outcome:"unconfirmed"|"evidence-reviewed",note:string){
 const {company,site,subject}=manager(principal,authority,id);
 if(!uuid(holdId) || typeof evidenceId!=="string" || !evidenceId || evidenceId.length>160 ||
   !["unconfirmed","evidence-reviewed"].includes(outcome) || typeof note!=="string" || !note.trim() || note.trim().length>500)throw invalid();
 if(!authorize(principal,{channel:"api",action:"view",permission:"farm.daily-report.audit.view",subject}).allowed)throw denied();
 const evidence=await db.prepare("SELECT id,revision,subject_json,data_json FROM resource_records WHERE id=? AND resource_type='file-evidence' AND state='active' AND deleted_at IS NULL AND json_valid(subject_json)=1 AND json_valid(data_json)=1 AND json_extract(subject_json,'$.companyKey')=? AND json_extract(subject_json,'$.locationKey')=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(evidenceId,company,site,...dailyReportAuthorityParams(authority)).first<{id:string;revision:number;subject_json:string;data_json:string}>();
 await live(db,authority);
 if(!evidence)throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
 let evidenceSubject:AuthorizationSubject, data:{sha256?:unknown};
 try{evidenceSubject=JSON.parse(evidence.subject_json);data=JSON.parse(evidence.data_json)}catch{throw denied()}
 if(!authorize(principal,{channel:"api",action:"view",permission:"files.view",subject:evidenceSubject}).allowed || typeof data.sha256!=="string" || !/^[a-f0-9]{64}$/.test(data.sha256))throw denied();
 await db.prepare("INSERT INTO daily_flock_recovery_manager_reviews(id,hold_id,company_key,site_key,actor_id,evidence_id,evidence_revision,evidence_sha256,outcome,note,recorded_at) "+
  "SELECT ?,?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE "+DAILY_REPORT_AUTHORITY_SQL+" ON CONFLICT(id) DO NOTHING")
  .bind(id,holdId,company,site,principal.id,evidenceId,evidence.revision,data.sha256,outcome,note.trim(),...dailyReportAuthorityParams(authority)).run();
 const row=await db.prepare("SELECT actor_id,hold_id,evidence_id,evidence_revision,evidence_sha256,outcome,note FROM daily_flock_recovery_manager_reviews WHERE id=? AND company_key=? AND site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(id,company,site,...dailyReportAuthorityParams(authority)).first<{actor_id:string;hold_id:string;evidence_id:string;evidence_revision:number;evidence_sha256:string;outcome:string;note:string}>();
 await live(db,authority);
 if(!row || row.actor_id!==principal.id || row.hold_id!==holdId || row.evidence_id!==evidenceId || row.evidence_revision!==evidence.revision || row.evidence_sha256!==data.sha256 || row.outcome!==outcome || row.note!==note.trim())throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
 // This review describes evidence; it never resolves an unidentified request.
 return {id,holdId,outcome,earlierRequest:"unconfirmed"};
}

/** A manager's attestation is recorded, not a machine proof of hosted cutover. */
export async function releaseRecoverySiteHold(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,
 id:string,holdId:string,reviewId:string,fenceEvidenceId:string,confirmedFencedAndDrained:boolean){
 const {company,site,subject}=manager(principal,authority,id);
 if(!uuid(holdId) || !uuid(reviewId) || typeof fenceEvidenceId!=="string" || !fenceEvidenceId || fenceEvidenceId.length>160 || confirmedFencedAndDrained!==true)throw invalid();
 if(!authorize(principal,{channel:"api",action:"view",permission:"farm.daily-report.audit.view",subject}).allowed)throw denied();
 const evidence=await db.prepare("SELECT id,revision,subject_json,data_json FROM resource_records WHERE id=? AND resource_type='file-evidence' AND state='active' AND deleted_at IS NULL AND json_valid(subject_json)=1 AND json_valid(data_json)=1 AND json_extract(subject_json,'$.companyKey')=? AND json_extract(subject_json,'$.locationKey')=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(fenceEvidenceId,company,site,...dailyReportAuthorityParams(authority)).first<{id:string;revision:number;subject_json:string;data_json:string}>();
 await live(db,authority);
 if(!evidence)throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
 let evidenceSubject:AuthorizationSubject,data:{sha256?:unknown};
 try{evidenceSubject=JSON.parse(evidence.subject_json);data=JSON.parse(evidence.data_json)}catch{throw denied()}
 if(!authorize(principal,{channel:"api",action:"view",permission:"files.view",subject:evidenceSubject}).allowed || typeof data.sha256!=="string" || !/^[a-f0-9]{64}$/.test(data.sha256))throw denied();
 await db.prepare("INSERT INTO daily_flock_recovery_site_releases(id,hold_id,company_key,site_key,actor_id,review_id,fence_evidence_id,fence_evidence_revision,fence_evidence_sha256,attestation,released_at) "+
  "SELECT ?,?,?,?,?,?,?,?,?,'writers-fenced-and-drained',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE "+DAILY_REPORT_AUTHORITY_SQL+" ON CONFLICT(id) DO NOTHING")
  .bind(id,holdId,company,site,principal.id,reviewId,fenceEvidenceId,evidence.revision,data.sha256,...dailyReportAuthorityParams(authority)).run();
 const row=await db.prepare("SELECT hold_id,actor_id,review_id,fence_evidence_id,fence_evidence_revision,fence_evidence_sha256 FROM daily_flock_recovery_site_releases WHERE id=? AND company_key=? AND site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(id,company,site,...dailyReportAuthorityParams(authority)).first<{hold_id:string;actor_id:string;review_id:string;fence_evidence_id:string;fence_evidence_revision:number;fence_evidence_sha256:string}>();
 await live(db,authority);
 if(!row || row.hold_id!==holdId || row.actor_id!==principal.id || row.review_id!==reviewId || row.fence_evidence_id!==fenceEvidenceId || row.fence_evidence_revision!==evidence.revision || row.fence_evidence_sha256!==data.sha256)throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
 return {id,holdId,state:"released",earlierRequest:"unconfirmed"};
}

/** A separately authorized manager may retry a settled put during a site hold. */
export async function managerRetryEvidenceCleanup(db:D1Database,objects:EvidenceObjectStore,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,id:string,holdId:string,objectKey:string){
 const {company,site,subject}=manager(principal,authority,id);
 if(!uuid(holdId) || !/^evidence\/[0-9a-f-]{36}$/.test(objectKey))throw invalid();
 if(!authorize(principal,{channel:"api",action:"view",permission:"farm.daily-report.audit.view",subject}).allowed)throw denied();
 const row=await db.prepare("SELECT i.evidence_id,i.department_key,i.actor_id FROM evidence_upload_intents i JOIN daily_flock_recovery_active_holds h ON h.company_key=i.company_key AND h.site_key=i.site_key WHERE h.id=? AND i.object_key=? AND i.company_key=? AND i.site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(holdId,objectKey,company,site,...dailyReportAuthorityParams(authority)).first<{evidence_id:string;department_key:string;actor_id:string}>();
 await live(db,authority);
 if(!row)throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
 const evidenceSubject:AuthorizationSubject={resourceType:"file-evidence",resourceId:row.evidence_id,companyKey:company,locationKey:site,departmentKey:row.department_key,ownerId:row.actor_id,assigneeIds:[row.actor_id]};
 if(!authorize(principal,{channel:"api",action:"view",permission:"files.view",subject:evidenceSubject}).allowed)throw denied();
 await db.batch([
  db.prepare("INSERT INTO daily_flock_recovery_cleanup_attempts(id,hold_id,company_key,site_key,actor_id,object_key,recorded_at) SELECT ?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE "+DAILY_REPORT_AUTHORITY_SQL+" ON CONFLICT(id) DO NOTHING")
   .bind(id,holdId,company,site,principal.id,objectKey,...dailyReportAuthorityParams(authority)),
  db.prepare("UPDATE evidence_upload_intents SET state='cleaning' WHERE object_key=? AND company_key=? AND site_key=? AND state='uploaded' AND "+DAILY_REPORT_AUTHORITY_SQL+
   " AND EXISTS(SELECT 1 FROM daily_flock_recovery_cleanup_attempts a JOIN daily_flock_recovery_active_holds h ON h.id=a.hold_id WHERE a.id=? AND a.hold_id=? AND a.actor_id=? AND a.object_key=?)"+
   " AND NOT EXISTS(SELECT 1 FROM resource_records r WHERE r.resource_type='file-evidence' AND (json_valid(r.data_json)<>1 OR EXISTS(SELECT 1 FROM json_tree(r.data_json) j WHERE j.key IS NOT NULL GROUP BY j.parent,j.key HAVING count(*)>1) OR json_extract(r.data_json,'$.objectKey')=?))")
   .bind(objectKey,company,site,...dailyReportAuthorityParams(authority),id,holdId,principal.id,objectKey,objectKey),
 ]);
 const proof=await db.prepare("SELECT i.state,a.actor_id,a.hold_id,a.object_key FROM evidence_upload_intents i JOIN daily_flock_recovery_cleanup_attempts a ON a.object_key=i.object_key JOIN daily_flock_recovery_active_holds h ON h.id=a.hold_id WHERE a.id=? AND i.company_key=? AND i.site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(id,company,site,...dailyReportAuthorityParams(authority)).first<{state:string;actor_id:string;hold_id:string;object_key:string}>();
 await live(db,authority);
 if(!proof || proof.actor_id!==principal.id || proof.hold_id!==holdId || proof.object_key!==objectKey)throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
 if(proof.state!=="cleaning")return {state:proof.state};
 await objects.delete(objectKey);
 await db.prepare("UPDATE evidence_upload_intents SET state='cleaned' WHERE object_key=? AND company_key=? AND site_key=? AND state='cleaning'").bind(objectKey,company,site).run();
 return {state:"cleaned"};
}

export async function listRecoverySiteUploads(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,holdId:string,after=""){
 const {company,site,subject}=manager(principal,authority,holdId);
 if(after && !/^evidence\/[0-9a-f-]{36}$/.test(after))throw invalid();
 const fileScopes=principal.permissionScopeSets?.["files.view"] || [principal.permissionScopes["files.view"]];
 if(!fileScopes.includes("all") || !authorize(principal,{channel:"api",action:"view",permission:"files.view",subject}).allowed ||
   !authorize(principal,{channel:"api",action:"view",permission:"farm.daily-report.audit.view",subject}).allowed)throw denied();
 const rows=await db.prepare("SELECT i.object_key,i.evidence_id,i.department_key,i.actor_id,i.state,i.created_at FROM evidence_upload_intents i JOIN daily_flock_recovery_active_holds h ON h.company_key=i.company_key AND h.site_key=i.site_key WHERE h.id=? AND i.company_key=? AND i.site_key=? AND i.state IN ('reserved','uploaded','cleaning') AND i.object_key>? AND "+DAILY_REPORT_AUTHORITY_SQL+" ORDER BY i.object_key LIMIT 101")
  .bind(holdId,company,site,after,...dailyReportAuthorityParams(authority)).all<{object_key:string;evidence_id:string;department_key:string;actor_id:string;state:string;created_at:string}>();
 await live(db,authority);
 const items=(rows.results||[]).slice(0,100);
 return {items,next:(rows.results||[]).length>100?items[items.length-1].object_key:null};
}

/** Scoped, live-authorized investigation view; absence is not a write receipt. */
export async function getRecoverySiteInvestigation(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority) {
 const {company,site,subject}=manager(principal,authority,"00000000-0000-4000-8000-000000000000");
 const scopes=principal.permissionScopeSets?.["files.view"] || [principal.permissionScopes["files.view"]];
 if(!scopes.includes("all") || !authorize(principal,{channel:"api",action:"view",permission:"files.view",subject}).allowed ||
    !authorize(principal,{channel:"api",action:"view",permission:"farm.daily-report.audit.view",subject}).allowed) throw denied();
 const hold=await db.prepare("SELECT id,opened_by,opened_at,reason FROM daily_flock_recovery_active_holds WHERE company_key=? AND site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(company,site,...dailyReportAuthorityParams(authority)).first<{id:string;opened_by:string;opened_at:string;reason:string}>();
 await live(db,authority);
 if(!hold)return {hold:null,reviews:[],earlierRequest:"unconfirmed"};
 const rows=await db.prepare("SELECT id,actor_id,evidence_id,evidence_revision,evidence_sha256,outcome,note,recorded_at FROM daily_flock_recovery_manager_reviews WHERE hold_id=? AND company_key=? AND site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL+" ORDER BY recorded_at DESC,id DESC LIMIT 100")
  .bind(hold.id,company,site,...dailyReportAuthorityParams(authority)).all();
 await live(db,authority);
 return {hold,reviews:rows.results||[],earlierRequest:"unconfirmed"};
}

/** Reference externally held material without uploading bytes or resolving an intent. */
export async function recordRecoveryExternalReference(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,
 id:string,holdId:string,objectKey:string|null,reference:string,note:string,claimedSha256:string|null) {
 const {company,site,subject}=manager(principal,authority,id);
 if(!uuid(holdId) || !(objectKey===null || /^evidence\/[0-9a-f-]{36}$/.test(objectKey)) ||
    typeof reference!=="string" || !reference.trim() || reference.trim().length>240 ||
    typeof note!=="string" || !note.trim() || note.trim().length>500 ||
    !(claimedSha256===null || /^[a-f0-9]{64}$/.test(claimedSha256))) throw invalid();
 const scopes=principal.permissionScopeSets?.["files.view"] || [principal.permissionScopes["files.view"]];
 if(!scopes.includes("all") || !authorize(principal,{channel:"api",action:"view",permission:"files.view",subject}).allowed ||
    !authorize(principal,{channel:"api",action:"view",permission:"farm.daily-report.audit.view",subject}).allowed) throw denied();
 await db.prepare("INSERT INTO daily_flock_recovery_external_references(id,hold_id,company_key,site_key,actor_id,object_key,reference,note,claimed_sha256,recorded_at) "+
  "SELECT ?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE "+DAILY_REPORT_AUTHORITY_SQL+" ON CONFLICT(id) DO NOTHING")
  .bind(id,holdId,company,site,principal.id,objectKey,reference.trim(),note.trim(),claimedSha256,...dailyReportAuthorityParams(authority)).run();
 const row=await db.prepare("SELECT hold_id,actor_id,object_key,reference,note,claimed_sha256 FROM daily_flock_recovery_external_references WHERE id=? AND company_key=? AND site_key=? AND "+DAILY_REPORT_AUTHORITY_SQL)
  .bind(id,company,site,...dailyReportAuthorityParams(authority)).first<{hold_id:string;actor_id:string;object_key:string|null;reference:string;note:string;claimed_sha256:string|null}>();
 await live(db,authority);
 if(!row || row.hold_id!==holdId || row.actor_id!==principal.id || row.object_key!==objectKey || row.reference!==reference.trim() ||
  row.note!==note.trim() || row.claimed_sha256!==claimedSha256) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
 return {id,holdId,verification:"unverified-reference",earlierRequest:"unconfirmed"};
}
export async function listRecoveryExternalReferences(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,holdId:string,after="") {
 const {company,site,subject}=manager(principal,authority,holdId);
 if(after && !uuid(after))throw invalid();
 const scopes=principal.permissionScopeSets?.["files.view"] || [principal.permissionScopes["files.view"]];
 if(!scopes.includes("all") || !authorize(principal,{channel:"api",action:"view",permission:"files.view",subject}).allowed ||
    !authorize(principal,{channel:"api",action:"view",permission:"farm.daily-report.audit.view",subject}).allowed) throw denied();
 const rows=await db.prepare("SELECT r.id,r.actor_id,r.object_key,r.reference,r.note,r.claimed_sha256,r.recorded_at FROM daily_flock_recovery_external_references r JOIN daily_flock_recovery_active_holds h ON h.id=r.hold_id AND h.company_key=r.company_key AND h.site_key=r.site_key WHERE r.hold_id=? AND r.company_key=? AND r.site_key=? AND r.id>? AND "+DAILY_REPORT_AUTHORITY_SQL+" ORDER BY r.id LIMIT 101")
  .bind(holdId,company,site,after,...dailyReportAuthorityParams(authority)).all<{id:string}>();
 await live(db,authority);
 const items=(rows.results||[]).slice(0,100);
 return {items,next:(rows.results||[]).length>100?items[items.length-1].id:null};
}
