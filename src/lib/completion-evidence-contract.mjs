export const COMPLETION_REPOSITORY = "adedapo2005/daenem-farms";
export const COMPLETION_RELEASE_BRANCH = "release/farmportal-staging-2026-10-17-01";
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const timestamp = (value) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
export function canonicalCompletionJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalCompletionJson).join(",") + "]";
  if (object(value)) return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalCompletionJson(value[key])).join(",") + "}";
  throw new Error("Non-JSON completion evidence");
}
export async function completionReportDigest(report) {
  const bytes = new TextEncoder().encode(canonicalCompletionJson(report));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function parseCompletionRequirementUrl(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^https:\/\/github\.com\/adedapo2005\/daenem-farms\/(issues|pull)\/([1-9][0-9]*)(?:#(issuecomment-[1-9][0-9]*|discussion_r[1-9][0-9]*|pullrequestreview-[1-9][0-9]*))?$/);
  if (!match || (match[1] !== "pull" && match[3] && !match[3].startsWith("issuecomment-"))) return null;
  return { kind: match[1], number: match[2], anchor: match[3] || null };
}
export function isCompletionImplementationPath(path) {
  return typeof path === "string" && path.length <= 300 &&
    /^(?:app|components|lib|src|worker|workers|shared)\/[A-Za-z0-9_./@()[\] +\-]+$/.test(path) &&
    !path.split("/").some((part) => part === "." || part === ".." || !part) &&
    /\.(?:ts|tsx|js|jsx|mjs|cjs|css|scss|json|sql|html|vue|svelte)$/.test(path) &&
    !/(?:^|\/)(?:__tests__|tests|fixtures|__fixtures__)(?:\/|$)|\.(?:test|spec)\.[^/]+$/.test(path) &&
    !/^lib\/(?:completion-evidence|feature-register)[^/]*\.json$/.test(path);
}
export function validCompletionSourceFiles(files) {
  if (!Array.isArray(files) || files.length === 0 || files.length > 100) return false;
  const seen = new Set();
  return files.every((file) => {
    if (!object(file) || !isCompletionImplementationPath(file.path) ||
        seen.has(file.path) || !SHA.test(file.blob || "") || !["100644", "100755"].includes(file.mode)) return false;
    seen.add(file.path);
    return true;
  });
}

/** Validate bundled, source-only evidence. Failure never turns into progress credit. */
export function validateCompletionReport(report, provenance, register) {
  const invalid = { ok: false, empty: false, records: [], reviewedReleaseCommit: null, lastEvidenceReconciledAt: null };
  if (!Array.isArray(register) || !object(provenance) || !DIGEST.test(provenance.snapshotSha256 || "")) return invalid;
  const ids = register.map((row) => row?.featureId);
  const known = new Set(ids);
  if (!ids.every((id) => typeof id === "string" && id.length > 0) || known.size !== ids.length) return invalid;
  if (!object(report) || report.repository !== COMPLETION_REPOSITORY || report.snapshotSha256 !== provenance.snapshotSha256 ||
      report.trackedFeatures !== known.size || !Array.isArray(report.records)) return invalid;
  if (report.verifiedFunctionalCompletion != null || report.ownerAccepted != null) return invalid;
  if (report.records.length === 0) {
    if (![1, 2].includes(report.schemaVersion) || report.status !== "EVIDENCE_RECONCILIATION_REQUIRED" ||
        (report.linkedFeatures != null && report.linkedFeatures !== 0) ||
        (report.reviewedSourceIntegrated != null && report.reviewedSourceIntegrated !== 0) ||
        (report.verifiedSourceIntegrated != null && report.verifiedSourceIntegrated !== 0) ||
        report.lastEvidenceReconciledAt != null) return invalid;
    return { ok: true, empty: true, records: [], reviewedReleaseCommit: null, lastEvidenceReconciledAt: null };
  }
  if (report.schemaVersion !== 2 || report.status !== "PARTIAL_SOURCE_EVIDENCE_ONLY" || report.verifiedSourceIntegrated != null ||
      !SHA.test(report.reviewedReleaseCommit || "") || !timestamp(report.lastEvidenceReconciledAt) ||
      report.linkedFeatures !== report.records.length) return invalid;
  const seen = new Set();
  for (const record of report.records) {
    if (!object(record) || !known.has(record.featureId) || seen.has(record.featureId) ||
        typeof record.sourceIntegrated !== "boolean" || record.verifiedRequirementReference !== true ||
        !SHA.test(record.commitSha || "") || record.evidenceUrl !== "https://github.com/" + COMPLETION_REPOSITORY + "/commit/" + record.commitSha ||
        !parseCompletionRequirementUrl(record.featureEvidenceUrl) || !timestamp(record.verifiedAt) ||
        Date.parse(record.verifiedAt) > Date.parse(report.lastEvidenceReconciledAt) ||
        (record.sourceFiles !== undefined && !validCompletionSourceFiles(record.sourceFiles))) return invalid;
    seen.add(record.featureId);
  }
  if (report.reviewedSourceIntegrated !== report.records.filter((record) => record.sourceIntegrated).length) return invalid;
  return { ok: true, empty: false, records: report.records, reviewedReleaseCommit: report.reviewedReleaseCommit, lastEvidenceReconciledAt: report.lastEvidenceReconciledAt };
}
/** Only deployment-owned, exact-source/digest attestation grants CURRENT source credit. */
export async function buildCompletionEvidenceResponse({ report, provenance, register, sourceCommit, workerVersionId, attestation }) {
  const trackedFeatures = Array.isArray(register) ? new Set(register.map((row) => row?.featureId).filter((id) => typeof id === "string")).size : 0;
  const currentSource = typeof sourceCommit === "string" && SHA.test(sourceCommit) ? sourceCommit : null;
  const worker = typeof workerVersionId === "string" && workerVersionId.trim() ? workerVersionId : null;
  const validation = validateCompletionReport(report, provenance, register);
  let evidenceState = validation.ok ? validation.empty ? "EMPTY" : "SOURCE_REVIEW_ONLY" : "INVALID";
  let sourceVerification = validation.empty ? "NO_LINKED_EVIDENCE" : validation.ok ? "NOT_ATTESTED" : "INVALID_REPORT";
  let verifiedIds = null;
  if (validation.ok && !validation.empty && typeof attestation === "string" && attestation.trim()) {
    try {
      const value = JSON.parse(attestation);
      const linked = new Set(validation.records.map((record) => record.featureId));
      const valid = object(value) && value.schemaVersion === 1 && value.repository === COMPLETION_REPOSITORY &&
        SHA.test(value.sourceCommit || "") && DIGEST.test(value.reportSha256 || "") &&
        value.registerSnapshotSha256 === provenance.snapshotSha256 && timestamp(value.createdAtUtc) &&
        Array.isArray(value.sourceVerifiedFeatureIds) &&
        value.sourceVerifiedFeatureIds.length > 0 &&
        value.sourceVerifiedFeatureIds.every((id) => typeof id === "string" && linked.has(id) && validation.records.find((record) => record.featureId === id)?.sourceIntegrated === true && validCompletionSourceFiles(validation.records.find((record) => record.featureId === id)?.sourceFiles)) &&
        new Set(value.sourceVerifiedFeatureIds).size === value.sourceVerifiedFeatureIds.length;
      if (!valid || !currentSource || !worker) sourceVerification = "INVALID_ATTESTATION";
      else if (value.sourceCommit !== currentSource) { evidenceState = "RELEASE_MISMATCH"; sourceVerification = "SOURCE_MISMATCH"; }
      else if (value.reportSha256 !== await completionReportDigest(report)) sourceVerification = "REPORT_MISMATCH";
      else { verifiedIds = new Set(value.sourceVerifiedFeatureIds); evidenceState = "VALID"; sourceVerification = "VERIFIED"; }
    } catch { sourceVerification = "INVALID_ATTESTATION"; }
  }
  const records = validation.ok ? validation.records.map((record) => ({
    featureId: record.featureId,
    sourceIntegrated: verifiedIds?.has(record.featureId) ?? false,
    reviewedSourceIntegrated: record.sourceIntegrated,
    commitSha: record.commitSha,
    evidenceUrl: record.evidenceUrl,
    featureEvidenceUrl: record.featureEvidenceUrl,
    verifiedAt: record.verifiedAt,
  })) : [];
  return {
    schemaVersion: 2,
    status: records.length ? "PARTIAL_SOURCE_EVIDENCE_ONLY" : "EVIDENCE_RECONCILIATION_REQUIRED",
    sourceCommit: currentSource, workerVersionId: worker,
    registerSnapshotSha256: typeof provenance?.snapshotSha256 === "string" ? provenance.snapshotSha256 : "",
    trackedFeatures,
    reviewedReleaseCommit: validation.ok ? validation.reviewedReleaseCommit : null,
    evidenceState, sourceVerification,
    coverage: { linkedFeatures: records.length, sourceVerifiedFeatures: validation.ok && validation.empty ? 0 : verifiedIds?.size ?? null, unreviewedFeatures: trackedFeatures - records.length },
    records,
    verifiedSourceIntegrated: verifiedIds?.size ?? null,
    verifiedFunctionalCompletion: null,
    ownerAccepted: null,
    lastEvidenceReconciledAt: validation.ok ? validation.lastEvidenceReconciledAt : null,
  };
}
