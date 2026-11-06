import type { Persona } from "./portal-model";

/**
 * V73 communications is deliberately a typed application foundation.  These
 * contracts are local, fixture-safe models; none of the helpers below call a
 * provider or claim that a delivery occurred.
 */

export const COMMUNICATION_CHANNELS = ["whatsapp", "email", "sms"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const PROVIDER_STATES = [
  "not_configured",
  "integration_required",
  "credentials_required",
  "webhook_required",
  "template_submission_required",
  "ready",
] as const;
export type ProviderState = (typeof PROVIDER_STATES)[number];

export type ScopeKind = "organization" | "farm" | "module" | "use_case" | "role" | "user";
export type DeliveryState = "draft" | "pending_review" | "queued_simulated" | "blocked" | "failed" | "sent" | "delivered" | "read";
export type AiMode = "disabled" | "manual_only" | "ai_assisted" | "event_draft" | "approved_deterministic_automation";

export type CommunicationAccount = Readonly<{
  id: string;
  channel: CommunicationChannel;
  displayName: string;
  senderAddress: string;
  providerState: ProviderState;
  scope: Readonly<{ kind: ScopeKind; id: string }>;
  policyVersion: string;
}>;
export type CommunicationContact = Readonly<{
  id: string;
  displayName: string;
  kind: "customer" | "supplier" | "employee" | "applicant";
  sourceRecordId: string;
  phone?: string;
  email?: string;
  consent: "unknown" | "opted_in" | "opted_out";
}>;
export type CommunicationConversation = Readonly<{
  id: string;
  channel: CommunicationChannel;
  accountId: string;
  subject: string;
  participantIds: readonly string[];
  queue: string;
  assignedTo: string | null;
  status: "open" | "pending" | "closed";
  priority: "normal" | "high" | "urgent";
  tags: readonly string[];
  domain: "general" | "hr";
  sourceRecordId?: string;
}>;
export type CommunicationParticipant = Readonly<{
  id: string;
  conversationId: string;
  contactId?: string;
  personId?: string;
  role: "sender" | "recipient" | "watcher";
}>;
export type CommunicationMessage = Readonly<{
  id: string;
  conversationId: string;
  senderId: string;
  channel: CommunicationChannel | "internal_note";
  body: string;
  state: DeliveryState;
  source: "user_input" | "ai_generated" | "approved_template" | "external_message" | "internal_note";
  createdAt: string;
  attachmentIds: readonly string[];
}>;
export type CommunicationAttachment = Readonly<{
  id: string;
  name: string;
  mediaType: string;
  sizeBytes: number;
  access: "authorized" | "restricted" | "blocked";
}>;
export type CommunicationTemplate = Readonly<{
  id: string;
  name: string;
  channel: CommunicationChannel;
  status: "draft" | "approved" | "paused" | "retired";
  currentVersionId: string;
  approvalRequired: boolean;
  domain: "general" | "hr";
}>;
export type CommunicationTemplateVersion = Readonly<{
  id: string;
  templateId: string;
  version: number;
  body: string;
  language: string;
  lockedFacts: readonly string[];
  policyVersion: string;
  state: "draft" | "submitted" | "approved" | "rejected";
}>;
export type CommunicationJob = Readonly<{
  id: string;
  conversationId: string;
  channel: CommunicationChannel;
  state: DeliveryState;
  approvalId?: string;
  providerState: ProviderState;
  attempts: number;
  retryAt?: string;
}>;
export type CommunicationDeliveryEvent = Readonly<{
  id: string;
  jobId: string;
  state: "accepted_by_provider" | "delivered" | "read" | "failed";
  occurredAt: string;
  providerEventId?: string;
}>;
export type CommunicationTrigger = Readonly<{
  id: string;
  event: string;
  condition: string;
  recipientRule: string;
  channel: CommunicationChannel;
  templateId: string;
  delayMinutes: number;
  expiryMinutes: number;
  quietHours: Readonly<{ start: string; end: string }>;
  escalation: string | null;
  cancellationRule: string | null;
  mode: "draft_only" | "review_required" | "approved_deterministic_send";
}>;
export type CommunicationPolicy = Readonly<{
  id: string;
  scope: Readonly<{ kind: ScopeKind; id: string }>;
  channelAvailability: Readonly<Record<CommunicationChannel, boolean>>;
  aiMode: AiMode;
  allowedAiOperations: readonly string[];
  modelProfile: string | null;
  systemInstructions: string;
  tone: string;
  language: string;
  brandVoice: string;
  prohibitedClaims: readonly string[];
  maximumLength: number;
  approvalMode: "none" | "named_role" | "named_user" | "dual" | "hr_specific" | "sensitive";
  businessHours: Readonly<{ start: string; end: string; timezone: string }>;
  fallbackChannel: CommunicationChannel | null;
  budgetCentsPerDay: number;
  ratePerMinute: number;
  retentionDays: number;
  emergencyStop: boolean;
}>;
export type CommunicationPreference = Readonly<{
  contactId: string;
  channel: CommunicationChannel;
  optedOut: boolean;
  quietHours?: Readonly<{ start: string; end: string }>;
}>;
export type CommunicationConsent = Readonly<{
  contactId: string;
  channel: CommunicationChannel;
  state: "unknown" | "pending" | "granted" | "withdrawn";
  capturedAt?: string;
  source?: string;
}>;
export type CommunicationAssignment = Readonly<{
  conversationId: string;
  queue: string;
  assigneeId: string | null;
  assignedBy: string;
  assignedAt: string;
}>;
export type CommunicationNote = Readonly<{
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  private: true;
  createdAt: string;
}>;
export type CommunicationApproval = Readonly<{
  id: string;
  jobId: string;
  approverId: string;
  approverRole: string;
  fingerprint: string;
  state: "requested" | "approved" | "denied" | "invalidated";
  approvedAt?: string;
  policyVersion: string;
}>;
export type CommunicationAiGeneration = Readonly<{
  id: string;
  operation: string;
  mode: AiMode;
  sourceRefs: readonly string[];
  contextKinds: readonly ("user_instruction" | "policy_instruction" | "authorized_source_data" | "external_message" | "ai_output")[];
  output: string;
  requiresHumanReview: boolean;
}>;
export type CommunicationAuditEvent = Readonly<{
  id: string;
  kind: "draft_created" | "ai_generation_requested" | "ai_generation_produced" | "manual_edit" | "template_selected" | "approval_requested" | "approval_granted" | "approval_denied" | "approval_invalidated" | "job_queued" | "send_attempted" | "provider_response" | "delivery_update" | "assignment" | "routing" | "escalation" | "attachment_action" | "setting_changed" | "automation_changed" | "emergency_stop";
  actorId: string;
  conversationId?: string;
  sourceRecordId?: string;
  at: string;
  summary: string;
}>;
export type CommunicationUsageCost = Readonly<{
  accountId: string;
  period: string;
  messageCount: number;
  estimatedCostCents: number;
  providerReported: boolean;
}>;
export type AuthWhatsappChallenge = Readonly<{
  id: string;
  contactHint: string;
  purpose: "signup" | "signin";
  state: "not_started" | "provider_required" | "pending" | "verified" | "expired";
  expiresAt: string;
  otpValue: never;
}>;

export const COMMUNICATION_PERMISSIONS = {
  view: "communications.view",
  reply: "communications.reply",
  initiate: "communications.initiate",
  assign: "communications.assign",
  manage: "communications.manage",
  notes: "communications.notes",
  attachmentsView: "communications.attachments.view",
  attachmentsManage: "communications.attachments.manage",
  export: "communications.export",
  templatesView: "communications.templates.view",
  templatesCreate: "communications.templates.create",
  templatesEdit: "communications.templates.edit",
  templatesApprove: "communications.templates.approve",
  automationView: "communications.automation.view",
  automationManage: "communications.automation.manage",
  aiGenerate: "communications.ai.generate",
  aiRefine: "communications.ai.refine",
  aiApprove: "communications.ai.approve",
  send: "communications.send",
  settingsView: "communications.settings.view",
  settingsManage: "communications.settings.manage",
  auditView: "communications.audit.view",
  providerManage: "communications.provider.manage",
} as const;
export type CommunicationPermission = (typeof COMMUNICATION_PERMISSIONS)[keyof typeof COMMUNICATION_PERMISSIONS];
export const HR_COMMUNICATION_PERMISSIONS = ["hr.communications.view", "hr.recruitment.view", "hr.leave.view", "hr.training.view"] as const;

export const LOCKED_SOURCE_FACT_KEYS = [
  "employee_identity", "customer_identity", "order_status", "invoice_amount", "payment_state",
  "interview_datetime", "leave_decision", "role_assignment", "farm_assignment", "approval_result",
  "payroll_values", "disciplinary_decision",
] as const;

export type LockedFacts = Readonly<Record<string, string | number | boolean>>;
export type OutboundArtifact = Readonly<{
  recipient: string;
  sender: string;
  channel: CommunicationChannel;
  content: string;
  templateVersion: string | null;
  language: string;
  attachmentIds: readonly string[];
  linkIds: readonly string[];
  sourceEvent: string | null;
  policyVersion: string;
}>;

export function hasCommunicationPermission(person: Persona, permission: CommunicationPermission | string) {
  // The principal adapter has already expanded authenticated Owner `*` into
  // the verified catalog.  Review Owner fixtures retain the synthetic
  // wildcard, which is the only fixture shortcut allowed in the server-gated
  // review route.
  return person.permissions.includes("*") || person.permissions.includes(permission);
}

export function canUseHrCommunication(person: Persona) {
  return hasCommunicationPermission(person, COMMUNICATION_PERMISSIONS.view) &&
    HR_COMMUNICATION_PERMISSIONS.some((permission) => hasCommunicationPermission(person, permission));
}

export function canReply(person: Persona) {
  return hasCommunicationPermission(person, COMMUNICATION_PERMISSIONS.reply);
}

export function canSend(person: Persona, channel: CommunicationChannel) {
  void channel;
  return hasCommunicationPermission(person, COMMUNICATION_PERMISSIONS.send);
}

export function providerStateLabel(state: ProviderState) {
  return {
    not_configured: "NOT CONFIGURED",
    integration_required: "INTEGRATION REQUIRED",
    credentials_required: "CREDENTIALS REQUIRED",
    webhook_required: "WEBHOOK REQUIRED",
    template_submission_required: "TEMPLATE SUBMISSION REQUIRED",
    ready: "READY (UNVERIFIED IN THIS BUILD)",
  }[state];
}

export function lockFacts<T extends Record<string, string | number | boolean>>(facts: T): LockedFacts {
  return Object.freeze({ ...facts });
}

export function preserveLockedFacts(original: LockedFacts, proposed: Record<string, unknown>) {
  const next = { ...proposed };
  for (const key of LOCKED_SOURCE_FACT_KEYS) if (key in original) next[key] = original[key];
  return Object.freeze(next);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${stable(v)}`).join("|")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function approvalFingerprint(artifact: OutboundArtifact) {
  // A deterministic local fingerprint binds every material outbound field.
  // The future backend should replace this with a server-authenticated digest.
  return stable(artifact);
}

export function approvalStillValid(approval: CommunicationApproval | null | undefined, artifact: OutboundArtifact) {
  return Boolean(approval && approval.state === "approved" && approval.fingerprint === approvalFingerprint(artifact));
}

export type QueueDecision = Readonly<{ allowed: boolean; reason: string }>;
export function canQueueJob(args: {
  person: Persona;
  artifact: OutboundArtifact;
  providerState: ProviderState;
  template?: CommunicationTemplate | null;
  approval?: CommunicationApproval | null;
  aiGenerated?: boolean;
  automationMode?: CommunicationTrigger["mode"];
  approvalApproverAllowed?: boolean;
  preference?: CommunicationPreference;
  consent?: CommunicationConsent;
  usage?: CommunicationUsageCost;
  insideQuietHours?: boolean;
  policy: CommunicationPolicy;
  now?: Date;
}): QueueDecision {
  const { person, artifact, providerState, template, approval, aiGenerated, automationMode, approvalApproverAllowed, preference, consent, usage, insideQuietHours, policy } = args;
  if (!hasCommunicationPermission(person, COMMUNICATION_PERMISSIONS.send)) return { allowed: false, reason: "SEND_PERMISSION_REQUIRED" };
  if (policy.emergencyStop) return { allowed: false, reason: "EMERGENCY_STOP" };
  if (providerState !== "ready") return { allowed: false, reason: "PROVIDER_INTEGRATION_REQUIRED" };
  if (preference?.optedOut) return { allowed: false, reason: "RECIPIENT_OPTED_OUT" };
  if (consent && consent.state !== "granted") return { allowed: false, reason: "CONSENT_REQUIRED" };
  if (insideQuietHours) return { allowed: false, reason: "QUIET_HOURS" };
  if (usage && policy.budgetCentsPerDay > 0 && usage.estimatedCostCents >= policy.budgetCentsPerDay) return { allowed: false, reason: "BUDGET_STOP" };
  if (usage && policy.ratePerMinute > 0 && usage.messageCount >= policy.ratePerMinute) return { allowed: false, reason: "RATE_STOP" };
  if (template && ["paused", "retired"].includes(template.status)) return { allowed: false, reason: "TEMPLATE_NOT_SENDABLE" };
  if (automationMode === "approved_deterministic_send" && (!template || template.status !== "approved" || aiGenerated)) return { allowed: false, reason: "APPROVED_TEMPLATE_REQUIRED" };
  if (approval && approvalApproverAllowed === false) return { allowed: false, reason: "WRONG_APPROVER" };
  if (aiGenerated && !approvalStillValid(approval, artifact)) return { allowed: false, reason: "HUMAN_APPROVAL_REQUIRED" };
  if (approval && !approvalStillValid(approval, artifact)) return { allowed: false, reason: "APPROVAL_INVALIDATED" };
  if (artifact.channel === "whatsapp" && policy.channelAvailability.whatsapp !== true) return { allowed: false, reason: "CHANNEL_DISABLED" };
  return { allowed: true, reason: "SIMULATED_JOB_ALLOWED" };
}

export function aiOperationsForMode(mode: AiMode) {
  if (mode === "disabled") return [] as const;
  if (mode === "manual_only") return ["manual-draft"] as const;
  if (mode === "ai_assisted") return ["generate", "refine", "shorten", "expand", "rephrase", "personalize", "translate", "adjust-tone", "alternatives", "summarize", "suggest-reply", "create-template-draft"] as const;
  if (mode === "event_draft") return ["event-draft"] as const;
  return ["approved-template-populate"] as const;
}

const SENSITIVE_CONTEXT_KEYS = /password|session|secret|token|otp|payroll|bank|disciplin|private/i;
export function sanitizeAiContext(input: Record<string, unknown>) {
  return Object.freeze(Object.fromEntries(Object.entries(input).filter(([key]) => !SENSITIVE_CONTEXT_KEYS.test(key))));
}

export function containsOtpOrSecret(text: string) {
  return /\b(?:otp|one[- ]time|verification code|session token|password|secret)\b/i.test(text);
}

export function isHrRecordVisible(person: Persona) {
  return canUseHrCommunication(person);
}

export const v73PolicyFixture: CommunicationPolicy = Object.freeze({
  id: "policy-v73-fixture",
  scope: { kind: "organization" as const, id: "daenem-farms" },
  channelAvailability: { whatsapp: true, email: true, sms: false },
  aiMode: "ai_assisted",
  allowedAiOperations: [...aiOperationsForMode("ai_assisted")],
  modelProfile: null,
  systemInstructions: "Assist with wording only; preserve locked business facts.",
  tone: "clear and respectful",
  language: "en-NG",
  brandVoice: "Daenem Farms, naturally better",
  prohibitedClaims: ["guaranteed delivery", "unverified approval", "fabricated provider state"],
  maximumLength: 1000,
  approvalMode: "named_role",
  businessHours: { start: "08:00", end: "18:00", timezone: "Africa/Lagos" },
  fallbackChannel: "email",
  budgetCentsPerDay: 0,
  ratePerMinute: 0,
  retentionDays: 90,
  emergencyStop: false,
});

export const whatsappAccountFixture: CommunicationAccount = Object.freeze({
  id: "acct-whatsapp-v73",
  channel: "whatsapp",
  displayName: "Daenem Farms WhatsApp Business",
  senderAddress: "+234 ••• ••• ••••",
  providerState: "integration_required",
  scope: { kind: "organization" as const, id: "daenem-farms" },
  policyVersion: "policy-v73-fixture",
});

export const hrInterviewFixture = Object.freeze({
  sourceRecordId: "APP-V73-001",
  candidateName: "Synthetic Candidate",
  interviewAt: "2026-10-05 10:00 Africa/Lagos",
  recruiter: "Authorized HR fixture",
  lockedFacts: lockFacts({ employee_identity: "Synthetic Candidate", interview_datetime: "2026-10-05 10:00 Africa/Lagos" }),
  draft: "Hello Synthetic Candidate, your interview is scheduled for 2026-10-05 at 10:00 Africa/Lagos. Please reply if you need an approved reschedule.",
});
export const customerOrderFixture = Object.freeze({
  sourceRecordId: "ORDER-V73-001",
  customerName: "Synthetic Customer",
  orderStatus: "Ready for dispatch",
  orderNumber: "SO-V73-001",
  lockedFacts: lockFacts({ customer_identity: "Synthetic Customer", order_status: "Ready for dispatch" }),
  draft: "Hello Synthetic Customer, your order SO-V73-001 is ready for dispatch. Our team will share the next approved update.",
});
export const pausedTemplateFixture: CommunicationTemplate = Object.freeze({
  id: "tpl-v73-paused",
  name: "Paused Interview Reminder",
  channel: "whatsapp",
  status: "paused",
  currentVersionId: "tpl-v73-paused-v2",
  approvalRequired: true,
  domain: "hr",
});

export const communicationAuditKinds: CommunicationAuditEvent["kind"][] = [
  "draft_created", "ai_generation_requested", "ai_generation_produced", "manual_edit", "template_selected",
  "approval_requested", "approval_granted", "approval_denied", "approval_invalidated", "job_queued",
  "send_attempted", "provider_response", "delivery_update", "assignment", "routing", "escalation",
  "attachment_action", "setting_changed", "automation_changed", "emergency_stop",
];
