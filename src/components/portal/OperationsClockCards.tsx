"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import WeatherSymbol from "./WeatherSymbol";
import { metricTemperature, useGatewayWeather, weatherForZone } from "./useGatewayWidgets";
import styles from "./GatewayWidgets.module.css";
const locations = [["Toronto", "America/Toronto"], ["London", "Europe/London"], ["New York", "America/New_York"], ["Moscow", "Europe/Moscow"], ["Tokyo", "Asia/Tokyo"], ["Beijing", "Asia/Shanghai"]] as const;
export default function OperationsClockCards() {
  const [now, setNow] = useState<Date | null>(null);
  const { data, loading, error } = useGatewayWeather();
  useEffect(() => {
    const tick = () => setNow(new Date()); tick();
    const timer = window.setInterval(() => { if (!document.hidden) tick(); }, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return <div className={styles.clockGrid}>{locations.map(([name, zone]) => {
    const weather = weatherForZone(data, zone), current = weather?.current;
    const hour = now ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(now)) : null;
    const day = current?.is_day ?? (hour !== null && hour >= 6 && hour < 18);
    const parts = now ? new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(now) : [];
    const clock = parts.filter(part => part.type !== "dayPeriod").map(part => part.value).join("").trim();
    return <article key={zone} className={styles.clock} data-phase={day ? "day" : "night"} aria-label={`${name} local time and weather`}>
      <div className={styles.clockTop}><strong>{name}</strong>{day ? <Sun size={17} strokeWidth={1.65} aria-label="Day"/> : <Moon size={17} strokeWidth={1.65} aria-label="Night"/>}</div>
      <time dateTime={now?.toISOString()}>{clock || "—"}<small>{parts.find(part => part.type === "dayPeriod")?.value}</small></time>
      <small className={styles.clockDate}>{now ? new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short", timeZoneName: "short" }).format(now) : zone}</small>
      <div className={styles.clockWeather}><WeatherSymbol code={current?.code} day={day} size={20}/><span>{typeof current?.temp_f === "number" ? `${metricTemperature(current.temp_f)}°C · ${current.condition}${error ? " · Last available" : ""}` : loading ? "Loading weather…" : "Weather unavailable"}</span></div>
      {weather?.provider && <small>{weather.provider}</small>}
    </article>;
  })}</div>;
}
