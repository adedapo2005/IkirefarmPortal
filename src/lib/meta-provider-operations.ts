import { redactIntegrationError } from "./meta-provider-control.ts";

export const FARMS_META_WEBHOOK_FIELDS = Object.freeze([
  "messages",
  "message_template_status_update",
  "message_template_quality_update",
  "phone_number_name_update",
  "phone_number_quality_update",
  "account_alerts",
  "account_review_update",
  "account_update",
  "security",
] as const);

export const FARMS_AUTH_POLICY_KEYS = Object.freeze([
  "signup_verification",
  "signin_verification",
  "account_recovery",
  "phone_enrollment",
  "phone_change_verification",
  "privileged_action_verification",
] as const);

export const FARMS_TEMPLATE_WORKFLOWS = Object.freeze([
  "signup_verification",
  "signin_verification",
  "account_recovery",
  "account_status",
  "operational_notice",
  "support_followup",
] as const);

export type MetaProviderErrorCode =
  | "AUTHORIZATION_EXPIRED"
  | "PERMISSION_MISSING"
  | "WABA_NOT_ACCESSIBLE"
  | "PHONE_NOT_ACCESSIBLE"
  | "APP_WABA_MISMATCH"
  | "TEMPLATE_REJECTED"
  | "BUSINESS_VERIFICATION_REQUIRED"
  | "PHONE_VERIFICATION_REQUIRED"
  | "META_RATE_LIMITED"
  | "META_PROVIDER_UNAVAILABLE"
  | "GRAPH_VERSION_UNSUPPORTED"
  | "UNKNOWN_PROVIDER_ERROR";

export class MetaProviderOperationError extends Error {
  readonly code: MetaProviderErrorCode | string;
  readonly providerCode: string | null;
  readonly status: number | null;

  constructor(code: MetaProviderErrorCode | string, message = code, providerCode: string | null = null, status: number | null = null) {
    super(message);
    this.name = "MetaProviderOperationError";
    this.code = code;
    this.providerCode = providerCode;
    this.status = status;
  }
}

function stringValue(value: unknown, max = 240) {
  return typeof value === "string" ? value.slice(0, max) : null;
}

function providerErrorCode(status: number, body: Record<string, unknown>): MetaProviderErrorCode {
  const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : body;
  const code = Number(error.code || body.code || 0);
  const message = String(error.message || body.message || "").toLowerCase();
  if (status === 401 || code === 190 || message.includes("expired") || message.includes("invalid oauth")) return "AUTHORIZATION_EXPIRED";
  if (status === 403 || code === 10 || message.includes("permission")) return "PERMISSION_MISSING";
  if (status === 429 || code === 4 || message.includes("rate limit")) return "META_RATE_LIMITED";
  if (status === 400 && (message.includes("version") || message.includes("unsupported"))) return "GRAPH_VERSION_UNSUPPORTED";
  if (message.includes("business verification")) return "BUSINESS_VERIFICATION_REQUIRED";
  if (message.includes("phone") && message.includes("verif")) return "PHONE_VERIFICATION_REQUIRED";
  return "UNKNOWN_PROVIDER_ERROR";
}

function safeBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sanitizeProviderError(status: number, body: Record<string, unknown>) {
  const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : body;
  return {
    code: providerErrorCode(status, body),
    providerCode: stringValue(error.code) || stringValue(body.code),
    message: redactIntegrationError(stringValue(error.message) || stringValue(body.message) || "Provider request failed"),
  };
}

export class MetaGraphClient {
  private readonly accessToken: string;
  private readonly graphVersion: string;
  private readonly fetcher: typeof fetch;

  constructor(
    accessToken: string,
    graphVersion: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.accessToken = accessToken;
    this.graphVersion = graphVersion;
    this.fetcher = fetcher;
    if (!/^v\d{1,3}\.\d$/.test(graphVersion)) throw new MetaProviderOperationError("GRAPH_VERSION_UNSUPPORTED", "GRAPH_VERSION_INVALID");
    if (!accessToken) throw new MetaProviderOperationError("AUTHORIZATION_EXPIRED", "TOKEN_NOT_CONFIGURED");
  }

  async request<T = Record<string, unknown>>(path: string, init: RequestInit = {}, options: { retrySafe?: boolean } = {}) {
    const normalized = path.replace(/^\/+/, "");
    const url = `https://graph.facebook.com/${this.graphVersion}/${normalized}`;
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.accessToken}`);
    headers.set("accept", "application/json");
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const attempts = options.retrySafe ? 2 : 1;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await this.fetcher(url, { ...init, headers, signal: controller.signal });
        const text = await response.text();
        let body: Record<string, unknown> = {};
        try { body = safeBody(text ? JSON.parse(text) : {}); } catch { body = {}; }
        if (response.ok) return body as T;
        const failure = sanitizeProviderError(response.status, body);
        if (options.retrySafe && attempt + 1 < attempts && (response.status === 429 || response.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        throw new MetaProviderOperationError(failure.code, failure.message, failure.providerCode, response.status);
      } catch (error) {
        lastError = error;
        if (error instanceof MetaProviderOperationError) throw error;
        if (options.retrySafe && attempt + 1 < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        throw new MetaProviderOperationError("META_PROVIDER_UNAVAILABLE", "META_PROVIDER_UNAVAILABLE");
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof MetaProviderOperationError ? lastError : new MetaProviderOperationError("META_PROVIDER_UNAVAILABLE");
  }

  get<T = Record<string, unknown>>(path: string, query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request<T>(`${path}${suffix}`, { method: "GET" }, { retrySafe: true });
  }

  post<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }
}

export function sanitizedWabaMetadata(row: Record<string, unknown>) {
  return {
    id: stringValue(row.id) || "",
    name: stringValue(row.name) || stringValue(row.business_name) || "Unnamed WhatsApp Business Account",
    ownerBusinessId: stringValue(row.owner_business_id) || stringValue(row.business_id),
    status: stringValue(row.status) || stringValue(row.account_review_status) || "UNKNOWN",
    verification: stringValue(row.verification_status) || stringValue(row.business_verification_status) || "UNKNOWN",
    accessState: "ACCESSIBLE",
  };
}

export function sanitizedPhoneMetadata(row: Record<string, unknown>) {
  return {
    id: stringValue(row.id) || "",
    displayPhoneNumber: stringValue(row.display_phone_number) || "",
    verifiedName: stringValue(row.verified_name) || "",
    qualityState: stringValue(row.quality_rating) || stringValue(row.quality_state) || "UNKNOWN",
    registrationState: stringValue(row.status) || stringValue(row.registration_state) || "UNKNOWN",
    displayNameState: stringValue(row.name_status) || "UNKNOWN",
    verificationState: stringValue(row.code_verification_status) || "UNKNOWN",
  };
}

export function sanitizedTemplateMetadata(row: Record<string, unknown>) {
  const components = Array.isArray(row.components) ? row.components.slice(0, 20) : [];
  return {
    id: stringValue(row.id),
    name: stringValue(row.name) || "",
    category: stringValue(row.category) || "UNKNOWN",
    language: stringValue(row.language) || "",
    status: stringValue(row.status) || "UNKNOWN",
    rejectionReason: stringValue(row.rejected_reason) || stringValue(row.rejection_reason),
    providerUpdatedAt: stringValue(row.updated_time) || stringValue(row.updated_at),
    components,
  };
}

export function normalizeWhatsAppTestRecipient(value: unknown) {
  if (typeof value !== "string") throw new MetaProviderOperationError("TEST_RECIPIENT_INVALID", "TEST_RECIPIENT_INVALID");
  const raw = value.trim();
  if (!raw.startsWith("+") || !/^\+[0-9\s().-]+$/.test(raw)) throw new MetaProviderOperationError("TEST_RECIPIENT_INVALID", "TEST_RECIPIENT_INVALID");
  const digits = raw.slice(1).replace(/[\s().-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new MetaProviderOperationError("TEST_RECIPIENT_INVALID", "TEST_RECIPIENT_INVALID");
  return digits;
}

export function maskWhatsAppTestRecipient(digits: string) {
  return `+${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function buildWhatsAppTestTemplateComponents(rawComponents: unknown, rawParameters: unknown) {
  if (!Array.isArray(rawComponents) || rawComponents.length > 20) throw new MetaProviderOperationError("TEST_TEMPLATE_UNSUPPORTED", "TEST_TEMPLATE_UNSUPPORTED");
  if (!Array.isArray(rawParameters) || rawParameters.length > 10) throw new MetaProviderOperationError("TEST_TEMPLATE_PARAMETERS_INVALID", "TEST_TEMPLATE_PARAMETERS_INVALID");
  const variables = new Set<number>();
  const componentVariables: Array<{ type: string; ids: number[] }> = [];
  let hasBody = false;
  for (const raw of rawComponents) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const component = raw as Record<string, unknown>;
    const type = typeof component.type === "string" ? component.type.toUpperCase() : "";
    if (type === "BODY") hasBody = true;
    const format = typeof component.format === "string" ? component.format.toUpperCase() : "";
    if (type === "HEADER" && format && format !== "TEXT") throw new MetaProviderOperationError("TEST_TEMPLATE_UNSUPPORTED", "TEST_TEMPLATE_UNSUPPORTED");
    const text = typeof component.text === "string" ? component.text : "";
    const matches = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
    if ((text.includes("{{") || text.includes("}}")) && !matches.length) throw new MetaProviderOperationError("TEST_TEMPLATE_UNSUPPORTED", "TEST_TEMPLATE_UNSUPPORTED");
    if (matches.length && type !== "HEADER" && type !== "BODY") throw new MetaProviderOperationError("TEST_TEMPLATE_UNSUPPORTED", "TEST_TEMPLATE_UNSUPPORTED");
    const ids = matches.map((match) => Number(match[1]));
    if (ids.some((id) => !Number.isInteger(id) || id < 1 || id > 10)) throw new MetaProviderOperationError("TEST_TEMPLATE_UNSUPPORTED", "TEST_TEMPLATE_UNSUPPORTED");
    ids.forEach((id) => variables.add(id));
    if (ids.length) componentVariables.push({ type: type.toLowerCase(), ids });
  }
  if (!hasBody) throw new MetaProviderOperationError("TEST_TEMPLATE_UNSUPPORTED", "TEST_TEMPLATE_UNSUPPORTED");
  const orderedIds = [...variables].sort((a, b) => a - b);
  if (orderedIds.some((id, index) => id !== index + 1) || rawParameters.length !== orderedIds.length) {
    throw new MetaProviderOperationError("TEST_TEMPLATE_PARAMETERS_INVALID", "TEST_TEMPLATE_PARAMETERS_INVALID");
  }
  const parameterValues = rawParameters.map((value) => {
    if (typeof value !== "string" || !value.trim() || value.length > 1024) throw new MetaProviderOperationError("TEST_TEMPLATE_PARAMETERS_INVALID", "TEST_TEMPLATE_PARAMETERS_INVALID");
    return value;
  });
  return componentVariables.map(({ type, ids }) => ({
    type,
    parameters: ids.map((id) => ({ type: "text", text: parameterValues[id - 1] })),
  }));
}

export function normalizeMetaProviderError(error: unknown) {
  if (error instanceof MetaProviderOperationError) return { code: error.code, providerCode: error.providerCode, message: error.message };
  return { code: "UNKNOWN_PROVIDER_ERROR" as const, providerCode: null, message: redactIntegrationError(error) };
}
