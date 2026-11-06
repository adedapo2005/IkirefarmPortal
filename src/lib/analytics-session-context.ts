// The digest is a context precondition, not a credential or authorization.
// Both ends derive it from the validated principal snapshot; the server still
// resolves and authorizes the cookie on every request.
export async function analyticsSessionContext(securityStamp: string): Promise<string> {
  const bytes = new TextEncoder().encode(securityStamp);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
