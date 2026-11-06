/**
 * Owner-approved FarmPortal navigation themes. This is presentation metadata
 * only; persistence and authorization must be supplied by the owning app.
 */
export const NAVIGATION_THEMES = Object.freeze([
  Object.freeze({
    id: "bright-jade",
    name: "Bright Jade & Pearl",
    sidebar: "#047857",
    selected: "#10B981",
    accent: "#A7F3D0",
    text: "#F8FFFB",
    secondary: "#064E3B",
    intent: "owner-default",
  }),
  Object.freeze({
    id: "original-navy",
    name: "Current / Original Navy",
    sidebar: null,
    selected: null,
    accent: null,
    text: null,
    secondary: null,
    intent: "preserve-existing-palette",
  }),
  Object.freeze({
    id: "royal-jade",
    name: "Royal Jade & Pearl",
    sidebar: "#075B48",
    selected: "#0D8666",
    accent: "#D9EFE4",
    text: "#FAFCF8",
    secondary: "#1F4D3E",
    intent: "optional",
  }),
]);

export const DEFAULT_NAVIGATION_THEME = "bright-jade";

export function isNavigationThemeId(value) {
  return NAVIGATION_THEMES.some((theme) => theme.id === value);
}

/** Resolve absence only; callers must not replace an existing user setting. */
export function resolveNavigationTheme(preference) {
  return isNavigationThemeId(preference) ? preference : DEFAULT_NAVIGATION_THEME;
}

/**
 * Adapter required from the authorized application integration:
 * load() returns { value, revision } from its real settings authority;
 * save({ value, expectedRevision }) persists and returns the authoritative
 * { value, revision }. UI preview remains local until save succeeds.
 * The settings owner defines global-default vs per-user override scope.
 */
export const NAVIGATION_THEME_ADAPTER_SHAPE = Object.freeze({
  load: "() => Promise<{ value: NavigationThemeId | null, revision: string, canManage: boolean }>",
  save: "({ value, expectedRevision }) => Promise<{ value: NavigationThemeId, revision: string }>",
  permission: "canManage is derived by the authenticated server; false hides the selector; pending access remains noninteractive",
  revision: "Preview is local; save sends the loaded revision; only a successful authoritative response replaces savedValue and revision",
  conflict: "A stale revision preserves the prior savedValue, reports conflict, and requires reloading authoritative settings",
  errors: "Load unavailable/error and save forbidden/error remain distinct; never infer permission or report unsaved preview as saved",
  scope: "Integration owner must define global Owner default versus per-user override and safe migration semantics",
  authorization: "Enforced by the existing server/settings authority; no client-side permission grants",
});
