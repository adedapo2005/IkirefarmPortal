// Shared immutable design snapshots. No provider requests or timers belong here.
export const DATA_MODES=['LIVE','PREVIEW','LOADING','EMPTY','UNAVAILABLE','ERROR','CACHED'];
export const PREVIEW_WEATHER=Object.freeze({condition:'Partly cloudy',temperatureF:78,humidity:'64%',wind:'6 mph',rain:'0.02 in',feelsLike:'79°F',sunrise:'6:30 AM',sunset:'6:42 PM'});
export const PREVIEW_ARTICLES=Object.freeze(['Sample editorial headline','Example community update','Preview agriculture insight']);
export function designData(node){const requested=node.data?.inputs?.designMode;const mode=DATA_MODES.includes(requested)?requested:node.data?.source==='FIXTURE/PREVIEW'?'PREVIEW':'UNAVAILABLE';return {mode:mode==='LIVE'?'UNAVAILABLE':mode,label:mode==='LIVE'?'Live Provider Required':mode==='PREVIEW'?'PREVIEW DATA':mode==='CACHED'?'No Trusted Cached Observation':mode==='LOADING'?'Loading Observation':mode==='EMPTY'?'No Observation Available':mode==='ERROR'?'Provider Error':'Provider Unavailable',weather:mode==='PREVIEW'?PREVIEW_WEATHER:null,articles:mode==='PREVIEW'?PREVIEW_ARTICLES:[]};}
export function calendarCells(date){const year=date.getUTCFullYear(),month=date.getUTCMonth(),offset=new Date(Date.UTC(year,month,1)).getUTCDay(),days=new Date(Date.UTC(year,month+1,0)).getUTCDate();return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>i<offset||i>=offset+days?null:i-offset+1);}
export function safeReferenceSVG(input){
 if(typeof input!=='string'||input.length>512000||!/^\s*<svg\b/i.test(input)||!/<\/svg>\s*$/i.test(input))return false;
 if(/<!|<\?|&|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=|javascript:|data:|url\s*\(/i.test(input))return false;
 const tags=[...input.matchAll(/<\s*\/?\s*([a-zA-Z][\w:-]*)\b/g)].map(m=>m[1].toLowerCase());
 return tags.every(t=>['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','lineargradient','radialgradient','stop','clippath','title','desc'].includes(t));
}
export async function analyzeReference(reference,provider){if(!provider?.analyze)return {status:'PROVIDER REQUIRED',document:null};const result=await provider.analyze({reference,output:'daenem.signin.design/1',editable:true,applyAutomatically:false});const {validateDesign}=await import('./model.mjs');const document=validateDesign(result);if(!document.nodes.length)throw Error('Analysis did not produce editable components.');return {status:'REVIEW REQUIRED',document};}
