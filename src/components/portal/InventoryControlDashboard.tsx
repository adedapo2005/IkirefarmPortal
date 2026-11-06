"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, ArrowUpFromLine, Boxes, ClipboardCheck,
  ClipboardList, Clock3, FileWarning, PackageSearch, RefreshCw,
  Scale, ShieldCheck, SlidersHorizontal, Truck,
} from "lucide-react";
import { canPage, type Persona } from "@/lib/portal-model";
import styles from "./InventoryControlDashboard.module.css";

type Counts = {
  recorded: number;
  draft: number;
  posted: number;
  voided: number;
  pendingAdjustments: number;
  postedWithoutReference: number;
  postedReceipts: number;
  postedIssues: number;
  postedAdjustments: number;
  postedTransfers: number;
};
type Flow = {
  itemCode: string; locationKey: string; unit: string;
  postedReceiptQuantity: number; postedIssueQuantity: number;
  postedAdjustments: number; postedTransfers: number; recordedMovements: number;
};
type Movement = {
  id: string; state: "draft" | "posted" | "voided";
  itemCode: string; locationKey: string;
  movementType: "receipt" | "issue" | "adjustment" | "transfer";
  quantity: number; unit: string; occurredAt: string;
  hasSupportingReference: boolean; updatedAt: string | null;
};
type Summary = {
  state: "available" | "no-data";
  source: string;
  asOf: string;
  totals: Counts;
  activity: Flow[];
  recent: Movement[];
  dataQuality: {
    balanceVerified: boolean;
    reorderThresholdsVerified: boolean;
    valuationVerified: boolean;
    note: string;
  };
};
type LoadState = "loading" | "available" | "no-data" | "sign-in" | "restricted" | "unavailable";
const metricNames: (keyof Counts)[] = [
  "recorded", "draft", "posted", "voided", "pendingAdjustments",
  "postedWithoutReference", "postedReceipts", "postedIssues",
  "postedAdjustments", "postedTransfers",
];
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
function isSummary(value: unknown): value is Summary {
  if (!value || typeof value !== "object") return false;
  const record=value as Record<string,unknown>;
  if (!["available","no-data"].includes(String(record.state)) ||
      typeof record.source!=="string" ||
      !record.totals || typeof record.totals!=="object" ||
      !record.dataQuality || typeof record.dataQuality!=="object" ||
      !Array.isArray(record.activity) || !Array.isArray(record.recent)) return false;
  const totals=record.totals as Record<string,unknown>;
  if (!metricNames.every(name=>integer(totals[name]))) return false;
  const quality=record.dataQuality as Record<string,unknown>;
  if (quality.balanceVerified!==false || quality.reorderThresholdsVerified!==false ||
      quality.valuationVerified!==false) return false;
  if (!record.activity.every((item:unknown)=>{
    if (!item || typeof item!=="object")return false;
    const row=item as Record<string,unknown>;
    return typeof row.itemCode==="string" && typeof row.locationKey==="string" &&
      typeof row.unit==="string" && Number.isFinite(row.postedReceiptQuantity) &&
      Number(row.postedReceiptQuantity)>=0 && Number.isFinite(row.postedIssueQuantity) &&
      Number(row.postedIssueQuantity)>=0 && integer(row.postedAdjustments) &&
      integer(row.postedTransfers) && integer(row.recordedMovements);
  }))return false;
  return record.recent.every((item:unknown)=>{
    if(!item || typeof item!=="object")return false;
    const row=item as Record<string,unknown>;
    return typeof row.id==="string" && typeof row.itemCode==="string" &&
      typeof row.locationKey==="string" && ["draft","posted","voided"].includes(String(row.state)) &&
      ["receipt","issue","adjustment","transfer"].includes(String(row.movementType)) &&
      Number.isFinite(row.quantity) && Number(row.quantity)>0 && typeof row.unit==="string" &&
      typeof row.occurredAt==="string" && typeof row.hasSupportingReference==="boolean";
  });
}
const fmt=(value:number)=>value.toLocaleString("en-NG",{maximumFractionDigits:2});

export default function InventoryControlDashboard({
  person, go, revision,
}: { person: Persona; go:(route:string)=>void; revision:number }) {
  const [state,setState]=useState<LoadState>("loading");
  const [summary,setSummary]=useState<Summary|null>(null);
  const [reload,setReload]=useState(0);
  const refresh=useCallback(()=>{
    setState("loading");
    const controller=new AbortController();
    void fetch("/api/portal/v7/inventory-procurement/stock-workspace",{
      credentials:"same-origin",headers:{accept:"application/json"},signal:controller.signal,
    }).then(async response=>{
      if(response.status===401)return {state:"sign-in" as const,body:null};
      if(response.status===403||response.status===404)return {state:"restricted" as const,body:null};
      if(!response.ok)throw new Error("SOURCE_UNAVAILABLE");
      const payload:unknown=await response.json();
      if(!isSummary(payload))throw new Error("INVALID_STOCK_WORKSPACE_SOURCE");
      return {state:payload.state,body:payload};
    }).then(result=>{
      if(controller.signal.aborted)return;
      setSummary(result.body);setState(result.state);
    }).catch(error=>{
      if(controller.signal.aborted||(error instanceof Error&&error.name==="AbortError"))return;
      setSummary(null);setState("unavailable");
    });
    return()=>controller.abort();
  },[]);
  useEffect(()=>refresh(),[refresh,reload,revision]);

  const ready=state==="available"||state==="no-data";
  const counts=summary?.totals;
  const goRecord=()=>{
    const form=document.getElementById("inventory-stock-movement-form");
    if(!form)return;
    form.scrollIntoView({
      block:"center",
      behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",
    });
    form.querySelector<HTMLInputElement>("input")?.focus({preventScroll:true});
  };

  return <section className={styles.root} aria-labelledby="inventory-command-title">
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}><Boxes size={17} aria-hidden="true"/> Inventory Intelligence / Stock Movement Control</span>
        <h2 id="inventory-command-title">Every Movement Counts. Every Gap Has An Owner.</h2>
        <p>Evidence-led stock operations. Record what moved, track what is waiting for posting, and keep estimates out of decisions.</p>
        <div className={styles.heroActions}>
          {ready&&<button type="button" className={styles.heroPrimary} onClick={goRecord}>
            <ClipboardList size={17} aria-hidden="true"/> Record Stock Movement
          </button>}
          {canPage(person,"feed-stock")&&<button type="button" className={styles.heroSecondary} onClick={()=>go("feed-stock")}>Feed Stock <ArrowRight size={16}/></button>}
          {canPage(person,"purchase-orders")&&<button type="button" className={styles.heroSecondary} onClick={()=>go("purchase-orders")}>Purchase Orders <ArrowRight size={16}/></button>}
          <button type="button" className={styles.heroSecondary} onClick={()=>setReload(value=>value+1)} disabled={state==="loading"}>
            <RefreshCw size={16} aria-hidden="true"/> Refresh
          </button>
        </div>
      </div>
      <div className={styles.heroCount} aria-live="polite">
        <span>POSTED MOVEMENTS</span>
        <strong>{ready&&counts?fmt(counts.posted):"—"}</strong>
        <small>{ready?"Verified ledger states in the authorised farm":"Source verification pending"}</small>
      </div>
    </header>

    <div className={styles.status} role="status">
      <span className={ready?styles.statusReady:styles.statusPending}><ShieldCheck size={16} aria-hidden="true"/>
        {state==="available"?"LIVE D1 MOVEMENTS VERIFIED":state==="no-data"?"NO AUTHORISED MOVEMENTS YET":
          state==="loading"?"CHECKING D1 SOURCE":state==="sign-in"?"SIGN IN REQUIRED":
            state==="restricted"?"ACCESS RESTRICTED":"LIVE SOURCE UNAVAILABLE"}
      </span>
      <span>Authorised farm and site · No simulated stock balances</span>
    </div>

    {ready&&counts&&summary ? <>
      <div className={styles.scoreboard} aria-label="Authorised inventory movement states">
        <div className={styles.score}><span><Boxes size={19} aria-hidden="true"/> Movement Records</span><strong>{fmt(counts.recorded)}</strong><small>All recorded states</small></div>
        <div className={styles.score}><span><ClipboardCheck size={19} aria-hidden="true"/> Posted</span><strong>{fmt(counts.posted)}</strong><small>Accepted ledger entries</small></div>
        <div className={styles.score}><span><Clock3 size={19} aria-hidden="true"/> Awaiting Posting</span><strong>{fmt(counts.draft)}</strong><small>Draft movement queue</small></div>
        <div className={styles.score}><span><FileWarning size={19} aria-hidden="true"/> Missing Reference</span><strong>{fmt(counts.postedWithoutReference)}</strong><small>Posted, no recorded source or evidence ID</small></div>
      </div>

      <div className={styles.flowBand} aria-labelledby="flow-band-title">
        <div className={styles.flowHeading}>
          <div><span>POSTED LEDGER / EVENT MIX</span><h3 id="flow-band-title">How Stock Was Recorded</h3></div>
          <small>Counts of posted transactions, never quantities mixed across units</small>
        </div>
        <div className={styles.flowCounts}>
          <div><ArrowDownToLine size={19} aria-hidden="true"/><span>Receipts</span><strong>{fmt(counts.postedReceipts)}</strong></div>
          <div><ArrowUpFromLine size={19} aria-hidden="true"/><span>Issues</span><strong>{fmt(counts.postedIssues)}</strong></div>
          <div><SlidersHorizontal size={19} aria-hidden="true"/><span>Adjustments</span><strong>{fmt(counts.postedAdjustments)}</strong></div>
          <div><Truck size={19} aria-hidden="true"/><span>Transfers</span><strong>{fmt(counts.postedTransfers)}</strong></div>
        </div>
      </div>

      <div className={styles.content}>
        <section className={styles.activity} aria-labelledby="stock-activity-title">
          <div className={styles.sectionHeading}><div>
            <span className={styles.sectionKicker}>ITEM / SITE / UNIT · NO CROSS-UNIT MIXING</span>
            <h3 id="stock-activity-title">Recorded Stock Flows</h3>
            <p>Receipts and issues from posted entries. Not opening stock, current balance or available-to-promise.</p>
          </div><PackageSearch size={25} aria-hidden="true"/></div>

          {summary.activity.length ? <div className={styles.flowList}>
            {summary.activity.map((item,index)=>{
              const peak=Math.max(item.postedReceiptQuantity,item.postedIssueQuantity,1);
              return <article className={styles.flowRow} key={item.itemCode+"|"+item.locationKey+"|"+item.unit}>
                <span className={styles.rank}>0{index+1}</span>
                <div className={styles.itemInfo}>
                  <strong>{item.itemCode}</strong>
                  <small>{item.locationKey} · {item.unit} · {fmt(item.recordedMovements)} posted</small>
                  <div className={styles.comparison}>
                    <div>
                      <span>Receipts <b>{fmt(item.postedReceiptQuantity)} {item.unit}</b></span>
                      <div className={styles.track}><span className={styles.receiptFill} style={{width:`${(item.postedReceiptQuantity/peak)*100}%`}}/></div>
                    </div>
                    <div>
                      <span>Issues <b>{fmt(item.postedIssueQuantity)} {item.unit}</b></span>
                      <div className={styles.track}><span className={styles.issueFill} style={{width:`${(item.postedIssueQuantity/peak)*100}%`}}/></div>
                    </div>
                  </div>
                  {(item.postedAdjustments>0||item.postedTransfers>0)&&
                    <small>{item.postedAdjustments} adjustments · {item.postedTransfers} transfers recorded separately</small>}
                </div>
              </article>;
            })}
          </div> : <div className={styles.empty} role="status">
            <PackageSearch size={30} aria-hidden="true"/>
            <strong>No posted item movements recorded</strong>
            <p>Post an authorised stock movement to begin the evidence trail. No stock quantities are assumed.</p>
          </div>}
        </section>

        <aside className={styles.queue} aria-labelledby="inventory-review-title">
          <div className={styles.queueTitle}><span><ClipboardCheck size={22} aria-hidden="true"/></span>
            <div><small>OPERATIONS / REVIEW QUEUE</small><h3 id="inventory-review-title">Control Desk</h3></div>
          </div>
          <div className={styles.queueItem}><div><strong>Drafts Awaiting Posting</strong>
            <p>Movements recorded but not yet accepted into the posted register.</p></div>
            <b>{fmt(counts.draft)}</b></div>
          <div className={styles.queueItem}><div><strong>Adjustments Waiting For Review</strong>
            <p>Draft adjustment entries requiring an authorised posting decision.</p></div>
            <b>{fmt(counts.pendingAdjustments)}</b></div>
          <div className={styles.queueItem}><div><strong>Supporting References Missing</strong>
            <p>Posted entries without a source reference or evidence ID; not a verified compliance violation.</p></div>
            <b>{fmt(counts.postedWithoutReference)}</b></div>
          <div className={styles.quality}>
            <div className={styles.qualityIcon}><Scale size={20} aria-hidden="true"/></div>
            <strong>Stock Balance Not Yet Verified</strong>
            <p>Opening balances, stocktaking, signed adjustments, transfer destinations and reorder limits need their own authoritative controls. No fabricated low-stock or stock-value alerts are displayed.</p>
          </div>
          {canPage(person,"medication-stock")&&<button type="button" className={styles.queueAction} onClick={()=>go("medication-stock")}>Medication Batch Register <ArrowRight size={15}/></button>}
        </aside>
      </div>

      <section className={styles.recent} aria-label="Most recently recorded authorised stock movements">
        <div className={styles.recentTitle}><div><span className={styles.sectionKicker}>RECENT LEDGER EVIDENCE</span><h3>Latest Recorded Movements</h3></div><small>Up to 8 authorised entries</small></div>
        {summary.recent.length ? <div className={styles.recentRows}>
          {summary.recent.map(item=><div className={styles.recentRow} key={item.id}>
            <span className={styles.recentSymbol}><Boxes size={18}/></span>
            <div><strong>{item.itemCode} · {item.movementType}</strong>
              <small>{item.locationKey} · {fmt(item.quantity)} {item.unit}</small></div>
            <span className={item.state==="posted"?styles.statePosted:item.state==="draft"?styles.stateDraft:styles.stateVoided}>{item.state}</span>
          </div>)}
        </div> : <p className={styles.recentEmpty}>No stock movements have been recorded in your authorised scope.</p>}
      </section>
      <p className={styles.disclosure}>Source: {summary.source}. {summary.dataQuality.note}</p>
    </> : <div className={styles.unavailable} role="status">
      {state==="loading"?"Loading the authoritative inventory movement register…"
        :state==="sign-in"?"Sign in to view your authorised inventory data."
        :state==="restricted"?"These inventory records are outside your authorised access."
        :"The stock service could not verify live records. Sample movements and invented balances are withheld."}
    </div>}
  </section>;
}
