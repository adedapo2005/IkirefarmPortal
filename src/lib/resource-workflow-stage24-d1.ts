import { EggCorrectionHold } from "./egg-correction-hold.ts";
import type {
  AuthorizationSubject,
  SecurityAuditEvent,
} from "./security-authority.ts";
import {
  ResourceWorkflowError,
  type ResourceRecord,
  type ResourceRepository,
  type ResourceTransaction,
} from "./resource-workflow-stage24.ts";
import { DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, type DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";

export const RESOURCE_RECORDS_TABLE = "resource_records";
export const RESOURCE_AUDIT_EVENTS_TABLE = "resource_audit_events";

type ResourceRow = Readonly<Record<string, unknown>>;
type MutationGuard = Readonly<{
  statementIndex: number;
  id: string;
  revision: number;
  deletedAt: string | null;
}>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function decodeRecord<T>(row: ResourceRow): ResourceRecord<T> {
  if (typeof row.id !== "string" || typeof row.resource_type !== "string" ||
      typeof row.state !== "string" || typeof row.revision !== "number") {
    throw new Error("RESOURCE_ROW_INVALID");
  }
  return Object.freeze({
    id: row.id,
    resourceType: row.resource_type,
    state: row.state,
    revision: row.revision,
    // A blank legacy/corrupt actor value cannot establish who made the record.
    // Keep it unknown so maker/checker transitions fail closed.
    createdBy: typeof row.created_by === "string" && row.created_by.trim()
      ? row.created_by
      : null,
    subject: parseJson<AuthorizationSubject>(row.subject_json, { resourceType: row.resource_type }),
    data: parseJson<T>(row.data_json, {} as T),
  });
}

function changes(result: { meta?: { changes?: number } } | undefined) {
  return Number(result?.meta?.changes || 0);
}

const AUTHORITY_PROTECTED_RESOURCE_TYPES = new Set([
  "flock-movement", "feed", "health-event", "vaccination",
]);

/**
 * D1 adapter for the generic resource contract.
 *
 * Reads happen before the D1 batch; every mutation is conditional on the
 * expected revision. The audit INSERT is part of that same batch and is
 * guarded by the post-mutation row, so stale writes cannot create an audit.
 * Removal is a logical delete to preserve that atomic audit guard.
 */
export class D1ResourceRepository<T> implements ResourceRepository<T> {
  private readonly db: D1Database;
  private readonly now: () => string;
  private readonly authority: DailyReportAuthority | undefined;

  constructor(db: D1Database, now: () => string = () => new Date().toISOString(), authority?: DailyReportAuthority) {
    this.db = db;
    this.now = now;
    this.authority = authority;
  }

  async transaction<R>(
    callback: (transaction: ResourceTransaction<T>) => Promise<R>,
  ): Promise<R> {
    const statements: D1PreparedStatement[] = [];
    let mutation: MutationGuard | null = null;
    let auditStatementIndex: number | null = null;
    const transaction: ResourceTransaction<T> = {
      get: async (id) => {
        const row = await this.db.prepare(
          "SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE id = ? AND deleted_at IS NULL",
        ).bind(id).first<ResourceRow>();
        return row ? decodeRecord<T>(row) : null;
      },
      insert: async (record) => {
        if (record.resourceType === "egg-batch-adjustment") throw new EggCorrectionHold();
        const now = this.now();
        mutation = { statementIndex: statements.length, id: record.id, revision: record.revision, deletedAt: null };
        const parameters = [record.id, record.resourceType, record.state, record.revision,
          record.createdBy || null, JSON.stringify(record.subject), JSON.stringify(record.data), now, now] as const;
        if (this.authority && AUTHORITY_PROTECTED_RESOURCE_TYPES.has(record.resourceType)) {
          statements.push(this.db.prepare(
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
            "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE " + DAILY_REPORT_AUTHORITY_SQL,
          ).bind(...parameters, ...dailyReportAuthorityParams(this.authority, now)));
        } else {
          statements.push(this.db.prepare(
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
          ).bind(...parameters));
        }
      },
      update: async (record, expectedRevision) => {
        if (record.resourceType === "egg-batch-adjustment") throw new EggCorrectionHold();
        const now = this.now();
        mutation = { statementIndex: statements.length, id: record.id, revision: record.revision, deletedAt: null };
        const parameters = [record.state, record.revision, JSON.stringify(record.subject),
          JSON.stringify(record.data), now, record.id, record.resourceType, expectedRevision] as const;
        if (this.authority && AUTHORITY_PROTECTED_RESOURCE_TYPES.has(record.resourceType)) {
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? " +
            "WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL AND " + DAILY_REPORT_AUTHORITY_SQL,
          ).bind(...parameters, ...dailyReportAuthorityParams(this.authority, now)));
        } else {
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL",
          ).bind(...parameters));
        }
      },
      remove: async (id, expectedRevision) => {
        const deletedAt = this.now();
        mutation = { statementIndex: statements.length, id, revision: expectedRevision + 1, deletedAt };
        statements.push(this.db.prepare(
          "UPDATE resource_records SET state = '__deleted__', revision = revision + 1, deleted_at = ?, updated_at = ? WHERE id = ? AND revision = ? AND deleted_at IS NULL",
        ).bind(deletedAt, deletedAt, id, expectedRevision));
      },
      audit: async (event: SecurityAuditEvent) => {
        if (!mutation) throw new Error("RESOURCE_AUDIT_WITHOUT_MUTATION");
        auditStatementIndex = statements.length;
        const resourceId = event.resourceId || mutation.id;
        statements.push(this.db.prepare(
          "INSERT INTO resource_audit_events (id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1 AND EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND revision = ? AND ((deleted_at IS NULL AND ? IS NULL) OR deleted_at = ?))",
        ).bind(crypto.randomUUID(), resourceId, event.resourceType, event.actorId, event.action, event.permission, event.channel, event.occurredAt, JSON.stringify(event.metadata), mutation.id, mutation.revision, mutation.deletedAt, mutation.deletedAt));
      },
    };

    const result = await callback(transaction);
    if (!statements.length) return result;
    let results: D1Result[];
    try {
      results = await this.db.batch(statements);
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
        throw new ResourceWorkflowError("RESOURCE_EXISTS");
      }
      throw error;
    }
    const committedMutation = mutation as MutationGuard | null;
    if (committedMutation !== null && changes(results[committedMutation.statementIndex]) !== 1) {
      throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
    }
    if (auditStatementIndex !== null && changes(results[auditStatementIndex]) !== 1) {
      throw new Error("RESOURCE_AUDIT_NOT_WRITTEN");
    }
    return result;
  }
}
