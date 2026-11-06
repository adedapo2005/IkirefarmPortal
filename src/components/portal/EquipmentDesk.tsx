"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { HardHat, Pencil, Plus, Search, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AsyncButtonLabel, Btn, Chip, Panel } from "./Common";
import styles from "./InventoryProcurementDesk.module.css";

type EquipmentRecord = {
  id: string;
  state: "active" | "maintenance" | "retired";
  revision: number;
  data: {
    kind: "equipment";
    assetCode: string;
    name: string;
    category: "machinery" | "power" | "water" | "environmental" | "processing" | "transport" | "safety" | "other";
    serialNumber?: string;
    locationKey: string;
    condition: "serviceable" | "needs-attention" | "out-of-service";
    assignedTo?: string;
    acquiredAt?: string;
    lastServicedAt?: string;
    nextServiceDueAt?: string;
    notes?: string;
    evidenceIds?: readonly string[];
  };
};

type LoadState = "loading" | "available" | "no-data" | "hidden" | "sign-in" | "unavailable";
type FormData = Record<string, string>;

const initialForm = (): FormData => ({
  category: "machinery",
  condition: "serviceable",
});

const categoryLabels: Record<EquipmentRecord["data"]["category"], string> = {
  machinery: "Farm machinery",
  power: "Power",
  water: "Water systems",
  environmental: "Environmental control",
  processing: "Processing",
  transport: "Transport",
  safety: "Safety",
  other: "Other",
};

const conditionLabels: Record<EquipmentRecord["data"]["condition"], string> = {
  serviceable: "Serviceable",
  "needs-attention": "Needs attention",
  "out-of-service": "Out of service",
};
const equipmentStates: EquipmentRecord["state"][] = ["active", "maintenance", "retired"];
const equipmentCategories = Object.keys(categoryLabels);
const equipmentConditions = Object.keys(conditionLabels);

function isEquipmentRecord(value: unknown): value is EquipmentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !equipmentStates.includes(record.state as EquipmentRecord["state"]) ||
      typeof record.revision !== "number" || !Number.isInteger(record.revision) || record.revision < 1 ||
      !record.data || typeof record.data !== "object" || Array.isArray(record.data)) return false;
  const data = record.data as Record<string, unknown>;
  return data.kind === "equipment" &&
    typeof data.assetCode === "string" &&
    typeof data.name === "string" &&
    typeof data.category === "string" && equipmentCategories.includes(data.category) &&
    typeof data.locationKey === "string" &&
    typeof data.condition === "string" && equipmentConditions.includes(data.condition);
}

function formFromRecord(record: EquipmentRecord): FormData {
  return {
    assetCode: record.data.assetCode,
    name: record.data.name,
    category: record.data.category,
    serialNumber: record.data.serialNumber || "",
    locationKey: record.data.locationKey,
    condition: record.data.condition,
    assignedTo: record.data.assignedTo || "",
    acquiredAt: record.data.acquiredAt || "",
    lastServicedAt: record.data.lastServicedAt || "",
    nextServiceDueAt: record.data.nextServiceDueAt || "",
    notes: record.data.notes || "",
    evidenceIds: record.data.evidenceIds?.join(", ") || "",
  };
}

export default function EquipmentDesk() {
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<EquipmentRecord[]>([]);
  const [form, setForm] = useState<FormData>(initialForm);
  const [editing, setEditing] = useState<EquipmentRecord | null>(null);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const value = (name: string) => form[name] || "";
  const update = (name: string, next: string) => setForm((current) => ({ ...current, [name]: next }));

  const load = useCallback(async (preserveNotice = false) => {
    setState("loading");
    if (!preserveNotice) setNotice("");
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/equipment", {
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
          !payload.items.every(isEquipmentRecord)) throw new Error("unavailable");
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

  const focusForm = () => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#equipment-record-form input:not(:disabled)")?.focus({ preventScroll: true });
    });
  };

  const startCreate = () => {
    setEditing(null);
    setForm(initialForm());
    setNotice("");
    focusForm();
  };

  const startEdit = (record: EquipmentRecord) => {
    setEditing(record);
    setForm(formFromRecord(record));
    setNotice("");
    focusForm();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const editingRecord = editing;
    const editingId = editingRecord?.id;
    setBusy(editingId ? "update" : "create");
    setNotice("");
    const evidenceIds = value("evidenceIds").split(",").map((entry) => entry.trim()).filter(Boolean);
    const data = {
      kind: "equipment",
      assetCode: value("assetCode").trim(),
      name: value("name").trim(),
      category: value("category") || "other",
      serialNumber: value("serialNumber").trim() || undefined,
      locationKey: value("locationKey").trim(),
      condition: value("condition") || "serviceable",
      assignedTo: value("assignedTo").trim() || undefined,
      acquiredAt: value("acquiredAt") || undefined,
      lastServicedAt: value("lastServicedAt") || undefined,
      nextServiceDueAt: value("nextServiceDueAt") || undefined,
      notes: value("notes").trim() || undefined,
      evidenceIds: evidenceIds.length ? evidenceIds : undefined,
    };
    try {
      const response = await fetch(
        "/api/portal/v7/inventory-procurement/equipment" + (editingId ? "/" + encodeURIComponent(editingId) : ""),
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(editingRecord ? { data, expectedRevision: editingRecord.revision } : { data }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { details?: unknown } | null;
        const details = Array.isArray(payload?.details)
          ? payload.details.filter((item): item is string => typeof item === "string").join(" ")
          : "";
        const message = response.status === 422 ? details || "Review the equipment details and try again."
          : response.status === 409 ? "This equipment code already exists, or the record changed on the server."
            : response.status === 401 ? "Sign in again before saving this equipment."
              : response.status === 403 || response.status === 404 ? "Equipment changes are unavailable in your authorized scope."
                : "The asset service could not confirm this equipment record.";
        setNotice(message);
        toast.error(message);
        if (response.status === 409 && editingId) await load(true);
        return;
      }
      setEditing(null);
      setForm(initialForm());
      setNotice(editingId ? "Equipment details updated by the server." : "Equipment added to the authorized asset register.");
      toast.success(editingId ? "Equipment updated" : "Equipment added");
      await load(true);
    } catch {
      setNotice("The asset service is unavailable. No equipment change was confirmed.");
      toast.error("Equipment register is unavailable.");
    } finally {
      setBusy("");
    }
  };

  const transition = async (record: EquipmentRecord, to: EquipmentRecord["state"]) => {
    if (to === "retired" && !window.confirm("Retire this equipment record? This lifecycle step cannot be reversed here.")) return;
    const key = record.id + ":" + to;
    setBusy(key);
    setNotice("");
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/equipment/" + encodeURIComponent(record.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ to, expectedRevision: record.revision }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { details?: unknown } | null;
        const details = Array.isArray(payload?.details)
          ? payload.details.filter((item): item is string => typeof item === "string").join(" ")
          : "";
        const message = response.status === 409 ? "This equipment record changed on the server. The current version has been refreshed."
          : response.status === 422 ? details || "This equipment lifecycle step is not available."
            : "The server could not apply this equipment lifecycle change.";
        setNotice(message);
        toast.error(message);
        await load(true);
        return;
      }
      setNotice(to === "maintenance" ? "Equipment moved to maintenance."
        : to === "active" ? "Equipment returned to active service."
          : "Equipment retired from active service.");
      toast.success("Equipment lifecycle updated");
      await load(true);
    } catch {
      setNotice("The asset service is unavailable. No lifecycle change was confirmed.");
      await load(true);
    } finally {
      setBusy("");
    }
  };

  const status = state === "loading" ? "Loading authorized equipment…"
    : state === "available" ? "Verified equipment register available"
      : state === "no-data" ? "No verified equipment records"
        : state === "hidden" ? "Unavailable in this scope"
          : state === "sign-in" ? "Sign in required" : "Service unavailable";

  return (
    <section id="equipment-workspace" className={styles.console} aria-label="Equipment asset register">
      <Panel title="Equipment · Identity, Condition & Service Evidence" description="Maintain the authorized farm asset register and follow server-controlled equipment lifecycle changes.">
        <div className="row between wrap" aria-live="polite">
          <Chip tone={state === "available" ? "blue" : state === "no-data" ? "gray" : "amber"}>{status}</Chip>
          <span className="metadata">API v7 · scoped asset authority</span>
        </div>

        <form className="filters mt" role="search" onSubmit={(event) => { event.preventDefault(); setActiveQuery(query); }}>
          <label className="row grow"><Search size={18} /><input className="filter-input" aria-label="Search equipment" placeholder="Search asset code, name, serial, location or assignee" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <Btn small type="submit" disabled={state === "loading"}>Search</Btn>
          {activeQuery && <Btn small type="button" onClick={() => { setQuery(""); setActiveQuery(""); }}>Clear</Btn>}
        </form>

        {state === "hidden" && <p className="mt" role="status">Equipment records are unavailable in your authorized scope. No counts or details are disclosed.</p>}
        {state === "sign-in" && <p className="mt" role="status">Sign in to load the authorized equipment register.</p>}
        {state === "unavailable" && <p className="mt" role="alert">The asset service could not be reached. Sample equipment, condition, and service dates are not shown.</p>}

        {(state === "available" || state === "no-data") && <>
          <div className="row between wrap mt">
            <div><h3>{editing ? "Update Equipment Details" : "Add Equipment"}</h3><p className="form-note">{editing ? "Asset code stays fixed while evidence and operational details are updated." : "Create one real scoped asset record. The server starts it in active lifecycle state."}</p></div>
            <Btn small type="button" data-primary-action="equipment-create" onClick={startCreate}><Plus size={16} /> New Equipment</Btn>
          </div>
          <form id="equipment-record-form" className={styles.form} onSubmit={save}>
            <div className={styles.fields}>
              <label className="field"><span>Asset Code</span><input value={value("assetCode")} onChange={(event) => update("assetCode", event.target.value)} maxLength={80} disabled={Boolean(editing)} required /></label>
              <label className="field"><span>Equipment Name</span><input value={value("name")} onChange={(event) => update("name", event.target.value)} maxLength={160} required /></label>
              <label className="field"><span>Category</span><select value={value("category") || "machinery"} onChange={(event) => update("category", event.target.value)} required>{Object.entries(categoryLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
              <label className="field"><span>Serial Number</span><input value={value("serialNumber")} onChange={(event) => update("serialNumber", event.target.value)} maxLength={120} /></label>
              <label className="field"><span>Farm Location</span><input value={value("locationKey")} onChange={(event) => update("locationKey", event.target.value)} maxLength={120} required /></label>
              <label className="field"><span>Observed Condition</span><select value={value("condition") || "serviceable"} onChange={(event) => update("condition", event.target.value)} required>{Object.entries(conditionLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
              <label className="field"><span>Assigned To</span><input value={value("assignedTo")} onChange={(event) => update("assignedTo", event.target.value)} maxLength={160} /></label>
              <label className="field"><span>Acquired Date</span><input type="date" value={value("acquiredAt")} onChange={(event) => update("acquiredAt", event.target.value)} /></label>
              <label className="field"><span>Last Serviced</span><input type="date" value={value("lastServicedAt")} onChange={(event) => update("lastServicedAt", event.target.value)} /></label>
              <label className="field"><span>Next Service Due</span><input type="date" value={value("nextServiceDueAt")} onChange={(event) => update("nextServiceDueAt", event.target.value)} /></label>
              <label className={`field ${styles.fullWidth}`}><span>Condition / Service Notes</span><textarea value={value("notes")} onChange={(event) => update("notes", event.target.value)} rows={3} maxLength={1000} /></label>
              <label className={`field ${styles.fullWidth}`}><span>Evidence IDs</span><textarea value={value("evidenceIds")} onChange={(event) => update("evidenceIds", event.target.value)} rows={3} maxLength={2400} /><small>Optional. Separate up to 20 authorized evidence IDs with commas.</small></label>
            </div>
            <aside className={styles.actionPane}>
              <ShieldCheck size={27} aria-hidden="true" />
              <p className="form-note">Condition, assignment, and service dates are recorded evidence. The portal does not infer safety, readiness, ownership, or maintenance completion.</p>
              <Btn primary type="submit" disabled={busy !== ""} aria-busy={busy === "create" || busy === "update"}>
                {busy !== "create" && busy !== "update" && (editing ? <Pencil size={16} /> : <Plus size={16} />)}
                <AsyncButtonLabel busy={busy === "create" || busy === "update"} idle={editing ? "Update Equipment" : "Add Equipment"} busyText={editing ? "Updating equipment…" : "Adding equipment…"} />
              </Btn>
              {editing && <Btn type="button" onClick={startCreate} disabled={busy !== ""}>Cancel Edit</Btn>}
            </aside>
          </form>
        </>}

        {notice && <p className="mt" role="status">{notice}</p>}
        {(state === "available" || state === "no-data") && <div className={styles.register}>
          <div className="row between wrap"><h3>Authorized Equipment Register</h3><span className="metadata">{visible.length} loaded record{visible.length === 1 ? "" : "s"}</span></div>
          {!visible.length && <p>{activeQuery ? "No loaded authorized equipment matches this search." : "No authorized equipment has been recorded yet."}</p>}
          {visible.map((record) => {
            const maintenanceKey = record.id + ":maintenance";
            const activeKey = record.id + ":active";
            const retiredKey = record.id + ":retired";
            const canReturn = record.data.condition === "serviceable";
            return <article className={styles.record} key={record.id}>
              <HardHat size={21} aria-hidden="true" />
              <div className="grow">
                <strong>{record.data.assetCode} · {record.data.name}</strong>
                <p>{categoryLabels[record.data.category]} · {record.data.locationKey} · {conditionLabels[record.data.condition]}</p>
                <small>{record.state} · Revision {record.revision}{record.data.assignedTo ? ` · assigned to ${record.data.assignedTo}` : ""}{record.data.nextServiceDueAt ? ` · service due ${record.data.nextServiceDueAt}` : ""}</small>
                {record.state === "maintenance" && !canReturn && <span>Update the condition to Serviceable before returning this asset to active service.</span>}
              </div>
              <div className="row wrap">
                {record.state !== "retired" && <Btn small type="button" disabled={busy !== ""} onClick={() => startEdit(record)}><Pencil size={15} /> Edit</Btn>}
                {record.state === "active" && <Btn small type="button" disabled={busy !== ""} aria-busy={busy === maintenanceKey} onClick={() => void transition(record, "maintenance")}><Wrench size={15} /><AsyncButtonLabel busy={busy === maintenanceKey} idle="Start Maintenance" busyText="Updating…" /></Btn>}
                {record.state === "maintenance" && <Btn small type="button" disabled={busy !== "" || !canReturn} aria-disabled={!canReturn} aria-busy={busy === activeKey} onClick={() => void transition(record, "active")}><AsyncButtonLabel busy={busy === activeKey} idle="Return To Service" busyText="Updating…" /></Btn>}
                {record.state !== "retired" && <Btn small type="button" disabled={busy !== ""} aria-busy={busy === retiredKey} onClick={() => void transition(record, "retired")}><AsyncButtonLabel busy={busy === retiredKey} idle="Retire" busyText="Retiring…" /></Btn>}
              </div>
            </article>;
          })}
        </div>}
      </Panel>
    </section>
  );
}
