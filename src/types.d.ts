declare module 'cloudflare:workers' {
  export const env: any;
  export type Context = any;
  export type ExecutionContext = any;
}

declare module '@/app/chatgpt-auth' {
  export const getChatGPTUser: any;
  const def: any;
  export default def;
}

declare module '*/provider-contract.mjs' {
  export const GLOBAL_LOCATION_IDS: any;
  export const PROVIDER_CATEGORIES: any;
  export const WEATHER_LOCATIONS: any;
  export const normalizeAccuWeatherCurrent: any;
  export const safeProviderError: any;
  export const unavailableWeather: any;
  export const weatherIcon: any;
  export const isUsableWeather: any;
  export const AI_ROLES: any;
  const def: any;
  export default def;
}

declare module '*/model.mjs' {
  export const validateDesign: any;
  export const publishIssues: any;
  export const BASELINE: any;
  export const safeReferenceSVG: any;
  const def: any;
  export default def;
}

declare module './provider-contract.mjs' {
  export const GLOBAL_LOCATION_IDS: any;
  export const PROVIDER_CATEGORIES: any;
  export const WEATHER_LOCATIONS: any;
  export const normalizeAccuWeatherCurrent: any;
  export const safeProviderError: any;
  export const unavailableWeather: any;
  export const weatherIcon: any;
  export const isUsableWeather: any;
  export const AI_ROLES: any;
  const def: any;
  export default def;
}

declare module './model.mjs' {
  export const validateDesign: any;
  export const publishIssues: any;
  export const BASELINE: any;
  export const safeReferenceSVG: any;
  const def: any;
  export default def;
}
