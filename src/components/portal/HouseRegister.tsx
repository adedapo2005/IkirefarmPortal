"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Edit3, Home, PauseCircle, PlayCircle, Plus, Search, ShieldCheck } from "lucide-react";
import { has, type Persona } from "@/lib/portal-model";
import { AsyncButtonLabel, Btn, Chip, Panel } from "./Common";
import styles from "./InventoryProcurementDesk.module.css";
import Stage25ActionFeedback from "./Stage25ActionFeedback";
import { createHouseActionController } from "@/lib/stage25-house-feedback";
import type { FeedbackResult } from "@/lib/stage25-feedback-contract";
import { useScopedWriteRecovery } from "@/lib/phase2b-write-recovery";

type HouseData = {
  kind: "house";
  houseCode: string;
  name: string;
  housingSystem: "deep-litter" | "battery-cage" | "aviary" | "brooder" | "free-range" | "other";
  capacityBirds: number;
  zone: string;
  readinessStatus: "ready" | "restricted" | "not-ready" | "unverified";
  sanitationStatus: "recorded-clean" | "attention-required" | "unverified";
  lastSanitizedOn?: string;
  source: string;
  notes?: string;
  evidenceIds?: string[];
};

type HouseRecord = { id: string; state: string; revision: number; data: HouseData };
type FlockRecord = {
  id: string;
  state: string;
  data: {
    kind: "flock";
    flockCode: string;
    name: string;
    species: "chicken" | "turkey" | "duck";
    breed: string;
    house: string;
    placementDate: string;
    birdCount: number;
  };
};
type SourceState = "loading" | "available" | "no-data" | "hidden" | "sign-in" | "unavailable";

const emptyForm = {
  houseCode: "",
  name: "",
  housingSystem: "deep-litter",
  capacityBirds: "",
  zone: "",
  readinessStatus: "unverified",
  sanitationStatus: "unverified",
  lastSanitizedOn: "",
  source: "",
  notes: "",
  evidenceIds: "",
};

function parseEvidence(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function label(value: string) {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function HouseRegister({ person }: { person: Persona }) {
  if (person.principalSource === "authenticated" && !person.authenticatedAccountId?.trim()) {
    return <Panel title="House Register"><p role="alert">Account Identity Could Not Be Confirmed. Sign In Again Before Accessing This Workspace.</p></Panel>;
  }
  const scope = JSON.stringify([person.authenticatedAccountId, person.id, person.employeeId, person.accessState, person.restriction, person.organizationScope, person.permissionScopes, [...person.permissions].sort()]);
  return <HouseRegisterWorkspace key={scope} person={person} />;
}

function HouseRegisterWorkspace({ person }: { person: Persona }) {
  const [state, setState] = useState<SourceState>("loading");
  const [items, setItems] = useState<HouseRecord[]>([]);
  const [flocks, setFlocks] = useState<FlockRecord[]>([]);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRevision, setEditingRevision] = useState<number | null>(null);
  const [editingState, setEditingState] = useState<"active" | "inactive" | "maintenance" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const controller = useRef(createHouseActionController());
  const recovery = useScopedWriteRecovery(person, "house");
  const authorityEpoch = useRef(0);
  const readGeneration = useRef(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const canEdit = has(person, "inventory.edit");

  const load = useCallback(async (search = activeQuery) => {
    const generation = ++readGeneration.current;
    setState("loading");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("q", search);
      const readScoped = async (url: string) => {
        const response = await fetch(url, { credentials: "same-origin", headers: { accept: "application/json" } });
        if (generation === readGeneration.current && [401, 403, 404].includes(response.status)) {
          readGeneration.current++; authorityEpoch.current++;
          setItems([]); setFlocks([]); setNotice(""); setFeedback(null); setForm(emptyForm);
          setEditingId(null); setEditingRevision(null); setEditingState(null); setBusy(null);
          setState(response.status === 401 ? "sign-in" : "hidden");
        }
        return response;
      };
      const [houseResponse, flockResponse] = await Promise.all([
        readScoped(`/api/portal/v7/farm-operations/house?${params.toString()}`),
        readScoped("/api/portal/v7/farm-operations/flock?limit=100"),
      ]);
      if (generation !== readGeneration.current) return;
      if (!houseResponse.ok || !flockResponse.ok) throw new Error("unavailable");
      const housePayload = await houseResponse.json() as { items?: unknown; state?: unknown };
      const flockPayload = await flockResponse.json() as { items?: unknown };
      if (!Array.isArray(housePayload.items) || !["available", "no-data"].includes(String(housePayload.state)) || !Array.isArray(flockPayload.items)) throw new Error("unavailable");
      const houses = housePayload.items.filter((item): item is HouseRecord => Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string" && "state" in item && typeof item.state === "string" && "revision" in item && Number.isInteger(item.revision) && "data" in item && item.data && typeof item.data === "object" && "kind" in item.data && item.data.kind === "house"));
      const authorizedFlocks = flockPayload.items.filter((item): item is FlockRecord => Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string" && "state" in item && typeof item.state === "string" && "data" in item && item.data && typeof item.data === "object" && "kind" in item.data && item.data.kind === "flock"));
      if (houses.length !== housePayload.items.length || authorizedFlocks.length !== flockPayload.items.length) throw new Error("unavailable");
      if (generation !== readGeneration.current) return;
      setItems(houses);
      setFlocks(authorizedFlocks);
      setState(houses.length ? "available" : "no-data");
    } catch {
      if (generation !== readGeneration.current) return;
      setItems([]); setFlocks([]); setState("unavailable");
    }
  }, [activeQuery]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { readGeneration.current++; authorityEpoch.current++; }, []);

  const linkedFlocks = useMemo(() => {
    const result = new Map<string, FlockRecord[]>();
    for (const house of items) {
      const aliases = [house.data.houseCode, house.data.name].map((value) => value.trim().toLocaleLowerCase());
      result.set(house.id, flocks.filter((flock) => flock.state === "active" && aliases.includes(flock.data.house.trim().toLocaleLowerCase())));
    }
    return result;
  }, [items, flocks]);

  const unregisteredPlacements = useMemo(() => {
    const aliases = new Set(items.flatMap((house) => [house.data.houseCode, house.data.name].map((value) => value.trim().toLocaleLowerCase())));
    return flocks.filter((flock) => flock.state === "active" && !aliases.has(flock.data.house.trim().toLocaleLowerCase()));
  }, [items, flocks]);

  const reset = () => {
    setEditingId(null); setEditingRevision(null); setEditingState(null); setForm(emptyForm); setNotice("");
  };

  const startCreate = () => {
    reset();
    window.requestAnimationFrame(() => {
      document.getElementById("house-code")?.focus({ preventScroll: true });
      document.getElementById("house-record-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const edit = (record: HouseRecord) => {
    setEditingId(record.id);
    setEditingRevision(record.revision);
    setEditingState(record.state === "active" || record.state === "inactive" || record.state === "maintenance" ? record.state : null);
    setForm({
      houseCode: record.data.houseCode,
      name: record.data.name,
      housingSystem: record.data.housingSystem,
      capacityBirds: String(record.data.capacityBirds),
      zone: record.data.zone,
      readinessStatus: record.data.readinessStatus,
      sanitationStatus: record.data.sanitationStatus,
      lastSanitizedOn: record.data.lastSanitizedOn || "",
      source: record.data.source,
      notes: record.data.notes || "",
      evidenceIds: (record.data.evidenceIds || []).join(", "),
    });
    window.requestAnimationFrame(() => {
      document.getElementById("house-name")?.focus({ preventScroll: true });
      document.getElementById("house-record-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked || controller.current.busy || controller.current.requiresReconciliation) return;
    if (editingId && (!editingRevision || !editingState)) return;
    const epoch = authorityEpoch.current;
    setBusy("save"); setNotice(""); setFeedback(null);
    const data: HouseData = {
      kind: "house",
      houseCode: form.houseCode.trim(),
      name: form.name.trim(),
      housingSystem: form.housingSystem as HouseData["housingSystem"],
      capacityBirds: Number(form.capacityBirds),
      zone: form.zone.trim(),
      readinessStatus: form.readinessStatus as HouseData["readinessStatus"],
      sanitationStatus: form.sanitationStatus as HouseData["sanitationStatus"],
      lastSanitizedOn: form.lastSanitizedOn || undefined,
      source: form.source.trim(),
      notes: form.notes.trim() || undefined,
      evidenceIds: parseEvidence(form.evidenceIds),
    };
    try {
      const marker = await recovery.begin();
      if (!marker || epoch !== authorityEpoch.current) return;
      const result = await controller.current.run({
        operation: editingId ? "update" : "create",
        expectedCode: data.houseCode, expectedData: data,
        expectedId: editingId || undefined, expectedRevision: editingRevision || undefined,
        expectedState: editingState || undefined,
        send: () => recovery.send(marker, `/api/portal/v7/farm-operations/house${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, {
          method: editingId ? "PATCH" : "POST", credentials: "same-origin",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(editingId ? { data, expectedRevision: editingRevision } : { data }),
        }),
      });
      if (epoch !== authorityEpoch.current) return;
      recovery.settle(marker, result.confirmed);
      if (result.requiresSignIn || result.feedback.state === "denied") {
        authorityEpoch.current++; readGeneration.current++;
        setItems([]); setFlocks([]); setFeedback(null); reset(); setBusy(null);
        setState(result.requiresSignIn ? "sign-in" : "hidden"); return;
      }
      if (result.requiresReconciliation) setReconciliationRequired(true);
      if (result.confirmed) reset();
      setFeedback(result.feedback);
      if (result.refreshHistory) await load();
    } finally { if (epoch === authorityEpoch.current) setBusy(null); }
  };

  const transition = async (record: HouseRecord, to: "active" | "maintenance" | "inactive") => {
    if (busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked || controller.current.busy || controller.current.requiresReconciliation) return;
    if (record.state !== "active" && record.state !== "inactive" && record.state !== "maintenance") return;
    const epoch = authorityEpoch.current;
    setBusy(record.id + to); setNotice(""); setFeedback(null);
    try {
      const marker = await recovery.begin();
      if (!marker || epoch !== authorityEpoch.current) return;
      const result = await controller.current.run({
        operation: to === "active" ? "activate" : to === "maintenance" ? "maintenance" : "deactivate",
        expectedCode: record.data.houseCode, expectedId: record.id,
        expectedRevision: record.revision, expectedState: record.state,
        expectedData: { ...record.data, lastSanitizedOn: record.data.lastSanitizedOn, notes: record.data.notes, evidenceIds: record.data.evidenceIds },
        send: () => recovery.send(marker, `/api/portal/v7/farm-operations/house/${encodeURIComponent(record.id)}`, {
          method: "POST", credentials: "same-origin",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ to, expectedRevision: record.revision }),
        }),
      });
      if (epoch !== authorityEpoch.current) return;
      recovery.settle(marker, result.confirmed);
      if (result.requiresSignIn || result.feedback.state === "denied") {
        authorityEpoch.current++; readGeneration.current++;
        setItems([]); setFlocks([]); setFeedback(null); reset(); setBusy(null);
        setState(result.requiresSignIn ? "sign-in" : "hidden"); return;
      }
      if (result.requiresReconciliation) setReconciliationRequired(true);
      setFeedback(result.feedback);
      if (result.refreshHistory) await load();
    } finally { if (epoch === authorityEpoch.current) setBusy(null); }
  };

  const reconcile = async (action: "check" | "cancel") => {
    if (busy !== null || !canEdit) return;
    const epoch = authorityEpoch.current;
    setBusy("recovery"); setNotice("");
    try {
      const result = await recovery.reconcile(action);
      if (epoch !== authorityEpoch.current) return;
      if (result && "denied" in result) {
        authorityEpoch.current++; readGeneration.current++;
        setItems([]); setFlocks([]); setFeedback(null); reset(); setBusy(null);
        setState(result.denied === 401 ? "sign-in" : "hidden"); return;
      }
      if (!result || !("proof" in result)) {
        setNotice("Outcome Not Confirmed. Keep This Operation Blocked And Try Check Outcome When Access Is Available."); return;
      }
      const {proof,marker} = result;
      if (proof.state === "unconfirmed") {
        setNotice("No Committed Receipt Was Found Yet. The Earlier Request May Still Commit. Check Again Or Cancel The Pending Operation Before Retrying."); return;
      }
      if (!recovery.settle(marker,true)) {
        setNotice("The Server Outcome Was Verified, But Browser Recovery Protection Is Unavailable. Writes Remain Blocked."); return;
      }
      controller.current = createHouseActionController();
      setReconciliationRequired(false);
      if (proof.state === "cancelled") {
        setFeedback(null);
        setNotice("Cancellation Confirmed. The Earlier Operation Cannot Commit With This Identifier. Review Your Entry Before Trying Again.");
      } else {
        setFeedback({state:"saved",tone:"success",title:"House Outcome Recovered",
          message:`The Server Confirmed The Original ${proof.action} Outcome At Revision ${proof.record.revision}. Later Revisions May Exist; Review The Register Before Further Changes.`,
          recordId:proof.record.id,revision:proof.record.revision,auditId:null,occurredAt:null,
          canOpenRecord:false,canShowAudit:false});
      }
      await load();
    } finally { if (epoch === authorityEpoch.current) setBusy(null); }
  };

  const tone = state === "available" ? "blue" : state === "no-data" ? "gray" : "amber";
  return <section id="house-register-workspace" tabIndex={-1} className={styles.console} data-farm-register aria-label="Authorized house register">
    <Panel title="Houses · Physical Authority & Placement Context" description="Maintain the scoped physical house register and review only the active flock placement evidence already verified by the farm operations service.">
      {feedback && state !== "hidden" && state !== "sign-in" && <Stage25ActionFeedback feedback={feedback} />}
      {(!recovery.ready || recovery.blocked || reconciliationRequired) && state !== "hidden" && state !== "sign-in" && <div role="alert">
        <strong>Outcome Reconciliation Required</strong>
        <p>{!recovery.ready ? "Write recovery protection is unavailable. Contact an authorized manager before continuing." :
          recovery.legacy ? "An earlier House operation may have reached the server. Its older marker cannot establish the account or outcome safely. An authorized manager must investigate the record and audit evidence; this screen cannot safely cancel that older write." :
          "An earlier House operation may have reached the server, or its recovery protection is unavailable. A list refresh is not proof of failure. Check the outcome or cancel the pending operation before a new attempt."}</p>
        <p>Entries Remain On This Page. Form Values Are Not Stored And Do Not Survive Reload.</p>
        {canEdit && recovery.recoverable && !recovery.legacy && <div className="row wrap">
          <Btn type="button" disabled={busy !== null} onClick={() => void reconcile("check")}>Check Outcome</Btn>
          <Btn type="button" disabled={busy !== null} onClick={() => void reconcile("cancel")}>Cancel Pending Operation</Btn>
        </div>}
      </div>}
      <div className="row between wrap" aria-live="polite"><Chip tone={tone}>{state === "loading" ? "Loading authorized houses…" : state === "available" ? "Verified house records available" : state === "no-data" ? "No verified house records" : state === "hidden" ? "Unavailable in this scope" : state === "sign-in" ? "Sign in required" : "Service unavailable"}</Chip><span className="metadata">API v7 · scoped physical-house authority</span></div>

      {unregisteredPlacements.length > 0 && state !== "loading" && <div className="auth-state mt" role="status"><ShieldCheck size={20} aria-hidden="true"/><span>{unregisteredPlacements.length} active flock record{unregisteredPlacements.length === 1 ? " references" : "s reference"} a house identity not yet present in this register. No capacity or readiness is inferred for those placements.</span></div>}

      <form className="filters mt" role="search" onSubmit={(event) => { event.preventDefault(); setActiveQuery(query); }}><label className="row grow"><Search size={18}/><input className="filter-input" aria-label="Search house records" placeholder="Search code, name, zone, system or source" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)}/></label><Btn small type="submit" disabled={state === "loading"}>Search</Btn>{activeQuery && <Btn small type="button" onClick={() => { setQuery(""); setActiveQuery(""); }}>Clear</Btn>}</form>
      {state === "hidden" && <p className="mt" role="status">This register is unavailable in your authorized scope. No house details or linked flock counts are disclosed.</p>}
      {state === "sign-in" && <p className="mt" role="status">Sign in to load the authorized house register.</p>}
      {state === "unavailable" && <p className="mt" role="alert">The house registry or linked flock source could not be reached. Sample houses, capacity, readiness, and sanitation claims are not shown.</p>}

      {canEdit && state !== "hidden" && state !== "sign-in" && <>
        <div className="row between wrap mt"><div><h3>{editingId ? "Edit House" : "Add House"}</h3><p>{editingId ? "Update recorded physical-house evidence without changing the immutable house code." : "Create one real physical-house identity in the authorized farm scope."}</p></div><Btn data-primary-action="house-create" onClick={startCreate} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked}><Plus size={16}/> New House</Btn></div>
        <form id="house-record-form" tabIndex={-1} className={`${styles.form} mt`} onSubmit={save}>
          <div className={styles.fields} inert={busy !== null} aria-busy={busy === "save"}>
            <p className={styles.fullWidth}>Fields Are Required Unless Marked Optional.</p>
            <label className="field"><span>House Code</span><input id="house-code" value={form.houseCode} onChange={(event) => setForm((current) => ({ ...current, houseCode: event.target.value }))} maxLength={80} autoComplete="off" disabled={Boolean(editingId)} required/></label>
            <label className="field"><span>House Name</span><input id="house-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} autoComplete="off" required/></label>
            <label className="field"><span>Housing System</span><select value={form.housingSystem} onChange={(event) => setForm((current) => ({ ...current, housingSystem: event.target.value }))} required><option value="deep-litter">Deep litter</option><option value="battery-cage">Battery cage</option><option value="aviary">Aviary</option><option value="brooder">Brooder</option><option value="free-range">Free range</option><option value="other">Other</option></select></label>
            <label className="field"><span>Recorded Capacity (birds)</span><input type="number" min="1" step="1" inputMode="numeric" value={form.capacityBirds} onChange={(event) => setForm((current) => ({ ...current, capacityBirds: event.target.value }))} required/></label>
            <label className="field"><span>Zone / Location</span><input value={form.zone} onChange={(event) => setForm((current) => ({ ...current, zone: event.target.value }))} maxLength={120} autoComplete="off" required/></label>
            <label className="field"><span>Readiness Record</span><select value={form.readinessStatus} onChange={(event) => setForm((current) => ({ ...current, readinessStatus: event.target.value }))} required><option value="unverified">Unverified</option><option value="ready">Ready</option><option value="restricted">Restricted</option><option value="not-ready">Not ready</option></select></label>
            <label className="field"><span>Sanitation Record</span><select value={form.sanitationStatus} onChange={(event) => setForm((current) => ({ ...current, sanitationStatus: event.target.value }))} required><option value="unverified">Unverified</option><option value="recorded-clean">Recorded clean</option><option value="attention-required">Attention required</option></select></label>
            <label className="field"><span>Last Sanitized On · Optional</span><input type="date" value={form.lastSanitizedOn} onChange={(event) => setForm((current) => ({ ...current, lastSanitizedOn: event.target.value }))}/></label>
            <label className={`field ${styles.fullWidth}`}><span>Source / Inspection Reference</span><input value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} maxLength={160} autoComplete="off" required/></label>
            <label className={`field ${styles.fullWidth}`}><span>House Notes · Optional</span><textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}/><small>Optional descriptive evidence. Do not enter inferred occupancy, health, or suitability claims.</small></label>
            <label className={`field ${styles.fullWidth}`}><span>Evidence IDs · Optional</span><textarea rows={2} maxLength={3220} value={form.evidenceIds} onChange={(event) => setForm((current) => ({ ...current, evidenceIds: event.target.value }))}/><small>Optional. Separate up to 20 authorized evidence IDs with commas.</small></label>
          </div>
          <aside className={styles.actionPane} data-house-actions><Home size={24}/><p>Physical identity, recorded capacity, readiness, sanitation, and source are maintained as explicit evidence. New houses begin inactive until a ready record is explicitly activated.</p><p className="form-note">Linked flock totals use recorded opening birds. The portal does not infer current occupancy, utilization, biosecurity, or suitability.</p><Btn primary type="submit" disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked} aria-busy={busy === "save"}><AsyncButtonLabel busy={busy === "save"} idle={editingId ? "Save House Changes" : "Add House"} busyText="Saving house record…"/></Btn>{editingId && <Btn type="button" onClick={reset}>Cancel Edit</Btn>}</aside>
        </form>
      </>}

      <div className={styles.register}>
        <div className="row between wrap"><h3>Authorized House Register</h3><span className="metadata">{items.length} loaded record{items.length === 1 ? "" : "s"}</span></div>
        {state === "no-data" && <p>{activeQuery ? "No authorized house records match this search." : "No authorized physical-house records have been recorded yet."}</p>}
        {state === "available" && items.map((record) => {
          const linked = linkedFlocks.get(record.id) || [];
          const openingBirds = linked.reduce((total, flock) => total + Number(flock.data.birdCount || 0), 0);
          return <article className={styles.record} key={record.id}>
            <div><div className="row wrap"><Chip tone={record.state === "active" ? "blue" : "gray"}>{record.state}</Chip><strong>{record.data.name} · {record.data.houseCode}</strong></div><p>{label(record.data.housingSystem)} · {record.data.zone} · recorded capacity {record.data.capacityBirds.toLocaleString()} birds</p><small>Readiness: {label(record.data.readinessStatus)} · Sanitation: {label(record.data.sanitationStatus)}{record.data.lastSanitizedOn ? ` · Last sanitized ${record.data.lastSanitizedOn}` : ""}</small><small>{linked.length} linked active flock{linked.length === 1 ? "" : "s"} · {openingBirds.toLocaleString()} recorded opening birds · Revision {record.revision}</small><span>Source: {record.data.source}</span>{record.data.notes && <span>{record.data.notes}</span>}</div>
            {canEdit && <div className="row wrap"><Btn onClick={() => edit(record)} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked}><Edit3 size={16}/> Edit</Btn>{record.state === "active" && <Btn onClick={() => void transition(record, "maintenance")} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked} aria-busy={busy === record.id + "maintenance"}><PauseCircle size={16}/> Mark Maintenance</Btn>}{record.state !== "active" && <Btn onClick={() => void transition(record, "active")} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked} aria-busy={busy === record.id + "active"}><PlayCircle size={16}/> Return Active</Btn>}{record.state !== "inactive" && <Btn onClick={() => void transition(record, "inactive")} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked} aria-busy={busy === record.id + "inactive"}>Deactivate</Btn>}</div>}
            {!canEdit && <span className="row"><ShieldCheck size={16}/> Read-only authorized view</span>}
          </article>;
        })}
      </div>
      {notice && <p className="mt" role="status">{notice}</p>}
    </Panel>
  </section>;
}
