export type SessionRequest = Readonly<{
  generation: number;
  signal: AbortSignal;
}>;

/**
 * Coordinates the mounted entry's session checks.  A logout intent is a
 * terminal latch: automatic revalidation cannot start again, and every
 * response/failure from an older request loses commit authority.
 */
export function createSessionBoundary() {
  let generation = 0;
  let logoutStarted = false;
  let controller: AbortController | null = null;

  const beginRequest = (): SessionRequest | null => {
    if (logoutStarted) return null;
    controller?.abort();
    controller = new AbortController();
    generation += 1;
    return Object.freeze({ generation, signal: controller.signal });
  };

  const canCommit = (requestGeneration: number) =>
    !logoutStarted && requestGeneration === generation;

  const beginLogout = () => {
    if (logoutStarted) return false;
    logoutStarted = true;
    generation += 1;
    controller?.abort();
    controller = null;
    return true;
  };

  const invalidate = () => {
    generation += 1;
    controller?.abort();
    controller = null;
  };

  return Object.freeze({
    beginRequest,
    canCommit,
    beginLogout,
    invalidate,
    logoutStarted: () => logoutStarted,
  });
}
