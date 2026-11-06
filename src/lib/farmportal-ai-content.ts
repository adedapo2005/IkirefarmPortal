import { getFarmPortalNews } from "@/lib/farmportal-public-news";
import { getOperationsInsights } from "@/lib/farmportal-operations-insights";

type AiResult = { response?: string };

function extractJson(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI_RESPONSE_INVALID");
  return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export async function generateGatewayOwnerContent(db: D1Database, ai: Ai) {
  const [news, operations] = await Promise.all([
    getFarmPortalNews(),
    getOperationsInsights(db),
  ]);
  const agriculture = Array.isArray(news.intelligence?.Agriculture)
    ? news.intelligence.Agriculture.slice(0, 6)
    : [];
  const headlines = agriculture.length ? agriculture : news.latest.slice(0, 6);
  if (!headlines.length && !operations.items.length) {
    return {
      enabled: true,
      state: "empty",
      spotlight: null,
      inspiration: null,
      generatedAt: new Date().toISOString(),
      source: "Approved FarmPortal public sources",
    };
  }

  const source = JSON.stringify({
    NigerianHeadlines: headlines.map((item) => ({ title: item.title, source: item.source })),
    FarmOperations: operations.items.map((item) => ({
      label: item.label,
      title: item.title,
      message: item.message,
    })),
  });
  const prompt = [
    "Create Day-One FarmPortal gateway content for a Nigerian agricultural company.",
    "Use only the supplied source facts. Do not invent figures, people, events, quotes or claims.",
    "Return strict JSON only with this shape:",
    '{"spotlight":{"title":"...","body":"..."},"inspiration":{"message":"...","attribution":"DAENEM Farms","theme":"..."}}',
    "Spotlight title maximum 70 characters; body maximum 180 characters.",
    "Inspiration message maximum 150 characters. Keep it practical, dignified and workplace-safe.",
    "No politics, fear, religious claims, medical advice or financial advice.",
    "Source facts:",
    source,
  ].join("\n");

  const output = await ai.run("@cf/meta/llama-3.2-3b-instruct", {
    messages: [
      { role: "system", content: "You are the controlled FarmPortal editorial generator. Output valid JSON only." },
      { role: "user", content: prompt },
    ],
    max_tokens: 360,
    temperature: 0.35,
  }) as AiResult;
  const parsed = extractJson(String(output.response || ""));
  const spotlight = parsed.spotlight as Record<string, unknown> | undefined;
  const inspiration = parsed.inspiration as Record<string, unknown> | undefined;
  const title = text(spotlight?.title, 70);
  const body = text(spotlight?.body, 180);
  const message = text(inspiration?.message, 150);
  if (!title || !body || !message) throw new Error("AI_RESPONSE_INVALID");

  return {
    enabled: true,
    state: "generated",
    spotlight: { id: "ai-spotlight", title, body },
    inspiration: {
      id: "ai-inspiration",
      message,
      attribution: text(inspiration?.attribution, 60) || "DAENEM Farms",
      theme: text(inspiration?.theme, 60) || "People and operations",
    },
    generatedAt: new Date().toISOString(),
    source: "Cloudflare Workers AI · approved FarmPortal sources",
  };
}
