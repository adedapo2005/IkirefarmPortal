import type { CloudflareEmailBinding } from "./portal-recovery-mailer.ts";
import { createActivity } from "./communications-activity-d1.ts";
import { registrationRouting, registrationSendingConfig } from "./portal-registration-email-settings.ts";

type Vars = Record<string, string | undefined>;
export type RegistrationNoticeKind =
  | "registration_received"
  | "registration_owner_alert"
  | "registration_approved"
  | "registration_rejected";

type Row = {
  id: string;
  event_key: string;
  applicant_account_id: string;
  recipient_account_id: string;
  event_type: RegistrationNoticeKind;
  attempt_count: number;
  delivery_state: string;
  applicant_status: string;
  applicant_access_state: string;
  applicant_lifecycle: string | null;
  applicant_email: string;
  applicant_name: string;
  recipient_status: string;
  recipient_is_owner: number;
  recipient_email: string;
  recipient_email_verified_at: string | null;
};

const MAX_SEND_ATTEMPTS = 5;
const ORIGIN = "https://daenem-farms-v81-staging.adedapo2005.workers.dev";
const NOTICE_TYPES = new Set<RegistrationNoticeKind>([
  "registration_received", "registration_owner_alert",
  "registration_approved", "registration_rejected",
]);

function dateString(date: Date) {
  return date.toISOString();
}

function validAddress(address: string) {
  return /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(address);
}

/**
 * Must be included in the same D1 batch as the newly verified applicant insert.
 * The row contains no email content, OTP, access token or provider credential.
 * Unique event keys prevent repeat callbacks from creating duplicate notices.
 */
export function newApplicantNoticeStatements(db: D1Database, applicantId: string, now: string): D1PreparedStatement[] {
  return [
    db.prepare(
      "INSERT OR IGNORE INTO portal_registration_notification_outbox " +
      "(id, event_key, applicant_account_id, recipient_account_id, event_type, next_attempt_at, created_at, updated_at) " +
      "SELECT 'registration:applicant:' || a.id, 'registration:applicant:' || a.id, a.id, a.id, 'registration_received', ?, ?, ? " +
      "FROM portal_accounts a WHERE a.id = ? AND a.is_owner = 0 AND a.access_state = 'provisional' " +
      "AND a.provisional_role = 1 AND a.provisional_expired = 0 AND a.status = 'active' AND a.email_verified_at IS NOT NULL",
    ).bind(now, now, now, applicantId),
    // The Owner alert follows either verified contact channel. The applicant
    // receipt above remains email-only because it is sent to the applicant's email.
    db.prepare(
      "INSERT OR IGNORE INTO portal_registration_notification_outbox " +
      "(id, event_key, applicant_account_id, recipient_account_id, event_type, next_attempt_at, created_at, updated_at) " +
      "SELECT 'registration:owner:' || a.id || ':' || o.id, 'registration:owner:' || a.id || ':' || o.id, " +
      "a.id, o.id, 'registration_owner_alert', ?, ?, ? " +
      "FROM portal_accounts a CROSS JOIN portal_accounts o " +
      "WHERE a.id = ? AND a.is_owner = 0 AND a.access_state = 'provisional' " +
      "AND a.provisional_role = 1 AND a.provisional_expired = 0 AND a.status = 'active' " +
      "AND (a.email_verified_at IS NOT NULL OR a.phone_verified_at IS NOT NULL) " +
      "AND o.is_owner = 1 AND o.status = 'active'",
    ).bind(now, now, now, applicantId),
  ];
}

/**
 * Reconcile historical pending registrations after either contact channel
 * is verified. Only the authenticated Owner maintenance route may invoke this.
 * Existing event keys and D1 uniqueness guarantee no duplicate notices.
 * The applicant receipt remains email-verified only in the insert statement;
 * phone-only verification may enqueue an Owner alert, never an email receipt.
 * The query excludes Owners, unverified contacts and expired applicants.
 */
export async function backfillPendingRegistrationNotices(
  db: D1Database, now = new Date(), limit = 10,
) {
  const rows = await db.prepare(
    "SELECT id FROM portal_accounts WHERE is_owner = 0 AND status = 'active' " +
    "AND access_state = 'provisional' AND provisional_role = 1 AND provisional_expired = 0 " +
    "AND lifecycle_status = 'pending_owner_review' " +
    "AND (email_verified_at IS NOT NULL OR phone_verified_at IS NOT NULL) " +
    "ORDER BY created_at DESC LIMIT ?",
  ).bind(Math.max(1, Math.min(limit, 20))).all<{id:string}>();
  let enqueued = 0;
  for (const applicant of rows.results || []) {
    const changes = await db.batch(newApplicantNoticeStatements(db, applicant.id, dateString(now)));
    enqueued += changes.reduce((total, result) => total + Number(result.meta?.changes || 0), 0);
  }
  return { inspected: (rows.results || []).length, enqueued };
}

/**
 * Hook for the existing authorized Owner decision writer. Never call this for
 * an unreviewed applicant. The SQL verifies persisted decision state before
 * queueing an outcome notice; it grants no permission and changes no account.
 */
export async function enqueueRegistrationDecision(
  db: D1Database,
  applicantId: string,
  decision: "approved" | "rejected",
  decisionId: string,
  now = new Date(),
) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(decisionId) || !/^[a-zA-Z0-9_-]{8,160}$/.test(applicantId)) {
    throw new Error("REGISTRATION_DECISION_INVALID");
  }
  const kind: RegistrationNoticeKind = decision === "approved" ? "registration_approved" : "registration_rejected";
  const lifecycle = decision === "approved" ? "approved" : "rejected";
  const eventKey = "registration:decision:" + decisionId + ":" + applicantId;
  const at = dateString(now);
  // The Owner approval/rejection source must have committed the account state
  // before invoking this helper. We will not invent or bypass such a decision.
  const outcome = await db.prepare(
    "INSERT OR IGNORE INTO portal_registration_notification_outbox " +
    "(id, event_key, applicant_account_id, recipient_account_id, event_type, next_attempt_at, created_at, updated_at) " +
    "SELECT ?, ?, a.id, a.id, ?, ?, ?, ? FROM portal_accounts a " +
    "WHERE a.id = ? AND a.is_owner = 0 AND a.lifecycle_status = ? AND a.email_verified_at IS NOT NULL",
  ).bind(eventKey, eventKey, kind, at, at, at, applicantId, lifecycle).run();
  return Number(outcome.meta?.changes || 0) === 1;
}

function template(row: Row) {
  const portal = ORIGIN + "/app.html";
  if (row.event_type === "registration_owner_alert") {
    const safeName = row.applicant_name.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 120);
    return {
      subject: "DAENEM Farms — New Employee Registration",
      text: "A new employee has registered and is awaiting your approval.\n\n" +
        "Employee: " + safeName + "\n" +
        "Review new applications in your authorized Owner workspace:\n" + portal + "\n\n" +
        "Do not approve accounts from email links. Review their access permissions inside FarmPortal.",
    };
  }
  if (row.event_type === "registration_approved") {
    return {
      subject: "DAENEM Farms — Account Approved",
      text: "Your DAENEM Farms employee account has been approved.\n\n" +
        "Sign in to review the access assigned to you:\n" + portal + "\n\n" +
        "If you did not register, contact your administrator.",
    };
  }
  if (row.event_type === "registration_rejected") {
    return {
      subject: "DAENEM Farms — Registration Decision",
      text: "Your DAENEM Farms employee application was not approved.\n\n" +
        "Please contact your DAENEM Farms administrator for further information.\n\n" +
        "If you did not register, you can ignore this message.",
    };
  }
  return {
    subject: "DAENEM Farms — Registration Received",
    text: "Your DAENEM Farms employee account has been registered and your email ownership was verified.\n\n" +
      "Your account is awaiting Owner approval. You can sign in to view your Approval Status:\n" +
      portal + "\n\n" +
      "You cannot access operational modules until the Owner authorizes your account.\n" +
      "If you did not register, contact your administrator.",
  };
}

export type ProcessNoticeOptions = {
  applicantId?: string;
  now?: () => Date;
  limit?: number;
};

export async function deliverRegistrationNotices(
  db: D1Database, vars: Vars, binding?: CloudflareEmailBinding, options: ProcessNoticeOptions = {},
) {
  const outcome = { delivered: 0, pending: 0, failed: 0, disabled: false, examined: 0 };
  // The dedicated native Cloudflare Email Service binding is the operator
  // activation gate. Admin Center preferences can pause delivery at any time.
  if (!binding) {
    outcome.disabled = true;
    return outcome;
  }
  const routing = await registrationRouting(db);
  if (!routing.enabled) {
    outcome.disabled = true;
    return outcome;
  }
  const verifiedMailer = registrationSendingConfig(binding);
  if (!verifiedMailer) {
    outcome.disabled = true;
    return outcome;
  }
  const now = options.now?.() || new Date();
  const at = dateString(now);
  const limit = Math.max(1, Math.min(options.limit || 6, 12));
  const sql =
    "SELECT n.id, n.event_key, n.applicant_account_id, n.recipient_account_id, n.event_type, " +
    "n.attempt_count, n.delivery_state, " +
    "a.status AS applicant_status, a.access_state AS applicant_access_state, a.lifecycle_status AS applicant_lifecycle, " +
    "a.email AS applicant_email, a.display_name AS applicant_name, " +
    "r.status AS recipient_status, r.is_owner AS recipient_is_owner, r.email AS recipient_email, r.email_verified_at AS recipient_email_verified_at " +
    "FROM portal_registration_notification_outbox n " +
    "JOIN portal_accounts a ON a.id = n.applicant_account_id " +
    "JOIN portal_accounts r ON r.id = n.recipient_account_id " +
    "WHERE n.delivery_state IN ('pending', 'sending') " +
    "AND ((n.delivery_state = 'pending' AND n.next_attempt_at <= ?) " +
    "OR (n.delivery_state = 'sending' AND n.lease_until < ?)) " +
    (options.applicantId ? "AND n.applicant_account_id = ? " : "") +
    "ORDER BY n.created_at, n.id LIMIT ?";
  const stmt = db.prepare(sql);
  const rows = await (options.applicantId
    ? stmt.bind(at, at, options.applicantId, limit)
    : stmt.bind(at, at, limit)).all<Row>();
  for (const row of rows.results || []) {
    outcome.examined += 1;
    if (!NOTICE_TYPES.has(row.event_type)) continue;
    const ownerNotice = row.event_type === "registration_owner_alert";
    const isOwner = row.recipient_is_owner === 1 && row.recipient_status === "active";
    // Admin-managed recipient addresses are independent of the account's
    // sign-in email, but can receive Owner details ONLY after mailbox proof.
    const destinations = ownerNotice ? routing.ownerEmails :
      [row.recipient_email.trim().toLowerCase()];
    const recipientTrusted = ownerNotice
      ? isOwner && destinations.length > 0
      : row.recipient_account_id === row.applicant_account_id && Boolean(row.recipient_email_verified_at);
    const enabledKind = ownerNotice ? routing.ownerAlerts :
      row.event_type === "registration_received" ? routing.confirmations : routing.decisions;
    if (!enabledKind) {
      outcome.pending += 1;
      continue;
    }
    const matchingState = row.event_type === "registration_received" || ownerNotice
      ? row.applicant_access_state === "provisional" && row.applicant_lifecycle === "pending_owner_review"
      : row.event_type === "registration_approved"
        ? row.applicant_lifecycle === "approved"
        : row.applicant_lifecycle === "rejected";
    if (!matchingState) {
      await db.prepare(
        "UPDATE portal_registration_notification_outbox SET delivery_state = 'cancelled', updated_at = ? " +
        "WHERE id = ? AND delivery_state IN ('pending', 'sending')",
      ).bind(at, row.id).run();
      continue;
    }
    if (!destinations.length || !destinations.every(validAddress) || !recipientTrusted ||
        (row.applicant_status !== "active" && row.event_type !== "registration_rejected")) {
      outcome.pending += 1;
      continue;
    }
    // All applicants use the new sender-restricted Cloudflare Email Sending
    // binding. The existing recipient-restricted EMAIL binding is unchanged.
    const lease = new Date(now.getTime() + 60_000).toISOString();
    const claim = await db.prepare(
      "UPDATE portal_registration_notification_outbox SET delivery_state = 'sending', attempt_count = attempt_count + 1, " +
      "lease_until = ?, updated_at = ? WHERE id = ? AND (" +
      "(delivery_state = 'pending' AND next_attempt_at <= ?) OR (delivery_state = 'sending' AND lease_until < ?))",
    ).bind(lease, at, row.id, at, at).run();
    if (Number(claim.meta?.changes || 0) !== 1) continue;
    const message = template(row);
    try {
      const accepted = await binding.send({
        from: verifiedMailer.from,
        to: destinations.length === 1 ? destinations[0] : destinations,
        subject: message.subject,
        text: message.text,
      });
      // A Cloudflare messageId records provider acceptance, not guaranteed
      // inbox delivery. Delivery failures are observed in Email Service logs.
      const providerReference = typeof accepted?.messageId === "string"
        ? accepted.messageId.slice(0, 160) : "";
      if (!providerReference) throw new Error("CLOUDFLARE_EMAIL_ACCEPTANCE_MISSING");
      await db.prepare(
        "UPDATE portal_registration_notification_outbox SET delivery_state = 'sent', provider_reference = ?, " +
        "lease_until = NULL, sent_at = ?, updated_at = ?, last_error_code = NULL " +
        "WHERE id = ? AND delivery_state = 'sending' AND lease_until = ?",
      ).bind(providerReference, at, at, row.id, lease).run();
      // The provider keeps a single send operation for this outbox notice,
      // but delivery is per recipient. Preserve separate private correlations
      // so one mailbox delivery cannot conceal another mailbox bounce.
      for(const recipient of new Set(destinations.map(address=>address.trim().toLowerCase()))){
        await createActivity(db,{
          channel:"EMAIL",purpose:"notice_"+row.event_type,status:"ACCEPTED",
          recipient,providerRef:providerReference,actorId:row.recipient_account_id,
        }).catch(() => undefined);
      }
      outcome.delivered += 1;
    } catch {
      const attempts = row.attempt_count + 1;
      const state = attempts >= MAX_SEND_ATTEMPTS ? "failed" : "pending";
      const next = new Date(now.getTime() + Math.min(60, 5 * (2 ** Math.max(0, attempts - 1))) * 60_000).toISOString();
      await db.prepare(
        "UPDATE portal_registration_notification_outbox SET delivery_state = ?, lease_until = NULL, " +
        "next_attempt_at = ?, last_error_code = 'DELIVERY_FAILED', updated_at = ? " +
        "WHERE id = ? AND delivery_state = 'sending' AND lease_until = ?",
      ).bind(state, next, at, row.id, lease).run();
      outcome.failed += 1;
    }
  }
  return outcome;
}
