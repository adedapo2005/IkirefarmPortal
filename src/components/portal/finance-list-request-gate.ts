// A UI-only request epoch: late results from a previous collection, search,
// or authenticated scope must never be committed into the current Finance view.
// This does not authorize data; the server remains the permission authority.
// Filter previously loaded linked-record options by the *current* authorized
// scope and selected source type, including the first render after a scope swap.
export function currentFinanceSourceChoices<T>(
  choices: { scopeKey: string; sourceKind: string; items: T[] } | null,
  scopeKey: string,
  sourceKind: string | undefined,
): T[] {
  return choices?.scopeKey === scopeKey && choices.sourceKind === sourceKind
    ? choices.items : [];
}

export function createFinanceReadGate() {
  let version = 0;
  return {
    begin() { version += 1; return version; },
    invalidate() { version += 1; },
    snapshot() { return version; },
    isCurrent(requestVersion: number) { return requestVersion === version; },
  };
}
