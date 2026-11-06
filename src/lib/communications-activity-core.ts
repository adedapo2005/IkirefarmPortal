// FarmPortal Account B communications activity contract: no credentials, OTPs or message body.
export type ActivityChannel = "WHATSAPP" | "EMAIL" | "SOCIAL_AUTH";
export type ActivityStatus =
  | "PENDING" | "ACCEPTED" | "HELD" | "PAUSED" | "SENT" | "DELIVERED" | "READ" | "DEFERRED"
  | "FAILED" | "BOUNCED" | "REJECTED" | "COMPLAINED" | "STARTED" | "SUCCEEDED" | "CANCELLED" | "EXPIRED";
const VALID = new Set<ActivityStatus>([
  "PENDING", "ACCEPTED", "HELD", "PAUSED", "SENT", "DELIVERED", "READ", "DEFERRED",
  "FAILED", "BOUNCED", "REJECTED", "COMPLAINED", "STARTED", "SUCCEEDED", "CANCELLED", "EXPIRED",
]);
const STATUS_RANK: Record<string,number> = {
  PENDING:0, STARTED:0, ACCEPTED:1, HELD:1, PAUSED:1, DEFERRED:1, SENT:2,
  DELIVERED:3, READ:4, SUCCEEDED:4, FAILED:2, BOUNCED:2,
  REJECTED:2, COMPLAINED:5, CANCELLED:2, EXPIRED:2,
};
export function retentionDays(value: unknown): 15 | 30 {
  if (value === 15 || value === 30) return value;
  throw new Error("ACTIVITY_RETENTION_MUST_BE_15_OR_30");
}
export function expiresAfter(timestamp: string, days: 15 | 30) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) throw new Error("ACTIVITY_TIMESTAMP_INVALID");
  return new Date(time + retentionDays(days) * 86_400_000).toISOString();
}
export function maskedDestination(value: string) {
  const digits = value.replace(/\D/g, "");
  if (value.includes("@")) {
    const parts=value.split("@");
    const domain=parts.length === 2 ? parts[1].toLowerCase() : "";
    return domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)
      ? "***@" + domain.slice(0,120) : "[EMAIL REDACTED]";
  }
  return digits.length >= 8 && digits.length <= 15 ? "+" + "*".repeat(Math.max(4,digits.length-4)) + digits.slice(-4) : "[REDACTED]";
}
export function safeActivityCode(value: unknown) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(value)
    ? value.toUpperCase() : null;
}
export function validActivityStatus(value: unknown): value is ActivityStatus {
  return typeof value === "string" && VALID.has(value as ActivityStatus);
}
const CHANNEL_STATUSES: Record<ActivityChannel,ReadonlySet<ActivityStatus>> = {
  WHATSAPP:new Set(["PENDING","ACCEPTED","HELD","PAUSED","SENT","DELIVERED","READ","FAILED"]),
  EMAIL:new Set(["PENDING","ACCEPTED","SENT","DELIVERED","DEFERRED","FAILED","BOUNCED","REJECTED","COMPLAINED","CANCELLED"]),
  SOCIAL_AUTH:new Set(["STARTED","SUCCEEDED","FAILED","CANCELLED","EXPIRED"]),
};
export function validChannelActivityStatus(channel: ActivityChannel, value: unknown): value is ActivityStatus {
  return validActivityStatus(value) && Boolean(CHANNEL_STATUSES[channel]?.has(value));
}
export function canAdvanceStatus(
  channel: ActivityChannel, oldValue: ActivityStatus, newValue: ActivityStatus,
  oldOccurredAt?: string, newOccurredAt?: string,
) {
  if (!validChannelActivityStatus(channel,oldValue) || !validChannelActivityStatus(channel,newValue) || oldValue === newValue) return false;
  if (channel === "SOCIAL_AUTH") {
    return oldValue === "STARTED" && ["SUCCEEDED","FAILED","CANCELLED","EXPIRED"].includes(newValue);
  }
  if (oldValue === "READ" || oldValue === "BOUNCED" || oldValue === "REJECTED" || oldValue === "COMPLAINED" || oldValue === "CANCELLED") return false;
  if (oldValue === "DELIVERED") return newValue === "READ" || (channel === "EMAIL" && newValue === "COMPLAINED");
  // Sent and Failed are conflicting observations at the same stage. Provider
  // event time resolves their order; Failed wins equal timestamps. Delivered
  // and Read are stronger evidence even if their callbacks arrive late.
  const previous=Date.parse(oldOccurredAt || "");
  const incoming=Date.parse(newOccurredAt || "");
  const comparable=Number.isFinite(previous) && Number.isFinite(incoming);
  if (oldValue === "FAILED") {
    if (newValue === "SENT") return comparable && incoming > previous;
    return ["DELIVERED","READ"].includes(newValue);
  }
  if (oldValue === "SENT" && newValue === "FAILED") return !comparable || incoming >= previous;
  if (newValue === "FAILED" || newValue === "BOUNCED" || newValue === "REJECTED" || (channel === "EMAIL" && newValue === "COMPLAINED")) return true;
  if (newValue === "DEFERRED") return oldValue === "PENDING" || oldValue === "ACCEPTED";
  return (STATUS_RANK[newValue] ?? -1) > (STATUS_RANK[oldValue] ?? -1);
}
export function normalizeWhatsAppSubmissionStatus(value: unknown): "ACCEPTED" | "HELD" | "PAUSED" {
  if (value === "held_for_quality_assessment") return "HELD";
  if (value === "paused") return "PAUSED";
  // A returned wamid is receipt of acceptance for processing, not delivery.
  return "ACCEPTED";
}
export function normalizeWhatsAppStatus(value: unknown): ActivityStatus | null {
  const state=typeof value==="string" ? value.trim().toUpperCase() : "";
  return ["SENT","DELIVERED","READ","FAILED"].includes(state) ? state as ActivityStatus : null;
}
export function normalizeCloudflareEmailEvent(value: unknown): ActivityStatus | null {
  const events:Record<string,ActivityStatus> = {
    "cf.email.sending.message.delivered":"DELIVERED",
    "cf.email.sending.message.deferred":"DEFERRED",
    "cf.email.sending.message.bounced":"BOUNCED",
    "cf.email.sending.message.failed":"FAILED",
    "cf.email.sending.message.rejected":"REJECTED",
    "cf.email.sending.message.complained":"COMPLAINED",
  };
  return typeof value === "string" ? events[value] || null : null;
}
// Deterministic event identity; callers additionally scope it to the private activity ID.
export function activityEventKey(messageId: string,status:string,at:string) {
  if (messageId.length < 8 || messageId.length > 240 || !/^[A-Za-z0-9._:=+/-]+$/.test(messageId)) throw new Error("ACTIVITY_PROVIDER_REFERENCE_INVALID");
  if (!validActivityStatus(status)) throw new Error("ACTIVITY_STATUS_INVALID");
  if (!Number.isFinite(Date.parse(at))) throw new Error("ACTIVITY_TIMESTAMP_INVALID");
  return messageId + ":" + status + ":" + at;
}

/** Private recipient correlation. Only this digest and a masked address persist.
 * Binding the normalized address to its provider reference prevents correlation
 * across unrelated messages. Never include this key in an Owner API response. */
export async function activityRecipientKey(providerRef: string, recipient: string): Promise<string> {
  const normalized=recipient.trim().toLowerCase();
  if (!providerRef || providerRef.length>240 || !/^[A-Za-z0-9._:=+/-]+$/.test(providerRef)) throw new Error("ACTIVITY_PROVIDER_REFERENCE_INVALID");
  if (normalized.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) throw new Error("ACTIVITY_RECIPIENT_INVALID");
  const value=JSON.stringify(["farmportal-email-recipient-v1",providerRef,normalized]);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return [...digest].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

/** Stable nonreversible reference for the 256-bit, single-use OAuth state.
 * Never log or persist the raw state, verifier, callback code, or credentials. */
export async function oauthActivityReference(state: unknown): Promise<string | null> {
  if (typeof state !== "string" || !/^[A-Za-z0-9_-]{32,120}$/.test(state)) return null;
  const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(state)));
  let raw="";
  for(const byte of hashed) raw+=String.fromCharCode(byte);
  return btoa(raw).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
}