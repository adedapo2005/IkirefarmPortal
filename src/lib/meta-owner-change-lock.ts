/** Fail-closed Meta configuration freeze; explicit per-change Owner approval is not yet available. */
export function metaProtectedMutationAllowed(method: string, parts: readonly string[]): boolean {
  if (method === "GET" || method === "HEAD") return true;
  // Send an explicitly confirmed test message without altering protected settings.
  if (method === "POST" && parts.length === 2 && parts[0] === "messages" && parts[1] === "test") return true;
  // All other methods and routes remain locked, including credentials, templates,
  // selection, products, policies, subscription, discovery, diagnostics that write.
  return false;
}
export const META_OWNER_LOCK_CODE = "META_CONFIGURATION_LOCKED_OWNER_APPROVAL_REQUIRED";
