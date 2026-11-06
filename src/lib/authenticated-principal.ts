import type { Persona } from "./portal-model";

export const PORTAL_ME_CONTRACT_VERSION = "6.9.9-flexible";

const PERMISSION_SCOPES = new Set(["own", "assigned", "department", "all"]);
const ACCESS_STATES = new Set([
  "owner",
  "assigned",
  "no_role",
  "provisional",
  "provisional_expired",
]);
const DISABLED_LIFECYCLE_STATES = new Set([
  "disabled",
  "expired",
  "revoked",
  "suspended",
  "terminated",
]);
const FARM_COMPANY_KEYS = new Set([
  "daenem-farms",
  "daenem_farms",
  "daenem-farms-limited",
]);

export type PermissionScope = "own" | "assigned" | "department" | "all";

export type PrincipalRole = Readonly<{
  id: string;
  name: string;
  status: string;
  isSystemOwner: boolean;
  isWorkflowRole: boolean;
}>;

export type PrincipalOrganizationScope = Readonly<{
  companyKey: string;
  companyLabel: string;
  departmentKey: string;
  departmentLabel: string;
  locationKey: string;
  timezone: string;
}>;

export type AuthenticatedPrincipal = Readonly<{
  id: string;
  email: string;
  displayName: string;
  employeeNo: string;
  phone: string;
  department: string;
  jobTitle: string;
  status: string;
  roles: readonly PrincipalRole[];
  permissions: readonly string[];
  deniedPermissions: readonly string[];
  permissionScopes: Readonly<Record<string, PermissionScope>>;
  permissionScopeSets: Readonly<Record<string, readonly PermissionScope[]>>;
  organizationScope: PrincipalOrganizationScope | null;
  farmAuthorized: boolean;
  isOwner: boolean;
  accessState: "owner" | "assigned" | "no_role" | "provisional" | "provisional_expired";
  lifecycleStatus: string | null;
  restriction: "none" | "no-role" | "provisional" | "expired" | "disabled";
  assignedTimezone: string;
  assignedLocation: string;
  contractVersion: typeof PORTAL_ME_CONTRACT_VERSION;
  securityStamp: string;
}>;

export type PrincipalValidationResult =
  | Readonly<{ ok: true; principal: AuthenticatedPrincipal; droppedPermissions: readonly string[] }>
  | Readonly<{
      ok: false;
      code:
        | "contract-version"
        | "empty-response"
        | "invalid-identity"
        | "invalid-rbac-state"
        | "invalid-security-field"
        | "contradictory-owner"
        | "contradictory-lifecycle";
    }>;

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requiredString = (value: unknown, max = 320) =>
  typeof value === "string" && value.trim() && value.length <= max
    ? value.trim()
    : null;

const optionalString = (value: unknown, max = 320) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");

const hasOwn = (value: RecordValue, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

function parseRoles(value: unknown): PrincipalRole[] | null {
  if (!Array.isArray(value)) return null;
  const roles: PrincipalRole[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    const id = requiredString(raw.id, 180);
    const name = requiredString(raw.name, 180);
    if (!id || !name) return null;
    roles.push(
      Object.freeze({
        id,
        name,
        status: raw.status === undefined ? "active" : requiredString(raw.status, 40) || "",
        isSystemOwner: raw.isSystemOwner === true,
        isWorkflowRole: raw.isWorkflowRole === true,
      }),
    );
  }
  return roles;
}

function parseStringArray(value: unknown, maxItems = 1000): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const values: string[] = [];
  for (const raw of value) {
    const item = requiredString(raw, 180);
    if (!item) return null;
    values.push(item);
  }
  return [...new Set(values)];
}

function parseOrganizationScope(value: unknown): PrincipalOrganizationScope | null | false {
  if (value == null) return null;
  if (!isRecord(value)) return false;
  const companyKey = requiredString(value.companyKey, 160);
  const companyLabel = requiredString(value.companyLabel, 160);
  if (!companyKey || !companyLabel) return false;
  return Object.freeze({
    companyKey: normalizeKey(companyKey),
    companyLabel,
    departmentKey: normalizeKey(optionalString(value.departmentKey, 160)),
    departmentLabel: optionalString(value.departmentLabel, 160),
    locationKey: normalizeKey(optionalString(value.locationKey, 160)),
    timezone: optionalString(value.timezone, 80),
  });
}

function isFarmOrganization(scope: PrincipalOrganizationScope | null) {
  if (!scope || !scope.locationKey) return false;
  // Display labels are descriptive metadata, not an authoritative company assignment.
  // Only the server-bound company key can grant membership in a Farm workspace.
  return FARM_COMPANY_KEYS.has(scope.companyKey);
}

export function validatePortalMe(
  payload: unknown,
  contractVersion: string | null,
  knownPermissions: ReadonlySet<string>,
): PrincipalValidationResult {
  if (contractVersion !== PORTAL_ME_CONTRACT_VERSION)
    return { ok: false, code: "contract-version" };
  if (!isRecord(payload) || !Object.keys(payload).length)
    return { ok: false, code: "empty-response" };

  const id = requiredString(payload.id, 180);
  const email = requiredString(payload.email, 320);
  const displayName = requiredString(payload.displayName, 240);
  if (!id || !email || !displayName || !email.includes("@"))
    return { ok: false, code: "invalid-identity" };
  if (payload.rbacReady !== true)
    return { ok: false, code: "invalid-rbac-state" };

  const roles = parseRoles(payload.roles);
  const rawPermissions = parseStringArray(payload.permissions);
  const rawDeniedPermissions = hasOwn(payload, "deniedPermissions")
    ? parseStringArray(payload.deniedPermissions)
    : [];
  const accessState = requiredString(payload.accessState, 60);
  if (!roles || !rawPermissions || !rawDeniedPermissions || !accessState || !ACCESS_STATES.has(accessState))
    return { ok: false, code: "invalid-security-field" };
  const rawPermissionScopes = payload.permissionScopes;
  if (!isRecord(rawPermissionScopes))
    return { ok: false, code: "invalid-security-field" };
  const rawPermissionScopeSets = payload.permissionScopeSets;
  if (rawPermissionScopeSets !== undefined && !isRecord(rawPermissionScopeSets))
    return { ok: false, code: "invalid-security-field" };

  // These fields are always present in the v6.9.9 serializer.  Treating a
  // missing or wrongly typed value as a falsy default would let a malformed
  // response select a different authorization branch.
  if (typeof payload.isOwner !== "boolean")
    return { ok: false, code: "invalid-security-field" };
  const isOwner = payload.isOwner;
  const hasOwnerRole = roles.some((role) => role.id === "owner");
  const activeRoles = roles.filter((role) => role.status.trim().toLowerCase() === "active");
  const hasActiveOwnerRole = activeRoles.some((role) => role.id === "owner");
  const hasWildcard = rawPermissions.includes("*");
  if (
    hasWildcard ||
    (isOwner && (accessState !== "owner" || !hasActiveOwnerRole)) ||
    (!isOwner && (accessState === "owner" || hasOwnerRole))
  ) {
    return { ok: false, code: "contradictory-owner" };
  }

  if (typeof payload.provisionalRole !== "boolean" || typeof payload.provisionalExpired !== "boolean")
    return { ok: false, code: "invalid-security-field" };
  const provisionalRole = payload.provisionalRole;
  const provisionalExpired = payload.provisionalExpired;

  const status = requiredString(payload.status, 60);
  if (!status)
    return { ok: false, code: "invalid-security-field" };

  // organizationScope is nullable in the backend response, but the key is
  // part of the serializer contract.  An absent scope is not an unrestricted
  // scope and therefore fails closed instead of being guessed from the UI.
  if (!hasOwn(payload, "organizationScope"))
    return { ok: false, code: "invalid-security-field" };
  const organizationScope = parseOrganizationScope(payload.organizationScope);
  if (organizationScope === false)
    return { ok: false, code: "invalid-security-field" };

  // lifecycle is legitimately null when the authoritative lifecycle row is
  // absent.  When present, its status must still be a string; it is not a
  // client-controlled hint that may be coerced into an active account.
  if (payload.lifecycle !== null && payload.lifecycle !== undefined && !isRecord(payload.lifecycle))
    return { ok: false, code: "invalid-security-field" };
  const lifecycleStatus = isRecord(payload.lifecycle)
    ? (hasOwn(payload.lifecycle, "status")
      ? requiredString(payload.lifecycle.status, 60)?.toLowerCase() || null
      : null)
    : null;
  if (isRecord(payload.lifecycle) && hasOwn(payload.lifecycle, "status") && !lifecycleStatus)
    return { ok: false, code: "invalid-security-field" };
  const accountStatus = status.toLowerCase();
  const disabledLifecycle = lifecycleStatus !== null && DISABLED_LIFECYCLE_STATES.has(lifecycleStatus);

  // Compatibility matrix.  Only combinations represented by the verified
  // serializer are accepted; contradictions fail closed before permissions
  // are mapped.  workspaceOnly is intentionally ignored because it is not
  // serialized by userView and cannot be an authority signal.
  const lifecycleContradiction =
    (isOwner && (provisionalRole || provisionalExpired || accountStatus !== "active" || disabledLifecycle || lifecycleStatus === "provisional")) ||
    (accessState === "owner" && (!isOwner || !hasOwnerRole)) ||
    (accessState === "assigned" && (activeRoles.length === 0 || isOwner || provisionalRole || provisionalExpired || lifecycleStatus === "provisional")) ||
    (accessState === "no_role" && (isOwner || roles.length !== 0 || rawPermissions.length !== 0 || provisionalRole || provisionalExpired || lifecycleStatus === "provisional")) ||
    (accessState === "provisional" && (isOwner || !provisionalRole || provisionalExpired || !roles.some((role) => role.id === "provisional"))) ||
    (accessState === "provisional_expired" && (isOwner || !provisionalExpired || rawPermissions.length !== 0)) ||
    (provisionalExpired && !["provisional_expired"].includes(accessState)) ||
    (provisionalRole && !["provisional", "provisional_expired"].includes(accessState)) ||
    (lifecycleStatus === "provisional" && !["provisional", "provisional_expired"].includes(accessState));
  if (lifecycleContradiction) {
    return { ok: false, code: "contradictory-lifecycle" };
  }

  const permissionScopes: Record<string, PermissionScope> = {};
  const permissionScopeSets: Record<string, readonly PermissionScope[]> = {};
  const droppedPermissions: string[] = [];
  const deniedPermissions = rawDeniedPermissions.filter((permission) => knownPermissions.has(permission));
  const denied = new Set(deniedPermissions);
  let permissions = rawPermissions.filter((permission) => {
      if (denied.has(permission)) {
        droppedPermissions.push(permission);
        return false;
      }
      if (!knownPermissions.has(permission)) {
        droppedPermissions.push(permission);
        return false;
      }
      const scope = rawPermissionScopes[permission];
      const configuredSet = isRecord(rawPermissionScopeSets)
        ? rawPermissionScopeSets[permission]
        : undefined;
      const scopes = configuredSet === undefined ? [scope] : configuredSet;
      if (!Array.isArray(scopes) || !scopes.length ||
          scopes.some((candidate) => typeof candidate !== "string" || !PERMISSION_SCOPES.has(candidate))) {
        droppedPermissions.push(permission);
        return false;
      }
      const uniqueScopes = [...new Set(scopes as PermissionScope[])];
      permissionScopes[permission] = uniqueScopes[0];
      permissionScopeSets[permission] = Object.freeze(uniqueScopes);
      return true;
    });

  let restriction: AuthenticatedPrincipal["restriction"] = "none";
  if (accountStatus !== "active" || disabledLifecycle) {
    restriction = "disabled";
    permissions = [];
  } else if (accessState === "provisional_expired") {
    restriction = "expired";
  } else if (accessState === "no_role") {
    restriction = "no-role";
  } else if (accessState === "provisional") {
    restriction = "provisional";
  }

  const farmAuthorized =
    restriction === "none" && isFarmOrganization(organizationScope);
  const frozenPermissions = Object.freeze([...new Set(permissions)]);
  const frozenScopes = Object.freeze({ ...permissionScopes });
  const securityStamp = JSON.stringify({
    id,
    isOwner,
    accessState,
    restriction,
    status: accountStatus,
    lifecycleStatus,
    provisionalRole,
    provisionalExpired,
    permissions: frozenPermissions,
    deniedPermissions,
    permissionScopes: frozenScopes,
    permissionScopeSets,
    organizationScope,
  });

  const principal: AuthenticatedPrincipal = Object.freeze({
    id,
    email,
    displayName,
    employeeNo: optionalString(payload.employeeNo, 120),
    phone: optionalString(payload.phone, 80),
    department: optionalString(payload.department, 180),
    jobTitle: optionalString(payload.jobTitle, 180),
    status: accountStatus || "active",
    roles: Object.freeze(roles),
    permissions: frozenPermissions,
    deniedPermissions: Object.freeze(deniedPermissions),
    permissionScopes: frozenScopes,
    permissionScopeSets: Object.freeze({ ...permissionScopeSets }),
    organizationScope,
    farmAuthorized,
    isOwner,
    accessState: accessState as AuthenticatedPrincipal["accessState"],
    lifecycleStatus,
    restriction,
    assignedTimezone: optionalString(payload.assignedTimezone, 80),
    assignedLocation: optionalString(payload.assignedLocation, 180),
    contractVersion: PORTAL_ME_CONTRACT_VERSION,
    securityStamp,
  });
  return Object.freeze({
    ok: true,
    principal,
    droppedPermissions: Object.freeze(droppedPermissions),
  });
}

export function principalInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)![0]}` : parts[0]?.slice(0, 2) || "DF").toUpperCase();
}

const SELF_SERVICE_PAGE_KEYS = [
  "myday",
  "notifications",
  "v6-profile",
  "v6-leave",
  "v6-loans",
  "v6-payslips",
  "v6-performance",
  "v6-chat",
  "v6-notices",
];

export function principalToPersona(principal: AuthenticatedPrincipal): Persona {
  const lifecycleLabel =
    principal.accessState === "no_role"
      ? "Approved · No Role"
      : principal.accessState === "provisional"
        ? "Provisional Account"
        : principal.accessState === "provisional_expired"
          ? "Expired Provisional"
          : principal.isOwner
            ? "Owner"
            : principal.roles.map((role) => role.name).join(", ") || "Authorized User";
  return Object.freeze({
    id: principal.isOwner
      ? "owner"
      : principal.accessState === "no_role"
        ? "no-role"
        : principal.accessState === "provisional"
          ? "provisional"
          : principal.accessState === "provisional_expired"
            ? "expired"
            : principal.id,
    authenticatedAccountId: principal.id,
    label: lifecycleLabel,
    name: principal.displayName,
    job: principal.jobTitle || lifecycleLabel,
    initials: principalInitials(principal.displayName),
    permissions: [...principal.permissions],
    farm: principal.farmAuthorized,
    self: [...SELF_SERVICE_PAGE_KEYS],
    employeeId: principal.employeeNo || "Not Assigned",
    department: principal.department || "Not Assigned",
    email: principal.email,
    principalSource: "authenticated" as const,
    isOwner: principal.isOwner,
    accessState: principal.accessState,
    restriction: principal.restriction,
    permissionScopes: principal.permissionScopes,
    organizationScope: principal.organizationScope,
  });
}
