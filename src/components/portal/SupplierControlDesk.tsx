"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, BadgeCheck, Building2, ChevronLeft, ChevronRight, ClipboardCheck,
  FileWarning, Mail, Plus, RefreshCw, Search, ShieldCheck, Truck, X,
} from "lucide-react";
import { canPage, has, isOwnerPrincipal, type Persona } from "@/lib/portal-model";
import { toast } from "sonner";
import styles from "./SupplierControlDesk.module.css";

type SupplierRecord = {
  id: string; code: string; name: string; status: "active" | "inactive";
  contactEmail: string | null; evidenceCount: number; revision: number; updatedAt: string | null;
};
type SupplierPayload = {
  state: "available" | "no-data"; source: string; asOf: string;
  metrics: { registered: number; active: number; inactive: number; missingContact: number; missingEvidenceIds: number };
  items: SupplierRecord[]; matchedCount: number; page: number; pageSize: number;
  nextPage: number | null; previousPage: number | null; evidenceNote: string;
};
type SourceState = "loading" | "available" | "no-data" | "restricted" | "sign-in" | "unavailable";
const emptyForm = { supplierCode:"", name:"", contactEmail:"", evidenceIds:"" };
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
function validPayload(value: unknown): value is SupplierPayload {
  if (!value || typeof value !== "object") return false;
  const x=value as Record<string,unknown>;
  if (!["available","no-data"].includes(String(x.state)) || !x.metrics || typeof x.metrics!=="object" ||
      !Array.isArray(x.items) || !count(x.matchedCount) || !count(x.page) || !count(x.pageSize) ||
      (x.nextPage!==null && !count(x.nextPage)) || (x.previousPage!==null && !count(x.previousPage))) return false;
  const m=x.metrics as Record<string,unknown>;
  return ["registered","active","inactive","missingContact","missingEvidenceIds"].every(key=>count(m[key]))
    && x.items.every((item:unknown)=>{
      if (!item || typeof item!=="object") return false;
      const record=item as Record<string,unknown>;
      return typeof record.id==="string" && typeof record.code==="string" && typeof record.name==="string"
        && ["active","inactive"].includes(String(record.status))
        && (record.contactEmail===null || typeof record.contactEmail==="string")
        && count(record.evidenceCount) && count(record.revision);
    });
}
const reason = (status:number, body:unknown) => {
  const payload=body && typeof body==="object" ? body as {details?:unknown}:null;
  const detail=Array.isArray(payload?.details)
    ? payload.details.filter((x):x is string=>typeof x==="string").slice(0,4).join(" ") : "";
  if(status===401)return "Sign in again to register a supplier.";
  if(status===403||status===404)return "Supplier registration is unavailable in your authorised scope.";
  if(status===409)return "This supplier code already exists in the current farm. Refresh the register.";
  if(status===422)return detail||"Review the supplier details and try again.";
  return "The supplier service could not save this record. No success has been assumed.";
};

export default function SupplierControlDesk({person,go}:{person:Persona;go:(route:string)=>void}) {
  const [source,setSource]=useState<SourceState>("loading");
  const [data,setData]=useState<SupplierPayload|null>(null);
  const [query,setQuery]=useState("");
  const [activeQuery,setActiveQuery]=useState("");
  const [page,setPage]=useState(0);
  const [refresh,setRefresh]=useState(0);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState(emptyForm);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const codeRef=useRef<HTMLInputElement>(null);
  const canCreate=person.restriction!=="disabled" && (has(person,"inventory.edit") || isOwnerPrincipal(person));

  useEffect(()=>{
    let alive=true;
    const controller=new AbortController();
    setSource("loading");setData(null);
    const params=new URLSearchParams({page:String(page)});
    if(activeQuery)params.set("q",activeQuery);
    void fetch("/api/portal/v7/inventory-procurement/supplier-workspace?"+params.toString(), {
      credentials:"same-origin",headers:{accept:"application/json"},signal:controller.signal,
    }).then(async response=>{
      if(response.status===401)return {state:"sign-in" as const,payload:null};
      if(response.status===403||response.status===404)return {state:"restricted" as const,payload:null};
      if(!response.ok)throw new Error("SOURCE_UNAVAILABLE");
      const body:unknown=await response.json();
      if(!validPayload(body))throw new Error("INVALID_SUPPLIER_PAYLOAD");
      return {state:body.state,payload:body};
    }).then(result=>{
      if(!alive)return;
      setSource(result.state);setData(result.payload);
    }).catch(error=>{
      if(!alive || (error instanceof Error && error.name==="AbortError"))return;
      setSource("unavailable");setData(null);
    });
    return()=>{alive=false;controller.abort()};
  },[activeQuery,page,refresh]);

  useEffect(()=>{if(showForm)codeRef.current?.focus({preventScroll:true})},[showForm]);
  const value=(key:keyof typeof emptyForm) => form[key];
  const field=(key:keyof typeof emptyForm,entry:string)=>setForm(current=>({...current,[key]:entry}));
  const newSupplier=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!canCreate || saving || source==="sign-in" || source==="restricted" || source==="unavailable")return;
    const supplierCode=value("supplierCode").trim();
    const name=value("name").trim();
    if(!supplierCode || !name){setNotice("Supplier code and name are required.");return;}
    setSaving(true);setNotice("");
    try {
      const evidenceIds=value("evidenceIds").split(",").map(item=>item.trim()).filter(Boolean);
      if(evidenceIds.length>20){setNotice("Provide no more than 20 existing evidence IDs.");return;}
      const response=await fetch("/api/portal/v7/inventory-procurement/supplier",{
        method:"POST",credentials:"same-origin",
        headers:{accept:"application/json","content-type":"application/json"},
        body:JSON.stringify({data:{
          kind:"supplier",supplierCode,name,status:"active",
          ...(value("contactEmail").trim()?{contactEmail:value("contactEmail").trim()}:{}),
          ...(evidenceIds.length?{evidenceIds}:{}),
        }}),
      });
      if(!response.ok){
        let body:unknown=null;try{body=await response.json()}catch{}
        const errorMessage=reason(response.status,body);
        setNotice(errorMessage);toast.error(errorMessage);
        return;
      }
      const saved=await response.json() as {id?:unknown;data?:unknown};
      if(typeof saved.id!=="string"){throw new Error("INVALID_SUCCESS_RESPONSE");}
      setForm(emptyForm);setShowForm(false);
      setPage(0);setActiveQuery("");setQuery("");
      setRefresh(current=>current+1);
      setNotice("Supplier record accepted by the service. Refreshing authorised D1 records.");
      toast.success("Supplier registered");
    } catch {
      setNotice("Supplier registration could not be verified. Refresh the authorised register.");
      toast.error("Supplier registration not verified");
    } finally {setSaving(false)}
  };
  const ready=source==="available"||source==="no-data";
  const metrics=data?.metrics;
  const openForm=()=>{setShowForm(true);setNotice("")};

  return <div className={styles.root}>
    <section className={styles.hero} aria-labelledby="supplier-command-title">
      <div className={styles.heroLead}>
        <span className={styles.eyebrow}><Truck size={17} aria-hidden="true"/> SUPPLY CHAIN INTELLIGENCE / SOURCE CONTROL</span>
        <h2 id="supplier-command-title">Know Every Supplier. Trust Every Source.</h2>
        <p>An authoritative sourcing register for purchasing decisions, supplier evidence and accountable handovers.</p>
        <div className={styles.heroActions}>
          {canCreate&&ready&&<button type="button" className={styles.primary} onClick={openForm}>
            <Plus size={17} aria-hidden="true"/> Register Supplier
          </button>}
          <button type="button" className={styles.secondary} disabled={source==="loading"}
            onClick={()=>setRefresh(current=>current+1)}><RefreshCw size={16} aria-hidden="true"/> Refresh Records</button>
          {canPage(person,"purchase-orders")&&<button type="button" className={styles.secondary} onClick={()=>go("purchase-orders")}>
            Purchase Orders <ArrowRight size={16} aria-hidden="true"/>
          </button>}
        </div>
      </div>
      <div className={styles.heroAside}>
        <span>ACTIVE REGISTERED SUPPLIERS</span>
        <strong>{ready&&metrics ? metrics.active.toLocaleString("en-NG") : "—"}</strong>
        <small>{ready?"Current authorised farm and site":"Verified data loading or unavailable"}</small>
      </div>
    </section>

    <div className={styles.provenance} role="status">
      <span><ShieldCheck size={16} aria-hidden="true"/> {source==="available"?"D1 SUPPLIER RECORDS VERIFIED"
        : source==="no-data"?"NO VERIFIED SUPPLIER RECORDS"
        : source==="loading"?"CHECKING AUTHORISED SUPPLIERS"
        : source==="sign-in"?"SIGN IN REQUIRED"
        : source==="restricted"?"ACCESS RESTRICTED":"LIVE DATA UNAVAILABLE"}</span>
      <small>Real procurement authority • No sample supplier promotion</small>
    </div>

    {ready&&metrics&&data?<>
      <div className={styles.metrics} aria-label="Verified sourcing records">
        <div><span><Building2 size={18}/> Registered Suppliers</span><strong>{metrics.registered.toLocaleString("en-NG")}</strong><small>Active and inactive authorised records</small></div>
        <div><span><BadgeCheck size={18}/> Active Suppliers</span><strong>{metrics.active.toLocaleString("en-NG")}</strong><small>Eligible active supplier identities</small></div>
        <div><span><Mail size={18}/> Contact Not Recorded</span><strong>{metrics.missingContact.toLocaleString("en-NG")}</strong><small>Contact email absent; not a delivery-failure count</small></div>
        <div><span><FileWarning size={18}/> Evidence IDs Missing</span><strong>{metrics.missingEvidenceIds.toLocaleString("en-NG")}</strong><small>Reference IDs missing; not proof of compliance failure</small></div>
      </div>

      <div className={styles.content}>
        <section className={styles.directory} aria-labelledby="supplier-dir-title">
          <div className={styles.sectionHead}>
            <div><span className={styles.sectionKicker}>Supplier Network / D1 Directory</span>
              <h3 id="supplier-dir-title">Verified Supplier Identities</h3>
              <p>Search the current authorised farm. No fictional companies or invented balances.</p></div>
            <span className={styles.countPill}>{data.matchedCount.toLocaleString("en-NG")} Matching</span>
          </div>
          <form role="search" className={styles.search} onSubmit={event=>{event.preventDefault();setPage(0);setActiveQuery(query.trim().slice(0,80))}}>
            <Search size={18} aria-hidden="true"/>
            <input aria-label="Search authorised suppliers" placeholder="Search supplier name or code" value={query}
              onChange={event=>setQuery(event.target.value)} maxLength={80}/>
            <button type="submit">Search</button>
          </form>
          {data.items.length?<div className={styles.list}>
            {data.items.map(item=><article className={styles.record} key={item.id}>
              <div className={styles.avatar} aria-hidden="true">{item.name.trim().slice(0,1).toUpperCase()}</div>
              <div className={styles.recordIdentity}>
                <strong>{item.name}</strong>
                <small>Code: {item.code} {item.contactEmail?"· "+item.contactEmail:"· Contact not recorded"}</small>
                <span>{item.evidenceCount} Evidence Reference{item.evidenceCount===1?"":"s"} · Revision {item.revision}</span>
              </div>
              <span className={item.status==="active"?styles.activeTag:styles.inactiveTag}>{item.status}</span>
            </article>)}
          </div>:<div className={styles.empty} role="status">
            <Building2 size={29} aria-hidden="true"/>
            <strong>{activeQuery?"No Matching Authorised Suppliers":"No Verified Suppliers Recorded Yet"}</strong>
            <p>{activeQuery?"Try a different supplier name or code.":"Add an authorised supplier record to begin a genuine sourcing register. No example firms are shown."}</p>
          </div>}
          <div className={styles.paging}>
            <small>Showing up to {data.pageSize} records per page · {data.matchedCount.toLocaleString("en-NG")} matched</small>
            <div>
              <button type="button" onClick={()=>setPage(v=>Math.max(0,v-1))} disabled={data.previousPage===null}>
                <ChevronLeft size={16}/> Previous
              </button>
              <span>Page {data.page+1}</span>
              <button type="button" onClick={()=>setPage(v=>v+1)} disabled={data.nextPage===null}>
                Next <ChevronRight size={16}/>
              </button>
            </div>
          </div>
        </section>

        <aside className={styles.assurance} aria-labelledby="supplier-assurance-title">
          <div className={styles.assuranceHeading}><ClipboardCheck size={23}/><div><span>PROVENANCE & ASSURANCE</span><h3 id="supplier-assurance-title">Source Evidence</h3></div></div>
          <div className={styles.assuranceItem}><BadgeCheck size={19}/><div><strong>Supplier Identity</strong><p>Registered codes and lifecycle states come from authorised D1 records.</p></div></div>
          <div className={styles.assuranceItem}><FileWarning size={19}/><div><strong>Evidence Is Not Approval</strong><p>Evidence IDs are only references. Uploaded document validity and supplier approval require separate workflows.</p></div></div>
          <div className={styles.assuranceItem}><Truck size={19}/><div><strong>Ordering And Receiving</strong><p>Purchase orders and delivery evidence are not yet linked into this dashboard. No spend or fulfilment claims are inferred.</p></div></div>
          <p className={styles.assuranceFoot}>Source: {data.source}. Updated supplier identity is not proof of payment, quality or delivery.</p>
        </aside>
      </div>
    </>:<div className={styles.unavailable} role="status">{source==="loading"?"Loading live supplier records…"
      :source==="restricted"?"Your account is not authorised to view the supplier directory."
      :source==="sign-in"?"Sign in to view the registered suppliers."
      :"The supplier service is unavailable. No sample suppliers or fabricated records are displayed."}</div>}

    {notice&&<p className={styles.notice} role="status">{notice}</p>}
    {canCreate&&showForm&&ready&&<section className={styles.composer} aria-labelledby="supplier-create-title">
      <div className={styles.composerHeader}><div><span className={styles.sectionKicker}>New Supplier / Authorised Record</span>
        <h3 id="supplier-create-title">Register A Source</h3>
        <p>Enter the source information once. The server validates the record and writes a separate audit event.</p></div>
        <button type="button" className={styles.closeButton} onClick={()=>setShowForm(false)} aria-label="Close Register Supplier Form"><X size={19}/></button>
      </div>
      <form className={styles.composerFields} onSubmit={event=>void newSupplier(event)}>
        <label><span>Supplier Code</span><input ref={codeRef} value={value("supplierCode")} onChange={e=>field("supplierCode",e.target.value)}
          maxLength={80} autoComplete="off" required/><small>Unique within the current farm; duplicate codes are rejected by D1.</small></label>
        <label><span>Supplier Name</span><input value={value("name")} onChange={e=>field("name",e.target.value)}
          maxLength={160} autoComplete="organization" required/></label>
        <label><span>Contact Email (Optional)</span><input type="email" value={value("contactEmail")} onChange={e=>field("contactEmail",e.target.value)}
          maxLength={320} autoComplete="email"/></label>
        <label><span>Existing Evidence IDs (Optional)</span><input value={value("evidenceIds")} onChange={e=>field("evidenceIds",e.target.value)}
          maxLength={1200} placeholder="ID-001, ID-002"/><small>Up to 20 existing IDs. This does not upload or approve documents.</small></label>
        <div className={styles.composerActions}>
          <p>New suppliers are recorded as Active. Changes must follow authorised workflow.</p>
          <button type="submit" disabled={saving}><Plus size={16}/> {saving?"Saving Record…":"Save Authorised Supplier"}</button>
        </div>
      </form>
    </section>}
  </div>;
}
