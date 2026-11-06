export type ActivityChannelFilter = "ALL" | "WHATSAPP" | "EMAIL" | "SOCIAL_AUTH";
export type ActivityViewItem = {
  id:string; channel:string; purpose:string; status:string; recipient_masked:string|null;
  error_code:string|null; provider_accepted:number; created_at:string; updated_at:string;
  timeline:Array<{status:string;occurredAt:string;errorCode:string|null}>;
};
export type ActivityPayload = {
  policy:{retentionDays:15|30;revision:number}; items:ActivityViewItem[]; fetchedAt:string;
};
export type ActivityViewState = {
  channel:ActivityChannelFilter; snapshot:ActivityPayload|null; retentionDraft:15|30|null;
  requestId:number; refreshing:boolean; error:string; lastFetchedAt:string;
};
export const initialActivityView:ActivityViewState = {
  channel:"ALL", snapshot:null, retentionDraft:null, requestId:0,
  refreshing:false, error:"", lastFetchedAt:"",
};
export type ActivityViewAction =
  | {type:"channel";channel:ActivityChannelFilter}
  | {type:"retention";days:15|30}
  | {type:"start";id:number;channel:ActivityChannelFilter}
  | {type:"loaded";id:number;channel:ActivityChannelFilter;payload:ActivityPayload;at:string}
  | {type:"failed";id:number;channel:ActivityChannelFilter;message:string;accessDenied:boolean}
  | {type:"notice";message:string};
export function activityViewReducer(state:ActivityViewState,action:ActivityViewAction):ActivityViewState {
  if(action.type==="channel") return {...state,channel:action.channel,snapshot:null,error:"",lastFetchedAt:""};
  if(action.type==="retention") return {...state,retentionDraft:action.days};
  if(action.type==="notice") return {...state,error:action.message};
  if(action.channel!==state.channel) return state;
  if(action.type==="start") return action.id>state.requestId ? {...state,requestId:action.id,refreshing:true} : state;
  if(action.id!==state.requestId) return state;
  if(action.type==="failed") return {
    ...state,refreshing:false,error:action.message,
    ...(action.accessDenied ? {snapshot:null,retentionDraft:null,lastFetchedAt:""} : {}),
  };
  return {
    ...state,snapshot:action.payload,refreshing:false,error:"",lastFetchedAt:action.at,
    retentionDraft:state.retentionDraft===action.payload.policy.retentionDays ? null : state.retentionDraft,
  };
}
export function activityLabel(value:string) {
  const names:Record<string,string>={WHATSAPP:"WhatsApp",EMAIL:"Email",SOCIAL_AUTH:"Social Sign-In",HELD:"Held For Quality Assessment"};
  return names[value]||value.toLowerCase().replace(/[_.]+/g," ").replace(/\b[a-z]/g,(letter)=>letter.toUpperCase());
}
export function activityEvidenceNote(item:Pick<ActivityViewItem,"channel"|"status">) {
  if(item.channel==="SOCIAL_AUTH") return "";
  if(item.status==="PENDING") return "Submission Not Confirmed";
  if(["ACCEPTED","HELD","PAUSED","SENT","DEFERRED"].includes(item.status)) return "Delivery Not Confirmed";
  if(item.channel==="EMAIL"&&item.status==="DELIVERED") return "Accepted By Recipient Mail Server";
  return "";
}
