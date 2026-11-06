"use client";
import { useState } from "react";
import { CloudOff, Droplets, RefreshCw, Thermometer, Wind } from "lucide-react";
import { Panel } from "./Common";
import { metricTemperature, useGatewayWeather } from "./useGatewayWidgets";
import WeatherSymbol from "./WeatherSymbol";
import AuthorizedLocationWeather from "./AuthorizedLocationWeather";
import styles from "./GatewayWidgets.module.css";
import LoggedTimestamp from "./LoggedTimestamp";
export default function DashboardWeather() {
  const { data, loading, error, refresh } = useGatewayWeather();
  const [showLocal, setShowLocal] = useState(false);
  const [unit, setUnit] = useState<"C" | "F">("C");
  const farm = data?.farm, current = farm?.current;
  const temperature = (value: number) => `${unit === "C" ? metricTemperature(value) : Math.round(value)}°${unit}`;
  const available = typeof current?.temp_f === "number" && Number.isFinite(current.temp_f);
  return <Panel className="gateway-widget gateway-weather-widget" title="Farm Weather" description="Balogun-Ikire · current conditions">
    <div className={styles.weather} aria-busy={loading}>
      {available && current ? <>
        <div className={styles.weatherHeading}>
          <div className={styles.condition}><span className={styles.symbol}><WeatherSymbol code={current.code} day={current.is_day} size={34}/></span><span><strong>{temperature(current.temp_f!)}</strong><small>{current.condition}</small></span></div>
          <div className={styles.units} role="group" aria-label="Temperature unit">{(["C", "F"] as const).map(value => <button key={value} type="button" aria-pressed={unit === value} onClick={() => setUnit(value)}>°{value}</button>)}</div>
        </div>
        <dl className={styles.measures}>
          {typeof current.feels_f === "number" && <div><dt><Thermometer size={14}/>Feels like</dt><dd>{temperature(current.feels_f)}</dd></div>}
          {typeof current.humidity === "number" && <div><dt><Droplets size={14}/>Humidity</dt><dd>{current.humidity}%</dd></div>}
          {typeof current.wind_mph === "number" && <div><dt><Wind size={14}/>Wind</dt><dd>{unit === "C" ? Math.round(current.wind_mph * 1.609344) : Math.round(current.wind_mph)} {unit === "C" ? "km/h" : "mph"}</dd></div>}
        </dl>
      </> : <p className={styles.empty} role="status"><CloudOff size={24}/>{loading ? "Loading farm weather…" : "Current weather is temporarily unavailable."}</p>}
      {loading && available && <p className={styles.updateStatus} role="status">Checking for an updated farm weather observation. The current reading remains available.</p>}
      <div className={styles.source}><span>{farm?.provider || "Open-Meteo"} · {farm?.fetched_at ? <LoggedTimestamp value={farm.fetched_at}/> : "Awaiting observation"}{error && available ? " · Last available reading" : ""}</span><button type="button" onClick={refresh} aria-label="Refresh farm weather"><RefreshCw size={14}/>Refresh</button></div>
      <button className={styles.localWeather} type="button" aria-expanded={showLocal} onClick={() => setShowLocal(value => !value)}>{showLocal ? "Hide local weather" : "Your local weather"}</button>
      {showLocal && <AuthorizedLocationWeather/>}
    </div>
  </Panel>;
}
