import { accountFromRow, hashPassword, normalizeIdentity, normalizeUsername, validatePassword, type PortalAccount, type PortalAccountRow } from "./portal-auth.ts";
import { newApplicantNoticeStatements } from "./portal-registration-notifications.ts";

export const AUTH_CHALLENGE_EXPIRY_SECONDS = 10 * 60;
export const AUTH_RESET_CAPABILITY_SECONDS = 10 * 60;
export const AUTH_CHALLENGE_MAX_ATTEMPTS = 5;
export const AUTH_CHALLENGE_RATE_WINDOW_MS = 15 * 60_000;
export const AUTH_CHALLENGE_MAX_REQUESTS = 5;

export type PortalAuthPurpose = "signup" | "password_reset" | "whatsapp_login" | "existing_owner_email_verification";
export type PortalAuthChannel = "email" | "sms" | "whatsapp";

export class PortalAuthFlowError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export type PortalAuthChallengeDelivery = Readonly<{
  challengeId: string;
  purpose: PortalAuthPurpose;
  channel: PortalAuthChannel;
  destination: string;
  code: string;
  expiresAt: string;
}>;

export interface PortalAuthChallengeDispatcher {
  available(channel: PortalAuthChannel, purpose: PortalAuthPurpose): Promise<boolean>;
  send(delivery: PortalAuthChallengeDelivery): Promise<{ providerReference?: string }>;
}

export const unavailablePortalAuthDispatcher: PortalAuthChallengeDispatcher = {
  async available() { return false; },
  async send() { throw new PortalAuthFlowError("AUTHENTICATION_PROVIDER_UNAVAILABLE", 503); },
};

type ChallengeRow = {
  id: string;
  purpose: PortalAuthPurpose;
  channel: PortalAuthChannel;
  identity_hash: string;
  account_id: string | null;
  destination_masked: string;
  code_mac: string;
  payload_json: string;
  eligible: number;
  attempt_count: number;
  max_attempts: number;
  expires_at: string;
  delivered_at: string | null;
  provider_reference: string | null;
  consumed_at: string | null;
  invalidated_at: string | null;
  created_at: string;
};

type ResetCapabilityRow = {
  id: string;
  challenge_id: string;
  account_id: string;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
};

type SignupPayload = {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  phone: string;
  department: string;
  jobTitle: string;
};

type ContactAccountRow = PortalAccountRow & {
  email_verified_at: string | null;
  phone_verified_at: string | null;
};

type VerifiedContactAccount = {
  account: PortalAccount;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};

type ChallengeDependencies = Readonly<{
  secret: string;
  dispatcher: PortalAuthChallengeDispatcher;
  now?: () => Date;
  codeGenerator?: () => string;
}>;

const encoder = new TextEncoder();

function randomBytes(length: number) {
  const value = new Uint8Array(length);
  crypto.getRandomValues(value);
  return value;
}

function base64Url(value: Uint8Array) {
  let raw = "";
  for (const byte of value) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomId(prefix: string) {
  return `${prefix}_${base64Url(randomBytes(18))}`;
}

function secureCode() {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

async function hmac(secret: string, parts: readonly string[]) {
  if (secret.length < 24) throw new PortalAuthFlowError("AUTH_CHALLENGE_KEY_UNAVAILABLE", 503);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(parts.join("\u001f")));
  return base64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index % Math.max(left.length, 1)) || 0) ^ (right.charCodeAt(index % Math.max(right.length, 1)) || 0);
  }
  return difference === 0;
}

function parseJson<T>(value: string): T | null {
  try { return JSON.parse(value) as T; } catch { return null; }
}

function boundedText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? prefix + digits : "";
}

function channel(value: unknown, allowed: readonly PortalAuthChannel[]) {
  return typeof value === "string" && allowed.includes(value.toLowerCase() as PortalAuthChannel)
    ? value.toLowerCase() as PortalAuthChannel
    : null;
}

function maskDestination(value: string, selectedChannel: PortalAuthChannel) {
  if (selectedChannel === "email") {
    const [local, domain] = value.split("@");
    return local && domain ? `${local.slice(0, 1)}***@${domain}` : "email";
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "phone";
}

async function findAccount(db: D1Database, identity: string, byPhone = false): Promise<VerifiedContactAccount | null> {
  const normalized = byPhone ? normalizePhone(identity) : normalizeIdentity(identity);
  if (!normalized) return null;
  // Match both canonical and legacy stored phone variants without making
  // an unverified phone eligible for WhatsApp authentication.
  const digits = byPhone ? normalized.replace(/\D/g, "") : "";
  const where = byPhone ? "phone IN (?, ?) AND phone_verified_at IS NOT NULL" : "email = ? OR username = ?";
  const statement = db.prepare(
    `SELECT id, username, email, password_hash, display_name, phone, department, job_title, employee_no, status, access_state, is_owner, provisional_role, provisional_expired, roles_json, permissions_json, permission_scopes_json, organization_scope_json, lifecycle_status, security_stamp, email_verified_at, phone_verified_at FROM portal_accounts WHERE ${where} LIMIT 1`,
  );
  const row = byPhone
    ? await statement.bind("+" + digits, digits).first<ContactAccountRow>()
    : await statement.bind(normalized, normalized).first<ContactAccountRow>();
  const account = accountFromRow(row);
  return account && row ? { account, emailVerifiedAt: row.email_verified_at, phoneVerifiedAt: row.phone_verified_at } : null;
}

async function identityHash(secret: string, purpose: PortalAuthPurpose, identity: string) {
  return hmac(secret, ["daenem-farms", "portal-auth-identity", purpose, normalizeIdentity(identity)]);
}

async function codeMac(secret: string, challengeId: string, purpose: PortalAuthPurpose, accountId: string | null, code: string) {
  return hmac(secret, ["daenem-farms", "portal-auth-challenge", challengeId, purpose, accountId || "unassigned", code]);
}

async function tokenHash(secret: string, capabilityId: string, token: string) {
  return hmac(secret, ["daenem-farms", "portal-auth-reset", capabilityId, token]);
}

async function rateLimit(db: D1Database, hash: string, purpose: PortalAuthPurpose, now: Date) {
  const since = new Date(now.getTime() - AUTH_CHALLENGE_RATE_WINDOW_MS).toISOString();
  const row = await db.prepare(
    "SELECT COUNT(*) AS count FROM portal_auth_challenges WHERE identity_hash = ? AND purpose = ? AND created_at > ?",
  ).bind(hash, purpose, since).first<{ count: number }>();
  if (Number(row?.count || 0) >= AUTH_CHALLENGE_MAX_REQUESTS) throw new PortalAuthFlowError("AUTH_CHALLENGE_RATE_LIMIT", 429);
}

async function persistAndDispatch(
  db: D1Database,
  dependencies: ChallengeDependencies,
  input: {
    purpose: PortalAuthPurpose;
    selectedChannel: PortalAuthChannel;
    identity: string;
    accountId: string | null;
    destination: string;
    payload: Record<string, unknown>;
    eligible: boolean;
  },
) {
  const now = dependencies.now?.() || new Date();
  if (!await dependencies.dispatcher.available(input.selectedChannel, input.purpose)) {
    throw new PortalAuthFlowError("AUTHENTICATION_PROVIDER_UNAVAILABLE", 503);
  }
  const idHash = await identityHash(dependencies.secret, input.purpose, input.identity);
  await rateLimit(db, idHash, input.purpose, now);
  const challengeId = randomId("auth_challenge");
  const code = dependencies.codeGenerator?.() || secureCode();
  if (!/^\d{6}$/.test(code)) throw new PortalAuthFlowError("AUTH_CHALLENGE_GENERATION_FAILED", 503);
  const expiresAt = new Date(now.getTime() + AUTH_CHALLENGE_EXPIRY_SECONDS * 1000).toISOString();
  const mac = await codeMac(dependencies.secret, challengeId, input.purpose, input.accountId, code);
  await db.prepare(
    "INSERT INTO portal_auth_challenges (id, purpose, channel, identity_hash, account_id, destination_masked, code_mac, payload_json, eligible, attempt_count, max_attempts, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
  ).bind(
    challengeId,
    input.purpose,
    input.selectedChannel,
    idHash,
    input.accountId,
    maskDestination(input.destination, input.selectedChannel),
    mac,
    JSON.stringify(input.payload),
    input.eligible ? 1 : 0,
    AUTH_CHALLENGE_MAX_ATTEMPTS,
    expiresAt,
    now.toISOString(),
  ).run();
  if (!input.eligible) return { challengeId, expiresAt };
  try {
    const delivery = await dependencies.dispatcher.send({
      challengeId,
      purpose: input.purpose,
      channel: input.selectedChannel,
      destination: input.destination,
      code,
      expiresAt,
    });
    await db.prepare(
      "UPDATE portal_auth_challenges SET delivered_at = ?, provider_reference = ? WHERE id = ? AND invalidated_at IS NULL",
    ).bind(now.toISOString(), boundedText(delivery.providerReference, 160) || null, challengeId).run();
  } catch {
    await db.prepare("UPDATE portal_auth_challenges SET invalidated_at = ? WHERE id = ? AND consumed_at IS NULL")
      .bind(now.toISOString(), challengeId).run();
    throw new PortalAuthFlowError("AUTHENTICATION_PROVIDER_UNAVAILABLE", 503);
  }
  return { challengeId, expiresAt };
}

async function challenge(db: D1Database, challengeId: unknown) {
  const id = boundedText(challengeId, 160);
  if (!id) throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  const row = await db.prepare(
    "SELECT id, purpose, channel, identity_hash, account_id, destination_masked, code_mac, payload_json, eligible, attempt_count, max_attempts, expires_at, delivered_at, provider_reference, consumed_at, invalidated_at, created_at FROM portal_auth_challenges WHERE id = ? LIMIT 1",
  ).bind(id).first<ChallengeRow>();
  if (!row) throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  return row;
}

async function verifyChallenge(
  db: D1Database,
  dependencies: ChallengeDependencies,
  expectedPurpose: PortalAuthPurpose,
  challengeId: unknown,
  codeValue: unknown,
) {
  const row = await challenge(db, challengeId);
  const now = dependencies.now?.() || new Date();
  const code = boundedText(codeValue, 12);
  if (row.purpose !== expectedPurpose || row.consumed_at || row.invalidated_at || !row.delivered_at || Date.parse(row.expires_at) <= now.getTime()) {
    throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  }
  if (row.attempt_count >= row.max_attempts) throw new PortalAuthFlowError("AUTH_CHALLENGE_ATTEMPTS_EXCEEDED", 429);
  const candidate = await codeMac(dependencies.secret, row.id, row.purpose, row.account_id, code);
  if (!/^\d{6}$/.test(code) || !safeEqual(candidate, row.code_mac)) {
    const next = row.attempt_count + 1;
    await db.prepare(
      "UPDATE portal_auth_challenges SET attempt_count = ?, invalidated_at = CASE WHEN ? >= max_attempts THEN ? ELSE invalidated_at END WHERE id = ? AND consumed_at IS NULL",
    ).bind(next, next, now.toISOString(), row.id).run();
    throw new PortalAuthFlowError(next >= row.max_attempts ? "AUTH_CHALLENGE_ATTEMPTS_EXCEEDED" : "AUTH_CHALLENGE_INVALID", next >= row.max_attempts ? 429 : 400);
  }
  if (row.eligible !== 1 || !row.account_id && expectedPurpose !== "signup") {
    await db.prepare("UPDATE portal_auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
      .bind(now.toISOString(), row.id).run();
    throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  }
  return { row, now };
}

async function signupInput(body: Record<string, unknown>) {
  const email = normalizeIdentity(body.email);
  const suppliedUsername = normalizeUsername(body.username);
  const rawDisplayName = boundedText(body.displayName, 120);
  const emailLocalPart = email.split("@")[0] || "";
  const usesApprovedEmailOnlyForm =
    suppliedUsername === normalizeUsername(emailLocalPart) &&
    rawDisplayName.toLowerCase() === emailLocalPart.toLowerCase();
  // The locked employee Create Account screen supplies email-local-part defaults.
  // Preserve that screen; derive a stable, collision-resistant username on the server.
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email)));
  const suffix = Array.from(digest.slice(0, 6), byte => byte.toString(16).padStart(2, "0")).join("");
  const base = normalizeUsername(emailLocalPart).slice(0, 24) || "employee";
  const username = usesApprovedEmailOnlyForm || suppliedUsername.length < 3
    ? base + "-" + suffix : suppliedUsername;
  const displayName = rawDisplayName.length >= 2 ? rawDisplayName : "New Employee";
  const phone = normalizePhone(body.phone);
  const department = boundedText(body.department, 120);
  const jobTitle = boundedText(body.jobTitle, 120);
  const password = typeof body.password === "string" ? body.password : "";
  const acceptedTerms = body.terms === true || body.terms === "on" || body.terms === "true";
  const selectedChannel = channel(body.channel, ["email", "sms", "whatsapp"]);
  if (
    username.length < 3 || !/^[a-z0-9._-]+$/.test(username) ||
    !email.includes("@") || email.length > 320 || displayName.length < 2 ||
    !validatePassword(password) || !acceptedTerms || !selectedChannel ||
    ((selectedChannel === "sms" || selectedChannel === "whatsapp") && !phone)
  ) throw new PortalAuthFlowError("SIGNUP_INPUT_INVALID", 400);
  return { username, email, displayName, phone, department, jobTitle, password, selectedChannel };
}

export async function startPortalSignup(db: D1Database, body: Record<string, unknown>, dependencies: ChallengeDependencies) {
  const input = await signupInput(body);
  const identityExisting = await db.prepare("SELECT id FROM portal_accounts WHERE email = ? OR username = ? LIMIT 1")
    .bind(input.email, input.username).first<{ id: string }>();
  // Historical accounts may store the same international number with or
  // without the + prefix. Neither representation may bypass phone ownership.
  const phoneDigits = input.phone.replace(/\D/g, "");
  const phoneExisting = (input.selectedChannel === "sms" || input.selectedChannel === "whatsapp")
    ? await db.prepare("SELECT id FROM portal_accounts WHERE phone IN (?, ?) AND phone_verified_at IS NOT NULL LIMIT 1")
      .bind("+" + phoneDigits, phoneDigits).first<{ id: string }>()
    : null;
  const existing = identityExisting || phoneExisting;
  const passwordHash = await hashPassword(input.password);
  const payload: SignupPayload = {
    username: input.username,
    email: input.email,
    passwordHash,
    displayName: input.displayName,
    phone: input.phone,
    department: input.department,
    jobTitle: input.jobTitle,
  };
  const destination = input.selectedChannel === "email" ? input.email : input.phone;
  const result = await persistAndDispatch(db, dependencies, {
    purpose: "signup",
    selectedChannel: input.selectedChannel,
    // Throttle paid phone-code destinations across different applicant emails
    // and +/- number representations, while preserving email signup limits.
    identity: input.selectedChannel === "email" ? input.email : phoneDigits,
    accountId: existing ? `duplicate_${randomId("account")}` : randomId("usr_provisional"),
    destination,
    payload: existing ? {} : payload,
    eligible: !existing,
  });
  await recordSafeAuthEvent(db, null, "signup_challenge", "accepted", { channel: input.selectedChannel });
  return { ok: true, challengeId: result.challengeId, expiresAt: result.expiresAt, message: "If these details can be used, a one-time account creation code has been sent." };
}

function provisionalInsert(db: D1Database, accountId: string, payload: SignupPayload, verifiedChannel: PortalAuthChannel, at: string) {
  const permissions = ["shell.view", "profile.view", "profile.edit", "notifications.view"];
  const scopes = Object.fromEntries(permissions.map((permission) => [permission, "own"]));
  return db.prepare(
    "INSERT INTO portal_accounts (id, username, email, password_hash, display_name, phone, email_verified_at, phone_verified_at, department, job_title, employee_no, status, access_state, is_owner, provisional_role, provisional_expired, roles_json, permissions_json, permission_scopes_json, organization_scope_json, lifecycle_status, security_stamp, created_at, updated_at) " +
    "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'active', 'provisional', 0, 1, 0, '[]', ?, ?, NULL, 'pending_owner_review', ?, ?, ? " +
    "WHERE (? = 1 OR NOT EXISTS (SELECT 1 FROM portal_accounts WHERE phone IN (?, ?) AND phone_verified_at IS NOT NULL))",
  ).bind(
    accountId,
    payload.username,
    payload.email,
    payload.passwordHash,
    payload.displayName,
    payload.phone,
    verifiedChannel === "email" ? at : null,
    (verifiedChannel === "sms" || verifiedChannel === "whatsapp") ? at : null,
    payload.department,
    payload.jobTitle,
    JSON.stringify(permissions),
    JSON.stringify(scopes),
    randomId("stamp"),
    at,
    at,
    verifiedChannel === "email" ? 1 : 0,
    "+" + payload.phone.replace(/\D/g, ""),
    payload.phone.replace(/\D/g, ""),
  );
}

export async function verifyPortalSignup(db: D1Database, body: Record<string, unknown>, dependencies: ChallengeDependencies) {
  const { row, now } = await verifyChallenge(db, dependencies, "signup", body.challengeId, body.code);
  const payload = parseJson<SignupPayload>(row.payload_json);
  if (!payload || !row.account_id || !payload.passwordHash || !payload.email || !payload.username) {
    throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  }
  try {
    const results = await db.batch([
      db.prepare("UPDATE portal_auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL")
        .bind(now.toISOString(), row.id),
      // The conditional INSERT checks phone ownership inside the same D1
      // serialized write batch. A second valid challenge cannot create a
      // conflicting verified-phone account after the first challenge wins.
      provisionalInsert(db, row.account_id, payload, row.channel, now.toISOString()),
      db.prepare(
        "INSERT INTO portal_auth_events (id, account_id, event_type, outcome, safe_metadata_json, created_at) " +
        "SELECT ?, ?, 'signup', 'accepted', ?, ? " +
        "WHERE EXISTS (SELECT 1 FROM portal_accounts WHERE id = ?)",
      ).bind(
        randomId("evt"), row.account_id,
        JSON.stringify(safeMetadata({ accessState: "provisional", verifiedChannel: row.channel })),
        now.toISOString(), row.account_id,
      ),
      ...newApplicantNoticeStatements(db, row.account_id, now.toISOString()),
    ]);
    if (Number(results[1]?.meta?.changes || 0) !== 1) {
      throw new PortalAuthFlowError("ACCOUNT_CREATION_UNAVAILABLE", 409);
    }
  } catch {
    throw new PortalAuthFlowError("ACCOUNT_CREATION_UNAVAILABLE", 409);
  }
  return { ok: true, message: "Account created. The Owner will review your provisional access." };
}

export async function startPortalPasswordReset(db: D1Database, body: Record<string, unknown>, dependencies: ChallengeDependencies) {
  const identity = normalizeIdentity(body.identity);
  const selectedChannel = channel(body.channel, ["email", "sms"]);
  if (!identity || !selectedChannel) throw new PortalAuthFlowError("RESET_INPUT_INVALID", 400);
  const contact = await findAccount(db, identity);
  const account = contact?.account || null;
  const verified = selectedChannel === "email" ? contact?.emailVerifiedAt : contact?.phoneVerifiedAt;
  const destination = selectedChannel === "email" ? account?.email || "" : normalizePhone(account?.phone || "");
  // Whitespace-only verification state is not possession proof.
  const eligible = Boolean(account && account.status.toLowerCase() === "active" &&
    typeof verified === "string" && verified.trim() && destination);
  const result = await persistAndDispatch(db, dependencies, {
    purpose: "password_reset",
    selectedChannel,
    identity,
    accountId: account?.id || null,
    destination,
    payload: {},
    eligible,
  });
  await recordSafeAuthEvent(db, null, "password_reset_challenge", "accepted", { channel: selectedChannel });
  return { ok: true, challengeId: result.challengeId, expiresAt: result.expiresAt, message: "If the account is eligible, a one-time password reset code has been sent." };
}

export async function verifyPortalPasswordReset(db: D1Database, body: Record<string, unknown>, dependencies: ChallengeDependencies) {
  const { row, now } = await verifyChallenge(db, dependencies, "password_reset", body.challengeId, body.code);
  if (!row.account_id) throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  const capabilityId = randomId("reset_capability");
  const token = base64Url(randomBytes(32));
  const expiresAt = new Date(now.getTime() + AUTH_RESET_CAPABILITY_SECONDS * 1000).toISOString();
  await db.batch([
    db.prepare("UPDATE portal_auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL")
      .bind(now.toISOString(), row.id),
    db.prepare("INSERT INTO portal_auth_reset_capabilities (id, challenge_id, account_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(capabilityId, row.id, row.account_id, await tokenHash(dependencies.secret, capabilityId, token), expiresAt, now.toISOString()),
    authEventStatement(db, row.account_id, "password_reset_verified", "accepted", {}, now.toISOString()),
  ]);
  return { ok: true, resetToken: `${capabilityId}.${token}`, expiresAt };
}

export async function completePortalPasswordReset(db: D1Database, body: Record<string, unknown>, dependencies: ChallengeDependencies) {
  const challengeId = boundedText(body.challengeId, 160);
  const supplied = boundedText(body.resetToken, 512);
  const separator = supplied.indexOf(".");
  const capabilityId = separator > 0 ? supplied.slice(0, separator) : "";
  const token = separator > 0 ? supplied.slice(separator + 1) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!challengeId || !capabilityId || !token || !validatePassword(password)) throw new PortalAuthFlowError("RESET_COMPLETION_INVALID", 400);
  const capability = await db.prepare(
    "SELECT id, challenge_id, account_id, token_hash, expires_at, consumed_at FROM portal_auth_reset_capabilities WHERE id = ? AND challenge_id = ? LIMIT 1",
  ).bind(capabilityId, challengeId).first<ResetCapabilityRow>();
  const now = dependencies.now?.() || new Date();
  const suppliedHash = await tokenHash(dependencies.secret, capabilityId, token);
  if (!capability || capability.consumed_at || Date.parse(capability.expires_at) <= now.getTime() || !safeEqual(capability.token_hash, suppliedHash)) {
    throw new PortalAuthFlowError("RESET_COMPLETION_INVALID", 400);
  }
  const passwordHash = await hashPassword(password);
  const securityStamp = randomId("stamp");
  const results = await db.batch([
    db.prepare("UPDATE portal_accounts SET password_hash = ?, security_stamp = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM portal_auth_reset_capabilities WHERE id = ? AND challenge_id = ? AND token_hash = ? AND consumed_at IS NULL AND expires_at > ?)")
      .bind(passwordHash, securityStamp, now.toISOString(), capability.account_id, capability.id, challengeId, suppliedHash, now.toISOString()),
    db.prepare("UPDATE portal_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL")
      .bind(now.toISOString(), capability.account_id),
    db.prepare("UPDATE portal_auth_reset_capabilities SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
      .bind(now.toISOString(), capability.id),
    authEventStatement(db, capability.account_id, "password_reset", "accepted", { sessionsRevoked: true }, now.toISOString()),
  ]);
  if (statementChanges(results[0]) !== 1) throw new PortalAuthFlowError("RESET_COMPLETION_INVALID", 400);
  const account = await db.prepare("SELECT username FROM portal_accounts WHERE id = ? LIMIT 1")
    .bind(capability.account_id).first<{ username: string }>();
  return { ok: true, username: account?.username || "", message: "Password updated. Sign in again on your devices." };
}

export async function startPortalWhatsAppLogin(db: D1Database, body: Record<string, unknown>, dependencies: ChallengeDependencies) {
  const identity = boundedText(body.identity, 320);
  if (!identity) throw new PortalAuthFlowError("WHATSAPP_LOGIN_INPUT_INVALID", 400);
  const contact = await findAccount(db, identity) || await findAccount(db, identity, true);
  const account = contact?.account || null;
  const destination = normalizePhone(account?.phone || "");
  const eligible = Boolean(account && account.status.toLowerCase() === "active" && contact?.phoneVerifiedAt && destination);
  const result = await persistAndDispatch(db, dependencies, {
    purpose: "whatsapp_login",
    selectedChannel: "whatsapp",
    identity,
    accountId: account?.id || null,
    destination,
    payload: {},
    eligible,
  });
  await recordSafeAuthEvent(db, null, "whatsapp_login_challenge", "accepted", { channel: "whatsapp" });
  return { ok: true, challengeId: result.challengeId, expiresAt: result.expiresAt, message: "If the account is eligible, a one-time WhatsApp sign-in code has been sent." };
}

export async function verifyPortalWhatsAppLogin(db: D1Database, body: Record<string, unknown>, dependencies: ChallengeDependencies) {
  const { row, now } = await verifyChallenge(db, dependencies, "whatsapp_login", body.challengeId, body.code);
  if (!row.account_id) throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  const account = await findAccountById(db, row.account_id);
  if (!account || account.status.toLowerCase() !== "active") throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  const results = await db.batch([
    db.prepare("UPDATE portal_auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL")
      .bind(now.toISOString(), row.id),
    authEventStatement(db, account.id, "whatsapp_login", "accepted", { providerVerified: true }, now.toISOString()),
  ]);
  if (statementChanges(results[0]) !== 1) throw new PortalAuthFlowError("AUTH_CHALLENGE_INVALID", 400);
  return account;
}

export async function findAccountById(db: D1Database, id: string) {
  const row = await db.prepare(
    "SELECT id, username, email, password_hash, display_name, phone, department, job_title, employee_no, status, access_state, is_owner, provisional_role, provisional_expired, roles_json, permissions_json, permission_scopes_json, organization_scope_json, lifecycle_status, security_stamp FROM portal_accounts WHERE id = ? LIMIT 1",
  ).bind(id).first<PortalAccountRow>();
  return accountFromRow(row);
}

function safeMetadata(metadata: Record<string, unknown>) {
  const forbidden = /password|secret|token|cookie|code|otp|credential|hash/i;
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => !forbidden.test(key) && ["string", "number", "boolean"].includes(typeof value)));
}

function statementChanges(result: unknown) {
  if (!result || typeof result !== "object" || !("meta" in result)) return 0;
  const meta = (result as { meta?: { changes?: unknown } }).meta;
  return typeof meta?.changes === "number" ? meta.changes : 0;
}

function authEventStatement(db: D1Database, accountId: string | null, eventType: string, outcome: string, metadata: Record<string, unknown>, at: string) {
  return db.prepare(
    "INSERT INTO portal_auth_events (id, account_id, event_type, outcome, safe_metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(randomId("evt"), accountId, eventType, outcome, JSON.stringify(safeMetadata(metadata)), at);
}

async function recordSafeAuthEvent(db: D1Database, accountId: string | null, eventType: string, outcome: string, metadata: Record<string, unknown>) {
  await authEventStatement(db, accountId, eventType, outcome, metadata, new Date().toISOString()).run();
}
