"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Activity, Clock3, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  activityEvidenceNote, activityLabel, activityViewReducer, initialActivityView,
  type ActivityChannelFilter, type ActivityPayload,
} from "@/lib/communications-activity-view";
import LoggedTimestamp from "./LoggedTimestamp";
import styles from "./communications-activity-panel.module.css";
const ENDPOINT="/api/admin/communications-activity";
const statusColor=(state:string) => ["DELIVERED","READ","SUCCEEDED"].includes(state) ? "success" : ["FAILED","BOUNCED","REJECTED","COMPLAINED","CANCELLED","EXPIRED"].includes(state) ? "failure" : "pending";
export default function CommunicationsActivityPanel(){
  const [view,dispatch]=useReducer(activityViewReducer,initialActivityView);
  const [busy,setBusy]=useState(false);
  const nextRequest=useRef(0);
  const pendingRequest=useRef<AbortController|null>(null);
  const {channel,snapshot,error,refreshing,lastFetchedAt}=view;
  const days=view.retentionDraft??snapshot?.policy.retentionDays??30;
  const load=useCallback(async()=>{
    const id=++nextRequest.current;
    pendingRequest.current?.abort();
    const controller=new AbortController();
    pendingRequest.current=controller;
    dispatch({type:"start",id,channel});
    try {
      const response=await fetch(ENDPOINT+"?channel="+channel+"&limit=80",{
        credentials:"include",cache:"no-store",signal:controller.signal,
      });
      if(!response.ok){
        const accessDenied=[401,403,404].includes(response.status);
        dispatch({type:"failed",id,channel,accessDenied,message:accessDenied
          ?"Owner Access Is No Longer Available"
          :"Activity Refresh Is Temporarily Unavailable"});
        return;
      }
      const body=await response.json() as ActivityPayload;
      if(!body?.policy||![15,30].includes(body.policy.retentionDays)||!Number.isInteger(body.policy.revision)||!Array.isArray(body.items)) {
        throw new Error("Activity Response Was Incomplete");
      }
      dispatch({type:"loaded",id,channel,payload:body,at:new Date().toISOString()});
    }catch(e){
      if(controller.signal.aborted)return;
      dispatch({type:"failed",id,channel,accessDenied:false,
        message:e instanceof Error?e.message:"Activity Refresh Failed"});
    }
  },[channel]);
  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>{if(!document.hidden)void load();},10_000);
    return()=>{window.clearInterval(timer);pendingRequest.current?.abort();};
  },[load]);
  async function updatePolicy(){
    if(!snapshot||busy||days===snapshot.policy.retentionDays)return;
    if(!window.confirm("Change FarmPortal Activity Log Retention To "+days+" Days? Older Activity Will Be Hidden And Eligible For Cleanup."))return;
    setBusy(true);
    try{
      const response=await fetch(ENDPOINT,{method:"PUT",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({days,revision:snapshot.policy.revision,confirm:"SET_RETENTION"})});
      if([401,403,404].includes(response.status)){await load();return;}
      if(!response.ok)throw new Error(response.status===409
        ?"Retention Changed In Another Session. Refresh And Review Your Selection."
        :"Retention Change Was Not Applied");
      await load();
    }catch(e){dispatch({type:"notice",message:e instanceof Error?e.message:"Retention Update Failed"});}
    finally{setBusy(false);}
  }
  async function prune(){
    if(busy||!snapshot)return;
    if(!window.confirm("Permanently Delete Activity Entries Outside The "+snapshot.policy.retentionDays+"-Day Retention Window?"))return;
    setBusy(true);
    try{
      const response=await fetch(ENDPOINT,{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({confirm:"PRUNE_EXPIRED"})});
      if([401,403,404].includes(response.status)){await load();return;}
      if(!response.ok)throw new Error("Retention Cleanup Not Completed");
      await load();
    }catch(e){dispatch({type:"notice",message:e instanceof Error?e.message:"Retention Cleanup Failed"});}
    finally{setBusy(false);}
  }
  const items=snapshot?.items||[];
  const pending=items.filter((x)=>["PENDING","STARTED","ACCEPTED","HELD","PAUSED","DEFERRED","SENT"].includes(x.status)).length;
  const delivered=items.filter((x)=>["DELIVERED","READ","SUCCEEDED"].includes(x.status)).length;
  const failures=items.filter((x)=>["FAILED","BOUNCED","REJECTED","COMPLAINED","CANCELLED","EXPIRED"].includes(x.status)).length;
  return <section className={styles.panel} data-testid="communications-activity-panel" aria-label="Communications And Authentication Activity" aria-busy={refreshing}>
    <header className={styles.head}>
      <div><span className={styles.eyebrow}>Admin Center · Communications Monitoring</span><h2>Communications & Authentication Activity</h2>
        <p>WhatsApp, Email, And Google/Microsoft Sign-In Activity. Refreshes Every 10 Seconds While This Page Is Visible.</p></div>
      <button className={styles.refresh} type="button" disabled={refreshing} onClick={()=>void load()}><RefreshCw size={17}/> {refreshing?"Refreshing":"Refresh Now"}</button>
    </header>
    <div className={styles.metrics}>
      <div><span>Visible Activities</span><strong>{snapshot?items.length:"—"}</strong></div>
      <div><span>Awaiting Final Outcome</span><strong>{snapshot?pending:"—"}</strong></div>
      <div><span>Delivered / Read / Signed In</span><strong>{snapshot?delivered:"—"}</strong></div>
      <div><span>Needs Attention</span><strong>{snapshot?failures:"—"}</strong></div>
    </div>
    <div className={styles.controls}>
      <label>Channel
        <select value={channel} onChange={(e)=>dispatch({type:"channel",channel:e.target.value as ActivityChannelFilter})}>
          <option value="ALL">All Channels</option><option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">Cloudflare Email</option><option value="SOCIAL_AUTH">Google & Microsoft Sign-In</option>
        </select>
      </label>
      <label>Log Retention
        <select value={days} onChange={(e)=>dispatch({type:"retention",days:Number(e.target.value) as 15|30})} disabled={!snapshot||busy}>
          <option value={15}>15 Days</option><option value={30}>30 Days</option>
        </select>
      </label>
      <button type="button" onClick={()=>void updatePolicy()} disabled={!snapshot||busy||days===snapshot.policy.retentionDays}>Save Retention</button>
      <button type="button" onClick={()=>void prune()} disabled={!snapshot||busy}>Purge Expired</button>
    </div>
    <div className={styles.security}><ShieldCheck size={18}/><p>Owner-Only · Recipient Details Masked. Acceptance Confirms Submission For Processing. Delivery Requires A Provider Receipt. Email Open And Social Sign-In Read States Are Not Tracked.</p></div>
    {error&&<div role="alert" className={styles.error}><TriangleAlert size={18}/>{error}{snapshot?". Previously Loaded Activity Is Shown.":"."}</div>}
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Time</th><th>Channel</th><th>Activity</th><th>Recipient</th><th>Recorded Status</th><th>Diagnostic Code</th></tr></thead>
        <tbody>
        {items.map((item)=><tr key={item.id}>
          <td><LoggedTimestamp value={item.updated_at}/></td>
          <td>{activityLabel(item.channel)}</td>
          <td>{activityLabel(item.purpose)}</td>
          <td>{item.recipient_masked||"Not Applicable"}</td>
          <td>
            <span className={styles[statusColor(item.status)]}>{activityLabel(item.status)}</span>
            {activityEvidenceNote(item)&&<span className={styles.evidence}>{activityEvidenceNote(item)}</span>}
            {item.timeline?.length>0&&<details className={styles.timeline}>
              <summary>Event History ({item.timeline.length})</summary>
              <ol>{item.timeline.map((event,index)=><li key={event.occurredAt+"-"+event.status+"-"+index}>
                <strong>{activityLabel(event.status)}</strong>
                <LoggedTimestamp value={event.occurredAt}/>
                {event.errorCode&&<span>{event.errorCode}</span>}
              </li>)}</ol>
            </details>}
          </td>
          <td>{item.error_code||"—"}</td>
        </tr>)}
        {!items.length&&<tr><td colSpan={6} className={styles.empty}>{snapshot
          ?"No Tracked Activity For This Channel And Retention Window."
          :error?"Activity Is Unavailable. Refresh After Owner Access And Service Availability Are Restored.":"Loading Activity…"}</td></tr>}
        </tbody>
      </table>
    </div>
    <footer className={styles.foot}><Clock3 size={15}/> {lastFetchedAt?<>Last Refreshed <LoggedTimestamp value={lastFetchedAt}/></>:"Awaiting Secure Data"} · <Activity size={15}/> Delivery Receipts May Arrive Later. Each Email Recipient Is Tracked Separately.</footer>
  </section>;
}
