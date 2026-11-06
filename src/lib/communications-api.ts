import type {
  BackendChannel,
  CommunicationClassification,
  CommunicationScope,
} from "./communications-backend";
import type {
  AuthorizationAction,
  AuthorizationDecision as SharedAuthorizationDecision,
} from "./security-authority";

/**
 * Server adapter contracts for V75.  The concrete route must receive the
 * validated V72 principal from the existing session boundary; these types do
 * not accept a browser persona, Sites owner, role query, or phone number as an
 * authority substitute.
 */
export type CommunicationsApiPath = "conversations" | "messages" | "templates" | "approvals" | "preferences" | "jobs" | "audit" | "settings" | "whatsappRequest" | "whatsappVerify" | "webhook";
export type CommunicationsApiBody = Readonly<{
  operation: "list" | "create" | "reply" | "request_approval" | "decide_approval" | "update_preference" | "request_ai" | "queue" | "request_challenge" | "verify_challenge";
  organizationId: string;
  farmId?: string | null;
  classification?: CommunicationClassification;
  channel?: BackendChannel;
  conversationId?: string;
  businessRecordType?: string;
  businessRecordId?: string;
  sourceRevision?: string;
  idempotencyKey?: string;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type CommunicationsApiContext = Readonly<{
  principalId: string;
  principalOrganizationId: string;
  scope: CommunicationScope;
  permissions: readonly string[];
  farmIds: readonly string[] | null;
}>;

export type CommunicationsApiResponse = Readonly<{
  ok: boolean;
  code: string;
  data?: unknown;
  correlationId: string;
}>;

export type CommunicationsSharedAuthorityRequirement = Readonly<{
  action: AuthorizationAction;
  permission: string;
  approvalPermission?: string;
}>;

export function sharedAuthorityRequirement(
  path: CommunicationsApiPath,
  operation: CommunicationsApiBody["operation"],
): CommunicationsSharedAuthorityRequirement | null {
  const key = `${path}:${operation}`;
  const requirements: Readonly<Record<string, CommunicationsSharedAuthorityRequirement>> = Object.freeze({
    "conversations:list": { action: "view", permission: "communications.view" },
    "conversations:create": { action: "create", permission: "communications.initiate" },
    "messages:list": { action: "view", permission: "communications.view" },
    "messages:reply": { action: "edit", permission: "communications.reply" },
    "templates:list": { action: "view", permission: "communications.templates.view" },
    "templates:create": { action: "create", permission: "communications.templates.create" },
    "approvals:request_approval": { action: "execute", permission: "communications.ai.approve" },
    "approvals:decide_approval": { action: "approve", permission: "communications.ai.approve", approvalPermission: "communications.ai.approve" },
    "preferences:list": { action: "view", permission: "communications.settings.view" },
    "preferences:update_preference": { action: "edit", permission: "communications.settings.manage" },
    "jobs:list": { action: "view", permission: "communications.view" },
    "jobs:queue": { action: "execute", permission: "communications.send" },
    "audit:list": { action: "view", permission: "communications.audit.view" },
    "settings:list": { action: "view", permission: "communications.settings.view" },
  });
  return requirements[key] || null;
}

export function assertSharedApiAuthority(
  decision: SharedAuthorizationDecision,
  requirement: CommunicationsSharedAuthorityRequirement,
) {
  if (!decision.allowed) throw new Error("SHARED_AUTHORITY_DENIED");
  if (decision.permission !== requirement.permission) throw new Error("SHARED_AUTHORITY_PERMISSION_MISMATCH");
  return true;
}

export function assertApiScope(context: CommunicationsApiContext, body: CommunicationsApiBody) {
  if (!context.principalId) throw new Error("AUTHENTICATION_REQUIRED");
  if (context.principalOrganizationId !== body.organizationId) throw new Error("ORGANIZATION_SCOPE_REQUIRED");
  const organizationWide = context.permissions.includes("*") || context.permissions.includes("communications.scope.all");
  if (context.farmIds === null) throw new Error("FARM_ASSIGNMENT_UNRESOLVED");
  if (!body.farmId && !organizationWide) throw new Error("ORGANIZATION_SCOPE_REQUIRED");
  if (body.farmId && !organizationWide && !context.farmIds.includes(body.farmId)) throw new Error("FARM_SCOPE_DENIED");
  return true;
}

export function isSupportedCommunicationApiOperation(path: string, operation: CommunicationsApiBody["operation"]) {
  const supported: Record<string, readonly CommunicationsApiBody["operation"][]> = {
    conversations: ["list", "create"],
    messages: ["list", "reply"],
    templates: ["list", "create"],
    approvals: ["request_approval", "decide_approval"],
    preferences: ["list", "update_preference"],
    jobs: ["list", "queue"],
    audit: ["list"],
    settings: ["list"],
    whatsappRequest: ["request_challenge"],
    whatsappVerify: ["verify_challenge"],
  };
  return Boolean(supported[path]?.includes(operation));
}

export function rejectsArbitrarySendRoute(path: string) {
  return path === "send-message" || path.endsWith("/send-message");
}
