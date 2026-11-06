'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type FormEvent} from 'react';
import {UsersRound,ShieldCheck,Plus,RefreshCw} from 'lucide-react';
import {has,permissionCatalog,type Persona} from '@/lib/portal-model';
import {principalToPersona,validatePortalMe,type AuthenticatedPrincipal} from '@/lib/authenticated-principal';
import {authorize} from '@/lib/security-authority';
import {CUSTOMER_ENDPOINT,customerPersonaContext,customerInput,customerErrors,customerListing,readCustomerIntent,submitCustomer,reconcileKnownCustomer,type CustomerRecord,type CustomerIntent} from '@/lib/customer-workflow';
import LoggedTimestamp from './LoggedTimestamp';
import styles from './CustomerRecords.module.css';

const catalog=new Set(permissionCatalog);
const fields=[['customerCode','Customer Code',80,true],['name','Customer Name',160,true],['contactEmail','Contact Email',320,false],['phone','Phone',80,false],['evidenceIds','Evidence References',2419,false]] as const;
const blank={customerCode:'',name:'',status:'active',contactEmail:'',phone:'',evidenceIds:''};
export default function CustomerRecords({person}:{person:Persona}) {
  // Remount synchronously on detected principal, grant or organization changes.
  return <CustomerWorkspace key={customerPersonaContext(person)} person={person}/>;
}
function CustomerWorkspace({person}:{person:Persona}) {
  const context=customerPersonaContext(person),live=useRef(true),busy=useRef(false);
  const [values,setValues]=useState<Record<string,string>>(blank),[errors,setErrors]=useState<Record<string,string>>({});
  const [records,setRecords]=useState<CustomerRecord[]>([]),[phase,setPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [pending,setPending]=useState(false),[blocked,setBlocked]=useState(false),[trackingFailed,setTrackingFailed]=useState(false);
  const [intent,setIntent]=useState<CustomerIntent|null>(null),[notice,setNotice]=useState(''),[open,setOpen]=useState(false);
  const form=useRef<HTMLFormElement>(null),status=useRef<HTMLDivElement>(null);
  const writable=person.principalSource==='authenticated' && person.restriction==='none' && person.farm && has(person,'commercial.edit');
  useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const current=()=>live.current;
  const snapshot=useCallback(async(signal?:AbortSignal):Promise<AuthenticatedPrincipal>=>{
    const response=await fetch('/api/portal/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal});
    if(!response.ok)throw Error('Your current access could not be confirmed. Reload the workspace before creating a customer.');
    const validated=validatePortalMe(await response.json(),response.headers.get('x-daenem-rbac'),catalog);
    if(!validated.ok || customerPersonaContext(principalToPersona(validated.principal))!==context){
      if(live.current){setBlocked(true);setRecords([]);setValues(blank);setOpen(false);}
      throw Error('The account, permissions or company/site changed. Reload the workspace. No create was sent by this check.');
    }
    return validated.principal;
  },[context]);
  const load=useCallback(async(signal?:AbortSignal)=>{
    if(live.current){setPhase('loading');setRecords([]);}
    try {
      const principal=await snapshot(signal);
      try {const saved=readCustomerIntent(sessionStorage,principal);if(live.current)setIntent(saved);}catch{if(live.current)setTrackingFailed(true);}
      const response=await fetch(CUSTOMER_ENDPOINT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal});
      if(!response.ok)throw Error('Customer records are unavailable for your current access.');
      const items=customerListing(await response.json(),principal);
      if(live.current&&!signal?.aborted){setRecords(items);setPhase('ready');}
    } catch(error){if(live.current&&!signal?.aborted){setRecords([]);setPhase('unavailable');setNotice(error instanceof Error?error.message:'Customer records are unavailable.');}}
  },[snapshot]);
  useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>c.abort();},[load]);
  useEffect(()=>{if(open)form.current?.querySelector<HTMLInputElement>('input')?.focus();},[open]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy.current || pending || blocked || intent || trackingFailed || !writable)return;
    const data=customerInput(values),invalid=customerErrors(data);setErrors(invalid);
    if(Object.keys(invalid).length){requestAnimationFrame(()=>form.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus());return;}
    busy.current=true;setPending(true);setNotice('Checking current access…');
    let principal:AuthenticatedPrincipal|undefined;
    try {
      principal=await snapshot();if(!current())return;
      const scope=principal.organizationScope;
      if(!scope || !authorize(principal,{channel:'api',action:'create',permission:'commercial.edit',subject:{resourceType:'customer',companyKey:scope.companyKey,locationKey:scope.locationKey,departmentKey:scope.departmentKey}}).allowed){setNotice('Customer creation is not permitted in your current scope.');setBlocked(true);setValues(blank);setOpen(false);setRecords([]);return;}
      const result=await submitCustomer({principal,data,storage:sessionStorage,fetcher:fetch,isCurrent:current});
      if(!current())return;
      setIntent(readCustomerIntent(sessionStorage,principal));
      if(result.kind==='created'){setValues(blank);setOpen(false);setNotice('Customer Created. The server confirmed the record and its audit transaction.');await load();}
      else if(result.kind==='validation'){setNotice('The server rejected the customer fields. Review the entries before explicitly submitting again.');}
      else if(result.kind==='denied' || result.kind==='context-changed'){setBlocked(true);setRecords([]);setValues(blank);setOpen(false);setNotice('Access or account context changed. Reload before continuing. This request was rejected before customer creation.');}
      else {setNotice('Creation Outcome Unconfirmed. Do not submit again. Review the investigation notice below.');}
    } catch(error) {
      if(!current())return;
      if(principal){try{setIntent(readCustomerIntent(sessionStorage,principal));}catch{setTrackingFailed(true);}}
      if(error instanceof Error && error.message==='Customer operation tracking is unavailable; no create was sent.')setTrackingFailed(true);
      setNotice(error instanceof Error?error.message:'The operation could not be confirmed. Do not submit again.');
    } finally {busy.current=false;if(current()){setPending(false);requestAnimationFrame(()=>status.current?.focus());}}
  };
  const investigate=async()=>{
    if(busy.current)return;busy.current=true;setPending(true);
    try {const principal=await snapshot();const record=await reconcileKnownCustomer({principal,storage:sessionStorage,fetcher:fetch,isCurrent:current});if(!current())return;
      setIntent(readCustomerIntent(sessionStorage,principal));setNotice(record?'Recorded Customer Confirmed by its authoritative record ID. No create was replayed.':'Outcome Still Unconfirmed. An absent or inaccessible record does not prove that the earlier request failed.');if(record)await load();
    }catch{if(current())setNotice('Outcome Still Unconfirmed. Investigation could not establish an authoritative result.');}
    finally{busy.current=false;if(current())setPending(false);}
  };
  return <section className={styles.workspace} aria-label="Customer Records Workspace">
    <header className={styles.hero}><UsersRound aria-hidden="true"/><h2>Customer Records</h2><p>Register a customer in your authorized company and site. Required fields are marked *. Creating a record does not send a message or create a sale.</p><div className={styles.scope}><span>{person.organizationScope?.companyLabel || 'Authorized Company'}</span><span>{person.organizationScope?.locationLabel || 'Authorized Site'}</span></div></header>
    <div ref={status} tabIndex={-1} role="status" aria-live="polite">{notice}</div>
    {(intent||trackingFailed)&&<aside className={styles.alert} role="region" aria-label="Customer Creation Investigation"><h3>Creation Outcome Unconfirmed</h3><p>This tab has an unresolved customer operation or could not read its operation tracker. No automatic retry will occur. Customer codes are not guaranteed unique and a matching row cannot identify an earlier request.</p>{intent&&<><p>Attempt Recorded</p><LoggedTimestamp value={intent.startedAt}/></>}<p>Retain the attempt details privately and ask an authorized operator to investigate the request and audit outcome. Refreshing the authorized list is read-only; absence is not proof of failure. New creates in this tab and scope remain blocked. This is a browser safeguard, not a fence on other writers.</p>{intent?.recordId&&<button type="button" disabled={pending||blocked} onClick={()=>void investigate()}>Check Recorded Customer</button>}</aside>}
    {blocked&&<div className={styles.alert}><p>Current account or scope needs revalidation. Draft values and prior records have been withheld.</p><button type="button" onClick={()=>window.location.reload()}>Reload Workspace</button></div>}
    <div className={styles.layout}><article className={styles.panel}><h3><ShieldCheck size={20} aria-hidden="true"/> Authorized Customer Register</h3><p>{blocked?'Records are withheld until your current access is revalidated.':phase==='loading'?'Loading current authorized records…':phase==='unavailable'?'Records unavailable. No data has been invented.':records.length?'Only records returned for your authorized scope are shown.':'No authorized customers were returned.'}</p><div className={styles.actions}><button type="button" disabled={pending||phase==='loading'||blocked} onClick={()=>void load()}><RefreshCw size={16} aria-hidden="true"/> Refresh Authorized List</button></div><ul className={styles.list}>{records.map(record=><li className={styles.record} key={record.id}><strong>{record.data.name}</strong><p>{record.data.customerCode}</p><small>{record.data.status==='active'?'Active':'Inactive'} · Record Revision {record.revision}</small></li>)}</ul></article>
    <article className={styles.panel}><h3>Register A Customer</h3>{!writable?<p>View-Only Access. Customer creation requires the separately assigned commercial editing capability and an eligible company/site scope.</p>:<><p>Customer Code, Customer Name and Status are required. Codes are business references, not unique request receipts. Check existing records before registering a customer.</p>{!open?<button type="button" disabled={pending||blocked||Boolean(intent)||trackingFailed||phase!=='ready'} onClick={()=>setOpen(true)}><Plus size={16} aria-hidden="true"/> New Customer</button>:<form ref={form} id="customer-record-form" noValidate onSubmit={event=>void submit(event)} aria-busy={pending}><fieldset disabled={pending||blocked||Boolean(intent)||trackingFailed} style={{border:0,padding:0,margin:0}}><div className={styles.fields}>{fields.map(([key,label,max,required])=><label key={key} className={styles.field}>{label}{required?' *':' (Optional)'}<input name={key} value={values[key]||''} maxLength={max} required={required} inputMode={key==='contactEmail'?'email':key==='phone'?'tel':undefined} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?'customer-error-'+key:undefined} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/>{errors[key]&&<small className={styles.error} id={'customer-error-'+key}>{errors[key]}</small>}</label>)}<label className={styles.field}>Status *<select name="status" required value={values.status} onChange={e=>setValues(v=>({...v,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><p><small>Evidence references are optional existing IDs, separated by commas: up to 20, each up to 120 characters. No file upload or evidence verification occurs here.</small></p><div className={styles.actions}><button type="submit">{pending?'Submitting Once…':'Create Customer'}</button><button type="button" onClick={()=>setOpen(false)}>Close Form</button></div></fieldset></form>}</>}</article></div>
  </section>;
}
