"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2, CornerUpLeft, Search, ShieldCheck, Sparkles } from "lucide-react";
import { proposeAuthorizedPrefill, type GuidedProposal } from "@/lib/farm-guided-entry";
import {
  canReuseOpeningEvidence, OPENING_REUSE_MAPPINGS,
  parseOpeningEvidenceChoices, type OpeningEvidenceChoice,
} from "@/lib/inventory-opening-suggestions";
import styles from "./OpeningStockReusePicker.module.css";

type SearchState="idle"|"loading"|"available"|"no-data"|"sign-in"|"restricted"|"unavailable";
type Draft=Readonly<{itemCode:string;locationKey:string;unit:string}>;
const stateLabel:Record<OpeningEvidenceChoice["state"],string>={
  draft:"Draft Evidence",submitted:"Waiting For Approval",
  approved:"Approved Baseline Exists",cancelled:"Cancelled Evidence",
};
const names:Readonly<Record<string,string>>={
  itemCode:"Item Code",locationKey:"Store / Location",unit:"Unit",
};

/**
 * The back end already scopes search to authenticated company/site/permissions.
 * The picker never writes or infers stock on hand. A server-verification gate
 * still applies to the eventual opening-count save / approval operation.
 */
export default function OpeningStockReusePicker({
  draft,onApply,onUndo,canUndo,
}:{
  draft:Draft;
  onApply:(proposal:GuidedProposal)=>void;
  onUndo:()=>void;
  canUndo:boolean;
}){
  const listId=useId();
  const [query,setQuery]=useState("");
  const [state,setState]=useState<SearchState>("idle");
  const [choices,setChoices]=useState<readonly OpeningEvidenceChoice[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [selected,setSelected]=useState<OpeningEvidenceChoice|null>(null);
  const normalized=query.trim().slice(0,100);
  const proposal=useMemo(()=>proposeAuthorizedPrefill(
    selected,draft,OPENING_REUSE_MAPPINGS,()=>true,
  ),[selected,draft]);

  useEffect(()=>{
    if(normalized.length<2) return;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      setState("loading");
      const params=new URLSearchParams({page:"0",status:"all",q:normalized});
      void fetch("/api/portal/v7/inventory-procurement/opening-workspace?"+params.toString(),{
        method:"GET",credentials:"same-origin",cache:"no-store",
        headers:{accept:"application/json"},signal:controller.signal,
      }).then(async response=>{
        if(response.status===401)return {status:"sign-in" as const,parsed:null};
        if(response.status===403 || response.status===404)return {status:"restricted" as const,parsed:null};
        if(!response.ok)return {status:"unavailable" as const,parsed:null};
        const payload:unknown=await response.json();
        const parsed=parseOpeningEvidenceChoices(payload);
        return {status:parsed?(parsed.choices.length?"available" as const:"no-data" as const):
          "unavailable" as const,parsed};
      }).then(({status,parsed})=>{
        if(controller.signal.aborted)return;
        setChoices(parsed?.choices??[]);
        setHasMore(parsed?.hasMore??false);
        setSelected(null);
        setState(status);
      }).catch(()=>{
        if(controller.signal.aborted)return;
        setChoices([]);setHasMore(false);setSelected(null);
        setState("unavailable");
      });
    },300);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[normalized]);

  const editQuery=(v:string)=>{
    setQuery(v);setChoices([]);setSelected(null);setHasMore(false);
    setState("idle");
  };
  const select=(item:OpeningEvidenceChoice)=>{
    if(canReuseOpeningEvidence(item))setSelected(item);
  };
  return <aside className={styles.root} aria-label="Reuse an existing opening count reference">
    <div className={styles.heading}>
      <span className={styles.symbol}><Sparkles size={18} aria-hidden="true"/></span>
      <div><strong>Reuse Item Details</strong>
        <p>Search your authorised opening-count history to avoid typing the same item and store again.</p>
      </div>
      <span className={styles.source}><ShieldCheck size={14} aria-hidden="true"/> D1 Evidence</span>
    </div>
    <label className={styles.searchLabel} htmlFor={listId+"-input"}>Find A Previous Item Or Store</label>
    <div className={styles.searchBox}>
      <Search size={18} aria-hidden="true"/>
      <input id={listId+"-input"} type="search" autoComplete="off"
        aria-controls={listId+"-results"} aria-describedby={listId+"-hint"}
        aria-busy={state==="loading"} placeholder="Enter item code or store · 2+ characters"
        maxLength={100} value={query} onChange={event=>editQuery(event.target.value)}/>
    </div>
    <p className={styles.hint} id={listId+"-hint"}>
      Select a source, review its item, store and unit, then apply. Existing quantities and signed references are never copied.
    </p>
    <div className={styles.results} id={listId+"-results"} aria-live="polite">
      {normalized.length<2?<p>Search existing authorised records, or complete the form manually for a new item.</p>:
       state==="idle"||state==="loading"?<p>Checking your authorised opening-count records…</p>:
       state==="restricted"?<p>Record history is not available to this role. Manual entry remains available if permitted.</p>:
       state==="sign-in"?<p>Please sign in again to search existing item details.</p>:
       state==="unavailable"?<p>Previous item search is unavailable. No unverified values will be suggested.</p>:
       state==="no-data"?<p>No matching records in your authorised farm. You can enter the item details manually.</p>:
       <ul className={styles.choiceList}>
         {choices.map(item=><li key={item.id}>
           <button type="button" aria-pressed={selected?.id===item.id}
             disabled={!canReuseOpeningEvidence(item)}
             onClick={()=>select(item)} className={styles.choice}>
             <span><strong>{item.fields.itemCode}</strong>
               <small>{item.fields.locationKey} · {item.fields.unit}</small></span>
             <span className={item.state==="approved"?styles.approved:styles.stage}>{stateLabel[item.state]}</span>
           </button>
         </li>)}
       </ul>}
      {state==="available"&&hasMore&&<p className={styles.hint}>
        Showing the first 16 matching records. Refine the search to find another.
      </p>}
    </div>
    {selected&&canReuseOpeningEvidence(selected)&&<div className={styles.preview}>
      <strong>Review Suggested Details</strong>
      <small>Authenticated record · revision {selected.revision}. This is not a live stock balance or a new count.</small>
      {proposal?.changes.length?<ul>
        {proposal.changes.map(change=><li key={change.key}>
          <span>{names[change.key]??change.key}</span><strong>{change.value}</strong>
          {change.requiresReview&&<small>Replaces “{change.previous}”</small>}
        </li>)}
      </ul>:<p>These item, store and unit values are already present in your form.</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.apply}
          disabled={!proposal?.changes.length} onClick={()=>{if(proposal?.changes.length)onApply(proposal);}}>
          <CheckCircle2 size={17} aria-hidden="true"/> Use These Details
        </button>
        {canUndo&&<button type="button" className={styles.undo} onClick={onUndo}>
          <CornerUpLeft size={16} aria-hidden="true"/> Undo Autofill
        </button>}
      </div>
    </div>}
    {!selected&&canUndo&&<button type="button" className={styles.undo} onClick={onUndo}>
      <CornerUpLeft size={16} aria-hidden="true"/> Undo Last Autofill
    </button>}
  </aside>;
}
