"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bird, Edit3, PauseCircle, PlayCircle, Plus, Search, ShieldCheck } from "lucide-react";
import { has, type Persona } from "@/lib/portal-model";
import { AsyncButtonLabel, Btn, Chip, Panel } from "./Common";
import styles from "./InventoryProcurementDesk.module.css";
import Stage25ActionFeedback from "./Stage25ActionFeedback";
import { createBreedActionController } from "@/lib/stage25-breed-feedback";
import type { FeedbackResult } from "@/lib/stage25-feedback-contract";
import { useScopedWriteRecovery } from "@/lib/phase2b-write-recovery";

type BreedData = {
  kind: "breed";
  breedCode: string;
  name: string;
  species: "chicken" | "turkey" | "duck";
  productionClass: "layer" | "broiler" | "dual-purpose" | "breeding" | "other";
  source: string;
  notes?: string;
  evidenceIds?: string[];
};

type BreedRecord = { id: string; state: string; revision: number; data: BreedData };
type FlockRecord = { id: string; state: string; data: { kind: "flock"; breed: string; birdCount: number } };
type SourceState = "loading" | "available" | "no-data" | "hidden" | "sign-in" | "unavailable";

const emptyForm = {
  breedCode: "",
  name: "",
  species: "chicken",
  productionClass: "layer",
  source: "",
  notes: "",
  evidenceIds: "",
};

function parseEvidence(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

export default function BreedManagementDesk({ person }: { person: Persona }) {
  if (person.principalSource === "authenticated" && !person.authenticatedAccountId?.trim()) {
    return <Panel title="Breed Management"><p role="alert">Account Identity Could Not Be Confirmed. Sign In Again Before Accessing This Workspace.</p></Panel>;
  }
  const scope = JSON.stringify([person.authenticatedAccountId, person.id, person.employeeId, person.accessState, person.restriction, person.organizationScope, person.permissionScopes, [...person.permissions].sort()]);
  return <BreedManagementWorkspace key={scope} person={person} />;
}

function BreedManagementWorkspace({ person }: { person: Persona }) {
  const [state, setState] = useState<SourceState>("loading");
  const [items, setItems] = useState<BreedRecord[]>([]);
  const [flocks, setFlocks] = useState<FlockRecord[]>([]);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRevision, setEditingRevision] = useState<number | null>(null);
  const [editingState, setEditingState] = useState<"active" | "inactive" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const controller = useRef(createBreedActionController());
  const recovery = useScopedWriteRecovery(person, "breed");
  const authorityEpoch = useRef(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const canEdit = has(person, "inventory.edit");
  const readGeneration = useRef(0);

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
      const [breedResponse, flockResponse] = await Promise.all([
        readScoped(`/api/portal/v7/farm-operations/breed?${params.toString()}`),
        readScoped("/api/portal/v7/farm-operations/flock?limit=100"),
      ]);
      if (generation !== readGeneration.current) return;
      if (!breedResponse.ok || !flockResponse.ok) throw new Error("unavailable");
      const breedPayload = await breedResponse.json() as { items?: unknown; state?: unknown };
      const flockPayload = await flockResponse.json() as { items?: unknown };
      if (!Array.isArray(breedPayload.items) || !["available", "no-data"].includes(String(breedPayload.state)) || !Array.isArray(flockPayload.items)) throw new Error("unavailable");
      const breeds = breedPayload.items.filter((item): item is BreedRecord => Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string" && "state" in item && typeof item.state === "string" && "revision" in item && Number.isInteger(item.revision) && "data" in item && item.data && typeof item.data === "object" && "kind" in item.data && item.data.kind === "breed"));
      const authorizedFlocks = flockPayload.items.filter((item): item is FlockRecord => Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string" && "state" in item && typeof item.state === "string" && "data" in item && item.data && typeof item.data === "object" && "kind" in item.data && item.data.kind === "flock"));
      if (breeds.length !== breedPayload.items.length || authorizedFlocks.length !== flockPayload.items.length) throw new Error("unavailable");
      if (generation !== readGeneration.current) return;
      setItems(breeds);
      setFlocks(authorizedFlocks);
      setState(breeds.length ? "available" : "no-data");
    } catch {
      if (generation !== readGeneration.current) return;
      setItems([]); setFlocks([]); setState("unavailable");
    }
  }, [activeQuery]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { readGeneration.current += 1; authorityEpoch.current += 1; }, []);

  const linkedFlocks = useMemo(() => {
    const result = new Map<string, FlockRecord[]>();
    for (const breed of items) {
      const aliases = [breed.data.breedCode, breed.data.name].map((value) => value.trim().toLocaleLowerCase());
      result.set(breed.id, flocks.filter((flock) => flock.state === "active" && aliases.includes(flock.data.breed.trim().toLocaleLowerCase())));
    }
    return result;
  }, [items, flocks]);

  const reset = () => {
    setEditingId(null); setEditingRevision(null); setEditingState(null); setForm(emptyForm); setNotice("");
  };

  const startCreate = () => {
    reset();
    window.requestAnimationFrame(() => {
      document.getElementById("breed-code")?.focus({ preventScroll: true });
      document.getElementById("breed-record-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const edit = (record: BreedRecord) => {
    setEditingId(record.id);
    setEditingRevision(record.revision);
    setEditingState(record.state === "active" ? "active" : record.state === "inactive" ? "inactive" : null);
    setForm({
      breedCode: record.data.breedCode,
      name: record.data.name,
      species: record.data.species,
      productionClass: record.data.productionClass,
      source: record.data.source,
      notes: record.data.notes || "",
      evidenceIds: (record.data.evidenceIds || []).join(", "),
    });
    document.getElementById("breed-record-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked || controller.current.busy || controller.current.requiresReconciliation) return;
    if (editingId && (!editingRevision || !editingState)) return;
    const epoch = authorityEpoch.current;
    setBusy("save"); setNotice(""); setFeedback(null);
    const data: BreedData = {
      kind: "breed",
      breedCode: form.breedCode.trim(),
      name: form.name.trim(),
      species: form.species as BreedData["species"],
      productionClass: form.productionClass as BreedData["productionClass"],
      source: form.source.trim(),
      notes: form.notes.trim() || undefined,
      evidenceIds: parseEvidence(form.evidenceIds),
    };
    try {
      const marker = await recovery.begin();
      if (!marker || epoch !== authorityEpoch.current) return;
      const result = await controller.current.run({
        operation: editingId ? "update" : "create",
        expectedCode: data.breedCode, expectedData: data,
        expectedId: editingId || undefined, expectedRevision: editingRevision || undefined,
        expectedState: editingState || undefined,
        send: () => recovery.send(marker, `/api/portal/v7/farm-operations/breed${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, {
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

  const transition = async (record: BreedRecord, to: "active" | "inactive") => {
    if (busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked || controller.current.busy || controller.current.requiresReconciliation) return;
    if (record.state !== "active" && record.state !== "inactive") return;
    const epoch = authorityEpoch.current;
    setBusy(record.id + to); setNotice(""); setFeedback(null);
    try {
      const marker = await recovery.begin();
      if (!marker || epoch !== authorityEpoch.current) return;
      const result = await controller.current.run({
        operation: to === "active" ? "activate" : "deactivate",
        expectedCode: record.data.breedCode, expectedId: record.id,
        expectedRevision: record.revision, expectedState: record.state,
        expectedData: { ...record.data, notes: record.data.notes, evidenceIds: record.data.evidenceIds },
        send: () => recovery.send(marker, `/api/portal/v7/farm-operations/breed/${encodeURIComponent(record.id)}`, {
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
      controller.current = createBreedActionController();
      setReconciliationRequired(false);
      if (proof.state === "cancelled") {
        setFeedback(null);
        setNotice("Cancellation Confirmed. The Earlier Operation Cannot Commit With This Identifier. Review Your Entry Before Trying Again.");
      } else {
        setFeedback({state:"saved",tone:"success",title:"Breed Outcome Recovered",
          message:`The Server Confirmed The Original ${proof.action} Outcome At Revision ${proof.record.revision}. Later Revisions May Exist; Review The Register Before Further Changes.`,
          recordId:proof.record.id,revision:proof.record.revision,auditId:null,occurredAt:null,
          canOpenRecord:false,canShowAudit:false});
      }
      await load();
    } finally { if (epoch === authorityEpoch.current) setBusy(null); }
  };

  const tone = state === "available" ? "blue" : state === "no-data" ? "gray" : "amber";
  return <section id="breed-management-workspace" tabIndex={-1} className={styles.console} data-farm-register>
    <Panel title="Breed Management · Authorized Identity & Flock Context" description="Maintain a scoped breed register and show only linked active flock records already verified by the farm operations service.">
      {feedback && state !== "hidden" && state !== "sign-in" && <Stage25ActionFeedback feedback={feedback} />}
      {(!recovery.ready || recovery.blocked || reconciliationRequired) && state !== "hidden" && state !== "sign-in" && <div role="alert">
        <strong>Outcome Reconciliation Required</strong>
        <p>{!recovery.ready ? "Write recovery protection is unavailable. Contact an authorized manager before continuing." :
          recovery.legacy ? "An earlier Breed operation may have reached the server. Its older marker cannot establish the account or outcome safely. An authorized manager must investigate the record and audit evidence; this screen cannot safely cancel that older write." :
          "An earlier Breed operation may have reached the server, or its recovery protection is unavailable. A list refresh is not proof of failure. Check the outcome or cancel the pending operation before a new attempt."}</p>
        <p>Entries Remain On This Page. Form Values Are Not Stored And Do Not Survive Reload.</p>
        {canEdit && recovery.recoverable && !recovery.legacy && <div className="row wrap">
          <Btn type="button" disabled={busy !== null} onClick={() => void reconcile("check")}>Check Outcome</Btn>
          <Btn type="button" disabled={busy !== null} onClick={() => void reconcile("cancel")}>Cancel Pending Operation</Btn>
        </div>}
      </div>}
      <div className="row between wrap" aria-live="polite"><Chip tone={tone}>{state === "loading" ? "Loading authorized breeds…" : state === "available" ? "Verified breed records available" : state === "no-data" ? "No verified breed records" : state === "hidden" ? "Unavailable in this scope" : state === "sign-in" ? "Sign in required" : "Service unavailable"}</Chip><span className="metadata">API v7 · scoped breed authority</span></div>
      <form className="filters mt" role="search" onSubmit={(event) => { event.preventDefault(); setActiveQuery(query); }}><label className="row grow"><Search size={18}/><input className="filter-input" aria-label="Search breed records" placeholder="Search code, name, species, class or source" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)}/></label><Btn small type="submit" disabled={state === "loading"}>Search</Btn></form>
      {state === "hidden" && <p className="mt" role="status">This registry is unavailable in your authorized scope. No breed details or linked flock counts are disclosed.</p>}
      {state === "sign-in" && <p className="mt" role="status">Sign in to load the authorized breed registry.</p>}
      {state === "unavailable" && <p className="mt" role="alert">The breed registry or linked flock source could not be reached. Sample breeds and performance claims are not shown.</p>}

      {canEdit && state !== "hidden" && state !== "sign-in" && <>
        <div className="row between wrap mt"><div><h3>{editingId ? "Edit Breed" : "Add Breed"}</h3><p>{editingId ? "Update descriptive breed evidence without changing the immutable breed code." : "Create one real breed identity in the authorized farm scope."}</p></div><Btn data-primary-action="breed-create" onClick={startCreate} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked}><Plus size={16}/> New Breed</Btn></div>
        <form id="breed-record-form" tabIndex={-1} className={`${styles.form} mt`} onSubmit={save}>
          <div className={styles.fields} inert={busy !== null} aria-busy={busy === "save"}>
            <p className={styles.fullWidth}>Fields Are Required Unless Marked Optional.</p>
            <label className="field"><span>Breed Code</span><input id="breed-code" value={form.breedCode} onChange={(event) => setForm((current) => ({ ...current, breedCode: event.target.value }))} maxLength={80} autoComplete="off" disabled={Boolean(editingId)} required/></label>
            <label className="field"><span>Breed Name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} autoComplete="off" required/></label>
            <label className="field"><span>Species</span><select value={form.species} onChange={(event) => setForm((current) => ({ ...current, species: event.target.value }))} required><option value="chicken">Chicken</option><option value="turkey">Turkey</option><option value="duck">Duck</option></select></label>
            <label className="field"><span>Production Class</span><select value={form.productionClass} onChange={(event) => setForm((current) => ({ ...current, productionClass: event.target.value }))} required><option value="layer">Layer</option><option value="broiler">Broiler</option><option value="dual-purpose">Dual-purpose</option><option value="breeding">Breeding</option><option value="other">Other</option></select></label>
            <label className={`field ${styles.fullWidth}`}><span>Source / Reference</span><input value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} maxLength={160} autoComplete="off" required/></label>
            <label className={`field ${styles.fullWidth}`}><span>Breed Notes · Optional</span><textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}/><small>Optional descriptive evidence. Do not enter unverified performance claims.</small></label>
            <label className={`field ${styles.fullWidth}`}><span>Evidence IDs · Optional</span><textarea rows={2} maxLength={3220} value={form.evidenceIds} onChange={(event) => setForm((current) => ({ ...current, evidenceIds: event.target.value }))}/><small>Optional. Separate up to 20 authorized evidence IDs with commas.</small></label>
          </div>
          <aside className={styles.actionPane} data-breed-actions><Bird size={24}/><p>Breed identity and classification are recorded evidence. Linked flock context is derived only from authorized active flock records.</p><p className="form-note">The portal does not infer productivity, suitability, health, genetic quality, or expected performance.</p><Btn primary type="submit" disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked} aria-busy={busy === "save"}><AsyncButtonLabel busy={busy === "save"} idle={editingId ? "Save Breed Changes" : "Add Breed"} busyText="Saving breed record…"/></Btn>{editingId && <Btn type="button" onClick={reset}>Cancel Edit</Btn>}</aside>
        </form>
      </>}

      <div className={styles.register}>
        <div className="row between wrap"><h3>Authorized Breed Register</h3><span className="metadata">{items.length} loaded record{items.length === 1 ? "" : "s"}</span></div>
        {state === "no-data" && <p>{activeQuery ? "No authorized breed records match this search." : "No authorized breed records have been recorded yet."}</p>}
        {state === "available" && items.map((record) => {
          const linked = linkedFlocks.get(record.id) || [];
          const openingBirds = linked.reduce((total, flock) => total + Number(flock.data.birdCount || 0), 0);
          return <article className={styles.record} key={record.id}>
            <div><div className="row wrap"><Chip tone={record.state === "active" ? "blue" : "gray"}>{record.state}</Chip><strong>{record.data.name} · {record.data.breedCode}</strong></div><p>{record.data.species} · {record.data.productionClass} · {record.data.source}</p><small>{linked.length} linked active flock{linked.length === 1 ? "" : "s"} · {openingBirds.toLocaleString()} recorded opening birds · Revision {record.revision}</small>{record.data.notes && <span>{record.data.notes}</span>}</div>
            {canEdit && <div className="row wrap"><Btn onClick={() => edit(record)} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked}><Edit3 size={16}/> Edit</Btn>{record.state === "active" ? <Btn onClick={() => void transition(record, "inactive")} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked} aria-busy={busy === record.id + "inactive"}><PauseCircle size={16}/> Mark Inactive</Btn> : <Btn onClick={() => void transition(record, "active")} disabled={busy !== null || reconciliationRequired || !recovery.ready || recovery.blocked} aria-busy={busy === record.id + "active"}><PlayCircle size={16}/> Restore Active</Btn>}</div>}
            {!canEdit && <span className="row"><ShieldCheck size={16}/> Read-only authorized view</span>}
          </article>;
        })}
      </div>
      {notice && <p className="mt" role="status">{notice}</p>}
    </Panel>
  </section>;
}
