import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { validateDesign, publishIssues, BASELINE, safeReferenceSVG } from './model.mjs';
import { providerState,testProvider,weather,aiRequest,weatherInsight,GLOBAL_LOCATION_IDS,WEATHER_LOCATIONS } from './providers';
// Explicit allowlist obtained from this Site's Owner access policy. Never trust a client role or preview marker.
const OWNER_EMAIL='adedapo2005@gmail.com';
export async function studioOwner(){const u=await getChatGPTUser();return u?.userId&&u.email.toLowerCase()===OWNER_EMAIL?u:null;}
export function database():D1Database {const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw Error('Persistent Studio storage is unavailable. Your changes have not been saved.');return db;}
export function bucket():R2Bucket {const b=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;if(!b)throw Error('Asset storage is unavailable.');return b;}
export async function livePointer(){return database().prepare('SELECT current, previous, updated FROM signin_studio_live WHERE id = ?').bind('public').first<{current:string|null;previous:string|null;updated:string}>();}
export async function publishedDesign(){const pointer=await livePointer();if(!pointer?.current)return null;const row=await database().prepare('SELECT document FROM signin_studio_versions WHERE id = ?').bind(pointer.current).first<{document:string}>();if(!row)return null;const d=validateDesign(JSON.parse(row.document));delete d.editor;delete d.templateInfo;return d;}
export async function versionForOwner(id:string,owner:string){return database().prepare('SELECT * FROM signin_studio_versions WHERE id = ? AND owner = ?').bind(id,owner).first<{id:string;document:string;name:string;status:string;created:string;base:string}>();}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin;}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
const audit=(owner:string,action:string,target:string)=>database().prepare('INSERT INTO signin_studio_audit (id, owner, action, target, created) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(),owner,action,target,new Date().toISOString());
export async function studioAPI(request:Request,path:string[]){
 const user=await studioOwner();
 // Only image bytes referenced by the current published document can be read anonymously.
 if(!user&&request.method==='GET'&&path[0]==='asset'){
  const d=await publishedDesign(),src='/api/signin-studio/asset/'+path[1];
  const used=d&&(d.page.image===src||d.nodes.some((n:any)=>n.content.src===src));
  if(used){const body=await bucket().get('studio/'+path[1]);if(body)return new Response(body.body,{headers:{'Content-Type':body.httpMetadata?.contentType||'application/octet-stream','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300'}});}
 }
 // Published weather widgets may read only the public environmental contract.
 // No provider configuration, health metadata, or secrets are exposed here.
 if(!user&&request.method==='GET'&&path[0]==='weather'){
  const d=await publishedDesign();
  const allowed=!!d?.nodes.some((n:any)=>/Weather|Global Operations/.test(n.kind)&&n.data?.inputs?.designMode==='LIVE');
  if(!allowed)return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
  const ids=(new URL(request.url).searchParams.get('locations')||'farm').split(',').map((x:any)=>x.trim()).filter((x:any)=>WEATHER_LOCATIONS.some((l:any)=>l.id===x)).slice(0,8);
  return json({records:await weather(database(),ids.length?ids:GLOBAL_LOCATION_IDS,'current')});
 }
 if(!user)return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='GET'&&!sameOrigin(request))return json({error:'Request origin rejected.'},403);
 const db=database(), owner=user.userId, [action,id]=path;
 if(request.method==='GET'){
  if(action==='state'){const fallbackProviders={providers:[] as any[]},providerRead=typeof providerState==='function'?providerState(db):Promise.resolve(fallbackProviders);const [drafts,versions,assets,pointer,library,providers]=await Promise.all([db.prepare('SELECT id,name,revision,updated FROM signin_studio_drafts WHERE owner = ? ORDER BY updated DESC').bind(owner).all(),db.prepare('SELECT id,name,status,base,created FROM signin_studio_versions WHERE owner = ? ORDER BY created DESC').bind(owner).all(),db.prepare('SELECT id,name,mime FROM signin_studio_assets WHERE owner = ? ORDER BY created DESC').bind(owner).all(),livePointer(),db.prepare('SELECT id,name,created FROM signin_studio_library WHERE owner=? ORDER BY created DESC').bind(owner).all(),providerRead]);return json({library:library.results,drafts:drafts.results,versions:versions.results,assets:assets.results,live:pointer?.current||'V52',previous:pointer?.previous||'V52',baseline:BASELINE,storage:'Sites-managed D1 + R2',providers,ai:providers.providers.find((x:any)=>x.id==='ai')?.status||'PROVIDER REQUIRED'});}
  if(action==='providers')return json(await providerState(db));
  if(action==='weather'){const ids=(new URL(request.url).searchParams.get('locations')||'farm').split(',').map((x:any)=>x.trim()).filter((x:any)=>WEATHER_LOCATIONS.some((l:any)=>l.id===x)).slice(0,8);return json({records:await weather(db,ids.length?ids:GLOBAL_LOCATION_IDS,'current')});}
  if(action==='library'){const row=await db.prepare('SELECT document FROM signin_studio_library WHERE id=? AND owner=?').bind(id,owner).first<{document:string}>();return row?json({document:JSON.parse(row.document)}):json({error:'Not Found'},404);}
  if(action==='draft'){const row=await db.prepare('SELECT * FROM signin_studio_drafts WHERE id = ? AND owner = ?').bind(id,owner).first<{document:string}>();return row?json({...row,document:JSON.parse(row.document)}):json({error:'Not Found'},404);}
  if(action==='version'){const row=await versionForOwner(id,owner);return row?json({...row,document:JSON.parse(row.document)}):json({error:'Not Found'},404);}
  if(action==='asset'){const meta=await db.prepare('SELECT * FROM signin_studio_assets WHERE id = ? AND owner = ?').bind(id,owner).first<{mime:string}>();if(!meta)return new Response('Not Found',{status:404});const body=await bucket().get('studio/'+id);return body?new Response(body.body,{headers:{'Content-Type':meta.mime,'Cache-Control':'private, max-age=300','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff'}}):new Response('Not Found',{status:404});}
 }
 if(request.method!=='POST')return json({error:'Not Found'},404);
 if(action==='providers'){
  const body=JSON.parse(await request.text());
  if(body.operation==='test')return json(await testProvider(db,String(body.provider||'')));
  if(body.operation==='weather')return json(await weather(db,Array.isArray(body.locations)?body.locations.map(String).slice(0,8):GLOBAL_LOCATION_IDS,String(body.feature||'current')));
  if(body.operation==='weather-insight')return json(await weatherInsight(db,Array.isArray(body.records)?body.records:[],String(body.prompt||'')));
  return json({error:'Unsupported provider action.'},400);
 }
 if(action==='ai')return json(await aiRequest(db,JSON.parse(await request.text())));
 if(action==='upload'){
  if(Number(request.headers.get('content-length')||0)>32*1024*1024)return json({error:'Upload limit is 32 MiB. Use image optimization for larger sources.'},413);
  const form=await request.formData(), file=form.get('file');if(!(file instanceof File)||file.size>32*1024*1024)return json({error:'Choose an optimized image up to 32 MiB.'},400);
  const bytes=new Uint8Array(await file.arrayBuffer());const magic=bytes.slice(0,12);const png=magic[0]===137&&magic[1]===80&&magic[2]===78&&magic[3]===71,jpg=magic[0]===255&&magic[1]===216&&magic[2]===255,webp=new TextDecoder().decode(magic.slice(0,4))==='RIFF'&&new TextDecoder().decode(magic.slice(8,12))==='WEBP';const mime=png?'image/png':jpg?'image/jpeg':webp?'image/webp':safeReferenceSVG(new TextDecoder().decode(bytes))?'image/svg+xml':null;if(!mime)return json({error:'Supported images: PNG, JPEG, WebP or restricted static SVG without scripts, external references, styles or animation.'},400);
  const assetId=crypto.randomUUID();await bucket().put('studio/'+assetId,bytes,{httpMetadata:{contentType:mime}});await db.prepare('INSERT INTO signin_studio_assets (id,owner,name,mime,created) VALUES (?,?,?,?,?)').bind(assetId,owner,file.name.slice(0,120),mime,new Date().toISOString()).run();return json({id:assetId,src:'/api/signin-studio/asset/'+assetId});
 }
 const raw=await request.text();if(raw.length>1500000)return json({error:'Design package is too large.'},413);const body=JSON.parse(raw);const now=new Date().toISOString();
 if(action==='save-draft'){
  const d=validateDesign(body.document), draftId=String(body.id||crypto.randomUUID());if(!/^[a-zA-Z0-9-]{1,80}$/.test(draftId))throw Error('Invalid draft identifier.');
  const old=await db.prepare('SELECT owner,revision FROM signin_studio_drafts WHERE id = ?').bind(draftId).first<{owner:string;revision:number}>();
  if(old){if(old.owner!==owner)return json({error:'Not Found'},404);if(old.revision!==body.revision)return json({error:'This draft changed in another session. Reopen it or save a new draft.'},409);const r=await db.prepare('UPDATE signin_studio_drafts SET document=?,name=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(d),d.name,now,draftId,owner,body.revision).run();if(r.meta.changes!==1)return json({error:'Concurrent edit detected. Reopen the draft.'},409);return json({id:draftId,revision:old.revision+1,updated:now});}
  await db.prepare('INSERT INTO signin_studio_drafts (id,owner,name,document,revision,updated) VALUES (?,?,?,?,1,?)').bind(draftId,owner,d.name,JSON.stringify(d),now).run();return json({id:draftId,revision:1,updated:now});
 }
 if(action==='save-widget'){const d=validateDesign(body.document),libraryId=crypto.randomUUID();await db.prepare('INSERT INTO signin_studio_library (id,owner,name,document,created) VALUES (?,?,?,?,?)').bind(libraryId,owner,d.name,JSON.stringify(d),now).run();return json({id:libraryId});}
 if(action==='snapshot'||action==='save-template'){
  const d=validateDesign(body.document), versionId=crypto.randomUUID();if(action==='save-template'&&!d.templateInfo)throw Error('Template details are required.');await db.batch([db.prepare('INSERT INTO signin_studio_versions (id,owner,name,document,base,status,created) VALUES (?,?,?,?,?,?,?)').bind(versionId,owner,d.name,JSON.stringify(d),d.baseVersion,action==='save-template'?'Template':'Candidate',now),audit(owner,'Save New Version',versionId)]);return json({id:versionId});
 }
 if(action==='rename'||action==='archive'){
  const row=await versionForOwner(body.id,owner);if(!row)return json({error:'Not Found'},404);const pointer=await livePointer();if(action==='archive'&&pointer?.current===body.id)return json({error:'Restore another live version before archiving this one.'},409);
  if(action==='rename'){const name=String(body.name||'').trim().slice(0,120);if(!name)throw Error('Enter a version name.');await db.prepare('UPDATE signin_studio_versions SET name=? WHERE id=? AND owner=?').bind(name,body.id,owner).run();}else await db.prepare('UPDATE signin_studio_versions SET status=? WHERE id=? AND owner=?').bind('Archived',body.id,owner).run();return json({ok:true});
 }
 if(action==='publish'||action==='rollback'){
  const pointer=await livePointer(), target=action==='rollback'?(body.id||pointer?.previous||'V52'):body.id;
  if(body.confirm!==target||body.expectedLive!==(pointer?.current||'V52'))return json({error:'Live version changed or confirmation is missing. Review again.'},409);
  if(target!=='V52'){const row=await versionForOwner(target,owner);if(!row)return json({error:'Not Found'},404);if(row.status==='Archived')throw Error('Duplicate the archived version before publishing.');const issues=publishIssues(validateDesign(JSON.parse(row.document)));if(issues.length)return json({error:issues.join(' ')},422);if(body.ownerReviewed!==true)throw Error('Owner review is required.');}
  // One compare-and-swap statement prevents a concurrent publish from silently replacing the reviewed live pointer.
  const result=await db.prepare("INSERT INTO signin_studio_live (id,current,previous,updated) VALUES ('public',?,?,?) ON CONFLICT(id) DO UPDATE SET current=excluded.current,previous=signin_studio_live.current,updated=excluded.updated WHERE COALESCE(signin_studio_live.current,'V52')=?").bind(target==='V52'?null:target,pointer?.current||null,now,body.expectedLive).run();if(result.meta.changes!==1)return json({error:'Concurrent publish detected. Review the current live version again.'},409);await audit(owner,action,target).run();return json({live:target});
 }
 return json({error:'Not Found'},404);
}
