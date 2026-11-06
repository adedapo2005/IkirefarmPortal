import {
  resolvePortalPrincipal,
} from "./portal-request-authority.ts";
import {
  authorize,
  type AuthorizationAction,
  type AuthorizationDecision,
  type AuthorizationRequest,
} from "./security-authority.ts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { FARMS_ORGANIZATION_ID, type MetaPermission } from "./meta-provider-control.ts";

function actionForMethod(method: string): AuthorizationAction {
  if (method === "GET") return "view";
  if (method === "DELETE") return "delete";
  return "edit";
}

function metaAuthorization(permission: MetaPermission, method: string, resourceId = "meta-control-plane", locationKey?: string): AuthorizationRequest {
  return {
    channel: "api",
    action: actionForMethod(method),
    permission,
    subject: {
      resourceType: "meta-integration",
      resourceId,
      companyKey: FARMS_ORGANIZATION_ID,
      // Company-wide Meta controls use the site assigned by the authenticated D1 principal.
      // Never take this identity from a query, header or browser-provided company selector.
      locationKey,
    },
  };
}

/**
 * The Meta route is an API/resource boundary. Permission presence alone is
 * not enough: the shared authority also verifies the authenticated principal,
 * Farms authorization, and the principal's persisted scope.
 */
export function authorizeMetaRequest(
  principal: AuthenticatedPrincipal,
  permission: MetaPermission,
  method = "GET",
  resourceId = "meta-control-plane",
): AuthorizationDecision {
  return authorize(principal, metaAuthorization(permission, method, resourceId, principal.organizationScope?.locationKey));
}

/**
 * Resolve the authenticated df_session through the canonical local D1
 * authority. The Meta control plane never accepts a browser-supplied persona,
 * role, user id, or permission list. This stays in-process so the Worker does
 * not depend on a self-fetch to /api/portal/me during an authenticated request.
 */
export async function requireMetaPrincipal(
  db: D1Database | undefined,
  request: Request,
  permission: MetaPermission,
): Promise<AuthenticatedPrincipal | null> {
  try {
    const result = await resolvePortalPrincipal(db, request);
    if (!result.ok) return null;
    return authorizeMetaRequest(result.principal, permission, request.method).allowed
      ? result.principal
      : null;
  } catch {
    return null;
  }
}

export function mutationOriginAllowed(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
