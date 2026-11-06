/**
 * Stage 25 Breed Management: verified Farm Operations API v7 receipts.
 * Server response is authoritative. Never disclose arbitrary returned fields,
 * infer breeding performance, manufacture audit IDs, or trust HTTP 200 alone.
 */
import {interpretOperationFeedback} from "./stage25-feedback-contract.ts";
import type {FeedbackResult} from "./stage25-feedback-contract.ts";
import {BREED_FIELDS,matchesSubmittedRecord} from "./stage25-resource-data-proof.ts";

export type BreedMutation="create"|"update"|"activate"|"deactivate";
export type BreedFeedbackInput={
  operation:BreedMutation;
  httpStatus:number;
  body:unknown;
  expectedCode:string;
  expectedData?:unknown;
  expectedId?:string;
  expectedRevision?:number;
  expectedState?:"active"|"inactive";
};

const obj=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==="object" && !Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==="string" && v.length>0 && v.length<=160 &&
  v.trim()===v && /^[A-Za-z0-9][A-Za-z0-9_.:\-]*$/.test(v);
const revision=(v:unknown):v is number=>Number.isSafeInteger(v) && (v as number)>=1;
const expectedResultState=(input:BreedFeedbackInput):string=>
  input.operation==="create" || input.operation==="activate" ? "active" :
  input.operation==="deactivate" ? "inactive" : input.expectedState||"";

const uncertain=():FeedbackResult=>({
  state:"unconfirmed",tone:"warning",title:"Breed Outcome Not Confirmed",
  message:"The server did not confirm the matching breed revision. Keep your entries and reconcile before another write.",
  recordId:null,revision:null,auditId:null,occurredAt:null,canOpenRecord:false,canShowAudit:false,
});

export function interpretBreedOperation(input:BreedFeedbackInput):FeedbackResult {
  const {httpStatus,body,operation,expectedCode,expectedData,expectedId,expectedRevision,expectedState}=input;
  const action=operation==="create"?"create":"update";
  if(!["create","update","activate","deactivate"].includes(operation) ||
     typeof expectedCode!=="string" || expectedCode.length===0 ||
     expectedCode.length>80 || expectedCode.trim()!==expectedCode)return uncertain();
  if(httpStatus!==200 && httpStatus!==201)
    return interpretOperationFeedback({httpStatus,action,body:null});

  if(httpStatus!==(operation==="create"?201:200) || !obj(body))return uncertain();
  const canonical=body;
  const data=obj(canonical.data)?canonical.data:null;
  if(!data || data.kind!=="breed" || data.breedCode!==expectedCode ||
     !id(canonical.id) || !revision(canonical.revision) ||
     canonical.state!==expectedResultState(input))return uncertain();
  if(!matchesSubmittedRecord(data,expectedData,BREED_FIELDS))return uncertain();
  if(operation==="create"){
    if(expectedId!==undefined || expectedRevision!==undefined ||
       expectedState!==undefined || canonical.revision!==1)return uncertain();
  }else{
    if(!id(expectedId) || canonical.id!==expectedId ||
       !revision(expectedRevision) || canonical.revision!==expectedRevision+1 ||
       !["active","inactive"].includes(String(expectedState)))return uncertain();
    if(operation==="activate" && expectedState!=="inactive")return uncertain();
    if(operation==="deactivate" && expectedState!=="active")return uncertain();
    if(operation==="update" && canonical.state!==expectedState)return uncertain();
  }
  const receipt=interpretOperationFeedback({httpStatus,action,
    body:{ok:true,action,state:"saved",record:{id:canonical.id,revision:canonical.revision}},
    auditReadAuthorized:false});
  if(receipt.state!=="saved")return uncertain();
  const title:Record<BreedMutation,string>={
    create:"Breed Record Created",update:"Breed Changes Saved",
    activate:"Breed Activation Confirmed",deactivate:"Breed Deactivation Confirmed",
  };
  const message:Record<BreedMutation,string>={
    create:"The authorized server created an active breed record. Suitability and performance are not inferred.",
    update:"The authorized server confirmed the submitted breed fields and revision. Performance is not inferred.",
    activate:"The authorized server confirmed this breed is active. Flock performance is not implied.",
    deactivate:"The authorized server confirmed this breed is inactive. Existing flock records are not rewritten.",
  };
  return {...receipt,title:title[operation],message:message[operation],
    auditId:null,canShowAudit:false,occurredAt:null};
}

export type BreedRequest={
  operation:BreedMutation;
  expectedCode:string;
  expectedData?:unknown;
  expectedId?:string;
  expectedRevision?:number;
  expectedState?:"active"|"inactive";
  send:()=>Promise<{status:number;json:()=>Promise<unknown>}>;
};
export type BreedDelivery={
  feedback:FeedbackResult;confirmed:boolean;suppressDuplicate:boolean;
  preserveInput:boolean;refreshHistory:boolean;requiresSignIn:boolean;
  requiresReconciliation:boolean;
};
const blocked=():FeedbackResult=>({
  state:"unconfirmed",tone:"warning",title:"Reconciliation Required",
  message:"The Breed operation may have reached the server. Do not retry without authoritative reconciliation or durable backend idempotency.",
  recordId:null,revision:null,auditId:null,occurredAt:null,canOpenRecord:false,canShowAudit:false,
});

export function createBreedActionController(){
  let busy=false;
  let reconciliation=false;
  const delivery=(feedback:FeedbackResult):BreedDelivery=>{
    const confirmed=feedback.state==="saved";
    if(["unconfirmed","unavailable","pending","conflict"].includes(feedback.state))
      reconciliation=true;
    return {feedback,confirmed,suppressDuplicate:false,
      preserveInput:!confirmed,refreshHistory:confirmed||feedback.state==="conflict",
      requiresSignIn:false,requiresReconciliation:reconciliation};
  };
  return {
    get busy(){return busy;},
    get requiresReconciliation(){return reconciliation;},
    async run(input:BreedRequest):Promise<BreedDelivery>{
      if(reconciliation)return {feedback:blocked(),confirmed:false,
        suppressDuplicate:true,preserveInput:true,refreshHistory:false,
        requiresSignIn:false,requiresReconciliation:true};
      if(busy){
        const waiting:FeedbackResult={...blocked(),state:"pending",tone:"info",
          title:"Breed Request In Progress",
          message:"This request is still processing. A second operation was not sent."};
        return {feedback:waiting,confirmed:false,suppressDuplicate:true,
          preserveInput:true,refreshHistory:false,requiresSignIn:false,
          requiresReconciliation:false};
      }
      busy=true;
      try{
        const res=await input.send();
        if(!res || !Number.isInteger(res.status))return delivery(blocked());
        const httpStatus=res.status;
        if(httpStatus!==200 && httpStatus!==201){
          const result=delivery(interpretBreedOperation({...input,httpStatus,body:null}));
          return {...result,requiresSignIn:httpStatus===401};
        }
        if(typeof res.json!=="function")return delivery(blocked());
        const body=await res.json();
        return delivery(interpretBreedOperation({...input,httpStatus,body}));
      }catch{
        // The server may have committed before the browser lost connectivity.
        return delivery(blocked());
      }finally{
        busy=false;
      }
    },
  };
}
