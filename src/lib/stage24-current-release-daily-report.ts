import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import type { DailyFlockReceipt } from "./daily-flock-write-receipt.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import {
  ResourceWorkflowError,
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRecord,
} from "./resource-workflow.ts";
import { D1ResourceRepository } from "./resource-workflow-d1.ts";
import { DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, DAILY_REPORT_NONE_TODAY_PROOF_SQL, dailyReportNoneTodayProofParams, type DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";

const TYPE = "daily-flock-report" as const;
export const DAILY_REPORT_PERMISSIONS = Object.freeze({
  view: "farm.daily-report.view",
  edit: "farm.daily-report.edit",
  approve: "farm.daily-report.approve",
});
const MAX_FLOCK_ROWS = 500;
const MAX_REPORT_ROWS = 500;
const NEVER = Object.freeze(["mortality", "medication", "vaccination", "feed"] as const);
const MAX_EVENT_REFS = 25;
type RefKind = (typeof NEVER)[number];
/** Canonical producers: only genuinely completed operational states count. */
const SOURCES: Readonly<Record<RefKind,Readonly<{type:string;view:string;states:readonly string[];time:string}>>> = Object.freeze({
  mortality:{type:"mortality-record",view:"farm.view",states:["open","reviewed"],time:"discoveredAt"},
  medication:{type:"medication-administration",view:"farm.health.view",states:["recorded","reviewed"],time:"administeredAt"},
  vaccination:{type:"vaccination",view:"vaccination.view",states:["administered"],time:"administeredAt"},
  feed:{type:"feed",view:"farm.feed.view",states:["posted"],time:"occurredAt"},
});
type ExtraSourceType = "flock-movement" | "health-event" | "stage24-feed" | "stage24-vaccination";
function sourceSpec(kind: RefKind, sourceType: unknown) {
  if (sourceType === undefined) return SOURCES[kind];
  if (kind === "mortality" && sourceType === "flock-movement")
    return {type:"flock-movement",view:"inventory.view",states:["recorded"],time:"occurredAt"} as const;
  if (kind === "medication" && sourceType === "health-event")
    return {type:"health-event",view:"farm.health.view",states:["open","resolved"],time:"observedAt"} as const;
  if (kind === "feed" && sourceType === "stage24-feed")
    return {type:"feed",view:"farm.feed.view",states:["posted"],time:"occurredAt"} as const;
  if (kind === "vaccination" && sourceType === "stage24-vaccination")
    return {type:"vaccination",view:"vaccination.view",states:["administered"],time:"administeredAt"} as const;
  return null;
}
const FIELDS = new Set(["kind","flockId","flockCode","localDate","timeZone","eventRefs","physicalCount","noneToday","notes","deviceClass","gps","operatorSnapshot"]);

export type DailyReportData = Readonly<{
  kind: typeof TYPE;
  flockId: string;
  flockCode: string;
  localDate: string;
  timeZone: "Africa/Lagos";
  eventRefs: readonly Readonly<{
    kind: "mortality" | "medication" | "vaccination" | "feed"; id: string; revision: number;
    sourceType?: "flock-movement" | "health-event" | "stage24-feed" | "stage24-vaccination";
  }>[];
  physicalCount?: number;
  noneToday?: Readonly<Partial<Record<(typeof NEVER)[number], true>>>;
  notes?: string;
  deviceClass: "mobile" | "tablet" | "desktop" | "unknown";
  gps: Readonly<{state: "consented" | "declined" | "unavailable"}>;
  operatorSnapshot: Readonly<{name: string;role: string}>;
}>;
type SourceRow = Record<string, unknown>;
type FarmScope = NonNullable<AuthenticatedPrincipal["organizationScope"]>;
const invalid = (detail:string) => new ResourceWorkflowError("VALIDATION_FAILED", [detail]);
const hidden = () => new ResourceWorkflowError("RESOURCE_NOT_FOUND");

function object(value:unknown):value is Record<string,unknown>{
  return !!value && typeof value==="object" && !Array.isArray(value);
}
function bounded(value:unknown,max=120):value is string{
  return typeof value==="string" && !!value.trim() && value.length<=max;
}
function dateOnly(value:unknown):value is string{
  if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d]=value.split("-").map(Number);
  const check=new Date(Date.UTC(y,m-1,d));
  return check.getUTCFullYear()===y && check.getUTCMonth()+1===m && check.getUTCDate()===d;
}
function scope(principal:AuthenticatedPrincipal):FarmScope {
  const farm=principal.organizationScope;
  if(principal.status!=="active" || principal.restriction!=="none" ||
     !principal.farmAuthorized || !farm?.companyKey?.trim() || !farm.locationKey?.trim()){
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  return farm;
}
function subject(principal:AuthenticatedPrincipal,id?:string):AuthorizationSubject{
  const farm=scope(principal);
  return Object.freeze({
    resourceType:TYPE,companyKey:farm.companyKey,locationKey:farm.locationKey,
    departmentKey:farm.departmentKey,
    ...(id?{resourceId:id}:{}),
  });
}
function permitted(principal:AuthenticatedPrincipal,permission:string,
  action:"view"|"create"|"edit"|"approve", record?:AuthorizationSubject){
  const farm=scope(principal);
  if(!principal.permissions.includes(permission) || principal.deniedPermissions.includes(permission)){
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  const identity=record??subject(principal);
  if(identity.companyKey!==farm.companyKey || identity.locationKey!==farm.locationKey)
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  const decision=authorize(principal,{
    channel:"api",action,
    permission:action==="approve"?DAILY_REPORT_PERMISSIONS.edit:permission,
    ...(action==="approve"?{approvalPermission:DAILY_REPORT_PERMISSIONS.approve}:{}),
    subject:identity,
  });
  if(!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED",[decision.code]);
}
function reportSubject(principal:AuthenticatedPrincipal,id:string):AuthorizationSubject{
  return Object.freeze({...subject(principal,id),ownerId:principal.id,assigneeIds:[principal.id]});
}
/** Recovery is actor-scoped and still requires current read and edit authority. */
export function authorizeDailyFlockRecovery(principal:AuthenticatedPrincipal, operationId:string, record?:AuthorizationSubject) {
  const identity = record ?? reportSubject(principal,operationId);
  permitted(principal,DAILY_REPORT_PERMISSIONS.view,"view",identity);
  permitted(principal,DAILY_REPORT_PERMISSIONS.edit,"edit",identity);
}
export function validateDailyReportData(data:DailyReportData):readonly string[]{
  const errors:string[]=[];
  if(!object(data) || data.kind!==TYPE) return ["daily-report-kind-invalid"];
  if(Object.keys(data).some(key=>!FIELDS.has(key)))errors.push("unexpected daily report data");
  if(!bounded(data.flockId) || !bounded(data.flockCode,80))errors.push("registered Flock required");
  if(!dateOnly(data.localDate) || data.timeZone!=="Africa/Lagos")errors.push("Africa/Lagos reporting date invalid");
  if(!Array.isArray(data.eventRefs) || data.eventRefs.length>MAX_EVENT_REFS) {
    errors.push("event links invalid");
  } else {
    const seen=new Set<string>();
    for(const ref of data.eventRefs){
      if(!object(ref)||Object.keys(ref).some(k=>!["kind","id","revision","sourceType"].includes(k))||
         !(NEVER as readonly string[]).includes(ref.kind as string)||!bounded(ref.id,160)||
         !Number.isSafeInteger(ref.revision)||(ref.revision as number)<1 ||
         !sourceSpec(ref.kind as RefKind,ref.sourceType)){
        errors.push("event link malformed");continue;
      }
      const key=ref.kind+"\u001f"+ref.id;
      if(seen.has(key))errors.push("duplicate event link");
      seen.add(key);
      if(object(data.noneToday)&&(data.noneToday as Record<string,unknown>)[ref.kind as string]===true)
        errors.push("None Today contradicts a linked "+ref.kind+" event");
    }
  }
  if(data.physicalCount!==undefined && (!Number.isSafeInteger(data.physicalCount)||data.physicalCount<0))
    errors.push("physical count invalid");
  if(data.noneToday!==undefined && (!object(data.noneToday) ||
      Object.keys(data.noneToday).some(k=>!(NEVER as readonly string[]).includes(k)) ||
      Object.values(data.noneToday).some(v=>v!==true))) errors.push("None Today evidence invalid");
  if(data.notes!==undefined && (!bounded(data.notes,2000)))errors.push("notes invalid");
  if(!["mobile","tablet","desktop","unknown"].includes(data.deviceClass))errors.push("device class invalid");
  if(!object(data.gps)||!["declined","unavailable"].includes(data.gps.state as string) ||
      Object.keys(data.gps).some(k=>k!=="state")) errors.push("unverified GPS coordinates forbidden");
  if(!object(data.operatorSnapshot)||!bounded(data.operatorSnapshot.name,160)||
      !bounded(data.operatorSnapshot.role,160))errors.push("operator snapshot missing");
  return errors;
}
const definition:ResourceDefinition<DailyReportData>=Object.freeze({
  resourceType:TYPE,initialState:"draft",mutableStates:["draft"],
  requireMakerChecker:true,
  permissions:{create:DAILY_REPORT_PERMISSIONS.edit,edit:DAILY_REPORT_PERMISSIONS.edit,delete:DAILY_REPORT_PERMISSIONS.edit},
  transitions:[
    {from:"draft",to:"submitted",action:"edit" as const,permission:DAILY_REPORT_PERMISSIONS.edit},
    {from:"submitted",to:"approved",action:"approve" as const,permission:DAILY_REPORT_PERMISSIONS.edit,approvalPermission:DAILY_REPORT_PERMISSIONS.approve},
    {from:"submitted",to:"rejected",action:"approve" as const,permission:DAILY_REPORT_PERMISSIONS.edit,approvalPermission:DAILY_REPORT_PERMISSIONS.approve},
    {from:"rejected",to:"draft",action:"edit" as const,permission:DAILY_REPORT_PERMISSIONS.edit},
  ],
  validate:validateDailyReportData,
});
// Request authority is held out-of-band (never in report data, audit or the principal object).
const AUTHORITIES=new WeakMap<object,DailyReportAuthority>();
/** Route glue: bind the authority snapshot returned by resolvePortalPrincipal to that exact principal object. */
export function bindDailyReportAuthority(principal:AuthenticatedPrincipal,authority:DailyReportAuthority){
  if(!authority||!authority.sessionId||!authority.fingerprint||authority.accountId!==principal.id)
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED",["fresh-authorization-unavailable"]);
  AUTHORITIES.set(principal,Object.freeze({...authority}));
  return principal;
}
function requireAuthority(principal:AuthenticatedPrincipal){
  const a=AUTHORITIES.get(principal);
  if(!a)throw new ResourceWorkflowError("AUTHORIZATION_DENIED",["fresh-authorization-unavailable"]);
  return a;
}
async function verifiedRead<T>(db:D1Database,principal:AuthenticatedPrincipal,value:T):Promise<T>{
  const authority=requireAuthority(principal);
  const check=await db.prepare("SELECT CASE WHEN " + DAILY_REPORT_AUTHORITY_SQL + " THEN 1 ELSE 0 END AS authorized")
    .bind(...dailyReportAuthorityParams(authority)).first<{authorized:number}>();
  if(check?.authorized!==1)throw new ResourceWorkflowError("AUTHORIZATION_DENIED",["fresh-authorization-unavailable"]);
  return value;
}
function service(db:D1Database,principal:AuthenticatedPrincipal,receipt?:DailyFlockReceipt){
  return new ResourceWorkflowService<DailyReportData>(definition,
    new D1ResourceRepository<DailyReportData>(db,undefined,requireAuthority(principal),undefined,receipt));
}
function parseRow(row:SourceRow,kind:string){
  if(typeof row.id!=="string" || row.resource_type!==kind ||
     typeof row.state!=="string" || !Number.isSafeInteger(row.revision) ||
     typeof row.subject_json!=="string" || typeof row.data_json!=="string")return null;
  try{
    const s:unknown=JSON.parse(row.subject_json);
    const data:unknown=JSON.parse(row.data_json);
    if(!object(s)||!object(data)||s.resourceType!==kind ||
       (s.resourceId!==undefined && s.resourceId!==row.id))return null;
    return {id:row.id,state:row.state,revision:row.revision,
      createdBy:typeof row.created_by==="string"?row.created_by:null,
      subject:s as AuthorizationSubject,data};
  }catch{return null;}
}
function recordInScope(row:ReturnType<typeof parseRow>,
 principal:AuthenticatedPrincipal):row is NonNullable<typeof row>{
  if(!row)return false;
  const farm=scope(principal);
  return row.subject.companyKey===farm.companyKey &&
    row.subject.locationKey===farm.locationKey;
}
async function queryRows(db:D1Database,principal:AuthenticatedPrincipal,kind:string,limit:number){
  const farm=scope(principal);
  const result=await db.prepare(
    "SELECT id,resource_type,state,revision,created_by,subject_json,data_json "+
    "FROM resource_records WHERE resource_type=? AND deleted_at IS NULL "+
    "AND json_extract(CASE WHEN json_valid(subject_json)=1 THEN subject_json ELSE '{}' END,'$.companyKey')=? "+
    "AND json_extract(CASE WHEN json_valid(subject_json)=1 THEN subject_json ELSE '{}' END,'$.locationKey')=? "+
    "ORDER BY id ASC LIMIT ?",
  ).bind(kind,farm.companyKey,farm.locationKey,limit+1).all<SourceRow>();
  const rows=result.results??[];
  if(rows.length>limit)throw new Error("DAILY_REPORT_SOURCE_LIMIT_EXCEEDED");
  return rows.map(r=>parseRow(r,kind)).filter((r):r is NonNullable<typeof r>=>recordInScope(r,principal));
}
async function rawReport(db:D1Database,principal:AuthenticatedPrincipal,id:string) {
  if(!bounded(id))throw hidden();
  const rows=await db.prepare(
    "SELECT id,resource_type,state,revision,created_by,subject_json,data_json "+
    "FROM resource_records WHERE id=? AND resource_type=? AND deleted_at IS NULL",
  ).bind(id,TYPE).all<SourceRow>();
  const found=(rows.results||[]).map(r=>parseRow(r,TYPE)).find(r=>recordInScope(r,principal));
  return found&&found.data.kind===TYPE?found as ResourceRecord<DailyReportData>:null;
}
type EligibleFlock=Readonly<{id:string;flockCode:string;species:string;house:string;placementDate:string;birdCount:number}>;
function realFlock(row:NonNullable<ReturnType<typeof parseRow>>):EligibleFlock|null{
  const d=row.data;
  if(row.state!=="active" || d.kind!=="flock" ||
     !bounded(d.flockCode,80)||!bounded(d.house)||!dateOnly(d.placementDate)||
     !["chicken","duck","turkey"].includes(String(d.species)) ||
     !Number.isSafeInteger(d.birdCount) || Number(d.birdCount)<1)return null;
  return Object.freeze({id:row.id,flockCode:d.flockCode,house:d.house,
    placementDate:d.placementDate,species:d.species as string,birdCount:d.birdCount as number});
}
async function getFlock(db:D1Database,principal:AuthenticatedPrincipal,id:string,code?:string,day?:string){
  const farm=scope(principal);
  const result=await db.prepare(
    "SELECT id,resource_type,state,revision,created_by,subject_json,data_json "+
    "FROM resource_records WHERE id=? AND resource_type='flock' AND state='active' "+
    "AND deleted_at IS NULL AND json_extract(CASE WHEN json_valid(subject_json)=1 THEN subject_json ELSE '{}' END,'$.companyKey')=? "+
    "AND json_extract(CASE WHEN json_valid(subject_json)=1 THEN subject_json ELSE '{}' END,'$.locationKey')=?",
  ).bind(id,farm.companyKey,farm.locationKey).all<SourceRow>();
  const match=(result.results||[]).map(r=>parseRow(r,"flock")).find(r=>recordInScope(r,principal));
  const source=match?realFlock(match):null;
  if(!source||(code&&source.flockCode.trim().toLowerCase()!==code.trim().toLowerCase())||
      (day&&source.placementDate>day))throw hidden();
  return source;
}
export async function listEligibleDailyReportFlocks(db:D1Database,principal:AuthenticatedPrincipal){
  permitted(principal,DAILY_REPORT_PERMISSIONS.edit,"create");
  const rows=await queryRows(db,principal,"flock",MAX_FLOCK_ROWS);
  const candidates=rows.flatMap(row=>{
    const item=realFlock(row);
    if(!item)return [];
    const can=authorize(principal,{
      channel:"api",action:"create",permission:DAILY_REPORT_PERMISSIONS.edit,
      subject:{...row.subject,resourceId:row.id},
    });
    return can.allowed?[item]:[];
  });
  const occurrences=new Map<string,number>();
  for(const item of candidates){
    const key=item.flockCode.trim().toLowerCase();
    occurrences.set(key,(occurrences.get(key)||0)+1);
  }
  const items=candidates.filter(item=>occurrences.get(item.flockCode.trim().toLowerCase())===1)
    .map(({id,flockCode,species,house,placementDate})=>({id,flockCode,species,house,placementDate}));
  return verifiedRead(db,principal,{state:items.length?"available" as const:"no-data" as const,items,
    nextCursor:null,requiresPreviousDailyReport:false as const,
    source:"Authenticated Active Flock Register" as const});
}
function lagosDay(value:unknown):string|null{
  if(typeof value!=="string"||
     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const t=Date.parse(value);
  return Number.isFinite(t)?new Date(t+3600000).toISOString().slice(0,10):null;
}
/** Mirrors SOURCE_AUDIT_SQL in the D1 guard (which is authoritative at write):
 * created@1, a receipt for each revision 1..R, latest state receipt = state. */
async function sourceAuditChainValid(db:D1Database,id:string,type:string,revision:number,state:string){
  const res=await db.prepare(
    "SELECT metadata_json FROM resource_audit_events WHERE resource_id=? AND resource_type=?",
  ).bind(id,type).all<{metadata_json:string}>();
  const revs=new Set<number>();let created=false;
  let latest:{rev:number;state:unknown}|null=null;
  for(const r of res.results||[]){
    let m:unknown;try{m=JSON.parse(r.metadata_json)}catch{continue}
    if(!object(m)||typeof m.revision!=="number"||!Number.isSafeInteger(m.revision)||m.revision<1||m.revision>revision)continue;
    if(!["resource.created","resource.transitioned","resource.updated"].includes(m.event as string))continue;
    revs.add(m.revision);
    if(m.event==="resource.created"&&m.revision===1)created=true;
    if(m.event!=="resource.updated"&&(!latest||m.revision>latest.rev))
      latest={rev:m.revision,state:m.event==="resource.created"?m.state:m.to};
  }
  return created&&revs.size===revision&&latest?.state===state;
}
/** Preflight (friendly errors + readback). The same proof is re-executed inside
 * the atomic D1 write by DAILY_REPORT_NONE_TODAY_PROOF_SQL. */
async function verifyEventRefs(db:D1Database,principal:AuthenticatedPrincipal,
  flock:EligibleFlock,localDate:string,raw:unknown):Promise<DailyReportData["eventRefs"]>{
  if(!Array.isArray(raw)||raw.length>MAX_EVENT_REFS)throw invalid("event links invalid");
  if(raw.length===0)return [];
  const farm=scope(principal);
  const flocks=await queryRows(db,principal,"flock",MAX_FLOCK_ROWS);
  const code=flock.flockCode.trim().toLowerCase();
  if(flocks.filter(f=>f.state==="active"&&typeof f.data.flockCode==="string"&&
      f.data.flockCode.trim().toLowerCase()===code).length!==1)throw invalid("Flock code is ambiguous");
  const out:{kind:RefKind;id:string;revision:number;sourceType?:ExtraSourceType}[]=[];
  const seen=new Set<string>();
  for(const ref of raw){
    if(!object(ref)||Object.keys(ref).some(k=>!["kind","id","revision","sourceType"].includes(k))||
       !(NEVER as readonly string[]).includes(ref.kind as string)||!bounded(ref.id,160)||
       !Number.isSafeInteger(ref.revision)||(ref.revision as number)<1)throw invalid("event link malformed");
    const kind=ref.kind as RefKind,spec=sourceSpec(kind,ref.sourceType);
    if(!spec)throw invalid("event source type invalid");
    if(seen.has(kind+"\u001f"+ref.id))throw invalid("duplicate event link");
    seen.add(kind+"\u001f"+ref.id);
    const found=await db.prepare(
      "SELECT id,resource_type,state,revision,created_by,subject_json,data_json "+
      "FROM resource_records WHERE id=? AND resource_type=? AND deleted_at IS NULL",
    ).bind(ref.id,spec.type).all<SourceRow>();
    const row=(found.results||[]).map(r=>parseRow(r,spec.type)).find(r=>recordInScope(r,principal));
    if(!row||row.subject.companyKey!==farm.companyKey||row.subject.locationKey!==farm.locationKey)throw hidden();
    if(!principal.permissions.includes(spec.view)||principal.deniedPermissions.includes(spec.view)||
       !authorize(principal,{channel:"api",action:"view",permission:spec.view,
         subject:{...row.subject,resourceId:row.id}}).allowed)throw hidden();
    const d=row.data;
    if(row.revision!==ref.revision)throw invalid("source event revision changed");
    if(!await sourceAuditChainValid(db,row.id,spec.type,row.revision as number,row.state))
      throw invalid("source event lacks audit evidence");
    if(!spec.states.includes(row.state)||d.kind!==spec.type)throw invalid("source event is not in a recorded state");
    if(typeof d.flockCode!=="string"||d.flockCode.trim().toLowerCase()!==code)throw invalid("source event belongs to another Flock");
    if(ref.sourceType!==undefined){
      if(row.subject.departmentKey!==farm.departmentKey || d.flockId!==flock.id ||
         (d.housePen!==undefined && d.housePen!==flock.house))
        throw invalid("source event belongs to another Flock or House");
      if(ref.sourceType==="flock-movement" && (d.movementType!=="mortality" ||
          !Number.isSafeInteger(d.quantity) || Number(d.quantity)<=0))
        throw invalid("mortality source is not a recorded mortality movement");
      if(ref.sourceType==="health-event" && d.eventType!=="treatment")
        throw invalid("medication source is not a treatment");
      if(ref.sourceType==="stage24-feed" && (d.useType!=="consumption" ||
          !["kg","ton"].includes(String(d.unit)) || typeof d.quantity!=="number" ||
          !Number.isFinite(d.quantity) || d.quantity<=0))
        throw invalid("Feed must be a posted consumption movement");
    } else {
      if(kind!=="feed"&&d.house!==flock.house)throw invalid("source event belongs to another House");
      if(kind==="feed"&&(d.movementType!=="consumed"||d.unit!=="kg"||
          typeof d.quantity!=="number"||!Number.isFinite(d.quantity)||d.quantity<=0))
        throw invalid("Feed must be a posted kg consumption movement");
    }
    if(lagosDay(d[spec.time])!==localDate)throw invalid("source event is not on the Africa/Lagos reporting date");
    out.push({kind,id:row.id,revision:row.revision as number,
      ...(ref.sourceType?{sourceType:ref.sourceType as ExtraSourceType}:{})});
  }
  return out.sort((a,b)=>a.kind===b.kind?(a.id<b.id?-1:1):(a.kind<b.kind?-1:1));
}
async function normalizedData(db:D1Database,principal:AuthenticatedPrincipal,input:unknown,existing?:DailyReportData){
  if(!object(input)||input.kind!==TYPE ||
      Object.keys(input).some(key=>!FIELDS.has(key)||
        key==="operatorSnapshot"||key==="gps"&&input.gps!==undefined&&!object(input.gps))) {
    throw invalid("daily report input invalid");
  }
  if(!bounded(input.flockId)||!bounded(input.flockCode,80)||!dateOnly(input.localDate))throw invalid("Flock or local day invalid");
  if(input.timeZone!=="Africa/Lagos")throw invalid("Africa/Lagos time zone required");
  const source=await getFlock(db,principal,input.flockId,input.flockCode,input.localDate);
  const refs=await verifyEventRefs(db,principal,source,input.localDate,input.eventRefs);
  const gps= input.gps===undefined?{state:"unavailable"}:input.gps as Record<string,unknown>;
  if(gps.state!=="unavailable"&&gps.state!=="declined")throw invalid("unverified GPS coordinates are not supported");
  if(Object.keys(gps).some(key=>key!=="state"))throw invalid("coordinates may not be claimed without source proof");
  const name=existing?.operatorSnapshot.name||principal.displayName;
  const role=existing?.operatorSnapshot.role||principal.jobTitle||"Farm Operator";
  const data={
    kind:TYPE,flockId:source.id,flockCode:source.flockCode,
    localDate:input.localDate,timeZone:"Africa/Lagos",
    eventRefs:refs,
    ...(input.physicalCount!==undefined?{physicalCount:input.physicalCount}:{}),
    ...(input.noneToday!==undefined?{noneToday:input.noneToday}:{}),
    ...(input.notes!==undefined?{notes:input.notes}:{}),
    deviceClass:input.deviceClass,
    gps,
    operatorSnapshot:{name,role},
  } as unknown as DailyReportData;
  const failures=validateDailyReportData(data);
  if(failures.length)throw new ResourceWorkflowError("VALIDATION_FAILED",failures);
  return Object.freeze(data);
}
async function stableId(principal:AuthenticatedPrincipal,data:DailyReportData){
  const farm=scope(principal);
  const identity=[farm.companyKey,farm.locationKey,data.flockId,data.localDate].join("\u001f");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(identity));
  return "daily-flock-"+[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function listDailyReports(db:D1Database,principal:AuthenticatedPrincipal){
  permitted(principal,DAILY_REPORT_PERMISSIONS.view,"view");
  const records=await queryRows(db,principal,TYPE,MAX_REPORT_ROWS);
  const items=records.filter(r=>r.data.kind===TYPE&&authorize(principal,{
    channel:"api",action:"view",permission:DAILY_REPORT_PERMISSIONS.view,
    subject:{...r.subject,resourceId:r.id},
  }).allowed).map(r=>({id:r.id,resourceType:TYPE,state:r.state,revision:r.revision,
    createdBy:r.createdBy,subject:r.subject,data:r.data as DailyReportData}));
  return verifiedRead(db,principal,{items,nextCursor:null,state:items.length?"available" as const:"no-data" as const});
}
export async function getDailyReport(db:D1Database,principal:AuthenticatedPrincipal,id:string){
  permitted(principal,DAILY_REPORT_PERMISSIONS.view,"view");
  const report=await rawReport(db,principal,id);
  if(!report)throw hidden();
  permitted(principal,DAILY_REPORT_PERMISSIONS.view,"view",report.subject);
  return verifiedRead(db,principal,report);
}
/** Read-only evidence for a separately granted, scoped audit investigator.
 * Audit observations cannot prove the outcome of an unreceipted request. */
export async function investigateLegacyDailyReport(db:D1Database,principal:AuthenticatedPrincipal,id:string) {
  const report=await getDailyReport(db,principal,id);
  permitted(principal,"farm.daily-report.audit.view","view",report.subject);
  const authority=requireAuthority(principal);
  const rows=await db.prepare(
    "SELECT a.actor_id,a.action,a.occurred_at,a.metadata_json FROM resource_audit_events a "+
    "JOIN resource_records r ON r.id=a.resource_id AND r.resource_type=a.resource_type "+
    "WHERE a.resource_id=? AND a.resource_type='daily-flock-report' AND r.deleted_at IS NULL "+
    "AND r.revision=? AND json(r.subject_json)=json(?) AND "+DAILY_REPORT_AUTHORITY_SQL+
    " ORDER BY a.occurred_at,a.id LIMIT 201",
  ).bind(id,report.revision,JSON.stringify(report.subject),...dailyReportAuthorityParams(authority))
    .all<{actor_id:string;action:string;occurred_at:string;metadata_json:string}>();
  if((rows.results || []).length>200)throw invalid("audit evidence exceeds review limit");
  const events=(rows.results || []).map(row=>{
    let metadata:unknown;
    try {metadata=JSON.parse(row.metadata_json)} catch {throw invalid("audit evidence malformed")}
    if(!object(metadata) || !Number.isSafeInteger(metadata.revision) || Number(metadata.revision)<1 ||
       !bounded(row.actor_id) || !bounded(row.action) || !bounded(row.occurred_at))
      throw invalid("audit evidence malformed");
    return {actorId:row.actor_id,action:row.action,revision:metadata.revision,occurredAt:row.occurred_at};
  });
  const current=await rawReport(db,principal,id);
  if(!current || current.revision!==report.revision || JSON.stringify(current.subject)!==JSON.stringify(report.subject))
    throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
  return verifiedRead(db,principal,{
    operationOutcome:"unconfirmed" as const,
    report:{id:report.id,state:report.state,revision:report.revision},
    events,
    limitation:"Audit evidence does not identify or fence an unreceipted request.",
  });
}

export async function createDailyReport(db:D1Database,principal:AuthenticatedPrincipal,input:unknown,receipt?:DailyFlockReceipt){
  requireAuthority(principal);
  permitted(principal,DAILY_REPORT_PERMISSIONS.edit,"create");
  const data=await normalizedData(db,principal,input);
  const id=await stableId(principal,data);
  const existing=await rawReport(db,principal,id);
  if(existing){
    if(!receipt && existing.createdBy===principal.id && JSON.stringify(existing.data)===JSON.stringify(data))return verifiedRead(db,principal,existing);
    throw new ResourceWorkflowError("RESOURCE_EXISTS");
  }
  try{
    return await verifiedRead(db,principal,await service(db,principal,receipt).create(principal,{id,subject:reportSubject(principal,id),data}));
  }catch(e){
    if(!receipt && e instanceof ResourceWorkflowError&&e.code==="RESOURCE_EXISTS"){
      const replay=await rawReport(db,principal,id);
      if(replay?.createdBy===principal.id&&JSON.stringify(replay.data)===JSON.stringify(data))return verifiedRead(db,principal,replay);
    }
    throw e;
  }
}
export async function updateDailyReport(db:D1Database,principal:AuthenticatedPrincipal,
  id:string,input:unknown,expectedRevision:number,receipt?:DailyFlockReceipt){
  requireAuthority(principal);
  const report=await rawReport(db,principal,id);
  if(!report||report.state!=="draft")throw hidden();
  permitted(principal,DAILY_REPORT_PERMISSIONS.edit,"edit",report.subject);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw invalid("revision invalid");
  const data=await normalizedData(db,principal,input,report.data);
  if(data.flockId!==report.data.flockId||data.localDate!==report.data.localDate)
    throw invalid("Flock and local report day cannot be changed");
  return verifiedRead(db,principal,await service(db,principal,receipt).update(principal,{id,subject:report.subject,data,expectedRevision}));
}
export async function transitionDailyReport(db:D1Database,principal:AuthenticatedPrincipal,
  id:string,to:string,expectedRevision:number,receipt?:DailyFlockReceipt){
  requireAuthority(principal);
  const report=await rawReport(db,principal,id);
  if(!report)throw hidden();
  permitted(principal,DAILY_REPORT_PERMISSIONS.edit,to==="approved"||to==="rejected"?"approve":"edit",report.subject);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
    throw invalid("revision invalid");
  if(!["submitted","approved","rejected","draft"].includes(to))
    throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED");
  await getFlock(db,principal,report.data.flockId,report.data.flockCode,report.data.localDate);
  return verifiedRead(db,principal,await service(db,principal,receipt).transition(principal,{id,to,expectedRevision}));
}
type Metric=Readonly<{status:"not-yet-recorded"|"none-recorded"|"awaiting-verification"|"recorded";value?:number;sourceIds:readonly string[]}>;
const notYet=():Metric=>({status:"not-yet-recorded",sourceIds:[]});
const none=(yes:boolean):Metric=>yes?{status:"none-recorded",value:0,sourceIds:[]}:notYet();
/** No invented count or operational totals; linked producer reconciliation
 * and event-at-write provenance are explicit remaining acceptance gates. */
export async function getDailyReportProjection(db:D1Database,principal:AuthenticatedPrincipal,
 input:Readonly<{flockId:string;localDate:string}>){
  permitted(principal,DAILY_REPORT_PERMISSIONS.view,"view");
  if(!bounded(input.flockId)||!dateOnly(input.localDate))throw invalid("projection date or Flock invalid");
  await getFlock(db,principal,input.flockId,undefined,input.localDate);
  const reports=await queryRows(db,principal,TYPE,MAX_REPORT_ROWS);
  const matching=reports.filter(r=>r.state==="approved"&&r.data.kind===TYPE&&
    r.data.flockId===input.flockId&&r.data.localDate===input.localDate&&
    authorize(principal,{channel:"api",action:"view",
      permission:DAILY_REPORT_PERMISSIONS.view,
      subject:{...r.subject,resourceId:r.id}}).allowed);
  if(matching.length>1)throw invalid("ambiguous approved daily reports");
  const reported=matching.length===1?matching[0].data as DailyReportData:null;
  // A verified source may be posted late or backdated after approval.
  // Never keep displaying an approved false zero without checking live D1.
  const sourceEvidenceConfirmed=async()=>{
    if(!reported || (!reported.noneToday && !reported.eventRefs.length))return true;
    const check=await db.prepare(
      "SELECT CASE WHEN " + DAILY_REPORT_NONE_TODAY_PROOF_SQL + " THEN 1 ELSE 0 END AS confirmed",
    ).bind(...dailyReportNoneTodayProofParams({subject:matching[0].subject,data:reported}))
      .first<{confirmed:number}>();
    return check?.confirmed===1;
  };
  let contradictorySource=!(await sourceEvidenceConfirmed());
  const noneToday=contradictorySource?undefined:reported?.noneToday;
  const pending:Metric={status:"awaiting-verification",sourceIds:[]};
  const linked=async(kind:RefKind,fallback:Metric):Promise<Metric>=>{
    const refs=(reported?.eventRefs||[]).filter(r=>r.kind===kind);
    if(contradictorySource||!refs.length)return fallback;
    let total=0;const ids:string[]=[];
    for(const ref of refs){
      const spec=sourceSpec(kind,ref.sourceType);
      if(!spec)return pending;
      const rows=await db.prepare(
        "SELECT id,resource_type,state,revision,created_by,subject_json,data_json FROM resource_records WHERE id=? AND resource_type=? AND deleted_at IS NULL",
      ).bind(ref.id,spec.type).all<SourceRow>();
      const row=(rows.results||[]).map(r=>parseRow(r,spec.type)).find(r=>recordInScope(r,principal));
      // Unreadable (revoked view) sources are never summarised for this viewer.
      if(!row||row.revision!==ref.revision||!spec.states.includes(row.state)||
         (ref.sourceType!==undefined && row.subject.departmentKey!==scope(principal).departmentKey)||
         !principal.permissions.includes(spec.view)||principal.deniedPermissions.includes(spec.view)||
         !authorize(principal,{channel:"api",action:"view",permission:spec.view,
           subject:{...row.subject,resourceId:row.id}}).allowed)return pending;
      const d=row.data;
      total+=kind==="mortality"
        ?Number(ref.sourceType==="flock-movement"?d.quantity:d.birdCount)
        :kind==="feed"?Number(d.quantity)*(ref.sourceType==="stage24-feed"&&d.unit==="ton"?1000:1):1;
      ids.push(row.id);
    }
    return Number.isFinite(total)?{status:"recorded",value:total,sourceIds:ids}:pending;
  };
  const mortality=await linked("mortality",none(noneToday?.mortality===true));
  const feedConsumedKg=await linked("feed",none(noneToday?.feed===true));
  const medicationEvents=await linked("medication",none(noneToday?.medication===true));
  const vaccinationEvents=await linked("vaccination",none(noneToday?.vaccination===true));
  if(!contradictorySource)contradictorySource=!(await sourceEvidenceConfirmed());
  return verifiedRead(db,principal,{
    timeZone:"Africa/Lagos" as const,
    localDay:{
      localDate:input.localDate,approvalState:contradictorySource?"source-conflict" as const:reported?"approved" as const:"missing" as const,
      mortality:contradictorySource?pending:mortality,
      feedConsumedKg:contradictorySource?pending:feedConsumedKg,
      medicationEvents:contradictorySource?pending:medicationEvents,
      vaccinationEvents:contradictorySource?pending:vaccinationEvents,
    },
    rolling24Hours:{
      mortality:notYet(),feedConsumedKg:notYet(),
      medicationEvents:notYet(),vaccinationEvents:notYet(),
    },
    currentBirds:{
      ...(!contradictorySource&&reported?.physicalCount!==undefined?{physicalCount:reported.physicalCount}:{}),
      reconciliationState:"not-yet-source-reconciled" as const,
    },
  });
}
