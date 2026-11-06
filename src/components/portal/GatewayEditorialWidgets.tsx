"use client";
import { BookOpen, HeartHandshake } from "lucide-react";
import { Panel } from "./Common";
import { type EditorialItem, type ManagedEditorial, useGatewayResource } from "./useGatewayWidgets";
import styles from "./GatewayWidgets.module.css";
import LoggedTimestamp from "./LoggedTimestamp";
export default function GatewayEditorialWidget({ kind }: { kind: "spotlight" | "inspiration" }) {
  const published = useGatewayResource<EditorialItem[]>(`/api/gateway/${kind}`, 300000);
  const managed = useGatewayResource<ManagedEditorial>("/api/gateway/ai-content", 300000);
  const item = Array.isArray(published.data) && published.data.length ? published.data[0] : managed.data?.enabled ? managed.data[kind] : null;
  const loading = published.loading || managed.loading;
  return <Panel className={`gateway-widget gateway-${kind}-widget`} title={kind === "spotlight" ? "Daily Spotlight" : "Employee Inspiration"} description={kind === "spotlight" ? "People, learning and farm life" : "A practical thought for your working day"}>
    <div className={styles.editorial}>
      {item ? kind === "spotlight" ? <><h3>{item.title}</h3><p>{item.body}</p></> : <><blockquote>{item.message}</blockquote>{item.attribution && <footer>{item.attribution}</footer>}</> : <>
        <p className={styles.empty} role="status">{kind === "spotlight" ? <BookOpen size={24}/> : <HeartHandshake size={24}/>} {loading ? "Loading today’s content…" : published.error || managed.error ? "Today’s content is temporarily unavailable." : "No managed content is available yet."}</p>
        {!loading && (published.error || managed.error) && <button className={styles.editorialRetry} type="button" onClick={() => { published.refresh(); managed.refresh(); }}>Try Again</button>}
      </>}
      {item?.theme && <small>{item.theme}</small>}
      {item && managed.data?.generatedAt && (!Array.isArray(published.data) || !published.data.length) && <small>Updated <LoggedTimestamp value={managed.data.generatedAt}/></small>}
    </div>
  </Panel>;
}
