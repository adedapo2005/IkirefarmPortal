"use client";

import { useEffect, useState } from "react";
import styles from "./registration-email-settings.module.css";

type Recipient = { id: string; email: string; label: string; enabled: boolean; primary: boolean; verified: boolean; verifiedAt: string | null };
type Preferences = { enabled: boolean; applicantConfirmations: boolean; ownerAlerts: boolean; decisionEmails: boolean; historicalBackfill: boolean; revision: number; updatedAt: string };
type Settings = { sender: string; senderConfigured: boolean; operatorEnabled: boolean; preferences: Preferences; recipients: Recipient[]; maximumRecipients: number };
const url = "/api/portal/v69/auth/owner/registration/settings";
const retryUrl = "/api/portal/v69/auth/owner/registration/retry-notifications";
const errors: Record<string, string> = {
  FORBIDDEN: "Only an authenticated FarmPortal Owner may change these settings.",
  CLOUDFLARE_EMAIL_SENDING_NOT_CONFIGURED: "Cloudflare Email Sending is not enabled for FarmPortal yet. Verify the sender domain and Worker binding.",
  VERIFICATION_DELIVERY_UNAVAILABLE: "The mail provider could not deliver the verification code.",
  VERIFICATION_COOLDOWN: "Please wait one minute before requesting another code.",
  VERIFICATION_EXPIRED: "Your code expired. Request a new verification code.",
  INVALID_VERIFICATION_CODE: "That code is incorrect. Check the mailbox.",
  SETTINGS_CHANGED_REFRESH_REQUIRED: "Settings have changed. Refresh and try again.",
  RECIPIENT_ALREADY_EXISTS: "This recipient is already in your list.",
  MAX_RECIPIENTS_REACHED: "You can add up to eight Owner recipients.",
  NOTIFICATION_SETTINGS_NOT_INITIALIZED: "The notification database setup is pending.",
};
const flags: Array<{ key: keyof Pick<Preferences, "enabled" | "applicantConfirmations" | "ownerAlerts" | "decisionEmails" | "historicalBackfill">; title: string; description: string }> = [
  { key: "enabled", title: "Enable Registration Emails", description: "Pause or resume all registration notifications." },
  { key: "ownerAlerts", title: "Alert Owner About New Employees", description: "Send alerts to your verified Owner recipients." },
  { key: "applicantConfirmations", title: "Confirm New Employee Registration", description: "Acknowledge registration to the employee's verified mailbox." },
  { key: "decisionEmails", title: "Approval And Rejection Decisions", description: "Send only when a real, authorized decision is recorded." },
  { key: "historicalBackfill", title: "Include Existing Pending Registrations", description: "Allow the Owner to retry older unsent registration alerts." },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isPreferences(value: unknown): value is Preferences {
  if (!isRecord(value)) return false;
  return ["enabled", "applicantConfirmations", "ownerAlerts", "decisionEmails", "historicalBackfill"]
    .every(key => typeof value[key] === "boolean") &&
    Number.isInteger(value.revision) && typeof value.updatedAt === "string";
}
function isRecipient(value: unknown): value is Recipient {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.email === "string" &&
    typeof value.label === "string" && typeof value.enabled === "boolean" &&
    typeof value.primary === "boolean" && typeof value.verified === "boolean" &&
    (typeof value.verifiedAt === "string" || value.verifiedAt === null);
}
function isSettings(value: unknown): value is Settings {
  return isRecord(value) && typeof value.sender === "string" &&
    typeof value.senderConfigured === "boolean" && typeof value.operatorEnabled === "boolean" &&
    isPreferences(value.preferences) && Array.isArray(value.recipients) &&
    value.recipients.every(isRecipient) &&
    typeof value.maximumRecipients === "number" && Number.isInteger(value.maximumRecipients) &&
    value.maximumRecipients >= 0;
}
function errorText(value: unknown, fallback: string): string {
  const code = isRecord(value) && typeof value.error === "string" ? value.error : "";
  return errors[code] || fallback;
}
function safeCount(value: unknown, key: "examined" | "delivered"): number {
  const count = isRecord(value) ? value[key] : null;
  return typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : 0;
}

export default function RegistrationEmailSettings() {
  const [state, setState] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("Owner Notification");
  const [codes, setCodes] = useState<Record<string, string>>({});

  async function load(signal?: AbortSignal) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" }, signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorText(payload, "Unable to read notification settings."));
    if (!isSettings(payload)) throw new Error("The notification settings response is incomplete.");
    const next = payload;
    setState(next);
    setDraft({ ...next.preferences });
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(error => {
      if (!controller.signal.aborted) setMessage({ ok: false, text: String(error.message || error) });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function update(body: Record<string, unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(result, "Unable to save this change."));
      if (isRecord(result) && result.verificationSent === true) {
        setMessage({ ok: true, text: "Verification code requested. It expires in 10 minutes. Please check that mailbox." });
        await load();
      } else {
        if (!isSettings(result)) throw new Error("The updated notification settings response is incomplete.");
        const next = result;
        setState(next);
        setDraft({ ...next.preferences });
        setMessage({ ok: true, text: "Notification settings saved successfully." });
      }
      return true;
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to save changes." });
      return false;
    } finally { setBusy(false); }
  }

  async function retryPending() {
    if (busy || !state?.senderConfigured || !state?.operatorEnabled || !state.preferences.enabled) return;
    if (!window.confirm("Attempt delivery of pending registration notifications to verified addresses?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(retryUrl, {
        method: "POST", credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" }, body: "{}",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(result, "Retry is unavailable."));
      setMessage({ ok: true, text: "Processed " + safeCount(result, "examined") +
        " pending notices and accepted " + safeCount(result, "delivered") +
        " for delivery. Confirm receipt in the mailboxes." });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Retry unavailable." });
    } finally { setBusy(false); }
  }

  if (loading) return <div className={styles.root} role="status">Loading Registration Email Settings…</div>;
  if (!state || !draft) return <div className={styles.root}>
    <h2>Registration Email Settings</h2><p role="alert">{message?.text || "Settings are unavailable."}</p>
    <button type="button" className={styles.secondary} onClick={() => {
      setLoading(true); void load().catch(error => setMessage({ ok: false, text: String(error) })).finally(() => setLoading(false));
    }}>Retry Loading</button>
  </div>;

  const verified = state.recipients.filter(recipient => recipient.verified && recipient.enabled);
  const deliveryReady = state.senderConfigured && state.operatorEnabled && state.preferences.enabled;
  return <div className={styles.root}>
    <header className={styles.heading}>
      <div><span className={styles.eyebrow}>Owner Administration / Notifications & Alerting</span>
        <h2>Registration Email Settings</h2>
        <p>Manage recipients, verification, confirmation messages and alert preferences without redeploying FarmPortal.</p></div>
      <span className={deliveryReady && verified.length ? styles.ready : styles.pending}>
        {deliveryReady && verified.length ? "Eligible For Email Delivery" : "Setup Or Verification Required"}
      </span>
    </header>
    {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? styles.success : styles.error}>{message.text}</p>}
    <div className={styles.grid}>
      <section className={styles.panel}><h3>Sending Identity</h3>
        <dl className={styles.facts}>
          <div><dt>From Address</dt><dd>{state.sender}</dd></div>
          <div><dt>Email Service</dt><dd>{state.senderConfigured ? "Cloudflare Email Sending · Inbox Test Required" : "Cloudflare Email Sending Setup Required"}</dd></div>
          <div><dt>Operator Sending Permission</dt><dd>{state.operatorEnabled ? "Enabled" : "Not Enabled"}</dd></div>
          <div><dt>Verified Owner Recipients</dt><dd>{verified.length}</dd></div>
        </dl>
        <p className={styles.hint}>Cloudflare Email Sending uses a sender-restricted Worker binding. You can change verified recipients here without third-party mail providers or exposing access credentials.</p>
      </section>
      <section className={styles.panel}><h3>Email Preferences</h3>
        <div className={styles.toggles}>{flags.map(option => <label key={option.key} className={styles.choice}>
          <input type="checkbox" checked={draft[option.key]} disabled={busy}
            onChange={event => setDraft(current => current ? { ...current, [option.key]: event.target.checked } : null)}/>
          <span><strong>{option.title}</strong><small>{option.description}</small></span>
        </label>)}</div>
        <button type="button" className={styles.primary} disabled={busy}
          onClick={() => void update({ action: "savePreferences", ...draft })}>{busy ? "Saving…" : "Save Email Preferences"}</button>
      </section>
    </div>

    <section className={styles.panel}>
      <div className={styles.headingRow}><div><h3>Owner Alert Recipients</h3>
        <p>Up to {state.maximumRecipients} addresses. New addresses must be verified before receiving employee details.</p>
      </div><span className={styles.counter}>{state.recipients.length} / {state.maximumRecipients}</span></div>
      <div className={styles.recipients}>{state.recipients.map(recipient =>
        <div className={styles.recipient} key={recipient.id}>
          <div className={styles.recipientTitle}>
            <strong>{recipient.email}</strong>
            <span className={recipient.verified ? styles.verified : styles.unverified}>{recipient.verified ? "Verified" : "Pending Verification"}</span>
            {recipient.primary && <span className={styles.primaryTag}>Primary</span>}
          </div>
          <p>{recipient.label} · {recipient.enabled ? "Alerts Enabled" : "Recipient Paused"}</p>
          <div className={styles.controls}>
            {!recipient.primary && <button type="button" className={styles.secondary} disabled={busy || !recipient.enabled}
              onClick={() => void update({ action: "setPrimary", id: recipient.id })}>Make Primary</button>}
            <button type="button" className={styles.secondary} disabled={busy}
              onClick={() => void update({ action: "toggleRecipient", id: recipient.id, enabled: !recipient.enabled })}>
              {recipient.enabled ? "Pause Recipient" : "Enable Recipient"}</button>
            {!recipient.verified && recipient.enabled && <button type="button" className={styles.secondary}
              disabled={busy || !state.senderConfigured} onClick={() => void update({ action: "sendVerification", id: recipient.id })}>
              Send Verification Code</button>}
            <button type="button" className={styles.danger} disabled={busy}
              onClick={() => { if (window.confirm("Remove this Owner email address?")) void update({ action: "removeRecipient", id: recipient.id }); }}>Remove</button>
          </div>
          {!recipient.verified && recipient.enabled && <div className={styles.verify}>
            <label htmlFor={"verify-" + recipient.id}>Six-Digit Code</label>
            <input id={"verify-" + recipient.id} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={codes[recipient.id] || ""} placeholder="Verification Code"
              onChange={event => setCodes(current => ({ ...current, [recipient.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))}/>
            <button type="button" className={styles.secondary} disabled={busy || (codes[recipient.id] || "").length !== 6}
              onClick={() => void update({ action: "confirmVerification", id: recipient.id, code: codes[recipient.id] })}>Verify Address</button>
          </div>}
        </div>)}</div>
      <form className={styles.add} onSubmit={event => {
        event.preventDefault();
        if (!email.trim()) return;
        void update({ action: "addRecipient", email: email.trim(), label: label.trim() || "Owner Notification" })
          .then(ok => { if (ok) { setEmail(""); setLabel("Owner Notification"); } });
      }}>
        <label>New Owner Email<input type="email" required maxLength={254} value={email}
          disabled={busy || state.recipients.length >= state.maximumRecipients}
          placeholder="owner@example.com" onChange={event => setEmail(event.target.value)}/></label>
        <label>Recipient Label<input type="text" maxLength={60} value={label} disabled={busy}
          onChange={event => setLabel(event.target.value)}/></label>
        <button className={styles.primary} type="submit"
          disabled={busy || !email.trim() || state.recipients.length >= state.maximumRecipients}>Add Recipient</button>
      </form>
      <p className={styles.hint}>To change the primary address, add the new email, verify it, make it Primary, then pause or remove the old address. No code change is needed.</p>
    </section>
    <section className={styles.panel}><h3>Pending Notification Delivery</h3>
      <p>Retry queued registration messages after provider setup. Earlier pending registrations are included only if you enable Historical Backfill above.</p>
      <button type="button" className={styles.secondary} disabled={busy || !deliveryReady}
        onClick={() => void retryPending()}>Retry Pending Notifications</button>
      {!state.senderConfigured && <p className={styles.hint}>Cloudflare must onboard daenem.com for Email Sending before recipient verification and employee emails can be delivered.</p>}
    </section>
  </div>;
}
