import { has, type Persona } from "./portal-model.ts";
import type { Authority } from "./stage24-fieldline-rbac.ts";

type WorkspaceProof = Readonly<{
  workspaceState: string;
  projectionState: string;
  historyVerified: boolean;
  historyScopeKey: string;
  projectionScopeKey: string;
  selectedFlockId: string;
  projectedFlockId: string;
  selectedDate: string;
  projectedDate: string;
}>;

export function fieldlineScopeKey(person: Persona | undefined): string {
  return JSON.stringify([person?.authenticatedAccountId,person?.id,person?.principalSource,person?.restriction,person?.accessState,
    person?.farm,person?.organizationScope,person?.permissions,person?.permissionScopes]);
}

/** Presentation gating only. A current, authorized history and projection are
 * produced by the server-backed reader. This function grants no API permission. */
export function fieldlineReadCapability(person: Persona | undefined, proof: WorkspaceProof): Authority {
  const scope = person?.organizationScope;
  const permissionScope = person?.permissionScopes?.["farm.daily-report.view"];
  const validScope = permissionScope !== undefined &&
    ["own", "assigned", "department", "all"].includes(permissionScope);
  const mayView = person?.principalSource === "authenticated" &&
    typeof person.authenticatedAccountId === "string" && Boolean(person.authenticatedAccountId.trim()) &&
    person.restriction === "none" && person.farm === true &&
    (person.accessState === "assigned" || person.accessState === "owner") &&
    typeof scope?.companyKey === "string" && Boolean(scope.companyKey.trim()) &&
    typeof scope?.locationKey === "string" && Boolean(scope.locationKey.trim()) &&
    has(person, "farm.daily-report.view") && validScope;
  const scopeKey = fieldlineScopeKey(person);
  const current = proof.workspaceState === "ready" && proof.projectionState === "ready" &&
    proof.historyVerified && proof.historyScopeKey === scopeKey && proof.projectionScopeKey === scopeKey && Boolean(proof.selectedFlockId) &&
    proof.selectedFlockId === proof.projectedFlockId &&
    Boolean(proof.selectedDate) && proof.selectedDate === proof.projectedDate;
  const operations = Boolean(mayView && current);
  return Object.freeze({state: operations ? "authorized" : "denied", operations, finance: false, audit: false});
}
