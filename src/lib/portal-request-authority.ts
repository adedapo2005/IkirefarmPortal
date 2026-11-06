import {
  PORTAL_SESSION_COOKIE,
  getSessionAccount,
  parseCookieHeader,
  serializePrincipal,
} from "./portal-auth.ts";
import {
  PORTAL_ME_CONTRACT_VERSION,
  type AuthenticatedPrincipal,
  validatePortalMe,
} from "./authenticated-principal.ts";
import { permissionCatalog } from "./portal-model.ts";
import {
  authorize,
  type AuthorizationDecision,
  type AuthorizationRequest,
} from "./security-authority.ts";

const KNOWN_PERMISSIONS = new Set(permissionCatalog);

export type PortalRequestAuthoritySuccess = Readonly<{
  ok: true;
  principal: AuthenticatedPrincipal;
  sessionId: string;
  decision: AuthorizationDecision;
}>;

export type PortalRequestAuthorityFailure = Readonly<{
  ok: false;
  status: 401 | 404 | 503;
  code:
    | "portal-auth-unavailable"
    | "unauthorized"
    | "not-found";
}>;

export type PortalRequestAuthorityResult =
  | PortalRequestAuthoritySuccess
  | PortalRequestAuthorityFailure;

const fail = (
  status: PortalRequestAuthorityFailure["status"],
  code: PortalRequestAuthorityFailure["code"],
): PortalRequestAuthorityFailure =>
  Object.freeze({ ok: false, status, code });

export async function authorizePortalRequest(
  db: D1Database | undefined,
  request: Request,
  authorization: AuthorizationRequest,
): Promise<PortalRequestAuthorityResult> {
  if (!db) return fail(503, "portal-auth-unavailable");

  const token =
    parseCookieHeader(request.headers.get("cookie"))[PORTAL_SESSION_COOKIE] || "";
  if (!token || token.length > 512) return fail(401, "unauthorized");

  let session: Awaited<ReturnType<typeof getSessionAccount>>;
  try {
    session = await getSessionAccount(db, token);
  } catch {
    return fail(503, "portal-auth-unavailable");
  }
  if (!session) return fail(401, "unauthorized");

  const serialized = serializePrincipal(session.account);
  const contractVersion =
    typeof serialized.contractVersion === "string"
      ? serialized.contractVersion
      : PORTAL_ME_CONTRACT_VERSION;
  const validated = validatePortalMe(
    serialized,
    contractVersion,
    KNOWN_PERMISSIONS,
  );

  // An authenticated session with contradictory or malformed authority data is
  // deliberately indistinguishable from an unavailable protected resource.
  if (!validated.ok) return fail(404, "not-found");

  const decision = authorize(validated.principal, authorization);
  if (!decision.allowed) return fail(404, "not-found");

  return Object.freeze({
    ok: true,
    principal: validated.principal,
    sessionId: session.sessionId,
    decision,
  });
}

export async function resolvePortalPrincipal(
  db: D1Database | undefined,
  request: Request,
): Promise<PortalPrincipalResult> {
  if (!db) return fail(503, "portal-auth-unavailable");

  const token =
    parseCookieHeader(request.headers.get("cookie"))[PORTAL_SESSION_COOKIE] || "";
  if (!token || token.length > 512) return fail(401, "unauthorized");

  let session: Awaited<ReturnType<typeof getSessionAccount>>;
  try {
    session = await getSessionAccount(db, token);
  } catch {
    return fail(503, "portal-auth-unavailable");
  }
  if (!session) return fail(401, "unauthorized");

  const serialized = serializePrincipal(session.account);
  const contractVersion =
    typeof serialized.contractVersion === "string"
      ? serialized.contractVersion
      : PORTAL_ME_CONTRACT_VERSION;
  const validated = validatePortalMe(
    serialized,
    contractVersion,
    KNOWN_PERMISSIONS,
  );
  if (!validated.ok) return fail(404, "not-found");

  return Object.freeze({
    ok: true,
    principal: validated.principal,
    sessionId: session.sessionId,
    authority: Object.freeze({
      sessionId: session.sessionId,
      accountId: session.account.id,
      fingerprint: session.authorityFp,
    }),
  });
}

export type PortalPrincipalSuccess = Readonly<{
  ok: true;
  principal: AuthenticatedPrincipal;
  sessionId: string;
  /** Request-time authority snapshot for atomic write-boundary revalidation. Never persisted. */
  authority: Readonly<{ sessionId: string; accountId: string; fingerprint: string }>;
}>;
export type PortalPrincipalResult =
  | PortalPrincipalSuccess
  | PortalRequestAuthorityFailure;
