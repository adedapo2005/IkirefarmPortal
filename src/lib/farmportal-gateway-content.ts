/**
 * Public, read-only Owner-approved content source.
 * Drafts, private author identity and unapproved AI content are never returned.
 */
export type GatewayCardKind = "spotlight" | "inspiration";
export type PublishedGatewayCard = {
  id: string;
  title?: string;
  body?: string;
  message?: string;
  attribution?: string;
  theme?: string;
};

export async function getApprovedGatewayCards(
  db: Pick<D1Database, "prepare">,
  kind: GatewayCardKind,
  now = new Date(),
): Promise<PublishedGatewayCard[]> {
  const timestamp = now.toISOString();
  const response = await db.prepare(
    "SELECT id, title, body, message, attribution, theme FROM farmportal_gateway_content " +
    "WHERE kind = ? AND status = 'published' AND approved_by IS NOT NULL " +
    "AND approved_at IS NOT NULL AND approved_at <= ? " +
    "AND published_at IS NOT NULL AND published_at <= ? " +
    "AND (expires_at IS NULL OR expires_at > ?) " +
    "AND ((kind = 'spotlight' AND LENGTH(TRIM(COALESCE(title, ''))) > 0) " +
    "OR (kind = 'inspiration' AND LENGTH(TRIM(COALESCE(message, ''))) > 0)) " +
    "ORDER BY published_at DESC, id DESC LIMIT 20",
  ).bind(kind, timestamp, timestamp, timestamp).all<PublishedGatewayCard>();
  return (response.results || []).map(item => {
    const result: PublishedGatewayCard = { id: item.id };
    if (kind === "spotlight") {
      result.title = (item.title || "").slice(0, 250);
      result.body = (item.body || "").slice(0, 1000);
    } else {
      result.message = (item.message || "").slice(0, 450);
      result.attribution = (item.attribution || "").slice(0, 140);
      result.theme = (item.theme || "").slice(0, 120);
    }
    return result;
  });
}
