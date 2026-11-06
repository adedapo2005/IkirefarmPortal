/**
 * FarmPortal-only: per-operation Meta change approval.
 * Every protected change requires fresh Owner password confirmation, a short-lived
 * signed action digest, the same authorized session, and atomic single-use D1 audit.
 * No unlock flag, bearer token, or credential is persisted in a configuration table.
 */
import { verifyPassword } from "./portal-auth.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";

export const META_APPROVAL_TTL_MS = 120_000;
export const META_APPROVAL_HEADER = "x-daenem-meta-owner-approval";
export const META_OWNER_APPROVAL_REQUIRED = "META_CONFIGURATION_LOCKED_OWNER_APPROVAL_REQUIRED";
const AUDIT_CONNECTION = "meta-daenem-farms-organization";
const ISSUER = "DAENEM_FARMS_META_OWNER_ACTION_V2:";
const encoder = new TextEncoder();

type Claim = {
  version: 2; nonce: string; accountId: string; sessionId: string;
  securityStamp: string; method: string; path: string; bodySha256: string;
  connectionVersion: number; issuedAt: number; expiresAt: number;
};

function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function decodeB64url(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,3000}$/.test(value)) throw new Error("BAD_TOKEN_FORMAT");
  const raw = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, (value) => value.charCodeAt(0));
}
function hex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}
export async function metaApprovalBodyHash(raw: string): Promise<string> {
  if (encoder.encode(raw).length > 20_000) throw new Error("META_APPROVAL_BODY_TOO_LARGE");
  let canonical = "";
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("META_APPROVAL_JSON_OBJECT_REQUIRED");
    canonical = JSON.stringify(parsed);
  }
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonical))));
}
async function principalStampDigest(stamp: string): Promise<string> {
  // The validated RBAC fingerprint can contain hundreds of permissions and scopes.
  // Bind the approval to its complete contents without placing raw RBAC data into
  // a short-lived HTTP header, which must remain below the 3,500-character cap.
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(ISSUER + "RBAC:" + stamp))));
}
function isSafePath(path: string) {
  return path.length <= 240 && path.split("/").every((segment) =>
    /^[A-Za-z0-9._-]{1,120}$/.test(segment) && segment !== "." && segment !== "..");
}
export function metaActionCanBeApproved(method: string, path: string) {
  if (!["PUT", "POST", "DELETE"].includes(method) || !isSafePath(path)) return false;
  const match = (value: string) => path === value;
  if (method === "PUT") return [
    "configuration", "products", "wabas/select", "phones/select",
    "template-mappings", "auth-policies",
  ].some(match) || /^templates\/[A-Za-z0-9._-]+$/.test(path);
  if (method === "DELETE") return /^credentials\/(meta_app_secret|system_user_access_token|webhook_verify_token)$/.test(path);
  return [
    "wabas/discover", "phones/discover", "templates/sync", "templates",
    "subscriptions/check", "subscriptions/subscribe", "template-mappings",
    "auth-policies", "test-connection",
  ].some(match) || /^credentials\/(meta_app_secret|system_user_access_token|webhook_verify_token)$/.test(path);
}
const NON_CLEARABLE_META_IDENTIFIERS = new Set([
  "business_portfolio_id", "meta_app_id", "system_user_id", "graph_api_version",
  "waba_id", "phone_number_id", "webhook_callback_url",
]);

export function metaOwnerPayloadIsSafeToApply(method: string, path: string, payload: unknown) {
  if (method !== "PUT" || path !== "configuration") return true;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  return Object.entries(payload as Record<string, unknown>).every(([key, value]) =>
    !NON_CLEARABLE_META_IDENTIFIERS.has(key) || (typeof value === "string" && value.trim().length > 0));
}

export function metaApprovalOwnerEligible(principal: AuthenticatedPrincipal) {
  return principal.status.toLowerCase() === "active"
    && principal.isOwner && principal.accessState === "owner"
    && principal.restriction === "none" && principal.farmAuthorized
    && principal.organizationScope?.companyKey === "daenem-farms"
    && Boolean(principal.organizationScope?.locationKey)
    && principal.roles.some((role) => role.id === "owner"
      && role.status.toLowerCase() === "active" && role.isSystemOwner);
}
async function signatureKey(masterKey: string) {
  if (masterKey.length < 24) throw new Error("META_OWNER_SIGNING_KEY_UNAVAILABLE");
  return crypto.subtle.importKey("raw", encoder.encode(masterKey),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function signMetaApprovalClaim(masterKey: string, claim: Claim) {
  const payload = b64url(encoder.encode(JSON.stringify(claim)));
  const signature = await crypto.subtle.sign("HMAC", await signatureKey(masterKey), encoder.encode(ISSUER + payload));
  return payload + "." + b64url(new Uint8Array(signature));
}
export async function verifyMetaApprovalClaim(masterKey: string, token: string): Promise<Claim | null> {
  try {
    if (token.length > 3500 || !token.includes(".")) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const key = await signatureKey(masterKey);
    const valid = await crypto.subtle.verify("HMAC", key, decodeB64url(parts[1]), encoder.encode(ISSUER + parts[0]));
    if (!valid) return null;
    const claim: Claim = JSON.parse(new TextDecoder().decode(decodeB64url(parts[0]))) as Claim;
    if (claim?.version !== 2 || !/^[0-9a-f]{64}$/.test(claim.securityStamp) || typeof claim.nonce !== "string"
      || !/^[0-9a-f-]{36}$/i.test(claim.nonce)
      || !claim.accountId || !claim.sessionId || !claim.securityStamp
      || !metaActionCanBeApproved(claim.method, claim.path)
      || !/^[0-9a-f]{64}$/.test(claim.bodySha256)
      || !Number.isSafeInteger(claim.connectionVersion) || claim.connectionVersion < 1
      || !Number.isSafeInteger(claim.issuedAt) || !Number.isSafeInteger(claim.expiresAt)
      || claim.expiresAt - claim.issuedAt !== META_APPROVAL_TTL_MS) return null;
    return claim;
  } catch { return null; }
}
async function connectionVersion(db: D1Database) {
  const result = await db.prepare(
    "SELECT version FROM integration_connections WHERE id = ? AND organization_id = 'daenem-farms' LIMIT 1",
  ).bind(AUDIT_CONNECTION).first<{ version: number }>();
  return Number(result?.version || 0);
}
async function audit(db: D1Database, id: string, actorId: string, event: string, outcome: string, data: Record<string, unknown>, once = false) {
  const statement = "INSERT INTO integration_audit_events " +
    "(id, connection_id, organization_id, farm_id, actor_id, event_type, target_type, target_id, outcome, safe_metadata_json, correlation_id, created_at) " +
    "VALUES (?, ?, 'daenem-farms', NULL, ?, ?, 'owner_change_approval', NULL, ?, ?, ?, ?) " +
    (once ? "ON CONFLICT(id) DO NOTHING" : "");
  const result = await db.prepare(statement).bind(id, AUDIT_CONNECTION, actorId, event, outcome,
    JSON.stringify(data), crypto.randomUUID(), new Date().toISOString()).run();
  return Number(result.meta?.changes || 0) === 1;
}
export async function issueMetaOwnerApproval(input: {
  db: D1Database; principal: AuthenticatedPrincipal; sessionId: string;
  method: string; path: string; payload: unknown; password: string;
  confirmation: string; masterKey: string; now?: number;
}) {
  const { db, principal, sessionId, method, path, password, confirmation, masterKey } = input;
  if (!metaApprovalOwnerEligible(principal) || !metaActionCanBeApproved(method, path)
    || confirmation !== "AUTHORIZE" || typeof password !== "string"
    || password.length < 6 || password.length > 200) return null;
  const cutoff = new Date((input.now ?? Date.now()) - 15 * 60_000).toISOString();
  const failed = await db.prepare(
    "SELECT COUNT(*) AS attempts FROM integration_audit_events " +
    "WHERE actor_id = ? AND event_type = 'meta.owner.approval.denied' AND created_at >= ?",
  ).bind(principal.id, cutoff).first<{ attempts: number }>();
  if (Number(failed?.attempts || 0) >= 5) return null;
  // The route already resolves a fresh, non-revoked session with getSessionAccount,
  // which verifies portal_sessions.security_stamp against portal_accounts.security_stamp.
  // principal.securityStamp is a *derived RBAC fingerprint*, not that database stamp.
  // Comparing them rejects even the correct Owner password.
  const account = await db.prepare(
    "SELECT password_hash, is_owner, status FROM portal_accounts WHERE id = ? LIMIT 1",
  ).bind(principal.id).first<{ password_hash: string; is_owner: number; status: string }>();
  const passwordValid = Boolean(account && account.is_owner === 1 && account.status === "active"
    && await verifyPassword(password, account.password_hash));
  if (!passwordValid) {
    await audit(db, crypto.randomUUID(), principal.id, "meta.owner.approval.denied", "DENIED", { reason: "PASSWORD_NOT_VERIFIED" });
    return null;
  }
  const payloadRaw = method === "DELETE" ? "" : JSON.stringify(input.payload);
  if (method !== "DELETE" && (!input.payload || typeof input.payload !== "object"
    || Array.isArray(input.payload) || payloadRaw === undefined)) return null;
  if (method === "DELETE" && input.payload !== null) return null;
  if (!metaOwnerPayloadIsSafeToApply(method, path, input.payload)) return null;
  const bodySha256 = await metaApprovalBodyHash(payloadRaw);
  const version = await connectionVersion(db);
  if (version < 1) return null;
  const now = input.now ?? Date.now();
  const claim: Claim = {
    version: 2, nonce: crypto.randomUUID(), accountId: principal.id, sessionId,
    securityStamp: await principalStampDigest(principal.securityStamp), method, path, bodySha256,
    connectionVersion: version, issuedAt: now, expiresAt: now + META_APPROVAL_TTL_MS,
  };
  const token = await signMetaApprovalClaim(masterKey, claim);
  if (token.length > 3500) return null;
  await audit(db, crypto.randomUUID(), principal.id, "meta.owner.approval.issued", "ISSUED",
    { method, path, connectionVersion: version, expiresAt: new Date(claim.expiresAt).toISOString() });
  return { token, expiresAt: new Date(claim.expiresAt).toISOString() };
}
export async function consumeMetaOwnerApproval(input: {
  db: D1Database | undefined; request: Request; principal: AuthenticatedPrincipal;
  sessionId: string; method: string; path: string; masterKey: string; now?: number;
}) {
  const { db, request, principal, sessionId, method, path, masterKey } = input;
  if (!db || !metaApprovalOwnerEligible(principal) || !metaActionCanBeApproved(method, path)) return false;
  const token = request.headers.get(META_APPROVAL_HEADER) || "";
  if (!token || token.length > 3500) return false;
  const claim = await verifyMetaApprovalClaim(masterKey, token);
  const now = input.now ?? Date.now();
  if (!claim || now < claim.issuedAt || now >= claim.expiresAt ||
    claim.accountId !== principal.id || claim.securityStamp !== await principalStampDigest(principal.securityStamp) ||
    claim.method !== method || claim.path !== path) return false;
  if (!sessionId || sessionId !== claim.sessionId) return false;
  const raw = await request.clone().text();
  let digest: string;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!metaOwnerPayloadIsSafeToApply(method, path, parsed)) return false;
    digest = await metaApprovalBodyHash(raw);
  } catch { return false; }
  if (digest !== claim.bodySha256) return false;
  if (await connectionVersion(db) !== claim.connectionVersion) return false;
  // Unique D1 id makes simultaneous replay fail atomically. Consumed BEFORE external APIs/writes.
  return audit(db, "meta-owner-consumed-" + claim.nonce, principal.id,
    "meta.owner.approval.consumed", "AUTHORIZED",
    { method, path, connectionVersion: claim.connectionVersion }, true);
}
