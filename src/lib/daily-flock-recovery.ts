import type {AuthenticatedPrincipal} from "./authenticated-principal.ts";
import {ResourceWorkflowError, type ResourceRecord} from "./resource-workflow.ts";
import {DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, type DailyReportAuthority} from "./stage24-daily-report-d1-guard.ts";
import {authorizeDailyFlockRecovery, createDailyReport, updateDailyReport, transitionDailyReport,
  getDailyReport, validateDailyReportData, type DailyReportData} from "./stage24-current-release-daily-report.ts";
import type {DailyFlockReceipt} from "./daily-flock-write-receipt.ts";

export type DailyFlockWriteRequest = Readonly<{action:"create"|"update"|"submit";recordId?:string;expectedRevision?:number;data?:unknown}>;
type Row = {operation_id:string;actor_id:string;company_key:string;site_key:string;operation:string|null;request_hash:string|null;
  state:string;record_json:string|null;audit_id:string|null};
export type DailyFlockRecovery =
  | {state:"unconfirmed"|"cancelled";operationId:string}
  | {state:"committed";operationId:string;action:string;record:ResourceRecord<DailyReportData>};
const denied=()=>new ResourceWorkflowError("AUTHORIZATION_DENIED");
const invalid=()=>new ResourceWorkflowError("VALIDATION_FAILED",["Invalid Recovery Request"]);
const conflict=()=>new ResourceWorkflowError("CONCURRENCY_CONFLICT",["Operation Identifier Already Used"]);

function identity(principal:AuthenticatedPrincipal,operationId:string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operationId)) throw invalid();
  const company=principal.organizationScope?.companyKey,site=principal.organizationScope?.locationKey;
  if (!principal.id || !company || !site) throw denied();
  authorizeDailyFlockRecovery(principal,operationId);
  return [operationId,principal.id,company,site] as const;
}
async function live(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority) {
  if (authority.accountId!==principal.id) throw denied();
  const row=await db.prepare("SELECT CASE WHEN "+DAILY_REPORT_AUTHORITY_SQL+" THEN 1 ELSE 0 END AS allowed")
    .bind(...dailyReportAuthorityParams(authority)).first<{allowed:number}>();
  if (row?.allowed!==1) throw denied();
}
async function read(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,operationId:string) {
  const key=identity(principal,operationId); await live(db,principal,authority);
  const row=await db.prepare("SELECT * FROM daily_flock_write_receipts WHERE operation_id=? AND actor_id=? AND company_key=? AND site_key=? AND "+
    DAILY_REPORT_AUTHORITY_SQL).bind(...key,...dailyReportAuthorityParams(authority)).first<Row>();
  await live(db,principal,authority); return row;
}
async function outcome(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,operationId:string,row:Row|null):Promise<DailyFlockRecovery> {
  if(!row)return {state:"unconfirmed",operationId};
  if(row.state==="cancelled")return {state:"cancelled",operationId};
  if(row.state!=="committed" || !row.record_json || !row.audit_id || !row.operation)throw conflict();
  let record:ResourceRecord<DailyReportData>;
  try {record=JSON.parse(row.record_json) as ResourceRecord<DailyReportData>} catch {throw conflict()}
  if(!record || record.resourceType!=="daily-flock-report" || typeof record.id!=="string" ||
     !Number.isSafeInteger(record.revision) || record.revision<1 || !record.subject ||
     record.subject.resourceType!=="daily-flock-report" || record.subject.resourceId!==record.id ||
     record.subject.companyKey!==row.company_key || record.subject.locationKey!==row.site_key ||
     !record.data || validateDailyReportData(record.data).length ||
     (row.operation==="create" && (record.state!=="draft" || record.revision!==1 || record.createdBy!==principal.id)) ||
     (row.operation==="update" && (record.state!=="draft" || record.revision<2)) ||
     (row.operation==="submit" && (record.state!=="submitted" || record.revision<2)) ||
     !["create","update","submit"].includes(row.operation)) throw conflict();
  authorizeDailyFlockRecovery(principal,operationId,record.subject);
  // Check current access to the same record as well; later revisions must not
  // change the immutable snapshot of this earlier outcome.
  const current=await getDailyReport(db,principal,record.id);
  authorizeDailyFlockRecovery(principal,operationId,current.subject);
  if(current.subject.companyKey!==record.subject.companyKey || current.subject.locationKey!==record.subject.locationKey ||
     current.subject.departmentKey!==record.subject.departmentKey || current.data.flockId!==record.data.flockId ||
     current.data.localDate!==record.data.localDate) throw conflict();
  const audit=await db.prepare("SELECT id FROM resource_audit_events WHERE id=? AND resource_id=? AND resource_type='daily-flock-report' "+
    "AND actor_id=? AND json_extract(metadata_json,'$.revision')=? AND "+DAILY_REPORT_AUTHORITY_SQL)
    .bind(row.audit_id,record.id,principal.id,record.revision,...dailyReportAuthorityParams(authority)).first();
  if(!audit){await live(db,principal,authority);throw conflict()}
  await live(db,principal,authority); return {state:"committed",operationId,action:row.operation,record};
}
export async function recoverDailyFlockWrite(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,operationId:string) {
  return outcome(db,principal,authority,operationId,await read(db,principal,authority,operationId));
}
export async function cancelDailyFlockWrite(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,operationId:string) {
  const key=identity(principal,operationId); await live(db,principal,authority);
  // Claiming this globally unique ID competes atomically with a delayed write.
  await db.prepare("INSERT INTO daily_flock_write_receipts(operation_id,actor_id,company_key,site_key,state,created_at) "+
    "SELECT ?,?,?,?,'cancelled',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE "+DAILY_REPORT_AUTHORITY_SQL+
    " ON CONFLICT(operation_id) DO NOTHING").bind(...key,...dailyReportAuthorityParams(authority)).run();
  const result=await recoverDailyFlockWrite(db,principal,authority,operationId);
  if(result.state==="unconfirmed")throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
  return result;
}
function canonical(value:unknown,depth=0):unknown {
  if(depth>20)throw invalid();
  if(Array.isArray(value))return value.map(item=>canonical(item,depth+1));
  if(value && typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined)
    .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v,depth+1)]));
  if(value===undefined)return null;
  if(value===null || typeof value==="string" || typeof value==="boolean" || typeof value==="number" && Number.isFinite(value))return value;
  throw invalid();
}
export async function executeDailyFlockWrite(db:D1Database,principal:AuthenticatedPrincipal,authority:DailyReportAuthority,
  operationId:string,input:DailyFlockWriteRequest):Promise<ResourceRecord<DailyReportData>> {
  const [,actorId,companyKey,siteKey]=identity(principal,operationId);
  if(!["create","update","submit"].includes(input.action))throw invalid();
  if(input.action==="create" ? input.recordId!==undefined || input.expectedRevision!==undefined :
    typeof input.recordId!=="string" || !input.recordId || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision!<1)throw invalid();
  if(input.action==="submit" ? input.data!==undefined : !input.data || typeof input.data!=="object" || Array.isArray(input.data))throw invalid();
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(canonical({version:1,...input}))));
  const requestHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  async function replay(row:Row) {
    if(row.state!=="committed" || row.request_hash!==requestHash || row.operation!==input.action)throw conflict();
    const result=await outcome(db,principal,authority,operationId,row);
    if(result.state!=="committed")throw conflict();
    return result.record;
  }
  const prior=await read(db,principal,authority,operationId);
  if(prior)return replay(prior);
  const receipt:DailyFlockReceipt={operationId,actorId,companyKey,siteKey,action:input.action,requestHash,authority};
  try {
    if(input.action==="create")return await createDailyReport(db,principal,input.data,receipt);
    if(input.action==="update")return await updateDailyReport(db,principal,input.recordId!,input.data,input.expectedRevision!,receipt);
    return await transitionDailyReport(db,principal,input.recordId!,"submitted",input.expectedRevision!,receipt);
  } catch(error) {
    const committed=await read(db,principal,authority,operationId);
    if(committed)return replay(committed);
    throw error;
  }
}
