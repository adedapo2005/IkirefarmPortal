import { has, type Page, type Persona } from "./portal-model.ts";
import { authenticatedPreferenceScope } from "./farm-storage-scope.ts";

/**
 * Stage 21A.1: navigation presentation only. These are suggestions, never
 * additional permissions; every suggested route must come from allowed pages.
 */
export type RoleNavigationFocus = Readonly<{
  title: string;
  pages: readonly Page[];
}>;

const roleRoutes = {
  owner: ["dashboard", "owner-decisions", "completion-center", "executive-signals", "audit", "finance"],
  team: ["myday", "attendance-admin", "employees", "recruitment", "people-overview", "performance-management", "leave"],
  farmManager: ["myday", "operations", "eggs", "performance-management", "inventory", "flocks", "reconciliation", "alerts"],
  finance: ["myday", "finance", "expenses", "banking", "profit", "financial-reports"],
  procurement: ["myday", "inventory", "purchase-orders", "suppliers", "procurement", "import-center"],
  farmOperator: ["myday", "eggs", "operations", "notifications", "my-expenses"],
  personal: ["myday", "leave", "my-expenses", "payslips", "notifications", "profile"],
  awaitingAccess: ["approval-status", "profile"],
} as const;

function hasAny(person: Persona, candidates: readonly string[]): boolean {
  // Review role assignments can mutate while the persona object stays stable.
  // Always classify shortcuts from the same effective grants used by route access.
  return candidates.some((permission) => has(person, permission));
}

export function getRoleNavigationFocus(person: Persona, allowed: readonly Page[]): RoleNavigationFocus {
  const isOwner = person.principalSource === "authenticated"
    ? person.isOwner === true && person.accessState === "owner"
    : person.id === "owner";
  const awaitingAccess = ["no_role", "provisional", "provisional_expired"].includes(person.accessState || "")
    || ["no-role", "provisional", "expired"].includes(person.id);
  const job = person.job.toLowerCase();
  const manager = person.farm
    && hasAny(person, ["farm.view", "farm.eggs.view", "farm.feed.view", "farm.health.view"])
    && /\b(manager|supervisor|team lead|foreman|coordinator)\b/i.test(job);
  let title: string;
  let preferred: readonly string[];
  if (awaitingAccess) {
    title = "My Account"; preferred = roleRoutes.awaitingAccess;
  } else if (isOwner) {
    title = "Owner Command"; preferred = roleRoutes.owner;
  } else if (hasAny(person, ["users.admin", "attendance.admin", "hr.recruitment.view"])) {
    title = "Team Focus"; preferred = roleRoutes.team;
  } else if (manager) {
    title = "Farm Team Priorities"; preferred = roleRoutes.farmManager;
  } else if (hasAny(person, ["finance.view", "banking.accounts.view"])) {
    title = "Finance Tasks"; preferred = roleRoutes.finance;
  } else if (hasAny(person, ["procurement.view", "inventory.edit"])) {
    title = "Stock & Procurement"; preferred = roleRoutes.procurement;
  } else if (person.farm && hasAny(person, ["farm.eggs.view", "farm.feed.view", "farm.health.view"])) {
    title = "Farm Daily Work"; preferred = roleRoutes.farmOperator;
  } else {
    title = "My Daily Work"; preferred = roleRoutes.personal;
  }
  const permitted = new Map(allowed.map((page) => [page.id, page]));
  // Returning pages from the allowlist, rather than from the global registry,
  // is essential for employees with restricted company/farm/role scopes.
  const pages = preferred.map((id) => permitted.get(id))
    .filter((page): page is Page => Boolean(page))
    .slice(0, 5);
  return { title, pages };
}

/**
 * Keep local navigation preferences within the current authorized page list.
 * UI filtering alone leaves revoked route IDs in browser storage, allowing
 * stale favourites to reappear after a later grant change. A resolved empty
 * allowlist must clear stored routes too (all grants may have been revoked).
 * The authenticated shell does not mount this component while a principal
 * is still loading or when account access has been disabled.
 */
export function retainAuthorizedNavigation(
  saved: { favorites: string[]; recent: string[] },
  permitted: { has(id: string): boolean; size: number },
): { favorites: string[]; recent: string[] } {
  const filter = (items: string[], limit: number, omitDashboard = false) => {
    const seen = new Set<string>();
    return items.filter((id) => {
      if (typeof id !== "string" || !permitted.has(id) || (omitDashboard && id === "dashboard") || seen.has(id))
        return false;
      seen.add(id);
      return true;
    }).slice(0, limit);
  };
  const favorites = filter(saved.favorites, 12, true);
  const recent = filter(saved.recent, 8);
  if (favorites.length === saved.favorites.length && recent.length === saved.recent.length
    && favorites.every((id, i) => id === saved.favorites[i])
    && recent.every((id, i) => id === saved.recent[i])) return saved;
  return { favorites, recent };
}

/**
 * Isolated, user-specific UI preferences. Deliberately do not import the
 * browser-wide Stage 19 key or the nonunique "Not Assigned" employee number.
 * A missing authenticated email fails closed: nothing is persisted.
 */
export function navigationPreferenceKey(
  person: Persona,
  feature: "shortcuts" | "accordion",
): string | null {
  if (person.principalSource === "authenticated") {
    const scope = authenticatedPreferenceScope(person);
    return scope ? "farmportal.navigation.v21." + feature + ":auth:" + scope : null;
  }
  return "farmportal.navigation.v21." + feature + ":review:" + encodeURIComponent(person.id);
}
