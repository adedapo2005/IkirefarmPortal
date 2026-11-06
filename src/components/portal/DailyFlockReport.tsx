"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { has, type Persona } from "@/lib/portal-model";
import { useDailyFlockWriteInterlock } from "@/lib/daily-flock-write-interlock";
import { readCanonicalDailyFlockProjectionContext, readCanonicalDailyFlockWorkspace } from "@/lib/stage25-canonical-daily-flock-reader";
import { mergeDailyFlocks, type DailyFlockProjection } from "@/lib/stage25-canonical-daily-flock-workspace";
import { buildCurrentFieldlineProjection } from "@/lib/stage24-fieldline-current-projection";
import { fieldlineReadCapability, fieldlineScopeKey } from "@/lib/stage24-fieldline-read-capability";
import { AlertTriangle, ClipboardCheck, FileText, RefreshCw } from "lucide-react";
import { Panel, Btn, Chip, AsyncButtonLabel } from "./Common";
import DailyFlockHistoricalImport from "./DailyFlockHistoricalImport";
import RecoveryManager from "./RecoveryManager";
import LoggedTimestamp from "./LoggedTimestamp";
import FieldlineV6Experience from "./FieldlineV6Experience";
import styles from "./DailyFlockReport.module.css";
import { readCanonicalDailyFlockRecord, captureCanonicalDailyFlockExpectation, interpretCanonicalDailyFlockFeedback } from "@/lib/stage25-canonical-daily-flock-feedback";

type Flock = { id: string; data: { flockCode: string }; eligible: boolean };
type Report = { id: string; state: string; revision: number; data: { kind: "daily-flock-report"; flockId?: string; flockCode: string; localDate: string; eventRefs?: unknown; gps?: unknown; physicalCount?: number; noneToday?: Record<string, true>; notes?: string } };
type Metric = { value?: number; status: string };
type Projection = DailyFlockProjection;
type ViewState = "loading" | "ready" | "empty" | "signin" | "hidden" | "unavailable";
type AuditEvidence = {report:{id:string;state:string;revision:number};events:{actorId:string;action:string;revision:number;occurredAt:string}[]};
const root = "/api/portal/v7/farm-operations";
const fieldlineWideQuery = "(min-width: 701px)";
function subscribeFieldlineWidth(notify: () => void) {
  const query = window.matchMedia(fieldlineWideQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
const fieldlineIsWide = () => window.matchMedia(fieldlineWideQuery).matches;
const fieldlineServerWide = () => true;
const todayInLagos = () => { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const get = (key: string) => parts.find((part) => part.type === key)?.value || ""; return `${get("year")}-${get("month")}-${get("day")}`; };
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const validResource = (value: unknown): value is { id: string; state: string; revision: number; data: Record<string, unknown> } =>
  isRecord(value) && typeof value.id === "string" && typeof value.state === "string" && Number.isSafeInteger(value.revision) && isRecord(value.data);

async function request(path: string, init?: RequestInit) {
  return fetch(path, { credentials: "same-origin", cache: "no-store", ...init, headers: { accept: "application/json", ...(init?.headers || {}) } });
}
function metricValue(metric: Metric) {
  if ((metric.status === "recorded" || metric.status === "none-recorded") && typeof metric.value === "number" && Number.isFinite(metric.value)) return String(metric.value);
  if (metric.status === "awaiting-verification") return "Awaiting review";
  if (metric.status === "unit-review-required") return "Unit review required";
  return "Not recorded";
}
function metricLabel(metric: Metric) {
  return metric.status === "none-recorded" ? "Explicit None Today" : metric.status === "not-yet-recorded" ? "Missing Today" : metric.status.replaceAll("-", " ");
}

export default function DailyFlockReport({person}:{person?:Persona}) {
  if (person?.principalSource === "authenticated" && !person.authenticatedAccountId?.trim()) {
    return <Panel title="Daily Flock Report"><p role="alert">Account Identity Could Not Be Confirmed. Sign In Again Before Accessing This Workspace.</p></Panel>;
  }
  const scope = JSON.stringify([person?.authenticatedAccountId,person?.id,person?.principalSource,person?.accessState,person?.restriction,
    person?.organizationScope,person?.permissionScopes,person?.permissions]);
  return <DailyFlockWorkspace key={scope} person={person} />;
}

function DailyFlockWorkspace({person}:{person?:Persona}) {
  const wideFieldline = useSyncExternalStore(subscribeFieldlineWidth, fieldlineIsWide, fieldlineServerWide);
  const [mobileFieldlineOpen, setMobileFieldlineOpen] = useState(false);
  const [state, setState] = useState<ViewState>("loading");
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [writeCapability, setWriteCapability] = useState<"available" | "readonly" | "unavailable">("unavailable");
  const scopeKey = fieldlineScopeKey(person);
  const companyKey = person?.organizationScope?.companyKey;
  const siteKey = person?.organizationScope?.locationKey;
  const [historyScopeKey, setHistoryScopeKey] = useState("");
  const [projectionScopeKey, setProjectionScopeKey] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState("");
  const [date, setDate] = useState(todayInLagos);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [projectionFlockId, setProjectionFlockId] = useState("");
  const [projectionState, setProjectionState] = useState<"loading" | "ready" | "error">("loading");
  const [historyRechecked, setHistoryRechecked] = useState(false);
  const [projectionAttempt, setProjectionAttempt] = useState(0);
  const [step, setStep] = useState(1);
  const [physicalCount, setPhysicalCount] = useState("");
  const [none, setNone] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "recovery" | `submit:${string}` | null>(null);
  const busy = busyAction !== null;
  const [message, setMessage] = useState("");
  const [auditEvidence, setAuditEvidence] = useState<AuditEvidence | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const interlock = useDailyFlockWriteInterlock(person);
  const authorityEpoch = useRef(0);
  const readGeneration = useRef(0);
  const auditGeneration = useRef(0);
  useEffect(() => () => { authorityEpoch.current++; readGeneration.current++; auditGeneration.current++; }, []);

  const hideProtected = useCallback((signIn: boolean) => {
    authorityEpoch.current++; readGeneration.current++; auditGeneration.current++;
    setFlocks([]); setWriteCapability("unavailable"); setReports([]); setSelected(""); setProjection(null);
    setEditingReport(null); setPhysicalCount(""); setNone({}); setNotes(""); setMessage(""); setAuditEvidence(null);
    setState(signIn ? "signin" : "hidden");
  }, []);

  const flock = useMemo(() => flocks.find((item) => item.id === selected), [flocks, selected]);
  const canInvestigate = Boolean(person?.principalSource === "authenticated" && person.restriction === "none" &&
    person.farm && has(person,"farm.daily-report.view") && has(person,"farm.daily-report.audit.view") &&
    person.permissionScopes?.["farm.daily-report.audit.view"] && person.organizationScope?.companyKey && person.organizationScope?.locationKey);
  const load = useCallback(async () => {
    const generation = ++readGeneration.current;
    auditGeneration.current++; setAuditEvidence(null);
    setState("loading"); setProjection(null);
    try {
      const result = await readCanonicalDailyFlockWorkspace({
        read: (path) => request(path),
        isCurrent: () => generation === readGeneration.current,
      });
      if (generation !== readGeneration.current || result.kind === "stale") return;
      if (result.kind === "denied") { hideProtected(result.requiresSignIn); return; }
      if (result.kind !== "ready") throw new Error("unavailable");
      const nextReports: Report[] = [...result.history];
      const nextFlocks: Flock[] = mergeDailyFlocks(result.eligible,result.history).map(item => ({
        id:item.id, data:{flockCode:item.flockCode}, eligible:item.eligible && result.writeCapability === "available",
      }));
      setWriteCapability(result.writeCapability);
      setHistoryScopeKey(scopeKey);
      setFlocks(nextFlocks); setReports(nextReports);
      setSelected((current) => nextFlocks.some((item) => item.id === current) ? current : nextFlocks[0]?.id || "");
      setState(nextFlocks.length ? "ready" : "empty");
    } catch { if (generation === readGeneration.current) { setFlocks([]); setReports([]); setState("unavailable"); } }
  }, [hideProtected, scopeKey]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected || !/^\d{4}-\d{2}-\d{2}$/.test(date) || state !== "ready") return;
    let active = true;
    const epoch = authorityEpoch.current;
    const generation = readGeneration.current;
    const current = () => active && epoch === authorityEpoch.current && generation === readGeneration.current;
    setProjection(null);
    setHistoryRechecked(false);
    setProjectionState("loading");
    void readCanonicalDailyFlockProjectionContext({
      flockId: selected, localDate: date, isCurrent: current,
      read: async (path) => {
        const response = await request(path);
        if (path !== `${root}/daily-flock-report` || response.status !== 200) return response;
        return { status: response.status, json: async () => {
          const body: unknown = await response.json();
          if (!companyKey || !siteKey || !isRecord(body) || !Array.isArray(body.items) ||
              body.items.some((item: unknown) => !isRecord(item) || !isRecord(item.subject) ||
                item.subject.companyKey !== companyKey || item.subject.locationKey !== siteKey)) return null;
          return body;
        } };
      },
    }).then((result) => {
      if (!current() || result.kind === "stale") return;
      if (result.kind === "denied") { hideProtected(result.requiresSignIn); return; }
      if (result.kind === "ready") {
        setProjectionScopeKey(scopeKey); setProjectionFlockId(selected);
        setProjection(result.projection); setProjectionState("ready"); return;
      }
      if (result.kind === "projection-unavailable") {
        const history = [...result.history];
        const historyFlocks: Flock[] = mergeDailyFlocks([], history).map(item => ({
          id:item.id, data:{flockCode:item.flockCode}, eligible:false,
        }));
        setReports(history); setHistoryScopeKey(scopeKey); setFlocks(historyFlocks);
        setSelected((value) => historyFlocks.some(item => item.id === value) ? value : historyFlocks[0]?.id || "");
        setWriteCapability("readonly"); setState(historyFlocks.length ? "ready" : "empty");
        setHistoryRechecked(true);
      } else if (result.clearHistory) {
        setFlocks([]); setReports([]); setSelected(""); setWriteCapability("unavailable"); setState("unavailable");
      }
      setProjection(null); setProjectionFlockId(""); setProjectionState("error");
    });
    return () => { active = false; };
  }, [selected, date, state, projectionAttempt, hideProtected, scopeKey, companyKey, siteKey]);

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault(); if (!fieldline || !flock?.eligible || projectionFlockId !== flock.id || projection?.localDay.localDate !== date || busy || !interlock.ready || interlock.blocked) return;
    const epoch = authorityEpoch.current; setBusyAction("save"); setMessage("");
    const verifiedDraft = editingReport ? readCanonicalDailyFlockRecord(editingReport) : null;
    if (editingReport && (!verifiedDraft || verifiedDraft.state !== "draft" || verifiedDraft.data.flockId !== flock.id || verifiedDraft.data.localDate !== date)) {
      setMessage("The Draft Identity Or Source Evidence Could Not Be Confirmed. Your Entries Remain In This Form."); setBusyAction(null); return;
    }
    const noneToday = Object.fromEntries(Object.entries(none).filter(([, checked]) => checked).map(([key]) => [key, true]));
    try {
      const data = {
        kind: "daily-flock-report", flockId: flock.id, flockCode: flock.data.flockCode, localDate: date, timeZone: "Africa/Lagos",
        eventRefs: verifiedDraft?.data.eventRefs ?? [], ...(physicalCount.trim() ? { physicalCount: Number(physicalCount) } : {}), ...(Object.keys(noneToday).length ? { noneToday } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}), deviceClass: window.matchMedia("(max-width: 640px)").matches ? "mobile" : window.matchMedia("(max-width: 1024px)").matches ? "tablet" : "desktop", gps: verifiedDraft?.data.gps ?? { state: "unavailable" },
      };
      const expected = captureCanonicalDailyFlockExpectation(editingReport ? { operation: "update-draft", expectedData: data, expectedId: editingReport.id, expectedRevision: editingReport.revision, expectedState: "draft" } : { operation: "create-draft", expectedData: data });
      if (!expected) { setMessage("Review The Report Details Before Saving. Your Entries Remain In This Form."); return; }
      const identity = [person?.organizationScope?.companyKey,person?.organizationScope?.locationKey,flock.id,date];
      if (identity.some(value => !value)) { setMessage("Report Scope Could Not Be Confirmed."); return; }
      const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(identity.join("\u001f")));
      const expectedId = "daily-flock-" + Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,"0")).join("");
      if (editingReport && editingReport.id !== expectedId) { setMessage("The Report Identity Could Not Be Confirmed."); return; }
      const pending = await interlock.begin();
      if (!pending || epoch !== authorityEpoch.current) return;
      const response = editingReport
        ? await request(`${root}/daily-flock-report/${encodeURIComponent(editingReport.id)}`, { method: "PATCH", headers: { "content-type": "application/json", "x-daily-flock-operation-id": pending.token }, body: JSON.stringify({ data, expectedRevision: editingReport.revision }) })
        : await request(`${root}/daily-flock-report`, { method: "POST", headers: { "content-type": "application/json", "x-daily-flock-operation-id": pending.token }, body: JSON.stringify({ data }) });
      if (epoch !== authorityEpoch.current) return;
      if (response.status === 401) { hideProtected(true); return; }
      if (response.status === 403 || response.status === 404) { hideProtected(false); return; }
      if (response.status === 409) { setMessage("Outcome Not Confirmed. An Authorized Manager Must Reconcile This Operation Before Another Attempt."); return; }
      if (!response.ok || response.headers.get("x-daily-flock-operation-id") !== pending.token ||
          response.headers.get("x-daily-flock-receipt-state") !== "committed") throw new Error("unconfirmed receipt");
      const created: unknown = await response.json();
      if (epoch !== authorityEpoch.current || (!editingReport && (!validResource(created) || created.id !== expectedId)) ||
          interpretCanonicalDailyFlockFeedback({ ...expected, httpStatus: response.status, body: created }).state !== "saved") throw new Error("unconfirmed receipt");
      if (!interlock.confirm(pending)) { setMessage("The Server Confirmed The Draft, But Recovery Storage Is Unavailable. Writes Remain Blocked."); return; }
      setMessage("Draft saved by the server. It has not been submitted."); setStep(1); setPhysicalCount(""); setNone({}); setNotes(""); setEditingReport(null); await load();
    } catch { if (epoch === authorityEpoch.current) setMessage("Outcome Not Confirmed. The Draft May Have Been Saved. Keep Your Entries And Ask An Authorized Manager To Reconcile Before Retrying."); }
    finally { if (epoch === authorityEpoch.current) setBusyAction(null); }
  };

  const submit = async (report: Report) => {
    if (!fieldline || !flock?.eligible || report.data.flockId !== flock.id || busy || !interlock.ready || interlock.blocked) return;
    const epoch = authorityEpoch.current; setBusyAction(`submit:${report.id}`); setMessage("");
    try {
      const expected = captureCanonicalDailyFlockExpectation({ operation: "submit-report", expectedData: report.data, expectedId: report.id, expectedRevision: report.revision, expectedState: "draft" });
      if (!expected) { setMessage("The Draft Details Could Not Be Confirmed. Review The Report Before Submitting."); return; }
      const pending = await interlock.begin();
      if (!pending || epoch !== authorityEpoch.current) return;
      const response = await request(`${root}/daily-flock-report/${encodeURIComponent(report.id)}/transition`, { method: "POST", headers: { "content-type": "application/json", "x-daily-flock-operation-id": pending.token }, body: JSON.stringify({ to: "submitted", expectedRevision: report.revision }) });
      if (epoch !== authorityEpoch.current) return;
      if (response.status === 401) { hideProtected(true); return; }
      if (response.status === 403 || response.status === 404) { hideProtected(false); return; }
      if (response.status === 409) { setMessage("Outcome Not Confirmed. An Authorized Manager Must Reconcile This Operation Before Another Attempt."); return; }
      if (!response.ok || response.headers.get("x-daily-flock-operation-id") !== pending.token ||
          response.headers.get("x-daily-flock-receipt-state") !== "committed") throw new Error("unconfirmed receipt");
      const updated: unknown = await response.json();
      if (epoch !== authorityEpoch.current || interpretCanonicalDailyFlockFeedback({ ...expected, httpStatus: response.status, body: updated }).state !== "submitted") throw new Error("unconfirmed receipt");
      if (!interlock.confirm(pending)) { setMessage("The Server Confirmed Submission, But Recovery Storage Is Unavailable. Writes Remain Blocked."); return; }
      setMessage("The server confirmed submission."); await load();
    } catch { if (epoch === authorityEpoch.current) setMessage("Submission Outcome Not Confirmed. It May Have Reached The Server. Ask An Authorized Manager To Reconcile Before Retrying."); }
    finally { if (epoch === authorityEpoch.current) setBusyAction(null); }
  };

  const inspectLegacyEvidence = async (report: Report) => {
    if (!canInvestigate || auditBusy) return;
    const epoch = authorityEpoch.current, generation = ++auditGeneration.current;
    setAuditBusy(true); setAuditEvidence(null); setMessage("");
    try {
      const response = await request(`${root}/daily-flock-report/${encodeURIComponent(report.id)}/legacy-investigation`);
      if (epoch !== authorityEpoch.current || generation !== auditGeneration.current) return;
      if (response.status === 401) { hideProtected(true); return; }
      if (response.status === 403 || response.status === 404) { hideProtected(false); return; }
      if (!response.ok) throw new Error("unavailable");
      const value: unknown = await response.json();
      if (epoch !== authorityEpoch.current || generation !== auditGeneration.current) return;
      if (!isRecord(value) || value.operationOutcome !== "unconfirmed" || !isRecord(value.report) ||
          value.report.id !== report.id || value.report.state !== report.state || value.report.revision !== report.revision ||
          !Array.isArray(value.events) || value.events.length > 200 || !value.events.every(event =>
            isRecord(event) && typeof event.actorId === "string" && Boolean(event.actorId.trim()) &&
            typeof event.action === "string" && Boolean(event.action.trim()) &&
            Number.isSafeInteger(event.revision) && Number(event.revision) > 0 &&
            typeof event.occurredAt === "string" && Boolean(event.occurredAt.trim()))) throw new Error("unconfirmed");
      setAuditEvidence({report:{id:report.id,state:report.state,revision:report.revision},
        events:value.events as AuditEvidence["events"]});
    } catch {
      if (epoch === authorityEpoch.current && generation === auditGeneration.current)
        setMessage("Audit Evidence Could Not Be Confirmed. The Earlier Outcome Remains Unconfirmed.");
    } finally { if (epoch === authorityEpoch.current) setAuditBusy(false); }
  };

  const reconcile = async (cancel: boolean) => {
    const pending = interlock.pending();
    if (!pending || busy) return;
    const epoch = authorityEpoch.current;
    setBusyAction("recovery"); setMessage("");
    try {
      const response = await request(`${root}/daily-flock-report/write-recovery/${encodeURIComponent(pending.token)}`,
        cancel ? {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"cancel"})} : undefined);
      if (epoch !== authorityEpoch.current) return;
      if (response.status === 401) { hideProtected(true); return; }
      if (response.status === 403 || response.status === 404) { hideProtected(false); return; }
      if (!response.ok) throw new Error("unavailable");
      const result: unknown = await response.json();
      if (epoch !== authorityEpoch.current || !isRecord(result) || result.operationId !== pending.token) return;
      if (result.state === "unconfirmed") {
        setMessage("The Server Cannot Yet Confirm This Outcome. Check Again Or Cancel The Pending Operation Before Retrying."); return;
      }
      if (result.state === "cancelled") {
        if (!cancel || !interlock.confirm(pending)) throw new Error("unconfirmed");
        setMessage("The Server Cancelled This Operation. A Delayed Request With This Identifier Cannot Commit. Review Your Entry Before Retrying.");
        return;
      }
      const raw = result.record;
      const record = readCanonicalDailyFlockRecord(raw);
      if (result.state !== "committed" || !["create","update","submit"].includes(String(result.action)) ||
          !record || !isRecord(raw) || !isRecord(raw.subject) ||
          raw.subject.companyKey !== person?.organizationScope?.companyKey ||
          raw.subject.locationKey !== person?.organizationScope?.locationKey ||
          (result.action === "submit" ? record.state !== "submitted" : record.state !== "draft") ||
          (result.action === "create" && record.revision !== 1) ||
          (result.action !== "create" && record.revision < 2)) throw new Error("unconfirmed");
      const identity = [person?.organizationScope?.companyKey,person?.organizationScope?.locationKey,record.data.flockId,record.data.localDate];
      if (identity.some(value => !value)) throw new Error("unconfirmed");
      const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(identity.join("\u001f")));
      const expectedId = "daily-flock-" + Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,"0")).join("");
      if (epoch !== authorityEpoch.current || record.id !== expectedId || !interlock.confirm(pending)) throw new Error("unconfirmed");
      setMessage(`The Server Confirmed ${result.action === "submit" ? "Submission" : "A Saved Draft"} At Revision ${record.revision}. Review Your Current Entry Before Any Further Action.`);
      await load();
    } catch {
      if (epoch === authorityEpoch.current) setMessage("Outcome Not Confirmed. Writes Remain Blocked. Check Again Or Ask An Authorized Manager For Help.");
    } finally { if (epoch === authorityEpoch.current) setBusyAction(null); }
  };

  const moveToTask = (id:string) => {
    const target=document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"});
    target.focus({preventScroll:true});
  };
  const labels = ["Birds present", "Mortality", "Feed used", "Water", "Eggs collected", "Health observations", "Vaccination"];
  const canonicalHistory = reports.map(readCanonicalDailyFlockRecord);
  const fieldlineAuthority = fieldlineReadCapability(person, {
    workspaceState:state, projectionState, historyVerified:canonicalHistory.every(item => item !== null),
    historyScopeKey, projectionScopeKey, selectedFlockId:flock?.id || "", projectedFlockId:projectionFlockId,
    selectedDate:date, projectedDate:projection?.localDay.localDate || "",
  });
  const fieldline = fieldlineAuthority.operations && flock && projection
    ? buildCurrentFieldlineProjection({id:flock.id,flockCode:flock.data.flockCode},date,projection,
      canonicalHistory.filter((item): item is NonNullable<typeof item> => item !== null)) : null;
  const currentProjection = fieldline ? projection : null;
  const local = currentProjection?.localDay;
  const rolling = currentProjection?.rolling24Hours;
  return <Panel className={styles.farmPanel} title="Daily Flock Report" description="Server-authorized daily view · local day follows Africa/Lagos; rolling 24 hours is shown separately.">
    <div className="row between wrap"><Chip tone={state === "ready" ? "blue" : state === "empty" ? "gray" : "amber"}>{state === "loading" ? "Loading authorized flock data…" : state === "ready" ? "Authorized report view" : state === "empty" ? "No known flock yet" : state === "signin" ? "Sign in required" : state === "hidden" ? "Unavailable in this scope" : "Service unavailable"}</Chip><button className="link-button" type="button" onClick={() => void load()} aria-label="Refresh Daily Flock Report" disabled={state === "loading"}><RefreshCw size={16}/> Refresh</button></div>
    {state !== "signin" && state !== "hidden" && (!interlock.ready || interlock.blocked) &&
      <div className="mt" role="alert"><strong>Report Outcome Reconciliation Required</strong>
        <p>{!interlock.ready ? "Recovery Protection Is Unavailable. Writes Are Blocked." :
          "An Earlier Report Request May Have Reached The Server. A Refresh Cannot Confirm Failure. Ask An Authorized Manager To Reconcile It Before Another Attempt."}</p>
        <p>Your Entry Remains On This Page. Form Values Are Not Stored And Do Not Survive Reload.</p>
        {interlock.ready && !interlock.legacyBlocked && interlock.pending() && <div className="row wrap">
          <Btn type="button" disabled={busy} onClick={() => void reconcile(false)}>Check Report Outcome</Btn>
          <Btn type="button" disabled={busy} onClick={() => void reconcile(true)}>Cancel Pending Operation Safely</Btn>
        </div>}
        {interlock.legacyBlocked && <p>This Earlier Marker Cannot Establish The Account Or Outcome Safely. Ask A Manager With Daily Flock View And Audit Access To Inspect The Relevant Flock, Date, Revision, Actor And Audit Time. Audit Evidence Cannot Identify Or Fence The Earlier Request. Keep Writes Blocked Until An Authorized Reconciliation Establishes A Safe Outcome; This Marker Will Not Be Cleared Automatically.</p>}
      </div>}
    {(state === "signin" || state === "hidden") && <p className="mt" role="status">{state === "signin" ? "Sign in to load authorized flock reports. No report details or counts are shown." : "This report area is unavailable in your authorized scope. No report details or counts are shown."}</p>}
    {state === "unavailable" && <p className="mt" role="alert">The Farm Operations service could not be reached. No sample values are substituted.</p>}
    {state === "empty" && <p className="mt" role="status">{writeCapability === "available" ? "No Eligible Flocks Or Report History Are Available In This Scope." : "No Report History Is Available. Flock Entry Eligibility Could Not Be Confirmed."}</p>}
    {person?.principalSource === "authenticated" && person.restriction === "none" && has(person,"farm.daily-report.recovery.manage") && person.permissionScopes?.["farm.daily-report.recovery.manage"] === "all" && <RecoveryManager/>}
    {state === "ready" && <>
      <nav className={styles.taskRail} aria-label="Daily flock tasks">
        {flock?.eligible ? <button type="button" onClick={()=>moveToTask("daily-flock-entry")}><ClipboardCheck size={18} aria-hidden="true"/><span>Daily Entry</span></button> :
          <button type="button" onClick={()=>moveToTask("daily-flock-history")}><FileText size={18} aria-hidden="true"/><span>Report History</span></button>}
        {flock && <button type="button" onClick={()=>moveToTask("daily-flock-import")}><FileText size={18} aria-hidden="true"/><span>Historical Import</span></button>}
      </nav>
      {!flock?.eligible && <p className="mt" role="status">This Flock Is Available For History Only. New Or Changed Reports Require Current Entry Eligibility.</p>}
      <div className={`filters mt ${styles.filters}`}><label className="field grow"><span>Flock</span><select value={selected} onChange={(event) => { auditGeneration.current++; setAuditEvidence(null); setSelected(event.target.value); }}>{flocks.map((item) => <option key={item.id} value={item.id}>{item.data.flockCode}</option>)}</select></label><label className="field"><span>Local day · WAT</span><input type="date" value={date} onChange={(event) => { auditGeneration.current++; setAuditEvidence(null); setDate(event.target.value); }}/></label></div>
      {fieldline && fieldlineAuthority.operations && <a className="link-button" href="#daily-flock-intelligence" onClick={() => setMobileFieldlineOpen(true)}>View Fieldline Intelligence</a>}
      <div className={`grid3 mt ${styles.metrics}`} aria-live="polite">
        {labels.map((label, index) => {
          const metric = index === 1 ? local?.mortality : index === 2 ? local?.feedConsumedKg : index === 6 ? local?.vaccinationEvents : undefined;
          const value = index === 0 ? currentProjection?.currentBirds.physicalCount : index === 5 ? undefined : metric ? metricValue(metric) : undefined;
          const status = index === 0 ? (currentProjection?.currentBirds.physicalCount === undefined ? "Physical Count Not Recorded" : "Physically Counted") : metric ? metricLabel(metric) : "No linked projection yet";
          return <div className={`metric-card ${styles.metricCard}`} key={label}><span className={styles.metricLabel}>{label}</span><strong className={styles.metricValue}>{value === undefined ? "Unavailable" : value}</strong><small className={styles.metricHint}>{status}</small></div>;
        })}
      </div>
      <div className={`row between wrap mt ${styles.summaryRow}`}><span className="metadata">{local ? `${local.localDate} · WAT · ${local.approvalState}` : projectionState === "error" ? "Local-day projection unavailable" : "Loading local-day projection…"}</span><span className="metadata">Rolling 24 hours: {rolling ? `${metricValue(rolling.mortality)} mortality · ${metricValue(rolling.feedConsumedKg)} kg feed` : projectionState === "error" ? "Projection unavailable" : "Loading separately"}</span></div>
      {projectionState === "ready" && projection && !fieldline && <p role="alert">Report History And Projection Do Not Agree. Refresh To Recheck; Values And Writes Are Withheld.</p>}
      {projectionState === "error" && <div className="row wrap mt" role="alert"><span>{historyRechecked ? "The projection is unavailable. Authorized report history was rechecked; new or changed reports remain blocked." : "The projection could not be confirmed. No fallback values are shown."}</span><Btn small type="button" onClick={() => setProjectionAttempt((attempt) => attempt + 1)}>Retry projection</Btn></div>}
      <div className={styles.workGrid}><div>
      <form id="daily-flock-entry" tabIndex={-1} className={`stack mt ${styles.entryForm}`} onSubmit={saveDraft}>
        <div className={styles.entryEyebrow}><ClipboardCheck size={17} aria-hidden="true"/> DAILY ENTRY · AFRICA/LAGOS</div>
        <ol className={styles.entrySteps} aria-label="Daily entry progress">{["Select", "Observe", "Handover"].map((label,index)=><li key={label} className={step===index+1 ? styles.entryCurrent : ""} aria-current={step===index+1 ? "step" : undefined}><span aria-hidden="true">{index+1}</span>{label}</li>)}</ol>
        <div className="row between wrap"><h3>Attendant entry · step {step} of 3</h3>{step > 1 && <Btn small type="button" onClick={() => setStep((current) => current - 1)}>Back</Btn>}</div>
        {step === 1 && <p>Select the authorized flock and confirm the Africa/Lagos reporting day. Existing canonical events supply the operational measures.</p>}
        {step === 2 && <div className="stack"><label className="field"><span>Physical count · optional</span><input type="number" min="0" step="1" inputMode="numeric" value={physicalCount} onChange={(event) => setPhysicalCount(event.target.value)} placeholder="Leave blank if not physically counted"/></label><fieldset className="stack"><legend>Only select when verified as none today</legend>{[["mortality","Mortality",local?.mortality],["medication","Medication",local?.medicationEvents],["vaccination","Vaccination",local?.vaccinationEvents],["feed","Feed use",local?.feedConsumedKg]].map(([key, title, metric]) => <label className="row" key={String(key)}><input type="checkbox" disabled={Boolean(metric && (metric as Metric).status !== "not-yet-recorded")} checked={Boolean(none[String(key)])} onChange={(event) => setNone((current) => ({ ...current, [String(key)]: event.target.checked }))}/><span>None today · {String(title)}{metric && (metric as Metric).status !== "not-yet-recorded" ? ` · ${metricLabel(metric as Metric)}` : ""}</span></label>)}</fieldset></div>}
        {step === 3 && <div className="stack"><label className="field"><span>Handover notes · optional</span><textarea maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3}/></label><div className="form-note">{editingReport ? `Saving updates server revision ${editingReport.revision}.` : "Saving creates a server-side draft."} No report is marked Submitted until the server confirms the transition.</div><Btn primary type="submit" disabled={busy || !flock?.eligible || !currentProjection || !interlock.ready || interlock.blocked} aria-busy={busyAction === "save"}><AsyncButtonLabel busy={busyAction === "save"} idle={editingReport ? "Save draft changes" : "Save draft"} busyText="Saving draft…"/></Btn></div>}
        {step < 3 && <Btn type="button" onClick={() => setStep((current) => current + 1)} disabled={!flock?.eligible || !currentProjection}>Continue</Btn>}
      </form>
      <div id="daily-flock-history" tabIndex={-1} className="stack mt" style={{scrollMarginTop:"10rem"}}><h3>Report history</h3>{reports.filter((report) => report.data.localDate === date && report.data.flockCode === flock?.data.flockCode).length === 0 ? <p>No report record for this flock and local day.</p> : reports.filter((report) => report.data.localDate === date && report.data.flockCode === flock?.data.flockCode).map((report) => <div className="row between wrap" key={report.id}><div><strong>{report.data.localDate} · {report.data.flockCode}</strong><div className="metadata">{report.state} · Revision {report.revision}</div></div>{canInvestigate && <Btn small type="button" disabled={auditBusy} onClick={() => void inspectLegacyEvidence(report)}>Inspect Audit Evidence</Btn>}{report.state === "draft" && <div className="row wrap"><Btn small onClick={() => { setEditingReport(report); setPhysicalCount(report.data.physicalCount === undefined ? "" : String(report.data.physicalCount)); setNone(Object.fromEntries(Object.entries(report.data.noneToday || {}).map(([key, value]) => [key, value === true]))); setNotes(typeof report.data.notes === "string" ? report.data.notes : ""); setStep(2); }} disabled={busy || !flock?.eligible || !currentProjection || !interlock.ready || interlock.blocked}>Edit draft</Btn><Btn small onClick={() => void submit(report)} disabled={busy || !flock?.eligible || !currentProjection || !interlock.ready || interlock.blocked} aria-busy={busyAction === `submit:${report.id}`}><AsyncButtonLabel busy={busyAction === `submit:${report.id}`} idle="Submit report" busyText="Submitting report…"/></Btn></div>}</div>)}</div>
      {flock && <aside className={styles.handoverNote} aria-label="Report and import guidance"><div><ClipboardCheck size={20} aria-hidden="true"/><strong>Before You Hand Over</strong></div><p>Save a draft before submitting today’s report. Historical notes follow a separate review and are not published automatically.</p><button type="button" onClick={()=>moveToTask("daily-flock-import")}>Open Historical Import <FileText size={16} aria-hidden="true"/></button></aside>}
      {auditEvidence && <section className="panel mt" aria-label="Legacy Report Audit Evidence">
        <h3>Legacy Report Audit Evidence</h3>
        <p>Revision {auditEvidence.report.revision} · {auditEvidence.report.state}. This Evidence Does Not Identify Or Fence An Earlier Unreceipted Request. Its Outcome Remains Unconfirmed.</p>
        {auditEvidence.events.length ? <ul>{auditEvidence.events.map((event,index) =>
          <li key={index}>Revision {event.revision} · {event.action} · {event.actorId} · <LoggedTimestamp value={event.occurredAt}/></li>)}</ul> :
          <p>No Audit Events Were Returned. This Does Not Prove That A Request Failed Or Cannot Still Commit.</p>}
      </section>}
      </div>
      {flock && <div id="daily-flock-import" tabIndex={-1} className={`mt ${styles.importSection}`}><DailyFlockHistoricalImport flockId={flock.id} flockCode={flock.data.flockCode}/></div>}
      </div>
      {fieldline && fieldlineAuthority.operations && <details id="daily-flock-intelligence" className={`mt ${styles.fieldlineDisclosure}`}
        open={wideFieldline || mobileFieldlineOpen} onToggle={(event) => { if (!wideFieldline) setMobileFieldlineOpen(event.currentTarget.open); }}>
        <summary>Fieldline Intelligence <span>View Farm Insights</span></summary>
        <FieldlineV6Experience authority={fieldlineAuthority} source={fieldline.source} historyDays={fieldline.history}/>
      </details>}
    </>}
    {message && <p className="mt" role={message.includes("could not") || message.includes("unavailable") ? "alert" : "status"}><AlertTriangle size={16} aria-hidden="true"/> {message}</p>}
  </Panel>;
}
