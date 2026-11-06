export const META_PROVIDER_KEY = "meta" as const;
export const FARMS_ORGANIZATION_ID = "daenem-farms" as const;
export const META_CONTROL_PLANE_VERSION = "v81-meta-provider-operations-completion" as const;

export const META_PERMISSIONS = Object.freeze([
  "META_INTEGRATION_VIEW",
  "META_INTEGRATION_MANAGE",
  "META_CREDENTIALS_MANAGE",
  "META_PRODUCTS_MANAGE",
  "META_WHATSAPP_MANAGE",
  "META_AUTH_MANAGE",
  "META_WEBHOOK_MANAGE",
  "META_TEMPLATE_MANAGE",
  "META_FACEBOOK_MANAGE",
  "META_INSTAGRAM_MANAGE",
  "META_DIAGNOSTICS_VIEW",
  "META_AUDIT_VIEW",
] as const);

export type MetaPermission = (typeof META_PERMISSIONS)[number];
export type CapabilityState = "AVAILABLE" | "UNAVAILABLE" | "DEGRADED" | "DISABLED";
export type ProviderState =
  | "NOT_CONFIGURED"
  | "PARTIALLY_CONFIGURED"
  | "VALIDATING"
  | "CONNECTED"
  | "CONNECTED_WITH_LIMITATIONS"
  | "APP_SECRET_PENDING"
  | "PHONE_VERIFICATION_PENDING"
  | "BUSINESS_VERIFICATION_PENDING"
  | "TEMPLATE_APPROVAL_PENDING"
  | "WEBHOOK_PENDING"
  | "TOKEN_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "PERMISSION_MISSING"
  | "PROVIDER_UNAVAILABLE"
  | "DEGRADED"
  | "DISABLED";

export const SECRET_TYPES = Object.freeze([
  "meta_app_secret",
  "system_user_access_token",
  "webhook_verify_token",
] as const);
export type MetaSecretType = (typeof SECRET_TYPES)[number];

export const FORBIDDEN_STAFF_PORTAL_ASSETS = Object.freeze({
  meta_app_id: "1386392646479708",
  waba_id: "2629975567461440",
  phone_number_id: "1328876183640670",
  system_user_id: "61594228785381",
});

export type MetaCredentialState = Readonly<{
  configured: boolean;
  validationState: "NOT_CONFIGURED" | "PENDING" | "VALID" | "INVALID" | "EXPIRED" | "PERMISSION_MISSING";
  fingerprint: string | null;
  updatedAt: string | null;
  lastValidatedAt: string | null;
  updatedBy: string | null;
}>;

export type MetaRuntimeConfiguration = Readonly<{
  connectionId: string;
  organizationId: string;
  farmId: string | null;
  version: number;
  state: ProviderState;
  values: Readonly<Record<string, string>>;
  products: Readonly<Record<string, boolean>>;
  credentials: Readonly<Partial<Record<MetaSecretType, MetaCredentialState>>>;
  webhook: Readonly<{
    callbackUrl: string | null;
    getVerified: boolean;
    postSignatureVerified: boolean;
    subscribed: boolean;
  }>;
  phoneRegistrationState: string;
  approvedAuthenticationTemplate: boolean;
  authPoliciesEnabled: boolean;
}>;

export type CapabilityEvaluation = Readonly<{
  key: string;
  state: CapabilityState;
  reason: string;
}>;

function credentialValid(config: MetaRuntimeConfiguration, type: MetaSecretType) {
  return config.credentials[type]?.validationState === "VALID";
}

function enabled(config: MetaRuntimeConfiguration, product: string) {
  return config.products[product] === true;
}

export function evaluateMetaCapabilities(config: MetaRuntimeConfiguration): readonly CapabilityEvaluation[] {
  const token = credentialValid(config, "system_user_access_token");
  const appSecret = credentialValid(config, "meta_app_secret");
  const verifyToken = credentialValid(config, "webhook_verify_token");
  const hasApp = Boolean(config.values.meta_app_id);
  const hasWaba = Boolean(config.values.waba_id);
  const hasPhone = Boolean(config.values.phone_number_id);
  const phoneRegistered = ["REGISTERED", "CONNECTED"].includes(config.phoneRegistrationState.trim().toUpperCase());
  const whatsappBase = enabled(config, "whatsapp_business") && token && hasWaba;
  const messaging = whatsappBase && hasPhone && phoneRegistered;
  const webhookGet = enabled(config, "whatsapp_webhooks") && verifyToken && Boolean(config.webhook.callbackUrl) && config.webhook.getVerified;
  const inbound = webhookGet && appSecret && config.webhook.postSignatureVerified && config.webhook.subscribed;
  const authentication = messaging && config.approvedAuthenticationTemplate && config.authPoliciesEnabled;

  return Object.freeze([
    { key: "meta.whatsapp.messaging", state: messaging ? "AVAILABLE" : "UNAVAILABLE", reason: messaging ? "VALIDATED_REGISTERED_SENDER" : "TOKEN_WABA_OR_REGISTERED_PHONE_REQUIRED" },
    { key: "meta.whatsapp.templates", state: whatsappBase ? "AVAILABLE" : "UNAVAILABLE", reason: whatsappBase ? "VALIDATED_WABA_ACCESS" : "TOKEN_AND_WABA_REQUIRED" },
    { key: "meta.whatsapp.webhooks", state: webhookGet ? "AVAILABLE" : "UNAVAILABLE", reason: webhookGet ? "GET_CHALLENGE_VERIFIED" : "CALLBACK_AND_VERIFY_TOKEN_REQUIRED" },
    { key: "meta.whatsapp.inbound", state: inbound ? "AVAILABLE" : "UNAVAILABLE", reason: inbound ? "SIGNED_POST_VERIFIED" : "APP_SECRET_SIGNED_WEBHOOK_REQUIRED" },
    { key: "meta.whatsapp.authentication", state: authentication ? "AVAILABLE" : "DISABLED", reason: authentication ? "APPROVED_TEMPLATE_AND_POLICY" : "MESSAGING_TEMPLATE_AND_POLICY_REQUIRED" },
    { key: "meta.facebook.login", state: enabled(config, "facebook_login") && hasApp ? "AVAILABLE" : "DISABLED", reason: enabled(config, "facebook_login") && hasApp ? "APP_CONFIGURED" : "PRODUCT_DISABLED_OR_APP_REQUIRED" },
    { key: "meta.facebook.pages", state: enabled(config, "facebook_pages") && token && Boolean(config.values.facebook_page_ids) ? "AVAILABLE" : "DISABLED", reason: "PRODUCT_TOKEN_AND_PAGE_ACCESS_EVALUATED_INDEPENDENTLY" },
    { key: "meta.instagram", state: enabled(config, "instagram") && token && Boolean(config.values.instagram_business_account_ids) ? "AVAILABLE" : "DISABLED", reason: "PRODUCT_TOKEN_AND_ACCOUNT_ACCESS_EVALUATED_INDEPENDENTLY" },
    { key: "meta.embedded_signup", state: enabled(config, "embedded_signup") && hasApp && Boolean(config.values.embedded_signup_configuration_id) ? "AVAILABLE" : "DISABLED", reason: "OPTIONAL_PRODUCT_REQUIRES_APP_CONFIGURATION" },
  ]);
}

export function hasMetaPermission(principal: { isOwner?: boolean; permissions?: readonly string[]; deniedPermissions?: readonly string[] } | null, permission: MetaPermission) {
  if (!principal) return false;
  // Owner identity and wildcard legacy grants never replace an explicit capability.
  return principal.permissions?.includes(permission) === true && principal.deniedPermissions?.includes(permission) !== true;
}

export function collisionForConfiguration(values: Readonly<Record<string, string>>) {
  for (const [key, forbidden] of Object.entries(FORBIDDEN_STAFF_PORTAL_ASSETS)) {
    if ((values[key] || "").trim() === forbidden) return { key, code: "STAFF_PORTAL_ASSET_COLLISION" as const };
  }
  const callback = values.webhook_callback_url || "";
  if (callback.includes("daenem-staffportal-api-staging") || callback.includes("/api/communications/webhooks/whatsapp")) {
    return { key: "webhook_callback_url", code: "STAFF_PORTAL_ASSET_COLLISION" as const };
  }
  return null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importMasterKey(encoded: string) {
  const bytes = base64ToBytes(encoded.trim());
  if (bytes.byteLength !== 32) throw new Error("INTEGRATION_MASTER_KEY_INVALID");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export type EncryptedSecret = Readonly<{
  ciphertext: string;
  nonce: string;
  algorithm: "AES-256-GCM";
  keyVersion: number;
  fingerprint: string;
}>;

export async function encryptIntegrationSecret(input: {
  plaintext: string;
  masterKey: string;
  keyVersion: number;
  provider: string;
  organizationId: string;
  farmId?: string | null;
  credentialType: string;
}): Promise<EncryptedSecret> {
  if (!input.plaintext || input.plaintext.length > 16_384) throw new Error("SECRET_INPUT_INVALID");
  const key = await importMasterKey(input.masterKey);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode([input.provider, input.organizationId, input.farmId || "", input.credentialType, input.keyVersion].join("|"));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData, tagLength: 128 }, key, encoder.encode(input.plaintext));
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input.plaintext));
  const fingerprint = [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return Object.freeze({ ciphertext: bytesToBase64(new Uint8Array(ciphertext)), nonce: bytesToBase64(nonce), algorithm: "AES-256-GCM", keyVersion: input.keyVersion, fingerprint });
}

export async function decryptIntegrationSecret(input: EncryptedSecret & {
  masterKey: string;
  provider: string;
  organizationId: string;
  farmId?: string | null;
  credentialType: string;
}) {
  const key = await importMasterKey(input.masterKey);
  const additionalData = encoder.encode([input.provider, input.organizationId, input.farmId || "", input.credentialType, input.keyVersion].join("|"));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(input.nonce), additionalData, tagLength: 128 }, key, base64ToBytes(input.ciphertext));
  return decoder.decode(plaintext);
}

export type CredentialCandidate = EncryptedSecret & Readonly<{
  id: string;
  credentialType: MetaSecretType;
  createdBy: string;
  createdAt: string;
}>;

export interface CredentialReplacementRepository {
  createCandidate(candidate: CredentialCandidate): Promise<void>;
  promoteCandidate(candidateId: string, validatedAt: string, validationState: "VALID" | "PENDING", validationCode: string): Promise<number>;
  rejectCandidate(candidateId: string, validationCode: string, validatedAt: string): Promise<void>;
  writeAudit(event: Readonly<{ eventType: string; outcome: string; actorId: string; targetType: string; safeMetadata: Record<string, unknown>; createdAt: string }>): Promise<void>;
}

export async function replaceCredential(input: {
  repository: CredentialReplacementRepository;
  plaintext: string;
  masterKey: string;
  keyVersion: number;
  credentialType: MetaSecretType;
  organizationId: string;
  farmId?: string | null;
  actorId: string;
  now?: () => string;
  validate: (plaintext: string) => Promise<{ valid: boolean; code: string }>;
  promoteAs?: "VALID" | "PENDING";
}) {
  const now = input.now ?? (() => new Date().toISOString());
  const createdAt = now();
  const encrypted = await encryptIntegrationSecret({ plaintext: input.plaintext, masterKey: input.masterKey, keyVersion: input.keyVersion, provider: META_PROVIDER_KEY, organizationId: input.organizationId, farmId: input.farmId, credentialType: input.credentialType });
  const candidate: CredentialCandidate = Object.freeze({ id: crypto.randomUUID(), credentialType: input.credentialType, createdBy: input.actorId, createdAt, ...encrypted });
  await input.repository.createCandidate(candidate);
  let validation: { valid: boolean; code: string };
  try {
    validation = await input.validate(input.plaintext);
  } catch {
    validation = { valid: false, code: "PROVIDER_UNAVAILABLE" };
  }
  const validatedAt = now();
  if (!validation.valid) {
    await input.repository.rejectCandidate(candidate.id, validation.code, validatedAt);
    await input.repository.writeAudit({ eventType: "credential.validation.failed", outcome: "REJECTED", actorId: input.actorId, targetType: input.credentialType, safeMetadata: { code: validation.code, fingerprint: encrypted.fingerprint }, createdAt: validatedAt });
    return Object.freeze({ promoted: false, code: validation.code, fingerprint: encrypted.fingerprint });
  }
  const validationState = input.promoteAs ?? "VALID";
  const version = await input.repository.promoteCandidate(candidate.id, validatedAt, validationState, validation.code);
  await input.repository.writeAudit({ eventType: "credential.replaced", outcome: "SUCCESS", actorId: input.actorId, targetType: input.credentialType, safeMetadata: { version, fingerprint: encrypted.fingerprint }, createdAt: validatedAt });
  return Object.freeze({ promoted: true, code: validation.code, fingerprint: encrypted.fingerprint, version });
}

export class VersionedProviderConfigurationCache<T> {
  private cache = new Map<string, { version: number; value: T }>();

  async resolve(scopeKey: string, currentVersion: () => Promise<number>, loader: () => Promise<T>) {
    const version = await currentVersion();
    const cached = this.cache.get(scopeKey);
    if (cached?.version === version) return cached.value;
    const value = await loader();
    this.cache.set(scopeKey, { version, value });
    return value;
  }

  invalidate(scopeKey: string) {
    this.cache.delete(scopeKey);
  }
}

export function sanitizedCredentialState(state: MetaCredentialState) {
  return Object.freeze({
    configured: state.configured,
    validationState: state.validationState,
    fingerprint: state.fingerprint,
    updatedAt: state.updatedAt,
    lastValidatedAt: state.lastValidatedAt,
    updatedBy: state.updatedBy,
  });
}

export function redactIntegrationError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value || "UNKNOWN_ERROR");
  return message
    .replace(/(bearer|token|secret|verify_token|password|authorization)\s*[:=]?\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/EA[A-Za-z0-9_-]{12,}/g, "[REDACTED_TOKEN]")
    .slice(0, 240);
}

export function constantTimeTokenMatch(expected: string, provided: string) {
  const expectedBytes = encoder.encode(expected);
  const providedBytes = encoder.encode(provided);
  const length = Math.max(expectedBytes.length, providedBytes.length);
  let difference = expectedBytes.length ^ providedBytes.length;
  for (let index = 0; index < length; index += 1) difference |= (expectedBytes[index] || 0) ^ (providedBytes[index] || 0);
  return difference === 0;
}

export function webhookPostState(appSecretValid: boolean) {
  return appSecretValid
    ? { processing: "SIGNATURE_REQUIRED", status: 401 }
    : { processing: "DISABLED_FAIL_CLOSED", status: 503 };
}
