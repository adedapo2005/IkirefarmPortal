import type { Persona } from "./portal-model.ts";

/**
 * Company-scoped browser preference identity for authenticated users.
 *
 * A valid employee email alone does not establish a company authority.
 * Never use a shared "unassigned-company" placeholder to persist searches,
 * favourites, filters, or other private per-account presentation settings.
 * An unverified company keeps preferences in memory for the current mount.
 */
export function authenticatedPreferenceScope(person: Persona): string | null {
  const email = person.email?.trim().toLowerCase();
  const company = person.organizationScope?.companyKey?.trim();
  if (!email || !company) return null;
  return encodeURIComponent(company) + ":" + encodeURIComponent(email);
}
