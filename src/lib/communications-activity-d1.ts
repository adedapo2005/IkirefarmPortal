import {
  activityEventKey, activityRecipientKey, canAdvanceStatus, maskedDestination,
  retentionDays, safeActivityCode, validActivityStatus, validChannelActivityStatus,
  type ActivityChannel, type ActivityStatus,
} from "./communications-activity-core.ts";

type ActivityItem = {
  id:string; channel:ActivityChannel; purpose:string; status:ActivityStatus;
  actor_id:string|null; recipient_masked:string|null; recipient_key:string|null; provider_ref:string|null;
  error_code:string|null; created_at:string; updated_at:string; expires_at:string;
};
const ALLOWED_PURPOSE = /^[a-z][a-z0-9_.-]{1,63}$/;
const VISIBLE = "expires_at > ? AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', ?, '-' || " +
  "(SELECT retention_days FROM farmportal_activity_settings WHERE id = 'farmportal') || ' days')";
function canonicalTime(value:string) {
  const time=Date.parse(value);
  if(!Number.isFinite(time))throw new Error("ACTIVITY_TIMESTAMP_INVALID");
  return new Date(time).toISOString();
}
function checkedReference(value:string|null|undefined) {
  if(!value)return null;
  if(value.length<8||value.length>240||!/^[A-Za-z0-9._:=+/-]+$/.test(value))throw new Error("ACTIVITY_PROVIDER_REFERENCE_INVALID");
  return value;
}
export function validActivityPurpose(value: unknown) {
  return typeof value === "string" && ALLOWED_PURPOSE.test(value);
}
export async function getActivityPolicy(db:D1Database) {
  const row=await db.prepare("SELECT retention_days, revision, updated_at FROM farmportal_activity_settings WHERE id = 'farmportal'").first<{retention_days:number;revision:number;updated_at:string}>();
  if (!row || (row.retention_days!==15 && row.retention_days!==30)) throw new Error("ACTIVITY_MIGRATION_REQUIRED");
  return { retentionDays:retentionDays(row.retention_days), revision:row.revision, updatedAt:row.updated_at };
}
export async function createActivity(db:D1Database, input:{
  channel:ActivityChannel; purpose:string; status?:ActivityStatus;
  actorId?:string|null; recipient?:string; providerRef?:string|null;
  createdAt?:string; errorCode?:string|null;
}) {
  if (!["WHATSAPP","EMAIL","SOCIAL_AUTH"].includes(input.channel) || !validActivityPurpose(input.purpose)) throw new Error("ACTIVITY_INPUT_INVALID");
  const status=input.status||(input.channel==="SOCIAL_AUTH"?"STARTED":"PENDING");
  if (!validChannelActivityStatus(input.channel,status)) throw new Error("ACTIVITY_STATUS_INVALID");
  const time=canonicalTime(input.createdAt||new Date().toISOString());
  // This read only validates availability. Expiry is derived from settings
  // inside the INSERT transaction, so a concurrent policy edit cannot be lost.
  await getActivityPolicy(db);
  const id=crypto.randomUUID();
  const code=safeActivityCode(input.errorCode);
  const recipient=input.recipient ? maskedDestination(input.recipient) : null;
  const ref=checkedReference(input.providerRef);
  const recipientKey=input.channel==="EMAIL" && input.recipient && ref
    ? await activityRecipientKey(ref,input.recipient) : null;
  const result=await db.batch([
    db.prepare("INSERT OR IGNORE INTO farmportal_activity_items (id,channel,purpose,status,actor_id,recipient_masked,recipient_key,provider_ref,error_code,created_at,updated_at,expires_at) " +
      "SELECT ?,?,?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+' || retention_days || ' days') " +
      "FROM farmportal_activity_settings WHERE id = 'farmportal'")
      .bind(id,input.channel,input.purpose,status,input.actorId||null,recipient,recipientKey,ref,code,time,time,time),
    db.prepare("INSERT INTO farmportal_activity_events(id,activity_id,event_key,status,error_code,occurred_at,recorded_at) " +
      "SELECT ?,id,?,?,?,?,? FROM farmportal_activity_items WHERE id = ?")
      .bind(crypto.randomUUID(),"created:"+id,status,code,time,time,id),
  ]);
  if (!result.every(row=>row.success)) throw new Error("ACTIVITY_CREATE_FAILED");
  if(Number(result[0]?.meta?.changes||0)===1 && Number(result[1]?.meta?.changes||0)===1)return id;
  // Exact provider/recipient retries preserve the original activity and must
  // never downgrade a completed message or manufacture another initial event.
  if(ref){
    const existing=await db.prepare("SELECT id FROM farmportal_activity_items WHERE channel = ? AND provider_ref = ? AND recipient_key IS ? LIMIT 1")
      .bind(input.channel,ref,recipientKey).first<{id:string}>();
    if(existing)return existing.id;
  }
  throw new Error("ACTIVITY_CREATE_FAILED");
}
export async function recordActivityTransition(db:D1Database,input:{
  activityId?:string; providerRef?:string; channel:ActivityChannel; recipient?:string;
  status:ActivityStatus; occurredAt?:string; errorCode?:string|null;
}) {
  if (!validChannelActivityStatus(input.channel,input.status)) throw new Error("ACTIVITY_STATUS_INVALID");
  const time=canonicalTime(input.occurredAt||new Date().toISOString());
  const suppliedRef=checkedReference(input.providerRef);
  if(input.recipient!==undefined && input.channel!=="EMAIL")throw new Error("ACTIVITY_RECIPIENT_CHANNEL_INVALID");
  const suppliedKey=input.recipient!==undefined && suppliedRef
    ? await activityRecipientKey(suppliedRef,input.recipient) : null;
  const lookup=async()=>{
    const now=new Date().toISOString();
    if(input.activityId)return db.prepare("SELECT * FROM farmportal_activity_items WHERE id = ? AND channel = ? AND "+VISIBLE)
      .bind(input.activityId,input.channel,now,now).first<ActivityItem>();
    if(!suppliedRef)return null;
    if(input.channel==="EMAIL" && input.recipient!==undefined){
      // An unkeyed historical row may represent several recipients. Never
      // guess that one recipient's receipt applies to the whole message.
      return db.prepare("SELECT * FROM farmportal_activity_items WHERE channel = 'EMAIL' AND provider_ref = ? AND recipient_key = ? AND "+VISIBLE)
        .bind(suppliedRef,suppliedKey,now,now).first<ActivityItem>();
    }
    const rows=await db.prepare("SELECT * FROM farmportal_activity_items WHERE channel = ? AND provider_ref = ? AND "+VISIBLE+" LIMIT 2")
      .bind(input.channel,suppliedRef,now,now).all<ActivityItem>();
    if(!rows.success)throw new Error("ACTIVITY_LOOKUP_FAILED");
    return rows.results?.length===1?rows.results[0]:null;
  };
  let eventInserted=false;
  for(let attempts=0;attempts<6;attempts++){
    const row=await lookup();
    if(!row)return{matched:false,updated:false,duplicate:false};
    const ref=suppliedRef||row.provider_ref;
    if(suppliedRef && row.provider_ref && suppliedRef!==row.provider_ref)throw new Error("ACTIVITY_PROVIDER_ID_MISMATCH");
    const recipientKey=input.channel==="EMAIL" && input.recipient!==undefined && ref
      ? await activityRecipientKey(ref,input.recipient) : row.recipient_key;
    if(row.recipient_key && recipientKey!==row.recipient_key)throw new Error("ACTIVITY_RECIPIENT_MISMATCH");
    const eventKey=row.id+":"+(ref?activityEventKey(ref,input.status,time):"local:"+input.status+":"+time);
    const code=safeActivityCode(input.errorCode);
    const advance=canAdvanceStatus(input.channel,row.status,input.status,row.updated_at,time);
    const diagnostic=row.status===input.status && code!==null && code!==row.error_code && time>=row.updated_at;
    // A distinct newer observation of the same stage still advances its
    // ordering watermark; exact provider retries retain the same timestamp.
    const ordering=row.status===input.status && ["SENT","FAILED"].includes(row.status) && time>row.updated_at;
    const correlate=ref!==row.provider_ref || recipientKey!==row.recipient_key;
    const write=advance||diagnostic||ordering||correlate;
    const now=new Date().toISOString();
    const statements:D1PreparedStatement[]=[];
    if(write)statements.push(db.prepare(
      "UPDATE farmportal_activity_items SET status = ?, provider_ref = ?, recipient_key = ?, error_code = ?, updated_at = ? " +
      "WHERE id = ? AND channel = ? AND status = ? AND updated_at = ? AND provider_ref IS ? AND recipient_key IS ? AND error_code IS ? AND "+VISIBLE,
    ).bind(advance?input.status:row.status,ref,recipientKey,advance||diagnostic?code:row.error_code,
      advance||diagnostic||ordering?time:row.updated_at,row.id,input.channel,row.status,row.updated_at,row.provider_ref,row.recipient_key,row.error_code,now,now));
    statements.push(db.prepare(
      "INSERT OR IGNORE INTO farmportal_activity_events (id,activity_id,event_key,status,error_code,occurred_at,recorded_at) " +
      "SELECT ?,id,?,?,?,?,? FROM farmportal_activity_items WHERE id = ? AND channel = ? AND provider_ref IS ? AND recipient_key IS ? AND "+VISIBLE,
    ).bind(crypto.randomUUID(),eventKey,input.status,code,time,now,row.id,input.channel,ref,recipientKey,now,now));
    // Status CAS and its event are one transaction. A competing provider ID
    // cannot append a receipt to this activity after losing correlation.
    const results=await db.batch(statements);
    if(!results.every(result=>result.success))throw new Error("ACTIVITY_TRANSITION_FAILED");
    const added=Number(results[results.length-1]?.meta?.changes||0)===1;
    eventInserted=eventInserted||added;
    const eventExists=added || Boolean(await db.prepare("SELECT id FROM farmportal_activity_events WHERE activity_id = ? AND event_key = ?")
      .bind(row.id,eventKey).first<{id:string}>());
    if(!eventExists)continue;
    if(!write)return{matched:true,updated:false,duplicate:!eventInserted};
    if(Number(results[0]?.meta?.changes||0)===1)return{matched:true,updated:true,duplicate:!eventInserted};
    // Re-read after a lost CAS; replay can repair an interrupted observation
    // without duplicating timeline entries or reversing a newer provider state.
  }
  throw new Error("ACTIVITY_STATUS_CAS_RETRY_EXHAUSTED");
}
export async function listActivity(db:D1Database,channel:ActivityChannel|"ALL"="ALL",limit=80) {
  const policy=await getActivityPolicy(db);
  // The effective cutoff reflects the current policy immediately after a 30-to-15 change.
  const visibleAfter=new Date(Date.now()-policy.retentionDays*86_400_000).toISOString();
  const max=Math.min(100,Math.max(1,Number.isInteger(limit)?limit:80));
  const stmt=db.prepare("SELECT id,channel,purpose,status,recipient_masked,error_code,created_at,updated_at, CASE WHEN provider_ref IS NULL THEN 0 ELSE 1 END AS provider_accepted FROM farmportal_activity_items WHERE expires_at > ? AND created_at >= ? AND (? = 'ALL' OR channel = ?) ORDER BY created_at DESC LIMIT ?");
  const rows=await stmt.bind(new Date().toISOString(),visibleAfter,channel,channel,max).all<Record<string,unknown>>();
  const items=[...(rows.results||[])];
  // Existing FarmPortal registration outbox is authoritative for Pending /
  // Sending states, even when a provider has not yet accepted the email.
  // Read-only augmentation: do not alter the outbox or expose its addresses.
  if(channel==="ALL"||channel==="EMAIL"){
    const outboxAvailable=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'portal_registration_notification_outbox'",
    ).first<{name:string}>();
    if(outboxAvailable){
      const notices=await db.prepare(
        "SELECT 'notice:' || n.id AS id, 'EMAIL' AS channel, 'notice_' || n.event_type AS purpose, " +
        "CASE n.delivery_state WHEN 'sent' THEN 'ACCEPTED' WHEN 'sending' THEN 'PENDING' " +
        "WHEN 'failed' THEN 'FAILED' WHEN 'cancelled' THEN 'CANCELLED' ELSE 'PENDING' END AS status, " +
        "NULL AS recipient_masked, n.last_error_code AS error_code, n.created_at, n.updated_at, " +
        "CASE WHEN n.provider_reference IS NULL THEN 0 ELSE 1 END AS provider_accepted " +
        "FROM portal_registration_notification_outbox n WHERE n.created_at >= ? AND " +
        "(n.provider_reference IS NULL OR NOT EXISTS " +
        "(SELECT 1 FROM farmportal_activity_items a WHERE a.channel = 'EMAIL' AND a.provider_ref = n.provider_reference)) " +
        "ORDER BY n.created_at DESC LIMIT ?",
      ).bind(visibleAfter,max).all<Record<string,unknown>>();
      items.push(...(notices.results||[]).map((row)=>({...row,error_code:safeActivityCode(row.error_code)})));
    }
  }
  // Legacy Meta success audits predate the new activity ledger. Display only
  // what the audit actually proved: Meta ACCEPTED, never Sent/Delivered/Read.
  // Do not backfill raw message IDs or mutate protected historical audits.
  if(channel==="ALL"||channel==="WHATSAPP"){
    const auditsAvailable=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='integration_audit_events'",
    ).first<{name:string}>();
    if(auditsAvailable){
      const audits=await db.prepare(
        "SELECT 'legacy-wa:' || e.id AS id, 'WHATSAPP' AS channel, " +
        "'test_message_legacy' AS purpose, 'ACCEPTED' AS status, " +
        "CASE WHEN json_valid(e.safe_metadata_json) THEN " +
        "json_extract(e.safe_metadata_json,'$.recipientMasked') ELSE NULL END AS recipient_masked, " +
        "NULL AS error_code, e.created_at, e.created_at AS updated_at, 1 AS provider_accepted " +
        "FROM integration_audit_events e WHERE e.connection_id = 'meta-daenem-farms-organization' " +
        "AND e.organization_id = 'daenem-farms' AND e.event_type = 'whatsapp.test_message' " +
        "AND e.outcome = 'SUCCESS' AND e.created_at >= ? AND json_valid(e.safe_metadata_json) = 1 " +
        "AND NOT EXISTS(SELECT 1 FROM farmportal_activity_items a WHERE a.channel='WHATSAPP' " +
        "AND a.provider_ref = json_extract(e.safe_metadata_json,'$.providerMessageId')) " +
        "ORDER BY e.created_at DESC LIMIT ?",
      ).bind(visibleAfter,max).all<Record<string,unknown>>();
      items.push(...(audits.results||[]).map((row)=>{
        const tail=String(row.recipient_masked||"").match(/([0-9]{4})$/)?.[1]||null;
        return {...row,recipient_masked:tail?"***"+tail:"[REDACTED]"};
      }));
    }
  }
  items.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const visible=items.slice(0,max);
  const ids=visible.filter((item)=>!String(item.id).startsWith("notice:") &&
    !String(item.id).startsWith("legacy-wa:")).map((item)=>String(item.id));
  // One indexed, bounded read for Owner-visible provider status history.
  // Nothing in this response includes the private provider reference,
  // phone number, auth code, email subject, or event payload.
  const timelines=new Map<string,Array<{status:string;occurredAt:string;errorCode:string|null}>>();
  if(ids.length){
    const placeholders=ids.map(()=>"?").join(",");
    const history=await db.prepare(
      "SELECT activity_id,status,error_code,occurred_at FROM farmportal_activity_events " +
      "WHERE activity_id IN (" + placeholders + ") ORDER BY occurred_at DESC LIMIT 800",
    ).bind(...ids).all<{activity_id:string;status:string;error_code:string|null;occurred_at:string}>();
    for(const event of history.results||[]){
      if(!validActivityStatus(event.status))continue;
      const list=timelines.get(event.activity_id)||[];
      if(list.length<12){
        list.push({status:event.status,occurredAt:event.occurred_at,
          errorCode:safeActivityCode(event.error_code)});
        timelines.set(event.activity_id,list);
      }
    }
  }
  return {policy,items:visible.map((item)=>({
    ...item,timeline:String(item.id).startsWith("legacy-wa:")
      ? [{status:"ACCEPTED",occurredAt:String(item.created_at),errorCode:null}]
      : timelines.get(String(item.id))||[],
  })),fetchedAt:new Date().toISOString()};
}
export async function setActivityRetention(db:D1Database,days:15|30,revision:number,actorId:string) {
  const validated=retentionDays(days);
  if (!Number.isInteger(revision) || revision<1 || !actorId || actorId.length>160) throw new Error("ACTIVITY_SETTINGS_INVALID");
  const now=new Date().toISOString();
  const current=await getActivityPolicy(db);
  if (current.revision!==revision) throw new Error("ACTIVITY_REVISION_CONFLICT");
  // D1 batch is transactional: both revision and historic expiry change
  // together or neither changes. Concurrent stale writers cannot modify expiry
  // for a different revision or retention value.
  const changes=await db.batch([
    db.prepare("UPDATE farmportal_activity_settings SET retention_days = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = 'farmportal' AND revision = ?")
      .bind(validated,actorId,now,revision),
    db.prepare("UPDATE farmportal_activity_items SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+' || ? || ' days') " +
      "WHERE EXISTS(SELECT 1 FROM farmportal_activity_settings WHERE id = 'farmportal' AND revision = ? AND retention_days = ?)")
      .bind(validated,revision+1,validated),
  ]);
  if (Number(changes[0]?.meta?.changes||0)!==1) throw new Error("ACTIVITY_REVISION_CONFLICT");
  return getActivityPolicy(db);
}
export async function pruneExpiredActivity(db:D1Database,limit=250,now=new Date()) {
  if (!Number.isInteger(limit)||limit<1||limit>500) throw new Error("PRUNE_LIMIT_INVALID");
  await getActivityPolicy(db);
  const at=now.toISOString();
  // Both statements select the same bounded, deterministically ordered set
  // inside one transaction using the CURRENT retention setting. A concurrent
  // extension cannot leave item deletion using an old cutoff or erase only
  // its history. Explicit child cleanup also supports bindings with FK off.
  const stale="SELECT id FROM farmportal_activity_items WHERE expires_at <= ? OR " +
    "created_at < strftime('%Y-%m-%dT%H:%M:%fZ', ?, '-' || " +
    "(SELECT retention_days FROM farmportal_activity_settings WHERE id = 'farmportal') || ' days') " +
    "ORDER BY created_at,id LIMIT ?";
  const results=await db.batch([
    db.prepare("DELETE FROM farmportal_activity_events WHERE activity_id IN ("+stale+")").bind(at,at,limit),
    db.prepare("DELETE FROM farmportal_activity_items WHERE id IN ("+stale+")").bind(at,at,limit),
  ]);
  if(!results.every(result=>result.success))throw new Error("ACTIVITY_PRUNE_FAILED");
  const count=Number(results[1]?.meta?.changes||0);
  const policy=await getActivityPolicy(db);
  return {deleted:count,hasMore:count===limit,retentionDays:policy.retentionDays};
}
