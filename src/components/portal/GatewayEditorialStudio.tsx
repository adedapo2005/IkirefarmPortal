"use client";
import {useCallback,useEffect,useState} from "react";
import styles from "./gateway-editorial-studio.module.css";

type Kind="spotlight"|"inspiration";
type Status="draft"|"published"|"archived";
type Item={id:string;kind:Kind;status:Status;revision:number;title:string|null;
 body:string|null;message:string|null;attribution:string|null;theme:string|null;
 published_at:string|null;updated_at:string};
type Form={kind:Kind;title:string;body:string;message:string;attribution:string;theme:string};
const fresh=(kind:Kind="spotlight"):Form=>({kind,title:"",body:"",message:"",attribution:"DAENEM Farms",theme:""});
const api=async(body?:unknown):Promise<{items?:Item[];id?:string;revision?:number;status?:Status}>=>{
 const response=await fetch("/api/gateway/editorial",{
   method:body===undefined?"GET":"POST",
   credentials:"same-origin",
   cache:"no-store",
   headers:body===undefined?{accept:"application/json"}:{accept:"application/json","content-type":"application/json"},
   body:body===undefined?undefined:JSON.stringify(body),
 });
 const data=await response.json().catch(()=>({})) as Record<string,unknown>;
 if(!response.ok){
   if(response.status===409)throw Error("This item changed in another session. Refresh before retrying.");
   if(response.status===404||response.status===401)throw Error("Verified FarmPortal Owner access is required.");
   if(response.status===503)throw Error("Editorial storage is unavailable. No changes were saved.");
   throw Error(typeof data.error==="string"?data.error:"Could not complete the request.");
 }
 return data as {items?:Item[];id?:string;revision?:number;status?:Status};
};
export default function GatewayEditorialStudio(){
 const [items,setItems]=useState<Item[]>([]);
 const [form,setForm]=useState<Form>(fresh());
 const [selected,setSelected]=useState<Item|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [approved,setApproved]=useState(false);
 const update=useCallback(async()=>{
   const data=await api();
   setItems(data.items||[]);
 },[]);
 useEffect(()=>{let active=true;api().then(d=>{if(active)setItems(d.items||[])})
 .catch(e=>{if(active)setError(e.message)})
 .finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 const choose=(item:Item)=>{
   setSelected(item);setApproved(false);setError("");setNotice("");
   setForm({kind:item.kind,title:item.title||"",body:item.body||"",
    message:item.message||"",attribution:item.attribution||"",theme:item.theme||""});
 };
 const reset=()=>{setSelected(null);setForm(fresh());setApproved(false);setError("");setNotice("")};
 const action=async(name:"create"|"revise"|"publish"|"archive")=>{
   if(busy)return;
   if(name==="publish"&&!approved){setError("Check the Owner approval box before publishing.");return}
   if(name!=="create"&&!selected){setError("Choose a saved draft first.");return}
   setBusy(true);setError("");setNotice("");
   try{
     const body=name==="create"?{action:"create",data:form}
       :name==="revise"?{action:"revise",id:selected?.id,expectedRevision:selected?.revision,data:form}
       :{action:name,id:selected?.id,expectedRevision:selected?.revision};
     const result=await api(body);
     await update();
     if(name==="create"||name==="revise"){
       setNotice(name==="create"?"Draft saved; not yet public.":"Draft updated; not yet public.");
       if(result.id){const data=await api();const found=(data.items||[]).find(x=>x.id===result.id);if(found){choose(found);setNotice(name==="create"?"Draft saved; not yet public.":"Draft updated; not yet public.");}}
     }else{
       reset();
       setNotice(name==="publish"?"Owner-approved message published.":"Message archived and removed from public rotation.");
     }
   }catch(e){setError(e instanceof Error?e.message:"Operation failed. No success confirmed.")}
   finally{setBusy(false);setApproved(false)}
 };
 const draft=selected?.status==="draft";
 const hasUnsavedEdits=Boolean(draft&&selected&&(
   form.title!==(selected.title||"")||form.body!==(selected.body||"")||
   form.message!==(selected.message||"")||form.attribution!==(selected.attribution||"")||
   form.theme!==(selected.theme||"")));

 return <section className={styles.shell} aria-label="DAENEM Farms Gateway editorial management">
   <header className={styles.head}>
     <div><span className={styles.eyebrow}>Owner-controlled Sign-In content</span>
       <h1>Daily Spotlight & Employee Inspiration</h1>
       <p>Compose messages for the four-photo Sign-In gateway. Content stays private until you explicitly publish it.</p>
     </div><button type="button" className={styles.secondary} onClick={()=>{reset();void update().catch(e=>setError(e.message))}} disabled={busy}>New draft / Refresh</button>
   </header>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
   {notice&&<p role="status" className={styles.notice}>{notice}</p>}
   <div className={styles.grid}>
    <div className={styles.panel}>
     <h2>{selected?"Edit saved item":"Create a draft"}</h2>
     {selected&&<p className={styles.details}>Status: {selected.status} · Revision {selected.revision}</p>}
     <label className={styles.label}>Widget
       <select disabled={busy||Boolean(selected)} value={form.kind}
         onChange={e=>setForm(fresh(e.target.value as Kind))}>
         <option value="spotlight">Daily Spotlight</option>
         <option value="inspiration">Employee Inspiration</option>
       </select></label>
     {form.kind==="spotlight"?<>
       <label className={styles.label}>Headline<input maxLength={250} value={form.title} disabled={busy||Boolean(selected&& !draft)}
         onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="Owner-approved headline"/></label>
       <label className={styles.label}>Supporting text<textarea maxLength={1000} rows={4} value={form.body} disabled={busy||Boolean(selected&& !draft)}
         onChange={e=>setForm(v=>({...v,body:e.target.value}))} /></label>
     </>:<>
       <label className={styles.label}>Message<textarea maxLength={450} rows={4} value={form.message} disabled={busy||Boolean(selected&&!draft)}
         onChange={e=>setForm(v=>({...v,message:e.target.value}))} placeholder="A meaningful message for the farm team"/></label>
       <label className={styles.label}>Attribution<input maxLength={140} value={form.attribution} disabled={busy||Boolean(selected&&!draft)}
         onChange={e=>setForm(v=>({...v,attribution:e.target.value}))}/></label>
       <label className={styles.label}>Theme<input maxLength={120} value={form.theme} disabled={busy||Boolean(selected&&!draft)}
         onChange={e=>setForm(v=>({...v,theme:e.target.value}))} placeholder="Safety, growth, teamwork…"/></label>
     </>}
     <div className={styles.preview}><strong>Text preview</strong>
      <p>{form.kind==="spotlight"?form.title||"Headline preview":form.message||"Message preview"}</p>
      <small>{form.kind==="spotlight"?form.body:form.attribution}</small></div>
     {(!selected||draft)&&<button type="button" className={styles.primary} disabled={busy}
       onClick={()=>void action(selected?"revise":"create")}>{busy?"Saving…":selected?"Save revised draft":"Save new draft"}</button>}
     {draft&&<div className={styles.publish}>
       {hasUnsavedEdits&&<p role="status" className={styles.details}>Save your latest edits before publishing. Only the saved revision can be approved.</p>}
       <label><input type="checkbox" checked={approved} disabled={busy}
         onChange={e=>setApproved(e.target.checked)}/> I am the Owner and approve publishing this content to Sign-In.</label>
       <button type="button" className={styles.gold} disabled={busy||!approved||hasUnsavedEdits} onClick={()=>void action("publish")}>Publish approved draft</button>
     </div>}
     {selected&&selected.status!=="archived"&&<button type="button" className={styles.danger} disabled={busy}
       onClick={()=>void action("archive")}>Archive this item</button>}
    </div>
    <div className={styles.panel}>
     <h2>Saved content</h2>
     <p className={styles.details}>Published items appear publicly; drafts and archived messages do not.</p>
     {loading?<p>Loading approved content records…</p>:items.length===0?<p>No content has been saved yet.</p>:
       <div className={styles.list}>{items.map(item=><button key={item.id} type="button"
         className={selected?.id===item.id?styles.selected:styles.item} onClick={()=>choose(item)}>
         <span><strong>{item.kind==="spotlight"?"Daily Spotlight":"Employee Inspiration"}</strong>
           <small>{item.title||item.message||"Untitled"}</small></span>
         <em>{item.status} · r{item.revision}</em>
       </button>)}</div>}
    </div>
   </div>
 </section>;
}
