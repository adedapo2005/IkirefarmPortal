import { accountFromRow, normalizeIdentity, normalizeUsername, type PortalAccount, type PortalAccountRow } from "./portal-auth.ts";
import { newApplicantNoticeStatements } from "./portal-registration-notifications.ts";

export type PortalOAuthProvider = "google" | "microsoft";
type RuntimeVars = Record<string, string | undefined>;
type OAuthCookie = { state: string; verifier: string; provider: PortalOAuthProvider; returnTo: string; link: boolean; issuedAt: number };

export class PortalProviderError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const accountColumns = "id, username, email, password_hash, display_name, phone, department, job_title, employee_no, status, access_state, is_owner, provisional_role, provisional_expired, roles_json, permissions_json, permission_scopes_json, organization_scope_json, lifecycle_status, security_stamp";

function randomBytes(length: number) {
  const value = new Uint8Array(length);
  crypto.getRandomValues(value);
  return value;
}
function base64Url(bytes: Uint8Array) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}
function randomToken(length = 32) { return base64Url(randomBytes(length)); }
async function sha256(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
async function hmac(secret: string, value: string) {
  if (secret.length < 24) throw new PortalProviderError("OAUTH_STATE_KEY_UNAVAILABLE", 503);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}
function safeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) difference |= (left.charCodeAt(i % Math.max(1, left.length)) || 0) ^ (right.charCodeAt(i % Math.max(1, right.length)) || 0);
  return difference === 0;
}
function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/app.html";
  return value.slice(0, 500);
}
function stateCookie(value: string, requestUrl: string, maxAge: number) {
  const secure = new URL(requestUrl).protocol === "https:";
  return ["df_oauth=" + value, "Path=/api/portal/v69/auth/oauth", "HttpOnly", "SameSite=Lax", secure ? "Secure" : "", "Max-Age=" + maxAge].filter(Boolean).join("; ");
}
export function clearOAuthCookie(requestUrl: string) { return stateCookie("", requestUrl, 0); }

function config(vars: RuntimeVars, provider: PortalOAuthProvider, origin: string) {
  const redirectUri = origin + "/api/portal/v69/auth/oauth/" + provider + "/callback";
  if (provider === "google") {
    const clientId = vars.FARMS_AUTH_GOOGLE_CLIENT_ID || "";
    const clientSecret = vars.FARMS_AUTH_GOOGLE_CLIENT_SECRET || "";
    return {
      provider, clientId, clientSecret, redirectUri,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
    };
  }
  const tenant = (vars.FARMS_AUTH_MICROSOFT_TENANT_ID || "").trim();
  const safeTenant = /^[0-9a-f-]{36}$/i.test(tenant) || ["common", "organizations", "consumers"].includes(tenant) ? tenant : "";
  const clientId = vars.FARMS_AUTH_MICROSOFT_CLIENT_ID || "";
  const clientSecret = vars.FARMS_AUTH_MICROSOFT_CLIENT_SECRET || "";
  return {
    provider, clientId, clientSecret, redirectUri,
    authorizeUrl: safeTenant ? `https://login.microsoftonline.com/${safeTenant}/oauth2/v2.0/authorize` : "",
    tokenUrl: safeTenant ? `https://login.microsoftonline.com/${safeTenant}/oauth2/v2.0/token` : "",
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile",
  };
}
export function oauthProviderConfigured(vars: RuntimeVars, provider: PortalOAuthProvider, origin: string) {
  const current = config(vars, provider, origin);
  return Boolean(current.clientId && current.clientSecret && current.authorizeUrl && current.tokenUrl);
}

async function signedCookie(value: OAuthCookie, secret: string) {
  const payload = base64Url(encoder.encode(JSON.stringify(value)));
  return payload + "." + await hmac(secret, payload);
}
async function readSignedCookie(raw: string, secret: string): Promise<OAuthCookie> {
  const separator = raw.lastIndexOf(".");
  if (separator < 1) throw new PortalProviderError("OAUTH_STATE_INVALID", 400);
  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!safeEqual(signature, await hmac(secret, payload))) throw new PortalProviderError("OAUTH_STATE_INVALID", 400);
  let value: OAuthCookie;
  try { value = JSON.parse(decoder.decode(decodeBase64Url(payload))) as OAuthCookie; }
  catch { throw new PortalProviderError("OAUTH_STATE_INVALID", 400); }
  if (!value || !["google", "microsoft"].includes(value.provider) || Date.now() - Number(value.issuedAt) > 10 * 60_000) {
    throw new PortalProviderError("OAUTH_STATE_EXPIRED", 410);
  }
  return value;
}

export async function startPortalOAuth(input: {
  db: D1Database; vars: RuntimeVars; provider: PortalOAuthProvider; requestUrl: string;
  returnTo?: unknown; link?: boolean; linkAccountId?: string | null;
}) {
  const url = new URL(input.requestUrl);
  const providerConfig = config(input.vars, input.provider, url.origin);
  if (!oauthProviderConfigured(input.vars, input.provider, url.origin)) throw new PortalProviderError("OAUTH_PROVIDER_NOT_CONFIGURED", 503);
  const state = randomToken();
  const verifier = randomToken(48);
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
  await input.db.prepare(
    "INSERT INTO portal_oauth_states (state_hash, provider, link_account_id, return_to, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(await sha256(state), input.provider, input.link ? input.linkAccountId || null : null, safeReturnTo(input.returnTo), expiresAt, now.toISOString()).run();
  const cookie = await signedCookie({
    state, verifier, provider: input.provider, returnTo: safeReturnTo(input.returnTo), link: Boolean(input.link), issuedAt: now.getTime(),
  }, input.vars.FARMS_INTEGRATION_MASTER_KEY || "");
  const destination = new URL(providerConfig.authorizeUrl);
  destination.search = new URLSearchParams({
    client_id: providerConfig.clientId,
    redirect_uri: providerConfig.redirectUri,
    response_type: "code",
    scope: providerConfig.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { redirect: destination.toString(), cookie: stateCookie(cookie, input.requestUrl, 600) };
}

type ProviderIdentity = { subject: string; email: string; displayName: string; emailVerified: boolean; tenant: string | null };

async function exchangeIdentity(vars: RuntimeVars, provider: PortalOAuthProvider, requestUrl: string, code: string, verifier: string): Promise<ProviderIdentity> {
  const providerConfig = config(vars, provider, new URL(requestUrl).origin);
  const tokenBody = new URLSearchParams({
    client_id: providerConfig.clientId,
    client_secret: providerConfig.clientSecret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: providerConfig.redirectUri,
  });
  const tokenResponse = await fetch(providerConfig.tokenUrl, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: tokenBody.toString(), signal: AbortSignal.timeout(10_000),
  }).catch(() => { throw new PortalProviderError("OAUTH_PROVIDER_CONNECTION_FAILED", 502); });
  const token = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  if (!tokenResponse.ok || !accessToken) throw new PortalProviderError("OAUTH_TOKEN_EXCHANGE_FAILED", 502);
  const profileResponse = await fetch(providerConfig.userInfoUrl, {
    headers: { authorization: "Bearer " + accessToken, accept: "application/json" }, signal: AbortSignal.timeout(10_000),
  }).catch(() => { throw new PortalProviderError("OAUTH_PROVIDER_CONNECTION_FAILED", 502); });
  const profile = await profileResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!profileResponse.ok) throw new PortalProviderError("OAUTH_PROFILE_UNAVAILABLE", 502);
  const subject = typeof profile.sub === "string" ? profile.sub.slice(0, 320) : "";
  const candidateEmail = typeof profile.email === "string" ? profile.email : typeof profile.preferred_username === "string" ? profile.preferred_username : "";
  const email = normalizeIdentity(candidateEmail);
  const googleVerified = provider !== "google" || profile.email_verified === true || profile.email_verified === "true";
  if (!subject || !email.includes("@") || !googleVerified) throw new PortalProviderError("OAUTH_VERIFIED_EMAIL_REQUIRED", 409);
  return {
    subject, email, displayName: (typeof profile.name === "string" ? profile.name : email.split("@")[0]).trim().slice(0, 120),
    emailVerified: true, tenant: typeof profile.tid === "string" ? profile.tid.slice(0, 120) : null,
  };
}

async function accountById(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT ${accountColumns} FROM portal_accounts WHERE id = ? LIMIT 1`).bind(id).first<PortalAccountRow>();
  return accountFromRow(row);
}
async function accountByEmail(db: D1Database, email: string) {
  const row = await db.prepare(`SELECT ${accountColumns} FROM portal_accounts WHERE email = ? LIMIT 1`).bind(email).first<PortalAccountRow>();
  return accountFromRow(row);
}
async function identityAccount(db: D1Database, provider: PortalOAuthProvider, subject: string) {
  const row = await db.prepare(
    `SELECT ${accountColumns.split(", ").map(column => "a." + column).join(", ")} FROM portal_account_identities i JOIN portal_accounts a ON a.id = i.account_id WHERE i.provider = ? AND i.provider_subject = ? LIMIT 1`,
  ).bind(provider, subject).first<PortalAccountRow>();
  return accountFromRow(row);
}
async function linkIdentity(db: D1Database, accountId: string, provider: PortalOAuthProvider, identity: ProviderIdentity) {
  const conflict = await db.prepare("SELECT account_id FROM portal_account_identities WHERE provider = ? AND provider_subject = ? LIMIT 1")
    .bind(provider, identity.subject).first<{ account_id: string }>();
  if (conflict && conflict.account_id !== accountId) throw new PortalProviderError("PROVIDER_ACCOUNT_CONFLICT", 409);
  const accountProvider = await db.prepare("SELECT provider_subject FROM portal_account_identities WHERE account_id = ? AND provider = ? LIMIT 1")
    .bind(accountId, provider).first<{ provider_subject: string }>();
  if (accountProvider && accountProvider.provider_subject !== identity.subject) throw new PortalProviderError("PROVIDER_ACCOUNT_CONFLICT", 409);
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO portal_account_identities (id, account_id, provider, provider_subject, provider_email, provider_phone, email_verified, phone_verified, tenant_id, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, NULL, 1, 0, ?, ?, ?, ?) ON CONFLICT(provider, provider_subject) DO UPDATE SET provider_email = excluded.provider_email, tenant_id = excluded.tenant_id, updated_at = excluded.updated_at, last_login_at = excluded.last_login_at",
  ).bind("pid_" + randomToken(18), accountId, provider, identity.subject, identity.email, identity.tenant, now, now, now).run();
}
async function createProviderAccount(db: D1Database, provider: PortalOAuthProvider, identity: ProviderIdentity) {
  const now = new Date().toISOString();
  const id = "usr_provisional_" + randomToken(18);
  const base = normalizeUsername(identity.email.split("@")[0]).slice(0, 24) || "employee";
  const username = base + "-" + randomToken(5).toLowerCase();
  // Provider-created employees do not have a local password. A non-PBKDF2
  // sentinel is deliberately unverifiable by verifyPassword(); applicants
  // must use OAuth or a separately verified password-reset process.
  const passwordHash = "oauth-only$" + randomToken(32);
  const permissions = ["shell.view", "profile.view", "profile.edit", "notifications.view"];
  const scopes = Object.fromEntries(permissions.map(permission => [permission, "own"]));
  const securityStamp = "stamp_" + randomToken(18);
  try {
    // Create the applicant, provider identity and durable notifications in
    // one D1 transaction. A failed provider link must not leave an orphaned
    // applicant or false "registration received" email.
    await db.batch([
      db.prepare(
        "INSERT INTO portal_accounts (id, username, email, password_hash, display_name, phone, email_verified_at, phone_verified_at, department, job_title, employee_no, status, access_state, is_owner, provisional_role, provisional_expired, roles_json, permissions_json, permission_scopes_json, organization_scope_json, lifecycle_status, security_stamp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', ?, NULL, '', '', '', 'active', 'provisional', 0, 1, 0, '[]', ?, ?, NULL, 'pending_owner_review', ?, ?, ?)",
      ).bind(id, username, identity.email, passwordHash, identity.displayName || "DAENEM Employee", now, JSON.stringify(permissions), JSON.stringify(scopes), securityStamp, now, now),
      db.prepare(
        "INSERT INTO portal_account_identities (id, account_id, provider, provider_subject, provider_email, provider_phone, email_verified, phone_verified, tenant_id, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, NULL, 1, 0, ?, ?, ?, ?)",
      ).bind("pid_" + randomToken(18), id, provider, identity.subject, identity.email, identity.tenant, now, now, now),
      ...newApplicantNoticeStatements(db, id, now),
    ]);
    const account = await accountById(db, id);
    if (!account) throw new PortalProviderError("ACCOUNT_CREATION_UNAVAILABLE", 503);
    return account;
  } catch (error) {
    if (error instanceof PortalProviderError) throw error;
    // No provider tokens, personal data, SQL parameters or OAuth codes in logs.
    console.error("FARMS_OAUTH_NEW_ACCOUNT_FAILURE", { provider, type: error instanceof Error ? error.name : typeof error });
    throw new PortalProviderError("OAUTH_ACCOUNT_CREATION_UNAVAILABLE", 503);
  }
}

type OAuthStateInput = {
  db:D1Database; vars:RuntimeVars; provider:PortalOAuthProvider; state:unknown; cookie:string;
};
async function consumePortalOAuthState(input:OAuthStateInput) {
  const state=typeof input.state==="string"?input.state:"";
  if(!state||!input.cookie)throw new PortalProviderError("OAUTH_CALLBACK_INVALID",400);
  const saved=await readSignedCookie(input.cookie,input.vars.FARMS_INTEGRATION_MASTER_KEY||"");
  if(saved.provider!==input.provider||!safeEqual(saved.state,state))throw new PortalProviderError("OAUTH_STATE_INVALID",400);
  const now=new Date().toISOString();
  const consumed=await input.db.prepare(
    "UPDATE portal_oauth_states SET consumed_at = ? WHERE state_hash = ? AND provider = ? AND consumed_at IS NULL AND expires_at > ?",
  ).bind(now,await sha256(state),input.provider,now).run();
  if(Number(consumed.meta?.changes||0)!==1)throw new PortalProviderError("OAUTH_STATE_INVALID",400);
  return saved;
}
// A provider cancellation is trusted only after the same signed, one-use
// browser/state/provider binding as a successful callback. No token exchange.
export async function consumePortalOAuthCancellation(input:OAuthStateInput) {
  await consumePortalOAuthState(input);
}
export async function completePortalOAuth(input: {
  db: D1Database; vars: RuntimeVars; provider: PortalOAuthProvider; requestUrl: string;
  code: unknown; state: unknown; cookie: string; currentAccountId?: string | null;
  onStateConsumed?:()=>void;
}) {
  const code=typeof input.code==="string"?input.code:"";
  if(!code)throw new PortalProviderError("OAUTH_CALLBACK_INVALID",400);
  const saved=await consumePortalOAuthState(input);
  input.onStateConsumed?.();
  const identity = await exchangeIdentity(input.vars, input.provider, input.requestUrl, code, saved.verifier);
  let account: PortalAccount | null = null;
  if (saved.link) {
    if (!input.currentAccountId) throw new PortalProviderError("AUTHENTICATION_REQUIRED", 401);
    account = await accountById(input.db, input.currentAccountId);
    if (!account) throw new PortalProviderError("AUTHENTICATION_REQUIRED", 401);
    await linkIdentity(input.db, account.id, input.provider, identity);
  } else {
    account = await identityAccount(input.db, input.provider, identity.subject);
    if (!account) {
      account = await accountByEmail(input.db, identity.email);
      if (account) await linkIdentity(input.db, account.id, input.provider, identity);
      else account = await createProviderAccount(input.db, input.provider, identity);
    }
  }
  if (account.status.toLowerCase() !== "active") throw new PortalProviderError("ACCOUNT_UNAVAILABLE", 403);
  return { account, returnTo: saved.returnTo, linked: saved.link };
}
