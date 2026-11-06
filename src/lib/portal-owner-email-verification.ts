/**
 * Existing staging Owner mailbox proof (not a replacement Owner or a grant).
 * Requires a fresh password on an active session and an email OTP delivered
 * through the staging-only Cloudflare Email binding. No account-scope backfill.
 */
import {
  getSessionAccount, parseCookieHeader, PORTAL_SESSION_COOKIE, verifyPassword,
} from "./portal-auth.ts";
import { PortalAuthFlowError, type PortalAuthChallengeDispatcher } from "./portal-auth-flows.ts";

export const OWNER_EMAIL_PURPOSE = "existing_owner_email_verification" as const;
export const OWNER_EMAIL_MAX_ATTEMPTS = 5;
const APPROVED_COMPANY = "daenem-farms";
const APPROVED_SITE = "balogun-ikire";
const TIMEOUT_MS = 10 * 60_000;
const RATE_MS = 15 * 60_000;
const encoder = new TextEncoder();

type DbAccount = {
  id: string; email: string; status: string; access_state: string; is_owner: number;
  roles_json: string; permissions_json: string; permission_scopes_json: string;
  organization_scope_json: string | null; security_stamp: string; email_verified_at: string | null;
};
type Challenge = {
  id: string; purpose: string; channel: string; account_id: string | null;
  identity_hash: string; code_mac: string; payload_json: string; eligible: number;
  attempt_count: number; max_attempts: number; expires_at: string;
  delivered_at: string | null; consumed_at: string | null; invalidated_at: string | null;
};
export type OwnerEmailDependencies = Readonly<{
  secret: string;
  dispatcher: PortalAuthChallengeDispatcher;
  staging: boolean;
  now?: () => Date;
  codeGenerator?: () => string; // fake only in disposable tests; never from HTTP input
}>;

function deny(code = "OWNER_EMAIL_VERIFICATION_NOT_AVAILABLE", status = 404): never {
  throw new PortalAuthFlowError(code, status);
}
const simpleRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const strArray = (x: unknown): x is string[] => Array.isArray(x) && x.every(v => typeof v === "string");
const scopes = (x: unknown): boolean => simpleRecord(x) &&
  Object.values(x).every(v => typeof v === "string" || strArray(v));
const norm = (x: string) => x.trim().toLowerCase();
const randomId = (prefix: string) => prefix + "_" + Array.from(crypto.getRandomValues(new Uint8Array(18)),
  x => x.toString(16).padStart(2, "0")).join("");
const randomCode = () => {
  const value = new Uint32Array(1);
  const max = Math.floor(2 ** 32 / 1_000_000) * 1_000_000;
  do crypto.getRandomValues(value); while (value[0] >= max);
  return String(value[0] % 1_000_000).padStart(6, "0");
};
async function mac(keyText: string, ...pieces: string[]) {
  if (keyText.length < 32) deny("OWNER_EMAIL_KEY_UNAVAILABLE", 503);
  const key = await crypto.subtle.importKey("raw", encoder.encode(keyText),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(
    ["daenem-farms", "owner-email-proof-v1", ...pieces].join("\u001f"))));
  return Array.from(signed, b => b.toString(16).padStart(2, "0")).join("");
}
const constantTime = (a: string, b: string) => {
  let mismatch = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i % Math.max(a.length, 1)) || 0) ^
      (b.charCodeAt(i % Math.max(b.length, 1)) || 0);
  }
  return mismatch === 0;
};
const json = (s: string): unknown => {
  try { return JSON.parse(s); } catch { return null; }
};

async function strictSnapshot(db: D1Database, id: string): Promise<DbAccount> {
  const row = await db.prepare(
    "SELECT id,email,status,access_state,is_owner,roles_json,permissions_json," +
    "permission_scopes_json,organization_scope_json,security_stamp,email_verified_at " +
    "FROM portal_accounts WHERE id=? LIMIT 1",
  ).bind(id).first<DbAccount>();
  if (!row || row.is_owner !== 1 || row.status !== "active" ||
      row.access_state !== "owner" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email) ||
      !row.security_stamp) deny();
  const owners = await db.prepare("SELECT COUNT(*) AS n FROM portal_accounts WHERE is_owner=1")
    .first<{ n: number }>();
  if (Number(owners?.n) !== 1) deny();
  const collision = await db.prepare(
    "SELECT COUNT(*) AS n FROM portal_accounts WHERE lower(trim(email))=? OR lower(trim(username))=?",
  ).bind(norm(row.email), norm(row.email)).first<{ n: number }>();
  if (Number(collision?.n) !== 1) deny();

  const roles = json(row.roles_json);
  const permissionNames = json(row.permissions_json);
  const grantScopes = json(row.permission_scopes_json);
  const organization = row.organization_scope_json === null ? null : json(row.organization_scope_json);
  const validRole = (r: unknown) => simpleRecord(r) &&
    typeof r.id === "string" && !!r.id.trim() &&
    typeof r.name === "string" && !!r.name.trim() &&
    typeof r.status === "string" &&
    (r.permissions === undefined || strArray(r.permissions)) &&
    (r.deniedPermissions === undefined || strArray(r.deniedPermissions)) &&
    (r.permissionScopes === undefined || scopes(r.permissionScopes));
  if (!Array.isArray(roles) || !roles.length || !roles.every(validRole) ||
      !strArray(permissionNames) || !scopes(grantScopes)) deny();
  if (row.organization_scope_json !== null) {
    if (!simpleRecord(organization)) deny();
    if (organization.companyKey !== APPROVED_COMPANY ||
        organization.locationKey !== APPROVED_SITE) deny();
  }
  const typed = roles as Array<{ id: string; status: string }>;
  if (new Set(typed.map(r => r.id)).size !== typed.length ||
      typed.filter(r => r.id === "owner" && r.status.trim().toLowerCase() === "active").length !== 1 ||
      typed.filter(r => r.id === "owner").length !== 1) deny();

  // A missing legacy company/site scope is tolerated only for THIS account
  // identity proof; it never becomes a module permission or automatic grant.
  // A present scope was validated against the approved company and site above.
  // JSON.parse() and SQLite JSON1 disagree about duplicate keys. Reject all
  // nested duplicates in every authority-bearing JSON document.
  for (const raw of [row.roles_json, row.permissions_json,
    row.permission_scopes_json, row.organization_scope_json].filter((x): x is string => x !== null)) {
    const dup = await db.prepare(
      "SELECT COUNT(*) AS n FROM (SELECT parent,key FROM json_tree(?) " +
      "WHERE typeof(key)='text' GROUP BY parent,key HAVING COUNT(*)>1)",
    ).bind(raw).first<{ n: number }>();
    if (!dup || Number(dup.n) !== 0) deny();
  }
  return row;
}

async function ownerSession(db: D1Database, request: Request) {
  const token = parseCookieHeader(request.headers.get("cookie"))[PORTAL_SESSION_COOKIE];
  if (!token || token.length > 512) deny();
  const session = await getSessionAccount(db, token);
  if (!session) deny();
  const row = await strictSnapshot(db, session.account.id);
  if (row.security_stamp !== session.account.securityStamp ||
      norm(row.email) !== norm(session.account.email)) deny();
  return { row, sessionId: session.sessionId };
}

function assertEnvironment(deps: OwnerEmailDependencies) {
  if (!deps.staging) deny();
  if (!deps.secret || deps.secret.length < 32) deny("OWNER_EMAIL_KEY_UNAVAILABLE", 503);
}
async function identityMac(deps: OwnerEmailDependencies, row: DbAccount) {
  return mac(deps.secret, "identity", row.id, norm(row.email));
}
async function codeMac(deps: OwnerEmailDependencies, row: DbAccount, id: string, code: string) {
  return mac(deps.secret, "challenge", id, row.id, norm(row.email), code);
}
async function snapshotMac(deps: OwnerEmailDependencies, row: DbAccount) {
  return mac(deps.secret, "snapshot", row.security_stamp, row.roles_json,
    row.permissions_json, row.permission_scopes_json, row.organization_scope_json ?? "<NULL>");
}

export async function startExistingOwnerEmailVerification(
  db: D1Database, request: Request, body: Record<string, unknown>, deps: OwnerEmailDependencies,
) {
  assertEnvironment(deps);
  const { row, sessionId } = await ownerSession(db, request);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length > 200 || !await verifyPassword(password, (await db.prepare(
    "SELECT password_hash FROM portal_accounts WHERE id=? LIMIT 1",
  ).bind(row.id).first<{ password_hash: string }>())?.password_hash || "")) deny();
  if (row.email_verified_at?.trim()) return { ok: true, alreadyVerified: true };
  if (!await deps.dispatcher.available("email", OWNER_EMAIL_PURPOSE)) {
    deny("AUTHENTICATION_PROVIDER_UNAVAILABLE", 503);
  }
  const now = deps.now?.() || new Date();
  const identity = await identityMac(deps, row);
  const rateWindowStart = new Date(now.getTime() - RATE_MS).toISOString();
  const count = await db.prepare(
    "SELECT COUNT(*) AS n FROM portal_auth_challenges WHERE purpose=? AND identity_hash=? AND created_at>?",
  ).bind(OWNER_EMAIL_PURPOSE, identity, rateWindowStart).first<{ n: number }>();
  if (Number(count?.n) >= 5) deny("AUTH_CHALLENGE_RATE_LIMIT", 429);

  const id = randomId("owner_email");
  const code = deps.codeGenerator?.() ?? randomCode();
  if (!/^\d{6}$/.test(code)) deny("AUTH_CHALLENGE_GENERATION_FAILED", 503);
  const expiresAt = new Date(now.getTime() + TIMEOUT_MS).toISOString();
  const payload = JSON.stringify({ sessionId, securityStamp: row.security_stamp,
    snapshot: await snapshotMac(deps, row) });
  // The rate check above is advisory; the atomic INSERT predicate is the
  // real concurrency gate. Concurrent starts cannot all observe count=0
  // and send more than five codes to the registered Owner mailbox.
  const issuance = await db.prepare(
    "INSERT INTO portal_auth_challenges (id,purpose,channel,identity_hash,account_id," +
    "destination_masked,code_mac,payload_json,eligible,attempt_count,max_attempts,expires_at,created_at) " +
    "SELECT ?,?,?,?,?,?,?,?,1,0,?,?,? WHERE (SELECT COUNT(*) FROM portal_auth_challenges " +
    "WHERE purpose=? AND identity_hash=? AND created_at>?) < 5",
  ).bind(id, OWNER_EMAIL_PURPOSE, "email", identity, row.id, "registered-email",
    await codeMac(deps, row, id, code), payload, OWNER_EMAIL_MAX_ATTEMPTS,
    expiresAt, now.toISOString(), OWNER_EMAIL_PURPOSE, identity, rateWindowStart).run();
  if (issuance.meta.changes !== 1) deny("AUTH_CHALLENGE_RATE_LIMIT", 429);

  try {
    const delivered = await deps.dispatcher.send({
      challengeId: id, purpose: OWNER_EMAIL_PURPOSE,
      channel: "email", destination: row.email, code, expiresAt,
    });
    // If the Owner account changed during delivery, code cannot later pass
    // the snapshot and session-stamp checks at completion.
    const result = await db.prepare(
      "UPDATE portal_auth_challenges SET delivered_at=?, provider_reference=? " +
      "WHERE id=? AND consumed_at IS NULL AND invalidated_at IS NULL",
    ).bind(now.toISOString(), delivered.providerReference?.slice(0, 160) || null, id).run();
    if (result.meta.changes !== 1) deny("AUTHENTICATION_PROVIDER_UNAVAILABLE", 503);
  } catch {
    await db.prepare(
      "UPDATE portal_auth_challenges SET invalidated_at=? WHERE id=? AND consumed_at IS NULL",
    ).bind(now.toISOString(), id).run().catch(() => undefined);
    deny("AUTHENTICATION_PROVIDER_UNAVAILABLE", 503);
  }
  return { ok: true, challengeId: id, expiresAt,
    message: "Check your existing registered mailbox for a one-time verification code." };
}

export async function completeExistingOwnerEmailVerification(
  db: D1Database, request: Request, body: Record<string, unknown>, deps: OwnerEmailDependencies,
) {
  assertEnvironment(deps);
  const { row, sessionId } = await ownerSession(db, request);
  const id = typeof body.challengeId === "string" ? body.challengeId.trim().slice(0, 160) : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!id || !/^\d{6}$/.test(code)) deny("AUTH_CHALLENGE_INVALID", 400);
  const ch = await db.prepare(
    "SELECT id,purpose,channel,account_id,identity_hash,code_mac,payload_json,eligible," +
    "attempt_count,max_attempts,expires_at,delivered_at,consumed_at,invalidated_at " +
    "FROM portal_auth_challenges WHERE id=? LIMIT 1",
  ).bind(id).first<Challenge>();
  const now = deps.now?.() || new Date();
  const expiresMs = Date.parse(ch?.expires_at || "");
  const deliveredMs = Date.parse(ch?.delivered_at || "");
  let saved: unknown;
  try { saved = JSON.parse(ch?.payload_json || ""); } catch { saved = null; }
  if (!ch || ch.account_id !== row.id || ch.purpose !== OWNER_EMAIL_PURPOSE ||
      ch.channel !== "email" || ch.eligible !== 1 ||
      !ch.delivered_at || ch.consumed_at || ch.invalidated_at ||
      Number(ch.max_attempts) !== OWNER_EMAIL_MAX_ATTEMPTS ||
      Number(ch.attempt_count) >= OWNER_EMAIL_MAX_ATTEMPTS ||
      !Number.isFinite(expiresMs) || expiresMs <= now.getTime() ||
      !Number.isFinite(deliveredMs) || deliveredMs > now.getTime() ||
      deliveredMs >= expiresMs ||
      !simpleRecord(saved) || saved.sessionId !== sessionId ||
      saved.securityStamp !== row.security_stamp ||
      saved.snapshot !== await snapshotMac(deps, row) ||
      !constantTime(ch.identity_hash, await identityMac(deps, row)) ||
      Boolean(row.email_verified_at?.trim())) deny("AUTH_CHALLENGE_INVALID", 400);

  const expected = await codeMac(deps, row, id, code);
  if (!constantTime(ch.code_mac, expected)) {
    // Atomic conditional increment: simultaneous incorrect guesses cannot
    // reset or overwrite each other's attempt counter.
    await db.prepare("UPDATE portal_auth_challenges " +
      "SET attempt_count=attempt_count+1,invalidated_at=CASE WHEN attempt_count+1>=max_attempts " +
      "THEN ? ELSE invalidated_at END WHERE id=? AND attempt_count<max_attempts " +
      "AND consumed_at IS NULL AND invalidated_at IS NULL AND expires_at>?",
    ).bind(now.toISOString(), id, now.toISOString()).run();
    deny("AUTH_CHALLENGE_INVALID", 400);
  }

  const at = now.toISOString(), stamp = randomId("stamp");
  const auditId = randomId("evt");
  const expectedStamp = row.security_stamp;
  const update = db.prepare(
    "UPDATE portal_accounts SET email_verified_at=?,security_stamp=?,updated_at=? WHERE " +
    "id=? AND is_owner=1 AND status='active' AND access_state='owner' " +
    "AND lower(trim(email))=? AND (email_verified_at IS NULL OR trim(email_verified_at)='') " +
    "AND security_stamp=? AND roles_json=? AND permissions_json=? AND permission_scopes_json=? " +
    "AND organization_scope_json IS ? AND " +
    "(SELECT COUNT(*) FROM portal_accounts WHERE is_owner=1)=1 AND " +
    "(SELECT COUNT(*) FROM portal_accounts WHERE lower(trim(email))=? " +
    "OR lower(trim(username))=?)=1 AND EXISTS " +
    "(SELECT 1 FROM portal_sessions WHERE id=? AND account_id=portal_accounts.id " +
    "AND revoked_at IS NULL AND expires_at>? AND security_stamp=?) AND EXISTS " +
    "(SELECT 1 FROM portal_auth_challenges WHERE id=? AND purpose=? AND account_id=portal_accounts.id " +
    "AND channel='email' AND identity_hash=? AND code_mac=? AND eligible=1 " +
    "AND delivered_at IS NOT NULL AND consumed_at IS NULL AND invalidated_at IS NULL " +
    "AND attempt_count<max_attempts AND expires_at>?)",
  ).bind(at, stamp, at, row.id, norm(row.email), expectedStamp,
    row.roles_json, row.permissions_json, row.permission_scopes_json,
    row.organization_scope_json, norm(row.email), norm(row.email),
    sessionId, at, expectedStamp, id, OWNER_EMAIL_PURPOSE, ch.identity_hash, ch.code_mac, at);

  const consume = db.prepare(
    "UPDATE portal_auth_challenges SET consumed_at=? WHERE id=? AND account_id=? " +
    "AND purpose=? AND code_mac=? AND identity_hash=? AND consumed_at IS NULL " +
    "AND invalidated_at IS NULL AND EXISTS (SELECT 1 FROM portal_accounts " +
    "WHERE id=? AND email_verified_at=? AND security_stamp=?)",
  ).bind(at, id, row.id, OWNER_EMAIL_PURPOSE, ch.code_mac, ch.identity_hash,
    row.id, at, stamp);
  const revoke = db.prepare(
    "UPDATE portal_sessions SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL",
  ).bind(at, row.id);
  const invalidateOthers = db.prepare(
    "UPDATE portal_auth_challenges SET invalidated_at=? WHERE account_id=? " +
    "AND id<>? AND consumed_at IS NULL AND invalidated_at IS NULL",
  ).bind(at, row.id, id);
  const invalidateResets = db.prepare(
    "UPDATE portal_auth_reset_capabilities SET consumed_at=? WHERE account_id=? " +
    "AND consumed_at IS NULL",
  ).bind(at, row.id);
  // A NULL audit ID violates NOT NULL and reverses the ENTIRE D1 batch when
  // a concurrent role change/revocation or challenge race causes zero UPDATE.
  const audit = db.prepare(
    "INSERT INTO portal_auth_events(id,account_id,event_type,outcome,safe_metadata_json,created_at) " +
    "VALUES (CASE WHEN EXISTS (SELECT 1 FROM portal_accounts WHERE id=? AND " +
    "email_verified_at=? AND security_stamp=? AND is_owner=1 AND status='active') " +
    "AND EXISTS (SELECT 1 FROM portal_auth_challenges WHERE id=? AND account_id=? " +
    "AND consumed_at=? AND purpose=?) " +
    "AND NOT EXISTS (SELECT 1 FROM portal_sessions WHERE account_id=? AND revoked_at IS NULL) " +
    "AND NOT EXISTS (SELECT 1 FROM portal_auth_reset_capabilities " +
    "WHERE account_id=? AND consumed_at IS NULL) " +
    "THEN ? ELSE NULL END,?,'existing_owner_email_verified','accepted',?,?)",
  ).bind(row.id, at, stamp, id, row.id, at, OWNER_EMAIL_PURPOSE, row.id, row.id,
    auditId, row.id, JSON.stringify({ channel: "email", sessionsRevoked: true,
      grantsUnchanged: true, resetCapabilitiesInvalidated: true, verification: "challenge" }), at);
  try {
    const results = await db.batch([update, consume, revoke, invalidateOthers, invalidateResets, audit]);
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1 ||
        results[5]?.meta?.changes !== 1) deny("OWNER_EMAIL_COMPLETION_FAILED", 409);
  } catch {
    deny("OWNER_EMAIL_COMPLETION_FAILED", 409);
  }
  return { ok: true, verified: true, signInAgain: true,
    message: "Your registered email is verified. Sign in again to continue." };
}
