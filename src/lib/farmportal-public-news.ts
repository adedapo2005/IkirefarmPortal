/**
 * Public, read-only Nigerian editorial feeds for the FarmPortal gateway.
 * No Base44 calls, accounts, cookies, secrets, user-provided URLs or write actions.
 */
export type GatewayArticle = { title: string; link: string; source: string; published: string; region?: "Nigeria" | "International" };
export type GatewayNewsSource = { name: string; publisher: string; region: "Nigeria" | "International"; state: "connected" | "unavailable" };
/** Direct publisher feeds verified during the widget integration. Blocked feeds are excluded. */
export const NIGERIAN_RSS_FEEDS = [
  { name: "Punch", url: "https://punchng.com/feed/" },
  { name: "Vanguard", url: "https://www.vanguardngr.com/feed/" },
  { name: "Premium Times", url: "https://www.premiumtimesng.com/feed" },
  { name: "Channels Television", url: "https://www.channelstv.com/feed/" },
  { name: "Daily Trust", url: "https://dailytrust.com/feed/" },
  { name: "Leadership", url: "https://leadership.ng/feed/" },
  { name: "Nigerian Tribune", url: "https://tribuneonlineng.com/feed/" },
  { name: "BusinessDay", url: "https://businessday.ng/feed/" },
  { name: "ThisDay", url: "https://www.thisdaylive.com/feed/" },
  { name: "Sahara Reporters", url: "https://saharareporters.com/rss.xml" },
  { name: "Peoples Gazette", url: "https://gazettengr.com/feed/" },
  { name: "The Sun Nigeria", url: "https://thesun.ng/feed/" },
  { name: "Blueprint", url: "https://blueprint.ng/feed/" },
  { name: "News Agency of Nigeria", url: "https://nannews.ng/feed/" },
  { name: "Nairametrics", url: "https://nairametrics.com/feed/" },
  { name: "Daily Post", url: "https://dailypost.ng/feed/" },
  { name: "PM News", url: "https://pmnewsnigeria.com/feed/" },
  { name: "Ripples Nigeria", url: "https://www.ripplesnigeria.com/feed/" },
  { name: "ICIR", url: "https://www.icirnigeria.org/feed/" },
  { name: "Business Post", url: "https://businesspost.ng/feed/" },
  { name: "AgroNigeria", url: "https://agronigeria.ng/feed/" },
] as const;
export const INTERNATIONAL_RSS_FEEDS = [
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", publisher: "BBC" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", publisher: "BBC" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", publisher: "Al Jazeera" },
  { name: "DW", url: "https://rss.dw.com/rdf/rss-en-all", publisher: "DW" },
  { name: "The Guardian World", url: "https://www.theguardian.com/world/rss", publisher: "The Guardian" },
  { name: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", publisher: "UN News" },
] as const;

export const INTELLIGENCE_DOMAINS = [
  "Security", "Economy", "Politics", "Agriculture", "Energy", "Infrastructure",
] as const;

const signals: Record<string, RegExp> = {
  Security: /security|police|terror|militar|army|kidnap|bandit|insurgen|crime|attack/i,
  Economy: /econom|bank|inflation|naira|budget|trade|finance|market|investment/i,
  Politics: /politic|presiden|minister|senat|governor|elect|assembly|policy/i,
  Agriculture: /agricultur|farm|poultry|livestock|rice|maize|crop|food|harvest/i,
  Energy: /energy|power|electric|oil|gas|solar|fuel|petrol|grid/i,
  Infrastructure: /infrastructur|road|rail|bridge|airport|port|construction|transport/i,
};

export function decodeRssText(value: string, limit = 340): string {
  const raw = String(value || "").replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
  return raw.replace(/<[^>]*>/g, " ")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, num: string) => {
      const n = num.startsWith("x") ? Number.parseInt(num.slice(1), 16) : Number(num);
      return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/gi, (_m, n: string) =>
      ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " })[n.toLowerCase() as "amp"])
    .replace(/\s+/g, " ").trim().slice(0, limit);
}

function tag(item: string, name: string): string {
  return new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i").exec(item)?.[1] || "";
}

export function parseRss(xml: string, source: string): GatewayArticle[] {
  if (typeof xml !== "string" || xml.length > 1_000_000 || !/<rss\b|<feed\b|<rdf:RDF\b/i.test(xml)) return [];
  const items = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0, 45);
  const unique = new Set<string>();
  const result: GatewayArticle[] = [];
  for (const match of items) {
    const title = decodeRssText(tag(match[1], "title"));
    const atomLink = /<link\b[^>]*href=["\']([^"\']+)["\'][^>]*\/?\s*>/i.exec(match[1])?.[1] || "";
    const link = decodeRssText(tag(match[1], "link") || atomLink, 2048);
    const pub = decodeRssText(tag(match[1], "pubDate") || tag(match[1], "dc:date") || tag(match[1], "published") || tag(match[1], "updated"));
    const date = new Date(pub);
    if (title.length < 10 || !Number.isFinite(date.getTime())) continue;
    if (date.getTime() > Date.now() + 86_400_000 || date.getTime() < Date.now() - 14 * 86_400_000) continue;
    try {
      const uri = new URL(link);
      if (uri.protocol !== "https:" && uri.protocol !== "http:") continue;
      for (const key of [...uri.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) uri.searchParams.delete(key);
      if (unique.has(uri.href)) continue;
      unique.add(uri.href);
      result.push({ title, link: uri.href, published: date.toISOString(), source });
    } catch { continue; }
  }
  return result;
}

type NewsSnapshot = {
  state: "connected" | "partial" | "unavailable" | "stale";
  latest: GatewayArticle[]; news: Record<string, GatewayArticle[]>;
  intelligence: Record<string, GatewayArticle[]>; sources: GatewayNewsSource[];
  fetched_at: string; provider: string;
};
let snapshot: NewsSnapshot | null = null;
let refreshing: Promise<NewsSnapshot> | null = null;

async function boundedXml(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1_000_000) throw new Error("RSS_TOO_LARGE");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => undefined); }
}
function uniqueArticles(items: GatewayArticle[], limit: number) {
  const seen = new Set<string>();
  return items.sort((a, b) => b.published.localeCompare(a.published)).filter(item => {
    const key = item.title.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, limit);
}
async function fetchNews(fetcher: typeof fetch): Promise<NewsSnapshot> {
  const catalog = [
    ...NIGERIAN_RSS_FEEDS.map(feed => ({ ...feed, region: "Nigeria" as const, publisher: feed.name as string })),
    ...INTERNATIONAL_RSS_FEEDS.map(feed => ({ ...feed, region: "International" as const })),
  ];
  const feeds = await Promise.all(catalog.map(async feed => {
    try {
      const response = await fetcher(feed.url, { headers: { accept: "application/rss+xml, application/xml", "user-agent": "DAENEM-FarmPortal-Gateway/1.0" }, signal: AbortSignal.timeout(9000), next: { revalidate: 300 } } as RequestInit);
      if (!response.ok || Number(response.headers.get("content-length") || 0) > 1_000_000) throw new Error("RSS_UNAVAILABLE");
      const articles = parseRss(await boundedXml(response), feed.name).slice(0, 8).map(item => ({ ...item, region: feed.region }));
      return { ...feed, articles, state: articles.length ? "connected" as const : "unavailable" as const };
    } catch { return { ...feed, articles: [] as GatewayArticle[], state: "unavailable" as const }; }
  }));
  const latest = uniqueArticles(feeds.filter(feed => feed.region === "Nigeria").flatMap(feed => feed.articles), 180);
  const reporting = uniqueArticles(feeds.flatMap(feed => feed.articles), 220);
  const intelligence = Object.fromEntries(INTELLIGENCE_DOMAINS.map(domain => [domain, reporting.filter(item => signals[domain].test(item.title)).slice(0, 40)]));
  const connected = feeds.filter(feed => feed.state === "connected").length;
  return {
    state: connected === feeds.length ? "connected" : connected > 0 ? "partial" : "unavailable",
    latest, news: Object.fromEntries(feeds.filter(feed => feed.region === "Nigeria").map(feed => [feed.name, feed.articles])), intelligence,
    sources: feeds.map(({ name, publisher, region, state }) => ({ name, publisher, region, state })),
    fetched_at: new Date().toISOString(), provider: "Direct Nigerian and international publisher RSS",
  };
}
export async function getFarmPortalNews(fetcher: typeof fetch = fetch): Promise<NewsSnapshot> {
  if (fetcher !== fetch) return fetchNews(fetcher);
  if (snapshot && Date.now() - Date.parse(snapshot.fetched_at) < 300000) return snapshot;
  if (refreshing) return refreshing;
  refreshing = fetchNews(fetcher).then(value => {
    if (value.state !== "unavailable") snapshot = value;
    else if (snapshot && Date.now() - Date.parse(snapshot.fetched_at) < 3600000) return { ...snapshot, state: "stale" as const };
    return value;
  }).finally(() => { refreshing = null; });
  return refreshing;
}
