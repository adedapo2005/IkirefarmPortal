import { authorize, type AuthorizationSubject } from './security-authority.ts';
import type { AuthenticatedPrincipal } from './authenticated-principal.ts';
import type { Persona } from './portal-model.ts';
import type { CustomerData } from './commercial-finance-core.ts';

export const CUSTOMER_ENDPOINT = '/api/portal/v7/commercial-finance/customer';
export const CUSTOMER_CONTEXT_HEADER = 'x-daenem-customer-context';
const sorted = (value: object) => Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
export function customerPersonaContext(person: Persona) {
  return JSON.stringify([person.authenticatedAccountId || person.id, person.principalSource,
    person.accessState, person.restriction, person.farm, sorted(person.organizationScope || {}),
    [...person.permissions].sort(), sorted(person.permissionScopes || {})]);
}
export async function customerRequestContext(principal: AuthenticatedPrincipal) {
  return digest(JSON.stringify([principal.id, principal.securityStamp, sorted(principal.organizationScope || {}),
    [...principal.permissions].sort(), sorted(principal.permissionScopeSets || principal.permissionScopes)]));
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function customerInput(values: Record<string, string>): CustomerData {
  return {kind:'customer',customerCode:(values.customerCode || '').trim(),name:(values.name || '').trim(),
    status:values.status as CustomerData['status'],
    ...(values.contactEmail?.trim()?{contactEmail:values.contactEmail.trim()}:{}),
    ...(values.phone?.trim()?{phone:values.phone.trim()}:{}),
    ...(values.evidenceIds?.trim()?{evidenceIds:values.evidenceIds.split(',').map(v=>v.trim())}:{}),
  };
}
export function customerErrors(data: CustomerData): Record<string,string> {
  const errors: Record<string,string> = {};
  if(!data.customerCode.trim() || data.customerCode.length>80) errors.customerCode='Enter a customer code of 1–80 characters.';
  if(!data.name.trim() || data.name.length>160) errors.name='Enter a customer name of 1–160 characters.';
  if(!['active','inactive'].includes(data.status)) errors.status='Select Active or Inactive.';
  if(data.contactEmail!==undefined && (!data.contactEmail.trim() || data.contactEmail.length>320 || !data.contactEmail.includes('@'))) errors.contactEmail='Enter a contact email containing @, up to 320 characters, or leave it blank.';
  if(data.phone!==undefined && (!data.phone.trim() || data.phone.length>80)) errors.phone='Enter a phone value up to 80 characters, or leave it blank.';
  if(data.evidenceIds && (data.evidenceIds.length>20 || data.evidenceIds.some(v=>!v.trim() || v.length>120))) errors.evidenceIds='Use up to 20 non-empty evidence references, each up to 120 characters.';
  return errors;
}
function object(value: unknown): value is Record<string,unknown> {return Boolean(value && typeof value==='object' && !Array.isArray(value));}
export type CustomerRecord = {id:string;resourceType:'customer';state:string;revision:number;createdBy:string|null;subject:AuthorizationSubject;data:CustomerData};
export function customerRecord(value: unknown, scope: AuthenticatedPrincipal['organizationScope'], exactDepartment = true): value is CustomerRecord {
  if(!object(value) || typeof value.id!=='string' || !value.id || value.resourceType!=='customer' ||
    !['active','inactive'].includes(String(value.state)) || !Number.isInteger(value.revision) || Number(value.revision)<1 ||
    !object(value.subject) || !object(value.data) || !scope) return false;
  for(const key of ['resourceId','ownerId','companyKey','locationKey','departmentKey'])if(value.subject[key]!==undefined && typeof value.subject[key]!=='string')return false;
  if(value.subject.assigneeIds!==undefined && (!Array.isArray(value.subject.assigneeIds)||!value.subject.assigneeIds.every(v=>typeof v==='string')))return false;
  const d=value.data;
  if(d.kind!=='customer' || typeof d.customerCode!=='string' || typeof d.name!=='string' ||
    !['active','inactive'].includes(String(d.status)) || (d.contactEmail!==undefined && typeof d.contactEmail!=='string') ||
    (d.phone!==undefined && typeof d.phone!=='string') || (d.evidenceIds!==undefined && (!Array.isArray(d.evidenceIds) || !d.evidenceIds.every(v=>typeof v==='string'))))return false;
  return !Object.keys(customerErrors(d as CustomerData)).length && value.subject.resourceType==='customer' && (value.subject.resourceId===value.id || (!exactDepartment && value.subject.resourceId===undefined)) &&
    value.subject.companyKey===scope.companyKey && value.subject.locationKey===scope.locationKey && (!exactDepartment || value.subject.departmentKey===scope.departmentKey);
}
export function customerListing(value: unknown, principal: AuthenticatedPrincipal): CustomerRecord[] {
  if(!object(value) || !Array.isArray(value.items) || !['available','no-data'].includes(String(value.state)) ||
    value.nextCursor!==null || !value.items.every(item=>customerRecord(item,principal.organizationScope,false) && authorize(principal,{channel:'api',action:'view',permission:'commercial.view',subject:item.subject}).allowed)) throw Error('Customer records could not be confirmed for this scope.');
  return value.items;
}
function intentKey(principal: AuthenticatedPrincipal) {return 'farmportal.customer.intent.v1:'+JSON.stringify([principal.id,principal.organizationScope?.companyKey,principal.organizationScope?.locationKey,principal.organizationScope?.departmentKey]);}
export type CustomerIntent = {attemptId:string;startedAt:string;fingerprint:string;recordId?:string};
export type IntentStorage = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function readCustomerIntent(storage: IntentStorage, principal: AuthenticatedPrincipal): CustomerIntent|null {
  const raw=storage.getItem(intentKey(principal));if(raw===null)return null;
  const v:unknown=JSON.parse(raw);
  if(!object(v) || typeof v.attemptId!=='string' || typeof v.startedAt!=='string' || typeof v.fingerprint!=='string' ||
    (v.recordId!==undefined && typeof v.recordId!=='string'))throw Error('Operation tracking needs investigation.');
  return v as CustomerIntent;
}
function canonicalData(data: CustomerData) {return JSON.stringify([data.customerCode,data.name,data.status,data.contactEmail??null,data.phone??null,data.evidenceIds??null]);}
export type CreateResult = {kind:'created';record:CustomerRecord}|{kind:'validation'}|{kind:'denied'}|{kind:'context-changed'}|{kind:'uncertain'};
export async function submitCustomer(options: {principal:AuthenticatedPrincipal;data:CustomerData;storage:IntentStorage;fetcher:typeof fetch;isCurrent:()=>boolean;timeoutMs?:number}): Promise<CreateResult> {
  const {principal,data,storage,fetcher,isCurrent}=options;
  if(Object.keys(customerErrors(data)).length)return {kind:'validation'};
  if(readCustomerIntent(storage,principal))return {kind:'uncertain'};
  const intent:CustomerIntent={attemptId:crypto.randomUUID(),startedAt:new Date().toISOString(),fingerprint:await digest(canonicalData(data))};
  const context=await customerRequestContext(principal);
  if(!isCurrent())return {kind:'context-changed'};
  if(readCustomerIntent(storage,principal))return {kind:'uncertain'};
  // Persist before issuing the request. An interrupted tab never silently retries.
  try {storage.setItem(intentKey(principal),JSON.stringify(intent));} catch {throw Error('Customer operation tracking is unavailable; no create was sent.');}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),options.timeoutMs??30000);
  try {
    const response=await fetcher(CUSTOMER_ENDPOINT,{method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'content-type':'application/json',accept:'application/json',[CUSTOMER_CONTEXT_HEADER]:context},body:JSON.stringify({data}),signal:controller.signal});
    const body:unknown=await response.json();
    if(response.status===201 && customerRecord(body,principal.organizationScope) && body.createdBy===principal.id &&
      await digest(canonicalData(body.data))===intent.fingerprint){
      if(!isCurrent()){storage.setItem(intentKey(principal),JSON.stringify({...intent,recordId:body.id}));return {kind:'uncertain'};}
      storage.removeItem(intentKey(principal));return {kind:'created',record:body};
    }
    // These source-established responses precede customer insertion. Other failures
    // can follow a committed D1 batch and remain ambiguous, including HTTP 503.
    let rejection:CreateResult|null=null;
    if(object(body) && response.status===422 && body.error==='VALIDATION_FAILED') rejection={kind:'validation'};
    if(object(body) && response.status===404 && body.error==='NOT_FOUND') rejection={kind:'denied'};
    if(object(body) && response.status===409 && body.error==='CUSTOMER_CONTEXT_CHANGED') rejection={kind:'context-changed'};
    if(rejection && isCurrent()){storage.removeItem(intentKey(principal));return rejection;}
    return {kind:'uncertain'};
  } catch {return {kind:'uncertain'};} finally {clearTimeout(timer);}
}
export async function reconcileKnownCustomer(options:{principal:AuthenticatedPrincipal;storage:IntentStorage;fetcher:typeof fetch;isCurrent:()=>boolean}):Promise<CustomerRecord|null> {
  const {principal,storage,fetcher,isCurrent}=options;const intent=readCustomerIntent(storage,principal);
  if(!intent?.recordId)return null;
  const response=await fetcher(CUSTOMER_ENDPOINT+'/'+encodeURIComponent(intent.recordId),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok)return null;
  const body:unknown=await response.json();
  if(!isCurrent() || !customerRecord(body,principal.organizationScope) || body.id!==intent.recordId || body.createdBy!==principal.id || await digest(canonicalData(body.data))!==intent.fingerprint)return null;
  storage.removeItem(intentKey(principal));return body;
}
