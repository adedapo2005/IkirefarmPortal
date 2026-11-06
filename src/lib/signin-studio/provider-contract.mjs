// Declarative provider contract shared by the server gateway and the Studio.
// It intentionally contains no secrets, browser calls, or fixture-to-live conversion.
export const PROVIDER_CATEGORIES=['AI','Weather','Maps','News','Calendar','Social','Traffic','Location','Authentication'];
export const WEATHER_LOCATIONS=Object.freeze([
  {id:'farm',displayName:'Daenem Farms — Balogun-Ikire',countryOrRegion:'Nigeria',timezone:'Africa/Lagos',envKey:'DAENEM_WEATHER_FARM_LOCATION_ID'},
  {id:'hq-ibadan',displayName:'HQ — Ibadan',countryOrRegion:'Nigeria',timezone:'Africa/Lagos',envKey:'DAENEM_WEATHER_HQ_IBADAN_LOCATION_ID'},
  {id:'toronto',displayName:'Toronto',countryOrRegion:'Canada',timezone:'America/Toronto',envKey:'DAENEM_WEATHER_TORONTO_LOCATION_ID'},
  {id:'london',displayName:'London',countryOrRegion:'United Kingdom',timezone:'Europe/London',envKey:'DAENEM_WEATHER_LONDON_LOCATION_ID'},
  {id:'new-york',displayName:'New York',countryOrRegion:'United States',timezone:'America/New_York',envKey:'DAENEM_WEATHER_NEW_YORK_LOCATION_ID'},
  {id:'moscow',displayName:'Moscow',countryOrRegion:'Russia',timezone:'Europe/Moscow',envKey:'DAENEM_WEATHER_MOSCOW_LOCATION_ID'},
  {id:'tokyo',displayName:'Tokyo',countryOrRegion:'Japan',timezone:'Asia/Tokyo',envKey:'DAENEM_WEATHER_TOKYO_LOCATION_ID'},
  {id:'beijing',displayName:'Beijing',countryOrRegion:'China',timezone:'Asia/Shanghai',envKey:'DAENEM_WEATHER_BEIJING_LOCATION_ID'},
]);
export const GLOBAL_LOCATION_IDS=Object.freeze(['farm','toronto','london','new-york','moscow','tokyo','beijing']);
export const WEATHER_STATES=Object.freeze(['LIVE','PREVIEW','LOADING','EMPTY','UNAVAILABLE','ERROR','CACHED']);
export const AI_ROLES=Object.freeze({
  designAnalysis:'STUDIO_AI_DESIGN_ANALYSIS_MODEL', designGeneration:'STUDIO_AI_DESIGN_GENERATION_MODEL',
  fastAssistant:'STUDIO_AI_FAST_ASSISTANT_MODEL', highQualityReview:'STUDIO_AI_HIGH_QUALITY_REVIEW_MODEL'
});
export function celsiusToFahrenheit(value){return Math.round((Number(value)*9/5+32)*10)/10;}
export function numberOrNull(value){if(value===null||value===undefined||typeof value==='boolean'||typeof value==='string'&&!value.trim())return null;const n=Number(value);return Number.isFinite(n)?n:null;}
export function safeProviderError(error){const text=String(error?.message||error||'Provider request failed.');if(/quota|429/i.test(text))return 'Rate limited or quota exceeded.';if(/401|403|authori[sz]/i.test(text))return 'Provider authentication failed.';if(/timeout|abort/i.test(text))return 'Provider request timed out.';return 'Provider request failed.';}
export function weatherFreshness(observedAt,now=Date.now()){const at=Date.parse(observedAt||'');if(!Number.isFinite(at))return {status:'UNAVAILABLE',label:'Observation time unavailable'};const age=Math.max(0,now-at);if(age<=15*60_000)return {status:'LIVE',label:`Observed ${Math.max(1,Math.round(age/60_000))} min ago`};if(age<=24*60*60_000)return {status:'CACHED',label:`Cached observation · ${Math.round(age/60/60_000)}h ago`};return {status:'UNAVAILABLE',label:'Observation is too old'};}
export function normalizeAccuWeatherCurrent(raw,location,now=Date.now()){
 const item=Array.isArray(raw)?raw[0]:raw;if(!item||typeof item!=='object')return unavailableWeather(location,'Provider returned no observation.');
 const temperatureF=numberOrNull(item.Temperature?.Imperial?.Value);const observedAt=item.LocalObservationDateTime;
 if(temperatureF===null||!observedAt)return unavailableWeather(location,'Provider observation has no usable temperature.');
 const freshness=weatherFreshness(observedAt,now);if(freshness.status==='UNAVAILABLE')return unavailableWeather(location,freshness.label);
 return {locationId:location.id,displayName:location.displayName,countryOrRegion:location.countryOrRegion,timezone:location.timezone,conditionCode:String(item.WeatherIcon??'unknown'),conditionLabel:String(item.WeatherText||'Weather observation'),temperatureF,feelsLikeF:numberOrNull(item.RealFeelTemperature?.Imperial?.Value),humidity:numberOrNull(item.RelativeHumidity),windMph:numberOrNull(item.Wind?.Speed?.Imperial?.Value),windDirection:item.Wind?.Direction?.Localized||null,rain:item.HasPrecipitation?item.PrecipitationType||'Precipitation':null,sunrise:null,sunset:null,visibilityMi:numberOrNull(item.Visibility?.Imperial?.Value),cloudCover:numberOrNull(item.CloudCover),observedAt,providerName:'AccuWeather',providerStatus:freshness.status==='LIVE'?'live':'cached',dataFreshness:freshness.label,trustedCached:freshness.status==='CACHED',isDaytime:typeof item.IsDayTime==='boolean'?item.IsDayTime:null};
}
export function unavailableWeather(location,reason='Live Weather Provider Required'){return {locationId:location.id,displayName:location.displayName,countryOrRegion:location.countryOrRegion,timezone:location.timezone,providerStatus:'unavailable',providerName:null,dataFreshness:reason,conditionCode:'unavailable',conditionLabel:'Weather Unavailable',temperatureF:null,observedAt:null};}
export function weatherIcon(code){const n=Number(code);if(!Number.isFinite(n))return 'Unavailable';if([1,2,30,31].includes(n))return 'Clear';if([3,4,5,6].includes(n))return 'Partly Cloudy';if([7,8].includes(n))return 'Cloudy';if([12,13,14,18,26,29].includes(n))return 'Rain';if([15,16,17].includes(n))return 'Storm';if([11].includes(n))return 'Fog';if([19,20,21,22,23,24,25,43,44].includes(n))return 'Snow';if([32].includes(n))return 'Wind';return 'Cloudy';}
export function isUsableWeather(record){return record&&['live','cached'].includes(record.providerStatus)&&numberOrNull(record.temperatureF)!==null&&!!record.observedAt&&!!record.providerName;}
export function providerSecretNames(){return {AI:['OPENAI_API_KEY'],Weather:['DAENEM_WEATHER_PROVIDER','ACCUWEATHER_API_KEY',...WEATHER_LOCATIONS.map(x=>x.envKey)],Maps:['DAENEM_MAPS_PROVIDER','GOOGLE_MAPS_API_KEY'],News:['DAENEM_NEWS_PROVIDER','NEWS_API_KEY']};}
