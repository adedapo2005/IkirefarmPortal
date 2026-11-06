import type {
  AuthenticatedPrincipal,
  PermissionScope,
} from "./authenticated-principal";

export type AuthorizationChannel =
  | "api"
  | "direct-url"
  | "navigation"
  | "search"
  | "widget";

export type AuthorizationAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "execute";

export type AuthorizationSubject = Readonly<{
  resourceType: string;
  resourceId?: string;
  ownerId?: string;
  assigneeIds?: readonly string[];
  companyKey?: string;
  departmentKey?: string;
  locationKey?: string;
}>;

export type AuthorizationRequest = Readonly<{
  channel: AuthorizationChannel;
  action: AuthorizationAction;
  permission: string;
  subject?: AuthorizationSubject | null;
  approvalPermission?: string | null;
  fieldPermissions?: readonly string[];
}>;

export type AuthorizationDecision = Readonly<{
  allowed: boolean;
  code:
    | "allowed"
    | "disabled"
    | "farm-denied"
    | "permission-denied"
    | "approval-permission-required"
    | "approval-permission-denied"
    | "field-permission-denied"
    | "scope-missing"
    | "scope-denied";
  permission: string;
  scope: PermissionScope | "owner" | null;
}>;

const SECURITY_METADATA_BLOCKLIST =
  /(^|[-_.])(authorization|cookie|credential|password|passwd|secret|token|otp|code|session|api[-_]?key|private[-_]?key)($|[-_.])/i;

const normalizeKey = (value: string | undefined) =>
  (value || "").trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");

const VALID_SCOPES = new Set<PermissionScope>([
  "own",
  "assigned",
  "department",
  "all",
]);

export type RoleAuthorization = Readonly<{
  id: string;
  status: string;
  permissions?: readonly string[];
  deniedPermissions?: readonly string[];
  permissionScopes?: Readonly<
    Record<string, PermissionScope | readonly PermissionScope[]>
  >;
}>;

export type ComposedRoleAuthorization = Readonly<{
  permissions: readonly string[];
  deniedPermissions: readonly string[];
  permissionScopes: Readonly<Record<string, PermissionScope>>;
  permissionScopeSets: Readonly<Record<string, readonly PermissionScope[]>>;
}>;

/**
 * Composes active role rules into one server-authoritative decision input.
 * Explicit deny always wins, including when another role grants the same
 * permission. Scope alternatives remain separate so assigned + department
 * access is not widened into an artificial `all` scope.
 */
export function composeRoleAuthorization(
  roles: readonly RoleAuthorization[],
  fallbackPermissions: readonly string[] = [],
  fallbackScopes: Readonly<Record<string, PermissionScope>> = {},
): ComposedRoleAuthorization {
  const active = roles.filter((role) => typeof role?.status === "string" && role.status.trim().toLowerCase() === "active");
  // Legacy account grants are valid only when ALL assigned roles remain active.
  // Otherwise revoked roles could resurrect old grants from the account snapshot.
  const legacyFallbackAllowed = roles.length > 0 && active.length === roles.length;
  const hasRoleRules = active.some(
    (role) => role.permissions !== undefined ||
      role.permissionScopes !== undefined,
  );
  const grants = new Set(hasRoleRules
    ? active.flatMap((role) => [...(role.permissions || [])])
    : legacyFallbackAllowed ? fallbackPermissions : []);
  const denies = new Set(active.flatMap((role) => [...(role.deniedPermissions || [])]));
  const scopeSets: Record<string, PermissionScope[]> = {};

  const appendScope = (permission: string, candidate: unknown) => {
    if (typeof candidate !== "string" || !VALID_SCOPES.has(candidate as PermissionScope)) return;
    const scopes = scopeSets[permission] || (scopeSets[permission] = []);
    if (!scopes.includes(candidate as PermissionScope)) scopes.push(candidate as PermissionScope);
  };

  if (hasRoleRules) {
    for (const role of active) {
      for (const permission of role.permissions || []) {
        const configured = role.permissionScopes?.[permission];
        for (const scope of Array.isArray(configured) ? configured : [configured]) {
          appendScope(permission, scope);
        }
      }
    }
  } else {
    for (const permission of fallbackPermissions) appendScope(permission, fallbackScopes[permission]);
  }

  const permissions = [...grants].filter(
    (permission) => !denies.has(permission) && Boolean(scopeSets[permission]?.length),
  );
  const permissionScopeSets = Object.fromEntries(
    permissions.map((permission) => [permission, Object.freeze([...scopeSets[permission]])]),
  );
  const permissionScopes = Object.fromEntries(
    permissions.map((permission) => [permission, permissionScopeSets[permission][0]]),
  );
  return Object.freeze({
    permissions: Object.freeze(permissions),
    deniedPermissions: Object.freeze([...denies]),
    permissionScopes: Object.freeze(permissionScopes),
    permissionScopeSets: Object.freeze(permissionScopeSets),
  });
}

function organizationMatches(
  principal: AuthenticatedPrincipal,
  subject: AuthorizationSubject,
) {
  const org = principal.organizationScope;
  if (!org || typeof subject !== "object" || Array.isArray(subject)) return false;
  // Persisted subjects are JSON, not trusted TypeScript objects. Explicitly
  // malformed or blank company/site values cannot act like absent filters.
  if (subject.companyKey !== undefined &&
      (typeof subject.companyKey !== "string" || !subject.companyKey.trim() ||
       normalizeKey(subject.companyKey) !== org.companyKey)) return false;
  if (subject.locationKey !== undefined &&
      (typeof subject.locationKey !== "string" || !subject.locationKey.trim() ||
       normalizeKey(subject.locationKey) !== org.locationKey)) return false;
  return true;
}

function scopeAllows(
  principal: AuthenticatedPrincipal,
  scope: PermissionScope,
  subject: AuthorizationSubject | null | undefined,
) {
  if (!subject) return scope === "all" && Boolean(principal.organizationScope);

  if (!organizationMatches(principal, subject)) return false;

  switch (scope) {
    case "own":
      return Boolean(subject.ownerId) && subject.ownerId === principal.id;
    case "assigned":
      // String.includes would turn "usr-employee-other" into an assignment to
      // "usr-employee". Only an actual list of account IDs is authoritative.
      return Array.isArray(subject.assigneeIds) &&
        subject.assigneeIds.every((id) => typeof id === "string") &&
        subject.assigneeIds.includes(principal.id);
    case "department":
      return (
        typeof subject.departmentKey === "string" &&
        Boolean(subject.departmentKey.trim()) &&
        normalizeKey(subject.departmentKey) ===
          principal.organizationScope?.departmentKey
      );
    case "all":
      return true;
  }
}

function permissionScopes(
  principal: AuthenticatedPrincipal,
  permission: string,
) {
  const configured = principal.permissionScopeSets?.[permission];
  if (configured?.length) return configured;
  const legacy = principal.permissionScopes[permission];
  return legacy ? [legacy] : [];
}

function permissionAllows(
  principal: AuthenticatedPrincipal,
  permission: string,
  subject: AuthorizationSubject | null | undefined,
) {
  if (principal.deniedPermissions?.includes(permission)) {
    return { allowed: false as const, code: "permission-denied" as const, scope: null };
  }
  if (!principal.permissions.includes(permission)) {
    return { allowed: false as const, code: "permission-denied" as const, scope: null };
  }
  const scopes = permissionScopes(principal, permission);
  if (!scopes.length) {
    return { allowed: false as const, code: "scope-missing" as const, scope: null };
  }
  const scope = scopes.find((candidate) => scopeAllows(principal, candidate, subject));
  return scope
    ? { allowed: true as const, code: "allowed" as const, scope }
    : { allowed: false as const, code: "scope-denied" as const, scope: scopes[0] };
}

export function authorize(
  principal: AuthenticatedPrincipal,
  request: AuthorizationRequest,
): AuthorizationDecision {
  if (principal.restriction === "disabled") {
    return Object.freeze({
      allowed: false,
      code: "disabled",
      permission: request.permission,
      scope: null,
    });
  }

  if (!principal.farmAuthorized) {
    return Object.freeze({
      allowed: false,
      code: "farm-denied",
      permission: request.permission,
      scope: null,
    });
  }

  const basePermission = permissionAllows(principal, request.permission, request.subject);
  if (!basePermission.allowed) {
    return Object.freeze({
      allowed: false,
      code: basePermission.code,
      permission: request.permission,
      scope: basePermission.scope,
    });
  }

  // Resource-specific reads and mutations must carry authoritative company/site identity.
  // Collection-level view/export/execute checks may instead use the principal's scope.
  const boundResource =
    request.action === "create" ||
    request.action === "edit" ||
    request.action === "delete" ||
    request.action === "approve" ||
    request.subject?.resourceId !== undefined;
  if (boundResource && (
    typeof request.subject?.companyKey !== "string" || !request.subject.companyKey.trim() ||
    typeof request.subject?.locationKey !== "string" || !request.subject.locationKey.trim()
  )) {
    return Object.freeze({
      allowed: false,
      code: "scope-denied",
      permission: request.permission,
      scope: null,
    });
  }

  if (request.action === "approve") {
    if (!request.approvalPermission) {
      return Object.freeze({
        allowed: false,
        code: "approval-permission-required",
        permission: request.permission,
        scope: null,
      });
    }
    const approval = permissionAllows(principal, request.approvalPermission, request.subject);
    if (!approval.allowed) {
      return Object.freeze({
        allowed: false,
        code: "approval-permission-denied",
        permission: request.permission,
        scope: null,
      });
    }
  }

  for (const fieldPermission of request.fieldPermissions || []) {
    if (!permissionAllows(principal, fieldPermission, request.subject).allowed) {
      return Object.freeze({
        allowed: false,
        code: "field-permission-denied",
        permission: fieldPermission,
        scope: null,
      });
    }
  }

  return Object.freeze({
    allowed: true,
    code: "allowed",
    permission: request.permission,
    scope: basePermission.scope,
  });
}

export type SecurityAuditEvent = Readonly<{
  actorId: string;
  action: AuthorizationAction;
  permission: string;
  resourceType: string;
  resourceId: string | null;
  channel: AuthorizationChannel;
  occurredAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

function redactAuditValue(key: string, value: unknown): unknown {
  if (SECURITY_METADATA_BLOCKLIST.test(key)) return "[REDACTED]";
  if (Array.isArray(value))
    return Object.freeze(value.map((item) => redactAuditValue(key, item)));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[childKey] = redactAuditValue(childKey, childValue);
    }
    return Object.freeze(result);
  }
  if (typeof value === "string") return value.slice(0, 500);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  return String(value).slice(0, 500);
}

export function createSecurityAuditEvent(
  principal: AuthenticatedPrincipal,
  request: AuthorizationRequest,
  metadata: Readonly<Record<string, unknown>> = {},
  occurredAt = new Date().toISOString(),
): SecurityAuditEvent {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    sanitized[key] = redactAuditValue(key, value);
  }

  return Object.freeze({
    actorId: principal.id,
    action: request.action,
    permission: request.permission,
    resourceType: request.subject?.resourceType || "unknown",
    resourceId: request.subject?.resourceId || null,
    channel: request.channel,
    occurredAt,
    metadata: Object.freeze(sanitized),
  });
}
