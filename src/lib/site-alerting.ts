import type { Persona } from "./portal-model";

export const ALERT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export const ALERT_CHANNELS = ["whatsapp", "email", "in_app", "popup"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];
export const ALERT_STATES = ["open", "acknowledged", "actioned", "resolved", "suppressed"] as const;
export type AlertState = (typeof ALERT_STATES)[number];

export type SiteEvent = Readonly<{
  id: string;
  kind: string;
  sourceModule: string;
  sourceRecordId?: string;
  sourceRoute?: string;
  occurredAt: string;
  summary: string;
  details?: Readonly<Record<string, unknown>>;
  requiredPermission?: string;
  dedupeKey?: string;
}>;

export type AlertRecipient = Readonly<{
  kind: "user" | "role" | "department" | "group" | "all_authorized";
  id: string;
}>;

export type AlertRule = Readonly<{
  id: string;
  name: string;
  eventKind: string;
  severity: AlertSeverity;
  recipients: readonly AlertRecipient[];
  channels: readonly AlertChannel[];
  acknowledgementRequired: boolean;
  escalationAfterMinutes?: number;
  repeatAfterMinutes?: number;
  quietHours?: Readonly<{ start: string; end: string; timezone: string; criticalOverride: boolean }>;
  enabled: boolean;
  requiredPermission?: string;
}>;

export type SiteAlert = Readonly<{
  id: string;
  eventId: string;
  ruleId: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  sourceModule: string;
  sourceRecordId?: string;
  sourceRoute?: string;
  state: AlertState;
  acknowledgementRequired: boolean;
  requiredPermission?: string;
  fingerprint: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt?: string;
  actionedAt?: string;
  resolvedAt?: string;
}>;

export type AlertNotification = Readonly<{
  id: string;
  alertId: string;
  recipient: AlertRecipient;
  channel: AlertChannel;
  state: "planned" | "queued" | "sent" | "delivered" | "viewed" | "acknowledged" | "failed" | "suppressed";
  createdAt: string;
  deliveredAt?: string;
  viewedAt?: string;
  acknowledgedAt?: string;
  providerMessageId?: string;
}>;

export type AlertAuditEvent = Readonly<{
  id: string;
  alertId: string;
  kind: "created" | "deduplicated" | "notification_planned" | "sent" | "delivered" | "viewed" | "acknowledged" | "actioned" | "resolved" | "escalated" | "suppressed" | "rule_changed";
  actorId: string;
  at: string;
  summary: string;
}>;

export const ALERT_PERMISSIONS = {
  view: "alerts.view",
  rulesView: "alerts.rules.view",
  rulesManage: "alerts.rules.manage",
  sendAdminNotice: "alerts.admin_notice.send",
  acknowledge: "alerts.acknowledge",
  resolve: "alerts.resolve",
  auditView: "alerts.audit.view",
  deliveryView: "alerts.delivery.view",
} as const;

export function canSeeAlert(person: Persona, alert: Pick<SiteAlert, "requiredPermission">) {
  if (person.permissions.includes("*")) return true;
  if (!person.permissions.includes(ALERT_PERMISSIONS.view) && !person.permissions.includes("notifications.view")) return false;
  return !alert.requiredPermission || person.permissions.includes(alert.requiredPermission);
}

export function eventFingerprint(event: SiteEvent, rule: AlertRule) {
  return [rule.id, event.kind, event.sourceModule, event.sourceRecordId || "", event.dedupeKey || event.summary.trim().toLowerCase()].join("|");
}

export function matchAlertRule(event: SiteEvent, rule: AlertRule) {
  if (!rule.enabled) return false;
  if (rule.eventKind !== "*" && rule.eventKind !== event.kind) return false;
  if (rule.requiredPermission && event.requiredPermission && rule.requiredPermission !== event.requiredPermission) return false;
  return true;
}

export function createAlert(event: SiteEvent, rule: AlertRule, now = event.occurredAt): SiteAlert {
  return Object.freeze({
    id: `ALT-${event.id}-${rule.id}`,
    eventId: event.id,
    ruleId: rule.id,
    severity: rule.severity,
    title: rule.name,
    summary: event.summary,
    sourceModule: event.sourceModule,
    sourceRecordId: event.sourceRecordId,
    sourceRoute: event.sourceRoute,
    state: "open" as const,
    acknowledgementRequired: rule.acknowledgementRequired,
    requiredPermission: event.requiredPermission || rule.requiredPermission,
    fingerprint: eventFingerprint(event, rule),
    occurrenceCount: 1,
    firstSeenAt: now,
    lastSeenAt: now,
  });
}

export function mergeRecurringAlert(existing: SiteAlert, incoming: SiteAlert): SiteAlert {
  if (existing.fingerprint !== incoming.fingerprint) return incoming;
  return Object.freeze({ ...existing, occurrenceCount: existing.occurrenceCount + 1, lastSeenAt: incoming.lastSeenAt, summary: incoming.summary, state: existing.state === "resolved" ? "open" : existing.state });
}

function minutesSince(iso: string, now: string) {
  return Math.max(0, Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / 60000));
}

export function escalationDue(alert: SiteAlert, rule: AlertRule, now: string) {
  return Boolean(rule.escalationAfterMinutes && alert.state === "open" && alert.acknowledgementRequired && minutesSince(alert.lastSeenAt, now) >= rule.escalationAfterMinutes);
}

export function repeatDeliveryDue(alert: SiteAlert, rule: AlertRule, now: string) {
  return Boolean(rule.repeatAfterMinutes && alert.state === "open" && minutesSince(alert.lastSeenAt, now) >= rule.repeatAfterMinutes);
}

export function planNotifications(alert: SiteAlert, rule: AlertRule, now: string): readonly AlertNotification[] {
  return Object.freeze(rule.recipients.flatMap((recipient, recipientIndex) => rule.channels.map((channel, channelIndex) => Object.freeze({
    id: `NTF-${alert.id}-${recipientIndex + 1}-${channelIndex + 1}`,
    alertId: alert.id,
    recipient,
    channel,
    state: "planned" as const,
    createdAt: now,
  }))));
}

export function acknowledgeAlert(alert: SiteAlert, at: string): SiteAlert {
  if (alert.state === "resolved") return alert;
  return Object.freeze({ ...alert, state: "acknowledged" as const, acknowledgedAt: at });
}

export function resolveAlert(alert: SiteAlert, at: string): SiteAlert {
  return Object.freeze({ ...alert, state: "resolved" as const, resolvedAt: at });
}

export function severityRank(severity: AlertSeverity) {
  return ({ critical: 4, high: 3, medium: 2, low: 1 } as const)[severity];
}

export function sortAttention(alerts: readonly SiteAlert[]) {
  return [...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
}

export const DEFAULT_OWNER_ALERT_RULES: readonly AlertRule[] = Object.freeze([
  { id: "critical-owner", name: "Critical Owner Alert", eventKind: "*", severity: "critical", recipients: [{ kind: "role", id: "owner" }], channels: ["whatsapp", "email", "in_app", "popup"], acknowledgementRequired: true, escalationAfterMinutes: 15, repeatAfterMinutes: 15, quietHours: { start: "10:00 PM", end: "6:00 AM", timezone: "Africa/Lagos", criticalOverride: true }, enabled: true },
  { id: "high-owner", name: "High Priority Owner Alert", eventKind: "*", severity: "high", recipients: [{ kind: "role", id: "owner" }], channels: ["whatsapp", "in_app"], acknowledgementRequired: true, escalationAfterMinutes: 30, repeatAfterMinutes: 30, enabled: true },
  { id: "medium-admin", name: "Medium Priority Admin Alert", eventKind: "*", severity: "medium", recipients: [{ kind: "role", id: "admin" }], channels: ["email", "in_app"], acknowledgementRequired: false, repeatAfterMinutes: 120, enabled: true },
  { id: "low-center", name: "Low Priority Notification", eventKind: "*", severity: "low", recipients: [{ kind: "all_authorized", id: "authorized" }], channels: ["in_app"], acknowledgementRequired: false, enabled: true },
]);