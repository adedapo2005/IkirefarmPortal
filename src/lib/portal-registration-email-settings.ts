import type { CloudflareEmailBinding } from "./portal-recovery-mailer.ts";
// The Owner-selected sender is fixed to the verified DAENEM domain;
// recipient routing is independently configurable in Admin Center.
export const REGISTRATION_EMAIL_FROM = "notifications@daenem.com";

type Vars = Record<string, string | undefined>;
type PreferencesRow = {
  notifications_enabled: number; applicant_confirmations_enabled: number;
  owner_alerts_enabled: number; decision_emails_enabled: number;
  historical_backfill_enabled: number; revision: number; updated_at: string;
};
type RecipientRow = {
  id: string; email: string; label: string; enabled: number; is_primary: number;
  verified_at: string | null; verification_nonce: string | null;
  verification_hash: string | null; verification_expires_at: string | null;
  verification_sent_at: string | null; verification_attempts: number;
};

export class RegistrationSettingsError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
const fail = (code: string, status = 422): never => { throw new RegistrationSettingsError(code, status); };
const validAddress = (email: string) =>
  email.length <= 254 && /^[^\s@<>]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email);
const date = (d: Date) => d.toISOString();
const flag = (value: unknown, name: string) => {
  if (typeof value !== "boolean") return fail("INVALID_" + name.toUpperCase());
  return value ? 1 : 0;
};
const MINUTE = 60_000;
const TEN_MINUTES = 10 * MINUTE;
const byteHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");

export function registrationSendingConfig(binding?: CloudflareEmailBinding) {
  // Native Cloudflare Email Sending needs no third-party key. The dedicated
  // Worker binding is restricted to notifications@daenem.com; actual domain
  // onboarding and account sending entitlement are verified by Cloudflare.
  return binding ? { from: REGISTRATION_EMAIL_FROM } : null;
}
async function audit(db: D1Database, actorId: string, action: string, targetId: string | null, at: string) {
  await db.prepare(
    "INSERT INTO portal_registration_notice_settings_audit (id, actor_id, action, target_id, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), actorId, action, targetId, at).run();
}

export async function readRegistrationEmailSettings(db: D1Database, vars: Vars, binding?: CloudflareEmailBinding) {
  const pref = await db.prepare(
    "SELECT notifications_enabled, applicant_confirmations_enabled, owner_alerts_enabled, " +
    "decision_emails_enabled, historical_backfill_enabled, revision, updated_at " +
    "FROM portal_registration_notice_preferences WHERE id = 'farmportal'",
  ).first<PreferencesRow>();
  if (!pref) return fail("NOTIFICATION_SETTINGS_NOT_INITIALIZED", 503);
  const rows = await db.prepare(
    "SELECT id, email, label, enabled, is_primary, verified_at " +
    "FROM portal_registration_notice_recipients ORDER BY is_primary DESC, created_at ASC LIMIT 9",
  ).all<RecipientRow>();
  const recipients = (rows.results || []).map(r => ({
    id: r.id, email: r.email, label: r.label, enabled: r.enabled === 1,
    primary: r.is_primary === 1, verified: Boolean(r.verified_at),
    verifiedAt: r.verified_at,
  }));
  return {
    sender: REGISTRATION_EMAIL_FROM,
    senderConfigured: Boolean(registrationSendingConfig(binding)),
    operatorEnabled: Boolean(binding),
    preferences: {
      enabled: pref.notifications_enabled === 1,
      applicantConfirmations: pref.applicant_confirmations_enabled === 1,
      ownerAlerts: pref.owner_alerts_enabled === 1,
      decisionEmails: pref.decision_emails_enabled === 1,
      historicalBackfill: pref.historical_backfill_enabled === 1,
      revision: pref.revision, updatedAt: pref.updated_at,
    },
    recipients, maximumRecipients: 8,
  };
}
export async function registrationRouting(db: D1Database) {
  const p = await db.prepare(
    "SELECT notifications_enabled, applicant_confirmations_enabled, owner_alerts_enabled, " +
    "decision_emails_enabled, historical_backfill_enabled FROM portal_registration_notice_preferences WHERE id='farmportal'",
  ).first<PreferencesRow>();
  if (!p) return fail("NOTIFICATION_SETTINGS_NOT_INITIALIZED", 503);
  const rows = await db.prepare(
    "SELECT email FROM portal_registration_notice_recipients " +
    "WHERE enabled=1 AND verified_at IS NOT NULL ORDER BY is_primary DESC, created_at ASC LIMIT 8",
  ).all<{ email: string }>();
  return {
    enabled: p.notifications_enabled === 1,
    confirmations: p.applicant_confirmations_enabled === 1,
    ownerAlerts: p.owner_alerts_enabled === 1,
    decisions: p.decision_emails_enabled === 1,
    backfill: p.historical_backfill_enabled === 1,
    ownerEmails: (rows.results || []).map(r => r.email).filter(validAddress),
  };
}
async function codeHash(vars: Vars, id: string, nonce: string, code: string) {
  const secret = vars.FARMS_INTEGRATION_MASTER_KEY || "";
  if (secret.length < 32) return fail("VERIFICATION_SECRET_UNAVAILABLE", 503);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return byteHex(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode("farmportal-owner-email:" + id + ":" + nonce + ":" + code),
  ));
}

type EditBody = Record<string, unknown>;
export async function updateRegistrationEmailSettings(
  db: D1Database, vars: Vars, actorId: string, body: EditBody,
  binding?: CloudflareEmailBinding, now = new Date(),
) {
  if (!actorId || actorId.length > 160) return fail("UNAUTHORIZED", 401);
  const at = date(now);
  const action = body.action;
  if (action === "savePreferences") {
    const revision = body.revision;
    if (!Number.isSafeInteger(revision) || Number(revision) < 1) return fail("INVALID_REVISION");
    const values = [
      flag(body.enabled, "enabled"), flag(body.applicantConfirmations, "applicant_confirmations"),
      flag(body.ownerAlerts, "owner_alerts"), flag(body.decisionEmails, "decision_emails"),
      flag(body.historicalBackfill, "historical_backfill"),
    ];
    const change = await db.prepare(
      "UPDATE portal_registration_notice_preferences SET notifications_enabled=?, applicant_confirmations_enabled=?, " +
      "owner_alerts_enabled=?, decision_emails_enabled=?, historical_backfill_enabled=?, " +
      "revision=revision+1, updated_by=?, updated_at=? WHERE id='farmportal' AND revision=?",
    ).bind(...values, actorId, at, revision).run();
    if (Number(change.meta?.changes || 0) !== 1) return fail("SETTINGS_CHANGED_REFRESH_REQUIRED", 409);
    await audit(db, actorId, "save_preferences", null, at);
  } else if (action === "addRecipient") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "Owner Notification";
    if (!validAddress(email) || !label) return fail("INVALID_RECIPIENT");
    const current = await db.prepare(
      "SELECT COUNT(*) AS count FROM portal_registration_notice_recipients",
    ).first<{ count: number }>();
    if (Number(current?.count || 0) >= 8) return fail("MAX_RECIPIENTS_REACHED", 409);
    const id = "notify_" + crypto.randomUUID();
    try {
      await db.prepare(
        "INSERT INTO portal_registration_notice_recipients " +
        "(id,email,label,enabled,is_primary,created_by,created_at,updated_at) VALUES (?,?,?,1,0,?,?,?)",
      ).bind(id, email, label, actorId, at, at).run();
    } catch { return fail("RECIPIENT_ALREADY_EXISTS", 409); }
    await audit(db, actorId, "add_recipient", id, at);
  } else if (action === "setPrimary") {
    const id = typeof body.id === "string" ? body.id : "";
    const exists = await db.prepare(
      "SELECT id FROM portal_registration_notice_recipients WHERE id=? AND enabled=1",
    ).bind(id).first();
    if (!exists) return fail("RECIPIENT_NOT_FOUND", 404);
    await db.batch([
      db.prepare("UPDATE portal_registration_notice_recipients SET is_primary=0 WHERE is_primary=1"),
      db.prepare("UPDATE portal_registration_notice_recipients SET is_primary=1,updated_at=? WHERE id=? AND enabled=1").bind(at, id),
    ]);
    await audit(db, actorId, "set_primary", id, at);
  } else if (action === "toggleRecipient") {
    const id = typeof body.id === "string" ? body.id : "";
    const enabled = flag(body.enabled, "recipient_enabled");
    const updated = await db.prepare(
      "UPDATE portal_registration_notice_recipients SET enabled=?, updated_at=? WHERE id=?",
    ).bind(enabled, at, id).run();
    if (Number(updated.meta?.changes || 0) !== 1) return fail("RECIPIENT_NOT_FOUND", 404);
    await audit(db, actorId, "toggle_recipient", id, at);
  } else if (action === "removeRecipient") {
    const id = typeof body.id === "string" ? body.id : "";
    const deleted = await db.prepare(
      "DELETE FROM portal_registration_notice_recipients WHERE id=?",
    ).bind(id).run();
    if (Number(deleted.meta?.changes || 0) !== 1) return fail("RECIPIENT_NOT_FOUND", 404);
    await audit(db, actorId, "remove_recipient", id, at);
  } else if (action === "sendVerification") {
    const id = typeof body.id === "string" ? body.id : "";
    const recipient = await db.prepare(
      "SELECT id,email,verified_at FROM portal_registration_notice_recipients WHERE id=? AND enabled=1",
    ).bind(id).first<{ id: string; email: string; verified_at: string | null }>();
    if (!recipient) return fail("RECIPIENT_NOT_FOUND", 404);
    if (recipient.verified_at) return fail("RECIPIENT_ALREADY_VERIFIED", 409);
    const mailer = registrationSendingConfig(binding);
    if (!mailer || !binding) return fail("CLOUDFLARE_EMAIL_SENDING_NOT_CONFIGURED", 503);
    // No verification code is ever logged, stored in plaintext or returned.
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(random[0] % 1_000_000).padStart(6, "0");
    const nonce = crypto.randomUUID();
    const hash = await codeHash(vars, id, nonce, code);
    const expiry = date(new Date(now.getTime() + TEN_MINUTES));
    const cooldown = date(new Date(now.getTime() - MINUTE));
    const claimed = await db.prepare(
      "UPDATE portal_registration_notice_recipients " +
      "SET verification_nonce=?, verification_hash=?, verification_expires_at=?, " +
      "verification_sent_at=?, verification_attempts=0,updated_at=? " +
      "WHERE id=? AND enabled=1 AND verified_at IS NULL " +
      "AND (verification_sent_at IS NULL OR verification_sent_at <= ?)",
    ).bind(nonce, hash, expiry, at, at, id, cooldown).run();
    if (Number(claimed.meta?.changes || 0) !== 1) return fail("VERIFICATION_COOLDOWN", 429);
    try {
      const receipt = await binding.send({
        from: mailer.from, to: recipient.email,
        subject: "DAENEM Farms — Confirm Owner Alert Email",
        text: "A FarmPortal Owner requested registration alerts at this address.\n\n" +
          "Enter this code in the FarmPortal Admin Center:\n\n" + code +
          "\n\nExpires in 10 minutes. Never share it.\n" +
          "If you did not request this, ignore this email.",
      });
      if (!receipt || typeof receipt.messageId !== "string" || !receipt.messageId) {
        throw new Error("CLOUDFLARE_EMAIL_ACCEPTANCE_MISSING");
      }
      await audit(db, actorId, "send_verification", id, at);
      return { ok: true, verificationSent: true };
    } catch {
      await db.prepare(
        "UPDATE portal_registration_notice_recipients " +
        "SET verification_hash=NULL,verification_nonce=NULL,verification_expires_at=NULL " +
        "WHERE id=? AND verification_nonce=? AND verified_at IS NULL",
      ).bind(id, nonce).run();
      return fail("VERIFICATION_DELIVERY_UNAVAILABLE", 503);
    }
  } else if (action === "confirmVerification") {
    const id = typeof body.id === "string" ? body.id : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) return fail("INVALID_VERIFICATION_CODE");
    const row = await db.prepare(
      "SELECT id, verification_nonce, verification_hash, verification_expires_at " +
      "FROM portal_registration_notice_recipients WHERE id=? AND enabled=1 " +
      "AND verified_at IS NULL AND verification_attempts<6",
    ).bind(id).first<RecipientRow>();
    if (!row?.verification_nonce || !row.verification_hash || !row.verification_expires_at ||
        row.verification_expires_at <= at) return fail("VERIFICATION_EXPIRED", 400);
    const compare = await codeHash(vars, id, row.verification_nonce, code);
    const success = await db.prepare(
      "UPDATE portal_registration_notice_recipients " +
      "SET verified_at=?,verification_hash=NULL,verification_nonce=NULL,verification_expires_at=NULL,updated_at=? " +
      "WHERE id=? AND verification_nonce=? AND verification_hash=? " +
      "AND verification_expires_at>? AND verification_attempts<6 AND enabled=1 AND verified_at IS NULL",
    ).bind(at, at, id, row.verification_nonce, compare, at).run();
    if (Number(success.meta?.changes || 0) !== 1) {
      await db.prepare(
        "UPDATE portal_registration_notice_recipients SET verification_attempts=verification_attempts+1 " +
        "WHERE id=? AND verification_nonce=? AND verified_at IS NULL AND verification_attempts<6",
      ).bind(id, row.verification_nonce).run();
      return fail("INVALID_VERIFICATION_CODE", 400);
    }
    await audit(db, actorId, "verify_recipient", id, at);
  } else {
    return fail("INVALID_SETTINGS_ACTION", 400);
  }
  return readRegistrationEmailSettings(db, vars, binding);
}
