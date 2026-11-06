"use client";
import { useCallback, useEffect, useState } from "react";
export type GatewayCurrent = { temp_f: number | null; feels_f?: number | null; humidity?: number | null; wind_mph?: number | null; precip_prob?: number | null; code: string; condition: string; is_day: boolean };
export type GatewayLocationWeather = { id?: string; tz: string; state: string; provider: string; fetched_at: string; current: GatewayCurrent | null };
export type GatewayWeather = { farm: GatewayLocationWeather; cities?: GatewayLocationWeather[] };
export type GatewayArticle = { title: string; link: string; source: string; published: string; region?: string };
export type GatewayNews = { state: string; latest: GatewayArticle[]; intelligence: Record<string, GatewayArticle[]>; sources: { name: string; publisher?: string; region?: string; state: string }[]; fetched_at: string };
export type EditorialItem = { id: string; title?: string; body?: string; message?: string; attribution?: string; theme?: string };
export type ManagedEditorial = { enabled?: boolean; spotlight?: EditorialItem | null; inspiration?: EditorialItem | null; generatedAt?: string };
const snapshots = new Map<string, { data: unknown; at: number }>();
const pending = new Map<string, Promise<unknown>>();
async function readPublicResource<T>(url: string, maxAge: number, force: boolean): Promise<T> {
  const saved = snapshots.get(url);
  if (!force && saved && Date.now() - saved.at < maxAge) return saved.data as T;
  const running = pending.get(url);
  if (running) return running as Promise<T>;
  const request = fetch(url, { credentials: "omit", cache: "no-cache", headers: { accept: "application/json" }, signal: AbortSignal.timeout(25000) })
    .then(async response => {
      if (!response.ok) throw new Error("WIDGET_UNAVAILABLE");
      const data: unknown = await response.json();
      snapshots.set(url, { data, at: Date.now() });
      return data;
    }).finally(() => pending.delete(url));
  pending.set(url, request);
  return request as Promise<T>;
}
export function useGatewayResource<T>(url: string, refreshMs: number) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ data?: T; loading: boolean; error: boolean }>(() => ({ data: snapshots.get(url)?.data as T | undefined, loading: !snapshots.has(url), error: false }));
  useEffect(() => {
    let active = true;
    const load = async (force = false) => {
      try { const data = await readPublicResource<T>(url, refreshMs, force); if (active) setResult({ data, loading: false, error: false }); }
      catch { if (active) setResult(previous => ({ ...previous, loading: false, error: true })); }
    };
    void load(revision > 0);
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, refreshMs);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [url, refreshMs, revision]);
  const refresh = useCallback(() => {
    setResult(previous => ({ ...previous, loading: true }));
    setRevision(value => value + 1);
  }, []);
  return { ...result, refresh };
}
export const useGatewayWeather = () => useGatewayResource<GatewayWeather>("/api/gateway/weather", 600000);
export function weatherForZone(data: GatewayWeather | undefined, zone: string) { return [data?.farm, ...(data?.cities || [])].find(item => item?.tz === zone); }
export const metricTemperature = (fahrenheit: number) => Math.round((fahrenheit - 32) * 5 / 9);
export function widgetTime(value: string | undefined, zone = "Africa/Lagos") {
  if (!value || !Number.isFinite(Date.parse(value))) return "Update time unavailable";
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}
