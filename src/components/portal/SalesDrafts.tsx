'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type FormEvent} from 'react';
import {ShoppingCart,ShieldCheck,Plus,RefreshCw} from 'lucide-react';
import {has,permissionCatalog,type Persona} from '@/lib/portal-model';
import {principalToPersona,validatePortalMe,type AuthenticatedPrincipal} from '@/lib/authenticated-principal';
import {authorize} from '@/lib/security-authority';
import {SALES_ENDPOINT,salesPersonaContext,salesInput,salesErrors,salesListing,readSalesIntent,submitSales,reconcileKnownSales,type SalesRecord,salesDraftCustomerMatches,type SalesIntent} from '@/lib/sales-draft-workflow';
import {CUSTOMER_ENDPOINT,customerListing,type CustomerRecord} from '@/lib/customer-workflow';
import LoggedTimestamp from './LoggedTimestamp';
import styles from './SalesDrafts.module.css';

const catalog=new Set(permissionCatalog);
const fields=[['orderCode','Order Code','text',80],['itemCode','Declared Item Code','text',80],['quantity','Quantity','number',40],['currency','Currency Code','text',3],['unitPrice','Unit Price','number',40],['orderedDate','Order Date — Nigeria Time (WAT)','date',10],['orderedTime','Order Time — Nigeria Time (WAT)','time',5],['evidenceIds','Evidence References (Optional)','text',2419]] as const;
const blank={orderCode:'',customerCode:'',customerId:'',itemCode:'',quantity:'',unit:'unit',currency:'',unitPrice:'',orderedDate:'',orderedTime:'',evidenceIds:''};
export default function SalesDrafts({person}:{person:Persona}) {
  // Remount synchronously on detected principal, grant or organization changes.
  return <SalesWorkspace key={salesPersonaContext(person)} person={person}/>;
}
function SalesWorkspace({person}:{person:Persona}) {
  const context=salesPersonaContext(person),live=useRef(true),busy=useRef(false);
  const [values,setValues]=useState<Record<string,string>>(blank),[errors,setErrors]=useState<Record<string,string>>({});
  const [customers,setCustomers]=useState<CustomerRecord[]>([]);
  const [records,setRecords]=useState<SalesRecord[]>([]),[phase,setPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [pending,setPending]=useState(false),[blocked,setBlocked]=useState(false),[trackingFailed,setTrackingFailed]=useState(false);
  const [intent,setIntent]=useState<SalesIntent|null>(null),[notice,setNotice]=useState(''),[open,setOpen]=useState(false);
  const form=useRef<HTMLFormElement>(null),status=useRef<HTMLDivElement>(null);
  const writable=person.principalSource==='authenticated' && person.restriction==='none' && person.farm && has(person,'commercial.edit');
  useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const current=()=>live.current;
  const snapshot=useCallback(async(signal?:AbortSignal):Promise<AuthenticatedPrincipal>=>{
    const response=await fetch('/api/portal/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal});
    if(!response.ok)throw Error('Your current access could not be confirmed. Reload the workspace before creating a draft order.');
    const validated=validatePortalMe(await response.json(),response.headers.get('x-daenem-rbac'),catalog);
    if(!validated.ok || salesPersonaContext(principalToPersona(validated.principal))!==context){
      if(live.current){setBlocked(true);setRecords([]);setCustomers([]);setValues(blank);setOpen(false);}
      throw Error('The account, permissions or company/site changed. Reload the workspace. No create was sent by this check.');
    }
    return validated.principal;
  },[context]);
  const load=useCallback(async(signal?:AbortSignal)=>{
    if(live.current){setPhase('loading');setRecords([]);setCustomers([]);setValues(v=>({...v,customerId:'',customerCode:''}));}
    try {
      const principal=await snapshot(signal);
      try {const saved=readSalesIntent(sessionStorage,principal);if(live.current)setIntent(saved);}catch{if(live.current)setTrackingFailed(true);}
      const response=await fetch(SALES_ENDPOINT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal});
      if(!response.ok)throw Error('Draft Order records are unavailable for your current access.');
      const items=salesListing(await response.json(),principal);
      const refs=await fetch(CUSTOMER_ENDPOINT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal});
      if(!refs.ok)throw Error('Authorized draft order references are unavailable.');
      const choices=customerListing(await refs.json(),principal);
      if(live.current&&!signal?.aborted){setRecords(items);setCustomers(choices);setPhase('ready');}
    } catch(error){if(live.current&&!signal?.aborted){setRecords([]);setPhase('unavailable');setNotice(error instanceof Error?error.message:'Draft Order records are unavailable.');}}
  },[snapshot]);
  useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>c.abort();},[load]);
  useEffect(()=>{if(open)form.current?.querySelector<HTMLInputElement>('input')?.focus();},[open]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy.current || pending || blocked || intent || trackingFailed || !writable)return;
    const data=salesInput(values),invalid=salesErrors(data);if(!values.customerId)invalid.customerId='Select an authorized customer.';setErrors(invalid);
    if(Object.keys(invalid).length){requestAnimationFrame(()=>form.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus());return;}
    busy.current=true;setPending(true);setNotice('Checking current access…');
    let principal:AuthenticatedPrincipal|undefined;
    try {
      principal=await snapshot();if(!current())return;
      const scope=principal.organizationScope;
      if(!scope || !authorize(principal,{channel:'api',action:'create',permission:'commercial.edit',subject:{resourceType:'sales-order',companyKey:scope.companyKey,locationKey:scope.locationKey,departmentKey:scope.departmentKey}}).allowed){setNotice('Draft Order creation is not permitted in your current scope.');setBlocked(true);setValues(blank);setOpen(false);setRecords([]);return;}
      const ref=await fetch(CUSTOMER_ENDPOINT+'/'+encodeURIComponent(values.customerId),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      if(!current())return;
      if(!ref.ok || !salesDraftCustomerMatches(await ref.json(),principal,data)){setValues(v=>({...v,customerId:'',customerCode:''}));setNotice('The selected customer could not be confirmed. Refresh and select an authorized record. No draft create was sent.');return;}
      const result=await submitSales({principal,data,customerId:values.customerId,storage:sessionStorage,fetcher:fetch,isCurrent:current});
      if(!current())return;
      setIntent(readSalesIntent(sessionStorage,principal));
      if(result.kind==='created'){setValues(blank);setOpen(false);setNotice('Draft Order Created. The server confirmed the record and its audit transaction.');await load();}
      else if(result.kind==='validation'){setNotice('The server rejected the draft order fields. Review the entries before explicitly submitting again.');}
      else if(result.kind==='denied' || result.kind==='context-changed'){setBlocked(true);setRecords([]);setCustomers([]);setValues(blank);setOpen(false);setNotice('Access or account context changed. Reload before continuing. This request was rejected before draft order creation.');}
      else {setNotice('Creation Outcome Unconfirmed. Do not submit again. Review the investigation notice below.');}
    } catch(error) {
      if(!current())return;
      if(principal){try{setIntent(readSalesIntent(sessionStorage,principal));}catch{setTrackingFailed(true);}}
      if(error instanceof Error && error.message==='Sales operation tracking is unavailable; no create was sent.')setTrackingFailed(true);
      setNotice(error instanceof Error?error.message:'The operation could not be confirmed. Do not submit again.');
    } finally {busy.current=false;if(current()){setPending(false);requestAnimationFrame(()=>status.current?.focus());}}
  };
  const investigate=async()=>{
    if(busy.current)return;busy.current=true;setPending(true);
    try {const principal=await snapshot();const record=await reconcileKnownSales({principal,storage:sessionStorage,fetcher:fetch,isCurrent:current});if(!current())return;
      setIntent(readSalesIntent(sessionStorage,principal));setNotice(record?'Recorded Draft Order Confirmed by its authoritative record ID. No create was replayed.':'Outcome Still Unconfirmed. An absent or inaccessible record does not prove that the earlier request failed.');if(record)await load();
    }catch{if(current())setNotice('Outcome Still Unconfirmed. Investigation could not establish an authoritative result.');}
    finally{busy.current=false;if(current())setPending(false);}
  };
  return <section className={styles.workspace} aria-label="Draft Sales Orders">
    <header className={styles.hero}><ShoppingCart size={28} aria-hidden="true"/><h2>Draft Sales Orders</h2><p>Prepare a sales-order draft in your authorized company and site. This saves an order record only. It does not submit or approve the order, reserve stock, issue an invoice or post revenue.</p><div className={styles.scope}><span>{person.organizationScope?.companyKey}</span><span>{person.organizationScope?.locationKey}</span><span><ShieldCheck size={16} aria-hidden="true"/> Server-Checked Scope</span></div></header>
    <div ref={status} tabIndex={-1} role="status" aria-live="polite">{notice}</div>
    {blocked && <div className={styles.alert}>Account, authority or reference context must be revalidated. Prior rows and draft values are withheld. <button type="button" onClick={()=>location.reload()}>Reload Workspace</button></div>}
    {trackingFailed && <div className={styles.alert}>Operation tracking is unavailable. Creation is blocked; no automatic retry is allowed.</div>}
    {intent && <div className={styles.alert}><h3>Creation Outcome Unconfirmed</h3><p>Do not submit the draft again. A timeout or matching order code does not prove what happened. Refreshing records cannot identify this request. Keep this tab open for investigation; tracking is tab-local.</p><LoggedTimestamp value={intent.startedAt}/><p>Local Attempt Reference: {intent.attemptId}</p><button type="button" disabled={pending} onClick={()=>void investigate()}>Check Known Record</button><p>A check can confirm only a record ID received from the original response. Without it, an authorized operator needs an operation-specific receipt or other authoritative evidence.</p></div>}
    <div className={styles.layout}><article className={styles.panel}><h3>Authorized Order Register</h3><p>Lifecycle labels are saved record states. Fulfilled does not establish a stock issue, invoice or financial posting.</p><button type="button" disabled={pending||phase==='loading'||blocked} onClick={()=>void load()}><RefreshCw size={18} aria-hidden="true"/>Refresh Records</button>
      {phase==='loading' && <p>Loading Authorized Records…</p>}
      {phase==='unavailable' && <p role="alert">Records or customer references could not be confirmed. No substitute values are shown.</p>}
      {phase==='ready' && records.length===0 && <p>No authorized sales orders were returned.</p>}
      <ul className={styles.list}>{records.map(record=><li className={styles.record} key={record.id}><strong>{record.data.orderCode}</strong><p>{record.state} · Revision {record.revision}</p><p>Customer Code: {record.data.customerCode} · Declared Item: {record.data.itemCode}</p><p>{record.data.quantity} {record.data.unit} · Unit Price: {record.data.currency} {record.data.unitPrice}</p><p>Declared Order Instant</p><LoggedTimestamp value={record.data.orderedAt}/><small>Customer codes are not unique identities. No total or stock availability is inferred.</small></li>)}</ul>
    </article><article className={styles.panel}><h3>Prepare A Draft</h3><p>Creation requires assigned commercial editing authority. Viewing alone does not permit creation. No approval or posting action is available here.</p>
      {!writable && <p>View-Only Access — Customer or Sales role labels do not grant creation.</p>}
      {writable && <><button type="button" disabled={pending||blocked||trackingFailed||Boolean(intent)||phase!=='ready'||!customers.length} onClick={()=>setOpen(true)}><Plus size={18} aria-hidden="true"/>New Draft Order</button>{phase==='ready'&&!customers.length&&<p>No authorized customer is available. Register a customer through the separately authorized Customer Records workspace.</p>}
      {open && <form ref={form} aria-label="Create Draft Sales Order" noValidate onSubmit={submit}><fieldset disabled={pending||blocked||trackingFailed||Boolean(intent)||phase!=='ready'} style={{border:0,padding:0,minWidth:0}}><legend>Required Entries</legend><div className={styles.fields}>
        <label className={styles.field}>Customer (Required)<select name="customerId" value={values.customerId} required aria-invalid={Boolean(errors.customerId)} aria-describedby={errors.customerId?'sales-customer-error':undefined} onChange={e=>{const ref=customers.find(v=>v.id===e.target.value);setValues(v=>({...v,customerId:ref?.id||'',customerCode:ref?.data.customerCode||''}));}}><option value="">Select An Authorized Customer</option>{customers.map(v=><option value={v.id} key={v.id}>{v.data.name} · {v.data.customerCode} · {v.data.status} · {v.id}</option>)}</select>{errors.customerId&&<span className={styles.error} id="sales-customer-error">{errors.customerId}</span>}</label>
        {fields.map(([key,label,type,max])=><label className={styles.field} key={key}>{label}{key!=='evidenceIds'?' (Required)':''}<input name={key} type={type} maxLength={max} step={type==='number'?'any':undefined} value={values[key]||''} required={key!=='evidenceIds'} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?'sales-error-'+key:undefined} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/>{errors[key]&&<span className={styles.error} id={'sales-error-'+key}>{errors[key]}</span>}</label>)}
        <label className={styles.field}>Unit (Required)<select name="unit" value={values.unit} required onChange={e=>setValues(v=>({...v,unit:e.target.value}))}>{['unit','kg','bag','ton','litre'].map(unit=><option key={unit}>{unit}</option>)}</select></label></div>
        <p><small>The server rechecks the selected customer before creating this draft. The saved schema retains its code, not its UUID or a durable relationship. Customer changes after that check remain possible. Item codes are declarations, not verified inventory references.</small></p>
        <p><small>Enter the order date and time in Nigeria Time (WAT). Unit price follows the existing currency precision rules; zero is allowed. No tax, discount, exchange rate or total is calculated. Evidence references: up to 20 comma-separated IDs; no upload or evidence verification.</small></p>
        {errors.form&&<p className={styles.error}>{errors.form}</p>}
        <div className={styles.actions}><button type="submit">{pending?'Submitting Once…':'Create Draft Order'}</button><button type="button" onClick={()=>setOpen(false)}>Close Form</button></div>
      </fieldset></form>}</>}
    </article></div>
  </section>;
}
