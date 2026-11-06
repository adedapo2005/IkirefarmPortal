import { normalizeWhatsAppStatus, normalizeCloudflareEmailEvent, safeActivityCode, type ActivityStatus } from "./communications-activity-core.ts";
export type MetaWhatsAppStatus = { wabaId:string; phoneId:string; messageId:string; status:ActivityStatus; occurredAt:string; errorCode:string|null };
const object=(x:unknown):Record<string,unknown>|null=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;
const text=(x:unknown,max=240)=>typeof x==="string"&&x.length<=max?x:"";
export function decodeSignedMetaStatusPayload(raw:unknown):MetaWhatsAppStatus[] {
  const payload=object(raw);
  if(!payload||payload.object!=="whatsapp_business_account")throw new Error("META_STATUS_PAYLOAD_INVALID");
  if(!Array.isArray(payload.entry)||payload.entry.length<1||payload.entry.length>5)throw new Error("META_STATUS_ENTRY_INVALID");
  const updates:MetaWhatsAppStatus[]=[];
  for(const entryValue of payload.entry){
    const entry=object(entryValue);if(!entry)throw new Error("META_STATUS_ENTRY_INVALID");
    const wabaId=text(entry.id,80);
    if(!/^[0-9]{5,32}$/.test(wabaId))throw new Error("META_STATUS_WABA_INVALID");
    const changes=entry.changes;
    if(!Array.isArray(changes)||changes.length>10)throw new Error("META_STATUS_CHANGES_INVALID");
    for(const changeValue of changes){
      const change=object(changeValue);
      if(!change||change.field!=="messages")throw new Error("META_STATUS_FIELD_NOT_SUPPORTED");
      const value=object(change.value);
      if(!value||value.messages!==undefined)throw new Error("META_INBOUND_ROUTER_NOT_ACTIVATED");
      const meta=object(value.metadata);
      const phoneId=text(meta?.phone_number_id,80);
      if(!/^[0-9]{5,32}$/.test(phoneId))throw new Error("META_STATUS_PHONE_INVALID");
      if(!Array.isArray(value.statuses)||value.statuses.length<1||value.statuses.length>30)throw new Error("META_STATUS_UPDATES_INVALID");
      for(const rawStatus of value.statuses){
        const record=object(rawStatus);
        if(!record)throw new Error("META_STATUS_EVENT_INVALID");
        const status=normalizeWhatsAppStatus(record.status);
        const messageId=text(record.id,240);
        const seconds=Number(record.timestamp);
        if(!status||messageId.length<8||!/^[\w.=:/:+-]+$/.test(messageId)||!Number.isSafeInteger(seconds)||seconds<1_600_000_000||seconds>Math.floor(Date.now()/1000)+600)throw new Error("META_STATUS_EVENT_INVALID");
        const error=Array.isArray(record.errors)?object(record.errors[0]):null;
        const errNum=error?.code;
        updates.push({wabaId,phoneId,messageId,status,occurredAt:new Date(seconds*1000).toISOString(),errorCode:typeof errNum==="number"&&Number.isSafeInteger(errNum)?"META_"+errNum:null});
      }
    }
  }
  if(!updates.length||updates.length>60)throw new Error("META_STATUS_EMPTY_OR_EXCESSIVE");
  return updates;
}
export type CloudflareEmailStatus = { eventId:string; messageId:string; recipient:string; channel:"EMAIL";status:ActivityStatus;occurredAt:string; errorCode:string|null };
export function decodeCloudflareEmailEvent(raw:unknown,allowedDomain:string,allowedAccountId?:string):CloudflareEmailStatus {
  const ev=object(raw);
  const source=object(ev?.source),payload=object(ev?.payload),meta=object(ev?.metadata);
  if(!ev||!source||!payload||!meta||source.type!=="email.sending"||String(source.domain||"").toLowerCase()!==allowedDomain.toLowerCase())throw new Error("EMAIL_SOURCE_SCOPE_INVALID");
  // Official Email Sending schema v1 identifies the publishing account in
  // metadata.accountId. A configured account is an additional scope boundary;
  // exact FarmPortal provider ID + private recipient key remain mandatory.
  const accountId=text(meta.accountId,32).toLowerCase();
  if(meta.eventSchemaVersion!==1||!/^[a-f0-9]{32}$/.test(accountId)||
    (allowedAccountId&&accountId!==allowedAccountId.toLowerCase()))throw new Error("EMAIL_ACCOUNT_SCOPE_INVALID");
  const status=normalizeCloudflareEmailEvent(ev.type);
  const eventId=text(payload.eventId,120),messageId=text(payload.messageId,240);
  const recipient=text(payload.recipient,254).trim().toLowerCase();
  const timestamp=Date.parse(text(meta.eventTimestamp,64));
  if(!status||!eventId||!messageId||!/^[-\w.=:/:+]+$/.test(messageId)||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)||!Number.isFinite(timestamp)||
    timestamp<1_600_000_000_000||timestamp>Date.now()+600_000)throw new Error("EMAIL_LIFECYCLE_INVALID");
  const failure=object(payload.failure),bounce=object(payload.bounce);
  const rejection=object(payload.rejection),complaint=object(payload.complaint);
  // Keep only provider code fields, never SMTP responses or other payload text.
  const code=failure?.reason??bounce?.classification??rejection?.reason??complaint?.type;
  return {eventId,messageId,recipient,channel:"EMAIL",status,occurredAt:new Date(timestamp).toISOString(),errorCode:safeActivityCode(code)};
}
