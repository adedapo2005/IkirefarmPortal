import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import type { EggBatchData } from "./farm-operational-core.ts";
import { authorize } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";

type FlockRow = Readonly<{
 id:string; resource_type:string; state:string; subject_json:string; data_json:string;
}>;
const normalize=(s:string)=>s.trim().toLowerCase();
const required=(value:unknown)=>typeof value==="string" && value.trim().length>0 && value.length<=120;
const sourceError=()=>new ResourceWorkflowError("RESOURCE_NOT_FOUND");

export type VerifiedEggFlockSource = Readonly<{
 id:string; flockCode:string; house:string; placementDate:string;
}>;

/** This is a reference check for an Egg write, not an inventory.view read.
 * The caller's own Egg permission and company/site scope remain mandatory. */
export function assertEggWritePermission(
 principal: AuthenticatedPrincipal,
 operation: "create" | "approve",
 resourceId?:string,
){
 const farm=principal.organizationScope;
 if(principal.status!=="active" || principal.restriction!=="none" ||
   !principal.farmAuthorized || !farm?.companyKey?.trim() || !farm.locationKey?.trim()){
  throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
 }
 const decision=authorize(principal,{
  channel:"api",action:operation,permission:"farm.eggs.edit",
  ...(operation==="approve"?{approvalPermission:"farm.eggs.approve"}:{}),
  subject:{resourceType:"egg-batch",companyKey:farm.companyKey,locationKey:farm.locationKey,
   departmentKey:farm.departmentKey,...(resourceId?{resourceId}:{})},
 });
 if(!decision.allowed)throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
 return farm;
}

/** Uses source rows under the authenticated company/site, never a guessed
 * browser Flock ID, inventory.view, or a previous Egg/Daily Report. */
export async function resolveEggFlockForWrite(
 db:D1Database,principal:AuthenticatedPrincipal,data:EggBatchData,
):Promise<VerifiedEggFlockSource>{
 const farm=principal.organizationScope;
 if(!farm?.companyKey || !farm.locationKey ||
    !required(data.flockCode) || !required(data.house) ||
    !required(data.collectedAt) ||
    (data.flockId!==undefined && !required(data.flockId))){
  throw sourceError();
 }
 const found=await db.prepare(
  "SELECT id, resource_type, state, subject_json, data_json FROM resource_records "+
  "WHERE resource_type = 'flock' AND state = 'active' AND deleted_at IS NULL "+
  "AND json_extract(CASE WHEN json_valid(subject_json)=1 THEN subject_json ELSE '{}' END,'$.companyKey') = ? "+
  "AND json_extract(CASE WHEN json_valid(subject_json)=1 THEN subject_json ELSE '{}' END,'$.locationKey') = ? "+
  "AND LOWER(TRIM(json_extract(CASE WHEN json_valid(data_json)=1 THEN data_json ELSE '{}' END,'$.flockCode'))) = LOWER(TRIM(?)) "+
  "ORDER BY id ASC LIMIT 3",
 ).bind(farm.companyKey,farm.locationKey,data.flockCode).all<FlockRow>();
 const rows=found.results||[];
 if(rows.length!==1 || !rows[0] || typeof rows[0].id!=="string")throw sourceError();
 const row=rows[0];
 let rawSubject:unknown,rawData:unknown;
 try{rawSubject=JSON.parse(row.subject_json);rawData=JSON.parse(row.data_json);}
 catch{throw sourceError();}
 if(!rawSubject||typeof rawSubject!=="object"||Array.isArray(rawSubject)||
    !rawData||typeof rawData!=="object"||Array.isArray(rawData))throw sourceError();
 const subject=rawSubject as Record<string,unknown>;
 const flock=rawData as Record<string,unknown>;
 if(row.resource_type!=="flock"||row.state!=="active"||
   subject.resourceType!=="flock"||
   (subject.resourceId!==undefined && subject.resourceId!==row.id)||
   subject.companyKey!==farm.companyKey || subject.locationKey!==farm.locationKey ||
   flock.kind!=="flock" || !required(flock.flockCode) ||
   normalize(flock.flockCode as string)!==normalize(data.flockCode) ||
   !required(flock.house)||normalize(flock.house as string)!==normalize(data.house) ||
   !required(flock.placementDate)||
   (data.flockId!==undefined && data.flockId!==row.id))throw sourceError();
 const date=flock.placementDate as string;
 const canonical=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
 const at=Date.parse(date+"T00:00:00+01:00");
 if(!canonical || !Number.isFinite(at)||new Date(at+3600000).toISOString().slice(0,10)!==date ||
    !Number.isFinite(Date.parse(data.collectedAt))||
    Date.parse(data.collectedAt)<at)throw sourceError();
 return Object.freeze({id:row.id,flockCode:flock.flockCode as string,
  house:flock.house as string,placementDate:date});
}

/**
 * Transaction-time D1 proof for fresh Egg creation and draft->VERIFIED.
 * Recheck the exact Flock ID, company/site, business code, recorded House,
 * placement chronology and unique active code in the SAME SQL mutation.
 * Duplicate JSON keys in persisted source are never trustworthy authority.
 */
export const EGG_FLOCK_AT_WRITE_SQL =
 "EXISTS (SELECT 1 FROM resource_records AS parent "+
 "WHERE parent.id = ? AND parent.resource_type = 'flock' AND parent.state = 'active' AND parent.deleted_at IS NULL "+
 "AND json_valid(parent.subject_json)=1 AND json_valid(parent.data_json)=1 "+
 "AND json_extract(parent.subject_json,'$.resourceType')='flock' "+
 "AND (json_type(parent.subject_json,'$.resourceId') IS NULL OR json_extract(parent.subject_json,'$.resourceId')=parent.id) "+
 "AND json_extract(parent.subject_json,'$.companyKey') = ? "+
 "AND json_extract(parent.subject_json,'$.locationKey') = ? "+
 "AND json_extract(parent.data_json,'$.kind')='flock' "+
 "AND LOWER(TRIM(json_extract(parent.data_json,'$.flockCode'))) = LOWER(TRIM(?)) "+
 "AND LOWER(TRIM(json_extract(parent.data_json,'$.house'))) = LOWER(TRIM(?)) "+
 "AND julianday(?) >= julianday(json_extract(parent.data_json,'$.placementDate')||'T00:00:00+01:00') "+
 "AND NOT EXISTS (SELECT 1 FROM json_tree(parent.subject_json) AS entry "+
 "WHERE entry.key IS NOT NULL GROUP BY entry.parent,entry.key HAVING COUNT(*)>1) "+
 "AND NOT EXISTS (SELECT 1 FROM json_tree(parent.data_json) AS entry "+
 "WHERE entry.key IS NOT NULL GROUP BY entry.parent,entry.key HAVING COUNT(*)>1) "+
 "AND (SELECT COUNT(*) FROM resource_records AS duplicate "+
 "WHERE duplicate.resource_type='flock' AND duplicate.state='active' AND duplicate.deleted_at IS NULL "+
 "AND json_extract(CASE WHEN json_valid(duplicate.subject_json)=1 THEN duplicate.subject_json ELSE '{}' END,'$.companyKey')=? "+
 "AND json_extract(CASE WHEN json_valid(duplicate.subject_json)=1 THEN duplicate.subject_json ELSE '{}' END,'$.locationKey')=? "+
 "AND LOWER(TRIM(json_extract(CASE WHEN json_valid(duplicate.data_json)=1 THEN duplicate.data_json ELSE '{}' END,'$.flockCode')))=LOWER(TRIM(?)))=1)";

export function eggFlockWriteParams(
 record:Readonly<{subject:Readonly<{companyKey?:string;locationKey?:string}>,data:unknown}>,
):readonly string[]{
 const payload=record.data;
 const data=payload && typeof payload==="object" && !Array.isArray(payload)
  ?payload as Record<string,unknown>:null;
 const {companyKey,locationKey}=record.subject;
 if(data?.kind!=="egg-batch" ||
   !required(data.flockId)||!required(data.flockCode)||!required(data.house)||
   !required(data.collectedAt)|| !required(companyKey)||!required(locationKey))
  throw new ResourceWorkflowError("VALIDATION_FAILED",["Egg/Flock authoritative relationship missing"]);
 return Object.freeze([
  data.flockId as string,companyKey!,locationKey!,
  data.flockCode as string,data.house as string,data.collectedAt as string,
  companyKey!,locationKey!,data.flockCode as string,
 ]);
}
