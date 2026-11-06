/**
 * Stage21 source-truth boundary for notification fixtures.
 *
 * Synthetic review notifications may illustrate the UI in the Owner's
 * protected review mode. They are NEVER evidence of a live authenticated
 * notification feed, even if a fixture's route is currently permitted.
 * Backend notification integration must supply its own authorized source.
 */
export function visibleReviewNotifications<T extends { page: string }>(
  reviewMode: boolean,
  fixtures: readonly T[],
  canViewPage: (page: string) => boolean,
): T[] {
  if (!reviewMode) return [];
  return fixtures.filter((notice) => canViewPage(notice.page));
}
