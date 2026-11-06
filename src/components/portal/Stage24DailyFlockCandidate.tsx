"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Stage24DailyFlockCandidate.css";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Panel, Btn, Chip, AsyncButtonLabel } from "./Common";
import DailyFlockHistoricalImport from "./DailyFlockHistoricalImport";

type Flock = { id: string; data: { flockCode: string; house?: string; placementDate?: string; species?: string } };
type Report = { id: string; state: string; revision: number; data: { kind: "daily-flock-report"; flockId?: string; flockCode: string; localDate: string; physicalCount?: number; noneToday?: Record<string, true>; notes?: string } };
type Metric = { value?: number; status: string };
type Projection = {
  timeZone: "Africa/Lagos";
  localDay: { localDate: string; approvalState: string; mortality: Metric; feedConsumedKg: Metric; medicationEvents: Metric; vaccinationEvents: Metric };
  rolling24Hours: { mortality: Metric; feedConsumedKg: Metric; medicationEvents: Metric; vaccinationEvents: Metric };
  currentBirds: { calculated?: number; physicalCount?: number; variance?: number; reconciliationState?: string };
};
type ViewState = "loading" | "ready" | "empty" | "signin" | "hidden" | "unavailable";
const root = "/api/portal/v7/farm-operations";
const todayInLagos = () => { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const get = (key: string) => parts.find((part) => part.type === key)?.value || ""; return `${get("year")}-${get("month")}-${get("day")}`; };
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const validResource = (value: unknown): value is { id: string; state: string; revision: number; data: Record<string, unknown> } =>
  isRecord(value) && typeof value.id === "string" && typeof value.state === "string" && Number.isSafeInteger(value.revision) && isRecord(value.data);

async function request(path: string, init?: RequestInit) {
  return fetch(path, { credentials: "same-origin", cache: "no-store", ...init, headers: { accept: "application/json", ...(init?.headers || {}) } });
}
function metricValue(metric: Metric) {
  if ((metric.status === "recorded" || metric.status === "none-recorded") && typeof metric.value === "number" && Number.isFinite(metric.value)) return String(metric.value);
  if (metric.status === "recorded" || metric.status === "none-recorded") return "Awaiting Verification";
  if (metric.status === "awaiting-verification") return "Awaiting review";
  if (metric.status === "unit-review-required") return "Unit review required";
  return "Not recorded";
}
function metricLabel(metric: Metric) {
  return metric.status === "none-recorded" ? "Explicit None Today" : metric.status === "not-yet-recorded" ? "Missing Today" : metric.status.replaceAll("-", " ");
}

export default function Stage24DailyFlockCandidate() {
  const [state, setState] = useState<ViewState>("loading");
  const [canView, setCanView] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [eligibleFlocks, setEligibleFlocks] = useState<Flock[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState("");
  const [date, setDate] = useState(todayInLagos);
  const [draftFlockId, setDraftFlockId] = useState("");
  const [draftDate, setDraftDate] = useState(todayInLagos);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [projectionState, setProjectionState] = useState<"loading" | "ready" | "error">("loading");
  const [projectionAttempt, setProjectionAttempt] = useState(0);
  const [step, setStep] = useState(1);
  const [physicalCount, setPhysicalCount] = useState("");
  const [none, setNone] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | `submit:${string}` | null>(null);
  const busy = busyAction !== null;
  const [createOpen, setCreateOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createDialogRef = useRef<HTMLElement>(null);
  const dialogKeepRef = useRef<HTMLButtonElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);
  const [initialDraftFingerprint, setInitialDraftFingerprint] = useState("");
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<{ kind: "draft" | "submitted"; id: string; revision: number } | null>(null);
  // Every asynchronous load is revocable. A stale success cannot undo a newer
  // 401/403 or a later refresh with more restrictive server authority.
  const loadEpoch = useRef(0);
  const revokeView = useCallback((stateAfterRevocation: "signin" | "hidden") => {
    loadEpoch.current += 1;
    setState(stateAfterRevocation);
    setCanView(false); setCanCreate(false);
    setFlocks([]); setEligibleFlocks([]); setReports([]); setSelected("");
    setProjection(null); setProjectionState("error"); setReceipt(null);
    setCreateOpen(false); setDiscardOpen(false); setMessage("");
    setEditingReport(null); setPhysicalCount(""); setNone({}); setNotes("");
  }, []);
  const flock = useMemo(() => flocks.find((item) => item.id === selected), [flocks, selected]);
  const draftFlock = useMemo(() => eligibleFlocks.find((item) => item.id === draftFlockId), [eligibleFlocks, draftFlockId]);
  const fingerprint = JSON.stringify({draftFlockId, draftDate, physicalCount, none: Object.keys(none).filter((key) => none[key]).sort(), notes});
  const dirty = createOpen && fingerprint !== initialDraftFingerprint;
  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setDiscardOpen(false);
    window.requestAnimationFrame(() => invokerRef.current?.focus());
  }, []);
  const requestClose = useCallback(() => {
    if (busy) return; // Escape must not cancel a pending server mutation.
    if (dirty) setDiscardOpen(true);
    else closeCreate();
  }, [busy, dirty, closeCreate]);
  const openCreate = (invoker: HTMLElement) => {
    const initialFlock = eligibleFlocks.some((item) => item.id === selected) ? selected : eligibleFlocks[0]?.id || "";
    const initialDate = date;
    setInitialDraftFingerprint(JSON.stringify({draftFlockId: initialFlock, draftDate: initialDate, physicalCount: "", none: [], notes: ""}));
    invokerRef.current = invoker;
    setDraftFlockId(initialFlock);
    setDraftDate(initialDate);
    setEditingReport(null);
    setStep(1);
    setPhysicalCount("");
    setNone({});
    setNotes("");
    setDiscardOpen(false);
    setMessage("");
    setCreateOpen(true);
  };
  const openEdit = (report: Report, invoker: HTMLElement) => {
    const count = report.data.physicalCount === undefined ? "" : String(report.data.physicalCount);
    const pickedNone = Object.fromEntries(Object.entries(report.data.noneToday || {}).map(([key, value]) => [key, value === true]));
    const formNotes = typeof report.data.notes === "string" ? report.data.notes : "";
    setInitialDraftFingerprint(JSON.stringify({draftFlockId: report.data.flockId || "", draftDate: report.data.localDate, physicalCount: count, none: Object.keys(pickedNone).filter((key) => pickedNone[key]).sort(), notes: formNotes}));
    invokerRef.current = invoker;
    setDraftFlockId(report.data.flockId || "");
    setDraftDate(report.data.localDate);
    setEditingReport(report);
    setPhysicalCount(count);
    setNone(pickedNone);
    setNotes(formNotes);
    setStep(2);
    setDiscardOpen(false);
    setMessage("");
    setCreateOpen(true);
  };
  const load = useCallback(async () => {
    const currentEpoch = ++loadEpoch.current;
    setState("loading"); setProjection(null);
    try {
      // Viewing Daily Reports and creating a new one require DIFFERENT grants.
      // An edit-only Flock picker rejection must never erase authorized history.
      const [reportResponse, flockResponse] = await Promise.all([
        request(root + "/daily-flock-report"),
        request(root + "/daily-flock-report/eligible-flocks"),
      ]);
      if (currentEpoch !== loadEpoch.current) return;
      if (reportResponse.status === 401 || flockResponse.status === 401) {
        revokeView("signin"); return;
      }
      const blocked = (status: number) => status === 403 || status === 404;
      if ((!reportResponse.ok && !blocked(reportResponse.status)) ||
          (!flockResponse.ok && !blocked(flockResponse.status))) throw new Error("unavailable");
      const readAuthorized = reportResponse.ok;
      const createAuthorized = flockResponse.ok;
      if (!readAuthorized && !createAuthorized) {
        revokeView("hidden"); return;
      }
      const reportPayload = readAuthorized
        ? await reportResponse.json() as { items?: unknown } : {items: [] as unknown[]};
      const flockPayload = createAuthorized
        ? await flockResponse.json() as { items?: unknown } : {items: [] as unknown[]};
      if (currentEpoch !== loadEpoch.current) return;
      if (!Array.isArray(reportPayload.items) || !Array.isArray(flockPayload.items)) throw new Error("invalid");
      const nextReports = reportPayload.items.filter((item) =>
        validResource(item) && item.data.kind === "daily-flock-report" &&
        typeof item.data.flockId === "string" && typeof item.data.flockCode === "string" &&
        typeof item.data.localDate === "string") as Report[];
      const nextEligible: Flock[] = flockPayload.items.filter((entry): entry is {id:string;flockCode:string;house?:string;placementDate?:string;species?:string} =>
        isRecord(entry) && typeof entry.id === "string" && !!entry.id.trim() &&
        typeof entry.flockCode === "string" && !!entry.flockCode.trim()
      ).map((item) => ({id:item.id,data:{
        flockCode:item.flockCode,
        ...(typeof item.house === "string" ? {house:item.house} : {}),
        ...(typeof item.placementDate === "string" ? {placementDate:item.placementDate} : {}),
        ...(typeof item.species === "string" ? {species:item.species} : {}),
      }}));
      // Historical Flock references are VIEW-ONLY and originate in records that
      // the viewer was already authorized to read. Never offer them as Create inputs.
      const all = new Map<string,Flock>(nextEligible.map((item) => [item.id,item]));
      if (readAuthorized) {
        for (const report of nextReports) {
          const id = report.data.flockId;
          if (id && !all.has(id)) all.set(id,{id,data:{flockCode:report.data.flockCode}});
        }
      }
      const visibleFlocks = [...all.values()];
      if (currentEpoch !== loadEpoch.current) return;
      setCanView(readAuthorized); setCanCreate(createAuthorized);
      setEligibleFlocks(nextEligible); setFlocks(visibleFlocks); setReports(nextReports);
      setSelected((current) => visibleFlocks.some((item) => item.id === current) ? current : visibleFlocks[0]?.id || "");
      setState(visibleFlocks.length ? "ready" : "empty");
    } catch {
      if (currentEpoch !== loadEpoch.current) return;
      setCanView(false); setCanCreate(false); setEligibleFlocks([]);
      setFlocks([]); setReports([]); setState("unavailable");
    }
  }, [revokeView]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!createOpen) return;
    // The modal body owns vertical scroll; preserve the underlying register position.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    createDialogRef.current?.querySelector<HTMLElement>(".s24-close")?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [createOpen]);
  useEffect(() => {
    if (discardOpen) dialogKeepRef.current?.focus();
    else if (createOpen) createDialogRef.current?.querySelector<HTMLElement>(".s24-close")?.focus();
  }, [discardOpen, createOpen]);
  useEffect(() => {
    if (!createOpen) return;
    const dialog = createDialogRef.current;
    if (!dialog) return;
    const activeArea = () => (discardOpen ? dialog.querySelector<HTMLElement>(".s24-discard-confirm") : null) || dialog;
    const focusable = () => Array.from(activeArea().querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.getClientRects().length > 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (discardOpen) setDiscardOpen(false);
        else requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const options = focusable();
      if (!options.length) { event.preventDefault(); return; }
      const first = options[0];
      const last = options[options.length - 1];
      if (event.shiftKey && (document.activeElement === first || !activeArea().contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !activeArea().contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [createOpen, discardOpen, requestClose]);
  useEffect(() => {
    if (!canView || !selected || !/^\d{4}-\d{2}-\d{2}$/.test(date) || state !== "ready") return;
    let active = true;
    setProjection(null);
    setProjectionState("loading");
    request(`${root}/daily-flock-report/projection?${new URLSearchParams({ flockId: selected, localDate: date })}`)
      .then(async (response) => {
        if (response.status === 401) { if (active) revokeView("signin"); return; }
        if (response.status === 403) { if (active) { revokeView("hidden"); setMessage("This report is unavailable in your authorized scope. No report details are shown."); } return; }
        if (response.status === 404) { if (active) { setProjection(null); setProjectionState("error"); setMessage("The projection is unavailable for this historical or inactive Flock. Authorized report history is retained."); } return; }
        if (!response.ok) throw new Error("unavailable");
        const value = await response.json() as Projection;
        if (!value || value.timeZone !== "Africa/Lagos" || !value.localDay || !value.rolling24Hours || !value.currentBirds) throw new Error("invalid");
        if (active) { setProjection(value); setProjectionState("ready"); }
      }).catch(() => { if (active) { setProjection(null); setProjectionState("error"); setMessage("The authorized report projection could not be loaded. No fallback values are shown."); } });
    return () => { active = false; };
  }, [selected, date, state, canView, projectionAttempt, revokeView]);

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draftFlock || busy || !canCreate) return; setBusyAction("save"); setMessage(""); setReceipt(null);
    const noneToday = Object.fromEntries(Object.entries(none).filter(([, checked]) => checked).map(([key]) => [key, true]));
    try {
      const data = {
        kind: "daily-flock-report", flockId: draftFlock.id, flockCode: draftFlock.data.flockCode, localDate: draftDate, timeZone: "Africa/Lagos",
        eventRefs: [], ...(physicalCount.trim() ? { physicalCount: Number(physicalCount) } : {}), ...(Object.keys(noneToday).length ? { noneToday } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}), deviceClass: window.matchMedia("(max-width: 640px)").matches ? "mobile" : window.matchMedia("(max-width: 1024px)").matches ? "tablet" : "desktop", gps: { state: "unavailable" },
      };
      const response = editingReport
        ? await request(`${root}/daily-flock-report/${encodeURIComponent(editingReport.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, expectedRevision: editingReport.revision }) })
        : await request(`${root}/daily-flock-report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) });
      if (response.status === 401) { revokeView("signin"); return; }
      if (response.status === 403 || response.status === 404) { setMessage("Draft saving is unavailable in your authorized scope. No report details are shown."); return; }
      if (response.status === 409) { setMessage("A report was created or changed by another user. Refresh to load its current server revision."); return; }
      if (!response.ok) throw new Error("unavailable");
      const created: unknown = await response.json();
      if (!validResource(created) || created.data.kind !== "daily-flock-report") throw new Error("invalid");
      if (editingReport && (!validResource(created) || created.id !== editingReport.id || created.revision !== editingReport.revision + 1 || created.state !== "draft")) throw new Error("invalid revision receipt");
      setReceipt({kind:"draft", id:created.id, revision:created.revision});
      setMessage("");
      setStep(1); setPhysicalCount(""); setNone({}); setNotes(""); setEditingReport(null); closeCreate(); await load();
    } catch { setMessage("The report draft could not be saved. Your entries remain in this form."); }
    finally { setBusyAction(null); }
  };

  const submit = async (report: Report) => {
    if (busy || !canCreate) return; setBusyAction(`submit:${report.id}`); setMessage(""); setReceipt(null);
    try {
      const response = await request(`${root}/daily-flock-report/${encodeURIComponent(report.id)}/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: "submitted", expectedRevision: report.revision }) });
      if (response.status === 401) { revokeView("signin"); return; }
      if (response.status === 403 || response.status === 404) { setMessage("Submission is unavailable in your authorized scope. No report details are shown."); return; }
      if (response.status === 409) { setMessage("This report revision changed on the server. Refresh before taking another action."); await load(); return; }
      if (!response.ok) throw new Error("unavailable");
      const updated: unknown = await response.json();
      if (!validResource(updated) || updated.state !== "submitted" || updated.revision !== report.revision + 1) throw new Error("invalid");
      setReceipt({kind:"submitted", id:updated.id, revision:updated.revision});
      setMessage("");
      await load();
    } catch { setMessage("The server did not confirm submission. The report remains at its last confirmed state."); }
    finally { setBusyAction(null); }
  };

  const labels = ["Birds Present", "Mortality", "Feed Used", "Water", "Eggs Collected", "Health Observations", "Vaccination"];
  const local = projection?.localDay;
  const rolling = projection?.rolling24Hours;
  return <div className="s24-daily-report"><Panel title="Daily Flock Report" description="Server-authorized daily view · local day follows Africa/Lagos; rolling 24 hours is shown separately.">
    <div className="row between wrap"><Chip tone={state === "ready" ? "blue" : state === "empty" ? "gray" : "amber"}>{state === "loading" ? "Loading Authorized Flock Data…" : state === "ready" ? canView ? "Authorized report view" : "Authorized Create-Only Access" : state === "empty" ? "No Authorized Flocks Or Reports Yet" : state === "signin" ? "Sign in required" : state === "hidden" ? "Unavailable in this scope" : "Service unavailable"}</Chip><button className="link-button" type="button" onClick={() => void load()} aria-label="Refresh Daily Flock Report" disabled={state === "loading"}><RefreshCw size={16}/> Refresh</button></div>
    {(state === "signin" || state === "hidden") && <p className="mt" role="status">{state === "signin" ? "Sign in to load authorized flock reports. No report details or counts are shown." : "This report area is unavailable in your authorized scope. No report details or counts are shown."}</p>}
    {state === "unavailable" && <p className="mt" role="alert">The Farm Operations service could not be reached. No sample values are substituted.</p>}
    {state === "empty" && <p className="mt" role="status">{canView && !canCreate ? "No Daily Report history is available for your authorized view. Creating reports requires separate permission." : "No active Flock or Daily Report is currently available in this authorized farm and location. Contact your Farm Administrator if one should be present."}</p>}
    {(state === "ready" && !canCreate) && <p className="mt" role="status">Read-Only Access · Authorized report history and verified projections remain available. Create and Submit actions require separate permission.</p>}
    {(state === "ready" && !canView) && <p className="mt" role="status">Create-Only Access · Authorized active Flocks are available for entry, but report history and existing projections are not available with this permission.</p>}
    {state === "ready" && <>
      <div className="filters mt"><label className="field grow"><span>Flock</span><select value={selected} onChange={(event) => setSelected(event.target.value)}>{flocks.map((item) => <option key={item.id} value={item.id}>{item.data.flockCode}</option>)}</select></label><label className="field"><span>Local day · WAT</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label></div>
      {canView && <div className="grid3 mt" aria-live="polite">
        {labels.map((label, index) => {
          const metric = index === 1 ? local?.mortality : index === 2 ? local?.feedConsumedKg : index === 6 ? local?.vaccinationEvents : undefined;
          const value = index === 0 ? projection?.currentBirds.physicalCount ?? projection?.currentBirds.calculated : index === 5 ? undefined : metric ? metricValue(metric) : undefined;
          const status = index === 0 ? (projection?.currentBirds.physicalCount !== undefined ? "Physically Counted" : projection?.currentBirds.calculated !== undefined ? "Reconciled From Verified Events" : "Bird Count Not Yet Reconciled") : metric ? metricLabel(metric) : "No Linked Projection Yet";
          return <div className="metric-card" key={label}><span>{label}</span><strong>{value === undefined ? "Unavailable" : value}</strong><small>{status}</small></div>;
        })}
      </div>}
      {canView && <div className="row between wrap mt"><span className="metadata">{local ? `${local.localDate} · WAT · ${local.approvalState}` : projectionState === "error" ? "Local-day projection unavailable" : "Loading local-day projection…"}</span><span className="metadata">Rolling 24 hours: {rolling ? `${metricValue(rolling.mortality)} mortality · ${metricValue(rolling.feedConsumedKg)} kg feed` : projectionState === "error" ? "Projection unavailable" : "Loading separately"}</span></div>}
      {canView && projectionState === "error" && <div className="row wrap mt" role="alert"><span>The projection could not be confirmed. No fallback values are shown.</span><Btn small type="button" onClick={() => setProjectionAttempt((attempt) => attempt + 1)}>Retry projection</Btn></div>}
      {canCreate && eligibleFlocks.length > 0 && <div className="s24-create-actions mt">
        <div>
          <strong>Create Or Edit A Daily Report</strong>
          <p>Keep operational records source-backed and submit only after checking today&apos;s data.</p>
        </div>
        <button className="s24-create-button" ref={createTriggerRef} type="button" onClick={(event) => openCreate(event.currentTarget)}>Create Daily Report</button>
      </div>}
      {createOpen && <div className="s24-modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) requestClose();
      }}>
        <section className="s24-create-dialog" role="dialog" aria-modal="true" aria-labelledby="s24-create-heading" aria-describedby="s24-create-description" ref={createDialogRef} tabIndex={-1}>
          <div className="s24-dialog-heading">
            <div><span className="s24-eyebrow">Farm Operations · Guided Entry</span><h2 id="s24-create-heading">{editingReport ? "Edit Daily Report" : "Create Daily Report"}</h2><p id="s24-create-description">Use your authorized Flock and the local Nigeria reporting day.</p></div>
            <button className="s24-close" type="button" onClick={requestClose} aria-label="Close Daily Report Form" disabled={busy}>Close</button>
          </div>
      {discardOpen ? <div className="s24-discard-confirm" role="alert" aria-live="assertive">
        <h3>Discard Unsaved Changes?</h3>
        <p>Your unsaved bird counts, report notes, and selections will be lost. Nothing has been sent to the server.</p>
        <div className="row wrap">
          <button className="s24-keep" ref={dialogKeepRef} type="button" onClick={() => setDiscardOpen(false)}>Keep Editing</button>
          <button className="s24-discard" type="button" onClick={closeCreate}>Discard Changes</button>
        </div>
      </div> : <form className="stack s24-dialog-form" onSubmit={saveDraft}>
        <div className="row between wrap"><h3>Attendant Entry · Step {step} of 3</h3>{step > 1 && <Btn small type="button" onClick={() => setStep((current) => current - 1)}>Back</Btn>}</div>
        {step === 1 && <div className="stack">
          <p>Choose the active Flock and the Africa/Lagos date. The report cannot use unverified operational events.</p>
          <div className="s24-form-grid">
            <label className="field"><span>Flock</span><select value={draftFlockId} disabled={Boolean(editingReport)} onChange={(event) => setDraftFlockId(event.target.value)}>{eligibleFlocks.map((item) => <option key={item.id} value={item.id}>{item.data.flockCode}{item.data.house ? ` · ${item.data.house}` : ""}</option>)}</select></label>
            <label className="field"><span>Local Day · WAT</span><input type="date" value={draftDate} disabled={Boolean(editingReport)} onChange={(event) => setDraftDate(event.target.value)}/></label>
          </div>
        </div>}
        {step === 2 && <div className="stack"><label className="field"><span>Physical Count · Optional</span><input type="number" min="0" step="1" inputMode="numeric" value={physicalCount} onChange={(event) => setPhysicalCount(event.target.value)} placeholder="Leave blank if not physically counted"/></label><fieldset className="stack"><legend>Only Select When Verified As None Today</legend>{(!canView || !projection || draftFlockId !== selected || draftDate !== date) && <p className="form-note">None Today declarations need a matching authorized local-day projection. You can save a physical count or handover note without declaring a false zero.</p>}{[["mortality","Mortality",local?.mortality],["medication","Medication",local?.medicationEvents],["vaccination","Vaccination",local?.vaccinationEvents],["feed","Feed use",local?.feedConsumedKg]].map(([key, title, metric]) => <label className="row" key={String(key)}><input type="checkbox" disabled={!canView || !projection || draftFlockId !== selected || draftDate !== date || Boolean(metric && (metric as Metric).status !== "not-yet-recorded")} checked={Boolean(none[String(key)])} onChange={(event) => setNone((current) => ({ ...current, [String(key)]: event.target.checked }))}/><span>None Today · {String(title)}{metric && (metric as Metric).status !== "not-yet-recorded" ? ` · ${metricLabel(metric as Metric)}` : ""}</span></label>)}</fieldset></div>}
        {step === 3 && <div className="stack"><label className="field"><span>Handover Notes · Optional</span><textarea maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3}/></label><div className="form-note">{editingReport ? `Saving updates server revision ${editingReport.revision}.` : "Saving creates a server-side draft."} No report is marked Submitted until the server confirms the transition.</div><Btn primary type="submit" disabled={busy} aria-busy={busyAction === "save"}><AsyncButtonLabel busy={busyAction === "save"} idle={editingReport ? "Save Draft Changes" : "Save Draft"} busyText="Saving draft…"/></Btn></div>}
        {step < 3 && <Btn type="button" onClick={() => setStep((current) => current + 1)} disabled={!draftFlock || !/^\d{4}-\d{2}-\d{2}$/.test(draftDate)}>Continue</Btn>}
      </form>}
        </section>
      </div>}
      {canView && <div className="stack mt" id="s24-report-history">
        <h3>Report History</h3>
        {reports.filter((report) => report.data.localDate === date && report.data.flockId === selected).length === 0
          ? <p>No report record for this Flock and local day.</p>
          : reports.filter((report) => report.data.localDate === date && report.data.flockId === selected).map((report) =>
          <div className="row between wrap" key={report.id}>
            <div><strong>{report.data.localDate} · {report.data.flockCode}</strong><div className="metadata">{report.state} · Revision {report.revision}</div></div>
            {report.state === "draft" && canCreate && eligibleFlocks.some((item) => item.id === report.data.flockId) &&
              <div className="row wrap">
                <Btn small onClick={(event) => openEdit(report, event.currentTarget)} disabled={busy}>Edit Draft</Btn>
                <Btn small onClick={() => void submit(report)} disabled={busy} aria-busy={busyAction === ("submit:" + report.id)}>
                  <AsyncButtonLabel busy={busyAction === ("submit:" + report.id)} idle="Submit Report" busyText="Submitting Report…"/>
                </Btn>
              </div>}
          </div>)}
      </div>}
      {canCreate && flock && eligibleFlocks.some((item) => item.id === selected) &&
        <details className="s24-historical mt"><summary>Historical Report Import</summary><div className="mt"><DailyFlockHistoricalImport flockId={flock.id} flockCode={flock.data.flockCode}/></div></details>}
    </>}
    {receipt && state !== "signin" && state !== "hidden" && <div className="s24-receipt mt" role="status">
      <strong>{receipt.kind === "draft" ? "Draft Saved By The Server" : "Report Submitted By The Server"}</strong>
      <p>Report ID: <code>{receipt.id}</code> · Revision {receipt.revision}. {receipt.kind === "draft" ? "This Draft Has Not Been Submitted Or Approved." : "Submission Is Complete; Independent Checker Approval Is Still Pending."}</p>
      <button type="button" onClick={() => setReceipt(null)}>Dismiss Receipt</button>
    </div>}
    {message && <p className="mt" role={message.includes("could not") || message.includes("unavailable") ? "alert" : "status"}><AlertTriangle size={16} aria-hidden="true"/> {message}</p>}
  </Panel></div>;
}
