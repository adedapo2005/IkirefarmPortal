import { findValidResetChallenge, RESET_LIFETIME_MINUTES, RESET_COOLDOWN_MINUTES } from "./portal-password-reset.ts";
const encoder = new TextEncoder();
function randomBytes(length: number) {
  const value = new Uint8Array(length);
  crypto.getRandomValues(value);
  return value;
}
function base64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function ticketId() { return "reset_" + base64url(randomBytes(18)); }
export function dummyChallengeId() { return ticketId(); }
function otpCode() {
  const numbers = new Uint32Array(1);
  crypto.getRandomValues(numbers);
  return String(numbers[0] % 1_000_000).padStart(6, "0");
}
async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}
async function sha256(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
function constantTimeStringEqual(a: string, b: string) {
  let result = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}
export const otpSecretReady = (key: unknown) => typeof key === "string" && key.length >= 32;

/** OTP challenges for the approved deployed gateway's six-digit recovery UX. */
export async function startOtpRecovery(db: D1Database, accountId: string, pepper: string, now = new Date()) {
  if (!otpSecretReady(pepper)) return null;
  const cooldown = new Date(now.getTime() - RESET_COOLDOWN_MINUTES * 60_000).toISOString();
  const pending = await db.prepare(
    "SELECT id FROM portal_password_resets WHERE account_id = ? AND consumed_at IS NULL AND created_at > ? LIMIT 1",
  ).bind(accountId, cooldown).first<{ id: string }>();
  if (pending) return null;
  const id = ticketId();
  const code = otpCode();
  const unusedProofHash = await sha256(base64url(randomBytes(32)));
  await db.prepare(
    "INSERT INTO portal_password_resets " +
    "(id, account_id, token_hash, otp_hash, created_at, expires_at, attempts) VALUES (?, ?, ?, ?, ?, ?, 0)",
  ).bind(id, accountId, unusedProofHash, await hmac(pepper, id + ":" + code),
    now.toISOString(), new Date(now.getTime() + RESET_LIFETIME_MINUTES * 60_000).toISOString()).run();
  return { challengeId: id, code };
}

/**
 * Five guesses at most, tracked in D1. Only a correct OTP yields a random
 * 256-bit completion ticket. The OTP is never exposed through API responses.
 */
export async function verifyOtpRecovery(db: D1Database, challengeId: unknown, code: unknown, pepper: string, now = new Date()) {
  if (!otpSecretReady(pepper) || typeof challengeId !== "string" ||
    !/^reset_[A-Za-z0-9_-]{24}$/.test(challengeId) || typeof code !== "string" ||
    !/^\d{6}$/.test(code)) return null;
  const row = await db.prepare(
    "SELECT otp_hash FROM portal_password_resets WHERE id = ? AND otp_hash IS NOT NULL " +
    "AND consumed_at IS NULL AND verified_at IS NULL AND expires_at > ? AND attempts < 5 LIMIT 1",
  ).bind(challengeId, now.toISOString()).first<{ otp_hash: string }>();
  if (!row) return null;
  const candidate = await hmac(pepper, challengeId + ":" + code);
  const correct = constantTimeStringEqual(candidate, row.otp_hash);
  if (!correct) {
    await db.prepare(
      "UPDATE portal_password_resets SET attempts = attempts + 1 " +
      "WHERE id = ? AND otp_hash IS NOT NULL AND attempts < 5 AND consumed_at IS NULL AND expires_at > ?",
    ).bind(challengeId, now.toISOString()).run();
    return null;
  }
  const proof = base64url(randomBytes(32));
  const updated = await db.prepare(
    "UPDATE portal_password_resets SET attempts = attempts + 1, token_hash = ?, " +
    "otp_hash = NULL, verified_at = ? WHERE id = ? AND otp_hash = ? " +
    "AND consumed_at IS NULL AND verified_at IS NULL AND expires_at > ? AND attempts < 5",
  ).bind(await sha256(proof), now.toISOString(), challengeId, row.otp_hash, now.toISOString()).run();
  return Number(updated.meta?.changes || 0) === 1 ? { challengeId, resetToken: proof } : null;
}

export async function validOtpCompletionTicket(
  db: D1Database, challengeId: unknown, token: unknown, now = new Date(),
) {
  if (typeof challengeId !== "string" || !/^reset_[A-Za-z0-9_-]{24}$/.test(challengeId)) return false;
  const challenge = await findValidResetChallenge(db, token, now);
  if (!challenge || challenge.id !== challengeId) return false;
  const row = await db.prepare(
    "SELECT verified_at FROM portal_password_resets WHERE id = ? AND verified_at IS NOT NULL LIMIT 1",
  ).bind(challengeId).first<{ verified_at: string }>();
  return Boolean(row?.verified_at);
}

/**
 * Verify a six-digit recovery flow's challenge ownership before consuming
 * the one-time completion token. The route integration remains separately
 * gated until security and provider acceptance are complete.
 */
export async function finishOtpRecovery(
  db: D1Database,
  challengeId: unknown,
  resetToken: unknown,
  password: unknown,
  now = new Date(),
): Promise<boolean> {
  if (!await validOtpCompletionTicket(db, challengeId, resetToken, now)) return false;
  const { completePasswordReset } = await import("./portal-password-reset.ts");
  return completePasswordReset(db, resetToken, password, now);
}
