"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PackageCheck, Plus, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AsyncButtonLabel, Btn, Chip, Panel } from "./Common";
import styles from "./InventoryProcurementDesk.module.css";

type MedicationStockRecord = {
  id: string;
  state: string;
  revision: number;
  data: {
    kind: "medication-stock-movement";
    medicationCode: string;
    batchNumber: string;
    locationKey: string;
    movementType: "receipt" | "issue" | "adjustment" | "wastage";
    quantity: number;
    unit: "dose" | "ml" | "l" | "g" | "tablet";
    occurredAt: string;
    expiryDate?: string;
    sourceReference?: string;
    notes?: string;
    evidenceIds?: readonly string[];
  };
};
type LoadState = "loading" | "available" | "no-data" | "hidden" | "sign-in" | "unavailable";

function isMedicationStockRecord(value: unknown): value is MedicationStockRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.state !== "string" ||
      typeof record.revision !== "number" || !Number.isInteger(record.revision) ||
      !record.data || typeof record.data !== "object" || Array.isArray(record.data)) return false;
  const data = record.data as Record<string, unknown>;
  return data.kind === "medication-stock-movement" &&
    typeof data.medicationCode === "string" &&
    typeof data.batchNumber === "string" &&
    typeof data.locationKey === "string" &&
    typeof data.movementType === "string" &&
    typeof data.quantity === "number" &&
    typeof data.unit === "string" &&
    typeof data.occurredAt === "string";
}

export default function MedicationStockDesk() {
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<MedicationStockRecord[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const value = (name: string) => form[name] || "";
  const update = (name: string, next: string) => setForm((current) => ({ ...current, [name]: next }));
  const movementType = value("movementType") || "receipt";
  const notesRequired = movementType === "adjustment" || movementType === "wastage";

  const load = useCallback(async (preserveNotice = false) => {
    setState("loading");
    if (!preserveNotice) setNotice("");
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/medication-stock-movement", {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        setItems([]);
        setState("sign-in");
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setItems([]);
        setState("hidden");
        return;
      }
      if (!response.ok) throw new Error("unavailable");
      const payload = await response.json() as { items?: unknown; state?: unknown };
      if (!Array.isArray(payload.items) ||
          !["available", "no-data"].includes(String(payload.state)) ||
          !payload.items.every(isMedicationStockRecord)) throw new Error("unavailable");
      setItems(payload.items);
      setState(payload.items.length ? "available" : "no-data");
    } catch {
      setItems([]);
      setState("unavailable");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = activeQuery.trim().toLocaleLowerCase();
    return items.filter((item) => !needle || JSON.stringify(item).toLocaleLowerCase().includes(needle));
  }, [activeQuery, items]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("create");
    setNotice("");
    const evidenceIds = value("evidenceIds").split(",").map((entry) => entry.trim()).filter(Boolean);
    const data = {
      kind: "medication-stock-movement",
      medicationCode: value("medicationCode").trim(),
      batchNumber: value("batchNumber").trim(),
      locationKey: value("locationKey").trim(),
      movementType,
      quantity: Number(value("quantity")),
      unit: value("unit") || "dose",
      occurredAt: value("occurredAt"),
      expiryDate: value("expiryDate") || undefined,
      sourceReference: value("sourceReference").trim() || undefined,
      notes: value("notes").trim() || undefined,
      evidenceIds: evidenceIds.length ? evidenceIds : undefined,
    };
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/medication-stock-movement", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { details?: unknown } | null;
        const details = Array.isArray(payload?.details)
          ? payload.details.filter((item): item is string => typeof item === "string").join(" ")
          : "";
        const message = response.status === 422 ? details || "Review the medication stock evidence and try again."
          : response.status === 409 ? "A conflicting authorized medication stock movement already exists."
            : response.status === 401 ? "Sign in again before saving this movement."
              : response.status === 403 || response.status === 404 ? "Medication stock creation is unavailable in your authorized scope."
                : "The inventory service could not confirm this medication stock movement.";
        setNotice(message);
        toast.error(message);
        return;
      }
      setForm({});
      setNotice("Medication stock movement saved as a draft by the server.");
      toast.success("Medication stock movement saved");
      await load(true);
    } catch {
      setNotice("The inventory service is unavailable. No change was confirmed.");
      toast.error("Medication stock movement is unavailable.");
    } finally {
      setBusy("");
    }
  };

  const transition = async (record: MedicationStockRecord, to: "posted" | "voided") => {
    const key = record.id + ":" + to;
    setBusy(key);
    setNotice("");
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/medication-stock-movement/" + encodeURIComponent(record.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ to, expectedRevision: record.revision }),
      });
      if (!response.ok) {
        const message = response.status === 409 ? "This movement changed on the server. The current version has been refreshed."
          : "The server could not apply this medication stock transition.";
        setNotice(message);
        toast.error(message);
        await load(true);
        return;
      }
      setNotice(to === "posted" ? "Medication stock movement posted by the server." : "Medication stock movement voided by the server.");
      toast.success(to === "posted" ? "Movement posted" : "Movement voided");
      await load(true);
    } catch {
      setNotice("The inventory service is unavailable. No workflow change was confirmed.");
      await load(true);
    } finally {
      setBusy("");
    }
  };

  const status = state === "loading" ? "Loading authorized medication movements…"
    : state === "available" ? "Verified medication movements available"
      : state === "no-data" ? "No verified medication movements"
        : state === "hidden" ? "Unavailable in this scope"
          : state === "sign-in" ? "Sign in required" : "Service unavailable";

  return (
    <section className={styles.console} aria-label="Medication stock movement register">
      <Panel title="Medication Stock · Batch Movement Evidence" description="Record batch-level medication receipts, issues, adjustments, and wastage through the authenticated inventory service.">
        <div className="row between wrap" aria-live="polite">
          <Chip tone={state === "available" ? "blue" : state === "no-data" ? "gray" : "amber"}>{status}</Chip>
          <span className="metadata">API v7 · batch and expiry evidence</span>
        </div>

        <form className="filters mt" role="search" onSubmit={(event) => { event.preventDefault(); setActiveQuery(query); }}>
          <label className="row grow"><Search size={18} /><input className="filter-input" aria-label="Search medication stock movements" placeholder="Search medication, batch, location or reference" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <Btn small type="submit" disabled={state === "loading"}>Search</Btn>
          {activeQuery && <Btn small type="button" onClick={() => { setQuery(""); setActiveQuery(""); }}>Clear</Btn>}
        </form>

        {state === "hidden" && <p className="mt" role="status">Medication stock records are unavailable in your authorized scope. No counts or details are disclosed.</p>}
        {state === "sign-in" && <p className="mt" role="status">Sign in to load authorized medication stock records.</p>}
        {state === "unavailable" && <p className="mt" role="alert">The inventory service could not be reached. Sample stock, expiry, and reorder values are not shown.</p>}

        {(state === "available" || state === "no-data") && <form id="medication-stock-movement-form" className={`${styles.form} mt`} onSubmit={create}>
          <div className={styles.fields}>
            <label className="field"><span>Medication Code</span><input value={value("medicationCode")} onChange={(event) => update("medicationCode", event.target.value)} maxLength={80} required /></label>
            <label className="field"><span>Batch Number</span><input value={value("batchNumber")} onChange={(event) => update("batchNumber", event.target.value)} maxLength={120} required /></label>
            <label className="field"><span>Store / Location</span><input value={value("locationKey")} onChange={(event) => update("locationKey", event.target.value)} maxLength={120} required /></label>
            <label className="field"><span>Movement Type</span><select value={movementType} onChange={(event) => update("movementType", event.target.value)} required><option value="receipt">Receipt</option><option value="issue">Issue</option><option value="adjustment">Adjustment</option><option value="wastage">Wastage</option></select></label>
            <label className="field"><span>Quantity</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={value("quantity")} onChange={(event) => update("quantity", event.target.value)} required /></label>
            <label className="field"><span>Unit</span><select value={value("unit") || "dose"} onChange={(event) => update("unit", event.target.value)} required><option value="dose">Doses</option><option value="ml">Millilitres</option><option value="l">Litres</option><option value="g">Grams</option><option value="tablet">Tablets</option></select></label>
            <label className="field"><span>Occurred At</span><input type="datetime-local" value={value("occurredAt")} onChange={(event) => update("occurredAt", event.target.value)} required /></label>
            <label className="field"><span>Expiry Date{movementType === "receipt" ? " · Required" : ""}</span><input type="date" value={value("expiryDate")} onChange={(event) => update("expiryDate", event.target.value)} required={movementType === "receipt"} /></label>
            <label className="field"><span>Source / Reference</span><input value={value("sourceReference")} onChange={(event) => update("sourceReference", event.target.value)} maxLength={160} /></label>
            <label className={`field ${styles.fullWidth}`}><span>Notes{notesRequired ? " · Required" : ""}</span><textarea value={value("notes")} onChange={(event) => update("notes", event.target.value)} rows={3} maxLength={1000} required={notesRequired} /><small>Notes are required for adjustments and wastage.</small></label>
            <label className={`field ${styles.fullWidth}`}><span>Evidence IDs</span><textarea value={value("evidenceIds")} onChange={(event) => update("evidenceIds", event.target.value)} rows={3} maxLength={2400} /><small>Optional. Separate up to 20 authorized evidence IDs with commas.</small></label>
          </div>
          <aside className={styles.actionPane}>
            <ShieldAlert size={26} aria-hidden="true" />
            <p className="form-note">This contract records batch movements and expiry evidence. It does not infer current balance, reorder quantity, storage compliance, or clinical suitability.</p>
            <Btn primary type="submit" disabled={busy !== ""} aria-busy={busy === "create"}>
              {busy !== "create" && <Plus size={16} />}
              <AsyncButtonLabel busy={busy === "create"} idle="Save Medication Movement" busyText="Saving medication movement…" />
            </Btn>
          </aside>
        </form>}

        {notice && <p className="mt" role="status">{notice}</p>}
        {(state === "available" || state === "no-data") && <div className={styles.register}>
          <div className="row between wrap"><h3>Verified Medication Movement Register</h3><span className="metadata">{visible.length} loaded record{visible.length === 1 ? "" : "s"}</span></div>
          {!visible.length && <p>{activeQuery ? "No loaded authorized movements match this search." : "No authorized medication stock movements have been recorded yet."}</p>}
          {visible.map((record) => {
            const postKey = record.id + ":posted";
            const voidKey = record.id + ":voided";
            return <article className={styles.record} key={record.id}>
              <PackageCheck size={20} aria-hidden="true" />
              <div className="grow"><strong>{record.data.medicationCode} · {record.data.batchNumber}</strong><p>{record.data.movementType} · {record.data.quantity} {record.data.unit} · {record.data.locationKey}</p><small>{record.state} · Revision {record.revision}{record.data.expiryDate ? ` · expires ${record.data.expiryDate}` : ""}</small></div>
              <div className="row wrap">
                {record.state === "draft" && <Btn small disabled={busy !== ""} aria-busy={busy === postKey} onClick={() => void transition(record, "posted")}><AsyncButtonLabel busy={busy === postKey} idle="Post Movement" busyText="Posting…" /></Btn>}
                {record.state === "posted" && <Btn small disabled={busy !== ""} aria-busy={busy === voidKey} onClick={() => void transition(record, "voided")}><AsyncButtonLabel busy={busy === voidKey} idle="Void Movement" busyText="Voiding…" /></Btn>}
              </div>
            </article>;
          })}
        </div>}
      </Panel>
    </section>
  );
}
