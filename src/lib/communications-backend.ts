/**
 * Daenem Farms V75 Communications Backend Foundation.
 *
 * This module is deliberately provider-neutral and testable without a D1
 * binding.  It models the server boundary that the existing authenticated
 * principal must call.  The in-memory store is for local/test execution only;
 * the additive Drizzle schema and migration are the durable D1 target.
 *
 * Security rules in this file fail closed.  A Sites owner, a display name, a
 * phone number, or a client-provided persona is never an authorization input.
 */

export const COMMUNICATIONS_BACKEND_VERSION = "v77-authority-otp-dispatch-closure";
export const REAL_PROVIDER_STATUS = "NOT CONFIGURED" as const;
export const MOCK_PROVIDER_STATUS = "TEST MODE" as const;

export const CHANNELS = ["whatsapp", "email", "sms"] as const;
export type BackendChannel = (typeof CHANNELS)[number];
export const QUEUE_PRIORITIES = ["high_auth", "transactional", "hr", "normal", "bulk"] as const;
export type QueuePriority = (typeof QUEUE_PRIORITIES)[number];
export const DELIVERY_STATES = [
  "DRAFT",
  "QUEUED",
  "SUBMITTED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "UNCERTAIN",
] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];
export const COMMUNICATION_CLASSIFICATIONS = [
  "GENERAL",
  "CUSTOMER",
  "SUPPLIER",
  "HR",
  "HR_SENSITIVE",
  "RECRUITMENT",
  "SECURITY",
] as const;
export type CommunicationClassification = (typeof COMMUNICATION_CLASSIFICATIONS)[number];
export const TEMPLATE_STATES = ["DRAFT", "INTERNAL_REVIEW", "APPROVED", "PAUSED", "RETIRED"] as const;
export type TemplateState = (typeof TEMPLATE_STATES)[number];
export const PROVIDER_TEMPLATE_STATES = [
  "NOT_SUBMITTED",
  "PENDING_PROVIDER",
  "PROVIDER_APPROVED",
  "PROVIDER_REJECTED",
  "PROVIDER_PAUSED",
] as const;
export type ProviderTemplateState = (typeof PROVIDER_TEMPLATE_STATES)[number];
export const AUTH_SIGNIN_STEP_UP_PERMISSION = "auth.signin.step_up" as const;
export const CHALLENGE_REQUEST_COOLDOWN_MS = 30_000;
export const CHALLENGE_RESEND_COOLDOWN_MS = 30_000;
export const CHALLENGE_MAX_RESENDS = 3;
export const CHALLENGE_MAX_ATTEMPTS = 5;
export const CHALLENGE_EXPIRY_SECONDS = 300;
export const CHALLENGE_RATE_WINDOW_MS = 15 * 60_000;
export const CHALLENGE_MAX_REQUESTS_PER_WINDOW = 5;

export const COMMUNICATIONS_BACKEND_TABLES = [
  "communication_accounts",
  "communication_provider_account_mappings",
  "communication_contacts",
  "communication_contact_channels",
  "communication_conversations",
  "communication_participants",
  "communication_messages",
  "communication_attachments",
  "communication_templates",
  "communication_template_versions",
  "communication_jobs",
  "communication_delivery_events",
  "communication_triggers",
  "communication_policies",
  "communication_preferences",
  "communication_consents",
  "communication_assignments",
  "communication_notes",
  "communication_approvals",
  "communication_ai_generations",
  "communication_audit_events",
  "communication_usage_costs",
  "communication_provider_events",
  "communication_dead_letters",
  "communication_outbox",
  "auth_whatsapp_challenges",
] as const;

export type CommunicationScope = Readonly<{
  organizationId: string;
  businessUnit?: string | null;
  farmId?: string | null;
  recordType?: string | null;
  recordId?: string | null;
}>;

/** Only fields from the validated V72 principal are accepted here. */
export type CommunicationsPrincipal = Readonly<{
  id: string;
  organizationId: string;
  permissions: readonly string[];
  farmIds: readonly string[] | null;
  hrPermissions?: readonly string[];
}>;

export type CommunicationAuthorityMode = "USER_AUTHORIZED" | "SYSTEM_EVENT" | "APPROVED_AUTOMATION" | "AUTHENTICATION";
export type BusinessRecordOperation = "view" | "read" | "reply" | "send" | "approve" | "attach" | "export";
export type BusinessRecordAccessDecision = Readonly<{
  decision: "ALLOW" | "DENY" | "NOT_APPLICABLE" | "UNRESOLVED";
  reason: string;
}>;
export type BusinessRecordAccessInput = Readonly<{
  principal: CommunicationsPrincipal | null;
  scope: CommunicationScope;
  operation: BusinessRecordOperation;
  authorityMode: CommunicationAuthorityMode;
  classification?: CommunicationClassification | null;
  sourceRecordRef?: string | null;
  sourceEvent?: string | null;
}>;
export interface AuthoritativeBusinessRecordAccessSource {
  resolve(input: BusinessRecordAccessInput): BusinessRecordAccessDecision;
}
export interface BusinessRecordAccessResolver {
  resolve(input: BusinessRecordAccessInput): BusinessRecordAccessDecision;
}

export type AuthorizationDecision = Readonly<{
  allowed: boolean;
  reason:
    | "ALLOWED"
    | "AUTHENTICATION_REQUIRED"
    | "COMMUNICATION_PERMISSION_REQUIRED"
    | "BUSINESS_RECORD_PERMISSION_REQUIRED"
    | "BUSINESS_RECORD_AUTHORITY_REQUIRED"
    | "HR_AUTHORITY_REQUIRED"
    | "SECURITY_AUTHORITY_REQUIRED"
    | "ORGANIZATION_SCOPE_REQUIRED"
    | "FARM_ASSIGNMENT_UNRESOLVED"
    | "FARM_SCOPE_DENIED"
    | "POLICY_CHANNEL_DISABLED"
    | "EMERGENCY_STOP";
}>;

export type CommunicationPolicyRecord = Readonly<{
  id: string;
  revision: string;
  organizationId: string;
  farmId: string | null;
  enabledChannels: Readonly<Record<BackendChannel, boolean>>;
  aiEnabled: boolean;
  allowedAiOperations: readonly string[];
  humanReviewRequiredForAi: boolean;
  quietHours: Readonly<{ start: string; end: string; timezone: string }> | null;
  budgetCentsPerDay: number | null;
  ratePerMinute: number | null;
  retentionDays: number;
  emergencyStop: boolean;
  globalStop: boolean;
  channelStops: Readonly<Partial<Record<BackendChannel, boolean>>>;
  fallbackChannel: BackendChannel | null;
}>;

export type CommunicationAccountRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  channel: BackendChannel;
  displayName: string;
  senderAddress: string;
  provider: "meta_whatsapp" | "smtp" | "sms_gateway" | "test";
  providerState: "NOT_CONFIGURED" | "INTEGRATION_REQUIRED" | "CREDENTIALS_REQUIRED" | "TEST_MODE";
  enabled: boolean;
  policyRevision: string;
}>;

export type ProviderAccountMappingRecord = Readonly<{
  provider: "meta_whatsapp_test" | "meta_whatsapp" | "smtp" | "sms_gateway";
  providerAccountId: string;
  accountId: string;
  organizationId: string;
  farmId: string | null;
  channel: BackendChannel;
  classification: CommunicationClassification;
  queue: string;
  privacyMode: "general" | "hr_private" | "hr_sensitive";
  allowedInbound: boolean;
}>;

export type ContactChannelRecord = Readonly<{
  id: string;
  contactId: string;
  channel: BackendChannel;
  normalizedAddress: string;
  verified: boolean;
  purpose: "authentication" | "transactional" | "hr_operational" | "support" | "marketing" | "recruitment" | "training" | "employee_engagement";
  consentState: "unknown" | "pending" | "granted" | "withdrawn";
  language: string | null;
  source: "authoritative_record" | "user_entered" | "provider" | "test_fixture";
  active: boolean;
  lastVerifiedAt: string | null;
  revision: number;
}>;

export type CommunicationContactRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  kind: "external_contact" | "customer" | "supplier" | "employee" | "applicant" | "guarantor";
  sourceRecordRef: string | null;
  displayName: string;
  active: boolean;
  channelIds: readonly string[];
}>;

export type CommunicationConversationRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  channel: BackendChannel;
  accountId: string;
  externalContactId: string | null;
  participantIds: readonly string[];
  businessRecordRef: string | null;
  classification: CommunicationClassification;
  queue: string;
  assignedUserId: string | null;
  assignedTeam: string | null;
  status: "open" | "pending" | "closed";
  priority: "normal" | "high" | "urgent";
  tags: readonly string[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  retentionState: "active" | "retention_due" | "retained";
}>;

export type CommunicationMessageRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  conversationId: string;
  direction: "inbound" | "outbound" | "internal";
  channel: BackendChannel | "internal_note";
  senderRef: string | null;
  recipientRef: string | null;
  body: string | null;
  contentType: "text" | "template" | "attachment" | "system" | "internal_note";
  state: DeliveryState;
  source: "user_input" | "ai_generated" | "approved_template" | "external_message" | "internal_note";
  templateVersionId: string | null;
  aiGenerationId: string | null;
  replyToId: string | null;
  providerMessageId: string | null;
  failureCode: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  visibleToGeneralAgents: boolean;
  accountId?: string;
  recipientContactId?: string;
  recipientContactRevision?: number;
  recipientPurpose?: ContactChannelRecord["purpose"];
  templateId?: string | null;
  policyRevision?: string;
}>;

export type CommunicationAttachmentRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  messageId: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  scanStatus: "pending" | "clean" | "blocked";
  storageObjectRef: string;
  accessClassification: "general" | "hr_private" | "hr_sensitive";
  retentionState: "active" | "retention_due" | "deleted";
}>;

export type CommunicationTemplateRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  channel: BackendChannel;
  name: string;
  category: string;
  useCase: string;
  internalState: TemplateState;
  providerState: ProviderTemplateState;
  currentVersionId: string | null;
  approvalRequired: boolean;
  lockedVariables: readonly string[];
}>;

export type CommunicationTemplateVersionRecord = Readonly<{
  id: string;
  templateId: string;
  version: number;
  language: string;
  body: string;
  lockedVariables: readonly string[];
  policyRevision: string;
  createdBy: string;
  approvedBy: string | null;
}>;

export type OutboundArtifact = Readonly<{
  recipient: string;
  recipientContactId: string;
  recipientContactRevision: number;
  sender: string;
  channel: BackendChannel;
  content: string;
  templateId: string | null;
  templateVersionId: string | null;
  language: string;
  attachmentIds: readonly string[];
  linkIds: readonly string[];
  sourceRecordRef: string;
  sourceRevision: string;
  sourceEvent: string;
  policyRevision: string;
}>;

export type CommunicationApprovalRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  jobId: string;
  requestedBy: string;
  requestedAt: string;
  reviewerId: string | null;
  decision: "pending" | "approved" | "denied";
  decisionAt: string | null;
  reason: string | null;
  fingerprint: string;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  policyRevision: string;
}>;

export type CommunicationJobRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  conversationId: string | null;
  messageId: string | null;
  purpose: "authentication" | "transactional" | "hr" | "normal" | "bulk";
  priority: QueuePriority;
  state: DeliveryState;
  idempotencyKey: string;
  correlationId: string;
  attempts: number;
  nextAttemptAt: string | null;
  expiresAt: string | null;
  approvalId: string | null;
  artifactFingerprint: string | null;
  failureCode: string | null;
  deadLetteredAt: string | null;
  createdAt: string;
  accountId: string;
  recipientContactId: string;
  recipientContactRevision: number;
  recipientPurpose: ContactChannelRecord["purpose"];
  templateId: string | null;
  templateVersionId: string | null;
  policyRevision: string;
  authorityMode: CommunicationAuthorityMode;
  authorityPrincipalId: string | null;
  authorityPermission: string | null;
  authoritySourceEvent: string | null;
}>;

export type CommunicationOutboxRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  jobId: string;
  eventType: "communication.intent" | "auth.whatsapp.challenge";
  state: "READY" | "CLAIMED" | "COMPLETED" | "FAILED";
  idempotencyKey: string;
  correlationId: string;
  availableAt: string;
  claimedAt: string | null;
}>;

export type CommunicationDeliveryEventRecord = Readonly<{
  id: string;
  jobId: string;
  state: "SUBMITTED" | "DELIVERED" | "READ" | "FAILED" | "UNKNOWN";
  providerEventId: string | null;
  occurredAt: string;
  testMode: boolean;
}>;

export type CommunicationAuditRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  actorId: string;
  kind: string;
  correlationId: string;
  sourceRecordRef: string | null;
  safeMetadata: Readonly<Record<string, string | number | boolean | null>>;
  at: string;
}>;

export type CommunicationAiGenerationRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  actorId: string;
  operation: "GENERATE" | "REFINE" | "SHORTEN" | "EXPAND" | "REPHRASE" | "TRANSLATE" | "PERSONALIZE" | "SUGGEST_REPLY" | "CREATE_TEMPLATE" | "SUMMARIZE";
  sourceRefs: readonly string[];
  policyRevision: string;
  providerProfile: string;
  status: "REQUESTED" | "MOCK_ONLY" | "REVIEW_REQUIRED" | "ACCEPTED" | "REJECTED";
  outputHash: string | null;
  acceptedMessageId: string | null;
  createdAt: string;
}>;

export type CommunicationProviderEventRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  provider: string;
  providerAccountId: string | null;
  providerEventId: string;
  eventType: string;
  normalizedState: string;
  safePayload: Readonly<Record<string, unknown>>;
  processedAt: string | null;
}>;

export type AuthWhatsappChallengeRecord = Readonly<{
  id: string;
  scope: CommunicationScope;
  accountId: string;
  contactId: string;
  purpose: "SIGNUP_CONTACT_VERIFICATION" | "SIGNIN_STEP_UP" | "CONTACT_CHANGE";
  valueHash: string;
  valueMac: string;
  expiresAt: string;
  attemptCount: number;
  resendCount: number;
  consumedAt: string | null;
  invalidatedAt: string | null;
  deliveryJobId: string | null;
  rateBucket: string;
  transactionId: string;
  valueSalt: string;
  createdAt: string;
  nextResendAt: string;
}>;

export type CommunicationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: string; reason: string }>;

export class CommunicationAuthorizationError extends Error {
  readonly code: AuthorizationDecision["reason"];
  constructor(decision: AuthorizationDecision) {
    super(decision.reason);
    this.name = "CommunicationAuthorizationError";
    this.code = decision.reason;
  }
}

export class CommunicationPolicyError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "CommunicationPolicyError";
    this.code = code;
  }
}

function nowIso(now = new Date()) {
  return now.toISOString();
}

function id(prefix: string) {
  const random = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function hasPermission(principal: CommunicationsPrincipal, permission: string) {
  return principal.permissions.includes(permission) || principal.permissions.includes("*");
}

function hasOrganizationWideAuthority(principal: CommunicationsPrincipal) {
  return hasPermission(principal, "communications.scope.all");
}

const BUSINESS_RECORD_PERMISSION_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  customer: ["communication.contacts.view"],
  order: ["communication.transactions.view"],
  invoice: ["communication.transactions.view"],
  payment: ["communication.transactions.view"],
  supplier: ["suppliers.view", "procurement.view"],
  procurement: ["procurement.view"],
  employee: ["users.admin"],
  applicant: ["recruitment.view", "hr.recruitment.view"],
  interview: ["recruitment.view", "hr.recruitment.view"],
  leave: ["hr.leave.view"],
  training: ["hr.training.view"],
  incident: ["security.view"],
  maintenance: ["infrastructure.view"],
  support: ["communication.cases.edit", "communication.contacts.view"],
  external: ["communication.contacts.view"],
});

export class DefaultBusinessRecordAccessResolver implements BusinessRecordAccessResolver {
  private readonly sources: Readonly<Record<string, AuthoritativeBusinessRecordAccessSource>>;

  constructor(sources: Readonly<Record<string, AuthoritativeBusinessRecordAccessSource>> = {}) {
    this.sources = Object.freeze({ ...sources });
  }

  resolve(input: BusinessRecordAccessInput): BusinessRecordAccessDecision {
    const recordType = input.scope.recordType?.trim().toLowerCase() || null;
    const recordId = input.scope.recordId?.trim() || input.sourceRecordRef?.trim() || null;
    if (!recordType && !recordId) return { decision: "NOT_APPLICABLE", reason: "NO_BUSINESS_RECORD" };
    if (!recordType || !recordId) return { decision: "UNRESOLVED", reason: "BUSINESS_RECORD_CONTEXT_UNRESOLVED" };
    if (input.authorityMode !== "USER_AUTHORIZED") return { decision: "UNRESOLVED", reason: "NON_USER_AUTHORITY_REQUIRES_EXPLICIT_SOURCE" };
    if (!input.principal?.id) return { decision: "DENY", reason: "AUTHENTICATION_REQUIRED" };
    if (hasPermission(input.principal, "*")) return { decision: "ALLOW", reason: "OWNER_BUSINESS_RECORD_AUTHORITY" };
    const source = this.sources[recordType];
    if (!source) return { decision: "UNRESOLVED", reason: "AUTHORITATIVE_RECORD_SOURCE_UNAVAILABLE" };
    try {
      return source.resolve(input);
    } catch {
      return { decision: "UNRESOLVED", reason: "AUTHORITATIVE_RECORD_SOURCE_ERROR" };
    }
  }
}

export const DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER = new DefaultBusinessRecordAccessResolver();

/**
 * Test-only adapter for fixtures that explicitly model type + farm permission
 * as their authoritative record source. Production callers must inject actual
 * domain access sources into DefaultBusinessRecordAccessResolver.
 */
export class SyntheticTestBusinessRecordAccessResolver extends DefaultBusinessRecordAccessResolver {
  constructor() {
    const sources = Object.fromEntries(Object.entries(BUSINESS_RECORD_PERMISSION_ALIASES).map(([recordType, aliases]) => [recordType, {
      resolve(input: BusinessRecordAccessInput): BusinessRecordAccessDecision {
        const principal = input.principal;
        if (!principal?.id) return { decision: "DENY", reason: "AUTHENTICATION_REQUIRED" };
        const granted = aliases.some((permission) => hasPermission(principal, permission) || principal.hrPermissions?.includes(permission));
        return granted
          ? { decision: "ALLOW", reason: `SYNTHETIC_TEST_RECORD_AUTHORITY:${recordType}` }
          : { decision: "DENY", reason: `SYNTHETIC_TEST_RECORD_AUTHORITY_MISSING:${recordType}` };
      },
    }])) as Readonly<Record<string, AuthoritativeBusinessRecordAccessSource>>;
    super(sources);
  }
}

function businessRecordDecision(store: InMemoryCommunicationsStore, input: Omit<BusinessRecordAccessInput, "authorityMode"> & { authorityMode?: CommunicationAuthorityMode }) {
  const resolver = store.businessRecordAccessResolver || DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER;
  try {
    return resolver.resolve({ ...input, authorityMode: input.authorityMode || "USER_AUTHORIZED" });
  } catch {
    return { decision: "UNRESOLVED" as const, reason: "BUSINESS_RECORD_RESOLVER_ERROR" };
  }
}

function businessRecordAllows(decision: BusinessRecordAccessDecision) {
  return decision.decision === "ALLOW" || decision.decision === "NOT_APPLICABLE";
}

function authorityKey(input: { scope: CommunicationScope; sourceEvent?: string | null; sourceRecordRef?: string | null }) {
  return `${input.scope.organizationId}:${input.scope.farmId || "*"}:${input.sourceEvent || "*"}:${input.sourceRecordRef || input.scope.recordId || "*"}`;
}

export function authorizeCommunicationAccess(args: {
  principal: CommunicationsPrincipal | null;
  permission: string;
  businessRecordPermission?: boolean;
  scope: CommunicationScope;
  classification?: CommunicationClassification;
  policy?: CommunicationPolicyRecord | null;
  channel?: BackendChannel;
}): AuthorizationDecision {
  const { principal, permission, businessRecordPermission, scope, classification, policy, channel } = args;
  if (!principal?.id) return { allowed: false, reason: "AUTHENTICATION_REQUIRED" };
  if (!hasPermission(principal, permission)) return { allowed: false, reason: "COMMUNICATION_PERMISSION_REQUIRED" };
  if (businessRecordPermission === false) return { allowed: false, reason: "BUSINESS_RECORD_PERMISSION_REQUIRED" };
  if (!scope.organizationId || scope.organizationId !== principal.organizationId) {
    return { allowed: false, reason: "ORGANIZATION_SCOPE_REQUIRED" };
  }
  // A null farm assignment is unresolved, never an implicit organization-wide
  // grant.  Even an explicitly farm-scoped request must fail closed until the
  // authoritative principal has resolved farm assignment.
  if (principal.farmIds === null) return { allowed: false, reason: "FARM_ASSIGNMENT_UNRESOLVED" };
  if (scope.farmId) {
    if (!hasOrganizationWideAuthority(principal) && !principal.farmIds.includes(scope.farmId)) {
      return { allowed: false, reason: "FARM_SCOPE_DENIED" };
    }
  } else if (!hasOrganizationWideAuthority(principal)) {
    return { allowed: false, reason: "ORGANIZATION_SCOPE_REQUIRED" };
  }
  if (classification === "HR" || classification === "HR_SENSITIVE") {
    if (!hasPermission(principal, "hr.communications.view") && !principal.hrPermissions?.includes("hr.communications.view")) {
      return { allowed: false, reason: "HR_AUTHORITY_REQUIRED" };
    }
  }
  if (classification === "RECRUITMENT") {
    const recruitmentAuthority = hasPermission(principal, "hr.recruitment.view") || hasPermission(principal, "recruitment.view") || principal.hrPermissions?.includes("hr.recruitment.view");
    if (!recruitmentAuthority) return { allowed: false, reason: "HR_AUTHORITY_REQUIRED" };
  }
  if (classification === "SECURITY" && !hasPermission(principal, "security.view")) {
    return { allowed: false, reason: "SECURITY_AUTHORITY_REQUIRED" };
  }
  if (policy && channel && policy.enabledChannels[channel] !== true) return { allowed: false, reason: "POLICY_CHANNEL_DISABLED" };
  if (policy?.globalStop || policy?.emergencyStop) return { allowed: false, reason: "EMERGENCY_STOP" };
  return { allowed: true, reason: "ALLOWED" };
}

function stable(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function stableJson(value: unknown) {
  return stable(value);
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function artifactFingerprint(artifact: OutboundArtifact) {
  return sha256(stable(artifact));
}

export function containsSensitiveAuthMaterial(value: string) {
  return /(?:password|session(?:\s|_)?token|meta(?:\s|_)?secret|api[_ -]?key|one[- ]time password|verification code|\botp\b)/i.test(value);
}

export function sanitizeAiContext(input: Record<string, unknown>) {
  const deniedKey = /password|session|cookie|secret|token|otp|challenge|bank|payroll|disciplin|private/i;
  return Object.freeze(Object.fromEntries(Object.entries(input).filter(([key, value]) => {
    if (deniedKey.test(key)) return false;
    if (typeof value === "string" && containsSensitiveAuthMaterial(value)) return false;
    return true;
  })));
}

export function normalizeInternationalNumber(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) return null;
  return compact;
}

export const DEFAULT_COMMUNICATION_POLICY: CommunicationPolicyRecord = Object.freeze({
  id: "policy-v75-local",
  revision: "v75-local-1",
  organizationId: "daenem-farms",
  farmId: null,
  enabledChannels: { whatsapp: true, email: true, sms: false },
  aiEnabled: true,
  allowedAiOperations: ["GENERATE", "REFINE", "SHORTEN", "EXPAND", "REPHRASE", "TRANSLATE", "PERSONALIZE", "SUGGEST_REPLY", "CREATE_TEMPLATE", "SUMMARIZE"],
  humanReviewRequiredForAi: true,
  quietHours: { start: "18:00", end: "08:00", timezone: "Africa/Lagos" },
  budgetCentsPerDay: null,
  ratePerMinute: null,
  retentionDays: 90,
  emergencyStop: false,
  globalStop: false,
  channelStops: {},
  fallbackChannel: "email",
});

export type CommunicationsStoreOptions = Readonly<{
  businessRecordAccessResolver?: BusinessRecordAccessResolver;
  challengeVerificationKeyProvider?: ChallengeVerificationKeyProvider;
}>;

export function localCommunicationsBackendStatus() {
  return Object.freeze({
    version: COMMUNICATIONS_BACKEND_VERSION,
    persistence: "D1 migration ready; in-memory local adapter",
    provider: REAL_PROVIDER_STATUS,
    aiProvider: "NOT CONFIGURED",
    queue: "local contract / no production binding mutation",
    otpDelivery: "TEST MODE · NOT SENT",
    otpVerificationKey: "NOT CONFIGURED",
  });
}

export class InMemoryCommunicationsStore {
  readonly accounts = new Map<string, CommunicationAccountRecord>();
  readonly providerAccountMappings = new Map<string, ProviderAccountMappingRecord>();
  readonly contacts = new Map<string, CommunicationContactRecord>();
  readonly contactChannels = new Map<string, ContactChannelRecord>();
  readonly conversations = new Map<string, CommunicationConversationRecord>();
  readonly messages = new Map<string, CommunicationMessageRecord>();
  readonly attachments = new Map<string, CommunicationAttachmentRecord>();
  readonly templates = new Map<string, CommunicationTemplateRecord>();
  readonly templateVersions = new Map<string, CommunicationTemplateVersionRecord>();
  readonly policies = new Map<string, CommunicationPolicyRecord>();
  readonly preferences = new Map<string, { contactId: string; purpose: string; channel: BackendChannel; optedOut: boolean; quietHours: CommunicationPolicyRecord["quietHours"] }>();
  readonly consents = new Map<string, { contactId: string; purpose: string; channel: BackendChannel; state: "unknown" | "pending" | "granted" | "withdrawn"; capturedAt: string; noticeVersion: string; evidenceRef: string | null }>();
  readonly jobs = new Map<string, CommunicationJobRecord>();
  readonly outbox = new Map<string, CommunicationOutboxRecord>();
  readonly approvals = new Map<string, CommunicationApprovalRecord>();
  readonly deliveryEvents = new Map<string, CommunicationDeliveryEventRecord>();
  readonly audits = new Map<string, CommunicationAuditRecord>();
  readonly aiGenerations = new Map<string, CommunicationAiGenerationRecord>();
  readonly providerEvents = new Map<string, CommunicationProviderEventRecord>();
  readonly deadLetters = new Map<string, { jobId: string; reason: string; at: string }>();
  readonly challenges = new Map<string, AuthWhatsappChallengeRecord>();
  readonly challengeRate = new Map<string, { windowStartedAt: string; requestCount: number; lastIssuedAt: string }>();
  readonly idempotency = new Map<string, string>();
  readonly challengeLocks = new Set<string>();
  readonly principals = new Map<string, CommunicationsPrincipal>();
  readonly systemEventAuthorities = new Set<string>();
  readonly approvedAutomationAuthorities = new Set<string>();
  readonly minuteUsage = new Map<string, number>();
  readonly dailyUsageCents = new Map<string, number>();
  readonly providerRateCards = new Map<string, number | null>();
  readonly businessRecordAccessResolver: BusinessRecordAccessResolver;
  readonly challengeVerificationKeyProvider: ChallengeVerificationKeyProvider;
  readonly challengeVerifier: ChallengeVerifier;
  readonly clock: () => Date;

  constructor(clock: () => Date = () => new Date(), options: CommunicationsStoreOptions = {}) {
    this.clock = clock;
    this.businessRecordAccessResolver = options.businessRecordAccessResolver || new SyntheticTestBusinessRecordAccessResolver();
    // The in-memory adapter is explicitly test-mode.  A production adapter
    // must inject ProductionChallengeVerificationKeyProvider and remains
    // fail-closed until its secret binding is configured.
    this.challengeVerificationKeyProvider = options.challengeVerificationKeyProvider || new SyntheticTestChallengeVerificationKeyProvider();
    this.challengeVerifier = new HmacSha256ChallengeVerifier(this.challengeVerificationKeyProvider);
  }

  time() { return nowIso(this.clock()); }

  audit(input: Omit<CommunicationAuditRecord, "id" | "at">) {
    const record: CommunicationAuditRecord = { ...input, id: id("audit"), at: this.time() };
    this.audits.set(record.id, record);
    return record;
  }

  registerPrincipal(principal: CommunicationsPrincipal) {
    const snapshot: CommunicationsPrincipal = Object.freeze({
      ...principal,
      permissions: Object.freeze([...principal.permissions]),
      farmIds: principal.farmIds === null ? null : Object.freeze([...(principal.farmIds || [])]),
      hrPermissions: principal.hrPermissions ? Object.freeze([...principal.hrPermissions]) : undefined,
    });
    this.principals.set(snapshot.id, snapshot);
    return snapshot;
  }

  authorizeSystemEvent(input: { scope: CommunicationScope; sourceEvent: string; sourceRecordRef?: string | null }) {
    this.systemEventAuthorities.add(authorityKey(input));
  }

  authorizeApprovedAutomation(input: { scope: CommunicationScope; sourceEvent: string; sourceRecordRef?: string | null }) {
    this.approvedAutomationAuthorities.add(authorityKey(input));
  }

  setProviderRateCard(accountId: string, centsPerMessage: number | null) {
    this.providerRateCards.set(accountId, centsPerMessage);
  }

  private minuteBucket(at: Date) {
    return at.toISOString().slice(0, 16);
  }

  reserveDispatchUsage(input: { scope: CommunicationScope; accountId: string; channel: BackendChannel; policy: CommunicationPolicyRecord; at: Date }) {
    const minuteKey = `${input.scope.organizationId}:${input.accountId}:${input.channel}:${this.minuteBucket(input.at)}`;
    const minuteUsed = this.minuteUsage.get(minuteKey) || 0;
    if (input.policy.ratePerMinute !== null && minuteUsed >= Math.max(0, input.policy.ratePerMinute)) return { ok: false as const, reason: "RATE_STOP" };
    const budgetKey = `${input.scope.organizationId}:${input.accountId}:${input.at.toISOString().slice(0, 10)}`;
    let estimatedCost = 0;
    if (input.policy.budgetCentsPerDay !== null) {
      const rate = this.providerRateCards.get(input.accountId);
      if (rate === undefined || rate === null || !Number.isFinite(rate) || rate < 0) return { ok: false as const, reason: "PROVIDER_RATE_CARD_REQUIRED" };
      estimatedCost = rate;
      const budgetUsed = this.dailyUsageCents.get(budgetKey) || 0;
      if (budgetUsed + estimatedCost > Math.max(0, input.policy.budgetCentsPerDay)) return { ok: false as const, reason: "BUDGET_STOP" };
    }
    // Reservations occur before the awaitable provider call so concurrent
    // consumers cannot both pass a final policy check.
    this.minuteUsage.set(minuteKey, minuteUsed + 1);
    if (input.policy.budgetCentsPerDay !== null) this.dailyUsageCents.set(budgetKey, (this.dailyUsageCents.get(budgetKey) || 0) + estimatedCost);
    return { ok: true as const, estimatedCostCents: estimatedCost };
  }

  policy(scope: CommunicationScope) {
    return [...this.policies.values()].find((policy) => policy.organizationId === scope.organizationId && (!policy.farmId || policy.farmId === scope.farmId)) || DEFAULT_COMMUNICATION_POLICY;
  }

  visibleConversations(principal: CommunicationsPrincipal, _legacyBusinessRecordPermission = true) {
    void _legacyBusinessRecordPermission;
    return [...this.conversations.values()].filter((conversation) => {
      const business = businessRecordDecision(this, { principal, scope: conversation.scope, operation: "view", sourceRecordRef: conversation.businessRecordRef });
      const decision = authorizeCommunicationAccess({
        principal,
        permission: "communications.view",
        businessRecordPermission: businessRecordAllows(business),
        scope: conversation.scope,
        classification: conversation.classification,
      });
      return decision.allowed && businessRecordAllows(business);
    });
  }

  visibleMessages(principal: CommunicationsPrincipal, conversationId: string, _legacyBusinessRecordPermission = true) {
    void _legacyBusinessRecordPermission;
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [] as CommunicationMessageRecord[];
    const business = businessRecordDecision(this, { principal, scope: conversation.scope, operation: "read", sourceRecordRef: conversation.businessRecordRef });
    const decision = authorizeCommunicationAccess({
      principal,
        permission: "communications.view",
      businessRecordPermission: businessRecordAllows(business),
      scope: conversation.scope,
      classification: conversation.classification,
    });
    if (!decision.allowed || !businessRecordAllows(business)) return [];
    const canSeeNotes = hasPermission(principal, "communications.notes");
    return [...this.messages.values()].filter((message) => message.conversationId === conversationId && (message.visibleToGeneralAgents || (message.channel === "internal_note" && canSeeNotes)));
  }
}

export function createCommunicationAccount(store: InMemoryCommunicationsStore, input: CommunicationAccountRecord) {
  store.accounts.set(input.id, Object.freeze({ ...input }));
  return input;
}

function providerMappingKey(provider: ProviderAccountMappingRecord["provider"], providerAccountId: string) {
  return `${provider}:${providerAccountId}`;
}

export function registerProviderAccountMapping(store: InMemoryCommunicationsStore, input: ProviderAccountMappingRecord) {
  const account = store.accounts.get(input.accountId);
  if (!account || account.channel !== input.channel || account.scope.organizationId !== input.organizationId) {
    throw new CommunicationPolicyError("PROVIDER_ACCOUNT_MAPPING_INVALID");
  }
  if (account.scope.farmId && account.scope.farmId !== input.farmId) {
    throw new CommunicationPolicyError("PROVIDER_ACCOUNT_MAPPING_SCOPE_INVALID");
  }
  const mapping = Object.freeze({ ...input });
  store.providerAccountMappings.set(providerMappingKey(input.provider, input.providerAccountId), mapping);
  return mapping;
}

export function createContact(store: InMemoryCommunicationsStore, input: CommunicationContactRecord) {
  store.contacts.set(input.id, Object.freeze({ ...input, channelIds: [...input.channelIds] }));
  return input;
}

export function addContactChannel(store: InMemoryCommunicationsStore, input: ContactChannelRecord) {
  if (!normalizeInternationalNumber(input.normalizedAddress)) throw new CommunicationPolicyError("INVALID_INTERNATIONAL_NUMBER");
  store.contactChannels.set(input.id, Object.freeze({ ...input }));
  const contact = store.contacts.get(input.contactId);
  if (contact && !contact.channelIds.includes(input.id)) {
    store.contacts.set(contact.id, Object.freeze({ ...contact, channelIds: [...contact.channelIds, input.id] }));
  }
  return input;
}

function purposeForJob(purpose: CommunicationJobRecord["purpose"]): ContactChannelRecord["purpose"] {
  if (purpose === "authentication") return "authentication";
  if (purpose === "hr") return "hr_operational";
  return "transactional";
}

type ContactChannelResolution =
  | Readonly<{ contact: CommunicationContactRecord; channel: ContactChannelRecord }>
  | Readonly<{ reason: "RECIPIENT_NOT_FOUND" | "RECIPIENT_INACTIVE" | "RECIPIENT_CHANNEL_UNAVAILABLE" | "CONTACT_REVISION_CHANGED" | "RECIPIENT_CHANNEL_INACTIVE" | "INVALID_NORMALIZED_DESTINATION"; contact?: CommunicationContactRecord; channel?: ContactChannelRecord }>;

function findContactChannel(store: InMemoryCommunicationsStore, contactId: string, channel: BackendChannel, revision: number | null, purpose: ContactChannelRecord["purpose"]): ContactChannelResolution {
  const contact = store.contacts.get(contactId);
  if (!contact) return { reason: "RECIPIENT_NOT_FOUND" as const };
  if (!contact.active) return { reason: "RECIPIENT_INACTIVE" as const };
  const current = [...store.contactChannels.values()].find((candidate) =>
    candidate.contactId === contactId && candidate.channel === channel && candidate.purpose === purpose,
  );
  if (!current) return { reason: "RECIPIENT_CHANNEL_UNAVAILABLE" as const };
  if (revision !== null && current.revision !== revision) return { reason: "CONTACT_REVISION_CHANGED" as const, contact, channel: current };
  if (!current.active) return { reason: "RECIPIENT_CHANNEL_INACTIVE" as const, contact, channel: current };
  if (channel === "whatsapp" && !normalizeInternationalNumber(current.normalizedAddress)) return { reason: "INVALID_NORMALIZED_DESTINATION" as const, contact, channel: current };
  return { contact, channel: current };
}

function preferenceFor(store: InMemoryCommunicationsStore, contactId: string, purpose: ContactChannelRecord["purpose"], channel: BackendChannel) {
  return store.preferences.get(`${contactId}:${purpose}:${channel}`);
}

function consentFor(store: InMemoryCommunicationsStore, contactId: string, purpose: ContactChannelRecord["purpose"], channel: BackendChannel) {
  return store.consents.get(`${contactId}:${purpose}:${channel}`);
}

export function createConversation(store: InMemoryCommunicationsStore, input: Omit<CommunicationConversationRecord, "createdAt" | "updatedAt" | "lastActivityAt">, actor: CommunicationsPrincipal, _legacyBusinessRecordPermission = true) {
  void _legacyBusinessRecordPermission;
  const business = businessRecordDecision(store, { principal: actor, scope: input.scope, operation: "view", sourceRecordRef: input.businessRecordRef });
  const decision = authorizeCommunicationAccess({
    principal: actor,
    permission: "communications.view",
    businessRecordPermission: businessRecordAllows(business),
    scope: input.scope,
    classification: input.classification,
    channel: input.channel,
  });
  if (!decision.allowed) throw new CommunicationAuthorizationError(decision);
  const at = store.time();
  const conversation: CommunicationConversationRecord = Object.freeze({ ...input, createdAt: at, updatedAt: at, lastActivityAt: at, participantIds: [...input.participantIds], tags: [...input.tags] });
  store.conversations.set(conversation.id, conversation);
  store.audit({ scope: input.scope, actorId: actor.id, kind: "conversation_created", correlationId: id("correlation"), sourceRecordRef: input.businessRecordRef, safeMetadata: { channel: input.channel, classification: input.classification } });
  return conversation;
}

export function appendMessage(store: InMemoryCommunicationsStore, input: Omit<CommunicationMessageRecord, "createdAt">, actor: CommunicationsPrincipal, _legacyBusinessRecordPermission = true) {
  void _legacyBusinessRecordPermission;
  const conversation = store.conversations.get(input.conversationId);
  if (!conversation) throw new CommunicationPolicyError("CONVERSATION_NOT_FOUND");
  const business = businessRecordDecision(store, { principal: actor, scope: conversation.scope, operation: input.direction === "internal" ? "reply" : "reply", sourceRecordRef: conversation.businessRecordRef });
  const decision = authorizeCommunicationAccess({
    principal: actor,
    permission: input.direction === "internal" ? "communications.notes" : "communications.reply",
    businessRecordPermission: businessRecordAllows(business),
    scope: conversation.scope,
    classification: conversation.classification,
    channel: input.channel === "internal_note" ? undefined : input.channel,
  });
  if (!decision.allowed) throw new CommunicationAuthorizationError(decision);
  if (input.body && containsSensitiveAuthMaterial(input.body)) {
    throw new CommunicationPolicyError("AUTHENTICATION_MATERIAL_MUST_NOT_ENTER_TRANSCRIPT");
  }
  const message: CommunicationMessageRecord = Object.freeze({ ...input, createdAt: store.time(), visibleToGeneralAgents: conversation.classification === "GENERAL" || conversation.classification === "CUSTOMER" || conversation.classification === "SUPPLIER" });
  store.messages.set(message.id, message);
  return message;
}

export function addInternalNote(store: InMemoryCommunicationsStore, input: Omit<CommunicationMessageRecord, "createdAt" | "direction" | "channel" | "contentType" | "source" | "state" | "visibleToGeneralAgents">, actor: CommunicationsPrincipal, _legacyBusinessRecordPermission = true) {
  void _legacyBusinessRecordPermission;
  return appendMessage(store, {
    ...input,
    direction: "internal",
    channel: "internal_note",
    contentType: "internal_note",
    source: "internal_note",
    state: "DRAFT",
    visibleToGeneralAgents: false,
  }, actor);
}

export function addAttachment(store: InMemoryCommunicationsStore, input: CommunicationAttachmentRecord, actor: CommunicationsPrincipal, _legacyBusinessRecordPermission = true) {
  void _legacyBusinessRecordPermission;
  const conversation = store.conversations.get(store.messages.get(input.messageId)?.conversationId || "");
  if (!conversation) throw new CommunicationPolicyError("CONVERSATION_NOT_FOUND");
  const business = businessRecordDecision(store, { principal: actor, scope: conversation.scope, operation: "attach", sourceRecordRef: conversation.businessRecordRef });
  const decision = authorizeCommunicationAccess({
    principal: actor,
    permission: "communications.attachments.manage",
    businessRecordPermission: businessRecordAllows(business),
    scope: input.scope,
    classification: conversation.classification,
  });
  if (!decision.allowed) throw new CommunicationAuthorizationError(decision);
  if (!input.storageObjectRef.startsWith("private/")) throw new CommunicationPolicyError("PRIVATE_STORAGE_REFERENCE_REQUIRED");
  if (input.sizeBytes < 0 || input.sizeBytes > 25 * 1024 * 1024) throw new CommunicationPolicyError("ATTACHMENT_SIZE_LIMIT");
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new CommunicationPolicyError("ATTACHMENT_HASH_REQUIRED");
  const attachment = Object.freeze({ ...input });
  store.attachments.set(input.id, attachment);
  store.audit({ scope: input.scope, actorId: actor.id, kind: "attachment_action", correlationId: id("correlation"), sourceRecordRef: conversation.businessRecordRef, safeMetadata: { attachmentId: input.id, accessClassification: input.accessClassification, scanStatus: input.scanStatus } });
  return attachment;
}

export function recordConsent(store: InMemoryCommunicationsStore, input: { contactId: string; purpose: string; channel: BackendChannel; state: "unknown" | "pending" | "granted" | "withdrawn"; noticeVersion: string; evidenceRef?: string | null }) {
  const key = `${input.contactId}:${input.purpose}:${input.channel}`;
  const value = { ...input, capturedAt: store.time(), evidenceRef: input.evidenceRef ?? null };
  store.consents.set(key, value);
  return value;
}

export function recordPreference(store: InMemoryCommunicationsStore, input: { contactId: string; purpose: string; channel: BackendChannel; optedOut: boolean; quietHours?: CommunicationPolicyRecord["quietHours"] }) {
  const key = `${input.contactId}:${input.purpose}:${input.channel}`;
  const value = { ...input, quietHours: input.quietHours ?? null };
  store.preferences.set(key, value);
  return value;
}

export function createTemplate(store: InMemoryCommunicationsStore, input: CommunicationTemplateRecord, actor: CommunicationsPrincipal, _legacyBusinessRecordPermission = true) {
  void _legacyBusinessRecordPermission;
  const business = businessRecordDecision(store, { principal: actor, scope: input.scope, operation: "send" });
  const decision = authorizeCommunicationAccess({ principal: actor, permission: "communications.templates.create", businessRecordPermission: businessRecordAllows(business), scope: input.scope, classification: input.internalState === "DRAFT" ? "GENERAL" : undefined });
  if (!decision.allowed) throw new CommunicationAuthorizationError(decision);
  store.templates.set(input.id, Object.freeze({ ...input, lockedVariables: [...input.lockedVariables] }));
  return input;
}

export function updateTemplateState(store: InMemoryCommunicationsStore, templateId: string, next: TemplateState, actor: CommunicationsPrincipal, _legacyBusinessRecordPermission = true) {
  void _legacyBusinessRecordPermission;
  const current = store.templates.get(templateId);
  if (!current) throw new CommunicationPolicyError("TEMPLATE_NOT_FOUND");
  const business = businessRecordDecision(store, { principal: actor, scope: current.scope, operation: "approve" });
  const decision = authorizeCommunicationAccess({ principal: actor, permission: next === "APPROVED" ? "communications.templates.approve" : "communications.templates.edit", businessRecordPermission: businessRecordAllows(business), scope: current.scope });
  if (!decision.allowed) throw new CommunicationAuthorizationError(decision);
  const nextRecord = Object.freeze({ ...current, internalState: next });
  store.templates.set(templateId, nextRecord);
  return nextRecord;
}

export async function requestApproval(store: InMemoryCommunicationsStore, input: { principal: CommunicationsPrincipal; scope: CommunicationScope; jobId: string; artifact: OutboundArtifact; policyRevision: string }) {
  const job = store.jobs.get(input.jobId);
  if (!job) throw new CommunicationPolicyError("JOB_NOT_FOUND");
  if (job.scope.organizationId !== input.scope.organizationId || job.scope.farmId !== input.scope.farmId) throw new CommunicationPolicyError("APPROVAL_SCOPE_MISMATCH");
  if (job.scope.recordId && input.artifact.sourceRecordRef !== job.scope.recordId) throw new CommunicationPolicyError("APPROVAL_SOURCE_RECORD_MISMATCH");
  const access = authorizeCommunicationAccess({ principal: input.principal, permission: "communications.send", scope: job.scope });
  if (!access.allowed) throw new CommunicationAuthorizationError(access);
  const business = businessRecordDecision(store, { principal: input.principal, scope: job.scope, operation: "send", authorityMode: "USER_AUTHORIZED", sourceRecordRef: input.artifact.sourceRecordRef, sourceEvent: input.artifact.sourceEvent });
  if (!businessRecordAllows(business)) throw new CommunicationPolicyError("BUSINESS_RECORD_AUTHORITY_REQUIRED");
  const fingerprint = await artifactFingerprint(input.artifact);
  store.registerPrincipal(input.principal);
  const approval: CommunicationApprovalRecord = Object.freeze({ id: id("approval"), scope: job.scope, jobId: input.jobId, requestedBy: input.principal.id, requestedAt: store.time(), reviewerId: null, decision: "pending", decisionAt: null, reason: null, fingerprint, invalidatedAt: null, invalidationReason: null, policyRevision: input.policyRevision });
  store.approvals.set(approval.id, approval);
  store.audit({ scope: input.scope, actorId: input.principal.id, kind: "approval_requested", correlationId: id("correlation"), sourceRecordRef: input.artifact.sourceRecordRef, safeMetadata: { jobId: input.jobId, fingerprint } });
  return approval;
}

export async function decideApproval(store: InMemoryCommunicationsStore, approvalId: string, reviewer: CommunicationsPrincipal, decision: "approved" | "denied", reason: string | null = null) {
  const current = store.approvals.get(approvalId);
  if (!current) throw new CommunicationPolicyError("APPROVAL_NOT_FOUND");
  if (reviewer.id === current.requestedBy) throw new CommunicationPolicyError("SELF_APPROVAL_DENIED");
  if (current.decision !== "pending") throw new CommunicationPolicyError("APPROVAL_NOT_PENDING");
  const job = store.jobs.get(current.jobId);
  if (!job) throw new CommunicationPolicyError("JOB_NOT_FOUND");
  const access = authorizeCommunicationAccess({ principal: reviewer, permission: "communications.ai.approve", scope: current.scope });
  if (!access.allowed) throw new CommunicationAuthorizationError(access);
  if (job.scope.recordId && job.scope.recordId !== current.scope.recordId) throw new CommunicationPolicyError("APPROVAL_SOURCE_RECORD_MISMATCH");
  const business = businessRecordDecision(store, { principal: reviewer, scope: job.scope, operation: "approve", authorityMode: "USER_AUTHORIZED", sourceRecordRef: job.scope.recordId });
  if (!businessRecordAllows(business)) throw new CommunicationPolicyError("BUSINESS_RECORD_AUTHORITY_REQUIRED");
  store.registerPrincipal(reviewer);
  const next = Object.freeze({ ...current, reviewerId: reviewer.id, decision, decisionAt: store.time(), reason });
  store.approvals.set(approvalId, next);
  store.audit({ scope: current.scope, actorId: reviewer.id, kind: decision === "approved" ? "approval_granted" : "approval_denied", correlationId: id("correlation"), sourceRecordRef: null, safeMetadata: { approvalId, decision } });
  return next;
}

export async function invalidateApprovalIfChanged(store: InMemoryCommunicationsStore, approvalId: string, artifact: OutboundArtifact) {
  const current = store.approvals.get(approvalId);
  if (!current || current.decision !== "approved") return current;
  const fingerprint = await artifactFingerprint(artifact);
  if (fingerprint === current.fingerprint) return current;
  const next = Object.freeze({ ...current, decision: "denied" as const, invalidatedAt: store.time(), invalidationReason: "MATERIAL_ARTIFACT_CHANGE" });
  store.approvals.set(approvalId, next);
  store.audit({ scope: current.scope, actorId: current.requestedBy, kind: "approval_invalidated", correlationId: id("correlation"), sourceRecordRef: artifact.sourceRecordRef, safeMetadata: { approvalId, reason: "MATERIAL_ARTIFACT_CHANGE" } });
  return next;
}

function priorityFor(purpose: CommunicationJobRecord["purpose"]): QueuePriority {
  return purpose === "authentication" ? "high_auth" : purpose === "transactional" ? "transactional" : purpose === "hr" ? "hr" : purpose === "bulk" ? "bulk" : "normal";
}

function providerModeAllowed(mode: "TEST_MODE" | "REAL_PROVIDER") {
  return mode === "TEST_MODE";
}

type QueueAuthorityInput = Readonly<{
  mode: CommunicationAuthorityMode;
  principalId?: string | null;
  permission?: string | null;
  sourceEvent?: string | null;
  sourceRecordRef?: string | null;
}>;

function explicitNonUserAuthorityAllowed(store: InMemoryCommunicationsStore, mode: CommunicationAuthorityMode, input: { scope: CommunicationScope; sourceEvent?: string | null; sourceRecordRef?: string | null }) {
  const key = authorityKey(input);
  if (mode === "SYSTEM_EVENT") return store.systemEventAuthorities.has(key);
  if (mode === "APPROVED_AUTOMATION") return store.approvedAutomationAuthorities.has(key);
  return mode === "AUTHENTICATION" && !input.scope.recordType && !input.scope.recordId;
}

export async function queueOutboundCommunication(store: InMemoryCommunicationsStore, input: {
  principal: CommunicationsPrincipal | null;
  scope: CommunicationScope;
  conversationId: string;
  artifact: OutboundArtifact;
  purpose: CommunicationJobRecord["purpose"];
  /** @deprecated retained for source compatibility; never trusted. */
  businessRecordPermission?: boolean;
  authority?: QueueAuthorityInput;
  policy?: CommunicationPolicyRecord;
  providerMode?: "TEST_MODE" | "REAL_PROVIDER";
  approval?: CommunicationApprovalRecord | null;
  template?: CommunicationTemplateRecord | null;
  aiGenerated?: boolean;
  idempotencyKey: string;
  expiresAt?: string | null;
}) : Promise<CommunicationResult<CommunicationJobRecord>> {
  const conversation = store.conversations.get(input.conversationId);
  const account = conversation ? store.accounts.get(conversation.accountId) : null;
  if (!conversation || !account || conversation.scope.organizationId !== input.scope.organizationId || conversation.scope.farmId !== input.scope.farmId) return { ok: false, code: "COMMUNICATION_SCOPE_MISMATCH", reason: "Conversation scope does not match the authenticated request." };
  if ((input.scope.recordId && conversation.scope.recordId && input.scope.recordId !== conversation.scope.recordId) || (input.artifact.sourceRecordRef && conversation.businessRecordRef && input.artifact.sourceRecordRef !== conversation.businessRecordRef)) return { ok: false, code: "SOURCE_RECORD_MISMATCH", reason: "The message source record does not match the authoritative conversation record." };
  const scope: CommunicationScope = Object.freeze({
    ...input.scope,
    recordType: input.scope.recordType || conversation.scope.recordType || null,
    recordId: input.scope.recordId || conversation.scope.recordId || input.artifact.sourceRecordRef || null,
  });
  const authorityMode = input.authority?.mode || "USER_AUTHORIZED";
  const authoritySourceEvent = input.authority?.sourceEvent || input.artifact.sourceEvent || null;
  const authoritySourceRef = input.authority?.sourceRecordRef || input.artifact.sourceRecordRef || scope.recordId || null;
  if (authorityMode === "USER_AUTHORIZED") {
    const decision = authorizeCommunicationAccess({ principal: input.principal, permission: "communications.send", scope, classification: input.purpose === "hr" ? "HR" : "GENERAL" });
    if (!decision.allowed) return { ok: false, code: decision.reason, reason: decision.reason };
    const business = businessRecordDecision(store, { principal: input.principal, scope, operation: "send", authorityMode, sourceRecordRef: authoritySourceRef, sourceEvent: authoritySourceEvent });
    if (!businessRecordAllows(business)) return { ok: false, code: "BUSINESS_RECORD_AUTHORITY_REQUIRED", reason: business.reason };
    if (!input.principal?.id) return { ok: false, code: "AUTHENTICATION_REQUIRED", reason: "Authenticated principal required." };
    store.registerPrincipal(input.principal);
  } else {
    if (!scope.organizationId || !authoritySourceEvent || !explicitNonUserAuthorityAllowed(store, authorityMode, { scope, sourceEvent: authoritySourceEvent, sourceRecordRef: authoritySourceRef })) {
      return { ok: false, code: "AUTHORITY_CONTEXT_REQUIRED", reason: "An explicit server-owned source authority is required." };
    }
    // A system event or approved automation carries its own server-owned
    // source authority.  It is never represented as a synthetic user.
  }
  const policy = input.policy || store.policy(scope);
  if (policy.globalStop || policy.emergencyStop) return { ok: false, code: "EMERGENCY_STOP", reason: "Emergency communication stop is active." };
  if (policy.channelStops[input.artifact.channel]) return { ok: false, code: "CHANNEL_STOP", reason: "Channel policy stop is active." };
  if (!providerModeAllowed(input.providerMode || "TEST_MODE")) return { ok: false, code: "PROVIDER_INTEGRATION_REQUIRED", reason: REAL_PROVIDER_STATUS };
  if (account.channel !== input.artifact.channel || !account.enabled || account.providerState !== "TEST_MODE") return { ok: false, code: "PROVIDER_ACCOUNT_UNAVAILABLE", reason: "The authoritative provider account is unavailable." };
  const recipientPurpose = purposeForJob(input.purpose);
  const recipient = findContactChannel(store, input.artifact.recipientContactId, input.artifact.channel, input.artifact.recipientContactRevision, recipientPurpose);
  if ("reason" in recipient) {
    const reason = recipient.reason;
    return { ok: false, code: reason, reason };
  }
  const consent = consentFor(store, input.artifact.recipientContactId, recipientPurpose, input.artifact.channel);
  if (!consent || consent.state !== "granted") return { ok: false, code: "CONSENT_REQUIRED", reason: "Current consent is not granted." };
  const preference = preferenceFor(store, input.artifact.recipientContactId, recipientPurpose, input.artifact.channel);
  if (preference?.optedOut) return { ok: false, code: "RECIPIENT_OPTED_OUT", reason: "The current recipient preference opts out." };
  const template = input.template || (input.artifact.templateId ? store.templates.get(input.artifact.templateId) || null : null);
  if (template && ["PAUSED", "RETIRED"].includes(template.internalState)) return { ok: false, code: "TEMPLATE_NOT_SENDABLE", reason: template.internalState };
  if (input.aiGenerated && policy.humanReviewRequiredForAi && (!input.approval || input.approval.decision !== "approved")) return { ok: false, code: "HUMAN_APPROVAL_REQUIRED", reason: "Fresh AI content needs human approval." };
  const fingerprint = await artifactFingerprint(input.artifact);
  if (input.approval && (input.approval.decision !== "approved" || input.approval.fingerprint !== fingerprint || input.approval.invalidatedAt)) return { ok: false, code: "APPROVAL_INVALIDATED", reason: "Approval does not bind the current artifact." };
  const existingJobId = store.idempotency.get(`${scope.organizationId}:${input.idempotencyKey}`);
  if (existingJobId) {
    const existing = store.jobs.get(existingJobId);
    if (existing) return { ok: true, value: existing };
  }
  const at = store.time();
  const jobId = id("job");
  const messageId = id("message");
  const correlationId = id("correlation");
  const job: CommunicationJobRecord = Object.freeze({ id: jobId, scope, conversationId: input.conversationId, messageId, purpose: input.purpose, priority: priorityFor(input.purpose), state: "QUEUED", idempotencyKey: input.idempotencyKey, correlationId, attempts: 0, nextAttemptAt: at, expiresAt: input.expiresAt || null, approvalId: input.approval?.id || null, artifactFingerprint: fingerprint, failureCode: null, deadLetteredAt: null, createdAt: at, accountId: account.id, recipientContactId: recipient.channel.contactId, recipientContactRevision: recipient.channel.revision, recipientPurpose, templateId: template?.id || input.artifact.templateId || null, templateVersionId: input.artifact.templateVersionId || template?.currentVersionId || null, policyRevision: policy.revision, authorityMode, authorityPrincipalId: input.principal?.id || input.authority?.principalId || null, authorityPermission: input.authority?.permission || (authorityMode === "USER_AUTHORIZED" ? "communications.send" : null), authoritySourceEvent });
  const message: CommunicationMessageRecord = Object.freeze({ id: messageId, scope, conversationId: input.conversationId, direction: "outbound", channel: input.artifact.channel, senderRef: account.senderAddress, recipientRef: recipient.channel.normalizedAddress, body: input.artifact.content, contentType: input.artifact.templateVersionId ? "template" : "text", state: "QUEUED", source: input.aiGenerated ? "ai_generated" : input.artifact.templateVersionId ? "approved_template" : "user_input", templateVersionId: input.artifact.templateVersionId, aiGenerationId: null, replyToId: null, providerMessageId: null, failureCode: null, createdAt: at, sentAt: null, deliveredAt: null, readAt: null, visibleToGeneralAgents: input.purpose !== "hr", accountId: account.id, recipientContactId: recipient.channel.contactId, recipientContactRevision: recipient.channel.revision, recipientPurpose, templateId: template?.id || input.artifact.templateId || null, policyRevision: policy.revision });
  const outbox: CommunicationOutboxRecord = Object.freeze({ id: id("outbox"), scope, jobId, eventType: "communication.intent", state: "READY", idempotencyKey: input.idempotencyKey, correlationId, availableAt: at, claimedAt: null });
  store.jobs.set(jobId, job);
  store.messages.set(messageId, message);
  store.outbox.set(outbox.id, outbox);
  store.idempotency.set(`${scope.organizationId}:${input.idempotencyKey}`, jobId);
  store.audit({ scope, actorId: input.principal?.id || `authority:${authorityMode}`, kind: "job_queued", correlationId, sourceRecordRef: input.artifact.sourceRecordRef, safeMetadata: { jobId, priority: job.priority, state: job.state, authorityMode } });
  return { ok: true, value: job };
}

export type WhatsAppProvider = Readonly<{
  sendText(input: { accountId: string; recipient: string; body: string; idempotencyKey: string }): Promise<{ providerMessageId: string; state: "SUBMITTED"; testMode: boolean }>;
  sendTemplate(input: { accountId: string; recipient: string; template: string; idempotencyKey: string }): Promise<{ providerMessageId: string; state: "SUBMITTED"; testMode: boolean }>;
  uploadMedia(input: { accountId: string; contentType: string; bytes: Uint8Array }): Promise<{ mediaId: string; testMode: boolean }>;
  retrieveMedia(input: { accountId: string; mediaId: string }): Promise<{ bytes: Uint8Array; contentType: string; testMode: boolean }>;
  getTemplateStatus(input: { accountId: string; template: string }): Promise<{ state: ProviderTemplateState; testMode: boolean }>;
  subscribeWebhook(): Promise<{ configured: false; reason: "INTEGRATION_REQUIRED" }>;
  health(): Promise<{ state: "TEST_MODE" | "NOT_CONFIGURED"; testMode: boolean }>;
}>;

export class TestWhatsAppProvider implements WhatsAppProvider {
  readonly sent = new Map<string, { providerMessageId: string; recipient: string; body: string }>();
  readonly calls: string[] = [];
  async sendText(input: { accountId: string; recipient: string; body: string; idempotencyKey: string }) {
    const existing = this.sent.get(input.idempotencyKey);
    if (existing) return { providerMessageId: existing.providerMessageId, state: "SUBMITTED" as const, testMode: true };
    const value = { providerMessageId: `test-msg-${this.sent.size + 1}`, recipient: input.recipient, body: input.body };
    this.sent.set(input.idempotencyKey, value);
    this.calls.push(input.idempotencyKey);
    return { providerMessageId: value.providerMessageId, state: "SUBMITTED" as const, testMode: true };
  }
  async sendTemplate(input: { accountId: string; recipient: string; template: string; idempotencyKey: string }) {
    return this.sendText({ accountId: input.accountId, recipient: input.recipient, body: `[TEST TEMPLATE ${input.template}]`, idempotencyKey: input.idempotencyKey });
  }
  async uploadMedia(input: { accountId: string; contentType: string; bytes: Uint8Array }) {
    void input;
    return { mediaId: `test-media-${this.calls.length + 1}`, testMode: true };
  }
  async retrieveMedia(input: { accountId: string; mediaId: string }) {
    void input;
    return { bytes: new Uint8Array(), contentType: "application/octet-stream", testMode: true };
  }
  async getTemplateStatus(input: { accountId: string; template: string }) {
    void input;
    return { state: "NOT_SUBMITTED" as const, testMode: true };
  }
  async subscribeWebhook() { return { configured: false as const, reason: "INTEGRATION_REQUIRED" as const }; }
  async health() { return { state: "TEST_MODE" as const, testMode: true }; }
}

function retryDelay(attempt: number) {
  return Math.min(60 * 60 * 1000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

function isWithinQuietHours(now: Date, quietHours: CommunicationPolicyRecord["quietHours"]) {
  if (!quietHours) return false;
  const [startHour, startMinute] = quietHours.start.split(":").map(Number);
  const [endHour, endMinute] = quietHours.end.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: quietHours.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const current = hour * 60 + minute;
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function blockDispatch(store: InMemoryCommunicationsStore, job: CommunicationJobRecord, message: CommunicationMessageRecord, reason: string, state: DeliveryState = "CANCELLED") {
  const nextJob = Object.freeze({ ...job, state, failureCode: reason, nextAttemptAt: null });
  const nextMessage = Object.freeze({ ...message, state, failureCode: reason });
  store.jobs.set(job.id, nextJob);
  store.messages.set(message.id, nextMessage);
  return { state, reason };
}

export async function dispatchCommunicationJob(store: InMemoryCommunicationsStore, jobId: string, provider: WhatsAppProvider, now = new Date()) {
  const job = store.jobs.get(jobId);
  if (!job) return { state: "MISSING" as const };
  if (["SUBMITTED", "SENT", "DELIVERED", "READ", "CANCELLED", "EXPIRED"].includes(job.state)) return { state: job.state };
  const message = job.messageId ? store.messages.get(job.messageId) : null;
  if (!message || message.channel !== "whatsapp") return { state: "UNSUPPORTED" as const };
  if (job.expiresAt && new Date(job.expiresAt).getTime() <= now.getTime()) return blockDispatch(store, job, message, "JOB_EXPIRED", "EXPIRED");
  const policy = store.policy(job.scope);
  if (job.policyRevision !== policy.revision) return blockDispatch(store, job, message, "POLICY_REVISION_CHANGED");
  if (policy.globalStop || policy.emergencyStop) return blockDispatch(store, job, message, "EMERGENCY_STOP");
  if (policy.channelStops[message.channel]) return blockDispatch(store, job, message, "CHANNEL_STOP");
  if (policy.enabledChannels[message.channel] !== true) return blockDispatch(store, job, message, "POLICY_CHANNEL_DISABLED");
  if (isWithinQuietHours(now, policy.quietHours)) return blockDispatch(store, job, message, "QUIET_HOURS");

  const account = store.accounts.get(job.accountId);
  if (!account || account.scope.organizationId !== job.scope.organizationId || !account.enabled || account.providerState !== "TEST_MODE") return blockDispatch(store, job, message, "PROVIDER_ACCOUNT_DISABLED");
  if (account.policyRevision !== policy.revision) return blockDispatch(store, job, message, "POLICY_REVISION_CHANGED");

  const recipient = findContactChannel(store, job.recipientContactId, message.channel, job.recipientContactRevision, job.recipientPurpose);
  if ("reason" in recipient) {
    const reason = recipient.reason;
    return blockDispatch(store, job, message, reason);
  }
  if (recipient.contact.scope.organizationId !== job.scope.organizationId || (job.scope.farmId && recipient.contact.scope.farmId !== job.scope.farmId)) return blockDispatch(store, job, message, "RECIPIENT_SCOPE_DENIED");
  if (recipient.channel.consentState !== "granted") return blockDispatch(store, job, message, "CONSENT_CHANGED");
  const currentConsent = consentFor(store, job.recipientContactId, job.recipientPurpose, message.channel);
  if (!currentConsent || currentConsent.state !== "granted") return blockDispatch(store, job, message, "CONSENT_CHANGED");
  const preference = preferenceFor(store, job.recipientContactId, job.recipientPurpose, message.channel);
  if (preference?.optedOut) return blockDispatch(store, job, message, "RECIPIENT_OPTED_OUT");

  if (job.templateId) {
    const template = store.templates.get(job.templateId);
    if (!template || ["PAUSED", "RETIRED"].includes(template.internalState)) return blockDispatch(store, job, message, "TEMPLATE_NOT_SENDABLE");
    if (template.currentVersionId !== job.templateVersionId) return blockDispatch(store, job, message, "TEMPLATE_VERSION_CHANGED");
  }
  if (job.approvalId) {
    const approval = store.approvals.get(job.approvalId);
    if (!approval || approval.decision !== "approved" || approval.invalidatedAt || approval.fingerprint !== job.artifactFingerprint) return blockDispatch(store, job, message, "APPROVAL_INVALIDATED");
  }

  // Queued authorization is only a snapshot.  Re-resolve the authority that
  // created this job immediately before the provider boundary.
  if (!job.authorityMode) return blockDispatch(store, job, message, "AUTHORITY_CONTEXT_UNRESOLVED");
  if (job.authorityMode === "USER_AUTHORIZED") {
    const principal = job.authorityPrincipalId ? store.principals.get(job.authorityPrincipalId) || null : null;
    if (!principal) return blockDispatch(store, job, message, "USER_AUTHORITY_REVOKED");
    const access = authorizeCommunicationAccess({ principal, permission: job.authorityPermission || "communications.send", scope: job.scope, policy, channel: message.channel });
    if (!access.allowed) return blockDispatch(store, job, message, "USER_AUTHORITY_REVOKED");
    const business = businessRecordDecision(store, { principal, scope: job.scope, operation: "send", authorityMode: job.authorityMode, sourceRecordRef: job.scope.recordId, sourceEvent: job.authoritySourceEvent });
    if (!businessRecordAllows(business)) return blockDispatch(store, job, message, "BUSINESS_RECORD_AUTHORITY_REVOKED");
  } else if (!explicitNonUserAuthorityAllowed(store, job.authorityMode, { scope: job.scope, sourceEvent: job.authoritySourceEvent, sourceRecordRef: job.scope.recordId })) {
    return blockDispatch(store, job, message, "AUTHORITY_CONTEXT_REVOKED");
  }

  const usage = store.reserveDispatchUsage({ scope: job.scope, accountId: account.id, channel: message.channel, policy, at: now });
  if (!usage.ok) return blockDispatch(store, job, message, usage.reason);

  const attempt = job.attempts + 1;
  try {
    // This is the final provider boundary.  The destination is resolved from
    // the current authoritative contact-channel row, never from a label.
    const response = await provider.sendText({ accountId: account.id, recipient: recipient.channel.normalizedAddress, body: message.body || "", idempotencyKey: job.idempotencyKey });
    const nextJob = Object.freeze({ ...job, state: response.state, attempts: attempt, failureCode: null });
    store.jobs.set(job.id, nextJob);
    store.messages.set(message.id, Object.freeze({ ...message, state: response.state, providerMessageId: response.providerMessageId, sentAt: nowIso(now) }));
    const event: CommunicationDeliveryEventRecord = Object.freeze({ id: id("delivery"), jobId: job.id, state: "SUBMITTED", providerEventId: response.providerMessageId, occurredAt: nowIso(now), testMode: response.testMode });
    store.deliveryEvents.set(event.id, event);
    const outbox = [...store.outbox.values()].find((item) => item.jobId === job.id);
    if (outbox) store.outbox.set(outbox.id, Object.freeze({ ...outbox, state: "COMPLETED" as const }));
    return { state: response.state, providerMessageId: response.providerMessageId, testMode: response.testMode };
  } catch (error) {
    const expired = job.expiresAt ? new Date(job.expiresAt).getTime() <= now.getTime() : false;
    const exhausted = attempt >= 5;
    const uncertain = /timeout|network|unknown/i.test(error instanceof Error ? error.message : String(error));
    const state: DeliveryState = expired ? "EXPIRED" : uncertain ? "UNCERTAIN" : exhausted ? "FAILED" : "QUEUED";
    const nextJob = Object.freeze({ ...job, state, attempts: attempt, failureCode: error instanceof Error ? error.message.slice(0, 120) : "PROVIDER_FAILURE", nextAttemptAt: state === "QUEUED" ? new Date(now.getTime() + retryDelay(attempt)).toISOString() : null, deadLetteredAt: exhausted ? nowIso(now) : null });
    store.jobs.set(job.id, nextJob);
    if (exhausted) store.deadLetters.set(job.id, { jobId: job.id, reason: nextJob.failureCode || "PROVIDER_FAILURE", at: nowIso(now) });
    return { state, attempts: attempt, deadLettered: exhausted, uncertain };
  }
}

export interface AICommunicationProvider {
  generate(input: { operation: CommunicationAiGenerationRecord["operation"]; instruction: string; context: Readonly<Record<string, unknown>>; language: string; tone: string }): Promise<{ text: string; provider: "MOCK" | "REAL"; requiresReview: boolean }>;
  refine(input: { text: string; instruction: string; context: Readonly<Record<string, unknown>>; language: string }): Promise<{ text: string; provider: "MOCK" | "REAL"; requiresReview: boolean }>;
  translate(input: { text: string; language: string; context: Readonly<Record<string, unknown>> }): Promise<{ text: string; provider: "MOCK" | "REAL"; requiresReview: boolean }>;
  summarizeConversation(input: { messages: readonly string[]; context: Readonly<Record<string, unknown>> }): Promise<{ text: string; provider: "MOCK" | "REAL"; requiresReview: boolean }>;
}

export class MockAICommunicationProvider implements AICommunicationProvider {
  readonly provider = "MOCK" as const;
  async generate(input: { operation: CommunicationAiGenerationRecord["operation"]; instruction: string; context: Readonly<Record<string, unknown>>; language: string; tone: string }) {
    void input;
    return { text: "[TEST AI DRAFT] Review wording and verify every source fact before approval.", provider: "MOCK" as const, requiresReview: true };
  }
  async refine(input: { text: string; instruction: string; context: Readonly<Record<string, unknown>>; language: string }) {
    return { text: `[TEST AI REFINED] ${input.text}`, provider: "MOCK" as const, requiresReview: true };
  }
  async translate(input: { text: string; language: string; context: Readonly<Record<string, unknown>> }) {
    return { text: `[TEST ${input.language}] ${input.text}`, provider: "MOCK" as const, requiresReview: true };
  }
  async summarizeConversation(input: { messages: readonly string[]; context: Readonly<Record<string, unknown>> }) {
    return { text: `[TEST SUMMARY] ${input.messages.length} authorized message(s); review before use.`, provider: "MOCK" as const, requiresReview: true };
  }
}

export async function recordAiGeneration(store: InMemoryCommunicationsStore, input: { principal: CommunicationsPrincipal; scope: CommunicationScope; operation: CommunicationAiGenerationRecord["operation"]; context: Record<string, unknown>; sourceRefs: readonly string[]; policy: CommunicationPolicyRecord }) : Promise<CommunicationResult<CommunicationAiGenerationRecord>> {
  const business = businessRecordDecision(store, { principal: input.principal, scope: input.scope, operation: "view", sourceRecordRef: input.sourceRefs[0] || input.scope.recordId });
  const access = authorizeCommunicationAccess({ principal: input.principal, permission: "communications.ai.generate", businessRecordPermission: businessRecordAllows(business), scope: input.scope });
  if (!access.allowed) return { ok: false, code: access.reason, reason: access.reason };
  if (!input.policy.aiEnabled || !input.policy.allowedAiOperations.includes(input.operation)) return { ok: false, code: "AI_DISABLED", reason: "AI generation is disabled by policy." };
  const sanitized = sanitizeAiContext(input.context);
  const generation: CommunicationAiGenerationRecord = Object.freeze({ id: id("ai"), scope: input.scope, actorId: input.principal.id, operation: input.operation, sourceRefs: [...input.sourceRefs], policyRevision: input.policy.revision, providerProfile: "not-configured", status: "REQUESTED", outputHash: await sha256(stable(sanitized)), acceptedMessageId: null, createdAt: store.time() });
  store.aiGenerations.set(generation.id, generation);
  store.audit({ scope: input.scope, actorId: input.principal.id, kind: "ai_generation_requested", correlationId: id("correlation"), sourceRecordRef: input.sourceRefs[0] || null, safeMetadata: { generationId: generation.id, operation: input.operation, sourceCount: input.sourceRefs.length } });
  return { ok: true, value: generation };
}

export async function signTestWebhookPayload(rawBody: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return `sha256=${Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function verifyTestWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = await signTestWebhookPayload(rawBody, secret);
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return difference === 0;
}

function safeProviderPayload(input: Record<string, unknown>) {
  const denied = /token|secret|password|otp|challenge|cookie/i;
  return Object.fromEntries(Object.entries(input).filter(([key]) => !denied.test(key)).slice(0, 40));
}

export async function ingestTestWebhook(store: InMemoryCommunicationsStore, input: { organizationId: string; rawBody: string; signature: string; testSecret: string; providerEventId: string; providerAccountId?: string | null }) : Promise<CommunicationResult<CommunicationProviderEventRecord>> {
  if (!(await verifyTestWebhookSignature(input.rawBody, input.signature, input.testSecret))) return { ok: false, code: "INVALID_SIGNATURE", reason: "Webhook signature rejected." };
  const mapping = input.providerAccountId ? store.providerAccountMappings.get(providerMappingKey("meta_whatsapp_test", input.providerAccountId)) : null;
  if (!mapping || !mapping.allowedInbound) return { ok: false, code: "UNKNOWN_PROVIDER_ACCOUNT", reason: "Provider account is not mapped to an authoritative communication domain." };
  const dedupeKey = `${mapping.organizationId}:meta-test:${mapping.providerAccountId}:${input.providerEventId}`;
  const duplicate = store.providerEvents.get(dedupeKey);
  if (duplicate) return { ok: true, value: duplicate };
  let payload: Record<string, unknown>;
  try { const parsed: unknown = JSON.parse(input.rawBody); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object"); payload = parsed as Record<string, unknown>; } catch { return { ok: false, code: "MALFORMED_PAYLOAD", reason: "Webhook body is not a JSON object." }; }
  const eventType = typeof payload.type === "string" ? payload.type : "unknown";
  const normalizedState = eventType === "message" ? "INBOUND_MESSAGE" : eventType === "delivered" ? "DELIVERED" : eventType === "read" ? "READ" : eventType === "failed" ? "FAILED" : eventType === "sent" ? "SENT" : "UNKNOWN";
  const mappedScope = { organizationId: mapping.organizationId, farmId: mapping.farmId };
  const record: CommunicationProviderEventRecord = Object.freeze({ id: id("provider-event"), scope: mappedScope, provider: "meta_whatsapp_test", providerAccountId: mapping.providerAccountId, providerEventId: input.providerEventId, eventType, normalizedState, safePayload: safeProviderPayload(payload), processedAt: null });
  store.providerEvents.set(dedupeKey, record);
  if (normalizedState === "INBOUND_MESSAGE" && typeof payload.text === "string") {
    const sender = typeof payload.sender === "string" ? normalizeInternationalNumber(payload.sender) : null;
    if (sender) {
      let contact = [...store.contacts.values()].find((candidate) => candidate.scope.organizationId === mapping.organizationId && candidate.scope.farmId === mapping.farmId && [...store.contactChannels.values()].some((channel) => channel.contactId === candidate.id && channel.channel === mapping.channel && channel.normalizedAddress === sender && channel.active));
      if (!contact) {
        contact = createContact(store, { id: id("contact"), scope: mappedScope, kind: "external_contact", sourceRecordRef: null, displayName: "External WhatsApp Contact", active: true, channelIds: [] });
        addContactChannel(store, { id: id("contact-channel"), contactId: contact.id, channel: "whatsapp", normalizedAddress: sender, verified: false, purpose: "support", consentState: "unknown", language: null, source: "provider", active: true, lastVerifiedAt: null, revision: 1 });
      }
      let conversation = [...store.conversations.values()].find((candidate) => candidate.scope.organizationId === mapping.organizationId && candidate.scope.farmId === mapping.farmId && candidate.externalContactId === contact!.id && candidate.accountId === mapping.accountId && candidate.channel === mapping.channel);
      if (!conversation) {
        conversation = { id: id("conversation"), scope: mappedScope, channel: mapping.channel, accountId: mapping.accountId, externalContactId: contact.id, participantIds: [contact.id], businessRecordRef: null, classification: mapping.classification, queue: mapping.queue, assignedUserId: null, assignedTeam: mapping.privacyMode === "general" ? null : "hr", status: "open", priority: mapping.privacyMode === "general" ? "normal" : "high", tags: ["inbound", mapping.privacyMode === "general" ? "general" : "private"], createdAt: store.time(), updatedAt: store.time(), lastActivityAt: store.time(), retentionState: "active" };
        store.conversations.set(conversation.id, Object.freeze(conversation));
      }
      const inbound: CommunicationMessageRecord = Object.freeze({ id: id("message"), scope: conversation.scope, conversationId: conversation.id, direction: "inbound", channel: "whatsapp", senderRef: sender, recipientRef: mapping.providerAccountId, body: payload.text.slice(0, 10000), contentType: "text", state: "SENT", source: "external_message", templateVersionId: null, aiGenerationId: null, replyToId: null, providerMessageId: input.providerEventId, failureCode: null, createdAt: store.time(), sentAt: store.time(), deliveredAt: null, readAt: null, visibleToGeneralAgents: mapping.privacyMode === "general" && !["HR", "HR_SENSITIVE", "RECRUITMENT"].includes(mapping.classification) });
      store.messages.set(inbound.id, inbound);
    }
  }
  store.audit({ scope: record.scope, actorId: "provider-ingress", kind: "provider_event_received", correlationId: id("correlation"), sourceRecordRef: null, safeMetadata: { eventType, normalizedState, providerEventId: input.providerEventId } });
  return { ok: true, value: record };
}

export interface ChallengeVerificationKeyProvider {
  getKey(): string | null;
}

export class ProductionChallengeVerificationKeyProvider implements ChallengeVerificationKeyProvider {
  private readonly secret: string | null;

  constructor(secret: string | null | undefined = null) {
    this.secret = typeof secret === "string" && secret.trim() ? secret : null;
  }

  getKey() {
    return this.secret;
  }
}

export class SyntheticTestChallengeVerificationKeyProvider implements ChallengeVerificationKeyProvider {
  private readonly secret: string;

  constructor(secret = "TEST ONLY — NOT A PRODUCTION SECRET") {
    this.secret = secret;
  }

  getKey() {
    return this.secret;
  }
}

export type ChallengeVerificationInput = Readonly<{
  challengeId: string;
  transactionId: string;
  accountId: string;
  contactId: string;
  purpose: AuthWhatsappChallengeRecord["purpose"];
  code: string;
}>;

export interface ChallengeVerifier {
  compute(input: ChallengeVerificationInput): Promise<string | null>;
}

export class HmacSha256ChallengeVerifier implements ChallengeVerifier {
  private readonly keyProvider: ChallengeVerificationKeyProvider;

  constructor(keyProvider: ChallengeVerificationKeyProvider) {
    this.keyProvider = keyProvider;
  }

  async compute(input: ChallengeVerificationInput) {
    const secret = this.keyProvider.getKey();
    if (!secret) return null;
    const context = ["daenem-farms", "v77", "whatsapp-challenge", input.challengeId, input.transactionId, input.accountId, input.contactId, input.purpose, input.code].join("\u001f");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(context));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}

function safeMacEqual(left: string | null, right: string | null) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export interface ChallengeCodeGenerator {
  generate(): string;
}

export class ProductionSecureChallengeGenerator implements ChallengeCodeGenerator {
  generate() {
    const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
    const values = new Uint32Array(1);
    do crypto.getRandomValues(values); while (values[0] >= limit);
    return String(values[0] % 1_000_000).padStart(6, "0");
  }
}

/** Test-only generator. It is deliberately not used by the production default. */
export class DeterministicTestChallengeGenerator implements ChallengeCodeGenerator {
  private readonly values: readonly string[];
  private index = 0;

  constructor(values: string | readonly string[]) {
    this.values = (typeof values === "string" ? [values] : [...values]).map((value) => {
      if (!/^\d{6,8}$/.test(value)) throw new Error("INVALID_DETERMINISTIC_CHALLENGE");
      return value;
    });
    if (!this.values.length) throw new Error("DETERMINISTIC_CHALLENGE_REQUIRED");
  }

  generate() {
    const value = this.values[Math.min(this.index++, this.values.length - 1)];
    return value;
  }
}

function challengeRateKey(input: { scope: CommunicationScope; accountId: string; contactId: string; purpose: AuthWhatsappChallengeRecord["purpose"] }) {
  return `${input.scope.organizationId}:${input.accountId}:${input.contactId}:${input.purpose}`;
}

function challengeContextMatches(challenge: AuthWhatsappChallengeRecord, input: { transactionId?: string; accountId?: string; contactId?: string; purpose?: AuthWhatsappChallengeRecord["purpose"] }) {
  return Boolean(input.transactionId && input.accountId && input.contactId && input.purpose && challenge.transactionId === input.transactionId && challenge.accountId === input.accountId && challenge.contactId === input.contactId && challenge.purpose === input.purpose);
}

export async function createWhatsappChallenge(store: InMemoryCommunicationsStore, input: { principal: CommunicationsPrincipal | null; scope: CommunicationScope; accountId: string; contactId: string; purpose: AuthWhatsappChallengeRecord["purpose"]; transactionId: string; codeGenerator?: ChallengeCodeGenerator; expiresInSeconds?: number; challengeValue?: string }) : Promise<CommunicationResult<{ challenge: AuthWhatsappChallengeRecord; deliveryJobId: string }>> {
  if (Object.prototype.hasOwnProperty.call(input, "challengeValue")) return { ok: false, code: "CLIENT_CHOSEN_CHALLENGE_REJECTED", reason: "The verification code is generated only by the service." };
  if (!input.principal?.id) return { ok: false, code: "AUTHENTICATION_REQUIRED", reason: "The existing authentication boundary must authorize this request." };
  if (!input.transactionId?.trim()) return { ok: false, code: "TRANSACTION_BINDING_REQUIRED", reason: "An authentication transaction is required." };
  const permission = input.purpose === "SIGNIN_STEP_UP" ? AUTH_SIGNIN_STEP_UP_PERMISSION : "communications.initiate";
  const business = businessRecordDecision(store, { principal: input.principal, scope: input.scope, operation: "view", authorityMode: "AUTHENTICATION" });
  const access = authorizeCommunicationAccess({ principal: input.principal, permission, businessRecordPermission: businessRecordAllows(business), scope: input.scope, channel: "whatsapp" });
  if (!access.allowed) return { ok: false, code: access.reason, reason: access.reason };
  const account = store.accounts.get(input.accountId);
  const contact = store.contacts.get(input.contactId);
  const authChannel = [...store.contactChannels.values()].find((candidate) => candidate.contactId === input.contactId && candidate.channel === "whatsapp" && candidate.purpose === "authentication" && candidate.active);
  if (!account || account.channel !== "whatsapp" || account.scope.organizationId !== input.scope.organizationId || !account.enabled || account.providerState !== "TEST_MODE") return { ok: false, code: "PROVIDER_ACCOUNT_UNAVAILABLE", reason: "The authentication provider account is unavailable." };
  if (!contact || !contact.active || contact.scope.organizationId !== input.scope.organizationId || !authChannel) return { ok: false, code: "AUTHENTICATION_CONTACT_UNAVAILABLE", reason: "The authentication contact channel is unavailable." };
  if (input.purpose === "SIGNIN_STEP_UP" && !authChannel.verified) return { ok: false, code: "AUTHENTICATION_CONTACT_UNVERIFIED", reason: "The authentication contact is not verified." };
  const at = store.clock();
  const atIso = at.toISOString();
  const key = challengeRateKey(input);
  const currentRate = store.challengeRate.get(key);
  if (currentRate && at.getTime() - new Date(currentRate.windowStartedAt).getTime() >= CHALLENGE_RATE_WINDOW_MS) {
    store.challengeRate.delete(key);
  }
  const rate = store.challengeRate.get(key);
  if (rate && rate.requestCount >= CHALLENGE_MAX_REQUESTS_PER_WINDOW) return { ok: false, code: "RATE_LIMIT", reason: "Challenge request rate limit reached." };
  const active = [...store.challenges.values()].find((challenge) => challenge.scope.organizationId === input.scope.organizationId && challenge.accountId === input.accountId && challenge.contactId === input.contactId && challenge.purpose === input.purpose && challenge.transactionId === input.transactionId && !challenge.consumedAt && !challenge.invalidatedAt && new Date(challenge.expiresAt).getTime() > at.getTime());
  if (active) {
    if (at.getTime() < new Date(active.nextResendAt).getTime()) return { ok: false, code: "RESEND_COOLDOWN", reason: "Challenge resend cooldown is active." };
    if (active.resendCount >= CHALLENGE_MAX_RESENDS) return { ok: false, code: "RESEND_LIMIT", reason: "Challenge resend limit reached." };
    store.challenges.set(active.id, Object.freeze({ ...active, invalidatedAt: atIso }));
  } else if (rate && at.getTime() - new Date(rate.lastIssuedAt).getTime() < CHALLENGE_REQUEST_COOLDOWN_MS) {
    return { ok: false, code: "REQUEST_COOLDOWN", reason: "Challenge request cooldown is active." };
  }
  const generator = input.codeGenerator || new ProductionSecureChallengeGenerator();
  const generatedCode = generator.generate();
  if (!/^\d{6,8}$/.test(generatedCode)) return { ok: false, code: "INVALID_GENERATED_CHALLENGE", reason: "The service challenge generator returned an invalid code." };
  const challengeId = id("challenge");
  const valueSalt = id("challenge-salt");
  const valueMac = await store.challengeVerifier.compute({ challengeId, transactionId: input.transactionId, accountId: input.accountId, contactId: input.contactId, purpose: input.purpose, code: generatedCode });
  if (!valueMac) return { ok: false, code: "OTP_VERIFICATION_KEY_NOT_CONFIGURED", reason: "OTP verification key binding is not configured." };
  // valueHash is retained only as the legacy storage property; it now holds
  // the keyed MAC as a compatibility projection, never a plain salted hash.
  const valueHash = valueMac;
  const resendCount = active ? active.resendCount + 1 : 0;
  const expiresInSeconds = Math.max(60, Math.min(600, input.expiresInSeconds || CHALLENGE_EXPIRY_SECONDS));
  const deliveryJobId = id("auth-delivery");
  const withJob: AuthWhatsappChallengeRecord = Object.freeze({ id: challengeId, scope: input.scope, accountId: input.accountId, contactId: input.contactId, purpose: input.purpose, valueHash, valueMac, expiresAt: new Date(at.getTime() + expiresInSeconds * 1000).toISOString(), attemptCount: 0, resendCount, consumedAt: null, invalidatedAt: null, deliveryJobId, rateBucket: `challenge:${key}`, transactionId: input.transactionId, valueSalt, createdAt: atIso, nextResendAt: new Date(at.getTime() + CHALLENGE_RESEND_COOLDOWN_MS).toISOString() });
  store.challenges.set(challengeId, withJob);
  store.challengeRate.set(key, { windowStartedAt: rate?.windowStartedAt || atIso, requestCount: (rate?.requestCount || 0) + 1, lastIssuedAt: atIso });
  const outbox: CommunicationOutboxRecord = Object.freeze({ id: id("outbox"), scope: input.scope, jobId: deliveryJobId, eventType: "auth.whatsapp.challenge", state: "READY", idempotencyKey: `challenge:${challengeId}`, correlationId: id("correlation"), availableAt: atIso, claimedAt: null });
  store.outbox.set(outbox.id, outbox);
  store.audit({ scope: input.scope, actorId: input.principal.id, kind: "auth_challenge_requested", correlationId: outbox.correlationId, sourceRecordRef: null, safeMetadata: { challengeId, purpose: input.purpose, delivery: "TEST_MODE_NOT_SENT" } });
  return { ok: true, value: { challenge: withJob, deliveryJobId } };
}

export async function verifyWhatsappChallenge(store: InMemoryCommunicationsStore, input: { challengeId: string; challengeValue: string; transactionId?: string; accountId?: string; contactId?: string; purpose?: AuthWhatsappChallengeRecord["purpose"] }, now = new Date()) : Promise<CommunicationResult<{ verified: true; challengeId: string; sessionIssued: false }>> {
  const challenge = store.challenges.get(input.challengeId);
  if (!challenge) return { ok: false, code: "CHALLENGE_NOT_FOUND", reason: "Challenge is not available." };
  if (!challengeContextMatches(challenge, input)) return { ok: false, code: "CHALLENGE_CONTEXT_MISMATCH", reason: "Challenge context does not match the authentication transaction." };
  if (challenge.consumedAt || challenge.invalidatedAt) return { ok: false, code: "CHALLENGE_ALREADY_USED", reason: "Challenge is no longer usable." };
  if (new Date(challenge.expiresAt).getTime() <= now.getTime()) {
    store.challenges.set(input.challengeId, Object.freeze({ ...challenge, invalidatedAt: nowIso(now) }));
    return { ok: false, code: "CHALLENGE_EXPIRED", reason: "Challenge has expired." };
  }
  if (challenge.attemptCount >= CHALLENGE_MAX_ATTEMPTS) return { ok: false, code: "ATTEMPT_LIMIT", reason: "Challenge attempt limit reached." };
  if (store.challengeLocks.has(input.challengeId)) return { ok: false, code: "CONCURRENT_CONSUME", reason: "Challenge verification is already in progress." };
  store.challengeLocks.add(input.challengeId);
  try {
    const current = store.challenges.get(input.challengeId);
    if (!current || current.consumedAt || current.invalidatedAt) return { ok: false, code: "CHALLENGE_ALREADY_USED", reason: "Challenge is no longer usable." };
    if (!current.valueMac) return { ok: false, code: "LEGACY_CHALLENGE_UNSUPPORTED", reason: "Challenge requires a keyed verification record." };
    const candidateMac = await store.challengeVerifier.compute({ challengeId: current.id, transactionId: current.transactionId, accountId: current.accountId, contactId: current.contactId, purpose: current.purpose, code: input.challengeValue });
    if (!candidateMac) return { ok: false, code: "OTP_VERIFICATION_KEY_NOT_CONFIGURED", reason: "OTP verification key binding is not configured." };
    const matches = safeMacEqual(candidateMac, current.valueMac);
    const attempts = current.attemptCount + 1;
    if (!matches) {
      store.challenges.set(input.challengeId, Object.freeze({ ...current, attemptCount: attempts, invalidatedAt: attempts >= CHALLENGE_MAX_ATTEMPTS ? nowIso(now) : null }));
      return { ok: false, code: attempts >= CHALLENGE_MAX_ATTEMPTS ? "ATTEMPT_LIMIT" : "INVALID_CHALLENGE", reason: "Challenge did not verify." };
    }
    const consumed = Object.freeze({ ...current, attemptCount: attempts, consumedAt: nowIso(now) });
    store.challenges.set(input.challengeId, consumed);
    // Deliberately no session is issued here. The existing authentication and
    // V72 principal boundary must perform lifecycle/scope revalidation.
    return { ok: true, value: { verified: true, challengeId: input.challengeId, sessionIssued: false } };
  } finally {
    store.challengeLocks.delete(input.challengeId);
  }
}

export function providerStateForUi() {
  return Object.freeze({ whatsapp: REAL_PROVIDER_STATUS, email: "INTEGRATION REQUIRED", sms: "NOT CONFIGURED", ai: "NOT CONFIGURED", webhook: "TEST MODE · PRODUCTION SECRET NOT CONFIGURED", cost: "COST DATA UNAVAILABLE" });
}

export const API_CONTRACTS = Object.freeze({
  conversations: ["GET /api/portal/communications/conversations", "POST /api/portal/communications/conversations"],
  messages: ["GET /api/portal/communications/conversations/:id/messages", "POST /api/portal/communications/conversations/:id/messages"],
  templates: ["GET /api/portal/communications/templates", "POST /api/portal/communications/templates"],
  approvals: ["POST /api/portal/communications/approvals", "POST /api/portal/communications/approvals/:id/decision"],
  preferences: ["GET /api/portal/communications/preferences", "POST /api/portal/communications/preferences"],
  jobs: ["GET /api/portal/communications/jobs/:id"],
  audit: ["GET /api/portal/communications/audit"],
  settings: ["GET /api/portal/communications/settings"],
  whatsappRequest: ["POST /api/portal/auth/whatsapp/request"],
  whatsappVerify: ["POST /api/portal/auth/whatsapp/verify"],
  webhook: ["GET /webhooks/meta/whatsapp", "POST /webhooks/meta/whatsapp"],
} as const);
