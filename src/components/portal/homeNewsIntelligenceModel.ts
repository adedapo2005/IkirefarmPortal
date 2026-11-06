/**
 * Stage 22 Home editorial projection of the existing public RSS gateway.
 * Headline keyword matching is not publisher verification, fact checking, or advice.
 * Kept separate from business records, FarmPortal roles and market-price authority.
 */
export type HomeNewsArticle = {
  title: string;
  link: string;
  source: string;
  published: string;
  region?: string;
};
export type HomeNewsPayload = {
  latest?: HomeNewsArticle[];
  intelligence?: Record<string, HomeNewsArticle[]>;
  state?: string;
  fetched_at?: string;
  sources?: Array<{ name: string; publisher?: string; state: string }>;
};

export const HOME_NEWS_TOPICS = [
  {
    id: "market", short: "Market", title: "Market & Inputs",
    audience: "Purchasing, Finance & Farm Teams",
    roleMatch: /procurement|purchas|finance|accounts|owner|farm|manager|inventory/i,
    titleMatch: /\b(?:market|prices?|commodit(?:y|ies)|feed(?:stock|stuffs?)?|maize|soy(?:beans?)?|grain|agricultural inputs?|input costs?|supplier|supply chain|procurement|inflation|fertili[sz]er|poultry feed)\b/i,
  },
  {
    id: "health", short: "Health", title: "Poultry Health Advisory",
    audience: "Flock, Health & Biosecurity Teams",
    roleMatch: /poultry|farm|veterinar|health|flock|biosecurity|manager|owner/i,
    titleMatch: /\b(?:poultry (?:health|disease|vaccin)|bird flu|avian influenza|veterinar(?:y|ian)|vaccin(?:e|ation|ations)|biosecurity|newcastle disease|salmonella|animal disease|livestock health|animal outbreak|flock mortality)\b/i,
  },
  {
    id: "policy", short: "Policy", title: "Nigeria Policy & Compliance",
    audience: "Owners, Compliance & Administration",
    roleMatch: /owner|admin|compliance|policy|legal|finance|procurement|manager/i,
    titleMatch: /\b(?:agricultural polic(?:y|ies)|agricultur(?:al|e) (?:import|export|trade) polic(?:y|ies)|farm regulations?|poultry regulations?|food safety|feed safety regulations?|nafdac|nigerian? import|nigerian? export|agriculture ministry|import ban|export polic(?:y|ies)|agricultural legislation|federal agriculture|tax reforms?|livestock polic(?:y|ies)|regulator(?:y|s) compliance)\b/i,
  },
  {
    id: "operations", short: "Operations", title: "Farm Operations & Innovation",
    audience: "Production, Operations & Farm Managers",
    roleMatch: /farm|operations|production|flock|hatchery|maintenance|manager|owner/i,
    titleMatch: /\b(?:farm operations?|farm management|poultry farm(?:s|ers?)?|egg production|flock management|broiler production|layer farm(?:s|ers?)?|hatcher(?:y|ies)|agritech|farm automation|agricultural technolog(?:y|ies)|irrigation|feed storage|cold chain|agricultural innovations?|precision farming)\b/i,
  },
] as const;

export type HomeNewsTopic = (typeof HOME_NEWS_TOPICS)[number]["id"];
const MAX_ARTICLE_AGE = 14 * 24 * 60 * 60 * 1000;
// Allow small clock differences, not articles supposedly published an hour ahead.
const MAX_FUTURE_SKEW = 5 * 60 * 1000;

export function isSafeSourcedArticle(item: HomeNewsArticle, now = Date.now()): boolean {
  if (!item || typeof item.title !== "string" || item.title.trim().length < 10 ||
      typeof item.source !== "string" || !item.source.trim() ||
      typeof item.link !== "string" || typeof item.published !== "string") return false;
  const timestamp = Date.parse(item.published);
  if (!Number.isFinite(timestamp) || timestamp < now - MAX_ARTICLE_AGE ||
      timestamp > now + MAX_FUTURE_SKEW) return false;
  try {
    const link = new URL(item.link);
    return link.protocol === "https:" && Boolean(link.hostname) && !link.username && !link.password;
  } catch {
    return false;
  }
}

export function collectSourceHeadlines(payload: HomeNewsPayload | undefined, now = Date.now()): HomeNewsArticle[] {
  if (!payload) return [];
  const incoming = [
    ...(Array.isArray(payload.latest) ? payload.latest : []),
    ...Object.values(payload.intelligence || {}).flatMap(value => Array.isArray(value) ? value : []),
  ];
  const distinct = new Map<string, HomeNewsArticle>();
  for (const item of incoming) {
    if (!isSafeSourcedArticle(item, now)) continue;
    // The same syndicated story may occur in both latest and intelligence categories.
    const key = new URL(item.link).href;
    if (!distinct.has(key)) distinct.set(key, item);
  }
  return [...distinct.values()].sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).slice(0, 220);
}

// A Nigerian publisher may report foreign legislation. Do not relabel such
// headlines as Nigeria compliance advice just because they mention "regulation".
const NIGERIAN_POLICY_CONTEXT =
  /\b(?:nigeria(?:n)?|nafdac|nigerian customs|firs|lagos state|abuja)\b/i;
const FOREIGN_POLICY_LEAD =
  /^(?:UK|US|USA|EU|U[.]K[.]|U[.]S[.]|European Union|United Kingdom|United States|China|France|India|Canada|Australia)(?=[ :-])/i;

// A headline about an oil market, stock index or street market is not
// automatically an agricultural input price. Prefer an empty card to an
// unrelated article portrayed as actionable farm intelligence.
const AGRICULTURAL_CONTEXT =
  /\b(?:agricultur(?:e|al)|agro(?:tech|business)?|poultry|chickens?|broilers?|layers?|eggs?|hatcher(?:y|ies)|flocks?|livestock|farm(?:s|ers?|ing)?|crops?|maize|soy(?:a?beans?)?|feed(?:s|stock|stuffs?)?|fertili[sz]ers?|harvest|grains?|cassava|rice|aquacultur(?:e|al)|avian|bird flu|newcastle disease)\b/i;
const POULTRY_CONTEXT =
  /\b(?:poultry|chickens?|broilers?|layers?|eggs?|hatcher(?:y|ies)|flocks?|avian|bird flu|newcastle disease)\b/i;
const FOOD_POLICY_CONTEXT = /\b(?:food safety|food security|food imports?|food exports?|edible oils?|food products?)\b/i;

export function headlinesForTopic(items: readonly HomeNewsArticle[], topic: HomeNewsTopic): HomeNewsArticle[] {
  const match = HOME_NEWS_TOPICS.find(entry => entry.id === topic);
  if (!match) return [];
  // Headline heuristics remain unreviewed editorial triage, not verified prices,
  // disease advice or regulatory guidance. Region labels indicate publisher
  // geography, not the legal jurisdiction described in an article.
  return items.filter(item => {
    const title = item.title;
    if (!match.titleMatch.test(title)) return false;
    if (topic === "health") return POULTRY_CONTEXT.test(title);
    if (topic === "policy") {
      return NIGERIAN_POLICY_CONTEXT.test(title) &&
        !FOREIGN_POLICY_LEAD.test(title) &&
        (AGRICULTURAL_CONTEXT.test(title) || FOOD_POLICY_CONTEXT.test(title));
    }
    return AGRICULTURAL_CONTEXT.test(title);
  });
}

export function publisherSourceStatus(payload: HomeNewsPayload | undefined, errored = false, now = Date.now()) {
  if (!payload) return { connected: 0, total: 0, label: errored ? "Publisher Feeds Unavailable" : "Checking Publisher Feeds", isStale: errored };
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const connected = sources.filter(entry => entry.state === "connected").length;
  const age = Date.parse(payload.fetched_at || "");
  const isStale = errored || payload.state === "stale" ||
    !Number.isFinite(age) || now - age > 30 * 60 * 1000 || age > now + MAX_FUTURE_SKEW;
  const label = payload.state === "unavailable" || connected === 0
    ? "Publisher Feeds Unavailable"
    : isStale ? "Last Available Headlines — Refresh Not Confirmed"
    : connected < sources.length ? "Partially Connected Publisher Feeds"
    : "Connected Publisher Feeds";
  return { connected, total: sources.length, label, isStale };
}

export function editorialAudienceRelevance(topic: HomeNewsTopic, roleContext: string, owner = false): string {
  const entry = HOME_NEWS_TOPICS.find(item => item.id === topic);
  if (!entry) return "General Industry Reading";
  return owner || entry.roleMatch.test(roleContext)
    ? "Relevant To Your Work — Editorial Estimate"
    : "General Industry Reading";
}
