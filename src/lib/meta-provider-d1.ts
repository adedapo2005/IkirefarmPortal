import { createActivity, recordActivityTransition } from "./communications-activity-d1.ts";
import { normalizeWhatsAppSubmissionStatus } from "./communications-activity-core.ts";
import {
  FARMS_ORGANIZATION_ID,
  META_PROVIDER_KEY,
  SECRET_TYPES,
  collisionForConfiguration,
  decryptIntegrationSecret,
  evaluateMetaCapabilities,
  replaceCredential,
  type CredentialCandidate,
  type CredentialReplacementRepository,
  type MetaRuntimeConfiguration,
  type MetaSecretType,
} from "./meta-provider-control";
import {
  FARMS_AUTH_POLICY_KEYS,
  FARMS_META_WEBHOOK_FIELDS,
  FARMS_TEMPLATE_WORKFLOWS,
  MetaGraphClient,
  MetaProviderOperationError,
  normalizeMetaProviderError,
  normalizeWhatsAppTestRecipient,
  maskWhatsAppTestRecipient,
  buildWhatsAppTestTemplateComponents,
  sanitizedPhoneMetadata,
  sanitizedTemplateMetadata,
  sanitizedWabaMetadata,
} from "./meta-provider-operations";

type Row = Record<string, unknown>;
const textValue = (row: Row | null | undefined, key: string) => typeof row?.[key] === "string" ? String(row[key]) : null;
const stringValue = (value: unknown, max = 240) => typeof value === "string" ? value.slice(0, max) : null;
const numberValue = (row: Row | null | undefined, key: string) => typeof row?.[key] === "number" ? Number(row[key]) : Number(row?.[key] || 0);
const boolValue = (row: Row | null | undefined, key: string) => row?.[key] === true || row?.[key] === 1;
const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

const CONFIGURATION_KEYS = new Set([
  "business_portfolio_id", "meta_app_id", "system_user_id", "graph_api_version", "waba_id",
  "phone_number_id", "whatsapp_display_number", "embedded_signup_configuration_id",
  "facebook_page_ids", "instagram_business_account_ids", "phone_registration_state", "webhook_callback_url",
]);

const PRODUCT_KEYS = new Set([
  "whatsapp_business", "whatsapp_authentication", "whatsapp_webhooks", "facebook_login",
  "facebook_pages", "instagram", "embedded_signup",
]);

function isoNow() { return new Date().toISOString(); }

function ownedWabaEdgeUnavailable(error: unknown) {
  if (!(error instanceof MetaProviderOperationError)) return false;
  return /owned_whatsapp_business_accounts|nonexisting field|#100\b/i.test(error.message);
}

function jsonArray(value: unknown, maxItems = 30) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error("TEMPLATE_COMPONENTS_INVALID");
  return value;
}

function templateCategory(value: unknown) {
  if (value !== "AUTHENTICATION" && value !== "UTILITY") throw new Error("TEMPLATE_CATEGORY_UNSUPPORTED");
  return value;
}

function validateTemplateInput(input: Record<string, unknown>) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const language = typeof input.language === "string" ? input.language.trim() : "";
  const category = templateCategory(input.category);
  if (!/^[a-z][a-z0-9_]{2,511}$/.test(name)) throw new Error("TEMPLATE_NAME_INVALID");
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) throw new Error("TEMPLATE_LANGUAGE_INVALID");
  const components = jsonArray(input.components);
  const localPurpose = typeof input.localPurpose === "string" ? input.localPurpose.trim().slice(0, 500) : null;
  return { name, language, category, components, localPurpose };
}

function authPolicyValues(input: Record<string, unknown>) {
  const integer = (key: string, min: number, max: number, fallback: number) => {
    const value = input[key] === undefined ? fallback : Number(input[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`AUTH_POLICY_${key.toUpperCase()}_INVALID`);
    return value;
  };
  const policyKey = typeof input.policyKey === "string" ? input.policyKey : "";
  if (!(FARMS_AUTH_POLICY_KEYS as readonly string[]).includes(policyKey)) throw new Error("AUTH_POLICY_KEY_INVALID");
  const fallbackBehavior = input.fallbackBehavior === undefined ? "DISABLED" : String(input.fallbackBehavior);
  if (!["DISABLED", "LOCAL_ONLY", "OWNER_REVIEW"].includes(fallbackBehavior)) throw new Error("AUTH_POLICY_FALLBACK_INVALID");
  const list = (key: string) => {
    const value = input[key] === undefined ? [] : input[key];
    if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== "string" || item.length > 120)) throw new Error(`AUTH_POLICY_${key.toUpperCase()}_INVALID`);
    return value;
  };
  const rateLimitInput = input.rateLimitPolicy === undefined ? {} : input.rateLimitPolicy;
  if (!rateLimitInput || typeof rateLimitInput !== "object" || Array.isArray(rateLimitInput)) throw new Error("AUTH_POLICY_RATE_LIMIT_INVALID");
  const rateLimitObject = rateLimitInput as Record<string, unknown>;
  const boundedRateLimit = (key: string, min: number, max: number, fallback: number) => {
    const value = rateLimitObject[key] === undefined ? fallback : Number(rateLimitObject[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`AUTH_POLICY_RATE_LIMIT_${key.toUpperCase()}_INVALID`);
    return value;
  };
  const rateLimitPolicy = {
    windowSeconds: boundedRateLimit("windowSeconds", 1, 3600, 60),
    maxRequests: boundedRateLimit("maxRequests", 1, 1000, 5),
  };
  return {
    policyKey,
    enabled: input.enabled === true,
    templateMappingId: typeof input.templateMappingId === "string" ? input.templateMappingId : null,
    expiresSeconds: integer("expiresSeconds", 30, 900, 300),
    cooldownSeconds: integer("cooldownSeconds", 5, 3600, 30),
    maxAttempts: integer("maxAttempts", 1, 10, 5),
    resendMaximum: integer("resendMaximum", 0, 10, 3),
    rateLimitPolicy,
    eligibleRoles: list("eligibleRoles"),
    eligibleFarms: list("eligibleFarms"),
    fallbackBehavior,
  };
}

export class D1MetaProviderRepository {
  constructor(private readonly db: D1Database) {}

  async ensureConnection(actorId: string) {
    const now = isoNow();
    const providerId = "provider-meta";
    const connectionId = "meta-daenem-farms-organization";
    await this.db.batch([
      this.db.prepare("INSERT INTO integration_providers (id, provider_key, display_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(provider_key) DO NOTHING").bind(providerId, META_PROVIDER_KEY, "Meta", "NOT_CONFIGURED", now, now),
      this.db.prepare("INSERT INTO integration_connections (id, provider_id, organization_id, farm_id, scope_type, display_name, configuration_json, version, state, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING").bind(connectionId, providerId, FARMS_ORGANIZATION_ID, "organization", "DAENEM Farms Meta", "{}", "NOT_CONFIGURED", actorId, actorId, now, now),
    ]);
    return connectionId;
  }

  async getConnection(connectionId: string) {
    const result = await this.db.prepare("SELECT * FROM integration_connections WHERE id = ? AND organization_id = ?").bind(connectionId, FARMS_ORGANIZATION_ID).first<Row>();
    if (!result) throw new Error("META_CONNECTION_NOT_FOUND");
    return result;
  }

  private async graphContext(connectionId: string, masterKey: string) {
    const connection = await this.getConnection(connectionId);
    const values = parseJson<Record<string, string>>(connection.configuration_json, {});
    const graphVersion = values.graph_api_version;
    if (!graphVersion) throw new MetaProviderOperationError("GRAPH_VERSION_UNSUPPORTED", "GRAPH_VERSION_REQUIRED");
    const encrypted = await this.activeSecret(connectionId, "system_user_access_token");
    if (!encrypted || encrypted.validationState !== "VALID") throw new MetaProviderOperationError("AUTHORIZATION_EXPIRED", "TOKEN_NOT_CONFIGURED");
    if (!masterKey) throw new MetaProviderOperationError("META_PROVIDER_UNAVAILABLE", "SECURE_STORAGE_BOOTSTRAP_REQUIRED");
    const token = await decryptIntegrationSecret({ ...encrypted, masterKey, provider: META_PROVIDER_KEY, organizationId: FARMS_ORGANIZATION_ID, farmId: null, credentialType: "system_user_access_token" });
    return { values, client: new MetaGraphClient(token, graphVersion) };
  }

  private async appSubscriptionContext(connectionId: string, masterKey: string) {
    const connection = await this.getConnection(connectionId);
    const values = parseJson<Record<string, string>>(connection.configuration_json, {});
    const graphVersion = values.graph_api_version;
    const appId = values.meta_app_id;
    if (!graphVersion) throw new MetaProviderOperationError("GRAPH_VERSION_UNSUPPORTED", "GRAPH_VERSION_REQUIRED");
    if (!appId) throw new MetaProviderOperationError("APP_WABA_MISMATCH", "META_APP_REQUIRED");
    const encrypted = await this.activeSecret(connectionId, "meta_app_secret");
    if (!encrypted || !["VALID", "PENDING"].includes(encrypted.validationState)) throw new MetaProviderOperationError("META_PROVIDER_UNAVAILABLE", "APP_SECRET_REQUIRED");
    if (!masterKey) throw new MetaProviderOperationError("META_PROVIDER_UNAVAILABLE", "SECURE_STORAGE_BOOTSTRAP_REQUIRED");
    const appSecret = await decryptIntegrationSecret({ ...encrypted, masterKey, provider: META_PROVIDER_KEY, organizationId: FARMS_ORGANIZATION_ID, farmId: null, credentialType: "meta_app_secret" });
    return { values, client: new MetaGraphClient(`${appId}|${appSecret}`, graphVersion) };
  }

  private async audit(connectionId: string, actorId: string, eventType: string, targetType: string, outcome: string, safeMetadata: Record<string, unknown> = {}) {
    const now = isoNow();
    await this.db.prepare("INSERT INTO integration_audit_events (id, connection_id, organization_id, farm_id, actor_id, event_type, target_type, target_id, outcome, safe_metadata_json, correlation_id, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?)").bind(crypto.randomUUID(), connectionId, FARMS_ORGANIZATION_ID, actorId, eventType, targetType, outcome, JSON.stringify(safeMetadata), crypto.randomUUID(), now).run();
  }

  private async health(connectionId: string, component: string, state: string, code: string | null) {
    const now = isoNow();
    await this.db.prepare("INSERT INTO integration_health (id, connection_id, component, state, sanitized_code, checked_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(connection_id, component) DO UPDATE SET state = excluded.state, sanitized_code = excluded.sanitized_code, checked_at = excluded.checked_at").bind(`health-${connectionId}-${component}`, connectionId, component, state, code, now).run();
  }

  private assertNoForbidden(value: string, kind: "waba_id" | "phone_number_id") {
    const forbidden = kind === "waba_id" ? "2629975567461440" : "1328876183640670";
    if (value.trim() === forbidden) throw new MetaProviderOperationError(kind === "waba_id" ? "WABA_NOT_ACCESSIBLE" : "PHONE_NOT_ACCESSIBLE", "STAFF_PORTAL_ASSET_COLLISION");
  }

  async discoverWabas(connectionId: string, actorId: string, masterKey: string) {
    const { values, client } = await this.graphContext(connectionId, masterKey);
    if (!values.business_portfolio_id) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "BUSINESS_PORTFOLIO_REQUIRED");
    try {
      let accounts: ReturnType<typeof sanitizedWabaMetadata>[] = [];
      let fallbackUsed = false;
      try {
        const response = await client.get<{ data?: Record<string, unknown>[] }>(values.business_portfolio_id + "/owned_whatsapp_business_accounts", { fields: "id,name,account_review_status,business_verification_status,ownership_type", limit: 100 });
        accounts = (Array.isArray(response.data) ? response.data : []).map(sanitizedWabaMetadata).filter((account) => account.id && account.id !== "2629975567461440");
      } catch (error) {
        if (!ownedWabaEdgeUnavailable(error) || !values.waba_id) throw error;
        this.assertNoForbidden(values.waba_id, "waba_id");
        const configured = await client.get<Record<string, unknown>>(values.waba_id, { fields: "id,name,account_review_status,business_verification_status,ownership_type" });
        const account = sanitizedWabaMetadata({ ...configured, owner_business_id: configured.owner_business_id || values.business_portfolio_id });
        if (account.id && account.id !== "2629975567461440") accounts = [account];
        fallbackUsed = true;
        await this.audit(connectionId, actorId, "waba.discovery.fallback", "waba", "SUCCESS", { source: "CONFIGURED_WABA_FALLBACK", reason: "OWNED_EDGE_FIELD_UNAVAILABLE" });
      }
      const now = isoNow();
      const statements = accounts.map((account) => this.db.prepare("INSERT INTO whatsapp_business_accounts (id, connection_id, provider_waba_id, display_name, owner_business_id, status, metadata_json, selected, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT(connection_id, provider_waba_id) DO UPDATE SET display_name = excluded.display_name, owner_business_id = excluded.owner_business_id, status = excluded.status, metadata_json = excluded.metadata_json, last_synced_at = excluded.last_synced_at").bind(`waba-${connectionId}-${account.id}`, connectionId, account.id, account.name, account.ownerBusinessId, account.status, JSON.stringify(account), now));
      if (statements.length) await this.db.batch(statements);
      await this.audit(connectionId, actorId, "waba.discovery", "waba", "SUCCESS", { count: accounts.length, source: fallbackUsed ? "CONFIGURED_WABA_FALLBACK" : "OWNED_WABAS" });
      await this.health(connectionId, "waba_discovery", "HEALTHY", null);
      return { items: accounts, selectedId: values.waba_id || null, source: fallbackUsed ? "CONFIGURED_WABA" : "OWNED_WABAS" };
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.audit(connectionId, actorId, "waba.discovery", "waba", "FAILED", { code: safe.code, providerCode: safe.providerCode });
      await this.health(connectionId, "waba_discovery", "DEGRADED", safe.code);
      throw new MetaProviderOperationError(safe.code, safe.message, safe.providerCode);
    }
  }

  async selectWaba(connectionId: string, actorId: string, wabaId: string) {
    this.assertNoForbidden(wabaId, "waba_id");
    const row = await this.db.prepare("SELECT provider_waba_id, display_name, owner_business_id, status, metadata_json FROM whatsapp_business_accounts WHERE connection_id = ? AND provider_waba_id = ?").bind(connectionId, wabaId).first<Row>();
    if (!row) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "WABA_NOT_DISCOVERED");
    const connection = await this.getConnection(connectionId);
    const values = parseJson<Record<string, string>>(connection.configuration_json, {});
    const ownerBusinessId = textValue(row, "owner_business_id");
    if (values.business_portfolio_id && ownerBusinessId && ownerBusinessId !== values.business_portfolio_id) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "WABA_OWNER_MISMATCH");
    const next: Record<string, string> = { ...values, waba_id: wabaId };
    delete next.phone_number_id;
    delete next.whatsapp_display_number;
    delete next.phone_registration_state;
    const now = isoNow();
    await this.db.batch([
      this.db.prepare("UPDATE whatsapp_business_accounts SET selected = CASE WHEN provider_waba_id = ? THEN 1 ELSE 0 END WHERE connection_id = ?").bind(wabaId, connectionId),
      this.db.prepare("UPDATE whatsapp_senders SET selected = 0 WHERE connection_id = ?").bind(connectionId),
      this.db.prepare("DELETE FROM whatsapp_template_mappings WHERE connection_id = ?").bind(connectionId),
      this.db.prepare("UPDATE whatsapp_auth_policies SET enabled = 0, template_mapping_id = NULL, updated_by = ?, updated_at = ? WHERE connection_id = ?").bind(actorId, now, connectionId),
      this.db.prepare("UPDATE integration_connections SET configuration_json = ?, version = version + 1, state = 'PARTIALLY_CONFIGURED', updated_by = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(next), actorId, now, connectionId),
    ]);
    await this.audit(connectionId, actorId, "waba.selected", "waba", "SUCCESS", { wabaId });
    return this.snapshot(connectionId);
  }

  async discoverPhones(connectionId: string, actorId: string, masterKey: string) {
    const { values, client } = await this.graphContext(connectionId, masterKey);
    const wabaId = values.waba_id;
    if (!wabaId) throw new MetaProviderOperationError("PHONE_NOT_ACCESSIBLE", "WABA_REQUIRED");
    this.assertNoForbidden(wabaId, "waba_id");
    try {
      const response = await client.get<{ data?: Record<string, unknown>[] }>(`${wabaId}/phone_numbers`, { fields: "id,display_phone_number,verified_name,quality_rating,status,name_status,code_verification_status", limit: 100 });
      const phones = (Array.isArray(response.data) ? response.data : []).map(sanitizedPhoneMetadata).filter((phone) => phone.id && phone.id !== "1328876183640670");
      const now = isoNow();
      const statements = phones.map((phone) => this.db.prepare("INSERT INTO whatsapp_senders (id, connection_id, waba_id, provider_phone_number_id, display_phone_masked, verified_name, registration_state, quality_state, metadata_json, selected, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT(connection_id, provider_phone_number_id) DO UPDATE SET waba_id = excluded.waba_id, display_phone_masked = excluded.display_phone_masked, verified_name = excluded.verified_name, registration_state = excluded.registration_state, quality_state = excluded.quality_state, metadata_json = excluded.metadata_json, last_synced_at = excluded.last_synced_at").bind(`sender-${connectionId}-${phone.id}`, connectionId, wabaId, phone.id, phone.displayPhoneNumber, phone.verifiedName, phone.registrationState, phone.qualityState, JSON.stringify(phone), now));
      if (statements.length) await this.db.batch(statements);
      await this.audit(connectionId, actorId, "phone.discovery", "phone", "SUCCESS", { count: phones.length, wabaId });
      await this.health(connectionId, "phone_discovery", "HEALTHY", null);
      return { items: phones, selectedId: values.phone_number_id || null };
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.audit(connectionId, actorId, "phone.discovery", "phone", "FAILED", { code: safe.code, providerCode: safe.providerCode });
      await this.health(connectionId, "phone_discovery", "DEGRADED", safe.code);
      throw new MetaProviderOperationError(safe.code, safe.message, safe.providerCode);
    }
  }

  async selectPhone(connectionId: string, actorId: string, phoneId: string) {
    this.assertNoForbidden(phoneId, "phone_number_id");
    const connection = await this.getConnection(connectionId);
    const values = parseJson<Record<string, string>>(connection.configuration_json, {});
    if (!values.waba_id) throw new MetaProviderOperationError("PHONE_NOT_ACCESSIBLE", "WABA_REQUIRED");
    const row = await this.db.prepare("SELECT provider_phone_number_id, waba_id, display_phone_masked, registration_state FROM whatsapp_senders WHERE connection_id = ? AND provider_phone_number_id = ? AND waba_id = ?").bind(connectionId, phoneId, values.waba_id).first<Row>();
    if (!row) throw new MetaProviderOperationError("PHONE_NOT_ACCESSIBLE", "PHONE_NOT_DISCOVERED");
    const next = { ...values, phone_number_id: phoneId, whatsapp_display_number: textValue(row, "display_phone_masked") || "", phone_registration_state: textValue(row, "registration_state") || "UNKNOWN" };
    const now = isoNow();
    await this.db.batch([
      this.db.prepare("UPDATE whatsapp_senders SET selected = CASE WHEN provider_phone_number_id = ? THEN 1 ELSE 0 END WHERE connection_id = ? AND waba_id = ?").bind(phoneId, connectionId, values.waba_id),
      this.db.prepare("UPDATE integration_connections SET configuration_json = ?, version = version + 1, state = 'PARTIALLY_CONFIGURED', updated_by = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(next), actorId, now, connectionId),
    ]);
    await this.audit(connectionId, actorId, "phone.selected", "phone", "SUCCESS", { phoneId, wabaId: values.waba_id });
    return this.snapshot(connectionId);
  }

  async syncTemplates(connectionId: string, actorId: string, masterKey: string) {
    const { values, client } = await this.graphContext(connectionId, masterKey);
    const wabaId = values.waba_id;
    if (!wabaId) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "WABA_REQUIRED");
    this.assertNoForbidden(wabaId, "waba_id");
    try {
      const response = await client.get<{ data?: Record<string, unknown>[] }>(`${wabaId}/message_templates`, { fields: "id,name,category,language,status,rejected_reason,components,updated_time", limit: 100 });
      const templates = (Array.isArray(response.data) ? response.data : []).map(sanitizedTemplateMetadata);
      const now = isoNow();
      const statements: D1PreparedStatement[] = templates.map((template) => this.db.prepare("INSERT INTO whatsapp_templates (id, connection_id, provider_template_id, name, category, language, waba_id, components_json, local_purpose, provider_status, rejection_reason, provider_updated_at, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?) ON CONFLICT(connection_id, name, language) DO UPDATE SET provider_template_id = excluded.provider_template_id, category = excluded.category, waba_id = excluded.waba_id, components_json = excluded.components_json, provider_status = excluded.provider_status, rejection_reason = excluded.rejection_reason, provider_updated_at = excluded.provider_updated_at, last_synced_at = excluded.last_synced_at").bind(`template-${connectionId}-${template.name}-${template.language}`, connectionId, template.id, template.name, template.category, template.language, wabaId, JSON.stringify(template.components), template.status, template.rejectionReason, template.providerUpdatedAt, now));
      if (statements.length) await this.db.batch(statements);
      await this.audit(connectionId, actorId, "template.sync", "template", "SUCCESS", { count: templates.length, wabaId });
      await this.health(connectionId, "template_sync", "HEALTHY", null);
      return this.templateSnapshot(connectionId);
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.audit(connectionId, actorId, "template.sync", "template", "FAILED", { code: safe.code, providerCode: safe.providerCode });
      await this.health(connectionId, "template_sync", "DEGRADED", safe.code);
      throw new MetaProviderOperationError(safe.code, safe.message, safe.providerCode);
    }
  }

  async createTemplate(connectionId: string, actorId: string, masterKey: string, input: Record<string, unknown>) {
    const template = validateTemplateInput(input);
    const { values, client } = await this.graphContext(connectionId, masterKey);
    const wabaId = values.waba_id;
    if (!wabaId) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "WABA_REQUIRED");
    this.assertNoForbidden(wabaId, "waba_id");
    try {
      const response = await client.post<Record<string, unknown>>(`${wabaId}/message_templates`, { name: template.name, category: template.category, language: template.language, components: template.components });
      const provider = sanitizedTemplateMetadata({ ...response, ...template, id: response.id, status: response.status || "PENDING", components: template.components });
      const now = isoNow();
      await this.db.prepare("INSERT INTO whatsapp_templates (id, connection_id, provider_template_id, name, category, language, waba_id, components_json, local_purpose, provider_status, rejection_reason, provider_updated_at, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(connection_id, name, language) DO UPDATE SET provider_template_id = excluded.provider_template_id, waba_id = excluded.waba_id, components_json = excluded.components_json, local_purpose = excluded.local_purpose, provider_status = excluded.provider_status, rejection_reason = excluded.rejection_reason, provider_updated_at = excluded.provider_updated_at, last_synced_at = excluded.last_synced_at").bind(`template-${connectionId}-${template.name}-${template.language}`, connectionId, provider.id, template.name, template.category, template.language, wabaId, JSON.stringify(template.components), template.localPurpose, provider.status, provider.rejectionReason, provider.providerUpdatedAt, now).run();
      await this.audit(connectionId, actorId, "template.create", "template", "SUCCESS", { name: template.name, category: template.category, language: template.language, wabaId });
      return this.templateSnapshot(connectionId);
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.audit(connectionId, actorId, "template.create", "template", "FAILED", { code: safe.code, providerCode: safe.providerCode });
      throw new MetaProviderOperationError(safe.code === "UNKNOWN_PROVIDER_ERROR" ? "TEMPLATE_REJECTED" : safe.code, safe.message, safe.providerCode);
    }
  }

  async updateTemplate(connectionId: string, actorId: string, masterKey: string, templateId: string, input: Record<string, unknown>) {
    const template = validateTemplateInput(input);
    const row = await this.db.prepare("SELECT provider_template_id, waba_id FROM whatsapp_templates WHERE connection_id = ? AND id = ?").bind(connectionId, templateId).first<Row>();
    if (!row || !textValue(row, "provider_template_id")) throw new MetaProviderOperationError("TEMPLATE_REJECTED", "TEMPLATE_NOT_DISCOVERED");
    const { values, client } = await this.graphContext(connectionId, masterKey);
    if (!values.waba_id || textValue(row, "waba_id") !== values.waba_id) throw new MetaProviderOperationError("APP_WABA_MISMATCH", "TEMPLATE_WABA_MISMATCH");
    try {
      const response = await client.post<Record<string, unknown>>(String(row.provider_template_id), { name: template.name, category: template.category, language: template.language, components: template.components });
      const provider = sanitizedTemplateMetadata({ ...response, ...template, id: row.provider_template_id, status: response.status || "PENDING", components: template.components });
      const now = isoNow();
      await this.db.prepare("UPDATE whatsapp_templates SET name = ?, category = ?, language = ?, components_json = ?, local_purpose = ?, provider_status = ?, rejection_reason = ?, provider_updated_at = ?, last_synced_at = ? WHERE connection_id = ? AND id = ?").bind(template.name, template.category, template.language, JSON.stringify(template.components), template.localPurpose, provider.status, provider.rejectionReason, provider.providerUpdatedAt, now, connectionId, templateId).run();
      await this.audit(connectionId, actorId, "template.update", "template", "SUCCESS", { templateId, category: template.category });
      return this.templateSnapshot(connectionId);
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.audit(connectionId, actorId, "template.update", "template", "FAILED", { templateId, code: safe.code, providerCode: safe.providerCode });
      throw new MetaProviderOperationError(safe.code === "UNKNOWN_PROVIDER_ERROR" ? "TEMPLATE_REJECTED" : safe.code, safe.message, safe.providerCode);
    }
  }

  async mapTemplate(connectionId: string, actorId: string, input: Record<string, unknown>) {
    const workflowKey = typeof input.workflowKey === "string" ? input.workflowKey : "";
    const templateId = typeof input.templateId === "string" ? input.templateId : "";
    if (!(FARMS_TEMPLATE_WORKFLOWS as readonly string[]).includes(workflowKey)) throw new Error("TEMPLATE_WORKFLOW_INVALID");
    const row = await this.db.prepare("SELECT id, provider_status, category, waba_id FROM whatsapp_templates WHERE connection_id = ? AND id = ?").bind(connectionId, templateId).first<Row>();
    if (!row) throw new Error("TEMPLATE_NOT_FOUND");
    const connection = await this.getConnection(connectionId);
    const values = parseJson<Record<string, string>>(connection.configuration_json, {});
    if (textValue(row, "waba_id") !== values.waba_id) throw new Error("TEMPLATE_WABA_MISMATCH");
    if (input.enabled === true && textValue(row, "provider_status") !== "APPROVED") throw new Error("TEMPLATE_NOT_APPROVED");
    if (workflowKey.endsWith("verification") || workflowKey === "account_recovery" || workflowKey === "signin_verification" || workflowKey === "signup_verification") {
      if (textValue(row, "category") !== "AUTHENTICATION") throw new Error("AUTHENTICATION_TEMPLATE_REQUIRED");
    }
    const now = isoNow();
    await this.db.prepare("INSERT INTO whatsapp_template_mappings (id, connection_id, workflow_key, template_id, enabled, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(connection_id, workflow_key) DO UPDATE SET template_id = excluded.template_id, enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(`mapping-${connectionId}-${workflowKey}`, connectionId, workflowKey, templateId, input.enabled === true ? 1 : 0, actorId, now).run();
    await this.audit(connectionId, actorId, "template.mapping.changed", "template_mapping", "SUCCESS", { workflowKey, templateId, enabled: input.enabled === true });
    return this.templateConfigurationSnapshot(connectionId);
  }

  async setAuthPolicy(connectionId: string, actorId: string, input: Record<string, unknown>) {
    const policy = authPolicyValues(input);
    if (policy.templateMappingId) {
      const mapping = await this.db.prepare("SELECT id, enabled FROM whatsapp_template_mappings WHERE connection_id = ? AND id = ?").bind(connectionId, policy.templateMappingId).first<Row>();
      if (!mapping) throw new Error("AUTH_POLICY_TEMPLATE_MAPPING_NOT_FOUND");
    }
    const now = isoNow();
    await this.db.prepare("INSERT INTO whatsapp_auth_policies (id, connection_id, policy_key, enabled, template_mapping_id, expires_seconds, cooldown_seconds, max_attempts, resend_maximum, rate_limit_policy_json, eligible_roles_json, eligible_farms_json, fallback_behavior, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(connection_id, policy_key) DO UPDATE SET enabled = excluded.enabled, template_mapping_id = excluded.template_mapping_id, expires_seconds = excluded.expires_seconds, cooldown_seconds = excluded.cooldown_seconds, max_attempts = excluded.max_attempts, resend_maximum = excluded.resend_maximum, rate_limit_policy_json = excluded.rate_limit_policy_json, eligible_roles_json = excluded.eligible_roles_json, eligible_farms_json = excluded.eligible_farms_json, fallback_behavior = excluded.fallback_behavior, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(`policy-${connectionId}-${policy.policyKey}`, connectionId, policy.policyKey, policy.enabled ? 1 : 0, policy.templateMappingId, policy.expiresSeconds, policy.cooldownSeconds, policy.maxAttempts, policy.resendMaximum, JSON.stringify(policy.rateLimitPolicy), JSON.stringify(policy.eligibleRoles), JSON.stringify(policy.eligibleFarms), policy.fallbackBehavior, actorId, now).run();
    await this.db.prepare("UPDATE integration_connections SET version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(actorId, now, connectionId).run();
    await this.audit(connectionId, actorId, "auth_policy.changed", "auth_policy", "SUCCESS", { policyKey: policy.policyKey, enabled: policy.enabled });
    return this.templateConfigurationSnapshot(connectionId);
  }

  async checkSubscription(connectionId: string, actorId: string, masterKey: string) {
    const { values, client } = await this.graphContext(connectionId, masterKey);
    const { client: appClient } = await this.appSubscriptionContext(connectionId, masterKey);
    const wabaId = values.waba_id;
    const appId = values.meta_app_id;
    if (!wabaId) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "WABA_REQUIRED");
    if (!appId) throw new MetaProviderOperationError("APP_WABA_MISMATCH", "META_APP_REQUIRED");
    this.assertNoForbidden(wabaId, "waba_id");
    try {
      const [wabaResponse, appResponse] = await Promise.all([
        client.get<{ data?: Record<string, unknown>[] }>(`${wabaId}/subscribed_apps`),
        appClient.get<{ data?: Record<string, unknown>[] }>(`${appId}/subscriptions`),
      ]);
      const wabaApps = Array.isArray(wabaResponse.data) ? wabaResponse.data.map((item) => {
        const apiData = item.whatsapp_business_api_data && typeof item.whatsapp_business_api_data === "object" ? item.whatsapp_business_api_data as Record<string, unknown> : {};
        return { appId: stringValue(apiData.id) || stringValue(apiData.app_id) || stringValue(item.app_id) || null, name: stringValue(apiData.name) || stringValue(apiData.app_name) || stringValue(item.name) || null };
      }) : [];
      const wabaApp = wabaApps.find((item) => item.appId === appId) || null;
      const appSubscriptions = Array.isArray(appResponse.data) ? appResponse.data : [];
      const appSubscription = appSubscriptions.find((item) => stringValue(item.object) === "whatsapp_business_account") || null;
      const rawFields = Array.isArray(appSubscription?.fields) ? appSubscription.fields : [];
      const subscribedFields = rawFields.flatMap((field) => {
        if (typeof field === "string") return [field];
        if (field && typeof field === "object") {
          const name = stringValue((field as Record<string, unknown>).name);
          return name ? [name] : [];
        }
        return [];
      }).filter((field): field is typeof FARMS_META_WEBHOOK_FIELDS[number] => FARMS_META_WEBHOOK_FIELDS.includes(field as typeof FARMS_META_WEBHOOK_FIELDS[number]));
      const normalizeCallback = (value: string | null | undefined) => (value || "").trim().replace(/\/+$/, "");
      const configuredCallback = normalizeCallback(values.webhook_callback_url);
      const providerCallback = normalizeCallback(stringValue(appSubscription?.callback_url));
      const callbackMatches = Boolean(configuredCallback && providerCallback && configuredCallback === providerCallback);
      const appActive = Boolean(appSubscription && appSubscription.active !== false);
      const messagesSubscribed = subscribedFields.includes("messages");
      const fullySubscribed = Boolean(wabaApp && appActive && callbackMatches && messagesSubscribed);
      const now = isoNow();
      await this.db.prepare("INSERT INTO whatsapp_webhook_config (id, connection_id, callback_url, get_verification_state, post_signature_state, subscription_state, subscribed_fields_json, updated_by, updated_at) VALUES (?, ?, ?, 'PENDING', 'PENDING_APP_SECRET', ?, ?, ?, ?) ON CONFLICT(connection_id) DO UPDATE SET subscription_state = excluded.subscription_state, subscribed_fields_json = excluded.subscribed_fields_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(`webhook-${connectionId}`, connectionId, values.webhook_callback_url || null, fullySubscribed ? "SUBSCRIBED" : "PENDING", JSON.stringify(subscribedFields), actorId, now).run();
      await this.audit(connectionId, actorId, "subscription.inspected", "waba_subscription", "SUCCESS", { wabaAttached: Boolean(wabaApp), appSubscriptionActive: appActive, callbackMatches, messagesSubscribed, fields: subscribedFields });
      return {
        state: fullySubscribed ? "SUBSCRIBED" : "PENDING",
        appId: wabaApp?.appId || null,
        subscribedFields,
        requiredFields: FARMS_META_WEBHOOK_FIELDS,
        wabaAttached: Boolean(wabaApp),
        appSubscription: { active: appActive, callbackMatches, messagesSubscribed },
      };
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.audit(connectionId, actorId, "subscription.inspected", "waba_subscription", "FAILED", { code: safe.code, providerCode: safe.providerCode });
      throw new MetaProviderOperationError(safe.code, safe.message, safe.providerCode);
    }
  }

  async subscribeToWaba(connectionId: string, actorId: string, masterKey: string) {
    const { values, client } = await this.graphContext(connectionId, masterKey);
    if (!values.waba_id || !values.meta_app_id) throw new MetaProviderOperationError("APP_WABA_MISMATCH", "APP_AND_WABA_REQUIRED");
    this.assertNoForbidden(values.waba_id, "waba_id");
    if (values.meta_app_id === "1386392646479708") throw new MetaProviderOperationError("APP_WABA_MISMATCH", "STAFF_PORTAL_APP_COLLISION");
    if (!values.webhook_callback_url) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "FARMS_STAGING_ENDPOINT_REQUIRED");
    if (values.webhook_callback_url.includes("daenem-staffportal-api-staging")) throw new MetaProviderOperationError("APP_WABA_MISMATCH", "STAFF_PORTAL_WEBHOOK_COLLISION");
    try {
      await client.post(`${values.waba_id}/subscribed_apps`, {});
      await this.audit(connectionId, actorId, "subscription.mutated", "waba_subscription", "SUCCESS", { wabaAttached: true });
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.audit(connectionId, actorId, "subscription.mutated", "waba_subscription", "FAILED", { code: safe.code, providerCode: safe.providerCode });
      throw new MetaProviderOperationError(safe.code, safe.message, safe.providerCode);
    }
    return this.checkSubscription(connectionId, actorId, masterKey);
  }

  async testConnection(connectionId: string, actorId: string, masterKey: string) {
    const { values, client } = await this.graphContext(connectionId, masterKey);
    try {
      await client.get("me", { fields: "id" });
      if (values.waba_id) {
        this.assertNoForbidden(values.waba_id, "waba_id");
        await client.get(values.waba_id, { fields: "id,name" });
      }
      await this.health(connectionId, "provider", "HEALTHY", null);
      await this.audit(connectionId, actorId, "provider.diagnostics", "provider", "SUCCESS", { wabaConfigured: Boolean(values.waba_id) });
      return this.persistCapabilities(connectionId, actorId);
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      await this.health(connectionId, "provider", "DEGRADED", safe.code);
      await this.audit(connectionId, actorId, "provider.diagnostics", "provider", "FAILED", { code: safe.code, providerCode: safe.providerCode });
      throw new MetaProviderOperationError(safe.code, safe.message, safe.providerCode);
    }
  }

  async sendTestMessage(connectionId: string, actorId: string, masterKey: string, input: Record<string, unknown>) {
    if (input.confirmSend !== true) throw new MetaProviderOperationError("SEND_CONFIRMATION_REQUIRED", "SEND_CONFIRMATION_REQUIRED");
    if (input.consentConfirmed !== true) throw new MetaProviderOperationError("RECIPIENT_CONSENT_REQUIRED", "RECIPIENT_CONSENT_REQUIRED");
    const recipientDigits = normalizeWhatsAppTestRecipient(input.recipient);
    const recipientMasked = maskWhatsAppTestRecipient(recipientDigits);
    const templateId = typeof input.templateId === "string" ? input.templateId.trim() : "";
    if (!templateId || templateId.length > 240) throw new MetaProviderOperationError("TEST_TEMPLATE_REQUIRED", "TEST_TEMPLATE_REQUIRED");

    const { values, client } = await this.graphContext(connectionId, masterKey);
    const current = await this.snapshot(connectionId);
    const messaging = current.capabilities.find((item) => item.key === "meta.whatsapp.messaging");
    if (messaging?.state !== "AVAILABLE") throw new MetaProviderOperationError("WHATSAPP_MESSAGING_UNAVAILABLE", "WHATSAPP_MESSAGING_UNAVAILABLE");
    const wabaId = values.waba_id || "";
    const phoneId = values.phone_number_id || "";
    this.assertNoForbidden(wabaId, "waba_id");
    this.assertNoForbidden(phoneId, "phone_number_id");
    if (!wabaId || !phoneId || !["REGISTERED", "CONNECTED"].includes((values.phone_registration_state || "").toUpperCase())) {
      throw new MetaProviderOperationError("PHONE_NOT_ACCESSIBLE", "PHONE_NOT_SELECTED_OR_CONNECTED");
    }

    const sender = await this.db.prepare("SELECT id FROM whatsapp_senders WHERE connection_id = ? AND provider_phone_number_id = ? AND waba_id = ? AND selected = 1").bind(connectionId, phoneId, wabaId).first<Row>();
    if (!sender) throw new MetaProviderOperationError("PHONE_NOT_ACCESSIBLE", "PHONE_NOT_EXPLICITLY_SELECTED");

    const template = await this.db.prepare("SELECT id, provider_template_id, name, category, language, waba_id, components_json, provider_status FROM whatsapp_templates WHERE connection_id = ? AND id = ?").bind(connectionId, templateId).first<Row>();
    if (!template) throw new MetaProviderOperationError("TEMPLATE_NOT_FOUND", "TEST_TEMPLATE_NOT_FOUND");
    if (textValue(template, "waba_id") !== wabaId) throw new MetaProviderOperationError("WABA_NOT_ACCESSIBLE", "TEMPLATE_WABA_MISMATCH");
    if (textValue(template, "provider_status") !== "APPROVED") throw new MetaProviderOperationError("TEMPLATE_NOT_APPROVED", "TEST_TEMPLATE_NOT_APPROVED");
    if (textValue(template, "category") !== "UTILITY") throw new MetaProviderOperationError("TEST_TEMPLATE_CATEGORY_INVALID", "TEST_TEMPLATE_MUST_BE_UTILITY");

    const components = parseJson<unknown[]>(textValue(template, "components_json"), []);
    const graphComponents = buildWhatsAppTestTemplateComponents(components, input.parameters);
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientDigits,
      type: "template",
      template: {
        name: textValue(template, "name") || "",
        language: { code: textValue(template, "language") || "" },
        ...(graphComponents.length ? { components: graphComponents } : {}),
      },
    };

    // Persist pending activity before sending: an untracked send must fail closed.
    const activityId = await createActivity(this.db, {
      channel: "WHATSAPP", purpose: "test_message", status: "PENDING",
      actorId, recipient: recipientDigits,
    });
    let result: { messages?: Array<Record<string, unknown>> };
    try {
      result = await client.post<{ messages?: Array<Record<string, unknown>> }>(phoneId + "/messages", payload);
    } catch (error) {
      const safe = normalizeMetaProviderError(error);
      // A transport error or server error can follow acceptance. Only an
      // explicit client rejection proves this submission was not accepted.
      const rejected=error instanceof MetaProviderOperationError &&
        error.status!==null && error.status>=400 && error.status<500;
      const code=rejected?safe.code:"MESSAGE_ACCEPTANCE_UNCONFIRMED";
      await recordActivityTransition(this.db,{
        activityId,channel:"WHATSAPP",status:rejected?"FAILED":"PENDING",errorCode:code,
      }).catch(() => undefined);
      if(rejected) await this.audit(connectionId,actorId,"whatsapp.test_message","message","FAILED",{
        test:true,recipientMasked,templateName:textValue(template,"name"),
        code,providerCode:safe.providerCode,
      }).catch(() => undefined);
      throw new MetaProviderOperationError(code,rejected?safe.message:code,safe.providerCode);
    }
    const firstMessage=Array.isArray(result.messages)?result.messages[0]:null;
    const providerMessageId=firstMessage && typeof firstMessage.id==="string"?firstMessage.id:"";
    if(!providerMessageId) {
      // Do not mark FAILED if Meta might have accepted the send but omitted
      // the correlation ID. Prevent blind retries and duplicate messages.
      await recordActivityTransition(this.db,{activityId,channel:"WHATSAPP",
        status:"PENDING",errorCode:"MESSAGE_ACCEPTANCE_UNCONFIRMED"}).catch(()=>undefined);
      throw new MetaProviderOperationError("MESSAGE_ACCEPTANCE_UNCONFIRMED","MESSAGE_ACCEPTANCE_UNCONFIRMED");
    }
    // Meta may accept a template but hold it for quality review or pause it.
    // Preserve that immediate provider signal, never label it as Sent.
    const providerSubmissionStatus = normalizeWhatsAppSubmissionStatus(firstMessage?.message_status);
    let trackingRecorded=true;
    try {
      await recordActivityTransition(this.db,{
        activityId,providerRef:providerMessageId,channel:"WHATSAPP",status:providerSubmissionStatus,
      });
    } catch {trackingRecorded=false;}
    try {
      await this.audit(connectionId,actorId,"whatsapp.test_message","message","SUCCESS",{
        test:true,recipientMasked,templateName:textValue(template,"name"),
        providerMessageId,providerSubmissionStatus,
      });
    } catch {trackingRecorded=false;}
    // A post-send logging failure is not a provider delivery failure.
    return {accepted:true,trackingRecorded,providerSubmissionStatus,recipientMasked,
      templateName:textValue(template,"name"),providerMessageId};
  }

  private async templateSnapshot(connectionId: string) {
    const connection = await this.getConnection(connectionId);
    const values = parseJson<Record<string, string>>(connection.configuration_json, {});
    const result = values.waba_id
      ? await this.db.prepare("SELECT id, provider_template_id, name, category, language, waba_id, components_json, local_purpose, provider_status, rejection_reason, provider_updated_at, last_synced_at FROM whatsapp_templates WHERE connection_id = ? AND waba_id = ? ORDER BY name, language LIMIT 100").bind(connectionId, values.waba_id).all<Row>()
      : { results: [] as Row[] };
    return { templates: (result.results || []).map((row) => ({ ...row, components: parseJson(row.components_json, []) })) };
  }

  private async templateConfigurationSnapshot(connectionId: string) {
    const templates = await this.templateSnapshot(connectionId);
    const mappings = await this.db.prepare("SELECT id, workflow_key, template_id, enabled, updated_at FROM whatsapp_template_mappings WHERE connection_id = ? ORDER BY workflow_key").bind(connectionId).all<Row>();
    const policies = await this.db.prepare("SELECT policy_key, enabled, template_mapping_id, expires_seconds, cooldown_seconds, max_attempts, resend_maximum, rate_limit_policy_json, eligible_roles_json, eligible_farms_json, fallback_behavior, updated_at FROM whatsapp_auth_policies WHERE connection_id = ? ORDER BY policy_key").bind(connectionId).all<Row>();
    return { ...templates, mappings: mappings.results || [], authPolicies: (policies.results || []).map((row) => ({ ...row, rateLimitPolicy: parseJson(row.rate_limit_policy_json, {}), eligibleRoles: parseJson(row.eligible_roles_json, []), eligibleFarms: parseJson(row.eligible_farms_json, []) })) };
  }

  async updateConfiguration(connectionId: string, actorId: string, input: Record<string, unknown>) {
    const current = await this.getConnection(connectionId);
    const existing = parseJson<Record<string, string>>(current.configuration_json, {});
    const next: Record<string, string> = { ...existing };
    for (const [key, value] of Object.entries(input)) {
      if (!CONFIGURATION_KEYS.has(key)) continue;
      if (typeof value !== "string" || value.length > 1000) throw new Error("CONFIGURATION_VALUE_INVALID");
      const trimmed = value.trim();
      if (trimmed) next[key] = trimmed; else delete next[key];
    }
    if (next.graph_api_version && !/^v\d{1,3}\.\d$/.test(next.graph_api_version)) throw new Error("GRAPH_VERSION_INVALID");
    const collision = collisionForConfiguration(next);
    if (collision) throw new Error(collision.code + ":" + collision.key);
    const now = isoNow();
    const statements: D1PreparedStatement[] = [
      this.db.prepare("UPDATE integration_connections SET configuration_json = ?, version = version + 1, state = ?, updated_by = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(JSON.stringify(next), Object.keys(next).length ? "PARTIALLY_CONFIGURED" : "NOT_CONFIGURED", actorId, now, connectionId, FARMS_ORGANIZATION_ID),
      this.auditStatement(connectionId, actorId, "configuration.updated", "configuration", "SUCCESS", { changedFields: Object.keys(input).filter((key) => CONFIGURATION_KEYS.has(key)) }, now),
    ];
    if (Object.prototype.hasOwnProperty.call(input, "webhook_callback_url")) statements.push(this.db.prepare("INSERT INTO whatsapp_webhook_config (id, connection_id, callback_url, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(connection_id) DO UPDATE SET callback_url = excluded.callback_url, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(`webhook-${connectionId}`, connectionId, next.webhook_callback_url || null, actorId, now));
    await this.db.batch(statements);
    return this.snapshot(connectionId);
  }

  async updateProducts(connectionId: string, actorId: string, input: Record<string, unknown>) {
    const now = isoNow();
    const statements: D1PreparedStatement[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (!PRODUCT_KEYS.has(key) || typeof value !== "boolean") continue;
      statements.push(this.db.prepare("INSERT INTO integration_products (id, connection_id, product_key, enabled, state, metadata_json, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?) ON CONFLICT(connection_id, product_key) DO UPDATE SET enabled = excluded.enabled, state = excluded.state, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(`product-${connectionId}-${key}`, connectionId, key, value ? 1 : 0, value ? "PARTIALLY_CONFIGURED" : "DISABLED", actorId, now));
    }
    statements.push(this.db.prepare("UPDATE integration_connections SET version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(actorId, now, connectionId));
    statements.push(this.auditStatement(connectionId, actorId, "product.configuration.changed", "product", "SUCCESS", { products: Object.keys(input).filter((key) => PRODUCT_KEYS.has(key)) }, now));
    await this.db.batch(statements);
    return this.snapshot(connectionId);
  }

  async replaceSecret(input: { connectionId: string; actorId: string; credentialType: MetaSecretType; plaintext: string; masterKey: string; validate: (plaintext: string) => Promise<{ valid: boolean; code: string }>; promoteAs?: "VALID" | "PENDING" }) {
    if (!(SECRET_TYPES as readonly string[]).includes(input.credentialType)) throw new Error("CREDENTIAL_TYPE_INVALID");
    await this.getConnection(input.connectionId);
    const adapter = new D1CredentialReplacement(this.db, input.connectionId, input.credentialType, input.actorId);
    return replaceCredential({ repository: adapter, plaintext: input.plaintext, masterKey: input.masterKey, keyVersion: 1, credentialType: input.credentialType, organizationId: FARMS_ORGANIZATION_ID, actorId: input.actorId, validate: input.validate, promoteAs: input.promoteAs });
  }

  async removeSecret(connectionId: string, actorId: string, credentialType: MetaSecretType) {
    const now = isoNow();
    await this.db.batch([
      this.db.prepare("UPDATE integration_credential_versions SET retired_at = ? WHERE credential_id IN (SELECT id FROM integration_credentials WHERE connection_id = ? AND credential_type = ?) AND retired_at IS NULL").bind(now, connectionId, credentialType),
      this.db.prepare("UPDATE integration_credentials SET active_version_id = NULL, state = 'NOT_CONFIGURED', updated_at = ? WHERE connection_id = ? AND credential_type = ?").bind(now, connectionId, credentialType),
      this.db.prepare("UPDATE integration_connections SET version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(actorId, now, connectionId),
      this.auditStatement(connectionId, actorId, "credential.removed", credentialType, "SUCCESS", {}, now),
    ]);
    return this.snapshot(connectionId);
  }

  async activeSecret(connectionId: string, credentialType: MetaSecretType) {
    const row = await this.db.prepare("SELECT v.ciphertext, v.nonce, v.algorithm, v.key_version, v.fingerprint, v.validation_state FROM integration_credentials c JOIN integration_credential_versions v ON v.id = c.active_version_id WHERE c.connection_id = ? AND c.credential_type = ? AND v.retired_at IS NULL").bind(connectionId, credentialType).first<Row>();
    if (!row || row.algorithm !== "AES-256-GCM") return null;
    return {
      ciphertext: String(row.ciphertext), nonce: String(row.nonce), algorithm: "AES-256-GCM" as const,
      keyVersion: numberValue(row, "key_version"), fingerprint: String(row.fingerprint), validationState: String(row.validation_state),
    };
  }

  async promoteActivePendingSecret(connectionId: string, credentialType: MetaSecretType, actorId: string, validationCode = "SIGNED_WEBHOOK_VERIFIED") {
    if (!(SECRET_TYPES as readonly string[]).includes(credentialType)) throw new Error("CREDENTIAL_TYPE_INVALID");
    const row = await this.db.prepare("SELECT c.id AS credential_id, c.active_version_id, c.state, v.validation_state FROM integration_credentials c JOIN integration_credential_versions v ON v.id = c.active_version_id WHERE c.connection_id = ? AND c.credential_type = ? AND v.retired_at IS NULL").bind(connectionId, credentialType).first<Row>();
    if (!row || String(row.state) !== "PENDING" || String(row.validation_state) !== "PENDING" || !row.active_version_id) return false;
    const now = isoNow();
    await this.db.batch([
      this.db.prepare("UPDATE integration_credential_versions SET validation_state = 'VALID', validation_code = ?, validated_at = ? WHERE id = ? AND validation_state = 'PENDING' AND retired_at IS NULL").bind(validationCode, now, String(row.active_version_id)),
      this.db.prepare("UPDATE integration_credentials SET state = 'VALID', last_validated_at = ?, updated_at = ? WHERE id = ? AND active_version_id = ? AND state = 'PENDING'").bind(now, now, String(row.credential_id), String(row.active_version_id)),
      this.db.prepare("UPDATE integration_connections SET version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?").bind(actorId, now, connectionId),
    ]);
    await this.audit(connectionId, actorId, "credential.validation.confirmed", credentialType, "SUCCESS", { method: "SIGNED_WEBHOOK" });
    return true;
  }

  async snapshot(connectionId: string) {
    const connection = await this.getConnection(connectionId);
    const [credentialResult, productResult, webhook, templateResult, auditResult, mappingResult, policyResult, wabaResult, senderResult, healthResult] = await Promise.all([
      this.db.prepare("SELECT c.credential_type, c.state, c.last_validated_at, c.updated_at, v.fingerprint, v.created_by FROM integration_credentials c LEFT JOIN integration_credential_versions v ON v.id = c.active_version_id WHERE c.connection_id = ?").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT product_key, enabled, state FROM integration_products WHERE connection_id = ?").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT callback_url, get_verification_state, post_signature_state, subscription_state FROM whatsapp_webhook_config WHERE connection_id = ?").bind(connectionId).first<Row>(),
      this.db.prepare("SELECT id, provider_template_id, name, category, language, waba_id, components_json, local_purpose, provider_status, rejection_reason, provider_updated_at, last_synced_at FROM whatsapp_templates WHERE connection_id = ? ORDER BY name, language LIMIT 100").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT event_type, target_type, outcome, safe_metadata_json, created_at, actor_id FROM integration_audit_events WHERE connection_id = ? ORDER BY created_at DESC LIMIT 50").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT id, workflow_key, template_id, enabled, updated_at FROM whatsapp_template_mappings WHERE connection_id = ? ORDER BY workflow_key").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT policy_key, enabled, template_mapping_id, expires_seconds, cooldown_seconds, max_attempts, resend_maximum, rate_limit_policy_json, eligible_roles_json, eligible_farms_json, fallback_behavior, updated_at FROM whatsapp_auth_policies WHERE connection_id = ? ORDER BY policy_key").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT provider_waba_id, display_name, owner_business_id, status, metadata_json, selected, last_synced_at FROM whatsapp_business_accounts WHERE connection_id = ? ORDER BY display_name").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT waba_id, provider_phone_number_id, display_phone_masked, verified_name, registration_state, quality_state, metadata_json, selected, last_synced_at FROM whatsapp_senders WHERE connection_id = ? ORDER BY verified_name").bind(connectionId).all<Row>(),
      this.db.prepare("SELECT component, state, sanitized_code, checked_at FROM integration_health WHERE connection_id = ? ORDER BY component").bind(connectionId).all<Row>(),
    ]);
    const values = parseJson<Record<string, string>>(connection.configuration_json, {});
    const selectedWabaId = values.waba_id || null;
    const templates = (templateResult.results || []).filter((row) => selectedWabaId && textValue(row, "waba_id") === selectedWabaId);
    const senders = (senderResult.results || []).filter((row) => selectedWabaId && textValue(row, "waba_id") === selectedWabaId);
    const products = Object.fromEntries((productResult.results || []).map((row) => [String(row.product_key), boolValue(row, "enabled")]));
    const credentials = Object.fromEntries((credentialResult.results || []).map((row) => [String(row.credential_type), {
      configured: Boolean(row.fingerprint), validationState: String(row.state || "NOT_CONFIGURED"), fingerprint: textValue(row, "fingerprint"),
      updatedAt: textValue(row, "updated_at"), lastValidatedAt: textValue(row, "last_validated_at"), updatedBy: textValue(row, "created_by"),
    }]));
    const runtime: MetaRuntimeConfiguration = {
      connectionId, organizationId: FARMS_ORGANIZATION_ID, farmId: null, version: numberValue(connection, "version"), state: String(connection.state) as MetaRuntimeConfiguration["state"], values, products, credentials,
      webhook: { callbackUrl: textValue(webhook, "callback_url"), getVerified: textValue(webhook, "get_verification_state") === "VERIFIED", postSignatureVerified: textValue(webhook, "post_signature_state") === "VERIFIED", subscribed: textValue(webhook, "subscription_state") === "SUBSCRIBED" },
      phoneRegistrationState: values.phone_registration_state || "UNKNOWN", approvedAuthenticationTemplate: templates.some((row) => row.category === "AUTHENTICATION" && row.provider_status === "APPROVED"), authPoliciesEnabled: (policyResult.results || []).some((row) => boolValue(row, "enabled")),
    };
    return {
      provider: "Meta", connectionId, organizationId: FARMS_ORGANIZATION_ID, version: runtime.version, state: runtime.state,
      configuration: values,
      credentials,
      products,
      capabilities: evaluateMetaCapabilities(runtime),
      webhook: { callbackUrl: runtime.webhook.callbackUrl, getVerification: runtime.webhook.getVerified ? "CONFIGURED" : "PENDING", postSignatureVerification: runtime.webhook.postSignatureVerified ? "CONFIGURED" : "PENDING APP SECRET", postOperationalProcessing: runtime.webhook.postSignatureVerified ? "SIGNATURE REQUIRED" : "DISABLED / FAIL-CLOSED UNTIL APP SECRET AVAILABLE", subscription: runtime.webhook.subscribed ? "SUBSCRIBED" : "PENDING" },
      templates: templates.map((row) => ({ ...row, components: parseJson(row.components_json, []) })),
      wabas: (wabaResult.results || []).map((row) => ({ ...row, metadata: parseJson(row.metadata_json, {}) })),
      senders: senders.map((row) => ({ ...row, metadata: parseJson(row.metadata_json, {}) })),
      mappings: mappingResult.results || [],
      authPolicies: (policyResult.results || []).map((row) => ({ ...row, rateLimitPolicy: parseJson(row.rate_limit_policy_json, {}), eligibleRoles: parseJson(row.eligible_roles_json, []), eligibleFarms: parseJson(row.eligible_farms_json, []) })),
      health: healthResult.results || [],
      audit: (auditResult.results || []).map((row) => ({ ...row, safe_metadata_json: parseJson(row.safe_metadata_json, {}) })),
    };
  }

  async persistCapabilities(connectionId: string, actorId: string) {
    const snapshot = await this.snapshot(connectionId);
    const now = isoNow();
    const statements: D1PreparedStatement[] = snapshot.capabilities.map((capability) => this.db.prepare("INSERT INTO integration_capabilities (id, connection_id, capability_key, state, reason_code, evaluated_version, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(connection_id, capability_key) DO UPDATE SET state = excluded.state, reason_code = excluded.reason_code, evaluated_version = excluded.evaluated_version, evaluated_at = excluded.evaluated_at").bind(`capability-${connectionId}-${capability.key}`, connectionId, capability.key, capability.state, capability.reason, snapshot.version, now));
    for (const [product, enabled] of Object.entries(snapshot.products)) {
      statements.push(this.db.prepare("UPDATE integration_products SET state = ?, updated_by = ?, updated_at = ? WHERE connection_id = ? AND product_key = ?").bind(enabled ? "ENABLED" : "DISABLED", actorId, now, connectionId, product));
    }
    if (statements.length) await this.db.batch(statements);
    return snapshot;
  }

  private auditStatement(connectionId: string, actorId: string, eventType: string, targetType: string, outcome: string, safeMetadata: Record<string, unknown>, createdAt: string) {
    return this.db.prepare("INSERT INTO integration_audit_events (id, connection_id, organization_id, farm_id, actor_id, event_type, target_type, target_id, outcome, safe_metadata_json, correlation_id, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?)").bind(crypto.randomUUID(), connectionId, FARMS_ORGANIZATION_ID, actorId, eventType, targetType, outcome, JSON.stringify(safeMetadata), crypto.randomUUID(), createdAt);
  }
}

class D1CredentialReplacement implements CredentialReplacementRepository {
  private candidateVersions = new Map<string, number>();
  private candidateCredentialIds = new Map<string, string>();

  constructor(private readonly db: D1Database, private readonly connectionId: string, private readonly credentialType: MetaSecretType, private readonly actorId: string) {}

  async createCandidate(candidate: CredentialCandidate) {
    const credentialId = `credential-${this.connectionId}-${this.credentialType}`;
    const row = await this.db.prepare("SELECT COALESCE(MAX(v.version), 0) AS max_version FROM integration_credential_versions v JOIN integration_credentials c ON c.id = v.credential_id WHERE c.connection_id = ? AND c.credential_type = ?").bind(this.connectionId, this.credentialType).first<Row>();
    const version = numberValue(row, "max_version") + 1;
    await this.db.batch([
      this.db.prepare("INSERT INTO integration_credentials (id, connection_id, credential_type, active_version_id, state, created_at, updated_at) VALUES (?, ?, ?, NULL, 'PENDING', ?, ?) ON CONFLICT(connection_id, credential_type) DO UPDATE SET state = CASE WHEN integration_credentials.active_version_id IS NULL THEN 'PENDING' ELSE integration_credentials.state END, updated_at = excluded.updated_at").bind(credentialId, this.connectionId, this.credentialType, candidate.createdAt, candidate.createdAt),
      this.db.prepare("INSERT INTO integration_credential_versions (id, credential_id, version, ciphertext, nonce, algorithm, key_version, fingerprint, validation_state, validation_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, ?, ?)").bind(candidate.id, credentialId, version, candidate.ciphertext, candidate.nonce, candidate.algorithm, candidate.keyVersion, candidate.fingerprint, candidate.createdBy, candidate.createdAt),
    ]);
    this.candidateVersions.set(candidate.id, version);
    this.candidateCredentialIds.set(candidate.id, credentialId);
  }

  async promoteCandidate(candidateId: string, validatedAt: string, validationState: "VALID" | "PENDING", validationCode: string) {
    const version = this.candidateVersions.get(candidateId);
    const credentialId = this.candidateCredentialIds.get(candidateId);
    if (!version || !credentialId) throw new Error("CREDENTIAL_CANDIDATE_UNKNOWN");
    await this.db.batch([
      this.db.prepare("UPDATE integration_credential_versions SET retired_at = ? WHERE credential_id = ? AND validation_state = 'VALID' AND retired_at IS NULL").bind(validatedAt, credentialId),
      this.db.prepare("UPDATE integration_credential_versions SET validation_state = ?, validation_code = ?, validated_at = ? WHERE id = ?").bind(validationState, validationCode, validatedAt, candidateId),
      this.db.prepare("UPDATE integration_credentials SET active_version_id = ?, state = ?, last_validated_at = ?, updated_at = ? WHERE id = ?").bind(candidateId, validationState, validatedAt, validatedAt, credentialId),
      this.db.prepare("UPDATE integration_connections SET version = version + 1, state = 'PARTIALLY_CONFIGURED', updated_by = ?, updated_at = ? WHERE id = ?").bind(this.actorId, validatedAt, this.connectionId),
    ]);
    return version;
  }

  async rejectCandidate(candidateId: string, validationCode: string, validatedAt: string) {
    const credentialId = this.candidateCredentialIds.get(candidateId);
    await this.db.batch([
      this.db.prepare("UPDATE integration_credential_versions SET validation_state = 'INVALID', validation_code = ?, validated_at = ?, retired_at = ? WHERE id = ?").bind(validationCode, validatedAt, validatedAt, candidateId),
      this.db.prepare("UPDATE integration_credentials SET state = CASE WHEN active_version_id IS NULL THEN 'INVALID' ELSE state END, last_validated_at = ?, updated_at = ? WHERE id = ?").bind(validatedAt, validatedAt, credentialId),
    ]);
  }

  async writeAudit(event: { eventType: string; outcome: string; actorId: string; targetType: string; safeMetadata: Record<string, unknown>; createdAt: string }) {
    await this.db.prepare("INSERT INTO integration_audit_events (id, connection_id, organization_id, farm_id, actor_id, event_type, target_type, target_id, outcome, safe_metadata_json, correlation_id, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?)").bind(crypto.randomUUID(), this.connectionId, FARMS_ORGANIZATION_ID, event.actorId, event.eventType, event.targetType, event.outcome, JSON.stringify(event.safeMetadata), crypto.randomUUID(), event.createdAt).run();
  }
}
