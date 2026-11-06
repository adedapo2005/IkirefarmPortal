import {
  acknowledgeAlert,
  createAlert,
  eventFingerprint,
  matchAlertRule,
  mergeRecurringAlert,
  planNotifications,
  resolveAlert,
  type AlertAuditEvent,
  type AlertNotification,
  type AlertRule,
  type SiteAlert,
  type SiteEvent,
} from "./site-alerting";

export type AlertingSnapshot = Readonly<{
  alerts: readonly SiteAlert[];
  notifications: readonly AlertNotification[];
  audit: readonly AlertAuditEvent[];
}>;

export class InMemoryAlertingStore {
  private alerts = new Map<string, SiteAlert>();
  private notifications = new Map<string, AlertNotification>();
  private audit: AlertAuditEvent[] = [];

  findByFingerprint(fingerprint: string) {
    return [...this.alerts.values()].find((alert) => alert.fingerprint === fingerprint && alert.state !== "resolved");
  }
  saveAlert(alert: SiteAlert) { this.alerts.set(alert.id, alert); return alert; }
  saveNotification(notification: AlertNotification) { this.notifications.set(notification.id, notification); return notification; }
  addAudit(event: AlertAuditEvent) { this.audit.push(Object.freeze(event)); return event; }
  getAlert(id: string) { return this.alerts.get(id); }
  snapshot(): AlertingSnapshot { return Object.freeze({ alerts: Object.freeze([...this.alerts.values()]), notifications: Object.freeze([...this.notifications.values()]), audit: Object.freeze([...this.audit]) }); }
}

function auditId(alertId: string, kind: AlertAuditEvent["kind"], index: number) {
  return `AUD-${alertId}-${kind}-${index}`;
}

export function processSiteEvent(store: InMemoryAlertingStore, event: SiteEvent, rules: readonly AlertRule[], now = event.occurredAt) {
  const matched = rules.filter((rule) => matchAlertRule(event, rule));
  const produced: SiteAlert[] = [];
  for (const rule of matched) {
    const fingerprint = eventFingerprint(event, rule);
    const previous = store.findByFingerprint(fingerprint);
    const candidate = createAlert(event, rule, now);
    const alert = previous ? mergeRecurringAlert(previous, candidate) : candidate;
    store.saveAlert(alert);
    const index = store.snapshot().audit.length + 1;
    store.addAudit({ id: auditId(alert.id, previous ? "deduplicated" : "created", index), alertId: alert.id, kind: previous ? "deduplicated" : "created", actorId: "system", at: now, summary: previous ? `Recurring event grouped; occurrence ${alert.occurrenceCount}.` : `Alert created from ${event.kind}.` });
    if (!previous) {
      for (const notification of planNotifications(alert, rule, now)) {
        store.saveNotification(notification);
        const auditIndex = store.snapshot().audit.length + 1;
        store.addAudit({ id: auditId(alert.id, "notification_planned", auditIndex), alertId: alert.id, kind: "notification_planned", actorId: "system", at: now, summary: `Planned ${notification.channel} delivery; provider dispatch remains separate.` });
      }
    }
    produced.push(alert);
  }
  return Object.freeze(produced);
}

export function acknowledgeStoredAlert(store: InMemoryAlertingStore, alertId: string, actorId: string, at: string) {
  const current = store.getAlert(alertId);
  if (!current) return null;
  const next = acknowledgeAlert(current, at);
  store.saveAlert(next);
  store.addAudit({ id: auditId(alertId, "acknowledged", store.snapshot().audit.length + 1), alertId, kind: "acknowledged", actorId, at, summary: "Alert acknowledged." });
  return next;
}

export function resolveStoredAlert(store: InMemoryAlertingStore, alertId: string, actorId: string, at: string) {
  const current = store.getAlert(alertId);
  if (!current) return null;
  const next = resolveAlert(current, at);
  store.saveAlert(next);
  store.addAudit({ id: auditId(alertId, "resolved", store.snapshot().audit.length + 1), alertId, kind: "resolved", actorId, at, summary: "Alert resolved." });
  return next;
}