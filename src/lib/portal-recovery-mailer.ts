/**
 * Cloudflare Email Sending is DAENEM FarmPortal's sole transactional sender.
 * No Resend, external API keys, or hidden provider fallbacks.
 *
 * Staging uses a dedicated REGISTRATION_EMAIL Worker send binding restricted
 * to notifications@daenem.com. Cloudflare must have onboarded daenem.com
 * for Email Sending; app logic cannot bypass that platform check.
 */
import { createActivity } from "./communications-activity-d1.ts";
export type CloudflareEmailBinding = Pick<SendEmail, "send">;
export const FARMPORTAL_FROM = "notifications@daenem.com";
const STAGING_ORIGIN = "https://daenem-farms-v81-staging.adedapo2005.workers.dev";

export function resolveRecoveryEmailSender(vars: Record<string, string | undefined>) {
  const value = (vars.FARMS_AUTH_RECOVERY_FROM_ADDRESS || vars.PORTAL_EMAIL_FROM ||
    vars.FARMS_EMAIL_FROM || vars.EMAIL_FROM || "").trim();
  const bracketed = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  const address = bracketed?.[1] || value;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) ? address : FARMPORTAL_FROM;
}

/** Sender accepted by Cloudflare; messageId is an acceptance receipt, not an inbox delivery guarantee. */
export async function sendCloudflareRecoveryCode(
  binding: CloudflareEmailBinding,
  message: { from: string; to: string; subject: string; text: string },
): Promise<string> {
  const result = await binding.send(message);
  const messageId = result?.messageId;
  if (typeof messageId !== "string" || !messageId) {
    throw new Error("CLOUDFLARE_EMAIL_ACCEPTANCE_MISSING");
  }
  return messageId.slice(0, 160);
}

function validRecipient(address: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) && address.length <= 254;
}

export async function sendRecoveryEmail(
  binding: CloudflareEmailBinding | undefined,
  recipient: string,
  token: string,
  db?: D1Database,
) {
  if (!binding || !validRecipient(recipient) || !token) return false;
  const link = STAGING_ORIGIN + "/signin?auth=reset-password&token=" + encodeURIComponent(token);
  try {
    const reference = await sendCloudflareRecoveryCode(binding, {
      from: FARMPORTAL_FROM, to: recipient,
      subject: "DAENEM Farms Account Recovery",
      text: "A password reset was requested for your DAENEM Farms account.\n" +
        "Use this one-time link within 15 minutes:\n" + link + "\n" +
        "If you did not request this, ignore the email.\n" +
        "Never share this link or your password with anyone.",
    });
    if(db)await createActivity(db,{channel:"EMAIL",purpose:"password_recovery_link",
      status:"ACCEPTED",recipient,providerRef:reference}).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Six-digit recovery OTP, dispatched through Cloudflare only. */
export async function sendRecoveryCode(
  binding: CloudflareEmailBinding | undefined,
  recipient: string,
  code: string,
  db?: D1Database,
) {
  if (!binding || !validRecipient(recipient) || !/^\d{6}$/.test(code)) return false;
  try {
    const reference = await sendCloudflareRecoveryCode(binding, {
      from: FARMPORTAL_FROM, to: recipient,
      subject: "DAENEM Farms Account Verification Code",
      text: "Use this one-time code to reset your DAENEM Farms password:\n\n" +
        code + "\n\nExpires in 15 minutes. Do not share this code with anyone.\n" +
        "If you did not request account recovery, ignore this message.",
    });
    if(db)await createActivity(db,{channel:"EMAIL",purpose:"password_recovery_code",
      status:"ACCEPTED",recipient,providerRef:reference}).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}
