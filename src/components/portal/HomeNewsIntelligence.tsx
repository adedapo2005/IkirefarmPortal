"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Newspaper, RefreshCw } from "lucide-react";
import { type GatewayNews, useGatewayResource } from "./useGatewayWidgets";
import {
  HOME_NEWS_TOPICS, collectSourceHeadlines, editorialAudienceRelevance,
  headlinesForTopic, publisherSourceStatus, type HomeNewsTopic,
} from "./homeNewsIntelligenceModel";
import styles from "./HomeNewsIntelligence.module.css";
import LoggedTimestamp from "./LoggedTimestamp";

type Filter = "all" | HomeNewsTopic;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All Briefs" },
  ...HOME_NEWS_TOPICS.map(topic => ({ id: topic.id, label: topic.short })),
];
const FULL_PAGE_SIZE = 6;

export default function HomeNewsIntelligence({ roleContext = "", owner = false }: { roleContext?: string; owner?: boolean }) {
  const { data, loading, error, refresh } = useGatewayResource<GatewayNews>("/api/gateway/news", 300000);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const articles = useMemo(() => collectSourceHeadlines(data), [data]);
  const feed = publisherSourceStatus(data, error);
  const topics = filter === "all" ? HOME_NEWS_TOPICS : HOME_NEWS_TOPICS.filter(topic => topic.id === filter);
  const fetching = loading && !data;
  const sourceUnavailable = error || data?.state === "unavailable";

  return <section className={styles.section} aria-labelledby="home-news-title">
    <div className={styles.heading}>
      <div className={styles.headingCopy}>
        <span className={styles.eyebrow}>DAENEM EDITORIAL BRIEFINGS</span>
        <h2 id="home-news-title">News & Intelligence</h2>
        <p>Four Source-Linked Briefing Areas. Reporting Is Not Certified Farm Advice.</p>
      </div>
      <button className={styles.refresh} type="button" onClick={refresh} disabled={loading} aria-label="Refresh News & Intelligence">
        <RefreshCw size={17} aria-hidden="true" /> {loading ? "Checking Sources" : "Refresh Sources"}
      </button>
    </div>

    <div className={styles.sourceLine} role="status" aria-live="polite">
      <span>{feed.label}</span>
      <span>{feed.connected} / {feed.total} Publisher Feeds Connected</span>
      <span>{data?.fetched_at ? <>Last Checked <LoggedTimestamp value={data.fetched_at}/></> : "Source Check Pending"}</span>
      <span>Editorial Review: Not Completed</span>
    </div>
    <nav className={styles.filters} aria-label="News & Intelligence Categories">
      {FILTERS.map(item => <button
        key={item.id} type="button" className={filter === item.id ? styles.activeFilter : styles.filter}
        aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setPage(0); }}
      >{item.label}</button>)}
    </nav>

    {fetching && <p className={styles.message} role="status">Checking Publisher Feeds. No Sample Headlines Are Used.</p>}
    {sourceUnavailable && <p className={styles.message} role="status">
      Publisher Refresh Is Unavailable. Any Visible Headlines Are Previously Retrieved Reports, Not Newly Verified News.
    </p>}
    <div className={`${styles.grid} ${filter === "all" ? "" : styles.focused}`}>
      {topics.map(topic => {
        const matches = headlinesForTopic(articles, topic.id);
        const pageSize = filter === "all" ? 3 : FULL_PAGE_SIZE;
        const count = Math.max(1, Math.ceil(matches.length / pageSize));
        const current = Math.min(page, count - 1);
        const shown = matches.slice((filter === "all" ? 0 : current) * pageSize, ((filter === "all" ? 0 : current) + 1) * pageSize);
        return <section className={styles.card} key={topic.id} aria-labelledby={`home-news-${topic.id}`}>
          <div className={styles.cardHeading}>
            <span className={styles.cardIcon} aria-hidden="true"><Newspaper size={19} /></span>
            <div className={styles.cardTitle}>
              <h3 id={`home-news-${topic.id}`}>{topic.title}</h3>
              <p>{topic.audience}</p>
            </div>
            <span className={styles.count}>{matches.length} Matches</span>
          </div>
          <p className={styles.relevance}>{editorialAudienceRelevance(topic.id, roleContext, owner)}</p>
          <div className={styles.cardBody}>
            {shown.length ? <ul className={styles.articles}>
              {shown.map(item => <li key={item.link}>
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                   aria-label={`${item.title} — ${item.source}, publisher website (opens a new tab)`}>
                  <span className={styles.articleTitle}>{item.title}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
                <p className={styles.articleMeta}>{item.source} · <LoggedTimestamp value={item.published}/></p>
              </li>)}
            </ul> : <p className={styles.empty}>
              {fetching ? "Searching For Sourced Headlines…" : "No Matching Publisher Headlines. No Illustrative Articles Are Displayed."}
            </p>}
          </div>
          {filter === "all" && matches.length > 3 && <button type="button" className={styles.viewMore}
             onClick={() => { setFilter(topic.id); setPage(0); }}>View All {topic.short} Briefs <ArrowUpRight size={16}/></button>}
          {filter !== "all" && count > 1 && <div className={styles.pagination}>
            <button type="button" onClick={() => setPage(Math.max(0, current - 1))} disabled={current === 0}>Previous</button>
            <span aria-live="polite">Page {current + 1} of {count}</span>
            <button type="button" onClick={() => setPage(Math.min(count - 1, current + 1))} disabled={current === count - 1}>Next</button>
          </div>}
          <p className={styles.review}>Headline Keyword Match · Source Link Provided · Not Editorially Reviewed</p>
        </section>;
      })}
    </div>
    <p className={styles.disclaimer} role="note">Topic Matching Is Automated From Headlines Only. Publisher Reporting Does Not Establish Veterinary Advice, Regulatory Compliance, Verified Input Prices Or Live Farm Records.</p>
  </section>;
}
