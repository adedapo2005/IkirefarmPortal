import { hashPassword, validatePassword } from "./portal-auth.ts";

export const RESET_LIFETIME_MINUTES = 15;
export const RESET_COOLDOWN_MINUTES = 5;
export const RESET_TOKEN_BYTES = 32;

type ResetRecord = {
  id: string;
  account_id: string;
  expires_at: string;
  consumed_at: string | null;
};

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const rand = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};
const randomId = () => "reset_" + b64url(rand(18));
const sha256url = async (value: string) =>
  b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
const isTokenShape = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export const isResetTokenShape = isTokenShape;

export async function createResetChallenge(db: D1Database, accountId: string, now = new Date()) {
  const cooldown = new Date(now.getTime() - RESET_COOLDOWN_MINUTES * 60_000).toISOString();
  const pending = await db.prepare(
    "SELECT id FROM portal_password_resets WHERE account_id = ? AND consumed_at IS NULL AND created_at > ? LIMIT 1",
  ).bind(accountId, cooldown).first<{ id: string }>();
  if (pending) return null;
  const token = b64url(rand(RESET_TOKEN_BYTES));
  const id = randomId();
  await db.prepare(
    "INSERT INTO portal_password_resets (id, account_id, token_hash, created_at, expires_at, attempts) VALUES (?, ?, ?, ?, ?, 0)",
  ).bind(id, accountId, await sha256url(token), now.toISOString(),
    new Date(now.getTime() + RESET_LIFETIME_MINUTES * 60_000).toISOString()).run();
  // Caller must transmit the token only to the registered mailbox. Never log it.
  return { id, token };
}

export async function invalidateResetChallenge(db: D1Database, id: string) {
  await db.prepare("UPDATE portal_password_resets SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
    .bind(new Date().toISOString(), id).run();
}

export async function findValidResetChallenge(db: D1Database, token: unknown, now = new Date()) {
  if (!isTokenShape(token)) return null;
  const hash = await sha256url(token as string);
  const challenge = await db.prepare(
    "SELECT r.id, r.account_id, r.expires_at, r.consumed_at FROM portal_password_resets r " +
    "JOIN portal_accounts a ON a.id = r.account_id " +
    "WHERE r.token_hash = ? AND r.consumed_at IS NULL AND r.expires_at > ? " +
    "AND r.attempts < 5 AND a.status = 'active' LIMIT 1",
  ).bind(hash, now.toISOString()).first<ResetRecord>();
  return challenge || null;
}

export async function completePasswordReset(db: D1Database, token: unknown, password: unknown, now = new Date()) {
  if (!isTokenShape(token) || !validatePassword(password)) return false;
  const challenge = await findValidResetChallenge(db, token, now);
  if (!challenge) return false;
  // Claim the token exactly once before any credential mutation. A competing
  // request can never claim the same reset ticket twice.
  const claimed = await db.prepare(
    "UPDATE portal_password_resets SET consumed_at = ?, attempts = attempts + 1 " +
    "WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5",
  ).bind(now.toISOString(), challenge.id, now.toISOString()).run();
  if (Number(claimed.meta?.changes || 0) !== 1) return false;
  const passwordHash = await hashPassword(password as string);
  const stamp = "stamp_" + b64url(rand(24));
  // D1 batch is transactional: updating the password and invalidating every
  // existing session succeed or fail together. Failed batches leave the reset
  // token unusable, never half-valid.
  const actions = await db.batch([
    db.prepare(
      "UPDATE portal_accounts SET password_hash = ?, security_stamp = ?, updated_at = ? WHERE id = ? AND status = 'active'",
    ).bind(passwordHash, stamp, now.toISOString(), challenge.account_id),
    db.prepare(
      "UPDATE portal_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL",
    ).bind(now.toISOString(), challenge.account_id),
  ]);
  return Number(actions[0]?.meta?.changes || 0) === 1;
}
