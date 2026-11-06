import { authorize, type AuthorizationSubject } from './security-authority.ts';
import type { AuthenticatedPrincipal } from './authenticated-principal.ts';
import { COMMERCIAL_FINANCE_DEFINITIONS, type SalesOrderData } from './commercial-finance-core.ts';
import {customerPersonaContext,customerRequestContext,customerRecord,type CustomerRecord,type IntentStorage as CustomerStorage} from './customer-workflow.ts';

export const SALES_ENDPOINT = '/api/portal/v7/commercial-finance/sales-order';
export const SALES_CONTEXT_HEADER = 'x-daenem-sales-context';
export const SALES_CUSTOMER_HEADER='x-daenem-sales-customer';
export const salesPersonaContext=customerPersonaContext;
export const salesRequestContext=customerRequestContext;
async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function salesInput(values: Record<string,string>): SalesOrderData {
 return {kind:'sales-order',orderCode:(values.orderCode||'').trim(),customerCode:(values.customerCode||'').trim(),itemCode:(values.itemCode||'').trim(),quantity:Number(values.quantity||NaN),unit:values.unit as SalesOrderData['unit'],currency:(values.currency||'').trim(),unitPrice:values.unitPrice?.trim()?Number(values.unitPrice):NaN,orderedAt:values.orderedDate && values.orderedTime ? values.orderedDate+'T'+values.orderedTime+':00+01:00':'',...(values.evidenceIds?.trim()?{evidenceIds:values.evidenceIds.split(',').map(v=>v.trim())}:{})};
}
export function salesErrors(data: SalesOrderData): Record<string,string> {
 const map:Record<string,string>={'order code':'orderCode','customer code':'customerId','item code':'itemCode','quantity':'quantity','unit price':'unitPrice','unit':'unit','currency':'currency','order date':'orderedDate','evidence ids':'evidenceIds'};
 return Object.fromEntries(COMMERCIAL_FINANCE_DEFINITIONS['sales-order'].validate(data).map(message=>[Object.entries(map).find(([prefix])=>message.startsWith(prefix))?.[1]||'form',message]));
}
function object(value: unknown): value is Record<string,unknown> {return Boolean(value && typeof value==='object' && !Array.isArray(value));}
export type SalesRecord = {id:string;resourceType:'sales-order';state:string;revision:number;createdBy:string|null;subject:AuthorizationSubject;data:SalesOrderData};
export function salesRecord(value: unknown, scope: AuthenticatedPrincipal['organizationScope'], exactDepartment = true): value is SalesRecord {
  if(!object(value) || typeof value.id!=='string' || !value.id || value.resourceType!=='sales-order' ||
    !['draft','submitted','approved','rejected','fulfilled','cancelled'].includes(String(value.state)) || !Number.isInteger(value.revision) || Number(value.revision)<1 ||
    !object(value.subject) || !object(value.data) || !scope) return false;
  for(const key of ['resourceId','ownerId','companyKey','locationKey','departmentKey'])if(value.subject[key]!==undefined && typeof value.subject[key]!=='string')return false;
  if(value.subject.assigneeIds!==undefined && (!Array.isArray(value.subject.assigneeIds)||!value.subject.assigneeIds.every(v=>typeof v==='string')))return false;
  const d=value.data;
  if(d.kind!=='sales-order' || !['orderCode','customerCode','itemCode','unit','currency','orderedAt'].every(k=>typeof d[k]==='string') || typeof d.quantity!=='number' || typeof d.unitPrice!=='number' || (d.evidenceIds!==undefined && (!Array.isArray(d.evidenceIds)||!d.evidenceIds.every(v=>typeof v==='string'))))return false;
  return !Object.keys(salesErrors(d as SalesOrderData)).length && value.subject.resourceType==='sales-order' && (value.subject.resourceId===value.id || (!exactDepartment && value.subject.resourceId===undefined)) &&
    value.subject.companyKey===scope.companyKey && value.subject.locationKey===scope.locationKey && (!exactDepartment || value.subject.departmentKey===scope.departmentKey);
}
export function salesListing(value: unknown, principal: AuthenticatedPrincipal): SalesRecord[] {
  if(!object(value) || !Array.isArray(value.items) || !['available','no-data'].includes(String(value.state)) ||
    value.nextCursor!==null || !value.items.every(item=>salesRecord(item,principal.organizationScope,false) && authorize(principal,{channel:'api',action:'view',permission:'commercial.view',subject:item.subject}).allowed)) throw Error('Sales records could not be confirmed for this scope.');
  return value.items;
}
function intentKey(principal: AuthenticatedPrincipal) {return 'farmportal.sales.intent.v1:'+JSON.stringify([principal.id,principal.organizationScope?.companyKey,principal.organizationScope?.locationKey,principal.organizationScope?.departmentKey]);}
export type SalesIntent = {attemptId:string;startedAt:string;fingerprint:string;recordId?:string};
export type IntentStorage = CustomerStorage;
export function readSalesIntent(storage: IntentStorage, principal: AuthenticatedPrincipal): SalesIntent|null {
  const raw=storage.getItem(intentKey(principal));if(raw===null)return null;
  const v:unknown=JSON.parse(raw);
  if(!object(v) || typeof v.attemptId!=='string' || typeof v.startedAt!=='string' || typeof v.fingerprint!=='string' ||
    (v.recordId!==undefined && typeof v.recordId!=='string'))throw Error('Operation tracking needs investigation.');
  return v as SalesIntent;
}
function canonicalData(data: SalesOrderData) {return JSON.stringify([data.orderCode,data.customerCode,data.itemCode,data.quantity,data.unit,data.currency,data.unitPrice,data.orderedAt,data.evidenceIds??null]);}
export type CreateResult = {kind:'created';record:SalesRecord}|{kind:'validation'}|{kind:'denied'}|{kind:'context-changed'}|{kind:'uncertain'};
export async function submitSales(options: {principal:AuthenticatedPrincipal;data:SalesOrderData;customerId:string;storage:IntentStorage;fetcher:typeof fetch;isCurrent:()=>boolean;timeoutMs?:number}): Promise<CreateResult> {
  const {principal,data,storage,fetcher,isCurrent}=options;
  if(!options.customerId || Object.keys(salesErrors(data)).length)return {kind:'validation'};
  if(readSalesIntent(storage,principal))return {kind:'uncertain'};
  const intent:SalesIntent={attemptId:crypto.randomUUID(),startedAt:new Date().toISOString(),fingerprint:await digest(canonicalData(data))};
  const context=await salesRequestContext(principal);
  if(!isCurrent())return {kind:'context-changed'};
  if(readSalesIntent(storage,principal))return {kind:'uncertain'};
  // Persist before issuing the request. An interrupted tab never silently retries.
  try {storage.setItem(intentKey(principal),JSON.stringify(intent));} catch {throw Error('Sales operation tracking is unavailable; no create was sent.');}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),options.timeoutMs??30000);
  try {
    const response=await fetcher(SALES_ENDPOINT,{method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'content-type':'application/json',accept:'application/json',[SALES_CONTEXT_HEADER]:context,[SALES_CUSTOMER_HEADER]:options.customerId},body:JSON.stringify({data}),signal:controller.signal});
    const body:unknown=await response.json();
    if(response.status===201 && salesRecord(body,principal.organizationScope) && body.state==='draft' && body.createdBy===principal.id &&
      await digest(canonicalData(body.data))===intent.fingerprint){
      if(!isCurrent()){storage.setItem(intentKey(principal),JSON.stringify({...intent,recordId:body.id}));return {kind:'uncertain'};}
      storage.removeItem(intentKey(principal));return {kind:'created',record:body};
    }
    // These source-established responses precede sales insertion. Other failures
    // can follow a committed D1 batch and remain ambiguous, including HTTP 503.
    let rejection:CreateResult|null=null;
    if(object(body) && response.status===422 && body.error==='VALIDATION_FAILED') rejection={kind:'validation'};
    if(object(body) && response.status===404 && body.error==='NOT_FOUND') rejection={kind:'denied'};
    if(object(body) && response.status===409 && ['SALES_CONTEXT_CHANGED','SALES_REFERENCE_CHANGED'].includes(String(body.error))) rejection={kind:'context-changed'};
    if(rejection && isCurrent()){storage.removeItem(intentKey(principal));return rejection;}
    return {kind:'uncertain'};
  } catch {return {kind:'uncertain'};} finally {clearTimeout(timer);}
}
export async function reconcileKnownSales(options:{principal:AuthenticatedPrincipal;storage:IntentStorage;fetcher:typeof fetch;isCurrent:()=>boolean}):Promise<SalesRecord|null> {
  const {principal,storage,fetcher,isCurrent}=options;const intent=readSalesIntent(storage,principal);
  if(!intent?.recordId)return null;
  const response=await fetcher(SALES_ENDPOINT+'/'+encodeURIComponent(intent.recordId),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok)return null;
  const body:unknown=await response.json();
  if(!isCurrent() || !salesRecord(body,principal.organizationScope) || body.id!==intent.recordId || body.createdBy!==principal.id || await digest(canonicalData(body.data))!==intent.fingerprint)return null;
  storage.removeItem(intentKey(principal));return body;
}
// Lookup proof for this draft only: the persisted schema retains a code, not a customer UUID.
export function salesDraftCustomerMatches(value:unknown,principal:AuthenticatedPrincipal,data:SalesOrderData):value is CustomerRecord {
 return customerRecord(value,principal.organizationScope,false) && value.data.customerCode===data.customerCode && authorize(principal,{channel:'api',action:'view',permission:'commercial.view',subject:value.subject}).allowed;
}
