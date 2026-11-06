import { composeRoleAuthorization } from "./security-authority.ts";
import { PORTAL_AUTHORITY_FINGERPRINT_SQL } from "./portal-authority-fingerprint.ts";

const PORTAL_ME_CONTRACT_VERSION = "6.9.9-flexible" as const;

export const PORTAL_SESSION_COOKIE = "df_session";
export const PASSWORD_ALGORITHM = "pbkdf2-sha256";
export const PASSWORD_ITERATIONS = 120_000;
export const PASSWORD_MIN_LENGTH = 6;
const SESSION_HOURS = 8;
const REMEMBERED_SESSION_DAYS = 30;
const MAX_BODY_BYTES = 20_000;
const DUMMY_PASSWORD_HASH =
  "pbkdf2-sha256$120000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export type PortalAccount = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  phone: string;
  department: string;
  jobTitle: string;
  employeeNo: string;
  status: string;
  accessState: "owner" | "assigned" | "no_role" | "provisional" | "provisional_expired";
  isOwner: boolean;
  provisionalRole: boolean;
  provisionalExpired: boolean;
  roles: Array<{ id: string; name: string; status: string; isSystemOwner: boolean; isWorkflowRole: boolean; permissions?: string[]; deniedPermissions?: string[]; permissionScopes?: Record<string, "own" | "assigned" | "department" | "all"> }>;
  permissions: string[];
  permissionScopes: Record<string, "own" | "assigned" | "department" | "all">;
  organizationScope: Record<string, string> | null;
  lifecycleStatus: string | null;
  securityStamp: string;
};

export type PortalAccountRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  phone: string;
  department: string;
  job_title: string;
  employee_no: string;
  status: string;
  access_state: string;
  is_owner: number;
  provisional_role: number;
  provisional_expired: number;
  roles_json: string;
  permissions_json: string;
  permission_scopes_json: string;
  organization_scope_json: string | null;
  lifecycle_status: string | null;
  security_stamp: string;
};

type SessionRow = PortalAccountRow & {
  session_id: string;
  session_expires_at: string;
  session_security_stamp: string;
  authority_fp: string;
};

const textEncoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomId(prefix: string) {
  return prefix + "_" + base64Url(randomBytes(18));
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}

async function digestBase64(value: string) {
  return base64Url(await digest(value));
}

function constantTimeEqual(left: string, right: string) {
  const a = textEncoder.encode(left);
  const b = textEncoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % Math.max(a.length, 1)] || 0) ^ (b[index % Math.max(b.length, 1)] || 0);
  }
  return difference === 0;
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

export function normalizeIdentity(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 320) : "";
}

export function normalizeUsername(value: unknown) {
  return normalizeIdentity(value).replace(/[^a-z0-9._-]/g, "");
}

export function validatePassword(value: unknown) {
  // Keep the staging authority aligned with the retained Sign-In contract:
  // six characters, at least one letter, and at least one number.
  return typeof value === "string" &&
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= 200 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value);
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derivePassword(password, salt);
  return [PASSWORD_ALGORITHM, PASSWORD_ITERATIONS, bytesToBase64(salt), bytesToBase64(hash)].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  try {
    const [algorithm, iterationText, saltText, hashText] = encoded.split("$");
    const iterations = Number(iterationText);
    if (algorithm !== PASSWORD_ALGORITHM || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 500_000) return false;
    const salt = base64ToBytes(saltText);
    const expected = base64ToBytes(hashText);
    return bytesEqual(expected, await derivePassword(password, salt, iterations));
  } catch {
    return false;
  }
}

export function parseCookieHeader(header: string | null) {
  const cookies: Record<string, string> = {};
  for (const part of (header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export function sessionCookieHeader(token: string, requestUrl: string, maxAge: number) {
  const secure = new URL(requestUrl).protocol === "https:";
  return [
    PORTAL_SESSION_COOKIE + "=" + token,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=" + maxAge,
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(requestUrl: string) {
  return sessionCookieHeader("", requestUrl, 0);
}

function jsonValue<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function accountFromRow(row: PortalAccountRow | null | undefined): PortalAccount | null {
  if (!row || typeof row.id !== "string" || typeof row.email !== "string") return null;
  const roles = jsonValue<PortalAccount["roles"]>(row.roles_json, []);
  const permissions = jsonValue<string[]>(row.permissions_json, []);
  const permissionScopes = jsonValue<PortalAccount["permissionScopes"]>(row.permission_scopes_json, {});
  const organizationScope = jsonValue<Record<string, string> | null>(row.organization_scope_json, null);
  if (!Array.isArray(roles) || !Array.isArray(permissions) || !permissionScopes || (organizationScope !== null && typeof organizationScope !== "object")) return null;
  const accessState = row.access_state as PortalAccount["accessState"];
  if (!["owner", "assigned", "no_role", "provisional", "provisional_expired"].includes(accessState)) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    phone: row.phone || "",
    department: row.department || "",
    jobTitle: row.job_title || "",
    employeeNo: row.employee_no || "",
    status: row.status,
    accessState,
    isOwner: row.is_owner === 1,
    provisionalRole: row.provisional_role === 1,
    provisionalExpired: row.provisional_expired === 1,
    roles,
    permissions,
    permissionScopes,
    organizationScope,
    lifecycleStatus: row.lifecycle_status || null,
    securityStamp: row.security_stamp,
  };
}

export function serializePrincipal(account: PortalAccount) {
  const owner = account.isOwner && account.accessState === "owner";
  // Preserve persisted role status: a disabled Owner must never be replaced by
  // a fabricated active Owner. Contradictory owner flags/roles fail closed.
  const roles = account.roles;
  const activeRole = (role: PortalAccount["roles"][number]) =>
    typeof role?.status === "string" && role.status.trim().toLowerCase() === "active";
  // Persisted JSON is untrusted even after its root has been decoded as an array.
  // Malformed role members and rule arrays must not crash an authenticated request
  // or turn an incoherent legacy role assignment into privileged authority.
  const validRole = (role: PortalAccount["roles"][number]) =>
    role !== null && typeof role === "object" && !Array.isArray(role) &&
    typeof role.id === "string" && Boolean(role.id.trim()) &&
    typeof role.name === "string" && Boolean(role.name.trim()) &&
    typeof role.status === "string" &&
    (role.permissions === undefined || (Array.isArray(role.permissions) && role.permissions.every((permission) => typeof permission === "string"))) &&
    (role.deniedPermissions === undefined || (Array.isArray(role.deniedPermissions) && role.deniedPermissions.every((permission) => typeof permission === "string"))) &&
    (role.permissionScopes === undefined || (
      role.permissionScopes !== null && typeof role.permissionScopes === "object" && !Array.isArray(role.permissionScopes) &&
      Object.values(role.permissionScopes as Record<string, unknown>).every((scope) =>
        typeof scope === "string" || (Array.isArray(scope) && scope.every((candidate: unknown) => typeof candidate === "string"))
      )
    ));
  const rolesWellFormed = roles.every(validRole);
  const ownerRoles = rolesWellFormed ? roles.filter((role) => role.id === "owner") : [];
  const consistentOwner = !owner || (rolesWellFormed && ownerRoles.length > 0 && ownerRoles.every(activeRole));
  const conflictingOwner = !owner && ownerRoles.length > 0;
  // A verified Owner must have an explicitly persisted active Owner role.
  // Never invent one for removed/missing/malformed legacy role data, even when
  // account flags and stale per-account Finance/module grants remain present.
  // A newly verified applicant is provisioned with a server-authoritative
  // provisional flag but no business role rows until Owner review. The v6.9.9
  // workspace contract requires a provisional marker role. Supply that marker
  // ONLY for this exact pending-approval state, and give it ZERO permissions.
  // This also repairs applicants created before this backend correction without
  // mutating hosted D1 or introducing a synthetic Owner/assigned role.
  const pendingApplicantWithoutRole =
    !account.isOwner &&
    account.accessState === "provisional" &&
    account.provisionalRole === true &&
    account.provisionalExpired === false &&
    account.status.toLowerCase() === "active" &&
    account.lifecycleStatus === "pending_owner_review" &&
    rolesWellFormed && roles.length === 0;
  const provisionalMarker = {
    id: "provisional", name: "Provisional Account", status: "active",
    isSystemOwner: false, isWorkflowRole: true,
    permissions: [], deniedPermissions: [],
    permissionScopes: {},
  };
  const authoritativeRoles = rolesWellFormed
    ? owner ? ownerRoles : pendingApplicantWithoutRole ? [provisionalMarker] : roles
    : [];
  // Only wholly active legacy assignments can carry account-level fallback.
  // Explicit rules from active roles remain usable if other roles are revoked.
  const legacyPermissions = rolesWellFormed && roles.length > 0 && roles.every(activeRole)
    ? account.permissions.filter((permission) => permission !== "*")
    : [];
  const composed = composeRoleAuthorization(
    authoritativeRoles,
    legacyPermissions,
    account.permissionScopes,
  );
  // Existing Owner status proves identity, not a permission grant. Persisted
  // per-account grants are still subject to denials from every active role.
  const ownerRoleDenies = owner && rolesWellFormed
    ? roles.filter(activeRole).flatMap((role) => role.deniedPermissions || [])
    : [];
  const deniedPermissions = [...new Set([...composed.deniedPermissions, ...ownerRoleDenies])];
  const permissions = (consistentOwner && !conflictingOwner ? composed.permissions : [])
    .filter((permission) => !deniedPermissions.includes(permission));
  const scopes = Object.fromEntries(permissions.map((permission) => [permission, composed.permissionScopes[permission]]));
  const permissionScopeSets = Object.fromEntries(permissions.map((permission) => [permission, composed.permissionScopeSets[permission]]));
  // Restore the previously approved FarmPortal Owner scope compatibility from PR #53.
  // Only an active, explicitly persisted Owner role with a non-wildcard,
  // server-authored Meta grant may recover the single known staging organization.
  // Never repair missing employee scope, fabricate roles/grants, or override denies.
  const legacyOwnerScope =
    owner && consistentOwner && !conflictingOwner &&
    account.organizationScope === null && account.status.toLowerCase() === "active" &&
    rolesWellFormed && ownerRoles.length > 0 &&
    permissions.includes("META_INTEGRATION_VIEW") &&
    scopes.META_INTEGRATION_VIEW === "all";
  const organizationScope = legacyOwnerScope ? {
    companyKey: "daenem-farms",
    companyLabel: "Daenem Farms",
    departmentKey: "executive-office",
    departmentLabel: account.department || "Executive Office",
    locationKey: "balogun-ikire",
    timezone: "Africa/Lagos",
  } : account.organizationScope;
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    employeeNo: account.employeeNo,
    phone: account.phone,
    department: account.department,
    jobTitle: account.jobTitle,
    status: account.status,
    roles: authoritativeRoles,
    permissions,
    deniedPermissions,
    permissionScopes: scopes,
    permissionScopeSets,
    organizationScope,
    farmAuthorized: Boolean(organizationScope?.locationKey),
    isOwner: owner,
    accessState: owner ? "owner" : account.accessState,
    lifecycle: account.lifecycleStatus ? { status: account.lifecycleStatus } : null,
    provisionalRole: owner ? false : account.provisionalRole,
    provisionalExpired: owner ? false : account.provisionalExpired,
    assignedTimezone: organizationScope?.timezone || "",
    assignedLocation: organizationScope?.locationKey || "",
    rbacReady: rolesWellFormed,
    contractVersion: PORTAL_ME_CONTRACT_VERSION,
    securityStamp: account.securityStamp,
  };
}

// A bootstrap token proves permission to create a staging identity, not approval
// for every business, financial or administrative capability. The actual Owner
// module/company grants must be separately assigned and approved.
export const STAGING_OWNER_BOOTSTRAP_PERMISSIONS = [
  "shell.view",
  "profile.view",
  "profile.edit",
  "profile.security.view",
  "profile.preferences.view",
] as const;

export const STAGING_OPERATOR_PERMISSIONS = [
  "shell.view",
  "dashboard.view",
  "profile.view",
  "profile.edit",
  "myday.view",
  "notifications.view",
  "hr.leave.view",
  "hr.leave.request",
  // Operational access is assigned by an authorized Owner/Admin after bootstrap,
  // never inherited merely because an employee account was provisioned.
];

const scopeFor = (permission: string) =>
  ["profile.view", "profile.edit", "myday.view", "notifications.view", "shell.view", "hr.leave.view", "hr.leave.request"].includes(permission)
    ? "own" as const
    : "assigned" as const;

export function stagingAccountInput(kind: "owner" | "employee", body: Record<string, unknown>) {
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
  const email = normalizeIdentity(body.email);
  const username = normalizeUsername(body.username);
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 80) : "";
  const department = typeof body.department === "string" ? body.department.trim().slice(0, 120) : "";
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim().slice(0, 120) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!displayName || displayName.length < 2 || !email.includes("@") || username.length < 3 || !/^[a-z0-9._-]+$/.test(username) || !validatePassword(password)) return null;
  const scope = {
    companyKey: "daenem-farms",
    companyLabel: "Daenem Farms",
    departmentKey: kind === "owner" ? "executive-office" : "farm-operations",
    departmentLabel: department || (kind === "owner" ? "Executive Office" : "Farm Operations"),
    locationKey: "balogun-ikire",
    timezone: "Africa/Lagos",
  };
  const permissions = kind === "owner"
    ? [...STAGING_OWNER_BOOTSTRAP_PERMISSIONS]
    : [...STAGING_OPERATOR_PERMISSIONS];
  const permissionScopes = Object.fromEntries(permissions.map((permission) => [
    permission,
    kind === "owner" ? "own" : scopeFor(permission),
  ]));
  return {
    id: randomId(kind === "owner" ? "usr_owner" : "usr_employee"),
    username,
    email,
    password,
    displayName,
    phone,
    department: scope.departmentLabel,
    jobTitle: jobTitle || (kind === "owner" ? "Business Owner" : "Farm Operator"),
    employeeNo: kind === "owner" ? "STAGING-OWNER" : "STAGING-OPERATOR",
    status: "active",
    accessState: kind === "owner" ? "owner" as const : "assigned" as const,
    isOwner: kind === "owner",
    provisionalRole: false,
    provisionalExpired: false,
    roles: kind === "owner"
      ? [{ id: "owner", name: "Owner", status: "active", isSystemOwner: true, isWorkflowRole: false }]
      : [{ id: "operator", name: "Farm Operator", status: "active", isSystemOwner: false, isWorkflowRole: false }],
    permissions,
    permissionScopes,
    organizationScope: scope,
    lifecycleStatus: null,
    securityStamp: randomId("stamp"),
  };
}

export async function insertAccount(db: D1Database, input: ReturnType<typeof stagingAccountInput> & object) {
  const passwordHash = await hashPassword(input.password);
  await db.prepare(
    "INSERT INTO portal_accounts (id, username, email, password_hash, display_name, phone, department, job_title, employee_no, status, access_state, is_owner, provisional_role, provisional_expired, roles_json, permissions_json, permission_scopes_json, organization_scope_json, lifecycle_status, security_stamp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    input.id,
    input.username,
    input.email,
    passwordHash,
    input.displayName,
    input.phone,
    input.department,
    input.jobTitle,
    input.employeeNo,
    input.status,
    input.accessState,
    input.isOwner ? 1 : 0,
    input.provisionalRole ? 1 : 0,
    input.provisionalExpired ? 1 : 0,
    JSON.stringify(input.roles),
    JSON.stringify(input.permissions),
    JSON.stringify(input.permissionScopes),
    input.organizationScope ? JSON.stringify(input.organizationScope) : null,
    input.lifecycleStatus,
    input.securityStamp,
    new Date().toISOString(),
    new Date().toISOString(),
  ).run();
}

export async function recordAuthEvent(db: D1Database, accountId: string | null, eventType: string, outcome: string, metadata: Record<string, unknown> = {}) {
  await db.prepare(
    "INSERT INTO portal_auth_events (id, account_id, event_type, outcome, safe_metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(randomId("evt"), accountId, eventType, outcome, JSON.stringify(metadata), new Date().toISOString()).run();
}

export async function findAccountByIdentity(db: D1Database, identity: string) {
  const row = await db.prepare(
    "SELECT id, username, email, password_hash, display_name, phone, department, job_title, employee_no, status, access_state, is_owner, provisional_role, provisional_expired, roles_json, permissions_json, permission_scopes_json, organization_scope_json, lifecycle_status, security_stamp FROM portal_accounts WHERE email = ? OR username = ? LIMIT 1",
  ).bind(normalizeIdentity(identity), normalizeIdentity(identity)).first<PortalAccountRow>();
  return accountFromRow(row);
}

export async function getSessionAccount(db: D1Database, token: string) {
  const tokenHash = await digestBase64(token);
  const row = await db.prepare(
    "SELECT a.id, a.username, a.email, a.password_hash, a.display_name, a.phone, a.department, a.job_title, a.employee_no, a.status, a.access_state, a.is_owner, a.provisional_role, a.provisional_expired, a.roles_json, a.permissions_json, a.permission_scopes_json, a.organization_scope_json, a.lifecycle_status, a.security_stamp, s.id AS session_id, s.expires_at AS session_expires_at, s.security_stamp AS session_security_stamp, " + PORTAL_AUTHORITY_FINGERPRINT_SQL + " AS authority_fp FROM portal_sessions s INNER JOIN portal_accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND a.status = 'active' LIMIT 1",
  ).bind(tokenHash, new Date().toISOString()).first<SessionRow>();
  const account = accountFromRow(row);
  if (!account || !row || row.session_security_stamp !== account.securityStamp) return null;
  return { account, sessionId: row.session_id, authorityFp: row.authority_fp };
}

export async function issueSession(db: D1Database, account: PortalAccount, rememberMe: boolean) {
  const token = base64Url(randomBytes(32));
  const now = new Date();
  const expires = new Date(now.getTime() + (rememberMe ? REMEMBERED_SESSION_DAYS * 86_400_000 : SESSION_HOURS * 3_600_000));
  await db.prepare(
    "INSERT INTO portal_sessions (id, account_id, token_hash, security_stamp, remember_me, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(randomId("ses"), account.id, await digestBase64(token), account.securityStamp, rememberMe ? 1 : 0, expires.toISOString(), now.toISOString(), now.toISOString()).run();
  return { token, expiresAt: expires.toISOString() };
}

export async function revokeSession(db: D1Database, token: string) {
  await db.prepare("UPDATE portal_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), await digestBase64(token)).run();
}

export async function portalHealth(
  db: D1Database | undefined,
  availability: { email?: boolean; whatsapp?: boolean; whatsappSignup?: boolean; google?: boolean; microsoft?: boolean } = {},
) {
  const providers = {
    local: { enabled: true, available: true },
    email: { enabled: true, available: Boolean(availability.email), reason: availability.email ? undefined : "NOT_CONFIGURED" },
    whatsapp: { enabled: true, available: Boolean(availability.whatsapp), reason: availability.whatsapp ? undefined : "NOT_CONFIGURED" },
    whatsappSignup: { enabled: true, available: Boolean(availability.whatsappSignup), reason: availability.whatsappSignup ? undefined : "NOT_CONFIGURED" },
    microsoft: { enabled: true, available: Boolean(availability.microsoft), reason: availability.microsoft ? undefined : "NOT_CONFIGURED" },
    google: { enabled: true, available: Boolean(availability.google), reason: availability.google ? undefined : "NOT_CONFIGURED" },
  };
  const availableMethods = ["password", ...(["email", "whatsapp", "microsoft", "google"] as const).filter((key) => providers[key].available)];
  const base = { service: "daenem-farms-portal", authentication: "multi-provider", availableMethods, providers };
  if (!db) return { ...base, status: "unavailable", error: "PORTAL_DATABASE_UNAVAILABLE" };
  try {
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('portal_accounts', 'portal_sessions', 'portal_auth_events', 'portal_auth_challenges', 'portal_auth_reset_capabilities', 'portal_account_identities', 'portal_oauth_states')").all<{ name: string }>();
    const ready = new Set((tables.results || []).map((row) => row.name));
    if (ready.size < 7) return { ...base, status: "unavailable", error: "PORTAL_AUTH_SCHEMA_UNAVAILABLE" };
    const owner = await db.prepare("SELECT id FROM portal_accounts WHERE is_owner = 1 AND status = 'active' LIMIT 1").first<{ id: string }>();
    const attention = [
      ...(owner ? [] : ["STAGING_BOOTSTRAP_REQUIRED"]),
      ...(["email", "whatsapp", "microsoft", "google"] as const).filter((key) => !providers[key].available).map((key) => key.toUpperCase() + "_NOT_CONFIGURED"),
      ...(!providers.whatsappSignup.available ? ["WHATSAPP_SIGNUP_NOT_CONFIGURED"] : []),
    ];
    return { ...base, status: owner ? "healthy" : "degraded", attention };
  } catch {
    return { ...base, status: "unavailable", error: "PORTAL_AUTH_CHECK_FAILED" };
  }
}

export async function createSessionResponse(db: D1Database, account: PortalAccount, requestUrl: string, rememberMe: boolean) {
  const session = await issueSession(db, account, rememberMe);
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    cookie: sessionCookieHeader(session.token, requestUrl, Math.max(0, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000))),
  };
}

export { DUMMY_PASSWORD_HASH, MAX_BODY_BYTES, constantTimeEqual, accountFromRow };