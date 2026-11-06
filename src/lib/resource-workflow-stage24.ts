import { EggCorrectionHold } from "./egg-correction-hold.ts";
import { StockMovementRemovalHold } from "./stock-movement-removal-hold.ts";
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

export type WorkflowApprovalMode =
  | "direct"
  | "owner"
  | "manager"
  | "maker-checker"
  | "owner-manager"
  | "threshold"
  | "role-site"
  | "custom";

export type WorkflowApprovalPolicy = Readonly<{
  version: string;
  mode: WorkflowApprovalMode;
  ownerOverride: "allowed" | "disabled";
  ownerOverrideReasonRequired: boolean;
  /** Optional Owner-configured edges. The resource definition remains the
   * default graph; these additive edges are validated before use. */
  transitions?: readonly WorkflowTransitionRule[];
}>;

export type WorkflowTransitionRule = Readonly<{
  from: string | readonly string[];
  to: string;
  action: Exclude<AuthorizationAction, "view" | "export" | "execute">;
  permission: string;
  approvalPermission?: string | null;
}>;

export type WorkflowPolicyResolver = Readonly<{
  resolve(input: Readonly<{
    resourceType: string;
    recordId: string;
    subject: AuthorizationSubject;
  }>): Promise<WorkflowApprovalPolicy | null>;
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
  | "PERMISSION_NOT_CONFIGURED"
  | "WORKFLOW_POLICY_INVALID"
  | "INVALID_WORKFLOW_DEFINITION";

export class ResourceWorkflowError extends Error {
  readonly code: ResourceFailureCode;
  readonly details: readonly string[];

  constructor(code: ResourceFailureCode, details: readonly string[] = []) {
    super(code);
    this.name = "ResourceWorkflowError";
    this.code = code;
    this.details = Object.freeze([...details]);
  }
}
type MutationInput<T> = Readonly<{
  id: string;
  subject: AuthorizationSubject;
  data: T;
  /** Safe, caller-supplied business context for the immutable audit event. */
  auditMetadata?: Readonly<Record<string, unknown>>;
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

function sameSubject(left: AuthorizationSubject, right: AuthorizationSubject) {
  const scalarKeys = [
    "resourceType",
    "resourceId",
    "ownerId",
    "companyKey",
    "departmentKey",
    "locationKey",
  ] as const;
  if (scalarKeys.some((key) => left[key] !== right[key])) return false;
  const leftAssignees = [...(left.assigneeIds || [])].sort();
  const rightAssignees = [...(right.assigneeIds || [])].sort();
  return leftAssignees.length === rightAssignees.length &&
    leftAssignees.every((id, index) => id === rightAssignees[index]);
}

function validationErrors<T>(definition: ResourceDefinition<T>, data: T) {
  const errors = definition.validate(data);
  return errors.length ? new ResourceWorkflowError("VALIDATION_FAILED", errors) : null;
}

function stateNames(from: ResourceTransition["from"]): readonly string[] {
  return typeof from === "string" ? [from] : from;
}

function validContractName(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 120 &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}

const WORKFLOW_APPROVAL_MODES = new Set<WorkflowApprovalMode>([
  "direct", "owner", "manager", "maker-checker", "owner-manager", "threshold", "role-site", "custom",
]);

function validWorkflowPolicy(value: WorkflowApprovalPolicy | null): value is WorkflowApprovalPolicy {
  if (!Boolean(value) || !validContractName(value?.version) || !WORKFLOW_APPROVAL_MODES.has(value!.mode) ||
      (value!.ownerOverride !== "allowed" && value!.ownerOverride !== "disabled") ||
      typeof value!.ownerOverrideReasonRequired !== "boolean") return false;
  const transitions = value!.transitions;
  if (transitions === undefined) return true;
  if (!Array.isArray(transitions) || transitions.length > 80) return false;
  const edges = new Set<string>();
  return transitions.every((transition) => {
    const from = stateNames(transition.from);
    if (!from.length || from.some((state) => !validContractName(state)) ||
        !validContractName(transition.to) || from.includes(transition.to) ||
        !validContractName(transition.permission) ||
        (transition.action !== "edit" && transition.action !== "approve") ||
        (transition.action === "approve" && !validContractName(transition.approvalPermission))) return false;
    return from.every((state) => {
      const edge = `${state}\u0000${transition.to}`;
      if (edges.has(edge)) return false;
      edges.add(edge);
      return true;
    });
  });
}

function workflowStates(definition: ResourceDefinition<unknown>, policy?: WorkflowApprovalPolicy) {
  const states = new Set<string>([definition.initialState]);
  for (const transition of definition.transitions) {
    for (const from of stateNames(transition.from)) states.add(from);
    states.add(transition.to);
  }
  for (const transition of policy?.transitions || []) {
    for (const from of stateNames(transition.from)) states.add(from);
    states.add(transition.to);
  }
  return states;
}

export function validateResourceDefinition(definition: ResourceDefinition<unknown>): readonly string[] {
  const errors: string[] = [];
  if (!validContractName(definition.resourceType)) errors.push("resource-type-invalid");
  if (!validContractName(definition.initialState)) errors.push("initial-state-invalid");

  const edges = new Set<string>();
  for (const [index, transition] of definition.transitions.entries()) {
    const fromStates = stateNames(transition.from);
    if (!fromStates.length) errors.push(`transition-${index}-source-empty`);
    if (!validContractName(transition.to)) errors.push(`transition-${index}-destination-invalid`);
    if (!validContractName(transition.permission)) errors.push(`transition-${index}-permission-invalid`);
    if (transition.action !== "edit" && transition.action !== "approve") {
      errors.push(`transition-${index}-action-invalid`);
    }
    if (transition.action === "approve" && !validContractName(transition.approvalPermission)) {
      errors.push(`transition-${index}-approval-permission-required`);
    }
    for (const from of fromStates) {
      if (!validContractName(from)) {
        errors.push(`transition-${index}-source-invalid`);
        continue;
      }
      if (from === transition.to) errors.push(`transition-${index}-self-transition`);
      const edge = `${from}\u0000${transition.to}`;
      if (edges.has(edge)) errors.push(`transition-${index}-duplicate-edge`);
      edges.add(edge);
    }
  }

  const reachable = new Set<string>([definition.initialState]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const transition of definition.transitions) {
      if (stateNames(transition.from).some((state) => reachable.has(state)) && !reachable.has(transition.to)) {
        reachable.add(transition.to);
        expanded = true;
      }
    }
  }
  for (const [index, transition] of definition.transitions.entries()) {
    if (!stateNames(transition.from).some((state) => reachable.has(state))) {
      errors.push(`transition-${index}-source-unreachable`);
    }
  }
  const mutableStates = new Set<string>();
  for (const state of definition.mutableStates || []) {
    if (!validContractName(state)) errors.push(`mutable-state-${state}-invalid`);
    if (mutableStates.has(state)) errors.push(`mutable-state-${state}-duplicate`);
    mutableStates.add(state);
    if (!reachable.has(state)) errors.push(`mutable-state-${state}-unreachable`);
  }
  return Object.freeze(errors);
}

export class ResourceWorkflowService<T> {
  private readonly definition: ResourceDefinition<T>;
  private readonly repository: ResourceRepository<T>;
  private readonly now: () => string;
  private readonly policyResolver: WorkflowPolicyResolver | null;

  constructor(
    definition: ResourceDefinition<T>,
    repository: ResourceRepository<T>,
    now: () => string = () => new Date().toISOString(),
    policyResolver: WorkflowPolicyResolver | null = null,
  ) {
    const definitionErrors = validateResourceDefinition(definition as ResourceDefinition<unknown>);
    if (definitionErrors.length) {
      throw new ResourceWorkflowError("INVALID_WORKFLOW_DEFINITION", definitionErrors);
    }
    this.definition = definition;
    this.repository = repository;
    this.now = now;
    this.policyResolver = policyResolver;
  }

  private async policy(record: ResourceRecord<T>): Promise<WorkflowApprovalPolicy> {
    const configured = await this.policyResolver?.resolve({
      resourceType: this.definition.resourceType,
      recordId: record.id,
      subject: record.subject,
    });
    if (configured !== undefined && configured !== null) {
      if (!validWorkflowPolicy(configured)) throw new ResourceWorkflowError("WORKFLOW_POLICY_INVALID");
      return configured;
    }
    return Object.freeze({
      version: "resource-definition-v1",
      mode: this.definition.requireMakerChecker ? "maker-checker" : "direct",
      ownerOverride: "disabled",
      ownerOverrideReasonRequired: true,
    });
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
      const existing = await transaction.get(input.id);
      if (existing && !sameSubject(existing.subject, input.subject)) {
        throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
      }
      if (existing) {
        throw new ResourceWorkflowError("RESOURCE_EXISTS");
      }
      await transaction.insert(record);
      await transaction.audit(this.audit(principal, "create", permission, input.subject, {
        ...(input.auditMetadata || {}),
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
      if (!sameSubject(current.subject, input.subject)) {
        throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
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
        ...(input.auditMetadata || {}),
        event: "resource.updated",
        state: next.state,
        revision: next.revision,
      }));
      return next;
    });
  }  async transition(
    principal: AuthenticatedPrincipal,
    input: RevisionInput & Readonly<{
      to: string;
      auditMetadata?: Readonly<Record<string, unknown>>;
    }>,
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
      const policy = await this.policy(current);
      const transition = [...(policy.transitions || []), ...this.definition.transitions].find(
        (candidate) =>
          candidate.to === input.to && matchesFrom(current.state, candidate.from),
      );
      if (!transition) throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED");
      const ownerMakerCheckerOverride = transition.action === "approve" &&
        this.definition.requireMakerChecker === true &&
        Boolean(current.createdBy) && current.createdBy === principal.id &&
        principal.isOwner === true && principal.accessState === "owner";
      if (transition.action === "approve" && this.definition.requireMakerChecker &&
          (!current.createdBy || current.createdBy === principal.id) &&
          !ownerMakerCheckerOverride) {
        throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["maker-checker-required"]);
      }
      this.authorize(
        principal,
        transition.action,
        transition.permission,
        current.subject,
        transition.approvalPermission,
      );
      // Uniform interim hold: do not infer safe reversal from a pre-read balance.
      if (current.resourceType === "stock-movement" &&
          (transition.to === "voided" || (current.state === "posted" && transition.to !== "posted"))) {
        throw new StockMovementRemovalHold();
      }
      const next: ResourceRecord<T> = Object.freeze({
        ...current,
        state: transition.to,
        revision: current.revision + 1,
      });
      await transaction.update(next, input.expectedRevision);
      await transaction.audit(this.audit(
        principal,
        transition.action,
        transition.permission,
        next.subject,
        { ...input.auditMetadata, event: "resource.transitioned", from: current.state, to: next.state, state: next.state, revision: next.revision, policyVersion: policy.version, approvalMode: policy.mode, ...(ownerMakerCheckerOverride ? { ownerMakerCheckerOverride: true } : {}) },
      ));
      return next;
    });
  }

  async ownerOverride(
    principal: AuthenticatedPrincipal,
    input: RevisionInput & Readonly<{
      to: string;
      reason: string;
      auditMetadata?: Readonly<Record<string, unknown>>;
    }>,
  ) {
    if (principal.isOwner !== true || principal.accessState !== "owner") {
      throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["owner-authority-required"]);
    }
    return this.repository.transaction(async (transaction) => {
      const current = await transaction.get(input.id);
      if (!current) throw new ResourceWorkflowError("RESOURCE_NOT_FOUND");
      if (current.resourceType !== this.definition.resourceType) throw new ResourceWorkflowError("RESOURCE_TYPE_MISMATCH");
      if (current.revision !== input.expectedRevision) throw new ResourceWorkflowError("CONCURRENCY_CONFLICT");
      const policy = await this.policy(current);
      if (policy.ownerOverride !== "allowed") {
        throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["owner-override-disabled-by-policy"]);
      }
      const reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if ((policy.ownerOverrideReasonRequired && !reason) || reason.length > 500 || /[\u0000-\u001f\u007f]/u.test(reason)) {
        throw new ResourceWorkflowError("VALIDATION_FAILED", ["owner override reason is invalid"]);
      }
      if (!workflowStates(this.definition as ResourceDefinition<unknown>, policy).has(input.to) || input.to === current.state) {
        throw new ResourceWorkflowError("TRANSITION_NOT_ALLOWED");
      }
      const configuredTransition = [...(policy.transitions || []), ...this.definition.transitions].find((candidate) =>
        candidate.to === input.to && matchesFrom(current.state, candidate.from));
      const permission = configuredTransition?.permission || this.permission("edit");
      const action = configuredTransition?.action || "edit";
      this.authorize(principal, action, permission, current.subject, configuredTransition?.approvalPermission);
      if (current.resourceType === "stock-movement" &&
          (input.to === "voided" || (current.state === "posted" && input.to !== "posted"))) {
        throw new StockMovementRemovalHold();
      }
      const next: ResourceRecord<T> = Object.freeze({
        ...current,
        state: input.to,
        revision: current.revision + 1,
      });
      await transaction.update(next, input.expectedRevision);
      await transaction.audit(this.audit(principal, action, permission, next.subject, {
        ...input.auditMetadata,
        event: "resource.owner-override",
        ownerOverride: true,
        reason,
        from: current.state,
        to: next.state,
        state: next.state,
        revision: next.revision,
        policyVersion: policy.version,
        approvalMode: policy.mode,
      }));
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
      if (current.resourceType === "stock-movement") throw new StockMovementRemovalHold();
      await transaction.remove(input.id, input.expectedRevision);
      await transaction.audit(this.audit(principal, "delete", permission, current.subject, {
        event: "resource.deleted",
        state: "__deleted__",
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
