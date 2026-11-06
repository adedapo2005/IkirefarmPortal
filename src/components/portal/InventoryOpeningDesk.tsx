"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, BadgeCheck, ClipboardList, ClipboardPenLine, Clock3,
  FileCheck2, FileWarning, LockKeyhole, RefreshCw, Scale, ShieldCheck, XCircle,
} from "lucide-react";
import { has, isOwnerPrincipal, type Persona } from "@/lib/portal-model";
import styles from "./InventoryOpeningDesk.module.css";
import LoggedTimestamp from "./LoggedTimestamp";
import OpeningStockReusePicker from "./OpeningStockReusePicker";
import { applyReviewedPrefill, undoReviewedPrefill, type GuidedProposal } from "@/lib/farm-guided-entry";

type OpeningData={
  kind:"stock-opening";itemCode:string;locationKey:string;
  unit:"unit"|"kg"|"bag"|"ton"|"litre";openingQuantity:number;
  countedAt:string;basis:"physical-count"|"signed-register";
  sourceReference:string;witnessName:string;evidenceIds?:string[];notes?:string;
};
type OpeningItem={
  id:string;state:"draft"|"submitted"|"approved"|"cancelled";revision:number;
  createdBy:string|null;data:OpeningData;
  actions:{submit:boolean;cancel:boolean;approve:boolean};
};
type Workspace={
  state:"available"|"no-data";source:string;
  totals:{draft:number;submitted:number;approved:number;cancelled:number};
  items:OpeningItem[];hasMore:boolean;hasPrevious:boolean;
  page:number;pageSize:number;totalMatched:number;warning:string;
};
type SourceState="loading"|"available"|"no-data"|"restricted"|"sign-in"|"unavailable";
type CountForm={
  itemCode:string;locationKey:string;unit:OpeningData["unit"];
  quantity:string;countedAt:string;basis:OpeningData["basis"];
  sourceReference:string;witnessName:string;evidenceIds:string;notes:string;
};
const emptyForm:CountForm={
  itemCode:"",locationKey:"",unit:"bag",quantity:"",countedAt:"",
  basis:"physical-count",sourceReference:"",witnessName:"",evidenceIds:"",notes:"",
};
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const text=(v:unknown)=>typeof v==="string" && Boolean(v.trim());
function isWorkspace(value:unknown):value is Workspace{
  if(!value||typeof value!=="object")return false;
  const w=value as Record<string,unknown>;
  if(!["available","no-data"].includes(String(w.state)) ||
      !text(w.source)||!w.totals||typeof w.totals!=="object"||
      !Array.isArray(w.items)||typeof w.hasMore!=="boolean"||
      typeof w.hasPrevious!=="boolean"||!integer(w.page)||w.pageSize!==16||
      !integer(w.totalMatched)||typeof w.warning!=="string")return false;
  const totals=w.totals as Record<string,unknown>;
  if(!["draft","submitted","approved","cancelled"].every(k=>integer(totals[k])))return false;
  return w.items.every((v:unknown)=>{
    if(!v||typeof v!=="object")return false;
    const record=v as Record<string,unknown>;
    if(!text(record.id) || !["draft","submitted","approved","cancelled"].includes(String(record.state)) ||
        !integer(record.revision)||!record.data||typeof record.data!=="object"||
        !record.actions||typeof record.actions!=="object")return false;
    const d=record.data as Record<string,unknown>;
    const rights=record.actions as Record<string,unknown>;
    return d.kind==="stock-opening"&&text(d.itemCode)&&text(d.locationKey)&&text(d.unit)&&
      typeof d.openingQuantity==="number"&&Number.isFinite(d.openingQuantity)&&d.openingQuantity>=0&&
      text(d.countedAt)&&text(d.sourceReference)&&text(d.witnessName)&&
      ["physical-count","signed-register"].includes(String(d.basis))&&
      ["submit","approve","cancel"].every(k=>typeof rights[k]==="boolean");
  });
}
const fmt=(v:number)=>v.toLocaleString("en-NG",{maximumFractionDigits:2});
const quantityUnitLabel:Record<OpeningData["unit"],string>={unit:"units",kg:"kg",bag:"bags",ton:"tonnes",litre:"litres"};
const evidenceStateLabel:Record<OpeningItem["state"],string>={draft:"Draft Count",submitted:"Waiting For Approval",approved:"Approved Evidence",cancelled:"Cancelled"};
const route="/api/portal/v7/inventory-procurement/stock-opening";

export default function InventoryOpeningDesk({person}: {person:Persona}) {
  const [status,setStatus]=useState<SourceState>("loading");
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [refreshKey,setRefreshKey]=useState(0);
  const [refreshing,setRefreshing]=useState(false);
  const [page,setPage]=useState(0);
  const [statusFilter,setStatusFilter]=useState<"all"|"draft"|"submitted"|"approved"|"cancelled">("all");
  const [searchDraft,setSearchDraft]=useState("");
  const searchInputRef=useRef<HTMLInputElement>(null);
  const [search,setSearch]=useState("");
  const [formVisible,setFormVisible]=useState(false);
  const [form,setForm]=useState<CountForm>(emptyForm);
  const [lastReuse,setLastReuse]=useState<{before:CountForm;proposal:GuidedProposal}|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState<{message:string;error:boolean}|null>(null);
  const canCreate=person.restriction!=="disabled" &&
    (has(person,"inventory.edit")||isOwnerPrincipal(person));
  const ready=status==="available"||status==="no-data";

  const requestRefresh=()=>setRefreshKey(n=>n+1);
  const refresh=useCallback(()=>{
    const controller=new AbortController();
    setStatus(current=>current==="available"||current==="no-data"?current:"loading");
    setRefreshing(true);
    const params=new URLSearchParams({page:String(page),status:statusFilter,q:search});
    void fetch("/api/portal/v7/inventory-procurement/opening-workspace?"+params.toString(),{
      credentials:"same-origin",headers:{accept:"application/json"},signal:controller.signal,
    }).then(async response=>{
      if(response.status===401)return {status:"sign-in" as const,workspace:null};
      if(response.status===403||response.status===404)return {status:"restricted" as const,workspace:null};
      if(!response.ok)throw new Error("STOCK_OPENING_SOURCE_UNAVAILABLE");
      const result:unknown=await response.json();
      if(!isWorkspace(result))throw new Error("STOCK_OPENING_INVALID_RESPONSE");
      return {status:result.state,workspace:result};
    }).then(result=>{
      if(controller.signal.aborted)return;
      setStatus(result.status);setWorkspace(result.workspace);setRefreshing(false);
    }).catch(error=>{
      if(controller.signal.aborted||(error instanceof Error&&error.name==="AbortError"))return;
      setStatus("unavailable");setWorkspace(null);setRefreshing(false);
    });
    return()=>controller.abort();
  },[page,statusFilter,search]);
  useEffect(()=>refresh(),[refresh,refreshKey]);

  const setField=<K extends keyof CountForm>(key:K,value:CountForm[K])=>{
    if(lastReuse&&["itemCode","locationKey","unit"].includes(String(key)))setLastReuse(null);
    setForm(previous=>({...previous,[key]:value}));
  };
  const applyReuse=(proposal:GuidedProposal)=>{
    const before={...form};
    const accepted=proposal.changes.map(change=>change.key);
    const next=applyReviewedPrefill(before,proposal,accepted);
    if(next.itemCode===before.itemCode && next.locationKey===before.locationKey && next.unit===before.unit)return;
    if(!["unit","kg","bag","ton","litre"].includes(next.unit))return;
    setForm({...before,itemCode:next.itemCode,locationKey:next.locationKey,unit:next.unit as CountForm["unit"]});
    setLastReuse({before,proposal});
    setNotice({message:"Item details copied from an authorised count record. Review them before saving; no quantity or signed reference was copied.",error:false});
  };
  const undoReuse=()=>{
    if(!lastReuse)return;
    setForm(current=>{
      const restored=undoReviewedPrefill(current,lastReuse.before,lastReuse.proposal);
      return {...current,itemCode:restored.itemCode,locationKey:restored.locationKey,
        unit:(["unit","kg","bag","ton","litre"].includes(restored.unit)
          ?restored.unit:current.unit) as CountForm["unit"]};
    });
    setLastReuse(null);
    setNotice({message:"Suggested item details undone. Later manual edits are preserved.",error:false});
  };
  const verifyReuseSource=async(proposal:GuidedProposal)=>{
    const response=await fetch(route+"/"+encodeURIComponent(proposal.selectedId),{
      credentials:"same-origin",cache:"no-store",headers:{accept:"application/json"},
    });
    if(!response.ok)throw new Error("The selected source record is no longer available. Review the item details manually before saving.");
    const record:unknown=await response.json();
    if(!record||typeof record!=="object")throw new Error("The selected source record could not be revalidated. No save was attempted.");
    const value=record as {id?:unknown;resourceType?:unknown;state?:unknown;revision?:unknown;data?:{kind?:unknown}};
    if(value.id!==proposal.selectedId||value.resourceType!=="stock-opening"||
       value.revision!==proposal.revision||value.data?.kind!=="stock-opening"||
       value.state==="approved"||value.state==="cancelled"){
      throw new Error("The selected source record changed. Review the item details again before saving.");
    }
  };

  const create=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!canCreate||busy||!ready||refreshing)return;
    const count=Number(form.quantity);
    // Nigeria operations use WAT (+01:00) year-round, independent of the
    // browser's timezone. A datetime-local input has no embedded offset.
    const counted=new Date(form.countedAt+":00+01:00");
    if(!Number.isFinite(count)||count<0||!Number.isFinite(counted.getTime())){
      setNotice({message:"Enter a valid stock quantity and count date.",error:true});return;
    }
    const references=form.evidenceIds.split(",").map(s=>s.trim()).filter(Boolean);
    if(references.length>20){
      setNotice({message:"Provide no more than 20 evidence references.",error:true});return;
    }
    setBusy("new");setNotice(null);
    try{
      const proposal=lastReuse?.proposal;
      const source=proposal?{id:proposal.selectedId,revision:proposal.revision}:undefined;
      if(proposal)await verifyReuseSource(proposal);
      const data:OpeningData={
        kind:"stock-opening",itemCode:form.itemCode.trim(),locationKey:form.locationKey.trim(),
        unit:form.unit,openingQuantity:count,countedAt:counted.toISOString(),
        basis:form.basis,sourceReference:form.sourceReference.trim(),
        witnessName:form.witnessName.trim(),
        ...(references.length?{evidenceIds:references}:{}),
        ...(form.notes.trim()?{notes:form.notes.trim()}:{}),
      };
      const response=await fetch(route,{
        method:"POST",credentials:"same-origin",
        headers:{"content-type":"application/json",accept:"application/json"},
        body:JSON.stringify(source?{data,source}:{data}),
      });
      if(!response.ok)throw new Error(response.status===401?"Sign in required.":
        response.status===404?"You do not have permission to register this count.":
        response.status===422?"The count or supporting evidence was rejected.":
        "Count registration unavailable. No success has been assumed.");
      const saved:unknown=await response.json();
      if(!saved||typeof saved!=="object"||(saved as {state?:unknown}).state!=="draft")
        throw new Error("Count confirmation not received; refresh before retrying.");
      setForm(emptyForm);setLastReuse(null);setFormVisible(false);
      setNotice({message:"Opening Count Draft recorded. It is not approved stock or a stock-on-hand balance.",error:false});
      requestRefresh();
    }catch(error){
      setNotice({message:error instanceof Error?error.message:"Unable to record opening count.",error:true});
    }finally{setBusy(null);}
  };
  const transition=async(item:OpeningItem,to:"submitted"|"approved"|"cancelled")=>{
    if(busy||!ready||refreshing)return;
    const allowed=to==="submitted"?item.actions.submit:
      to==="approved"?item.actions.approve:item.actions.cancel;
    if(!allowed)return;
    setBusy(item.id);setNotice(null);
    try{
      const response=await fetch(route+"/"+encodeURIComponent(item.id),{
        method:"POST",credentials:"same-origin",
        headers:{"content-type":"application/json",accept:"application/json"},
        body:JSON.stringify({to,expectedRevision:item.revision}),
      });
      if(!response.ok)throw new Error(response.status===409?
        "This count changed or conflicts with an approved baseline. Refresh before deciding.":
        response.status===404?"You cannot perform this action on this record.":
        "Opening Count update unavailable. No success has been assumed.");
      const saved:unknown=await response.json();
      if(!saved||typeof saved!=="object"||(saved as {state?:unknown}).state!==to)
        throw new Error("Count state confirmation not received; refresh the register.");
      setNotice({message:to==="approved"?
        "Opening evidence approved. Current stock-on-hand remains unverified.":
        to==="submitted"?"Opening count submitted for independent review.":
        "Opening count cancelled without posting stock.",error:false});
      requestRefresh();
    }catch(error){
      setNotice({message:error instanceof Error?error.message:"Opening Count update failed.",error:true});
      requestRefresh();
    }finally{setBusy(null);}
  };

  return <section className={styles.root} aria-labelledby="opening-title">
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <span className={styles.eyebrow}><Scale size={17} aria-hidden="true"/> Inventory Reconciliation / Evidence Register</span>
        <h2 id="opening-title">Count What Exists. Approve What Is Proven.</h2>
        <p>Establish witnessed opening-stock evidence for each item, store and unit. Every count requires an independent approval before it can be considered an accepted baseline.</p>
      </div>
      <div className={styles.headerActions}>
        {canCreate&&ready&&<button type="button" className={styles.primary} onClick={()=>setFormVisible(x=>!x)} aria-expanded={formVisible} aria-controls="opening-count-form">
          <ClipboardPenLine size={18} aria-hidden="true"/>{formVisible?"Close Count Entry":"Record Opening Count"}
        </button>}
        <button type="button" className={styles.secondary} onClick={requestRefresh} disabled={status==="loading"||busy!==null}>
          <RefreshCw size={17} aria-hidden="true"/>Refresh Evidence
        </button>
      </div>
    </header>
    <div className={styles.ribbon} role="status">
      <span><ShieldCheck size={17} aria-hidden="true"/>
        {status==="available"?"LIVE D1 COUNT EVIDENCE":status==="no-data"?"NO OPENING COUNTS RECORDED":
          status==="loading"?"CHECKING AUTHENTICATED REGISTER":
            status==="restricted"?"ACCESS RESTRICTED":status==="sign-in"?"SIGN IN REQUIRED":
              "OPENING REGISTER UNAVAILABLE"}
      </span>
      <span>Witness required · Separate approver · No inferred stock-on-hand</span>
    </div>
    {notice&&<p className={notice.error?styles.error:styles.success} role={notice.error?"alert":"status"}>{notice.message}</p>}
    {ready&&workspace?<><div className={styles.summary} aria-label="Opening count lifecycle totals">
      <div><span><ClipboardList size={18}/>Draft Counts</span><strong>{fmt(workspace.totals.draft)}</strong></div>
      <div><span><Clock3 size={18}/>Waiting For Approval</span><strong>{fmt(workspace.totals.submitted)}</strong></div>
      <div><span><BadgeCheck size={18}/>Approved Baselines</span><strong>{fmt(workspace.totals.approved)}</strong></div>
      <div><span><XCircle size={18}/>Cancelled</span><strong>{fmt(workspace.totals.cancelled)}</strong></div>
    </div>

    {canCreate&&formVisible&&<form className={styles.form} id="opening-count-form" onSubmit={create}>
      <div className={styles.formIntro}><div><span className={styles.kicker}>01 / EVIDENCE CAPTURE</span><h3>New Witnessed Opening Count</h3>
        <p>Save as draft. A different authorised person must approve it; this form never posts a stock movement or an available balance. Count times are recorded in Nigeria WAT.</p></div><FileCheck2 size={29}/></div>
      <OpeningStockReusePicker draft={{itemCode:form.itemCode,locationKey:form.locationKey,unit:form.unit}}
        onApply={applyReuse} onUndo={undoReuse} canUndo={lastReuse!==null}/>
      <div className={styles.fields}>
        <label>Item Code<input required maxLength={80} value={form.itemCode} placeholder="Enter the recorded item code" onChange={e=>setField("itemCode",e.target.value)}/></label>
        <label>Store / Location<input required maxLength={120} value={form.locationKey} placeholder="Use the actual store identifier" onChange={e=>setField("locationKey",e.target.value)}/></label>
        <label>Unit<select value={form.unit} onChange={e=>setField("unit",e.target.value as CountForm["unit"])}>
          <option value="bag">Bags</option><option value="kg">Kilograms</option><option value="unit">Units</option><option value="ton">Tonnes</option><option value="litre">Litres</option>
        </select></label>
        <label>Quantity Counted <small>(zero permitted)</small>
          <span className={styles.quantityGroup}>
            <input required type="number" min={0} step="any" value={form.quantity}
              aria-describedby="opening-quantity-unit" onChange={e=>setField("quantity",e.target.value)}/>
            <span id="opening-quantity-unit" className={styles.quantityUnit}>{quantityUnitLabel[form.unit]}</span>
          </span>
        </label>
        <label>Counted At · Nigeria Time (WAT)<input required type="datetime-local" value={form.countedAt} onChange={e=>setField("countedAt",e.target.value)}/></label>
        <label>Verification Basis<select value={form.basis} onChange={e=>setField("basis",e.target.value as CountForm["basis"])}>
          <option value="physical-count">Witnessed Physical Count</option><option value="signed-register">Signed Opening Register Reconciliation</option>
        </select></label>
        <label>Signed Count Sheet / Reference<input required maxLength={160} value={form.sourceReference} placeholder="Your documented source reference" onChange={e=>setField("sourceReference",e.target.value)}/></label>
        <label>Independent Witness<input required maxLength={160} value={form.witnessName} placeholder="Witness name on the source document" onChange={e=>setField("witnessName",e.target.value)}/></label>
        <label className={styles.wide}>Evidence IDs <small>(up to 20, comma-separated)</small><input maxLength={2000} value={form.evidenceIds} placeholder="Authorised document references, if available" onChange={e=>setField("evidenceIds",e.target.value)}/></label>
        <label className={styles.wide}>Notes <small>(optional)</small><textarea maxLength={1000} rows={2} value={form.notes} placeholder="Relevant differences or count observations" onChange={e=>setField("notes",e.target.value)}/></label>
      </div>
      <div className={styles.formFoot}><span><LockKeyhole size={17}/> An approved count cannot be edited in place.</span>
        <button className={styles.primary} type="submit" disabled={busy!==null||!ready}>{busy==="new"?"Recording…":"Save Count Draft"}<ArrowRight size={16}/></button>
      </div>
    </form>}

    <div className={styles.register} aria-busy={refreshing}>
      <div className={styles.registerHeading}><div><span className={styles.kicker}>02 / INDEPENDENT VERIFICATION</span><h3>Opening Stock Evidence</h3><p>Separate recorded quantities by item, store and unit. Approval makes a baseline valid as evidence—not a current balance.</p></div><FileCheck2 size={27}/></div>
      <form className={styles.historyFilters} role="search" aria-label="Search authorised opening stock history"
        onSubmit={event=>{event.preventDefault();setPage(0);setSearch(searchDraft.trim());}}>
        <label>Find Count Evidence
          <input ref={searchInputRef} aria-label="Find count by item, store or source reference" type="search"
            placeholder="Item code, store or count sheet reference" maxLength={100}
            value={searchDraft} onChange={event=>setSearchDraft(event.target.value)}/>
        </label>
        <label>Lifecycle State
          <select aria-label="Opening stock lifecycle filter" value={statusFilter}
            onChange={event=>{setPage(0);setStatusFilter(event.target.value as typeof statusFilter);}}>
            <option value="all">All Counts</option><option value="draft">Draft</option>
            <option value="submitted">Waiting For Approval</option><option value="approved">Approved</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button className={styles.filterButton} type="submit" disabled={busy!==null}>Search History</button>
        {(search||statusFilter!=="all")&&<button className={styles.clearButton} type="button"
          onClick={()=>{searchInputRef.current?.focus();setSearch("");setSearchDraft("");setStatusFilter("all");setPage(0);}}
          disabled={busy!==null}>Clear Filters</button>}
      </form>
      <div className={styles.historyContext} role="status" aria-live="polite">
        {refreshing&&<span>Refreshing authorised evidence…</span>}
        <span>{workspace.totalMatched} matching count{workspace.totalMatched===1?"":"s"} in your authorised farm records</span>
        <span>Page {workspace.page+1} · {workspace.totalMatched===0?0:workspace.page*workspace.pageSize+1}–{Math.min((workspace.page+1)*workspace.pageSize,workspace.totalMatched)} shown</span>
      </div>
      {workspace.items.length? <div className={styles.records}>
        {workspace.items.map(item=><article key={item.id} className={styles.record}>
          <div className={styles.recordTop}>
            <div><strong>{item.data.itemCode}</strong><small>{item.data.locationKey} · {item.data.unit} · {item.data.basis==="physical-count"?"Physical Count":"Signed Register"}</small></div>
            <span className={item.state==="approved"?styles.approved:item.state==="submitted"?styles.submitted:styles.neutral}>{evidenceStateLabel[item.state]}</span>
          </div>
          <div className={styles.recordBody}><div><span>WITNESSED OPENING QUANTITY</span><strong>{fmt(item.data.openingQuantity)} <small>{item.data.unit}</small></strong></div>
            <div><span>COUNT REFERENCE</span><p>{item.data.sourceReference}</p></div>
            <div><span>COUNTED AT</span><p><LoggedTimestamp value={item.data.countedAt}/></p></div>
          </div>
          <p className={styles.witness}>Independent witness: {item.data.witnessName}</p>
          {(item.actions.submit||item.actions.cancel||item.actions.approve)&&<div className={styles.recordActions}>
            {item.actions.submit&&<button type="button" onClick={()=>void transition(item,"submitted")} disabled={busy!==null} aria-disabled={busy!==null||refreshing}>Submit For Approval <ArrowRight size={15}/></button>}
            {item.actions.approve&&<button type="button" onClick={()=>void transition(item,"approved")} disabled={busy!==null} aria-disabled={busy!==null||refreshing} className={styles.approveButton}><BadgeCheck size={16}/>Approve Evidence</button>}
            {item.actions.cancel&&<button type="button" onClick={()=>void transition(item,"cancelled")} disabled={busy!==null} aria-disabled={busy!==null||refreshing} className={styles.cancelButton}>Cancel Count</button>}
          </div>}
          {item.state==="submitted"&&!item.actions.approve&&<p className={styles.makerNote}>Awaiting a different authorised approver. The person who recorded a count cannot approve their own evidence.</p>}
        </article>)}
      </div>:<div className={styles.empty}><ClipboardList size={31}/>
        <strong>{workspace.totalMatched===0 && !search && statusFilter==="all"?"No Opening Counts Recorded":"No Matching Count Evidence"}</strong>
        <p>{workspace.totalMatched===0 && !search && statusFilter==="all"
          ?"Record a witnessed physical count or signed register reconciliation. No initial stock or balance has been assumed."
          :"No authorised counts match this search, lifecycle filter or page. Try a different view; the historical records have not been deleted."}</p>
      </div>}
      <nav className={styles.pagination} aria-label="Opening count history pagination">
        <button type="button" aria-disabled={!workspace.hasPrevious||busy!==null||refreshing}
          onClick={()=>{if(!refreshing&&busy===null&&workspace.hasPrevious)setPage(current=>Math.max(0,current-1));}}>Previous 16</button>
        <span>Page {workspace.page+1} of {Math.max(1,Math.ceil(workspace.totalMatched/workspace.pageSize))}</span>
        <button type="button" aria-disabled={!workspace.hasMore||busy!==null||refreshing}
          onClick={()=>{if(!refreshing&&busy===null&&workspace.hasMore)setPage(current=>current+1);}}>Next 16</button>
      </nav>
    </div>
    <div className={styles.disclosure}><FileWarning size={21} aria-hidden="true"/><div><strong>Stock On Hand Remains Unverified</strong><p>{workspace.warning} Approved counts are not automatically posted as receipts, issues or adjustments.</p></div></div>
    <p className={styles.source}>Source: {workspace.source}. This is authenticated register evidence, not an inventory valuation.</p>
    </>:<div className={styles.unavailable} role={status==="unavailable"?"alert":"status"}>
      {status==="loading"?"Checking the live opening stock register…":
      status==="sign-in"?"Sign in to access opening stock evidence.":
      status==="restricted"?"Your role cannot view this evidence register.":
      "The live opening stock register is unavailable. No baseline quantities or approval states are assumed."}
    </div>}
  </section>;
}
