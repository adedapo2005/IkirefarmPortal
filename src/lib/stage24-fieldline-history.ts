/** Derived only from a complete canonical, authenticated Daily Flock history read. */
import type { CanonicalDailyFlockRecord } from "./stage25-canonical-daily-flock-feedback.ts";

export type FieldlineHistoryDay = Readonly<{
  localDate: string; reports: number; approved: number; submitted: number;
  draft: number; rejected: number; evidenceRefs: number;
  physicalCount?: Readonly<{ status: "recorded" | "missing" | "conflict"; value?: number; sourceId?: string }>;
}>;
const isDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ms = Date.parse(v + "T00:00:00Z");
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v;
};
export function buildFieldlineHistory(
  history: readonly CanonicalDailyFlockRecord[],
  authorizedFlockId: string,
  selectedDate: string,
): readonly FieldlineHistoryDay[] {
  if (!authorizedFlockId || !isDate(selectedDate)) return [];
  const anchor = Date.parse(selectedDate + "T00:00:00Z");
  const days: FieldlineHistoryDay[] = [];
  for (let index = 6; index >= 0; index--) {
    const localDate = new Date(anchor - index * 86_400_000).toISOString().slice(0, 10);
    const matched = history.filter(report =>
      report.data.flockId === authorizedFlockId && report.data.localDate === localDate);
    const approved = matched.filter(report => report.state === "approved");
    const count = approved[0]?.data.physicalCount;
    // Multiple approved sources require review even when their numbers agree.
    const physicalCount = approved.length > 1
      ? Object.freeze({ status: "conflict" as const })
      : approved.length === 1 && Number.isSafeInteger(count) && Number(count) >= 0
        ? Object.freeze({ status: "recorded" as const, value: count, sourceId: approved[0].id })
        : Object.freeze({ status: "missing" as const });
    days.push(Object.freeze({
      localDate, physicalCount,
      reports: matched.length,
      approved: matched.filter(report => report.state === "approved").length,
      submitted: matched.filter(report => report.state === "submitted").length,
      draft: matched.filter(report => report.state === "draft").length,
      rejected: matched.filter(report => report.state === "rejected").length,
      evidenceRefs: matched.reduce((sum, report) => sum + report.data.eventRefs.length, 0),
    }));
  }
  return Object.freeze(days);
}
