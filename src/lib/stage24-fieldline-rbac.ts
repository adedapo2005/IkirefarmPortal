/** Pure presentation policy. Permission booleans MUST come from server-authorized scope, not a client role name. */
export type Authority = Readonly<{ state:"loading"|"authorized"|"denied"; operations:boolean; finance:boolean; audit:boolean }>;
export type MissionData = Readonly<{
  flockCode:string; localDate:string;
  mortality?:number; feedKg?:number; physicalCount?:number;
  medicationEvents?:number; vaccinationEvents?:number; placementDate?:string; house?:string;
  approvalState?:"approved"|"missing"|"source-conflict";
  linkedEvidence?:number; pendingReviews?:number; reportCount?:number;
  revenueNgn?:number; costNgn?:number; sourceRefs?:Partial<Record<"mortality"|"feed"|"medication"|"vaccinations",readonly string[]>>;
  metricStates?:Partial<Record<"mortality"|"feed"|"medication"|"vaccinations","recorded"|"none-recorded"|"not-yet-recorded"|"awaiting-verification">>;
  openingBirds?:number; placementSource?:Readonly<{id:string;revision:number}>;
}>;
export type MissionView = Readonly<{
  status:"loading"|"denied"|"ready"; operational:ReadonlyArray<{id:string;label:string;value:string;note:string}>;
  financial:ReadonlyArray<{id:string;label:string;value:string}>;
  alerts:ReadonlyArray<{id:string;priority:"urgent"|"review"|"info";message:string}>;
  canShowFinance:boolean; canShowAudit:boolean; copilot:string;
}>;
const fmt=(value:number|undefined,unit="") => value!==undefined&&Number.isFinite(value)&&value>=0?new Intl.NumberFormat("en-NG",{maximumFractionDigits:1}).format(value)+unit:"Not Confirmed";
const money=(v:number|undefined)=>v!==undefined&&Number.isFinite(v)&&v>=0?new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(v):"Not Confirmed";
export function fieldlineView(authority:Authority,source:MissionData|null):MissionView {
  const blocked:MissionView={status:authority.state==="loading"?"loading":"denied",operational:[],financial:[],alerts:[],canShowFinance:false,canShowAudit:false,copilot:"Authorized Operational Context Is Required."};
  if(authority.state!=="authorized"||!authority.operations||!source)return blocked;
  // This projection is scoped by the authenticated report reader upstream.
  const operational=[
    {id:"birds",label:"Physical Count",value:fmt(source.physicalCount),note:"Not A Reconciled Stock Balance"},
    {id:"mortality",label:"Mortality",value:fmt(source.mortality),note:"Local-Day Source Only"},
    {id:"feed",label:"Feed Used",value:fmt(source.feedKg," Kg"),note:"Local-Day Source Only"},
    {id:"review",label:"Submitted For Review",value:fmt(source.pendingReviews),note:"Approval Is Independent"},
  ];
  const alerts:MissionView["alerts"][number][]=[];
  if(source.approvalState==="source-conflict") alerts.push({id:"conflict",priority:"urgent",message:"Conflicting Source Evidence Needs Review."});
  if(source.approvalState==="missing") alerts.push({id:"missing",priority:"urgent",message:"Approved Daily Evidence Is Missing."});
  if((source.pendingReviews??0)>0)alerts.push({id:"review",priority:"review",message:"Submitted Reports Require Independent Review."});
  if(!alerts.length)alerts.push({id:"integrity",priority:"info",message:"Continue Checking Source Reconciliation. No Health Score Is Certified."});
  const finance=authority.finance?[
    {id:"revenue",label:"Recorded Revenue",value:money(source.revenueNgn)},
    {id:"cost",label:"Recorded Cost",value:money(source.costNgn)},
  ]:[];
  const copilot=alerts[0].message+" Open The Relevant Authorized Workspace And Review Linked Evidence Before Taking Action.";
  return {status:"ready",operational,financial:finance,alerts,canShowFinance:authority.finance,canShowAudit:authority.audit,copilot};
}
