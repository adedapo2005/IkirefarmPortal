import { claimFarmWrite, completeFarmWrite, type FarmWriteReceipt } from "./farm-write-receipt.ts";
import { claimDailyFlockWrite, completeDailyFlockWrite, type DailyFlockReceipt } from "./daily-flock-write-receipt.ts";
import type {
  AuthorizationSubject,
  SecurityAuditEvent,
} from "./security-authority.ts";
import { EGG_FLOCK_AT_WRITE_SQL, eggFlockWriteParams } from "./stage24-release-egg-flock-integrity.ts";
import { DAILY_REPORT_FLOCK_ATWRITE_SQL, dailyReportFlockWriteParams, DAILY_REPORT_NONE_TODAY_PROOF_SQL, dailyReportNoneTodayProofParams, DAILY_REPORT_AUTHORITY_SQL, dailyReportAuthorityParams, type DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";
import {
  ResourceWorkflowError,
  type ResourceRecord,
  type ResourceRepository,
  type ResourceTransaction,
} from "./resource-workflow.ts";

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
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    subject: parseJson<AuthorizationSubject>(row.subject_json, { resourceType: row.resource_type }),
    data: parseJson<T>(row.data_json, {} as T),
  });
}

function changes(result: { meta?: { changes?: number } } | undefined) {
  return Number(result?.meta?.changes || 0);
}

const AUTHORITY_PROTECTED_RESOURCE_TYPES = new Set([
  "daily-flock-import", "file-evidence", "flock-movement", "feed",
  "health-event", "vaccination", "medication-administration", "mortality-record",
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
  private readonly writeReceipt: FarmWriteReceipt | undefined;
  private readonly dailyReceipt: DailyFlockReceipt | undefined;

  constructor(db: D1Database, now: () => string = () => new Date().toISOString(), authority?: DailyReportAuthority, writeReceipt?: FarmWriteReceipt, dailyReceipt?: DailyFlockReceipt) {
    this.db = db;
    this.now = now;
    this.authority = authority;
    if (writeReceipt && dailyReceipt) throw new Error("MULTIPLE_WRITE_RECEIPTS");
    this.writeReceipt = writeReceipt;
    this.dailyReceipt = dailyReceipt;
  }

  async transaction<R>(
    callback: (transaction: ResourceTransaction<T>) => Promise<R>,
  ): Promise<R> {
    const statements: D1PreparedStatement[] = [];
    let mutation: MutationGuard | null = null;
    let auditStatementIndex: number | null = null;
    let receiptRecord: ResourceRecord<T> | null = null;
    let receiptAuditId: string | null = null;
    const transaction: ResourceTransaction<T> = {
      get: async (id) => {
        const row = await this.db.prepare(
          "SELECT id, resource_type, state, revision, created_by, subject_json, data_json FROM resource_records WHERE id = ? AND deleted_at IS NULL",
        ).bind(id).first<ResourceRow>();
        return row ? decodeRecord<T>(row) : null;
      },
      insert: async (record) => {
        receiptRecord = record;
        const now = this.now();
        mutation = { statementIndex: statements.length, id: record.id, revision: record.revision, deletedAt: null };
        const parameters = [record.id, record.resourceType, record.state, record.revision, record.createdBy || null, JSON.stringify(record.subject), JSON.stringify(record.data), now, now] as const;
        if (record.resourceType === "daily-flock-report") {
          // No first-day draft, duplicate report or phantom Flock can be
          // committed outside the real Flock authority at the D1 write.
          statements.push(this.db.prepare(
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
            "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE " + DAILY_REPORT_FLOCK_ATWRITE_SQL + " AND " + DAILY_REPORT_NONE_TODAY_PROOF_SQL + " AND " + DAILY_REPORT_AUTHORITY_SQL,
          ).bind(...parameters, ...dailyReportFlockWriteParams(record), ...dailyReportNoneTodayProofParams(record), ...dailyReportAuthorityParams(this.authority, now)));
        } else if (record.resourceType === "egg-batch") {
          // The parent Flock must remain eligible at the actual D1 INSERT,
          // not merely at earlier API preflight. One atomic mutation + audit.
          statements.push(this.db.prepare(
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
            "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE " + EGG_FLOCK_AT_WRITE_SQL,
          ).bind(...parameters, ...eggFlockWriteParams(record)));
        } else if (record.resourceType === "hr-attendance-session") {
          // The preflight check can race across devices. Enforce one open shift
          // at the SQLite INSERT itself, inside D1's atomic batch transaction.
          const company = record.subject.companyKey;
          const employee = record.subject.ownerId;
          if (!company || !employee) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["attendance-scope-missing"]);
          statements.push(this.db.prepare(
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE NOT EXISTS (SELECT 1 FROM resource_records WHERE resource_type = 'hr-attendance-session' AND state = 'clocked-in' AND deleted_at IS NULL AND json_extract(subject_json, '$.companyKey') = ? AND json_extract(subject_json, '$.ownerId') = ?)",
          ).bind(...parameters, company, employee));
        } else if (record.resourceType === "flock") {
          // Two independent preflight reads can race. Reserve a flock code in
          // the same SQLite statement as insertion, inside the atomic D1 batch.
          // No migration or shared schema change is required.
          const company = record.subject.companyKey;
          const location = record.subject.locationKey;
          const code = (record.data as unknown as { flockCode?: unknown })?.flockCode;
          if (!company || !location || typeof code !== "string" || !code.trim()) {
            throw new ResourceWorkflowError("VALIDATION_FAILED", ["flock code or farm scope is missing"]);
          }
          const source=record.data as unknown as { sourceKind?: unknown; sourceSupplierId?: unknown; source?: unknown };
          const linked=source.sourceKind === "supplier";
          if (linked && (typeof source.sourceSupplierId !== "string" ||
              !source.sourceSupplierId.trim() || typeof source.source !== "string" || !source.source.trim())) {
            throw new ResourceWorkflowError("VALIDATION_FAILED", ["linked supplier record is incomplete"]);
          }
          // Re-check supplier activation at insert time, within the same D1
          // transaction, so a deactivation between preflight and insert
          // cannot create a newly linked flock to an inactive supplier.
          const sql=
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
            "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL " +
            "WHERE NOT EXISTS (SELECT 1 FROM resource_records WHERE resource_type = 'flock' AND deleted_at IS NULL " +
            "AND json_extract(subject_json, '$.companyKey') = ? AND json_extract(subject_json, '$.locationKey') = ? " +
            "AND LOWER(TRIM(json_extract(data_json, '$.flockCode'))) = LOWER(TRIM(?)))" +
            (linked
              ? " AND EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND resource_type = 'supplier' " +
                "AND state = 'active' AND deleted_at IS NULL AND json_extract(subject_json, '$.companyKey') = ? " +
                "AND json_extract(subject_json, '$.locationKey') = ? AND json_extract(data_json, '$.status') = 'active' " +
                "AND LOWER(TRIM(json_extract(data_json, '$.supplierCode'))) = LOWER(TRIM(?)))"
              : "");
          const bindParameters=linked
            ? [...parameters, company, location, code, source.sourceSupplierId, company, location, source.source]
            : [...parameters, company, location, code];
          statements.push(this.db.prepare(sql).bind(...bindParameters));
        } else if (
          record.resourceType === "house"
          || record.resourceType === "breed"
          || record.resourceType === "flock-transfer"
        ) {
          // Farm identity codes are site scoped. Preflight reads remain useful
          // for friendly errors, but only this conditional INSERT closes the
          // race between two concurrent Smart Entry submits.
          const company = record.subject.companyKey;
          const location = record.subject.locationKey;
          const codeField = record.resourceType === "house"
            ? "houseCode"
            : record.resourceType === "breed"
              ? "breedCode"
              : "transferCode";
          const code = (record.data as unknown as Record<string, unknown>)?.[codeField];
          if (!company || !location || typeof code !== "string" || !code.trim()) {
            throw new ResourceWorkflowError("VALIDATION_FAILED", ["resource code or farm scope is missing"]);
          }
          const sql =
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
            "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE NOT EXISTS " +
            "(SELECT 1 FROM resource_records WHERE resource_type = ? AND deleted_at IS NULL " +
            "AND json_extract(subject_json, '$.companyKey') = ? AND json_extract(subject_json, '$.locationKey') = ? " +
            "AND LOWER(TRIM(json_extract(data_json, '$." + codeField + "'))) = LOWER(TRIM(?)))";
          statements.push(this.db.prepare(sql).bind(...parameters, record.resourceType, company, location, code));
        } else if (record.resourceType === "supplier") {
          // Supplier identities are farm/site scoped. A read-before-create
          // check can race; preserve code uniqueness inside the D1 insert.
          const company=record.subject.companyKey;
          const location=record.subject.locationKey;
          const code=(record.data as unknown as { supplierCode?: unknown })?.supplierCode;
          if(!company || !location || typeof code!=="string" || !code.trim()) {
            throw new ResourceWorkflowError("VALIDATION_FAILED",["supplier identity or site scope is missing"]);
          }
          statements.push(this.db.prepare(
            "INSERT INTO resource_records (id, resource_type, state, revision, created_by, subject_json, data_json, created_at, updated_at, deleted_at) " +
            "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE NOT EXISTS " +
            "(SELECT 1 FROM resource_records WHERE resource_type = 'supplier' AND deleted_at IS NULL " +
            "AND json_extract(subject_json, '$.companyKey') = ? AND json_extract(subject_json, '$.locationKey') = ? " +
            "AND LOWER(TRIM(json_extract(data_json, '$.supplierCode'))) = LOWER(TRIM(?)))",
          ).bind(...parameters,company,location,code));
        } else if (this.authority && AUTHORITY_PROTECTED_RESOURCE_TYPES.has(record.resourceType)) {
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
        receiptRecord = record;
        const now = this.now();
        mutation = { statementIndex: statements.length, id: record.id, revision: record.revision, deletedAt: null };
        const args = [record.state, record.revision, JSON.stringify(record.subject),
          JSON.stringify(record.data), now, record.id, record.resourceType, expectedRevision];
        if (record.resourceType === "stock-opening" && record.state === "approved") {
          const data = record.data as unknown as { itemCode?: unknown; locationKey?: unknown; unit?: unknown };
          const { companyKey, locationKey } = record.subject;
          if (!companyKey || !locationKey || typeof data.itemCode !== "string" ||
              !data.itemCode.trim() || typeof data.locationKey !== "string" ||
              !data.locationKey.trim() || typeof data.unit !== "string" || !data.unit.trim()) {
            throw new ResourceWorkflowError("VALIDATION_FAILED", ["opening stock identity or company/site is missing"]);
          }
          // The competing baseline check MUST run inside the guarded D1 UPDATE.
          // Two approvals may pass preflight simultaneously; only one active
          // approved baseline may survive for each farm/site/item/store/unit.
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? " +
            "WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL " +
            "AND NOT EXISTS (SELECT 1 FROM resource_records AS existing WHERE existing.resource_type = 'stock-opening' " +
            "AND existing.state = 'approved' AND existing.deleted_at IS NULL AND existing.id <> ? " +
            "AND json_extract(existing.subject_json, '$.companyKey') = ? " +
            "AND json_extract(existing.subject_json, '$.locationKey') = ? " +
            "AND LOWER(TRIM(json_extract(existing.data_json, '$.itemCode'))) = LOWER(TRIM(?)) " +
            "AND LOWER(TRIM(json_extract(existing.data_json, '$.locationKey'))) = LOWER(TRIM(?)) " +
            "AND json_extract(existing.data_json, '$.unit') = ?)",
          ).bind(...args, record.id, companyKey, locationKey, data.itemCode, data.locationKey, data.unit));
        } else if (record.resourceType === "daily-flock-report" &&
            (record.state === "submitted" || record.state === "approved")) {
          // A Flock that moves/closes after preflight cannot gain an
          // approved Daily Report or success audit by racing the transition.
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? " +
            "WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL " +
            "AND " + DAILY_REPORT_FLOCK_ATWRITE_SQL + " AND " + DAILY_REPORT_NONE_TODAY_PROOF_SQL + " AND " + DAILY_REPORT_AUTHORITY_SQL,
          ).bind(...args, ...dailyReportFlockWriteParams(record), ...dailyReportNoneTodayProofParams(record), ...dailyReportAuthorityParams(this.authority, now)));
        } else if (record.resourceType === "daily-flock-report") {
          // Draft edits, Reject and return-to-Draft: authority only. A conflicting or
          // stale report must remain rejectable even if its sources have changed.
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? " +
            "WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL AND " + DAILY_REPORT_AUTHORITY_SQL,
          ).bind(...args, ...dailyReportAuthorityParams(this.authority, now)));
        } else if (record.resourceType === "egg-batch" && record.state === "verified") {
          // A record cannot become VERIFIED if its real Flock has closed,
          // moved, changed House/Code, or conflicts with another active code.
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? " +
            "WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL " +
            "AND " + EGG_FLOCK_AT_WRITE_SQL,
          ).bind(...args, ...eggFlockWriteParams(record)));
        } else if (this.authority && AUTHORITY_PROTECTED_RESOURCE_TYPES.has(record.resourceType)) {
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? " +
            "WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL AND " + DAILY_REPORT_AUTHORITY_SQL,
          ).bind(...args, ...dailyReportAuthorityParams(this.authority, now)));
        } else {
          statements.push(this.db.prepare(
            "UPDATE resource_records SET state = ?, revision = ?, subject_json = ?, data_json = ?, updated_at = ? WHERE id = ? AND resource_type = ? AND revision = ? AND deleted_at IS NULL",
          ).bind(...args));
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
        const auditId = crypto.randomUUID();
        receiptAuditId = auditId;
        // The preceding mutation executes immediately before this audit
        // inside one sequential atomic D1 batch. A stale UPDATE can match an
        // already-committed revision in the EXISTS check; changes() binds the
        // audit to THIS batch's successful mutation instead of another writer.
        // Never record an audit receipt when the mutation changed zero rows.
        statements.push(this.db.prepare(
          "INSERT INTO resource_audit_events (id, resource_id, resource_type, actor_id, action, permission, channel, occurred_at, metadata_json) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1 AND EXISTS (SELECT 1 FROM resource_records WHERE id = ? AND revision = ? AND ((deleted_at IS NULL AND ? IS NULL) OR deleted_at = ?))",
        ).bind(auditId, resourceId, event.resourceType, event.actorId, event.action, event.permission, event.channel, event.occurredAt, JSON.stringify(event.metadata), mutation.id, mutation.revision, mutation.deletedAt, mutation.deletedAt));
      },
    };

    const result = await callback(transaction);
    if (!statements.length) {
      if (this.dailyReceipt) throw new Error("DAILY_FLOCK_RECEIPT_MUTATION_MISSING");
      return result;
    }
    let results: D1Result[];
    if (this.dailyReceipt) {
      if (!receiptRecord || !receiptAuditId) throw new Error("DAILY_FLOCK_RECEIPT_MUTATION_MISSING");
      results = (await this.db.batch([
        claimDailyFlockWrite(this.db, this.dailyReceipt),
        ...statements,
        completeDailyFlockWrite(this.db, this.dailyReceipt, receiptRecord, receiptAuditId),
      ])).slice(1, -1);
    } else if (this.writeReceipt) {
      if (!receiptRecord || !receiptAuditId) throw new Error("FARM_RECEIPT_MUTATION_MISSING");
      results = (await this.db.batch([
        claimFarmWrite(this.db, this.writeReceipt),
        ...statements,
        completeFarmWrite(this.db, this.writeReceipt, receiptRecord, receiptAuditId),
      ])).slice(1, -1);
    } else {
      results = await this.db.batch(statements);
    }
    const committedMutation = mutation as MutationGuard | null;
    const committedRecord = receiptRecord as ResourceRecord<T> | null;
    const mutationChanges = committedMutation === null ? 0 : changes(results[committedMutation.statementIndex]);
    // Workerd reports both the evidence row and the intent-finalizing trigger;
    // SQLite adapters may report only the directly changed evidence row.
    const evidenceWithIntent = committedRecord?.resourceType === "file-evidence" && this.authority && mutationChanges === 2;
    if (committedMutation !== null && mutationChanges !== 1 && !evidenceWithIntent) {
      throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
    }
    if (auditStatementIndex !== null && changes(results[auditStatementIndex]) !== 1) {
      throw new Error("RESOURCE_AUDIT_NOT_WRITTEN");
    }
    return result;
  }
}
