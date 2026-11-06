export type CompletionFeature = {
  featureId: string; featureName: string; module: string; currentRoute: string;
  uiStatus: string; backendStatus: string; integrationStatus: string;
  permissionStatus: string; accessibilityStatus: string; performanceStatus: string;
  priority: string; blockers: string; nextAction: string; finalAcceptanceStatus: string;
};
export type CompletionEvidenceRecord = {
  featureId: string; sourceIntegrated: boolean; reviewedSourceIntegrated: boolean;
  commitSha: string; evidenceUrl: string; featureEvidenceUrl: string; verifiedAt: string;
};
export type CompletionEvidence = {
  schemaVersion: 2;
  status: "EVIDENCE_RECONCILIATION_REQUIRED" | "PARTIAL_SOURCE_EVIDENCE_ONLY";
  sourceCommit: string; workerVersionId: string; registerSnapshotSha256: string;
  trackedFeatures: number; reviewedReleaseCommit: string | null;
  evidenceState: "EMPTY" | "VALID" | "INVALID" | "SOURCE_REVIEW_ONLY" | "RELEASE_MISMATCH";
  coverage: { linkedFeatures: number; sourceVerifiedFeatures: number | null; unreviewedFeatures: number };
  records: CompletionEvidenceRecord[];
  lastEvidenceReconciledAt: string | null;
  verifiedSourceIntegrated: number | null;
  verifiedFunctionalCompletion: null; ownerAccepted: null;
};
export type CompletionRelease = {
  sourceCommit: string; workerVersionId: string; builtAtUtc: string | null;
  environment: string; releaseLabel: string;
};
export type CompletionSnapshot = { release: CompletionRelease; evidence: CompletionEvidence };
export type CompletionLoadState = {
  phase: "loading" | "ready" | "unavailable";
  snapshot: CompletionSnapshot | null; release: CompletionRelease | null;
  checkedAtUtc: string | null; message: string | null;
};
export type CompletionFilters = {
  query: string; status: string; module: string; priority: string;
  verification: "All Evidence" | "Linked Evidence" | "Current Source Verified" |
    "Functional Verification" | "Owner Acceptance" | "Without Current Source Evidence";
};
const SHA = /^[a-f0-9]{40}$/i;
const DIGEST = /^[a-f0-9]{64}$/i;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const evidenceStates = new Set(["EMPTY", "VALID", "INVALID", "SOURCE_REVIEW_ONLY", "RELEASE_MISMATCH"]);
class CompletionViewError extends Error {}
const invalid = (message: string): never => { throw new CompletionViewError(message); };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("The Evidence Response Is Incomplete.");
  return value as Record<string, unknown>;
};
const integer = (value: unknown, maximum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const timestamp = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function requirementUrl(value: unknown): value is string {
  return typeof value === "string" &&
    /^https:\/\/github\.com\/adedapo2005\/daenem-farms\/(?:issues|pull)\/[1-9]\d*(?:#(?:issuecomment-|pullrequestreview-|discussion_r)\d+)?$/.test(value);
}
export function validateCompletionRelease(releaseInput: unknown): CompletionRelease {
  const release = object(releaseInput);
  if (typeof release.sourceCommit !== "string" || !SHA.test(release.sourceCommit) ||
      typeof release.workerVersionId !== "string" || !UUID.test(release.workerVersionId) ||
      release.sourceRepository !== "adedapo2005/daenem-farms") {
    return invalid("The Serving Release Could Not Be Identified.");
  }
  return {
    sourceCommit: release.sourceCommit, workerVersionId: release.workerVersionId,
    builtAtUtc: timestamp(release.builtAtUtc) ? release.builtAtUtc : null,
    environment: typeof release.environment === "string" ? release.environment : "Unknown",
    releaseLabel: typeof release.releaseLabel === "string" ? release.releaseLabel : "Not Reported",
  };
}
export function validateCompletionSnapshot(
  releaseInput: unknown, evidenceInput: unknown, knownFeatureIds: ReadonlySet<string>, expectedRegisterSnapshotSha256: string,
): CompletionSnapshot {
  const release = validateCompletionRelease(releaseInput), evidence = object(evidenceInput);
  if (evidence.sourceCommit !== release.sourceCommit || evidence.workerVersionId !== release.workerVersionId) {
    return invalid("The Evidence Response Does Not Match The Serving Release.");
  }
  if (evidence.schemaVersion !== 2 || evidence.trackedFeatures !== knownFeatureIds.size ||
      typeof evidence.registerSnapshotSha256 !== "string" || !DIGEST.test(evidence.registerSnapshotSha256) ||
      !DIGEST.test(expectedRegisterSnapshotSha256) || evidence.registerSnapshotSha256 !== expectedRegisterSnapshotSha256 ||
      !evidenceStates.has(String(evidence.evidenceState)) ||
      !["EVIDENCE_RECONCILIATION_REQUIRED", "PARTIAL_SOURCE_EVIDENCE_ONLY"].includes(String(evidence.status)) ||
      evidence.verifiedFunctionalCompletion !== null || evidence.ownerAccepted !== null) {
    return invalid("The Current Evidence Contract Could Not Be Verified.");
  }
  if (evidence.reviewedReleaseCommit !== null &&
      (typeof evidence.reviewedReleaseCommit !== "string" || !SHA.test(evidence.reviewedReleaseCommit))) {
    return invalid("The Reviewed Source Reference Is Invalid.");
  }
  if (evidence.lastEvidenceReconciledAt !== null && !timestamp(evidence.lastEvidenceReconciledAt)) {
    return invalid("The Evidence Review Time Is Invalid.");
  }
  const coverage = object(evidence.coverage), total = knownFeatureIds.size;
  if (!integer(coverage.linkedFeatures, total) ||
      coverage.unreviewedFeatures !== total - coverage.linkedFeatures ||
      (coverage.sourceVerifiedFeatures !== null && !integer(coverage.sourceVerifiedFeatures, coverage.linkedFeatures)) ||
      !Array.isArray(evidence.records) || evidence.records.length !== coverage.linkedFeatures) {
    return invalid("The Evidence Coverage Totals Do Not Reconcile.");
  }
  const seen = new Set<string>();
  const records = evidence.records.map((input): CompletionEvidenceRecord => {
    const record = object(input);
    if (typeof record.featureId !== "string" || !knownFeatureIds.has(record.featureId) || seen.has(record.featureId) ||
        typeof record.sourceIntegrated !== "boolean" || typeof record.reviewedSourceIntegrated !== "boolean" ||
        typeof record.commitSha !== "string" || !SHA.test(record.commitSha) ||
        record.evidenceUrl !== "https://github.com/adedapo2005/daenem-farms/commit/" + record.commitSha ||
        !requirementUrl(record.featureEvidenceUrl) || !timestamp(record.verifiedAt)) {
      return invalid("A Requirement Evidence Link Could Not Be Verified.");
    }
    seen.add(record.featureId);
    return {
      featureId: record.featureId, sourceIntegrated: record.sourceIntegrated,
      reviewedSourceIntegrated: record.reviewedSourceIntegrated, commitSha: record.commitSha,
      evidenceUrl: record.evidenceUrl as string, featureEvidenceUrl: record.featureEvidenceUrl,
      verifiedAt: record.verifiedAt,
    };
  });
  const verifiedCount = records.filter((record) => record.sourceIntegrated).length;
  if (evidence.evidenceState === "VALID") {
    if (coverage.sourceVerifiedFeatures !== verifiedCount ||
        (evidence.verifiedSourceIntegrated !== verifiedCount && !(verifiedCount === 0 && evidence.verifiedSourceIntegrated === null))) {
      return invalid("The Current Source Verification Totals Do Not Reconcile.");
    }
  } else if (verifiedCount !== 0 || evidence.verifiedSourceIntegrated !== null ||
      (coverage.sourceVerifiedFeatures !== null && coverage.sourceVerifiedFeatures !== 0)) {
    return invalid("Unverified Evidence Cannot Receive Current Source Credit.");
  }
  if ((evidence.evidenceState === "EMPTY" || evidence.evidenceState === "INVALID") && records.length !== 0) {
    return invalid("Unavailable Evidence Cannot Contain Verified Requirement Links.");
  }
  return {
    release,
    evidence: {
      schemaVersion: 2, status: evidence.status as CompletionEvidence["status"],
      sourceCommit: release.sourceCommit, workerVersionId: release.workerVersionId,
      registerSnapshotSha256: evidence.registerSnapshotSha256 as string, trackedFeatures: total,
      reviewedReleaseCommit: evidence.reviewedReleaseCommit as string | null,
      evidenceState: evidence.evidenceState as CompletionEvidence["evidenceState"],
      coverage: coverage as CompletionEvidence["coverage"], records,
      lastEvidenceReconciledAt: evidence.lastEvidenceReconciledAt as string | null,
      verifiedSourceIntegrated: evidence.verifiedSourceIntegrated as number | null,
      verifiedFunctionalCompletion: null, ownerAccepted: null,
    },
  };
}
export function filterCompletionFeatures(
  rows: readonly CompletionFeature[], filters: CompletionFilters, evidence: CompletionEvidence | null,
): CompletionFeature[] {
  if (filters.verification !== "All Evidence" && (!evidence || evidence.evidenceState === "INVALID")) return [];
  const query = filters.query.trim().toLowerCase();
  const links = new Map((evidence?.records ?? []).map((record) => [record.featureId, record]));
  return rows.filter((row) => {
    if (query && ![row.featureId, row.featureName, row.module, row.currentRoute].join(" ").toLowerCase().includes(query)) return false;
    if (filters.module !== "All Modules" && row.module !== filters.module) return false;
    if (filters.priority !== "All Priorities" && row.priority !== filters.priority) return false;
    if (filters.status === "Open Work" && row.finalAcceptanceStatus === "FULLY IMPLEMENTED") return false;
    if (filters.status !== "Open Work" && filters.status !== "All" &&
        (filters.status === "BACKEND REQUIRED" ? row.backendStatus !== filters.status : row.finalAcceptanceStatus !== filters.status)) return false;
    const record = links.get(row.featureId);
    switch (filters.verification) {
      case "Linked Evidence": return Boolean(record);
      case "Current Source Verified": return evidence?.evidenceState === "VALID" && record?.sourceIntegrated === true;
      case "Functional Verification":
      case "Owner Acceptance": return false; // No requirement-level functional/Owner acceptance contract exists yet.
      case "Without Current Source Evidence":
        return !(evidence?.evidenceState === "VALID" && record?.sourceIntegrated === true);
      default: return true;
    }
  });
}
export function completionStatusLabel(value: string): string {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bUi\b/g, "UI").replace(/\bApi\b/g, "API");
}
export function createCompletionEvidenceLoader(
  knownFeatureIds: ReadonlySet<string>,
  expectedRegisterSnapshotSha256: string,
  onState: (state: CompletionLoadState) => void,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15_000,
) {
  let revision = 0, disposed = false;
  let active: AbortController | null = null;
  const refresh = async () => {
    if (disposed) return;
    const current = ++revision;
    active?.abort();
    const controller = new AbortController();
    active = controller;
    let timedOut = false;
    let validatedRelease: CompletionRelease | null = null;
    const currentRequest = () => !disposed && current === revision;
    const timeout = setTimeout(() => {
      timedOut = true; controller.abort();
      if (currentRequest()) onState({ phase: "unavailable", snapshot: null, release: validatedRelease,
        checkedAtUtc: new Date().toISOString(), message: "The Evidence Check Timed Out. Refresh To Try Again." });
    }, timeoutMs);
    onState({ phase: "loading", snapshot: null, release: null, checkedAtUtc: null, message: null });
    try {
      const releaseTask = async () => {
        const response = await fetcher("/api/release-metadata", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new CompletionViewError("The Serving Release Could Not Be Identified.");
        const data: unknown = await response.json();
        validatedRelease = validateCompletionRelease(data);
        if (currentRequest() && !controller.signal.aborted) onState({ phase: "loading", snapshot: null,
          release: validatedRelease, checkedAtUtc: null, message: null });
        return data;
      };
      const evidenceTask = async () => {
        const response = await fetcher("/api/completion-evidence", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new CompletionViewError("Current Evidence Is Unavailable. Refresh To Try Again.");
        return response.json() as Promise<unknown>;
      };
      const [releaseResult, evidenceResult] = await Promise.allSettled([releaseTask(), evidenceTask()]);
      if (releaseResult.status === "rejected") throw releaseResult.reason;
      if (evidenceResult.status === "rejected") throw evidenceResult.reason;
      const snapshot = validateCompletionSnapshot(releaseResult.value, evidenceResult.value, knownFeatureIds, expectedRegisterSnapshotSha256);
      if (currentRequest() && !controller.signal.aborted) {
        onState({ phase: "ready", snapshot, release: snapshot.release, checkedAtUtc: new Date().toISOString(), message: null });
      }
    } catch (error) {
      if (currentRequest() && (!controller.signal.aborted || timedOut)) {
        onState({
          phase: "unavailable", snapshot: null, release: validatedRelease, checkedAtUtc: new Date().toISOString(),
          message: timedOut ? "The Evidence Check Timed Out. Refresh To Try Again." :
            error instanceof CompletionViewError ? error.message : "Current Evidence Is Unavailable. Refresh To Try Again.",
        });
      }
    } finally { clearTimeout(timeout); }
  };
  return { refresh, dispose() { disposed = true; revision += 1; active?.abort(); } };
}
