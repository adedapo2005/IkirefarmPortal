"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { Btn, Panel, Chip } from "./Common";
import styles from "./HistoricalImport.module.css";

type Candidate = {
  id: string; kind: string; value: number | string | null; unit: string; item: string | null;
  reportDate: string | null; explicitNone: boolean; confidence: string; reviewRequired: boolean;
  uncertaintyReasons: string[]; duplicateOf: string | null; sourceSpan: { start: number; end: number; text?: string };
};
type ImportRecord = { id: string; revision: number; state: string; data: { candidates: Candidate[] } };
type Preview = { record: ImportRecord; preview: { candidates: Candidate[]; messages: Array<{ reportDate: string | null; attribution: { displayName: string | null; verifiedActor: false }; sourceSpan: { text: string } }>; warnings: string[]; canonicalWritesPerformed: false } };
type Decision = { action: "include" | "skip"; confirmed: boolean; reason: string; reportDate: string; occurredAt: string; value: number | string; unit: string; notes: string; vaccineCode: string; itemCode: string; inventoryItemId: string; stockMovementId: string };

const endpoint = "/api/portal/v7/daily-flock-imports";
const movementKinds = new Set(["placement", "mortality", "cull", "transfer-in", "transfer-out"]);
const time24 = (value: string) => {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}:00+01:00`;
};
const initialDecision = (candidate: Candidate): Decision => ({ action: "skip", confirmed: false, reason: "", reportDate: candidate.reportDate || "", occurredAt: "", value: candidate.value ?? "", unit: candidate.unit, notes: "", vaccineCode: "", itemCode: "", inventoryItemId: "", stockMovementId: "" });
const displayKind = (kind: string) => kind.replaceAll("-", " ");
const candidateReady = (candidate: Candidate, decision: Decision) => {
  if (decision.action === "skip") return true;
  if (!decision.reportDate || Boolean(candidate.duplicateOf)) return false;
  if (candidate.explicitNone) return true;
  if (!time24(decision.occurredAt) || !Number.isFinite(Number(decision.value)) || Number(decision.value) <= 0) return false;
  if (movementKinds.has(candidate.kind)) return Number.isSafeInteger(Number(decision.value));
  if (candidate.kind === "feed-consumed") return Boolean(decision.itemCode.trim() && decision.inventoryItemId.trim() && decision.stockMovementId.trim() && ["kg", "ton"].includes(decision.unit));
  if (candidate.kind === "medication-administered") return Boolean(decision.notes.trim());
  if (candidate.kind === "vaccination") return Boolean(decision.vaccineCode.trim() && Number.isSafeInteger(Number(decision.value)));
  return false;
};

export default function DailyFlockHistoricalImport({ flockId, flockCode }: { flockId: string; flockCode: string }) {
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState("Pasted flock notes");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"preview" | "publish" | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "hidden" | "error" | "published">("idle");
  const [message, setMessage] = useState("");
  const candidates = useMemo(() => preview?.preview.candidates ?? [], [preview]);
  const complete = useMemo(() => candidates.length > 0 && candidates.every((candidate) => {
    const decision = decisions[candidate.id];
    return Boolean(decision?.confirmed && decision.reason.trim().length > 0 && candidateReady(candidate, decision));
  }) && candidates.some((candidate) => decisions[candidate.id]?.action === "include"), [candidates, decisions]);
  const update = (candidate: Candidate, patch: Partial<Decision>) => setDecisions((current) => ({ ...current, [candidate.id]: { ...(current[candidate.id] ?? initialDecision(candidate)), ...patch } }));

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name); setSourceName(file.name);
    try { setSource(await file.text()); setMessage("Source loaded in this browser. It is sent only when you request a server preview."); }
    catch { setMessage("The selected source could not be read in this browser."); }
  };

  const requestPreview = async () => {
    setBusy(true); setBusyAction("preview"); setState("loading"); setMessage(""); setPreview(null); setDecisions({});
    try {
      const response = await fetch(`${endpoint}/preview`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ flockId, sourceText: source, sourceName, deviceClass: window.matchMedia("(max-width: 640px)").matches ? "mobile" : window.matchMedia("(max-width: 1024px)").matches ? "tablet" : "desktop" }) });
      if (response.status === 401) { setState("hidden"); setMessage("Sign in to access this management workflow. No import details are shown."); return; }
      if (response.status === 403 || response.status === 404) { setState("hidden"); setMessage("This management workflow is unavailable in your authorized scope. No import details are shown."); return; }
      if (response.status === 503) throw new Error("Evidence storage or the import service is unavailable. The source was not accepted for review.");
      if (!response.ok) throw new Error("The source could not be prepared for review. Check the text and try again.");
      const value = await response.json() as Preview;
      if (!value?.record?.id || !Number.isSafeInteger(value.record.revision) || !Array.isArray(value.record.data?.candidates) || !Array.isArray(value.preview?.messages) || value.preview.canonicalWritesPerformed !== false) throw new Error("The server returned an incomplete preview. No records were published.");
      setPreview(value); setDecisions(Object.fromEntries(value.record.data.candidates.map((candidate) => [candidate.id, initialDecision(candidate)]))); setState("ready");
      setMessage(value.record.data.candidates.length ? "Server preview ready. No canonical records have been written." : "The server found no supported candidates. Nothing has been published.");
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "The import preview is unavailable."); }
    finally { setBusy(false); setBusyAction(null); }
  };

  const publish = async () => {
    if (!preview || !complete || busy) return;
    setBusy(true); setBusyAction("publish"); setMessage("");
    const payload = candidates.map((candidate) => {
      const decision = decisions[candidate.id];
      return { candidateId: candidate.id, action: decision.action, confirmed: true, reason: decision.reason.trim(), ...(decision.action === "include" ? { reportDate: decision.reportDate, ...(candidate.explicitNone ? { value: 0, unit: decision.unit } : { occurredAt: `${decision.reportDate}T${time24(decision.occurredAt)}`, value: Number(decision.value), unit: decision.unit }), ...(decision.notes.trim() ? { notes: decision.notes.trim() } : {}), ...(decision.vaccineCode.trim() ? { vaccineCode: decision.vaccineCode.trim() } : {}), ...(decision.itemCode.trim() ? { itemCode: decision.itemCode.trim() } : {}), ...(decision.inventoryItemId.trim() ? { inventoryItemId: decision.inventoryItemId.trim() } : {}), ...(decision.stockMovementId.trim() ? { stockMovementId: decision.stockMovementId.trim() } : {}) } : {}) };
    });
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(preview.record.id)}/publish`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: preview.record.revision, decisions: payload }) });
      if (response.status === 401 || response.status === 403 || response.status === 404) { setState("hidden"); setMessage("Publication is unavailable in your authorized scope. No import details are shown."); return; }
      if (response.status === 409) { setMessage("The server found a revision or same-day report conflict. Review the current authorized record and linked correction workflow; this import was not retried."); return; }
      if (response.status === 503) throw new Error("The import service is unavailable. The server did not confirm publication.");
      if (!response.ok) throw new Error("The server did not accept this review. No publication is confirmed; check required fields and decisions.");
      const result = await response.json() as ImportRecord;
      if (result.id !== preview.record.id || result.state !== "published" || !Array.isArray((result as ImportRecord & { data?: { publishedRecordIds?: string[] } }).data?.publishedRecordIds)) throw new Error("The response did not confirm a published state. Do not assume records were created.");
      setPreview((current) => current ? { ...current, record: result } : current); setState("published");
      setMessage(`Server confirmed publication. ${((result as ImportRecord & { data: { publishedRecordIds: string[] } }).data.publishedRecordIds).length} linked record IDs are available in the authorized receipt.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The server did not confirm publication."); }
    finally { setBusy(false); setBusyAction(null); }
  };

  const grouped = candidates.reduce<Record<string, Candidate[]>>((groups, candidate) => { const key = candidate.reportDate || "Date needs review"; (groups[key] ||= []).push(candidate); return groups; }, {});
  const stage = state === "published" ? 3 : preview ? 2 : 1;
  return <Panel className={styles.importPanel} title="Historical report import" description="Management review · server-authorized source evidence · Africa/Lagos report dates">
    <ol className={styles.stages} aria-label="Historical import stages">{["Source", "Review", "Server confirmation"].map((label,index)=><li key={label} className={`${styles.stage} ${stage===index+1 ? styles.stageCurrent : ""}`} aria-current={stage===index+1 ? "step" : undefined}><span className={styles.stageNumber} aria-hidden="true">{index+1}</span><span>{label}</span></li>)}</ol>
    <p className="form-note">Import a WhatsApp TXT export or paste notes for {flockCode}. Sender names are unverified text provenance, never authenticated identities. Preview does not publish operational records.</p>
    <div className="stack mt">
      <label className="field"><span>WhatsApp TXT file (optional)</span><input type="file" accept=".txt,text/plain" onChange={(event) => void chooseFile(event.target.files?.[0])}/>{fileName && <small>Loaded locally: {fileName}</small>}</label>
      <label className="field"><span>Source text</span><textarea rows={6} maxLength={2_097_152} value={source} onChange={(event) => { setSource(event.target.value); setPreview(null); setState("idle"); }} placeholder="Paste an exported conversation or dated flock notes"/></label>
      <label className="field"><span>Source label</span><input maxLength={120} value={sourceName} onChange={(event) => setSourceName(event.target.value)}/></label>
      <Btn type="button" onClick={() => void requestPreview()} disabled={busy || !source.trim()} aria-busy={busyAction === "preview"}>{busyAction === "preview" ? <LoaderCircle className="loading-spin" size={16} aria-hidden="true"/> : <FileUp size={16}/>}<span>{busyAction === "preview" ? "Preparing preview…" : "Prepare server review"}</span></Btn>
    </div>
    {busyAction && <div className="async-operation-status mt" role="status" aria-live="polite" aria-atomic="true"><LoaderCircle className="loading-spin" size={18} aria-hidden="true"/><div><strong>{busyAction === "preview" ? "Preparing secure server preview" : "Waiting for server confirmation"}</strong><p>{busyAction === "preview" ? "No operational records are being published while the preview is prepared." : "Publication is not considered successful until the server returns an authorized receipt."}</p></div></div>}
    {message && <p className="mt" role={state === "error" ? "alert" : "status"}>{state === "published" ? <ShieldCheck size={16} aria-hidden="true"/> : state === "error" ? <AlertTriangle size={16} aria-hidden="true"/> : null} {message}</p>}
    {state === "ready" && preview && <div className="stack mt" aria-live="polite">
      <div className="row between wrap"><h3>Candidate review</h3><Chip tone="amber">{candidates.length} candidates · no writes yet</Chip></div>
      {preview.preview.warnings.map((warning) => <p className="form-note" key={warning}>{warning}</p>)}
      {Object.entries(grouped).map(([date, rows]) => <section className="stack" key={date} aria-label={`Candidates for ${date}`}><h3>{date}</h3>{rows.map((candidate) => {
        const decision = decisions[candidate.id] ?? initialDecision(candidate);
        const readyToInclude = candidateReady(candidate, decision);
        return <article className={`metric-card ${styles.candidate}`} key={candidate.id}>
          <div className="row between wrap"><strong>{displayKind(candidate.kind)}</strong><Chip tone={candidate.reviewRequired || candidate.duplicateOf ? "amber" : "gray"}>{candidate.duplicateOf ? "Possible duplicate" : candidate.confidence === "high" ? "Review required" : "Review required"}</Chip></div>
          <p className="mt">{candidate.sourceSpan.text || "Source text is retained as restricted evidence."}</p>
          <small>{candidate.item ? `${candidate.item} · ` : ""}{candidate.value ?? "Value needs review"} {candidate.unit} {candidate.duplicateOf ? "· duplicate candidate; skip one copy" : ""}</small>
          {candidate.uncertaintyReasons.map((reason) => <small className="block" key={reason}>{reason}</small>)}
          <div className="filters mt">
            <label className="field"><span>Decision</span><select value={decision.action} onChange={(event) => update(candidate, { action: event.target.value as Decision["action"], confirmed: false })}><option value="skip">Skip this candidate</option><option value="include">Include after review</option></select></label>
            {decision.action === "include" && <>
              <label className="field"><span>Confirmed report date · WAT</span><input type="date" value={decision.reportDate} onChange={(event) => update(candidate, { reportDate: event.target.value, confirmed: false })}/></label>
              {!candidate.explicitNone && <label className="field"><span>When it happened · WAT</span><input type="text" inputMode="text" autoComplete="off" placeholder="09:30 AM" aria-describedby={`time-help-${candidate.id}`} value={decision.occurredAt} onChange={(event) => update(candidate, { occurredAt: event.target.value, confirmed: false })}/><small id={`time-help-${candidate.id}`}>Enter the verified time in 12-hour AM/PM format for the reviewed Africa/Lagos date.</small></label>}
              {!candidate.explicitNone && <label className="field"><span>Verified value</span><input type="number" min="0" step="any" value={decision.value} onChange={(event) => update(candidate, { value: event.target.value, confirmed: false })}/></label>}
              {candidate.kind === "feed-consumed" && <>
                <label className="field"><span>Resolved unit</span><select value={decision.unit} onChange={(event) => update(candidate, { unit: event.target.value, confirmed: false })}><option value="kg">kg</option><option value="ton">ton</option><option value="bag" disabled>Bag · unresolved</option></select></label>
                <label className="field"><span>Verified Inventory item code</span><input value={decision.itemCode} onChange={(event) => update(candidate, { itemCode: event.target.value, confirmed: false })}/></label>
                <label className="field"><span>Canonical Inventory item ID</span><input value={decision.inventoryItemId} onChange={(event) => update(candidate, { inventoryItemId: event.target.value, confirmed: false })}/></label>
                <label className="field"><span>Canonical stock issue movement ID</span><input value={decision.stockMovementId} onChange={(event) => update(candidate, { stockMovementId: event.target.value, confirmed: false })}/></label>
              </>}
              {candidate.kind === "vaccination" && <label className="field"><span>Canonical vaccine code</span><input value={decision.vaccineCode} onChange={(event) => update(candidate, { vaccineCode: event.target.value, confirmed: false })}/></label>}
              {candidate.kind === "medication-administered" && <label className="field"><span>Confirmed treatment notes</span><textarea rows={2} value={decision.notes} onChange={(event) => update(candidate, { notes: event.target.value, confirmed: false })}/></label>}
              {!readyToInclude && <p className="form-note">Complete the verified canonical fields shown above before confirming inclusion. No values are inferred from this source.</p>}
            </>}
            <label className="field grow"><span>Review reason (required)</span><input maxLength={500} value={decision.reason} onChange={(event) => update(candidate, { reason: event.target.value, confirmed: false })}/></label>
          </div>
          <label className="row mt"><input type="checkbox" checked={decision.confirmed} disabled={!decision.reason.trim() || decision.action === "include" && !readyToInclude} onChange={(event) => update(candidate, { confirmed: event.target.checked })}/><span>I reviewed this candidate and confirm the decision above.</span></label>
        </article>;
      })}</section>)}
      <Btn primary type="button" onClick={() => void publish()} disabled={!complete || busy} aria-busy={busyAction === "publish"}>{busyAction === "publish" && <LoaderCircle className="loading-spin" size={16} aria-hidden="true"/>}<span>{busyAction === "publish" ? "Waiting for server confirmation…" : "Submit reviewed import"}</span></Btn>
      <p className="metadata">Every candidate needs one confirmed include or skip decision. Duplicate candidates cannot both be included. Publication is subject to server authorization, maker/checker, canonical lineage, and conflict checks.</p>
    </div>}
  </Panel>;
}
