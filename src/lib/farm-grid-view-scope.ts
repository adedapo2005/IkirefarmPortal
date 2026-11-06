import { commandPaletteScopeOwner, type CommandPaletteOwner } from "./farm-command-palette-state.ts";
import type { Persona } from "./portal-model.ts";

/**
 * An authenticated session without a verified storage key must not reuse
 * browser preferences, but its in-memory grid still needs to react to grant,
 * farm, or role-policy changes on the same Persona object. A WeakMap keeps
 * anonymous owner tokens private to that object and never persists them.
 */
const anonymousOwners = new WeakMap<Persona, { fingerprint: string; token: object }>();

export function enterpriseGridRenderOwner(
  person: Persona,
  preferenceKey: string | null,
  roleRevision: number,
): CommandPaletteOwner {
  if (preferenceKey) return commandPaletteScopeOwner(person, preferenceKey, roleRevision);
  const fingerprint = commandPaletteScopeOwner(person, "memory-only-unverified-grid", roleRevision) as string;
  const prior = anonymousOwners.get(person);
  if (prior?.fingerprint === fingerprint) return prior.token;
  const token = {};
  anonymousOwners.set(person, { fingerprint, token });
  return token;
}

/**
 * Preview is ephemeral and belongs to both an authorization scope and
 * an actual row in the latest authorized dataset. Never rehydrate old rows
 * from a prior farm, grant, employee, or refreshed source snapshot.
 */
export function scopedGridPreviewRow<T>(
  row: T | null,
  currentRows: readonly T[],
  loadedOwner: CommandPaletteOwner,
  currentOwner: CommandPaletteOwner,
): T | null {
  return loadedOwner === currentOwner && row !== null && currentRows.includes(row)
    ? row
    : null;
}
