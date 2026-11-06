"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRightLeft, CheckCircle2, ClipboardCheck, Plus, Search, ShieldCheck, XCircle } from "lucide-react";
import { has, type Persona } from "@/lib/portal-model";
import { AsyncButtonLabel, Btn, Chip, Panel } from "./Common";
import { recordedDateOnly, recordedWallTime } from "@/lib/logged-instant";
import LoggedTimestamp from "./LoggedTimestamp";
import styles from "./InventoryProcurementDesk.module.css";
import { toast } from "sonner";

type TransferData = {
  kind: "flock-transfer";
  transferCode: string;
  flockCode: string;
  sourceHouse: string;
  destinationHouse: string;
  birdCount: number;
  plannedFor: string;
  reason: string;
  evidenceIds?: string[];
  reconciledBirdCount?: number;
  completedAt?: string;
  completionNotes?: string;
};

type TransferRecord = {
  id: string;
  state: "planned" | "approved" | "completed" | "cancelled" | string;
  revision: number;
  data: TransferData;
};

type FlockRecord = {
  id: string;
  state: string;
  data: { kind: "flock"; flockCode: string; name: string; house: string; birdCount: number };
};

type HouseRecord = {
  id: string;
  state: string;
  data: { kind: "house"; houseCode: string; name: string };
};

type SourceState = "loading" | "available" | "no-data" | "hidden" | "sign-in" | "unavailable";

const emptyForm = {
  transferCode: "",
  flockCode: "",
  sourceHouse: "",
  destinationHouse: "",
  birdCount: "",
  plannedFor: "",
  reason: "",
  evidenceIds: "",
};

function parseEvidence(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function errorMessage(status: number, payload: { error?: unknown; details?: unknown } | null, fallback: string) {
  const details = Array.isArray(payload?.details)
    ? payload.details.filter((value): value is string => typeof value === "string").join(" ")
    : "";
  if (status === 401) return "Sign in again before continuing.";
  if (status === 403 || status === 404) return "This action is unavailable in your authorized scope.";
  if (status === 409) return "This transfer changed on the server or its transfer code already exists. The register has been refreshed.";
  if (status === 422) return details || fallback;
  return fallback;
}

export default function FlockTransferDesk({ person }: { person: Persona }) {
  const [state, setState] = useState<SourceState>("loading");
  const [items, setItems] = useState<TransferRecord[]>([]);
  const [flocks, setFlocks] = useState<FlockRecord[]>([]);
  const [houses, setHouses] = useState<HouseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [completion, setCompletion] = useState({ count: "", completedAt: "", notes: "" });
  const canEdit = has(person, "inventory.edit");
  const canApprove = has(person, "inventory.approve");
  const canPlanTransfer = flocks.length > 0 && houses.length >= 2;

  const load = useCallback(async (search = activeQuery) => {
    setState("loading");
    setNotice("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("q", search);
      const [response, flockResponse, houseResponse] = await Promise.all([
        fetch(`/api/portal/v7/farm-operations/flock-transfer?${params.toString()}`, { credentials: "same-origin", headers: { accept: "application/json" } }),
        fetch("/api/portal/v7/farm-operations/flock?limit=100", { credentials: "same-origin", headers: { accept: "application/json" } }),
        fetch("/api/portal/v7/farm-operations/house?limit=100", { credentials: "same-origin", headers: { accept: "application/json" } }),
      ]);
      if ([response, flockResponse, houseResponse].some((item) => item.status === 401)) { setItems([]); setFlocks([]); setHouses([]); setState("sign-in"); return; }
      if ([response, flockResponse, houseResponse].some((item) => item.status === 403 || item.status === 404)) { setItems([]); setFlocks([]); setHouses([]); setState("hidden"); return; }
      if (!response.ok || !flockResponse.ok || !houseResponse.ok) throw new Error("unavailable");
      const payload = await response.json() as { items?: unknown; state?: unknown };
      const flockPayload = await flockResponse.json() as { items?: unknown };
      const housePayload = await houseResponse.json() as { items?: unknown };
      if (!Array.isArray(payload.items) || !["available", "no-data"].includes(String(payload.state)) || !Array.isArray(flockPayload.items) || !Array.isArray(housePayload.items)) throw new Error("unavailable");
      const records = payload.items.filter((item): item is TransferRecord => Boolean(
        item && typeof item === "object" && "id" in item && typeof item.id === "string"
        && "state" in item && typeof item.state === "string"
        && "revision" in item && Number.isInteger(item.revision)
        && "data" in item && item.data && typeof item.data === "object"
        && "kind" in item.data && item.data.kind === "flock-transfer",
      ));
      const authorizedFlocks = flockPayload.items.filter((item): item is FlockRecord => Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string" && "state" in item && typeof item.state === "string" && "data" in item && item.data && typeof item.data === "object" && "kind" in item.data && item.data.kind === "flock" && "flockCode" in item.data && typeof item.data.flockCode === "string" && "house" in item.data && typeof item.data.house === "string"));
      const authorizedHouses = housePayload.items.filter((item): item is HouseRecord => Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string" && "state" in item && typeof item.state === "string" && "data" in item && item.data && typeof item.data === "object" && "kind" in item.data && item.data.kind === "house" && "houseCode" in item.data && typeof item.data.houseCode === "string" && "name" in item.data && typeof item.data.name === "string"));
      if (records.length !== payload.items.length || authorizedFlocks.length !== flockPayload.items.length || authorizedHouses.length !== housePayload.items.length) throw new Error("unavailable");
      setItems(records);
      setFlocks(authorizedFlocks.filter((record) => record.state === "active"));
      setHouses(authorizedHouses.filter((record) => record.state === "active"));
      setState(records.length ? "available" : "no-data");
    } catch {
      setItems([]); setFlocks([]); setHouses([]);
      setState("unavailable");
    }
  }, [activeQuery]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("create");
    setNotice("");
    const data: TransferData = {
      kind: "flock-transfer",
      transferCode: form.transferCode.trim(),
      flockCode: form.flockCode.trim(),
      sourceHouse: form.sourceHouse.trim(),
      destinationHouse: form.destinationHouse.trim(),
      birdCount: Number(form.birdCount),
      plannedFor: form.plannedFor,
      reason: form.reason.trim(),
      evidenceIds: parseEvidence(form.evidenceIds),
    };
    try {
      const response = await fetch("/api/portal/v7/farm-operations/flock-transfer", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) {
        let payload: { error?: unknown; details?: unknown } | null = null;
        try { payload = await response.json() as typeof payload; } catch {}
        const message = errorMessage(response.status, payload, "Review the required transfer details and try again.");
        setNotice(message); toast.error(message); return;
      }
      setForm(emptyForm);
      toast.success("Transfer plan saved", { description: "The plan is awaiting independent approval." });
      await load();
    } catch {
      const message = "The authorized flock transfer service is unavailable.";
      setNotice(message); toast.error(message);
    } finally { setBusy(null); }
  };

  const transition = async (record: TransferRecord, to: "approved" | "cancelled") => {
    setBusy(record.id + to);
    setNotice("");
    try {
      const response = await fetch(`/api/portal/v7/farm-operations/flock-transfer/${record.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ to, expectedRevision: record.revision }),
      });
      if (!response.ok) {
        let payload: { error?: unknown; details?: unknown } | null = null;
        try { payload = await response.json() as typeof payload; } catch {}
        const fallback = to === "approved"
          ? "Approval requires a different authorized reviewer with transfer approval authority."
          : "The transfer could not be cancelled.";
        const message = response.status === 404 && to === "approved" ? fallback : errorMessage(response.status, payload, fallback);
        setNotice(message); toast.error(message); await load(); return;
      }
      toast.success(to === "approved" ? "Transfer approved" : "Transfer cancelled");
      await load();
    } catch {
      const message = "The authorized transfer workflow is unavailable.";
      setNotice(message); toast.error(message);
    } finally { setBusy(null); }
  };

  const complete = async (event: FormEvent, record: TransferRecord) => {
    event.preventDefault();
    setBusy(record.id + "complete");
    setNotice("");
    const nextData: TransferData = {
      ...record.data,
      reconciledBirdCount: Number(completion.count),
      completedAt: completion.completedAt,
      completionNotes: completion.notes.trim() || undefined,
    };
    try {
      const update = await fetch(`/api/portal/v7/farm-operations/flock-transfer/${record.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ data: nextData, expectedRevision: record.revision }),
      });
      if (!update.ok) {
        let payload: { error?: unknown; details?: unknown } | null = null;
        try { payload = await update.json() as typeof payload; } catch {}
        const message = errorMessage(update.status, payload, "Completion evidence could not be recorded.");
        setNotice(message); toast.error(message); await load(); return;
      }
      const updated = await update.json() as TransferRecord;
      const finish = await fetch(`/api/portal/v7/farm-operations/flock-transfer/${record.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ to: "completed", expectedRevision: updated.revision }),
      });
      if (!finish.ok) {
        const message = "Completion evidence was saved, but the final transition was not confirmed. Reload and retry completion.";
        setNotice(message); toast.error(message); await load(); return;
      }
      setCompletionId(null);
      setCompletion({ count: "", completedAt: "", notes: "" });
      toast.success("Transfer completed", { description: "The reconciled count and completion time were confirmed by the server." });
      await load();
    } catch {
      const message = "The authorized transfer completion service is unavailable.";
      setNotice(message); toast.error(message);
    } finally { setBusy(null); }
  };

  const tone = state === "available" ? "blue" : state === "no-data" ? "gray" : "amber";
  return (
    <section id="flock-transfer-workspace" tabIndex={-1} className={styles.console}>
      <Panel title="Flock Transfers · Controlled Movement & Reconciliation" description="Plan movements between houses, separate approval from creation, and reconcile the completed bird count through the server-authorized workflow.">
        <div className="row between wrap" aria-live="polite">
          <Chip tone={tone}>{state === "loading" ? "Loading authorized transfers…" : state === "available" ? "Verified transfers available" : state === "no-data" ? "No verified transfers" : state === "hidden" ? "Unavailable in this scope" : state === "sign-in" ? "Sign in required" : "Service unavailable"}</Chip>
          <span className="metadata">API v7 · maker-checker approval · audited revisions</span>
        </div>
        <form className="filters mt" role="search" onSubmit={(event) => { event.preventDefault(); setActiveQuery(query); }}>
          <label className="row grow"><Search size={18}/><input className="filter-input" aria-label="Search flock transfers" placeholder="Search transfer, flock, house, reason or evidence" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)}/></label>
          <Btn small type="submit" disabled={state === "loading"}>Search</Btn>
        </form>
        {state === "hidden" && <p className="mt" role="status">This collection is unavailable in your authorized scope. No transfer details or counts are disclosed.</p>}
        {state === "sign-in" && <p className="mt" role="status">Sign in to load authorized transfers. No transfer details or counts are disclosed.</p>}
        {state === "unavailable" && <p className="mt" role="alert">The transfer service could not be reached. Sample movements are not shown as a fallback.</p>}

        {state !== "loading" && canEdit && !canPlanTransfer && <div id="transfer-prerequisites" className="auth-state mt" role="status"><ShieldCheck size={20}/><span>Transfer planning requires an active authorized flock and at least two active authorized house records. Add and activate those records before saving a movement plan.</span></div>}

        {canEdit && <>
          <div className="row between wrap mt">
            <div><h3>Plan Transfer</h3><p>Create one real movement plan against an active authorized flock record.</p></div>
            <Btn data-primary-action="flock-transfer-create" onClick={() => { document.getElementById("transfer-code")?.focus({ preventScroll: true }); document.getElementById("flock-transfer-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Plus size={16}/> New Transfer</Btn>
          </div>
          <form id="flock-transfer-form" tabIndex={-1} className={`${styles.form} mt`} onSubmit={create}>
            <div className={styles.fields}>
              <label className="field"><span>Transfer Code</span><input id="transfer-code" value={form.transferCode} onChange={(event) => setForm((current) => ({ ...current, transferCode: event.target.value }))} maxLength={80} autoComplete="off" required/></label>
              <label className="field"><span>Active Flock</span><select value={form.flockCode} onChange={(event) => { const flock = flocks.find((item) => item.data.flockCode === event.target.value); setForm((current) => ({ ...current, flockCode: event.target.value, sourceHouse: flock?.data.house || "", destinationHouse: current.destinationHouse === flock?.data.house ? "" : current.destinationHouse })); }} required><option value="">Select active flock</option>{flocks.map((flock) => <option key={flock.id} value={flock.data.flockCode}>{flock.data.flockCode} · {flock.data.name}</option>)}</select></label>
              <label className="field"><span>Verified Source House</span><input value={form.sourceHouse} readOnly aria-readonly="true" required/></label>
              <label className="field"><span>Active Destination House</span><select value={form.destinationHouse} onChange={(event) => setForm((current) => ({ ...current, destinationHouse: event.target.value }))} required><option value="">Select destination house</option>{houses.filter((house) => ![house.data.houseCode, house.data.name].some((value) => value.trim().toLocaleLowerCase() === form.sourceHouse.trim().toLocaleLowerCase())).map((house) => <option key={house.id} value={house.data.houseCode}>{house.data.houseCode} · {house.data.name}</option>)}</select></label>
              <label className="field"><span>Planned Bird Count</span><input type="number" min="1" step="1" inputMode="numeric" value={form.birdCount} onChange={(event) => setForm((current) => ({ ...current, birdCount: event.target.value }))} required/></label>
              <label className="field"><span>Planned Date & Time</span><input type="datetime-local" value={form.plannedFor} onChange={(event) => setForm((current) => ({ ...current, plannedFor: event.target.value }))} required/></label>
              <label className={`field ${styles.fullWidth}`}><span>Movement Reason</span><textarea rows={3} maxLength={1000} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required/></label>
              <label className={`field ${styles.fullWidth}`}><span>Evidence IDs</span><textarea rows={2} maxLength={3220} value={form.evidenceIds} onChange={(event) => setForm((current) => ({ ...current, evidenceIds: event.target.value }))}/><small>Optional. Separate up to 20 authorized evidence IDs with commas.</small></label>
            </div>
            <aside className={styles.actionPane}>
              <ArrowRightLeft size={24}/>
              <p>The source is locked to the selected active flock. The destination is selected from active authorized houses. Approval is blocked for the record creator.</p>
              <p className="form-note">This workflow does not infer current flock balance, house utilization, or transport safety.</p>
              <Btn primary type="submit" disabled={busy !== null || !canPlanTransfer} aria-busy={busy === "create"} aria-describedby={!canPlanTransfer ? "transfer-prerequisites" : undefined} style={!canPlanTransfer ? { opacity: 0.55, filter: "saturate(.35)" } : undefined}><AsyncButtonLabel busy={busy === "create"} idle={canPlanTransfer ? "Save Transfer Plan" : "Set Up Flock & Houses First"} busyText="Saving transfer plan…"/></Btn>
            </aside>
          </form>
        </>}

        <div className={styles.register}>
          <div className="row between wrap"><h3>Authorized Transfer Register</h3><span className="metadata">{items.length} loaded record{items.length === 1 ? "" : "s"}</span></div>
          {state === "no-data" && <p>{activeQuery ? "No authorized flock transfers match this search." : "No authorized flock transfers have been recorded yet."}</p>}
          {state === "available" && items.map((record) => {
            const variance = record.data.reconciledBirdCount === undefined ? null : record.data.reconciledBirdCount - record.data.birdCount;
            return <article className={styles.record} key={record.id}>
              <div>
                <div className="row wrap"><Chip tone={record.state === "completed" ? "blue" : record.state === "cancelled" ? "gray" : "amber"}>{record.state}</Chip><strong>{record.data.transferCode} · {record.data.flockCode}</strong></div>
                <p>{record.data.sourceHouse} → {record.data.destinationHouse} · {record.data.birdCount.toLocaleString()} planned birds</p>
                <small className={styles.transferPlannedTime}>Planned: {recordedWallTime(record.data.plannedFor) ? <>{recordedWallTime(record.data.plannedFor)} · Time zone unconfirmed</> : recordedDateOnly(record.data.plannedFor) ? <>{record.data.plannedFor} · Time not recorded</> : <LoggedTimestamp value={record.data.plannedFor}/>} · {record.data.reason}</small>
                {record.data.reconciledBirdCount !== undefined && <span>Reconciled: {record.data.reconciledBirdCount.toLocaleString()} birds · Variance {variance === null ? "unavailable" : variance > 0 ? `+${variance}` : variance}</span>}
                <span>Revision {record.revision}{record.data.evidenceIds?.length ? ` · ${record.data.evidenceIds.length} evidence reference${record.data.evidenceIds.length === 1 ? "" : "s"}` : ""}</span>
              </div>
              <div className="row wrap">
                {record.state === "planned" && canApprove && <Btn onClick={() => void transition(record, "approved")} disabled={busy !== null} aria-busy={busy === record.id + "approved"}><ShieldCheck size={16}/><AsyncButtonLabel busy={busy === record.id + "approved"} idle="Approve" busyText="Approving…"/></Btn>}
                {record.state === "planned" && canEdit && <Btn onClick={() => void transition(record, "cancelled")} disabled={busy !== null}><XCircle size={16}/> Cancel</Btn>}
                {record.state === "approved" && canEdit && <Btn onClick={() => { setCompletionId(record.id); setCompletion({ count: String(record.data.reconciledBirdCount ?? record.data.birdCount), completedAt: record.data.completedAt?.slice(0, 16) || "", notes: record.data.completionNotes || "" }); }} disabled={busy !== null}><ClipboardCheck size={16}/> Reconcile & Complete</Btn>}
                {record.state === "approved" && canApprove && <Btn onClick={() => void transition(record, "cancelled")} disabled={busy !== null}><XCircle size={16}/> Cancel</Btn>}
                {record.state === "completed" && <span className="row"><CheckCircle2 size={16}/> Server-confirmed completion</span>}
              </div>
              {completionId === record.id && record.state === "approved" && <form className={`${styles.fields} ${styles.completionForm}`} onSubmit={(event) => void complete(event, record)}>
                <label className="field"><span>Reconciled Bird Count</span><input type="number" min="1" step="1" value={completion.count} onChange={(event) => setCompletion((current) => ({ ...current, count: event.target.value }))} required/></label>
                <label className="field"><span>Completed Date & Time</span><input type="datetime-local" value={completion.completedAt} onChange={(event) => setCompletion((current) => ({ ...current, completedAt: event.target.value }))} required/></label>
                <label className={`field ${styles.fullWidth}`}><span>Completion Notes</span><textarea rows={2} maxLength={1000} value={completion.notes} onChange={(event) => setCompletion((current) => ({ ...current, notes: event.target.value }))} required={Number(completion.count) !== record.data.birdCount}/><small>Required when the reconciled count differs from the approved plan.</small></label>
                <div className="row wrap"><Btn primary type="submit" disabled={busy !== null} aria-busy={busy === record.id + "complete"}><AsyncButtonLabel busy={busy === record.id + "complete"} idle="Confirm Completion" busyText="Confirming completion…"/></Btn><Btn type="button" onClick={() => setCompletionId(null)}>Close</Btn></div>
              </form>}
            </article>;
          })}
        </div>
        {notice && <p className="mt" role="status">{notice}</p>}
      </Panel>
    </section>
  );
}
