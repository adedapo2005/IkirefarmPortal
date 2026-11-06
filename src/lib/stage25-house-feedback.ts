/**
 * Stage 25 House Register feedback, reconciled to the ACTUAL API v7
 * resource return shape. Presentation only; backend authorizes each write.
 *
 * No client-side optimistic success, synthetic actor/audit details, assumed
 * activated house, or invented unit/capacity metrics.
 */
import { interpretOperationFeedback } from "./stage25-feedback-contract.ts";
import type { FeedbackResult } from "./stage25-feedback-contract.ts";
import { HOUSE_FIELDS, matchesSubmittedRecord } from "./stage25-resource-data-proof.ts";

export type HouseMutation =
  | "create" | "update" | "activate" | "maintenance" | "deactivate";

export type HouseFeedbackInput = {
  operation: HouseMutation;
  httpStatus: number;
  body: unknown;
  expectedCode: string;
  /** Submitted form-data proof required for Create and Edit confirmations. */
  expectedData?: unknown;
  expectedId?: string;
  expectedRevision?: number;
  expectedState?: "inactive" | "active" | "maintenance";
};

const validId=(v:unknown):v is string=>
  typeof v==="string" && v.length>=1 && v.length<=160 &&
  v.trim()===v && /^[a-zA-Z0-9][a-zA-Z0-9_.:\-]*$/.test(v);
const validRev=(v:unknown):v is number=>Number.isSafeInteger(v) && (v as number)>=1;
const isObject=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==="object" && !Array.isArray(v);
const states=["inactive","active","maintenance"] as const;
const stateFor=(input:HouseFeedbackInput):string=>{
  switch(input.operation){
    case "create":return "inactive";
    case "activate":return "active";
    case "maintenance":return "maintenance";
    case "deactivate":return "inactive";
    default:return input.expectedState || "";
  }
};
const noReceipt=():FeedbackResult=>({
  state:"unconfirmed",tone:"warning",title:"House Outcome Not Confirmed",
  message:"The server did not return the matching house record and revision. Do not retry before reconciliation.",
  recordId:null,revision:null,auditId:null,occurredAt:null,canOpenRecord:false,canShowAudit:false,
});

export function interpretHouseOperation(input:HouseFeedbackInput):FeedbackResult {
  const {httpStatus,body,operation,expectedCode,expectedData,expectedId,expectedRevision,expectedState}=input;
  const action=operation==="create"?"create":"update";
  if(!["create","update","activate","maintenance","deactivate"].includes(operation) ||
     typeof expectedCode!=="string" || !expectedCode.trim() ||
     expectedCode.length>80 || expectedCode!==expectedCode.trim()) return noReceipt();

  // Route errors go through the existing fail-closed generic response mapper.
  if(httpStatus!==200 && httpStatus!==201){
    return interpretOperationFeedback({httpStatus,action,body:null});
  }
  if(httpStatus!==(operation==="create"?201:200) || !isObject(body))return noReceipt();
  const record=body;
  const data=isObject(record.data)?record.data:null;
  if(!data || data.kind!=="house" || data.houseCode!==expectedCode ||
     !validId(record.id) || !validRev(record.revision) ||
     record.state!==stateFor(input))return noReceipt();
  if(!matchesSubmittedRecord(data,expectedData,HOUSE_FIELDS))return noReceipt();

  if(operation==="create"){
    if(expectedId!==undefined || expectedRevision!==undefined || expectedState!==undefined ||
       record.revision!==1)return noReceipt();
  }else{
    if(!validId(expectedId) || record.id!==expectedId ||
       !validRev(expectedRevision) || record.revision!==expectedRevision+1 ||
       !states.includes(expectedState as typeof states[number]))return noReceipt();
    // A normal edit cannot implicitly activate/close/maintain a House.
    if(operation==="update" && record.state!==expectedState)return noReceipt();
  }
  const confirmed=interpretOperationFeedback({httpStatus,action,
    body:{ok:true,action,state:"saved",record:{id:record.id,revision:record.revision}},
    auditReadAuthorized:false});
  if(confirmed.state!=="saved")return noReceipt();
  const titles:Record<HouseMutation,string>={
    create:"House Record Created",
    update:"House Changes Saved",
    activate:"House Activation Confirmed",
    maintenance:"House Maintenance Confirmed",
    deactivate:"House Deactivation Confirmed",
  };
  const messages:Record<HouseMutation,string>={
    create:"The authorized server created an inactive house record. Activation is a separate controlled action.",
    update:"The authorized server confirmed this house record revision. Readiness and occupancy are not inferred.",
    activate:"The authorized server confirmed the house is active. Occupancy is not inferred.",
    maintenance:"The authorized server confirmed this house is in maintenance. No flock movement is implied.",
    deactivate:"The authorized server confirmed this house is inactive. Flock movements are not implied.",
  };
  return {...confirmed,title:titles[operation],message:messages[operation],
    auditId:null,occurredAt:null,canShowAudit:false};
}

export type HouseRequest={
  operation:HouseMutation;
  expectedCode:string;
  expectedData?:unknown;
  expectedId?:string;
  expectedRevision?:number;
  expectedState?:"inactive"|"active"|"maintenance";
  send:()=>Promise<{status:number;json:()=>Promise<unknown>}>;
};
export type HouseDelivery={
  feedback:FeedbackResult;
  confirmed:boolean;
  suppressDuplicate:boolean;
  preserveInput:boolean;
  refreshHistory:boolean;
  requiresSignIn:boolean;
  requiresReconciliation:boolean;
};
const blockedFeedback=():FeedbackResult=>({
  state:"unconfirmed",tone:"warning",title:"Reconciliation Required",
  message:"An earlier house operation may have reached the server. Do not retry without authoritative reconciliation or backend idempotency.",
  recordId:null,revision:null,auditId:null,occurredAt:null,canOpenRecord:false,canShowAudit:false,
});

export function createHouseActionController(){
  let busy=false;
  let reconciliation=false;
  const wrap=(feedback:FeedbackResult,suppressDuplicate=false):HouseDelivery=>{
    const confirmed=feedback.state==="saved";
    const needsReconciliation=feedback.state==="unconfirmed" || feedback.state==="unavailable" ||
      feedback.state==="pending" || feedback.state==="conflict";
    if(needsReconciliation)reconciliation=true;
    return {feedback,confirmed,suppressDuplicate,preserveInput:!confirmed,
      refreshHistory:confirmed || feedback.state==="conflict",
      requiresSignIn:false,
      requiresReconciliation:reconciliation};
  };
  return {
    get busy(){return busy;},
    get requiresReconciliation(){return reconciliation;},
    async run(input:HouseRequest):Promise<HouseDelivery>{
      if(reconciliation)return {feedback:blockedFeedback(),confirmed:false,
        suppressDuplicate:true,preserveInput:true,refreshHistory:false,
        requiresSignIn:false,requiresReconciliation:true};
      if(busy){
        const f:FeedbackResult={...blockedFeedback(),state:"pending",
          tone:"info",title:"Request In Progress",message:"This house operation is still in progress. Do not submit it again."};
        return {feedback:f,confirmed:false,suppressDuplicate:true,
          preserveInput:true,refreshHistory:false,requiresSignIn:false,
          requiresReconciliation:false};
      }
      busy=true;
      try{
        const response=await input.send();
        if(!response || !Number.isInteger(response.status))return wrap(blockedFeedback());
        const status=response.status;
        if(status!==200 && status!==201){
          const feedback=interpretHouseOperation({...input,httpStatus:status,body:null});
          const result=wrap(feedback);
          return {...result,requiresSignIn:status===401};
        }
        if(typeof response.json!=="function")return wrap(blockedFeedback());
        const body=await response.json();
        return wrap(interpretHouseOperation({...input,httpStatus:status,body}));
      }catch{
        // The server may have committed before the connection broke.
        return wrap(blockedFeedback());
      }finally{
        busy=false;
      }
    },
  };
}
