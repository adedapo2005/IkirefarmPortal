/**
 * FarmPortal Issue #107: source-aware guided-entry contract.
 * Reuses existing authorized lookup infrastructure; never grants permission,
 * constructs durable codes, overwrites user input or submits a business write.
 */
export type GuidedChoice = Readonly<{
  id: string;
  label: string;
  revision: number;
  source: "authenticated-record";
  fields: Readonly<Record<string, string>>;
}>;

export type GuidedField = Readonly<{
  key: string;
  from: string;
  policy: "empty-only" | "review";
  immutable?: boolean;
}>;

export type GuidedProposal = Readonly<{
  selectedId: string;
  source: "authenticated-record";
  revision: number;
  changes: readonly Readonly<{key: string; value: string; previous: string; requiresReview: boolean}>[];
  skipped: readonly string[];
  requiresServerRevalidation: true;
}>;

const safe = (v: unknown) => typeof v === "string" && v.trim().length <= 160 ? v.trim() : "";
const own = (x: object, k: string) => Object.prototype.hasOwnProperty.call(x, k);

/**
 * Never infer data from UI fixtures, outdated suggestions or a different scope.
 * Mapping only explicitly allowed fields prevents accidental rewriting of
 * observed quantities, witness names, price, payroll and approval evidence.
 */
export function proposeAuthorizedPrefill(
  choice: GuidedChoice | null,
  draft: Readonly<Record<string,string>>,
  mapping: readonly GuidedField[],
  allowed: (field: string) => boolean,
): GuidedProposal | null {
  if (!choice || choice.source !== "authenticated-record" ||
      !choice.id || !Number.isSafeInteger(choice.revision) || choice.revision < 1) return null;
  const changes: GuidedProposal["changes"][number][] = [];
  const skipped: string[] = [];
  const visited = new Set<string>();
  for (const field of mapping) {
    if (!field.key || !field.from || visited.has(field.key) ||
        field.immutable || !allowed(field.key) || !own(choice.fields,field.from)) {
      skipped.push(field.key);continue;
    }
    visited.add(field.key);
    const value = safe(choice.fields[field.from]);
    const before = safe(draft[field.key]);
    if (!value || value === before || (before && field.policy === "empty-only")) {
      skipped.push(field.key);continue;
    }
    changes.push({key:field.key,value,previous:before,requiresReview:Boolean(before)});
  }
  return { selectedId:choice.id, source:"authenticated-record", revision:choice.revision,
    changes, skipped, requiresServerRevalidation:true };
}

/** Only a deliberate user action applies the proposed values; Undo is lossless. */
export function applyReviewedPrefill(
  draft: Readonly<Record<string,string>>,
  proposal: GuidedProposal,
  confirmedKeys: readonly string[],
): Record<string,string> {
  const next = {...draft};
  const confirmed = new Set(confirmedKeys);
  for(const change of proposal.changes) {
    if(!confirmed.has(change.key)) continue;
    if((draft[change.key] ?? "") !== change.previous) continue;
    next[change.key] = change.value;
  }
  return next;
}
export function undoReviewedPrefill(
  current: Readonly<Record<string,string>>,
  before: Readonly<Record<string,string>>,
  proposal: GuidedProposal,
): Record<string,string> {
  const next = {...current};
  for (const change of proposal.changes) {
    if (next[change.key] !== change.value) continue;
    if (own(before, change.key)) next[change.key] = before[change.key];
    else delete next[change.key];
  }
  return next;
}
