/** Only non-privileged, approved gateway state is forwarded to public Sign-In. */
export const signInQueryKeys = [
  "auth", "invite", "token", "guarantor", "mode",
  "motion", "background", "presentation", "theme",
] as const;

export function signInQueryString(source: URLSearchParams): string {
  const allowed = new URLSearchParams();
  for (const key of signInQueryKeys) {
    const value = source.get(key);
    if (value) allowed.set(key, value);
  }
  return allowed.toString();
}

export function signInPath(search = ""): string {
  const query = signInQueryString(new URLSearchParams(search));
  return `/signin${query ? `?${query}` : ""}`;
}
