/**
 * Shared presentation contracts for weather and news surfaces.
 *
 * The Sites preview deliberately owns only normalization and truthful UI
 * states. Provider retrieval, caching, tenant isolation and authorization
 * remain backend responsibilities. Sign-In and authenticated Home consume
 * the same shape so a future provider can be connected once without creating
 * page-specific data implementations.
 */
export type IntelligenceDataState =
  | "loading"
  | "live"
  | "stale"
  | "sample"
  | "offline"
  | "unavailable"
  | "error";

export type WeatherLocationId = "balogun-ikire" | "hq-ibadan";

export type SharedWeatherLocation = {
  id: WeatherLocationId;
  label: string;
  shortLabel: string;
  timezone: string;
  enabled: boolean;
};

export const sharedWeatherLocations: readonly SharedWeatherLocation[] = [
  {
    id: "balogun-ikire",
    label: "Daenem Farms · Balogun-Ikire",
    shortLabel: "Farm · Balogun-Ikire",
    timezone: "Africa/Lagos",
    enabled: true,
  },
  {
    id: "hq-ibadan",
    label: "Headquarters · Ibadan",
    shortLabel: "HQ · Ibadan",
    timezone: "Africa/Lagos",
    enabled: true,
  },
];

export const sharedWeatherPresentationDefaults = Object.freeze({
  unit: "f" as const,
  rotateLocations: true,
  rotationIntervalSeconds: 24,
  providerState: "unavailable" as IntelligenceDataState,
});

export type SharedNewsFeedConfig = {
  id: "nigerian-intelligence";
  title: string;
  categories: readonly string[];
  placements: readonly ("signin" | "home" | "dashboard")[];
  providerState: IntelligenceDataState;
  sourcePolicy: string;
};

export const sharedNewsFeedConfig: SharedNewsFeedConfig = Object.freeze({
  id: "nigerian-intelligence",
  title: "Nigerian Intelligence Feed",
  categories: ["Agriculture", "Business", "Economy", "Technology", "Energy", "Logistics", "Regulation"] as const,
  placements: ["signin", "home", "dashboard"] as const,
  providerState: "unavailable",
  sourcePolicy: "Approved, licensed sources only; no fabricated headlines.",
});

export function describeProviderState(state: IntelligenceDataState) {
  switch (state) {
    case "live":
      return "LIVE";
    case "stale":
      return "STALE · verify freshness";
    case "sample":
      return "SAMPLE / DESIGN DATA";
    case "offline":
      return "OFFLINE · last valid observation unavailable";
    case "error":
      return "PROVIDER ERROR";
    default:
      return "PROVIDER UNAVAILABLE";
  }
}
