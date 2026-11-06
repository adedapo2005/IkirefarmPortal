"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Blocks, CheckCircle2, ClipboardList, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import register from "@/lib/feature-register-summary.json";
import registerProvenance from "@/lib/feature-register-provenance.json";
import {
  completionStatusLabel, createCompletionEvidenceLoader, filterCompletionFeatures,
  type CompletionFeature, type CompletionFilters, type CompletionLoadState,
} from "@/lib/completion-center-view";
import { Btn, Chip } from "./Common";
import LoggedTimestamp from "./LoggedTimestamp";
import styles from "./ImplementationCompletionCenter.module.css";

const rows = register as CompletionFeature[];
const featureIds = new Set(rows.map((row) => row.featureId));
const modules = [...new Set(rows.map((row) => row.module))].sort();
const priorities = [...new Set(rows.map((row) => row.priority))].sort();
const PAGE_SIZE = 40;
const defaultFilters: CompletionFilters = {
  query: "", status: "Open Work", module: "All Modules", priority: "All Priorities", verification: "All Evidence",
};
const statusOptions = ["Open Work", "All", "FULLY IMPLEMENTED", "PARTIALLY IMPLEMENTED", "BACKEND REQUIRED",
  "REMEDIATION REQUIRED", "OWNER INPUT REQUIRED", "OWNER ASSET REQUIRED"];
const verificationOptions: CompletionFilters["verification"][] = [
  "All Evidence", "Linked Evidence", "Current Source Verified", "Functional Verification", "Owner Acceptance", "Without Current Source Evidence",
];
function percentage(values: string[], complete: (value: string) => boolean) {
  if (!values.length) return 0;
  return Math.round((values.filter(complete).length / values.length) * 100);
}
function dateLabel(value: string | null | undefined) {
  return value ? <LoggedTimestamp value={value}/> : "Not Reported";
}
export default function ImplementationCompletionCenter() {
  const [filters, setFilters] = useState<CompletionFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [load, setLoad] = useState<CompletionLoadState>({ phase: "loading", snapshot: null, release: null, checkedAtUtc: null, message: null });
  const loader = useRef<ReturnType<typeof createCompletionEvidenceLoader> | null>(null);
  useEffect(() => {
    const current = createCompletionEvidenceLoader(featureIds, registerProvenance.snapshotSha256, setLoad);
    loader.current = current;
    void current.refresh();
    return () => { current.dispose(); if (loader.current === current) loader.current = null; };
  }, []);
  const setFilter = (change: Partial<CompletionFilters>) => { setFilters((current) => ({ ...current, ...change })); setPage(0); };
  const resetFilters = () => { setFilters(defaultFilters); setPage(0); };
  const evidence = load.snapshot?.evidence ?? null, deployment = load.release;
  const coverageAvailable = evidence !== null && evidence.evidenceState !== "INVALID";
  const evidenceByFeature = useMemo(() => new Map((evidence?.records ?? []).map((record) => [record.featureId, record])), [evidence]);
  const filtered = useMemo(() => filterCompletionFeatures(rows, filters, evidence), [filters, evidence]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const firstRecord = currentPage * PAGE_SIZE;
  const visibleRows = filtered.slice(firstRecord, firstRecord + PAGE_SIZE);
  const counts = useMemo(() => ({
    fully: rows.filter((row) => row.finalAcceptanceStatus === "FULLY IMPLEMENTED").length,
    partial: rows.filter((row) => row.finalAcceptanceStatus === "PARTIALLY IMPLEMENTED").length,
    backend: rows.filter((row) => row.backendStatus === "BACKEND REQUIRED").length,
    provider: rows.filter((row) => row.integrationStatus === "PROVIDER REQUIRED").length,
    owner: rows.filter((row) => row.finalAcceptanceStatus === "OWNER INPUT REQUIRED" || row.finalAcceptanceStatus === "OWNER ASSET REQUIRED").length,
    remediation: rows.filter((row) => row.finalAcceptanceStatus === "REMEDIATION REQUIRED").length,
    newRequirements: rows.filter((row) => row.featureId.startsWith("REQ-DFR-")).length,
  }), []);
  const uiCompletion = percentage(rows.map((row) => row.uiStatus), (value) => value === "FRONTEND IMPLEMENTED" || value === "IMPLEMENTED — VERIFICATION REQUIRED" || value === "FULLY IMPLEMENTED");
  const backendCompletion = percentage(rows.map((row) => row.backendStatus), (value) => value === "FULLY IMPLEMENTED" || value === "NOT REQUIRED");
  const integrationCompletion = percentage(rows.map((row) => row.integrationStatus), (value) => value === "FULLY IMPLEMENTED" || value === "NOT REQUIRED");
  const securityCompletion = percentage(rows.map((row) => row.permissionStatus), (value) => value === "FULLY IMPLEMENTED" || value === "NOT REQUIRED");
  const accessibilityCompletion = percentage(rows.map((row) => row.accessibilityStatus), (value) => value === "FULLY IMPLEMENTED" || value === "NOT REQUIRED");
  const performanceCompletion = percentage(rows.map((row) => row.performanceStatus), (value) => value === "FULLY IMPLEMENTED" || value === "NOT REQUIRED");
  const moduleCompletion = percentage(rows.map((row) => row.finalAcceptanceStatus), (value) => value === "FULLY IMPLEMENTED");

  const checking = load.phase === "loading";
  const stateTitle = checking ? "Checking Current Evidence" : load.phase === "unavailable" ? "Evidence Unavailable" :
    evidence?.evidenceState === "INVALID" ? "Evidence Validation Required" :
      evidence?.evidenceState === "RELEASE_MISMATCH" ? "Evidence Belongs To Another Release" :
        evidence?.evidenceState === "SOURCE_REVIEW_ONLY" ? "Linked Review Evidence Only" :
          evidence?.evidenceState === "VALID" ? "Current Source Evidence Available" : "Reconciliation Required";
  const stateDetail = checking ? "The previous snapshot is cleared while the serving release and its evidence are checked." :
    load.message ?? (evidence?.evidenceState === "VALID"
      ? "Source evidence is linked below. Functional completion and Owner acceptance still require their own verified records."
      : evidence?.evidenceState === "SOURCE_REVIEW_ONLY" || evidence?.evidenceState === "RELEASE_MISMATCH"
        ? "Requirement links remain available for review, but they do not receive current source credit until verified against the serving release."
        : evidence?.evidenceState === "INVALID"
          ? "No current completion credit is applied. The evidence must be corrected and reconciled before it can be used."
          : "No requirement-linked evidence is available yet. Review historical records below.");
  const filteredByVerification = filters.verification !== "All Evidence";
  const emptyDetail = filteredByVerification && (load.phase !== "ready" || evidence?.evidenceState === "INVALID")
    ? "Current verification evidence is unavailable. Refresh the evidence or choose All Evidence to inspect the historical register."
    : filters.verification === "Functional Verification"
      ? "No requirement-level functional acceptance records are linked. This does not mean the project is 0% complete."
      : filters.verification === "Owner Acceptance"
        ? "No requirement-level Owner acceptance records are linked. Owner acceptance remains unverified."
        : filters.verification === "Current Source Verified"
          ? "No matching feature has verified source evidence for the serving release. Review linked evidence or adjust the other filters."
          : filters.verification === "Linked Evidence" && evidence?.evidenceState === "EMPTY"
            ? "No requirement-specific evidence has passed the reconciliation pipeline yet. Local artifacts are reviewed separately; this is not a claim that the features are absent."
            : "No tracked features match these filters. Clear or adjust the filters to continue.";
  const hasFilters = Object.keys(defaultFilters).some((key) => filters[key as keyof CompletionFilters] !== defaultFilters[key as keyof CompletionFilters]);

  return (
    <section className={"completion-center " + styles.center} aria-labelledby="completion-center-title">
      <header className={"completion-hero " + styles.hero}>
        <div><span className="eyebrow">Owner-Only Review</span>
          <h1 id="completion-center-title">Implementation Completion Center</h1>
          <p>Review verified evidence, blockers and Owner decisions.</p>
        </div>
        <ClipboardList aria-hidden="true" />
      </header>
      <section className={styles.current} aria-labelledby="completion-current-title" aria-busy={checking}>
        <div className={styles.sectionHeading}>
          <div><h2 id="completion-current-title">Current Verification</h2><p>{load.checkedAtUtc ? <>Checked {dateLabel(load.checkedAtUtc)}</> : "Checking The Serving Release"}</p></div>
          <button type="button" className={styles.refresh} disabled={checking} aria-label={checking ? "Checking Evidence" : "Refresh Live Evidence"} title={checking ? "Checking Evidence" : "Refresh Live Evidence"} onClick={() => { void loader.current?.refresh(); }}>
            <RefreshCw size={16} aria-hidden="true" /><span className={styles.refreshLabel}>{checking ? "Checking Evidence" : "Refresh Live Evidence"}</span>
          </button>
        </div>
        <div className={"completion-provenance " + styles.evidenceStatus} role="status">
          <AlertTriangle aria-hidden="true" /><div><strong>{stateTitle}</strong><p>{stateDetail}</p></div>
        </div>
        <div className={styles.coverage} role="group" aria-label="Current Evidence Coverage">
          <article><span>Requirement Evidence</span><strong>{coverageAvailable ? evidence.coverage.linkedFeatures + " / " + rows.length : checking ? "Checking" : "Unavailable"}</strong><small>Tracked Features With Linked Evidence</small></article>
          <article><span>Current Source Verified</span><strong>{evidence?.verifiedSourceIntegrated ?? (checking ? "Checking" : "Not Yet Verified")}</strong><small>Source Integration Only · Functional Acceptance Is Separate</small></article>
          <article><span>Functional Completion</span><strong>{checking ? "Checking" : "Not Yet Verified"}</strong><small>Requires Requirement-Level Functional Evidence</small></article>
          <article><span>Owner Acceptance</span><strong>{checking ? "Checking" : "Not Yet Verified"}</strong><small>Requires Explicit Recorded Owner Acceptance</small></article>
        </div>
        <p className={styles.coverageNote}>{coverageAvailable ? evidence.coverage.unreviewedFeatures + " Features Without Linked Evidence. " : ""}Evidence coverage is not a project-completion percentage.</p>
        {evidence?.evidenceState==='EMPTY'&&<details className={styles.releaseDetails}>
          <summary>Why The Evidence List Is Empty</summary>
          <p>The bundled report contains no reconciled requirement records. Local checks, held candidates, business decisions, independent review and official acceptance are separate evidence stages.</p>
          <p>Each source-evidence entry needs a specific requirement, immutable reviewed source, a verified requirement link and applicable file proof. Current-source credit also requires matching release attestation. A local artifact list or a working navigation link does not supply that proof.</p>
          <p>Local review material remains outside this interface until its provenance and disclosure boundary are reviewed. Raw diagnostics and logs are not published here. Functional and Owner acceptance remain unverified.</p>
        </details>}
        <details className={"completion-provenance " + styles.releaseDetails}>
          <summary>Release And Evidence Details</summary>
          <dl><div><dt>Serving Source</dt><dd>{deployment?.sourceCommit ?? (checking ? "Checking" : "Unavailable")}</dd></div>
            <div><dt>Worker Version</dt><dd>{deployment?.workerVersionId ?? (checking ? "Checking" : "Unavailable")}</dd></div>
            <div><dt>Environment</dt><dd>{deployment ? completionStatusLabel(deployment.environment) : "Not Verified"}</dd></div>
            <div><dt>Build Time</dt><dd>{dateLabel(deployment?.builtAtUtc)}</dd></div>
            <div><dt>Evidence Reviewed Against</dt><dd>{evidence?.reviewedReleaseCommit ?? "Not Yet Verified"}</dd></div>
            <div><dt>Last Evidence Reconciliation</dt><dd>{dateLabel(evidence?.lastEvidenceReconciledAt)}</dd></div>
          </dl>
        </details>
      </section>
      <details className={styles.baseline}>
        <summary>Historical Baseline <span>{rows.length} Tracked Features</span></summary>
        <div className="completion-disclosure"><AlertTriangle aria-hidden="true" /><div><strong>Baseline Progress — Current Verification Pending</strong><p>These preserved classifications support planning. They do not establish current release acceptance, and fixtures or design surfaces do not count as working backend completion. Every tracked feature remains available until it is completed or explicitly deprecated by the Owner.</p></div></div>
        <div className="completion-score-grid" role="group" aria-label="Historical Completion Dimensions">
          {[{label:"Design / UI Completion",value:uiCompletion,icon:Gauge},{label:"Backend Completion",value:backendCompletion,icon:Blocks},{label:"Integration Completion",value:integrationCompletion,icon:ShieldCheck},{label:"Security Completion",value:securityCompletion,icon:ShieldCheck},{label:"Accessibility Completion",value:accessibilityCompletion,icon:Gauge},{label:"Performance Completion",value:performanceCompletion,icon:Gauge},{label:"Module Completion",value:moduleCompletion,icon:CheckCircle2}].map((metric) => { const Icon=metric.icon; return <article key={metric.label}><Icon aria-hidden="true"/><span>{metric.label}</span><strong>{metric.value}%</strong><small>Historical Register · {rows.length} Tracked Features</small></article>; })}
          <article><CheckCircle2 aria-hidden="true"/><span>Fully Implemented</span><strong>{counts.fully}</strong><small>Historical Classification · Owner Recheck Required</small></article>
        </div>
        <div className="completion-gap-grid">
          {[["Partially Implemented",counts.partial],["Backend Required",counts.backend],["Provider Required",counts.provider],["Owner Input / Asset",counts.owner],["Remediation Required",counts.remediation],["Newly Registered Requirements",counts.newRequirements],["Recent Strict Closures","Not Verified"],["Open Regressions","Not Verified"]].map(([label,value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}
        </div>
      </details>
      <section className={styles.register} aria-labelledby="completion-register-title">
        <div className={styles.sectionHeading}><div><h2 id="completion-register-title">Tracked Work And Blockers</h2><p>Filter historical classifications and current evidence separately.</p></div></div>
        <div className={"completion-toolbar " + styles.toolbar}>
          <label><span>Search Tracked Features</span><input value={filters.query} onChange={(event) => setFilter({ query: event.target.value })} placeholder="Search Feature, Module, Route, Or ID" /></label>
          <label><span>Historical Status</span><select value={filters.status} onChange={(event) => setFilter({ status: event.target.value })}>{statusOptions.map((option) => <option key={option} value={option}>{completionStatusLabel(option)}</option>)}</select></label>
          <label><span>Module</span><select value={filters.module} onChange={(event) => setFilter({ module: event.target.value })}><option>All Modules</option>{modules.map((module) => <option key={module}>{module}</option>)}</select></label>
          <label><span>Priority</span><select value={filters.priority} onChange={(event) => setFilter({ priority: event.target.value })}><option>All Priorities</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
          <label><span>Verification</span><select value={filters.verification} onChange={(event) => setFilter({ verification: event.target.value as CompletionFilters["verification"] })}>{verificationOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <Chip tone="blue">{filtered.length} Matching Features</Chip>
          {hasFilters && <button type="button" className={styles.clearFilters} onClick={resetFilters}>Clear Filters</button>}
        </div>
        <p id="completion-register-hint" className={styles.tableHint}>Historical classifications do not establish current acceptance. On phones, use the labeled record cards; on desktop, scroll the full table if needed.</p>
        <div className="completion-table-wrap" role="region" tabIndex={0} aria-label="Master Feature Implementation Register" aria-describedby="completion-register-hint">
          <table><caption>Historical feature-register classifications. Current source evidence does not verify functional or Owner acceptance.</caption>
            <thead><tr><th scope="col">Feature</th><th scope="col">Module</th><th scope="col">UI</th><th scope="col">Backend</th><th scope="col">Integration</th><th scope="col">Priority</th><th scope="col">Historical Acceptance</th><th scope="col">Blockers And Next Action</th></tr></thead>
            <tbody>{visibleRows.map((row) => {
              const record = evidenceByFeature.get(row.featureId);
              return <tr key={row.featureId}><td><strong>{row.featureId}</strong><span>{row.featureName}</span><small>{row.currentRoute}</small>
                {record && <div className={styles.rowEvidence}><span>{record.sourceIntegrated ? "Current Source Verified" : "Linked Review Evidence"}</span><a href={record.featureEvidenceUrl} target="_blank" rel="noopener noreferrer">View Requirement Evidence</a><a href={record.evidenceUrl} target="_blank" rel="noopener noreferrer">View Source Commit</a></div>}
              </td><td>{row.module}</td><td>{completionStatusLabel(row.uiStatus)}</td><td>{completionStatusLabel(row.backendStatus)}</td><td>{completionStatusLabel(row.integrationStatus)}</td><td>{row.priority}</td>
                <td><Chip tone={row.finalAcceptanceStatus === "FULLY IMPLEMENTED" ? "green" : row.finalAcceptanceStatus.includes("OWNER") ? "red" : "amber"}>{completionStatusLabel(row.finalAcceptanceStatus)}</Chip></td>
                <td><dl className={styles.nextAction}><dt>Blocker</dt><dd>{row.blockers?.trim() || "Not Recorded"}</dd><dt>Next Action</dt><dd>{row.nextAction?.trim() || "Not Recorded"}</dd></dl></td></tr>;
            })}
              {visibleRows.length === 0 && <tr><td colSpan={8}><div className={styles.empty} role="status"><strong>No Matching Features</strong><p>{emptyDetail}</p><button type="button" onClick={resetFilters}>Clear Filters</button></div></td></tr>}
            </tbody>
          </table>
        </div>
        <ol className={styles.mobileRegister} aria-label="Mobile Feature Register">
          {visibleRows.map((row) => {
            const record = evidenceByFeature.get(row.featureId);
            return <li key={row.featureId} className={styles.mobileItem}>
              <article className={styles.mobileCard} aria-labelledby={"mobile-feature-" + row.featureId}>
                <header className={styles.mobileCardHeader}>
                  <div className={styles.mobileIdentity}>
                    <span className={styles.mobileId}>{row.featureId}</span>
                    <h3 id={"mobile-feature-" + row.featureId}>{row.featureName}</h3>
                    <p>{row.currentRoute}</p>
                  </div>
                  <span className={styles.mobilePriority}>{row.priority}</span>
                </header>
                <dl className={styles.mobileStatus}>
                  <div><dt>Module</dt><dd>{row.module}</dd></div>
                  <div><dt>UI</dt><dd>{completionStatusLabel(row.uiStatus)}</dd></div>
                  <div><dt>Backend</dt><dd>{completionStatusLabel(row.backendStatus)}</dd></div>
                  <div><dt>Integration</dt><dd>{completionStatusLabel(row.integrationStatus)}</dd></div>
                </dl>
                <div className={styles.mobileAcceptance}>
                  <span>Historical Acceptance</span>
                  <Chip tone={row.finalAcceptanceStatus === "FULLY IMPLEMENTED" ? "green" : row.finalAcceptanceStatus.includes("OWNER") ? "red" : "amber"}>{completionStatusLabel(row.finalAcceptanceStatus)}</Chip>
                </div>
                <section className={styles.mobileWork} aria-label={"Blockers And Next Action For " + row.featureId}>
                  <div><strong>Blocker</strong><p>{row.blockers?.trim() || "Not Recorded"}</p></div>
                  <div><strong>Next Action</strong><p>{row.nextAction?.trim() || "Not Recorded"}</p></div>
                </section>
                <div className={styles.mobileProof}>
                  <strong>Requirement Evidence</strong>
                  {record ? <>
                    <span>{record.sourceIntegrated ? "Current Source Verified" : "Linked Review Evidence"}</span>
                    <div className={styles.mobileLinks}><a href={record.featureEvidenceUrl} target="_blank" rel="noopener noreferrer">View Requirement Evidence</a><a href={record.evidenceUrl} target="_blank" rel="noopener noreferrer">View Source Commit</a></div>
                  </> : <p>No Linked Evidence — Current Source And Functional Acceptance Not Yet Verified</p>}
                </div>
              </article>
            </li>;
          })}
          {visibleRows.length === 0 && <li className={styles.mobileEmpty}><div className={styles.empty} role="status"><strong>No Matching Features</strong><p>{emptyDetail}</p><button type="button" onClick={resetFilters}>Clear Filters</button></div></li>}
        </ol>
        <nav className="completion-pagination" aria-label="Feature Register Pages"><span aria-live="polite">{filtered.length ? "Showing " + (firstRecord + 1) + "–" + (firstRecord + visibleRows.length) + " Of " + filtered.length + " Matching Features" : "No Matching Features"}</span><div><button type="button" onClick={() => setPage(0)} disabled={currentPage === 0} aria-label="First Page">First</button><button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={currentPage === 0}>Previous</button><strong>Page {currentPage + 1} Of {pageCount}</strong><button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={currentPage >= pageCount - 1}>Next</button><button type="button" onClick={() => setPage(pageCount - 1)} disabled={currentPage >= pageCount - 1} aria-label="Last Page">Last</button></div></nav>
      </section>
      <footer><Btn onClick={() => location.assign("/review")}>Open Owner Review Index</Btn><span>Historical Baseline · Current Acceptance Requires Verified Evidence</span></footer>
    </section>
  );
}
