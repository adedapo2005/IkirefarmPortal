"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ClipboardList, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AsyncButtonLabel, Btn, Chip, Panel } from "./Common";
import { has, isOwnerPrincipal, type Persona } from "@/lib/portal-model";
import styles from "./InventoryProcurementDesk.module.css";
import LoggedTimestamp from "./LoggedTimestamp";

type StockMovement = {
  id: string;
  state: string;
  revision: number;
  data: {
    kind: "stock-movement";
    itemCode: string;
    locationKey: string;
    movementType: "receipt" | "issue" | "adjustment" | "transfer";
    quantity: number;
    unit: "unit" | "kg" | "bag" | "ton" | "litre";
    occurredAt: string;
    sourceReference?: string;
    evidenceIds?: readonly string[];
  };
};

type LoadState = "loading" | "available" | "no-data" | "hidden" | "sign-in" | "unavailable";

function isMovement(value: unknown): value is StockMovement {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.state !== "string" ||
      typeof record.revision !== "number" || !Number.isInteger(record.revision) || record.revision < 1 ||
      !record.data || typeof record.data !== "object" || Array.isArray(record.data)) return false;
  const data = record.data as Record<string, unknown>;
  return data.kind === "stock-movement" &&
    typeof data.itemCode === "string" &&
    typeof data.locationKey === "string" &&
    typeof data.movementType === "string" &&
    typeof data.quantity === "number" &&
    typeof data.unit === "string" &&
    typeof data.occurredAt === "string";
}

export default function InventoryProcurementDesk({person,onMovementChanged}:{person:Persona;onMovementChanged?:()=>void}) {
  const canWrite=person.restriction!=="disabled" && (has(person,"inventory.edit") || isOwnerPrincipal(person));
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<StockMovement[]>([]);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const value = (name: string) => form[name] || "";
  const update = (name: string, next: string) => setForm((current) => ({ ...current, [name]: next }));

  const load = useCallback(async () => {
    setState("loading");
    setNotice("");
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/stock-movement", {
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
          !payload.items.every(isMovement)) throw new Error("unavailable");
      setItems(payload.items);
      setState(payload.items.length ? "available" : "no-data");
    } catch {
      setItems([]);
      setState("unavailable");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => {
    const needle = activeQuery.trim().toLocaleLowerCase();
    if (!needle) return items;
    return items.filter((record) => JSON.stringify(record).toLocaleLowerCase().includes(needle));
  }, [items, activeQuery]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if(!canWrite || busy!==null) return;
    setBusy("create");
    setNotice("");
    const evidenceIds = value("evidenceIds").split(",").map((part) => part.trim()).filter(Boolean);
    const data = {
      kind: "stock-movement",
      itemCode: value("itemCode").trim(),
      locationKey: value("locationKey").trim(),
      movementType: value("movementType") || "receipt",
      quantity: Number(value("quantity")),
      unit: value("unit") || "unit",
      occurredAt: value("occurredAt"),
      sourceReference: value("sourceReference").trim() || undefined,
      evidenceIds: evidenceIds.length ? evidenceIds : undefined,
    };
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/stock-movement", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) {
        let payload: { details?: unknown } | null = null;
        try { payload = await response.json() as { details?: unknown }; } catch {}
        const details = Array.isArray(payload?.details)
          ? payload.details.filter((item): item is string => typeof item === "string").join(" ")
          : "";
        const message = response.status === 422
          ? details || "Review the required stock movement evidence and try again."
          : response.status === 409
            ? "A conflicting authorized stock movement already exists."
            : response.status === 401
              ? "Sign in again before saving this movement."
              : response.status === 403 || response.status === 404
                ? "Stock movement creation is unavailable in your authorized scope."
                : "Authorized inventory record creation is unavailable.";
        setNotice(message);
        toast.error(message);
        return;
      }
      setForm({});
      toast.success("Stock movement saved");
      await load();
      onMovementChanged?.();
    } catch {
      const message = "Authorized inventory record creation is unavailable.";
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const postMovement = async (record: StockMovement) => {
    if(!canWrite || busy!==null)return;
    setBusy(record.id);
    try {
      const response = await fetch("/api/portal/v7/inventory-procurement/stock-movement/" + record.id, {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ to: "posted", expectedRevision: record.revision }),
      });
      if (!response.ok) {
        toast.error(response.status === 409
          ? "This movement changed on the server. The current authorized version has been refreshed."
          : "Authorized stock posting is unavailable.");
        await load();
        return;
      }
      toast.success("Stock movement posted");
      await load();
      onMovementChanged?.();
    } catch {
      toast.error("Authorized stock posting is unavailable.");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const tone = state === "available" ? "blue" : state === "no-data" ? "gray" : "amber";
  const status = state === "loading" ? "Loading authorized movements…"
    : state === "available" ? "Verified movements available"
      : state === "no-data" ? "No verified movements"
        : state === "hidden" ? "Unavailable in this scope"
          : state === "sign-in" ? "Sign in required"
            : "Service unavailable";

  return (
    <section className={styles.console} aria-label="Inventory stock movement register">
      <Panel title="Inventory · Authorized Stock Movements" description="Record and review scoped inventory movements from the live server ledger.">
        <div className="row between wrap" aria-live="polite">
          <Chip tone={tone}>{status}</Chip>
          <span className="metadata">API v7 · movement evidence only · no invented balance</span>
        </div>

        <form className="filters mt" role="search" onSubmit={(event) => { event.preventDefault(); setActiveQuery(query); }}>
          <label className="row grow"><Search size={18} /><input className="filter-input" aria-label="Search stock movements" placeholder="Search loaded authorized movements" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <Btn small type="submit" disabled={state === "loading"}>Search</Btn>
        </form>

        {state === "hidden" && <p className="mt" role="status">This collection is unavailable in your authorized scope. No stock details or counts are shown.</p>}
        {state === "sign-in" && <p className="mt" role="status">Sign in to load authorized inventory records.</p>}
        {state === "unavailable" && <p className="mt" role="alert">The Inventory service could not be reached. Sample balances are not shown as a fallback.</p>}

        {canWrite?<form id="inventory-stock-movement-form" className={`${styles.form} mt`} onSubmit={create}>
          <div className={styles.fields}>
            <label className="field"><span>Item Code</span><input value={value("itemCode")} onChange={(event) => update("itemCode", event.target.value)} maxLength={80} autoComplete="off" required /></label>
            <label className="field"><span>Store / Location</span><input value={value("locationKey")} onChange={(event) => update("locationKey", event.target.value)} maxLength={120} autoComplete="off" required /></label>
            <label className="field"><span>Movement Type</span><select value={value("movementType") || "receipt"} onChange={(event) => update("movementType", event.target.value)} required><option value="receipt">Receipt</option><option value="issue">Issue</option><option value="adjustment">Stock Adjustment</option></select></label>
            <label className="field"><span>Quantity</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={value("quantity")} onChange={(event) => update("quantity", event.target.value)} required /></label>
            <label className="field"><span>Unit</span><select value={value("unit") || "unit"} onChange={(event) => update("unit", event.target.value)} required><option value="unit">Units</option><option value="kg">Kilograms</option><option value="bag">Bags</option><option value="ton">Tonnes</option><option value="litre">Litres</option></select></label>
            <label className="field"><span>Occurred At</span><input type="datetime-local" value={value("occurredAt")} onChange={(event) => update("occurredAt", event.target.value)} required /></label>
            <label className="field"><span>Source / Reference</span><input value={value("sourceReference")} onChange={(event) => update("sourceReference", event.target.value)} maxLength={160} autoComplete="off" /></label>
            <label className={`field ${styles.fullWidth}`}><span>Evidence IDs</span><textarea value={value("evidenceIds")} onChange={(event) => update("evidenceIds", event.target.value)} rows={3} maxLength={2400} /><small>Optional. Separate up to 20 authorized evidence IDs with commas.</small></label>
          </div>
          <aside className={styles.actionPane}>
            <ClipboardList size={26} aria-hidden="true" />
            <p className="form-note">This register stores movements and evidence. It does not infer a current balance, valuation, reorder threshold, or transfer destination.</p>
            <Btn primary type="submit" disabled={busy !== null} aria-busy={busy === "create"}>
              {busy !== "create" && <Plus size={16} />}
              <AsyncButtonLabel busy={busy === "create"} idle="Save Stock Movement" busyText="Saving stock movement…" />
            </Btn>
          </aside>
        </form>:<p className="form-note mt" role="status">You may review authorised stock movements, but your account cannot create or post inventory records.</p>}

        {notice && <p className="mt" role="status">{notice}</p>}
        {(state === "available" || state === "no-data") && (
          <div className={styles.register}>
            <div className="row between wrap">
              <h3>Verified Movement Register</h3>
              <span className="metadata">{visibleItems.length} loaded record{visibleItems.length === 1 ? "" : "s"}</span>
            </div>
            {!visibleItems.length && <p>{activeQuery ? "No loaded authorized movements match this search." : "No authorized stock movements have been recorded yet."}</p>}
            {visibleItems.map((record) => (
              <article className={styles.record} key={record.id}>
                <div>
                  <strong>{record.data.itemCode} · {record.data.movementType}</strong>
                  <p>{record.data.quantity.toLocaleString()} {record.data.unit} · {record.data.locationKey}</p>
                  <small><LoggedTimestamp value={record.data.occurredAt}/>{record.data.sourceReference ? ` · ${record.data.sourceReference}` : ""}</small>
                  <span>State: {record.state} · Revision {record.revision}</span>
                </div>
                {canWrite && record.state === "draft" && <Btn onClick={() => void postMovement(record)} disabled={busy !== null} aria-busy={busy === record.id}><AsyncButtonLabel busy={busy === record.id} idle="Post Movement" busyText="Posting movement…" /></Btn>}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}
