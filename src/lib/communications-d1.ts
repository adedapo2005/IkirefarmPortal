import type {
  BusinessRecordAccessResolver,
  CommunicationClassification,
  CommunicationConversationRecord,
  CommunicationOutboxRecord,
  CommunicationScope,
  CommunicationsPrincipal,
} from "./communications-backend.ts";
import { COMMUNICATION_CLASSIFICATIONS, CommunicationAuthorizationError, DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER, authorizeCommunicationAccess } from "./communications-backend.ts";

/**
 * D1 persistence adapter boundary.  It is intentionally not constructed by
 * the public Sign-In or Communications UI until the V75 migration is
 * explicitly applied in a later production-authorized phase.
 */
export type CommunicationD1Row = Readonly<Record<string, unknown>>;

export type CommunicationQueueEnvelope = Readonly<{
  jobId: string;
  organizationId: string;
  priority: "high_auth" | "transactional" | "hr" | "normal" | "bulk";
  idempotencyKey: string;
  correlationId: string;
}>;

export interface CommunicationQueueSender {
  send(envelope: CommunicationQueueEnvelope): Promise<{ accepted: boolean; testMode: boolean }>;
}

function safeBusinessDecision(resolver: BusinessRecordAccessResolver, input: Parameters<BusinessRecordAccessResolver["resolve"]>[0]) {
  try {
    return resolver.resolve(input);
  } catch {
    return { decision: "UNRESOLVED" as const, reason: "BUSINESS_RECORD_RESOLVER_ERROR" };
  }
}

const BUSINESS_AUTHORITY_CLASSIFICATIONS = new Set<CommunicationClassification>(["CUSTOMER", "SUPPLIER", "SECURITY"]);

function textValue(row: CommunicationD1Row, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function classificationValue(row: CommunicationD1Row) {
  const value = textValue(row, "classification");
  return value && (COMMUNICATION_CLASSIFICATIONS as readonly string[]).includes(value) ? value as CommunicationClassification : null;
}

function scopeFromRow(row: CommunicationD1Row, organizationKey = "organization_id", farmKey = "farm_id"): CommunicationScope | null {
  const organizationId = textValue(row, organizationKey);
  if (!organizationId) return null;
  return {
    organizationId,
    farmId: textValue(row, farmKey),
    recordType: textValue(row, "business_record_type"),
    recordId: textValue(row, "business_record_id"),
  };
}

function rowHasAuthorizedBusinessAccess(
  principal: CommunicationsPrincipal | null,
  requestedScope: CommunicationScope,
  row: CommunicationD1Row,
  resolver: BusinessRecordAccessResolver,
  operation: "view" | "read",
  organizationKey = "organization_id",
  farmKey = "farm_id",
) {
  const classification = classificationValue(row);
  const rowScope = scopeFromRow(row, organizationKey, farmKey);
  if (!classification || !rowScope) return false;
  if (rowScope.organizationId !== requestedScope.organizationId) return false;
  if (requestedScope.farmId && rowScope.farmId !== requestedScope.farmId) return false;
  const access = authorizeCommunicationAccess({ principal, permission: "communications.view", scope: rowScope, classification });
  if (!access.allowed) return false;
  const business = safeBusinessDecision(resolver, {
    principal,
    scope: rowScope,
    operation,
    authorityMode: "USER_AUTHORIZED",
    classification,
    sourceRecordRef: rowScope.recordId,
  });
  if (business.decision === "ALLOW") return true;
  if (business.decision !== "NOT_APPLICABLE") return false;
  // A classification that represents a domain record cannot be authorized
  // without an exact record reference. GENERAL and provider-routed HR rows
  // may be recordless, subject to their classification permission above.
  if (BUSINESS_AUTHORITY_CLASSIFICATIONS.has(classification)) return false;
  return classification === "GENERAL" || classification === "HR" || classification === "HR_SENSITIVE" || classification === "RECRUITMENT";
}

function visiblePage(rows: CommunicationD1Row[], limit: number, cursorKey: string) {
  const visible = rows.filter((row) => row !== null);
  const page = visible.slice(0, limit);
  return { rows: page, nextCursor: visible.length > limit ? textValue(page.at(-1) || {}, cursorKey) : null };
}

export class D1CommunicationsRepository {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async listConversations(principal: CommunicationsPrincipal | null, scope: CommunicationScope, cursor: string | null = null, limit = 50, resolver: BusinessRecordAccessResolver = DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER) {
    const access = authorizeCommunicationAccess({ principal, permission: "communications.view", scope });
    if (!access.allowed) throw new CommunicationAuthorizationError(access);
    const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const queryLimit = Math.min(400, boundedLimit * 4);
    const filtered: CommunicationD1Row[] = [];
    let queryCursor = cursor;
    const seenCursors = new Set<string>();
    let exhausted = false;
    while (!exhausted && filtered.length <= boundedLimit) {
      const result = await this.db.prepare(
        "SELECT id, organization_id, farm_id, payload, created_at, updated_at, last_activity_at, classification, channel, queue, status, priority, business_record_type, business_record_id FROM communication_conversations WHERE organization_id = ? AND (? IS NULL OR farm_id = ?) AND (? IS NULL OR last_activity_at < ?) ORDER BY last_activity_at DESC LIMIT ?",
      ).bind(scope.organizationId, scope.farmId || null, scope.farmId || null, queryCursor, queryCursor, queryLimit).all<CommunicationD1Row>();
      const batch = result.results || [];
      filtered.push(...batch.filter((row) => rowHasAuthorizedBusinessAccess(principal, scope, row, resolver, "view")));
      exhausted = batch.length < queryLimit;
      if (!exhausted) {
        const nextQueryCursor = textValue(batch.at(-1) || {}, "last_activity_at");
        if (!nextQueryCursor || nextQueryCursor === queryCursor || seenCursors.has(nextQueryCursor)) {
          exhausted = true;
        } else {
          seenCursors.add(nextQueryCursor);
          queryCursor = nextQueryCursor;
        }
      }
    }
    return visiblePage(filtered, boundedLimit, "last_activity_at");
  }

  async insertIntentAndOutbox(input: {
    scope: CommunicationScope;
    intentId: string;
    intentPayload: string;
    outbox: CommunicationOutboxRecord;
  }) {
    const timestamp = input.outbox.availableAt;
    const intent = this.db.prepare(
      "INSERT INTO communication_audit_events (id, organization_id, farm_id, payload, created_at, updated_at, actor_id, event_type, correlation_id, source_record_ref, safe_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(input.intentId, input.scope.organizationId, input.scope.farmId || null, input.intentPayload, timestamp, timestamp, "system", "communication.intent.created", input.outbox.correlationId, input.scope.recordId || null, "{}");
    const outbox = this.db.prepare(
      "INSERT INTO communication_outbox (id, organization_id, farm_id, payload, created_at, updated_at, job_id, event_type, state, idempotency_key, correlation_id, available_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(input.outbox.id, input.scope.organizationId, input.scope.farmId || null, "{}", timestamp, timestamp, input.outbox.jobId, input.outbox.eventType, input.outbox.state, input.outbox.idempotencyKey, input.outbox.correlationId, input.outbox.availableAt);
    // D1 batch is the transaction boundary available to this Site.  The
    // business event and this method must be called by the same authoritative
    // request before a queue consumer is allowed to claim the outbox row.
    return this.db.batch([intent, outbox]);
  }

  async claimOutbox(principal: CommunicationsPrincipal | null, scope: CommunicationScope, now: string, limit = 20, resolver: BusinessRecordAccessResolver = DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER) {
    const boundary = safeBusinessDecision(resolver, { principal, scope, operation: "read", authorityMode: "USER_AUTHORIZED", sourceRecordRef: scope.recordId });
    const access = authorizeCommunicationAccess({ principal, permission: "communications.view", businessRecordPermission: boundary.decision === "ALLOW" || boundary.decision === "NOT_APPLICABLE", scope });
    if (!access.allowed) throw new CommunicationAuthorizationError(access);
    const boundedLimit = Math.min(50, Math.max(1, Math.floor(limit)));
    const result = await this.db.prepare(
      "SELECT id, organization_id, farm_id, job_id, event_type, state, idempotency_key, correlation_id, available_at, claimed_at FROM communication_outbox WHERE organization_id = ? AND state = 'READY' AND available_at <= ? ORDER BY available_at ASC LIMIT ?",
    ).bind(scope.organizationId, now, boundedLimit).all<CommunicationD1Row>();
    const claimed: CommunicationD1Row[] = [];
    for (const row of result.results || []) {
      const claim = await this.db.prepare(
        "UPDATE communication_outbox SET state = 'CLAIMED', claimed_at = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND (? IS NULL OR farm_id = ?) AND state = 'READY' AND available_at <= ?",
      ).bind(now, now, row.id, scope.organizationId, scope.farmId || null, scope.farmId || null, now).run();
      if (Number(claim.meta?.changes || 0) === 1) claimed.push({ ...row, state: "CLAIMED", claimed_at: now });
    }
    return claimed;
  }

  async markOutbox(principal: CommunicationsPrincipal | null, scope: CommunicationScope, outboxId: string, state: "COMPLETED" | "FAILED", at: string, resolver: BusinessRecordAccessResolver = DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER) {
    const boundary = safeBusinessDecision(resolver, { principal, scope, operation: "read", authorityMode: "USER_AUTHORIZED", sourceRecordRef: scope.recordId });
    const access = authorizeCommunicationAccess({ principal, permission: "communications.view", businessRecordPermission: boundary.decision === "ALLOW" || boundary.decision === "NOT_APPLICABLE", scope });
    if (!access.allowed) throw new CommunicationAuthorizationError(access);
    return this.db.prepare("UPDATE communication_outbox SET state = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND (? IS NULL OR farm_id = ?) AND state = 'CLAIMED'").bind(state, at, outboxId, scope.organizationId, scope.farmId || null, scope.farmId || null).run();
  }

  async readPrivateHrConversation(principal: CommunicationsPrincipal | null, scope: CommunicationScope, conversationId: string, resolver: BusinessRecordAccessResolver = DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER) {
    // Resolve the stored row before applying classification authority.  The
    // caller never supplies the classification used for authorization.
    const access = authorizeCommunicationAccess({ principal, permission: "communications.view", scope });
    if (!access.allowed) throw new CommunicationAuthorizationError(access);
    const row = await this.db.prepare("SELECT id, organization_id, farm_id, payload, classification, business_record_type, business_record_id FROM communication_conversations WHERE id = ? AND organization_id = ? AND farm_id = ? AND classification IN ('HR', 'HR_SENSITIVE', 'RECRUITMENT')").bind(conversationId, scope.organizationId, scope.farmId || "").first<CommunicationD1Row>();
    if (!row) return row;
    if (!rowHasAuthorizedBusinessAccess(principal, scope, row, resolver, "read")) return null;
    return row;
  }

  async listMessages(principal: CommunicationsPrincipal | null, scope: CommunicationScope, conversationId: string, cursor: string | null = null, limit = 50, resolver: BusinessRecordAccessResolver = DEFAULT_BUSINESS_RECORD_ACCESS_RESOLVER) {
    const access = authorizeCommunicationAccess({ principal, permission: "communications.view", scope });
    if (!access.allowed) throw new CommunicationAuthorizationError(access);
    const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const queryLimit = Math.min(400, boundedLimit * 4);
    const filtered: CommunicationD1Row[] = [];
    let queryCursor = cursor;
    const seenCursors = new Set<string>();
    let exhausted = false;
    while (!exhausted && filtered.length <= boundedLimit) {
      const result = await this.db.prepare(
        "SELECT m.id, m.organization_id AS message_organization_id, m.farm_id AS message_farm_id, m.payload, m.created_at, m.updated_at, m.state, m.direction, m.channel, m.body, m.conversation_id, c.organization_id AS conversation_organization_id, c.farm_id AS conversation_farm_id, c.classification, c.business_record_type, c.business_record_id FROM communication_messages m JOIN communication_conversations c ON c.id = m.conversation_id WHERE m.conversation_id = ? AND c.organization_id = ? AND (? IS NULL OR c.farm_id = ?) AND m.organization_id = c.organization_id AND (m.farm_id = c.farm_id OR (m.farm_id IS NULL AND c.farm_id IS NULL)) AND (? IS NULL OR m.created_at > ?) ORDER BY m.created_at ASC LIMIT ?",
      ).bind(conversationId, scope.organizationId, scope.farmId || null, scope.farmId || null, queryCursor, queryCursor, queryLimit).all<CommunicationD1Row>();
      const batch = result.results || [];
      filtered.push(...batch.filter((row) => {
        const messageOrganization = textValue(row, "message_organization_id") || textValue(row, "organization_id");
        const messageFarm = textValue(row, "message_farm_id") || textValue(row, "farm_id");
        const conversationOrganization = textValue(row, "conversation_organization_id") || messageOrganization;
        const conversationFarm = textValue(row, "conversation_farm_id") || messageFarm;
        if (!messageOrganization || !conversationOrganization || messageOrganization !== conversationOrganization) return false;
        if (messageFarm !== conversationFarm) return false;
        return rowHasAuthorizedBusinessAccess(principal, scope, {
          ...row,
          organization_id: conversationOrganization,
          farm_id: conversationFarm,
        }, resolver, "read");
      }));
      exhausted = batch.length < queryLimit;
      if (!exhausted) {
        const nextQueryCursor = textValue(batch.at(-1) || {}, "created_at");
        if (!nextQueryCursor || nextQueryCursor === queryCursor || seenCursors.has(nextQueryCursor)) {
          exhausted = true;
        } else {
          seenCursors.add(nextQueryCursor);
          queryCursor = nextQueryCursor;
        }
      }
    }
    return visiblePage(filtered, boundedLimit, "created_at");
  }
}

export type { CommunicationConversationRecord };
