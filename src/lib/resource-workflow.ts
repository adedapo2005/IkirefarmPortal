import { EggCorrectionHold } from "./egg-correction-hold.ts";
import {
  authorize,
  createSecurityAuditEvent,
  type AuthorizationAction,
  type AuthorizationSubject,
  type SecurityAuditEvent,
} from "./security-authority.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal";

export type ResourceRecord<T> = Readonly<{
  id: string;
  resourceType: string;
  state: string;
  revision: number;
  createdBy?: string | null;
  subject: AuthorizationSubject;
  data: T;
}>;

export type ResourceTransition = Readonly<{
  from: string | readonly string[];
  to: string;
  action: Exclude<AuthorizationAction, "view" | "export" | "execute">;
  permission: string;
  approvalPermission?: string | null;
}>;

export type ResourceDefinition<T> = Readonly<{
  resourceType: string;
  initialState: string;
  requireMakerChecker?: boolean;
  createPermissions?: readonly string[];
  mutableStates?: readonly string[];
  permissions: Readonly<Partial<Record<"create" | "edit" | "delete", string>>>;
  transitions: readonly ResourceTransition[];
  validate(data: T): readonly string[];
}>;export type ResourceTransaction<T> = Readonly<{
  get(id: string): Promise<ResourceRecord<T> | null>;
  insert(record: ResourceRecord<T>): Promise<void>;
  update(record: ResourceRecord<T>, expectedRevision: number): Promise<void>;
  remove(id: string, expectedRevision: number): Promise<void>;
  audit(event: SecurityAuditEvent): Promise<void>;
}>;

export interface ResourceRepository<T> {
  // Implementations must commit the resource mutation and audit event
  // atomically. D1 adapters should bind this callback to one transaction.
  transaction<R>(
    callback: (transaction: ResourceTransaction<T>) => Promise<R>,
  ): Promise<R>;
}

export type ResourceFailureCode =
  | "AUTHORIZATION_DENIED"
  | "RESOURCE_EXISTS"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_TYPE_MISMATCH"
  | "VALIDATION_FAILED"
  | "TRANSITION_NOT_ALLOWED"
  | "CONCURRENCY_CONFLICT"
  | "PERMISSION_NOT_CONFIGURED";

export class ResourceWorkflowError extends Error {
  readonly code: ResourceFailureCode;
  readonly details: readonly string[];

  constructor(code: ResourceFailureCode, details: readonly string[] = []) {
    super(code);
    this.name = "ResourceWorkflowError";
    this.code = code;
    this.details = Object.freeze([...details]);
  }
}type MutationInput<T> = Readonly<{
  id: string;
  subject: AuthorizationSubject;
  data: T;
}>;

type RevisionInput = Readonly<{
  id: string;
  expectedRevision: number;
}>;

function matchesFrom(current: string, from: ResourceTransition["from"]) {
  return Array.isArray(from) ? from.includes(current) : from === current;
}

function ensureSubject(
  definition: ResourceDefinition<unknown>,
  subject: AuthorizationSubject,
) {
  if (subject.resourceType !== definition.resourceType) {
    throw new ResourceWorkflowError("RESOURCE_TYPE_MISMATCH");
  }
}

function validationErrors<T>(definition: ResourceDefinition<T>, data: T) {
  const errors = definition.validate(data);
  return errors.length ? new ResourceWorkflowError("VALIDATION_FAILED", errors) : null;
}

export class ResourceWorkflowService<T> {
  private readonly definition: ResourceDefinition<T>;
  private readonly repository: ResourceRepository<T>;
  private readonly now: () => string;

  constructor(
    definition: ResourceDefinition<T>,
    repository: ResourceRepository<T>,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.definition = definition;
    this.repository = repository;
    this.now = now;
  }

  private permission(action: "create" | "edit" | "delete") {
    const permission = this.definition.permissions[action];
    if (!permission) throw new ResourceWorkflowError("PERMISSION_NOT_CONFIGURED");
    return permission;
  }

  private authorize(
    principal: AuthenticatedPrincipal,
    action: Exclude<AuthorizationAction, "view" | "export" | "execute">,
    permission: string,
    subject: AuthorizationSubject,
    approvalPermission?: string | null,
  ) {
    const decision = authorize(principal, {
      channel: "api",
      action,
      permission,
      subject,
      approvalPermission,
    });
    if (!decision.allowed) {
      throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
    }
  }

  private audit(
    principal: AuthenticatedPrincipal,
    action: Exclude<AuthorizationAction, "view" | "export" | "execute">,
    permission: string,
    subject: AuthorizationSubject,
    metadata: Record<string, unknown>,
  ) {
    return createSecurityAuditEvent(
      principal,
      { channel: "api", action, permission, subject },
      metadata,
      this.now(),
    );
  }

  async create(principal: AuthenticatedPrincipal, input: MutationInput<T>) {
    ensureSubject(this.definition as ResourceDefinition<unknown>, input.subject);
    const candidates = [this.permission("create"), ...(this.definition.createPermissions || [])];
    const permission = candidates.find((candidate) => authorize(principal, {
      channel: "api",
      action: "create",
      permission: candidate,
      subject: input.subject,
    }).allowed);
    if (!permission) {
      this.authorize(principal, "create", candidates[0]!, input.subject);
      throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
    }
    const failure = validationErrors(this.definition, input.data);
    if (failure) throw failure;
    const record: ResourceRecord<T> = Object.freeze({
      id: input.id,
      resourceType: this.definition.resourceType,
      state: this.definition.initialState,
      revision: 1,
      createdBy: principal.id,
      subject: Object.freeze({ ...input.subject }),
      data: input.data,
    });    return this.repository.transaction(async (transaction) => {
      if (await transaction.get(input.id)) {
        throw new ResourceWorkflowError("RESOURCE_EXISTS");
      }
      await transaction.insert(record);
      await transaction.audit(this.audit(principal, "create", permission, input.subject, {
        event: "resource.created",
        state: record.state,
        revision: record.revision,
      }));
      return record;
    });
  }

  async update(
    principal: AuthenticatedPrincipal,
    input: MutationInput<T> & RevisionInput,
  ) {
    ensureSubject(this.definition as ResourceDefinition<unknown>, input.subject);
    const permission = this.permission("edit");
    this.authorize(principal, "edit", permission, input.subject);
    const failure = validationErrors(this.definition, input.data);
    if (failure) throw failure;

    return this.repository.transaction(async (transaction) => {
      const current = await transaction.get(input.id);
      if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
      if (current.resourceType !== this.definition.resourceType) {
        throw new ResourceWorkflowError("RESOURCE_TYPE_MISMATCH");
      }
      if (current.revision !== input.expectedRevision) {
        throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      }
      if (this.definition.mutableStates && !this.definition.mutableStates.includes(current.state)) {
        throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED", ["record-state-not-mutable"]);
      }
      const next: ResourceRecord<T> = Object.freeze({
        ...current,
        revision: current.revision + 1,
        subject: Object.freeze({ ...input.subject }),
        data: input.data,
      });
      if (current.resourceType === "egg-batch") throw new EggCorrectionHold();
      await transaction.update(next, input.expectedRevision);
      await transaction.audit(this.audit(principal, "edit", permission, next.subject, {
        event: "resource.updated",
        revision: next.revision,
      }));
      return next;
    });
  }  async transition(
    principal: AuthenticatedPrincipal,
    input: RevisionInput & Readonly<{
      to: string;
    }>,
    // Trusted backend-only mapper: change data and lifecycle in one audited transaction.
    serverData?: (current: ResourceRecord<T>) => T,
  ) {
    return this.repository.transaction(async (transaction) => {
      const current = await transaction.get(input.id);
      if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
      if (current.resourceType !== this.definition.resourceType) {
        throw new ResourceWorkflowError("RESOURCE_TYPE_MISMATCH");
      }
      if (current.revision !== input.expectedRevision) {
        throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      }
      const transition = this.definition.transitions.find(
        (candidate) =>
          candidate.to === input.to && matchesFrom(current.state, candidate.from),
      );
      if (!transition) throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED");
      if (transition.action === "approve" && this.definition.requireMakerChecker &&
          (!current.createdBy || current.createdBy === principal.id)) {
        throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["maker-checker-required"]);
      }
      this.authorize(
        principal,
        transition.action,
        transition.permission,
        current.subject,
        transition.approvalPermission,
      );
      const nextData = serverData ? serverData(current) : current.data;
      if (serverData) {
        const failure = validationErrors(this.definition, nextData);
        if (failure) throw failure;
      }
      const next: ResourceRecord<T> = Object.freeze({
        ...current,
        state: transition.to,
        revision: current.revision + 1,
        data: nextData,
      });
      await transaction.update(next, input.expectedRevision);
      await transaction.audit(this.audit(
        principal,
        transition.action,
        transition.permission,
        next.subject,
        { event: "resource.transitioned", from: current.state, to: next.state, revision: next.revision },
      ));
      return next;
    });
  }

  async remove(principal: AuthenticatedPrincipal, input: RevisionInput) {
    return this.repository.transaction(async (transaction) => {
      const current = await transaction.get(input.id);
      if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
      if (current.resourceType !== this.definition.resourceType) {
        throw new ResourceWorkflowError("RESOURCE_TYPE_MISMATCH");
      }
      if (current.revision !== input.expectedRevision) {
        throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      }
      const permission = this.permission("delete");
      this.authorize(principal, "delete", permission, current.subject);
      if (this.definition.mutableStates && !this.definition.mutableStates.includes(current.state)) {
        throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED", ["record-state-not-mutable"]);
      }
      if (current.resourceType === "egg-batch") throw new EggCorrectionHold();
      await transaction.remove(input.id, input.expectedRevision);
      await transaction.audit(this.audit(principal, "delete", permission, current.subject, {
        event: "resource.deleted",
        revision: current.revision,
      }));
      return current;
    });
  }
}export class InMemoryResourceRepository<T> implements ResourceRepository<T> {
  readonly records = new Map<string, ResourceRecord<T>>();
  readonly audits: SecurityAuditEvent[] = [];

  async transaction<R>(
    callback: (transaction: ResourceTransaction<T>) => Promise<R>,
  ): Promise<R> {
    const records = new Map(this.records);
    const audits = [...this.audits];
    const transaction: ResourceTransaction<T> = {
      get: async (id) => records.get(id) || null,
      insert: async (record) => {
        if (records.has(record.id)) throw new ResourceWorkflowError("RESOURCE_EXISTS");
        records.set(record.id, record);
      },
      update: async (record, expectedRevision) => {
        const current = records.get(record.id);
        if (!current || current.revision !== expectedRevision) {
          throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
        }
        records.set(record.id, record);
      },
      remove: async (id, expectedRevision) => {
        const current = records.get(id);
        if (!current || current.revision !== expectedRevision) {
          throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
        }
        records.delete(id);
      },
      audit: async (event) => { audits.push(event); },
    };
    const result = await callback(transaction);
    this.records.clear();
    for (const [id, record] of records) this.records.set(id, record);
    this.audits.splice(0, this.audits.length, ...audits);
    return result;
  }
}
