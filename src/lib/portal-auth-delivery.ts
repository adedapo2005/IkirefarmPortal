import { D1MetaProviderRepository } from "./meta-provider-d1.ts";
import { createActivity } from "./communications-activity-d1.ts";
import { normalizeWhatsAppSubmissionStatus } from "./communications-activity-core.ts";
import { FARMS_ORGANIZATION_ID, decryptIntegrationSecret } from "./meta-provider-control.ts";
import { MetaGraphClient } from "./meta-provider-operations.ts";
import { buildWhatsAppAuthenticationComponents } from "./whatsapp-auth-template.ts";
import { FARMPORTAL_FROM, sendCloudflareRecoveryCode, type CloudflareEmailBinding } from "./portal-recovery-mailer.ts";
import type { PortalAuthChallengeDelivery, PortalAuthChallengeDispatcher, PortalAuthPurpose } from "./portal-auth-flows.ts";

type RuntimeVars = Record<string, string | undefined>;
type EmailBinding = CloudflareEmailBinding;
const CONNECTION_ID = "meta-daenem-farms-organization";

function purposeLabel(purpose: PortalAuthPurpose) {
  if (purpose === "signup") return "create your DAENEM Farms account";
  if (purpose === "whatsapp_login") return "sign in to DAENEM Farms";
  if (purpose === "existing_owner_email_verification") return "verify your existing DAENEM Farms Owner email";
  return "reset your DAENEM Farms password";
}

async function sendEmail(db:D1Database, _vars: RuntimeVars, emailBinding: EmailBinding | undefined, delivery: PortalAuthChallengeDelivery) {
  if (!emailBinding) throw new Error("CLOUDFLARE_EMAIL_BINDING_UNAVAILABLE");
  const subject = "DAENEM Farms Verification Code";
  const text = `Use this one-time code to ${purposeLabel(delivery.purpose)}:\n\n${delivery.code}\n\nThe code expires in 10 minutes. Do not share it with anyone. If you did not request this, ignore this message.`;
  const providerReference = await sendCloudflareRecoveryCode(emailBinding, {
    from: FARMPORTAL_FROM, to: delivery.destination, subject, text,
  });
  await createActivity(db,{
    channel:"EMAIL",purpose:"auth_"+delivery.purpose,status:"ACCEPTED",
    recipient:delivery.destination,providerRef:providerReference,
  }).catch(() => undefined);
  return { providerReference };
}

type WhatsAppConfiguration = {
  graphVersion: string;
  phoneNumberId: string;
  templateName: string;
  templateLanguage: string;
  accessToken: string;
  templateComponents: unknown;
};

function workflow(purpose: PortalAuthPurpose) {
  if (purpose === "signup") return "signup_verification";
  if (purpose === "password_reset") return "account_recovery";
  if (purpose === "existing_owner_email_verification") return "account_recovery";
  return "signin_verification";
}

async function whatsappConfiguration(db: D1Database, vars: RuntimeVars, purpose: PortalAuthPurpose): Promise<WhatsAppConfiguration | null> {
  const masterKey = vars.FARMS_INTEGRATION_MASTER_KEY || "";
  if (!masterKey) return null;
  const connection = await db.prepare(
    "SELECT configuration_json FROM integration_connections WHERE id = ? AND organization_id = ? LIMIT 1",
  ).bind(CONNECTION_ID, FARMS_ORGANIZATION_ID).first<{ configuration_json: string }>();
  if (!connection?.configuration_json) return null;
  let values: Record<string, string>;
  try { values = JSON.parse(connection.configuration_json) as Record<string, string>; }
  catch { return null; }
  const graphVersion = values.graph_api_version || "";
  const phoneNumberId = values.phone_number_id || "";
  const selectedWabaId = values.waba_id || "";
  if (!/^v\d{1,3}\.\d$/.test(graphVersion) || !/^\d{5,32}$/.test(phoneNumberId) || !/^\d{5,32}$/.test(selectedWabaId)) return null;

  const template = await db.prepare(
    "SELECT t.name, t.language, t.components_json FROM whatsapp_auth_policies p " +
    // Legacy policies can lack template_mapping_id even when their named workflow is mapped.
    // Match the same workflow and honor any explicitly stored mapping reference.
    "JOIN whatsapp_template_mappings m ON m.connection_id = p.connection_id AND m.workflow_key = p.policy_key " +
    "AND (p.template_mapping_id IS NULL OR p.template_mapping_id = m.id) " +
    "JOIN whatsapp_templates t ON t.id = m.template_id AND t.connection_id = p.connection_id " +
    "WHERE p.connection_id = ? AND p.policy_key = ? AND p.enabled = 1 AND m.enabled = 1 " +
    "AND t.category = 'AUTHENTICATION' AND t.provider_status = 'APPROVED' " +
    "AND t.waba_id = ? LIMIT 1",
  ).bind(CONNECTION_ID, workflow(purpose), selectedWabaId).first<{ name: string; language: string; components_json: string }>();
  if (!template?.name || !template.language) return null;

  const encrypted = await new D1MetaProviderRepository(db).activeSecret(CONNECTION_ID, "system_user_access_token");
  if (!encrypted || encrypted.validationState !== "VALID") return null;
  const accessToken = await decryptIntegrationSecret({
    ...encrypted,
    masterKey,
    provider: "meta",
    organizationId: FARMS_ORGANIZATION_ID,
    farmId: null,
    credentialType: "system_user_access_token",
  });
  let templateComponents: unknown;
  try {
    templateComponents = JSON.parse(template.components_json);
    // Reject unsupported template shapes in provider availability before a code is issued.
    buildWhatsAppAuthenticationComponents("000000", templateComponents);
  } catch { return null; }
  return { graphVersion, phoneNumberId, templateName: template.name, templateLanguage: template.language, accessToken, templateComponents };
}

async function sendWhatsApp(db: D1Database, vars: RuntimeVars, delivery: PortalAuthChallengeDelivery) {
  const config = await whatsappConfiguration(db, vars, delivery.purpose);
  if (!config) throw new Error("WHATSAPP_DELIVERY_NOT_CONFIGURED");
  const to = delivery.destination.replace(/\D/g, "");
  if (to.length < 7 || to.length > 15) throw new Error("WHATSAPP_DESTINATION_INVALID");
  const client = new MetaGraphClient(config.accessToken, config.graphVersion);
  const response = await client.post<{ messages?: Array<{ id?: string; message_status?: string }> }>(config.phoneNumberId + "/messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.templateLanguage },
      components: buildWhatsAppAuthenticationComponents(delivery.code, config.templateComponents),
    },
  });
  const reference = response.messages?.[0]?.id;
  if (!reference) throw new Error("WHATSAPP_DELIVERY_FAILED");
  const submissionStatus = normalizeWhatsAppSubmissionStatus(response.messages?.[0]?.message_status);
  await createActivity(db,{
    channel:"WHATSAPP",purpose:"auth_"+delivery.purpose,status:submissionStatus,
    recipient:delivery.destination,providerRef:reference.slice(0,160),
  }).catch(() => undefined);
  return { providerReference: reference.slice(0, 160) };
}

export function createPortalAuthDispatcher(db: D1Database, vars: RuntimeVars, emailBinding?: EmailBinding): PortalAuthChallengeDispatcher {
  return {
    async available(channel, purpose) {
      if (channel === "email") return Boolean(emailBinding);
      if (channel === "whatsapp") return Boolean(await whatsappConfiguration(db, vars, purpose));
      return false;
    },
    async send(delivery) {
      if (delivery.channel === "email") return sendEmail(db, vars, emailBinding, delivery);
      if (delivery.channel === "whatsapp") return sendWhatsApp(db, vars, delivery);
      throw new Error("AUTHENTICATION_PROVIDER_UNAVAILABLE");
    },
  };
}

export async function portalProviderAvailability(db: D1Database | undefined, vars: RuntimeVars, origin: string, emailBinding?: EmailBinding) {
  const email = Boolean(emailBinding);
  let whatsapp = false;
  let whatsappSignup = false;
  if (db) {
    // A failure in one workflow must not disable the other. Preserve
    // concurrent checks while settling provider readiness independently.
    const [signInResult, signUpResult] = await Promise.allSettled([
      whatsappConfiguration(db, vars, "whatsapp_login"),
      whatsappConfiguration(db, vars, "signup"),
    ]);
    whatsapp = signInResult.status === "fulfilled" && Boolean(signInResult.value);
    whatsappSignup = signUpResult.status === "fulfilled" && Boolean(signUpResult.value);
  }
  return {
    email,
    whatsapp,
    whatsappSignup,
    google: Boolean(vars.FARMS_AUTH_GOOGLE_CLIENT_ID && vars.FARMS_AUTH_GOOGLE_CLIENT_SECRET),
    microsoft: Boolean(vars.FARMS_AUTH_MICROSOFT_CLIENT_ID && vars.FARMS_AUTH_MICROSOFT_CLIENT_SECRET && vars.FARMS_AUTH_MICROSOFT_TENANT_ID),
    origin,
  };
}
