"use client";
import { useState } from "react";
import { ArrowUpRight, Newspaper } from "lucide-react";
import { Panel } from "./Common";
import { type GatewayArticle, type GatewayNews, useGatewayResource, widgetTime } from "./useGatewayWidgets";
import styles from "./GatewayWidgets.module.css";
function ArticleList({ items, label }: { items: GatewayArticle[]; label: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / 4)), selected = Math.min(page, pages - 1);
  return <><ul className={styles.articles}>{items.slice(selected * 4, selected * 4 + 4).map(item => <li key={item.link}><a href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} — ${item.source}; opens in a new tab`}><span>{item.title}<small>{item.source}{item.region === "International" ? " · International" : ""} · <time dateTime={item.published}>{widgetTime(item.published)}</time></small></span><ArrowUpRight size={15} aria-hidden="true"/></a></li>)}</ul>
    {pages > 1 && <nav className={styles.paging} aria-label={label}><button type="button" onClick={() => setPage(Math.max(0, selected - 1))} disabled={!selected}>Previous</button><span aria-live="polite" aria-atomic="true">Page {selected + 1} of {pages}</span><button type="button" onClick={() => setPage(Math.min(pages - 1, selected + 1))} disabled={selected === pages - 1}>Next</button></nav>}</>;
}
export default function GatewayNewsWidget({ intelligence = false }: { intelligence?: boolean }) {
  const { data, loading, error, refresh } = useGatewayResource<GatewayNews>("/api/gateway/news", 300000);
  const [domain, setDomain] = useState("Agriculture");
  const domains = Object.keys(data?.intelligence || {});
  const items = intelligence ? data?.intelligence?.[domain] || [] : data?.latest || [];
  const sources = (data?.sources || []).filter(source => intelligence || source.region !== "International");
  const connected = new Set(sources.filter(source => source.state === "connected").map(source => source.publisher || source.name)).size;
  const sourceUnavailable = error || data?.state === "unavailable";
  const emptyMessage = loading ? "Loading sourced headlines…" : intelligence
    ? sourceUnavailable ? "Intelligence sources are temporarily unavailable." : "No recent headlines match this topic."
    : "News is temporarily unavailable.";
  return <Panel className={`gateway-widget ${intelligence ? "gateway-intelligence-widget" : "gateway-news-widget"}`} title={intelligence ? "Nigerian Intelligence" : "Nigeria News"} description={intelligence ? "Nigerian and international reporting" : "Current headlines from Nigerian publishers"}>
    {intelligence && !!domains.length && <div className={styles.tabs} role="group" aria-label="Intelligence topic">{domains.map(value => <button key={value} type="button" aria-pressed={domain === value} onClick={() => setDomain(value)}>{value}</button>)}</div>}
    {items.length ? <ArticleList key={intelligence ? domain : "news"} items={items} label={intelligence ? "Intelligence headline pages" : "News headline pages"}/> : <p className={styles.empty} role="status"><Newspaper size={24}/>{emptyMessage}</p>}
    {loading && data && <p className={styles.updateStatus} role="status">Checking for updated headlines. Previously loaded headlines remain available.</p>}
    {!loading && sourceUnavailable && <button className={styles.widgetRetry} type="button" onClick={refresh}>Retry {intelligence ? "Intelligence" : "News"}</button>}
    <div className={styles.source}><span>{connected} connected publisher{connected === 1 ? "" : "s"}{items.length && (sourceUnavailable || data?.state === "stale") ? " · Last available headlines" : ""}</span>{data?.fetched_at && <span>Updated {widgetTime(data.fetched_at)}</span>}</div>
  </Panel>;
}
