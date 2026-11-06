/**
 * Read-only FarmPortal agricultural forecast; Open-Meteo is explicitly
 * attributed. Fixed farm-area coordinates, no input-controlled provider URL.
 */
const FARM_LATITUDE = 7.3667;
const FARM_LONGITUDE = 4.1833;
const FARM_TZ = "Africa/Lagos";

const conditions: Record<number, string> = {
  0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Cloudy",
  45: "Fog", 48: "Fog", 51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
  56: "Freezing Drizzle", 57: "Freezing Drizzle", 61: "Light Rain",
  63: "Rain", 65: "Heavy Rain", 66: "Freezing Rain", 67: "Freezing Rain",
  71: "Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow",
  80: "Rain Showers", 81: "Rain Showers", 82: "Heavy Showers",
  85: "Snow Showers", 86: "Heavy Snow Showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Severe Thunderstorm",
};
const finite = (n: unknown): number | null => typeof n === "number" && Number.isFinite(n) ? n : null;
const inchesHg = (pressure: unknown) => finite(pressure) === null ? null : Math.round((Number(pressure) * 0.029529983) * 100) / 100;
const miles = (meters: unknown) => finite(meters) === null ? null : Math.round((Number(meters) / 1609.344) * 10) / 10;
const wxCode = (code: unknown) => {
  const n = finite(code);
  if (n === null) return "unknown";
  if (n === 0) return "clear";
  if (n === 1) return "mostly_clear";
  if (n === 2) return "partly";
  if (n === 3) return "overcast";
  if (n === 45 || n === 48) return "fog";
  if (n >= 95) return "storm";
  if (n >= 80 && n <= 82) return "showers";
  if ((n >= 71 && n <= 77) || n === 85 || n === 86) return "snow";
  if (n >= 65 && n <= 67) return "heavy_rain";
  if (n >= 51 && n <= 62) return "light_rain";
  if (n >= 63 && n <= 67) return "rain";
  return "cloudy";
};
const toIso = (local: unknown, seconds: number): string | null => {
  if (typeof local !== "string") return null;
  const timestamp = Date.parse(local + (local.endsWith("Z") ? "" : "Z"));
  return Number.isFinite(timestamp) ? new Date(timestamp - seconds * 1000).toISOString() : null;
};

export function mapOpenMeteoWeather(raw: Record<string, unknown>) {
  const current = raw.current as Record<string, unknown> | undefined;
  const hourly = raw.hourly as Record<string, unknown[]> | undefined;
  const daily = raw.daily as Record<string, unknown[]> | undefined;
  if (!current || !daily || !Array.isArray(daily.time) || !Array.isArray(hourly?.time)) {
    throw new Error("WEATHER_PROVIDER_CONTRACT_INVALID");
  }
  const offset = Number(raw.utc_offset_seconds ?? 3600);
  const code = finite(current.weather_code);
  const hourKey = String(current.time || "").slice(0, 13);
  const currentHourIndex = hourly.time.findIndex(time =>
    typeof time === "string" && time.slice(0, 13) === hourKey);
  const days = daily.time.slice(0, 7).map((time, i) => {
    const c = finite(daily.weather_code?.[i]);
    return {
      date: String(time),
      high_f: finite(daily.temperature_2m_max?.[i]),
      low_f: finite(daily.temperature_2m_min?.[i]),
      precip_in: finite(daily.precipitation_sum?.[i]),
      precip_prob: finite(daily.precipitation_probability_max?.[i]),
      wind_mph: finite(daily.wind_speed_10m_max?.[i]),
      gust_mph: finite(daily.wind_gusts_10m_max?.[i]),
      uv: finite(daily.uv_index_max?.[i]),
      code: wxCode(c),
      condition: c === null ? "Unavailable" : conditions[c] || "Variable",
    };
  });
  const nowMs = Date.now();
  const hours = hourly.time.map((time, i) => ({
    time: toIso(time, offset),
    temp_f: finite(hourly.temperature_2m?.[i]),
    precip_prob: finite(hourly.precipitation_probability?.[i]),
    code: wxCode(hourly.weather_code?.[i]),
    condition: conditions[Number(hourly.weather_code?.[i])] || "Variable",
    is_day: hourly.is_day?.[i] === 1,
  })).filter(row => row.time && Date.parse(row.time) >= nowMs - 3_600_000).slice(0, 12);
  const sun = days.map((_day, i) => ({
    sunrise: toIso(daily.sunrise?.[i], offset),
    sunset: toIso(daily.sunset?.[i], offset),
  }));
  const temp = finite(current.temperature_2m);
  const farm = {
    state: temp === null ? "unavailable" : "connected",
    provider: "Open-Meteo",
    tz: FARM_TZ,
    fetched_at: new Date().toISOString(),
    google_state: "unavailable",
    current: temp === null ? null : {
      temp_f: temp,
      feels_f: finite(current.apparent_temperature),
      humidity: finite(current.relative_humidity_2m),
      wind_mph: finite(current.wind_speed_10m),
      gust_mph: finite(current.wind_gusts_10m),
      wind_dir_deg: finite(current.wind_direction_10m),
      precip_in: finite(current.precipitation),
      precip_prob: currentHourIndex >= 0 ? finite(hourly.precipitation_probability?.[currentHourIndex]) : null,
      pressure_inhg: inchesHg(current.pressure_msl),
      visibility_mi: miles(current.visibility),
      uv: finite(current.uv_index),
      condition: code === null ? "Unavailable" : conditions[code] || "Variable",
      code: wxCode(code),
      is_day: current.is_day === 1,
    },
    today: days[0] || null,
    daily: days,
    sun,
    hourly: hours,
  };
  return { farm, state: farm.state, provider: "Open-Meteo" };
}

export async function getFarmPortalWeather(fetcher: typeof fetch = fetch) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(FARM_LATITUDE), longitude: String(FARM_LONGITUDE),
    timezone: FARM_TZ, temperature_unit: "fahrenheit", wind_speed_unit: "mph",
    precipitation_unit: "inch", forecast_days: "7",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,precipitation,pressure_msl,visibility,is_day,uv_index",
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max",
  }).toString();
  // City lookup runs alongside the farm request, not after it. This avoids
  // multiplying provider latency when an edge rejects multi-city forecasts.
  // On failure, keep the farm reading and mark city data unavailable.
  const citiesPromise = getGlobalOperationsWeather(fetcher)
    .catch(() => [] as ReturnType<typeof mapGlobalOperationsWeather>);
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(9000),
    next: { revalidate: 600 },
  } as RequestInit);
  if (!response.ok || Number(response.headers.get("content-length") || 0) > 500_000) {
    throw new Error("WEATHER_SOURCE_UNAVAILABLE");
  }
  const mapped = mapOpenMeteoWeather(await response.json() as Record<string, unknown>);
  const cities = await citiesPromise;
  return { ...mapped, cities };
}

/** Fixed public operations locations. Coordinates never originate from visitors. */
const GLOBAL_CITIES = [
  { id: "toronto", latitude: 43.6532, longitude: -79.3832, tz: "America/Toronto" },
  { id: "london", latitude: 51.5074, longitude: -0.1278, tz: "Europe/London" },
  { id: "newyork", latitude: 40.7128, longitude: -74.0060, tz: "America/New_York" },
  { id: "moscow", latitude: 55.7558, longitude: 37.6173, tz: "Europe/Moscow" },
  { id: "tokyo", latitude: 35.6762, longitude: 139.6503, tz: "Asia/Tokyo" },
  { id: "beijing", latitude: 39.9042, longitude: 116.4074, tz: "Asia/Shanghai" },
] as const;

export function mapGlobalOperationsWeather(payload: unknown) {
  if (!Array.isArray(payload) || payload.length !== GLOBAL_CITIES.length) {
    throw new Error("GLOBAL_WEATHER_PROVIDER_CONTRACT_INVALID");
  }
  return GLOBAL_CITIES.map((city, index) => {
    const raw = payload[index] as Record<string, unknown> | null;
    const current = raw?.current as Record<string, unknown> | undefined;
    const daily = raw?.daily as Record<string, unknown[]> | undefined;
    const code = finite(current?.weather_code);
    const temp = finite(current?.temperature_2m);
    const offset = finite(raw?.utc_offset_seconds) ?? 0;
    const day = {
      high_f: finite(daily?.temperature_2m_max?.[0]),
      low_f: finite(daily?.temperature_2m_min?.[0]),
      precip_prob: finite(daily?.precipitation_probability_max?.[0]),
    };
    return {
      id: city.id,
      tz: city.tz,
      state: temp === null ? "unavailable" : "connected",
      provider: "Open-Meteo",
      fetched_at: new Date().toISOString(),
      current: temp === null ? null : {
        temp_f: temp,
        feels_f: finite(current?.apparent_temperature),
        humidity: finite(current?.relative_humidity_2m),
        wind_mph: finite(current?.wind_speed_10m),
        gust_mph: finite(current?.wind_gusts_10m),
        wind_dir_deg: finite(current?.wind_direction_10m),
        pressure_inhg: inchesHg(current?.pressure_msl),
        precip_prob: null,
        condition: code === null ? "Unavailable" : conditions[code] || "Variable",
        code: wxCode(code),
        is_day: current?.is_day === 1,
      },
      today: day,
      sun: [{
        sunrise: toIso(daily?.sunrise?.[0],offset),
        sunset: toIso(daily?.sunset?.[0],offset),
      }],
    };
  });
}
export async function getGlobalOperationsWeather(fetcher: typeof fetch = fetch) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: GLOBAL_CITIES.map(x => x.latitude).join(","),
    longitude: GLOBAL_CITIES.map(x => x.longitude).join(","),
    timezone: GLOBAL_CITIES.map(x => x.tz).join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    forecast_days: "1",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,pressure_msl,is_day",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
  }).toString();
  const options = {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(9000),
    next: { revalidate: 600 },
  } as RequestInit;
  try {
    const response = await fetcher(url, options);
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 500_000)
      throw new Error("GLOBAL_WEATHER_BATCH_UNAVAILABLE");
    const cities = mapGlobalOperationsWeather(await response.json() as unknown);
    if (!cities.some(x => x.current !== null))
      throw new Error("GLOBAL_WEATHER_BATCH_EMPTY");
    return cities;
  } catch {
    // Some edge/CDN paths do not accept multi-location forecasts. Retry
    // the six fixed coordinates individually, retaining successful cities.
    // Failed cities remain explicitly unavailable, never simulated.
    const singles = await Promise.all(GLOBAL_CITIES.map(async city => {
      const single = new URL(url);
      single.searchParams.set("latitude", String(city.latitude));
      single.searchParams.set("longitude", String(city.longitude));
      single.searchParams.set("timezone", city.tz);
      try {
        const response = await fetcher(single, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(9000),
          next: { revalidate: 600 },
        } as RequestInit);
        if (!response.ok || Number(response.headers.get("content-length") || 0) > 200_000)
          return null;
        const data = await response.json() as Record<string, unknown>;
        return data?.current && data?.daily ? data : null;
      } catch { return null; }
    }));
    if (singles.every(x => x === null)) throw new Error("GLOBAL_WEATHER_ALL_SOURCES_UNAVAILABLE");
    return mapGlobalOperationsWeather(singles);
  }
}
