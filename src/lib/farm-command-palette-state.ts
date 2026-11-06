/**
 * Stage 21 NAV-08/NAV-12: global command palette is ephemeral and principal-scoped.
 * Do not persist typed searches or allow a previous principal/farm grant's
 * open dialog/query to render during the transition before React effects run.
 */
import type { Persona } from "./portal-model";

export type CommandPaletteOwner = string | object;

/**
 * A storage key (company + email) is safe for favourites because favourites
 * are re-filtered by the authorized route list. It is NOT sufficient for an
 * open search query: the same employee can switch farms or lose permissions
 * without switching company/email. Keep this fingerprint in memory only.
 */
export function commandPaletteScopeOwner(person: Persona, account: string | null, roleRevision = 0): CommandPaletteOwner {
  // An authenticated principal with no verified email must fail closed.
  // Its object identity must not become a shared synthetic "anonymous" key.
  if (!account) return person;
  const sortedEntries = (record: Readonly<Record<string, string>> | null | undefined) =>
    Object.entries(record ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([
    account,
    person.id,
    person.principalSource ?? "review-fixture",
    person.accessState ?? "",
    person.restriction ?? "",
    person.isOwner === true,
    person.farm,
    person.employeeId,
    person.department,
    person.job,
    [...new Set(person.permissions)].sort(),
    [...new Set(person.self)].sort(),
    sortedEntries(person.organizationScope),
    sortedEntries(person.permissionScopes),
    roleRevision,
  ]);
}
export type CommandPaletteState = {
  owner: CommandPaletteOwner | null;
  open: boolean;
  query: string;
};

export function commandPaletteView(state: CommandPaletteState, owner: CommandPaletteOwner) {
  return {
    open: state.owner === owner && state.open,
    query: state.owner === owner ? state.query : "",
  };
}

export function commandPaletteSetOpen(
  state: CommandPaletteState,
  owner: CommandPaletteOwner,
  next: boolean | ((open: boolean) => boolean),
): CommandPaletteState {
  const sameOwner = state.owner === owner;
  const wasOpen = sameOwner && state.open;
  const open = typeof next === "function" ? next(wasOpen) : next;
  return {
    owner,
    open,
    query: open && sameOwner && state.open ? state.query : "",
  };
}

export function commandPaletteSetQuery(
  state: CommandPaletteState,
  owner: CommandPaletteOwner,
  query: string,
): CommandPaletteState {
  const active = state.owner === owner && state.open;
  return {
    owner,
    open: active,
    query: active ? query : "",
  };
}
