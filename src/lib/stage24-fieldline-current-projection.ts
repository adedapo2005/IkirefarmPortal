/** Fieldline consumes only the already-authorized and validated Daily Flock
 * workspace. This adapter does not grant access or perform a network read. */
import type { CanonicalDailyFlockRecord } from "./stage25-canonical-daily-flock-feedback.ts";
import type { DailyFlockProjection, DailyFlockMetric } from "./stage25-canonical-daily-flock-workspace.ts";
import { buildFieldlineHistory } from "./stage24-fieldline-history.ts";
import type { MissionData } from "./stage24-fieldline-rbac.ts";

export function buildCurrentFieldlineProjection(
  flock: Readonly<{id:string;flockCode:string}>, localDate:string,
  projection: DailyFlockProjection, history: readonly CanonicalDailyFlockRecord[],
) {
  if (!flock.id || !flock.flockCode || projection.localDay.localDate !== localDate) return null;
  const days=buildFieldlineHistory(history,flock.id,localDate);
  const selected=days.find(day=>day.localDate===localDate);
  if (!selected) return null;
  const daily=projection.localDay;
  // History and projection are separate authorized reads. A changed or
  // contradictory approval state must not be displayed as a verified source.
  if (daily.approvalState === "missing" ? selected.approved !== 0 : selected.approved !== 1) return null;
  if (daily.approvalState === "approved") {
    const approved = history.find(report => report.state === "approved" &&
      report.data.flockId === flock.id && report.data.localDate === localDate);
    if (!approved || approved.data.physicalCount !== projection.currentBirds.physicalCount) return null;
    const metrics = [
      ["mortality", daily.mortality], ["feed", daily.feedConsumedKg],
      ["medication", daily.medicationEvents], ["vaccination", daily.vaccinationEvents],
    ] as const;
    for (const [kind, metric] of metrics) {
      const ids = approved.data.eventRefs.filter(ref => ref.kind === kind).map(ref => ref.id).sort();
      const none = approved.data.noneToday?.[kind] === true;
      if (metric.status === "recorded" &&
          (none || ids.length !== metric.sourceIds.length ||
           ids.some((id, index) => id !== [...metric.sourceIds].sort()[index]))) return null;
      if (metric.status === "none-recorded" && (!none || ids.length !== 0)) return null;
      if (metric.status === "not-yet-recorded" && (none || ids.length !== 0)) return null;
    }
  }
  const numeric=(metric:DailyFlockMetric) =>
    (metric.status==="recorded" || metric.status==="none-recorded") ? metric.value : undefined;
  const refs=(metric:DailyFlockMetric) => metric.status==="recorded" ? metric.sourceIds : [];
  const placement=projection.flockPlacement;
  const source:MissionData={
    flockCode:flock.flockCode,localDate,approvalState:daily.approvalState,
    mortality:numeric(daily.mortality),feedKg:numeric(daily.feedConsumedKg),
    medicationEvents:numeric(daily.medicationEvents),vaccinationEvents:numeric(daily.vaccinationEvents),
    physicalCount:projection.currentBirds.physicalCount,
    reportCount:selected.reports,linkedEvidence:selected.evidenceRefs,pendingReviews:selected.submitted,
    metricStates:{mortality:daily.mortality.status,feed:daily.feedConsumedKg.status,
      medication:daily.medicationEvents.status,vaccinations:daily.vaccinationEvents.status},
    sourceRefs:{mortality:refs(daily.mortality),feed:refs(daily.feedConsumedKg),
      medication:refs(daily.medicationEvents),vaccinations:refs(daily.vaccinationEvents)},
    ...(placement ? {openingBirds:placement.openingBirds,placementDate:placement.placementDate,
      placementSource:{id:placement.sourceId,revision:placement.sourceRevision}} : {}),
  };
  return Object.freeze({source:Object.freeze(source),history:days});
}
