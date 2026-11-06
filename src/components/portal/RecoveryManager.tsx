"use client";

import React, {useEffect, useRef, useState} from "react";
import {Btn} from "./Common";
import styles from "./RecoveryManager.module.css";
import LoggedTimestamp from "./LoggedTimestamp";

const base="/api/portal/v7/farm-operations/daily-flock-report/recovery-manager";
type Hold={id:string;opened_by:string;opened_at:string;reason:string};
type Review={id:string;actor_id:string;evidence_id:string;outcome:string;note:string;recorded_at:string};
type Upload={object_key:string;evidence_id:string;state:string;created_at:string};
type Investigation={hold:Hold|null;reviews:Review[];earlierRequest:string};
type Uploads={items:Upload[];next:string|null};
type Reference={id:string;actor_id:string;object_key:string|null;reference:string;note:string;claimed_sha256:string|null;recorded_at:string};
type References={items:Reference[];next:string|null};

async function api(path:string,body?:unknown) {
 const response=await fetch(base+path,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",
  headers:{accept:"application/json",...(body===undefined?{}:{"content-type":"application/json"})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok) throw new Error("not-confirmed");
 return response.json();
}

function object(value:unknown): value is Record<string,unknown> {
 return typeof value==="object" && value!==null && !Array.isArray(value);
}
function investigation(value:unknown):Investigation {
 if(!object(value) || value.earlierRequest!=="unconfirmed" || !Array.isArray(value.reviews) ||
   !(value.hold===null || object(value.hold) && ["id","opened_by","opened_at","reason"].every(k=>typeof value.hold === "object" && value.hold!==null && typeof (value.hold as Record<string,unknown>)[k]==="string")) ||
   !value.reviews.every(r=>object(r) && ["id","actor_id","evidence_id","outcome","note","recorded_at"].every(k=>typeof r[k]==="string"))) throw new Error("invalid-investigation");
 return value as Investigation;
}
function uploadPage(value:unknown):Uploads {
 if(!object(value) || !Array.isArray(value.items) || !(value.next===null || typeof value.next==="string") ||
  !value.items.every(item=>object(item) && ["object_key","evidence_id","state","created_at"].every(k=>typeof item[k]==="string"))) throw new Error("invalid-uploads");
 return value as Uploads;
}

function referencePage(value:unknown):References {
 if(!object(value) || !Array.isArray(value.items) || !(value.next===null || typeof value.next==="string") ||
  !value.items.every(item=>object(item) && ["id","actor_id","reference","note","recorded_at"].every(k=>typeof item[k]==="string") && (item.object_key===null || typeof item.object_key==="string") && (item.claimed_sha256===null || typeof item.claimed_sha256==="string"))) throw new Error("invalid-references");
 return value as References;
}

/** Server authority is rechecked for each request; UI visibility grants no access. */
export default function RecoveryManager() {
 const [view,setView]=useState<Investigation|null>(null), [uploads,setUploads]=useState<Uploads|null>(null);
 const [references,setReferences]=useState<References|null>(null);
 const [externalRef,setExternalRef]=useState(""), [externalNote,setExternalNote]=useState(""), [externalObject,setExternalObject]=useState(""), [externalHash,setExternalHash]=useState("");
 const [busy,setBusy]=useState(false), [uncertain,setUncertain]=useState(false), [message,setMessage]=useState("");
 const [operationId,setOperationId]=useState("");
 const [reason,setReason]=useState(""), [evidence,setEvidence]=useState(""), [note,setNote]=useState("");
 const [reviewId,setReviewId]=useState(""), [fenceEvidence,setFenceEvidence]=useState(""), [attested,setAttested]=useState(false);
 const epoch=useRef(0);
 useEffect(()=>()=>{epoch.current++;},[]);
 async function refresh(after="") {
  const current=epoch.current; setBusy(true); setMessage("");
  try {
   const next=investigation(await api("/investigation"));
   const page=next.hold ? uploadPage(await api("/uploads?holdId="+encodeURIComponent(next.hold.id)+(after?"&after="+encodeURIComponent(after):""))) : null;
   const refs=next.hold ? referencePage(await api("/references?holdId="+encodeURIComponent(next.hold.id))) : null;
   if(current!==epoch.current)return;
   if(!next.hold || !after) setUploads(page);
   else setUploads(previous=>({items:[...(previous?.items||[]),...(page?.items||[])],next:page?.next||null}));
   setReferences(refs);setView(next);
   if(uncertain)setMessage("Check the durable hold and review records below. A missing record does not prove an unidentified request failed.");
  } catch {
   if(current!==epoch.current)return;
   setView(null);setUploads(null);setReferences(null);setMessage("Investigation unavailable. Sign in again or request the required scope; no outcome is confirmed.");
  } finally {if(current===epoch.current)setBusy(false);}
 }
 async function act(path:string,fields:Record<string,unknown>,success:string) {
  const current=epoch.current, id=crypto.randomUUID();setOperationId(id);setBusy(true);setMessage("");
  try {
   await api(path,{id,...fields});
   if(current!==epoch.current)return;
   setView(null);setUploads(null);setReferences(null);setMessage(success+" Refresh investigation to see durable records.");
  } catch {
   if(current!==epoch.current)return;
   setView(null);setUploads(null);setReferences(null);setUncertain(true);
   setMessage("The server outcome is not confirmed. Further changes are blocked in this view; refresh and investigate the durable records before reopening this workspace.");
  } finally {if(current===epoch.current)setBusy(false);}
 }
 async function moreReferences() {
  if(!view?.hold || !references?.next)return;
  const current=epoch.current;setBusy(true);
  try {
   const page=referencePage(await api("/references?holdId="+encodeURIComponent(view.hold.id)+"&after="+encodeURIComponent(references.next)));
   if(current===epoch.current)setReferences(previous=>({items:[...(previous?.items||[]),...page.items],next:page.next}));
  } catch {if(current===epoch.current){setView(null);setUploads(null);setReferences(null);setMessage("Reference list unavailable; refresh the investigation.");}}
  finally {if(current===epoch.current)setBusy(false);}
 }
 const blocked=busy||uncertain;
 return <details className={`panel mt ${styles.manager}`}>
  <summary><strong>Manager Recovery And Site Hold</strong></summary>
  <p>A hold blocks daily flock report and historical import writes across this site, including other departments. Use only when investigation is required.</p>
  <p>An earlier unidentified request remains unconfirmed. A timeout, an absent object or a manager decision does not prove that an upload stopped.</p>
  <Btn type="button" disabled={busy} onClick={()=>void refresh()}>Refresh Investigation</Btn>
  {message && <p role="status" aria-live="polite">{message}</p>}
  {uncertain && <p role="alert">An operation response was lost or rejected. Operation ID: {operationId}. Record this ID and reconcile it with an authorized administrator before taking another action. Reloading this page does not establish its outcome.</p>}
  {view && !view.hold && <form className="stack mt" onSubmit={event=>{event.preventDefault();void act("/hold",{reason},"Hold request confirmed.");}}>
   <p>No active hold was returned for this scope. This does not establish the outcome of an earlier unidentified request.</p>
   <label className="field"><span>Reason For Site Hold (Required)</span><textarea required maxLength={300} value={reason} onChange={event=>setReason(event.target.value)}/></label>
   <Btn type="submit" disabled={blocked||!reason.trim()}>Activate Site Hold</Btn>
  </form>}
  {view?.hold && <>
   <div className="mt"><strong>Active Site Hold</strong><p>Hold ID: {view.hold.id}<br/>Opened by: {view.hold.opened_by}<br/>Opened: <LoggedTimestamp value={view.hold.opened_at}/><br/>Reason: {view.hold.reason}</p></div>
   <h4>Unresolved Uploads</h4>
   {uploads?.items.length ? <ul>{uploads.items.map(item=><li key={item.object_key}>
    <p><strong>{item.state}</strong> · {item.object_key}<br/>Evidence ID: {item.evidence_id}<br/>Recorded: <LoggedTimestamp value={item.created_at}/></p>
    {item.state==="reserved" ? <p>Put completion is unknown. Keep the hold. Escalate the object key and intent to the storage and runtime owners; do not delete or retry cleanup until authoritative evidence proves all possible puts have stopped.</p> :
     (item.state==="uploaded"||item.state==="cleaning") && <Btn type="button" disabled={blocked} onClick={()=>void act("/cleanup",{holdId:view.hold!.id,objectKey:item.object_key},"Cleanup attempt returned.")}>Retry Eligible Cleanup</Btn>}
   </li>)}</ul> : <p>No unresolved uploads were returned on this page.</p>}
   {uploads?.next && <Btn type="button" disabled={busy} onClick={()=>void refresh(uploads.next || "")}>Load More Uploads</Btn>}
   <h4>External Evidence References</h4>
   <p>Record a case number or secure repository identifier for evidence held elsewhere. Do not paste passwords, tokens or private links. These references and any supplied checksum are unverified claims; they do not resolve an upload or qualify as release evidence.</p>
   {references?.items.length ? <ul>{references.items.map(item=><li key={item.id}>Reference ID: {item.id} · {item.reference} · {item.note}{item.object_key && <> · Object: {item.object_key}</>}{item.claimed_sha256 && <> · Claimed SHA-256: {item.claimed_sha256}</>} · Recorded: <LoggedTimestamp value={item.recorded_at}/></li>)}</ul> : <p>No external references were returned.</p>}
   {references?.next && <Btn type="button" disabled={busy} onClick={()=>void moreReferences()}>Load More References</Btn>}
   <form className="stack mt" onSubmit={event=>{event.preventDefault();void act("/reference",{holdId:view.hold!.id,objectKey:externalObject.trim()||null,reference:externalRef,note:externalNote,claimedSha256:externalHash.trim()||null},"External reference recorded as unverified.");}}>
    <label className="field"><span>Case Or Repository Reference (Required)</span><input required maxLength={240} value={externalRef} onChange={event=>setExternalRef(event.target.value)}/></label>
    <label className="field"><span>Investigation Note (Required)</span><textarea required maxLength={500} value={externalNote} onChange={event=>setExternalNote(event.target.value)}/></label>
    <label className="field"><span>Related Object Key (Optional)</span><input maxLength={45} value={externalObject} onChange={event=>setExternalObject(event.target.value)}/></label>
    <label className="field"><span>Claimed SHA-256 (Optional)</span><input pattern="[a-f0-9]{64}" maxLength={64} value={externalHash} onChange={event=>setExternalHash(event.target.value)}/></label>
    <Btn type="submit" disabled={blocked||!externalRef.trim()||!externalNote.trim()}>Record External Reference</Btn>
   </form>
   <h4>Evidence Reviews</h4>
   {view.reviews.length ? <ul>{view.reviews.map(review=><li key={review.id}>Review ID: {review.id} · {review.outcome} · Evidence: {review.evidence_id} · {review.note} · Recorded: <LoggedTimestamp value={review.recorded_at}/></li>)}</ul> : <p>No reviews were returned.</p>}
   <form className="stack mt" onSubmit={event=>{event.preventDefault();void act("/review",{holdId:view.hold!.id,evidenceId:evidence,outcome:"evidence-reviewed",note},"Evidence review recorded.");}}>
    <label className="field"><span>Existing Evidence ID (Required)</span><input required maxLength={160} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label>
    <label className="field"><span>Review Findings (Required)</span><textarea required maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/></label>
    <Btn type="submit" disabled={blocked||!evidence.trim()||!note.trim()}>Record Evidence Review</Btn>
   </form>
   <form className="stack mt" onSubmit={event=>{event.preventDefault();void act("/release",{holdId:view.hold!.id,reviewId,fenceEvidenceId:fenceEvidence,confirmedFencedAndDrained:attested},"Release request confirmed.");}}>
    <h4>Request Hold Release</h4>
    <p>A different authorized manager must release. All unresolved uploads must be resolved. Evidence must establish that old Workers, jobs and in-flight requests are fenced and drained; this checkbox alone is not proof.</p>
    <label className="field"><span>Completed Review ID (Required)</span><input required value={reviewId} onChange={event=>setReviewId(event.target.value)}/></label>
    <label className="field"><span>Fence Evidence ID (Required)</span><input required maxLength={160} value={fenceEvidence} onChange={event=>setFenceEvidence(event.target.value)}/></label>
    <label className="row"><input type="checkbox" required checked={attested} onChange={event=>setAttested(event.target.checked)}/><span>I have reviewed authoritative evidence that writers are fenced and drained.</span></label>
    <Btn type="submit" disabled={blocked||!reviewId.trim()||!fenceEvidence.trim()||!attested}>Release Site Hold</Btn>
   </form>
  </>}
 </details>;
}
