"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ClipboardList, PackageCheck, Plus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AsyncButtonLabel, Btn, Chip, Panel } from "./Common";
import styles from "./InventoryProcurementDesk.module.css";

type Kind = "supplier" | "purchase-request" | "purchase-order";
type SupplierData = {
  kind: "supplier";
  supplierCode: string;
  name: string;
  status: "active" | "inactive";
  contactEmail?: string;
  evidenceIds?: readonly string[];
};
type RequestData = {
  kind: "purchase-request";
  requestCode: string;
  itemCode: string;
  quantity: number;
  unit: "unit" | "kg" | "bag" | "ton" | "litre";
  requestedAt: string;
  neededBy?: string;
  supplierCode?: string;
  notes?: string;
  evidenceIds?: readonly string[];
};
type OrderData = {
  kind: "purchase-order";
  orderCode: string;
  requestId: string;
  supplierCode: string;
  itemCode: string;
  quantity: number;
  unit: RequestData["unit"];
  currency: string;
  unitPrice: number;
  orderedAt: string;
  evidenceIds?: readonly string[];
};
type ProcurementData = SupplierData | RequestData | OrderData;
type ProcurementRecord = { id: string; state: string; revision: number; data: ProcurementData };
type LoadState = "loading" | "available" | "no-data" | "hidden" | "sign-in" | "unavailable";

const labels: Record<Kind, string> = {
  supplier: "Suppliers",
  "purchase-request": "Purchase Requests",
  "purchase-order": "Purchase Orders",
};
const workflow: Record<Kind, Record<string, readonly { to: string; label: string }[]>> = {
  supplier: { active: [{ to: "inactive", label: "Deactivate" }] },
  "purchase-request": {
    requested: [{ to: "reviewed", label: "Mark Reviewed" }, { to: "cancelled", label: "Cancel" }],
    reviewed: [{ to: "approved", label: "Approve" }, { to: "rejected", label: "Reject" }, { to: "cancelled", label: "Cancel" }],
  },
  "purchase-order": {
    draft: [{ to: "ordered", label: "Authorize Order" }, { to: "cancelled", label: "Cancel" }],
    ordered: [{ to: "partially-received", label: "Record Partial Receipt" }, { to: "received", label: "Mark Received" }, { to: "cancelled", label: "Cancel" }],
    "partially-received": [{ to: "received", label: "Mark Received" }, { to: "cancelled", label: "Cancel" }],
  },
};

function isRecord(value: unknown, kind: Kind): value is ProcurementRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.state !== "string" ||
      typeof record.revision !== "number" || !Number.isInteger(record.revision) || record.revision < 1 ||
      !record.data || typeof record.data !== "object" || Array.isArray(record.data)) return false;
  const data = record.data as Record<string, unknown>;
  return data.kind === kind;
}

async function readCollection(kind: Kind): Promise<ProcurementRecord[]> {
  const response = await fetch(`/api/portal/v7/inventory-procurement/${kind}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (response.status === 401) throw new Error("sign-in");
  if (response.status === 403 || response.status === 404) throw new Error("hidden");
  if (!response.ok) throw new Error("unavailable");
  const payload = await response.json() as { items?: unknown; state?: unknown };
  if (!Array.isArray(payload.items) ||
      !["available", "no-data"].includes(String(payload.state)) ||
      !payload.items.every((item) => isRecord(item, kind))) throw new Error("unavailable");
  return payload.items;
}

export default function PurchaseOrderDesk() {
  const [active, setActive] = useState<Kind>("purchase-order");
  const [state, setState] = useState<LoadState>("loading");
  const [records, setRecords] = useState<Record<Kind, ProcurementRecord[]>>({
    supplier: [],
    "purchase-request": [],
    "purchase-order": [],
  });
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const value = (name: string) => form[name] || "";
  const update = (name: string, next: string) => setForm((current) => ({ ...current, [name]: next }));

  const load = useCallback(async (preserveNotice = false) => {
    setState("loading");
    if (!preserveNotice) setNotice("");
    try {
      const [suppliers, requests, orders] = await Promise.all([
        readCollection("supplier"),
        readCollection("purchase-request"),
        readCollection("purchase-order"),
      ]);
      setRecords({ supplier: suppliers, "purchase-request": requests, "purchase-order": orders });
      setState(suppliers.length || requests.length || orders.length ? "available" : "no-data");
    } catch (error) {
      setRecords({ supplier: [], "purchase-request": [], "purchase-order": [] });
      setState(error instanceof Error && error.message === "sign-in" ? "sign-in"
        : error instanceof Error && error.message === "hidden" ? "hidden" : "unavailable");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const suppliers = records.supplier.filter((record): record is ProcurementRecord & { data: SupplierData } => record.data.kind === "supplier");
  const activeSuppliers = suppliers.filter((record) => record.state === "active" && record.data.status === "active");
  const requests = records["purchase-request"].filter((record): record is ProcurementRecord & { data: RequestData } => record.data.kind === "purchase-request");
  const approvedRequests = requests.filter((record) => record.state === "approved");
  const visible = useMemo(() => {
    const needle = activeQuery.trim().toLocaleLowerCase();
    return records[active].filter((record) => !needle || JSON.stringify(record).toLocaleLowerCase().includes(needle));
  }, [active, activeQuery, records]);

  const chooseTab = (kind: Kind) => {
    setActive(kind);
    setForm({});
    setQuery("");
    setActiveQuery("");
    setNotice("");
  };

  const chooseRequest = (id: string) => {
    const request = approvedRequests.find((record) => record.id === id);
    setForm((current) => request ? {
      ...current,
      requestId: id,
      itemCode: request.data.itemCode,
      quantity: String(request.data.quantity),
      unit: request.data.unit,
      supplierCode: request.data.supplierCode || current.supplierCode || "",
    } : { ...current, requestId: id, itemCode: "", quantity: "", unit: "", supplierCode: "" });
  };

  const evidence = () => {
    const items = value("evidenceIds").split(",").map((part) => part.trim()).filter(Boolean);
    return items.length ? items : undefined;
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("create");
    setNotice("");
    let data: ProcurementData;
    if (active === "supplier") {
      data = {
        kind: "supplier",
        supplierCode: value("supplierCode").trim(),
        name: value("name").trim(),
        status: (value("status") || "active") as SupplierData["status"],
        contactEmail: value("contactEmail").trim() || undefined,
        evidenceIds: evidence(),
      };
    } else if (active === "purchase-request") {
      data = {
        kind: "purchase-request",
        requestCode: value("requestCode").trim(),
        itemCode: value("itemCode").trim(),
        quantity: Number(value("quantity")),
        unit: (value("unit") || "unit") as RequestData["unit"],
        requestedAt: value("requestedAt"),
        neededBy: value("neededBy") || undefined,
        supplierCode: value("supplierCode") || undefined,
        notes: value("notes").trim() || undefined,
        evidenceIds: evidence(),
      };
    } else {
      data = {
        kind: "purchase-order",
        orderCode: value("orderCode").trim(),
        requestId: value("requestId"),
        supplierCode: value("supplierCode"),
        itemCode: value("itemCode"),
        quantity: Number(value("quantity")),
        unit: value("unit") as RequestData["unit"],
        currency: value("currency").trim().toUpperCase(),
        unitPrice: Number(value("unitPrice")),
        orderedAt: value("orderedAt"),
        evidenceIds: evidence(),
      };
    }
    try {
      const response = await fetch(`/api/portal/v7/inventory-procurement/${active}`, {
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
        const message = response.status === 422 ? details || "Review the required procurement evidence and workflow state."
          : response.status === 409 ? "A conflicting authorized record already exists."
            : response.status === 401 ? "Sign in again before saving this record."
              : response.status === 403 || response.status === 404 ? "Creation is unavailable in your authorized scope."
                : "The procurement service could not confirm this record.";
        setNotice(message);
        toast.error(message);
        return;
      }
      setForm({});
      const message = active === "supplier" ? "Supplier saved" : active === "purchase-request" ? "Purchase request saved" : "Purchase order draft saved";
      setNotice(message + " by the server.");
      toast.success(message);
      await load(true);
    } catch {
      setNotice("The procurement service is unavailable. No change was confirmed.");
      toast.error("The procurement service is unavailable.");
    } finally {
      setBusy("");
    }
  };

  const transition = async (record: ProcurementRecord, to: string) => {
    setBusy(record.id + ":" + to);
    setNotice("");
    try {
      const response = await fetch(`/api/portal/v7/inventory-procurement/${active}/${encodeURIComponent(record.id)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ to, expectedRevision: record.revision }),
      });
      if (!response.ok) {
        const message = response.status === 409 ? "This record changed on the server. The current version has been refreshed."
          : response.status === 422 ? "The server rejected this transition. Approval separation and workflow order remain enforced."
            : "This workflow action is unavailable in your authorized scope.";
        setNotice(message);
        toast.error(message);
        await load(true);
        return;
      }
      setNotice("Workflow update confirmed by the server.");
      toast.success("Workflow updated");
      await load(true);
    } catch {
      setNotice("The procurement service is unavailable. No workflow change was confirmed.");
      await load(true);
    } finally {
      setBusy("");
    }
  };

  const status = state === "loading" ? "Loading authorized procurement records…"
    : state === "available" ? "Verified procurement records available"
      : state === "no-data" ? "No verified procurement records"
        : state === "hidden" ? "Unavailable in this scope"
          : state === "sign-in" ? "Sign in required" : "Service unavailable";
  const tone = state === "available" ? "blue" : state === "no-data" ? "gray" : "amber";
  const canCreateOrder = approvedRequests.length > 0 && activeSuppliers.length > 0;

  return (
    <section id="procurement-workspace" className={styles.console} aria-label="Purchase order and procurement workflow">
      <Panel title="Procurement · Authorized Orders" description="Move from supplier and approved request evidence to a server-controlled purchase order and receiving trail.">
        <div className="row between wrap" aria-live="polite">
          <Chip tone={tone}>{status}</Chip>
          <span className="metadata">API v7 · scoped records · audited revisions</span>
        </div>

        <div className="row wrap mt" aria-label="Procurement record type">
          {(["supplier", "purchase-request", "purchase-order"] as const).map((kind) => (
            <Btn key={kind} small aria-pressed={active === kind} data-primary-action={kind === "purchase-order" ? "purchase-order-create" : undefined} onClick={() => chooseTab(kind)}>
              {labels[kind]}
            </Btn>
          ))}
        </div>

        <form className="filters mt" role="search" onSubmit={(event) => { event.preventDefault(); setActiveQuery(query); }}>
          <label className="row grow"><Search size={18} /><input className="filter-input" aria-label={`Search ${labels[active]}`} placeholder="Search loaded authorized records" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <Btn small type="submit" disabled={state === "loading"}>Search</Btn>
          {activeQuery && <Btn small type="button" onClick={() => { setQuery(""); setActiveQuery(""); }}>Clear</Btn>}
        </form>

        {state === "hidden" && <p className="mt" role="status">Procurement records are unavailable in your authorized scope. No counts or details are disclosed.</p>}
        {state === "sign-in" && <p className="mt" role="status">Sign in to load authorized procurement records.</p>}
        {state === "unavailable" && <p className="mt" role="alert">The procurement service could not be reached. Sample suppliers, requests, orders, and totals are not shown.</p>}

        {(state === "available" || state === "no-data") && (
          <form id={active === "purchase-order" ? "purchase-order-form" : `procurement-${active}-form`} className={`${styles.form} mt`} onSubmit={create}>
            <div className={styles.fields}>
              {active === "supplier" && <>
                <label className="field"><span>Supplier Code</span><input value={value("supplierCode")} onChange={(event) => update("supplierCode", event.target.value)} maxLength={80} required /></label>
                <label className="field"><span>Supplier Name</span><input value={value("name")} onChange={(event) => update("name", event.target.value)} maxLength={160} required /></label>
                <label className="field"><span>Status</span><select value={value("status") || "active"} onChange={(event) => update("status", event.target.value)} required><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="field"><span>Contact Email</span><input type="email" value={value("contactEmail")} onChange={(event) => update("contactEmail", event.target.value)} maxLength={254} /></label>
              </>}
              {active === "purchase-request" && <>
                <label className="field"><span>Request Code</span><input value={value("requestCode")} onChange={(event) => update("requestCode", event.target.value)} maxLength={80} required /></label>
                <label className="field"><span>Item Code</span><input value={value("itemCode")} onChange={(event) => update("itemCode", event.target.value)} maxLength={80} required /></label>
                <label className="field"><span>Quantity</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={value("quantity")} onChange={(event) => update("quantity", event.target.value)} required /></label>
                <label className="field"><span>Unit</span><select value={value("unit") || "unit"} onChange={(event) => update("unit", event.target.value)} required><option value="unit">Units</option><option value="kg">Kilograms</option><option value="bag">Bags</option><option value="ton">Tonnes</option><option value="litre">Litres</option></select></label>
                <label className="field"><span>Requested At</span><input type="datetime-local" value={value("requestedAt")} onChange={(event) => update("requestedAt", event.target.value)} required /></label>
                <label className="field"><span>Needed By</span><input type="date" value={value("neededBy")} onChange={(event) => update("neededBy", event.target.value)} /></label>
                <label className="field"><span>Preferred Supplier</span><select value={value("supplierCode")} onChange={(event) => update("supplierCode", event.target.value)}><option value="">Not assigned</option>{activeSuppliers.map((record) => <option key={record.id} value={record.data.supplierCode}>{record.data.supplierCode} · {record.data.name}</option>)}</select></label>
                <label className={`field ${styles.fullWidth}`}><span>Request Notes</span><textarea value={value("notes")} onChange={(event) => update("notes", event.target.value)} rows={3} maxLength={1000} /></label>
              </>}
              {active === "purchase-order" && <>
                <label className="field"><span>Order Code</span><input value={value("orderCode")} onChange={(event) => update("orderCode", event.target.value)} maxLength={80} required /></label>
                <label className="field"><span>Approved Purchase Request</span><select value={value("requestId")} onChange={(event) => chooseRequest(event.target.value)} required><option value="">Select approved request…</option>{approvedRequests.map((record) => <option key={record.id} value={record.id}>{record.data.requestCode} · {record.data.itemCode} · {record.data.quantity} {record.data.unit}</option>)}</select></label>
                <label className="field"><span>Active Supplier</span><select value={value("supplierCode")} onChange={(event) => update("supplierCode", event.target.value)} required><option value="">Select active supplier…</option>{activeSuppliers.map((record) => <option key={record.id} value={record.data.supplierCode}>{record.data.supplierCode} · {record.data.name}</option>)}</select></label>
                <label className="field"><span>Item Code</span><input value={value("itemCode")} readOnly aria-readonly="true" required /></label>
                <label className="field"><span>Authorized Quantity</span><input type="number" value={value("quantity")} readOnly aria-readonly="true" required /></label>
                <label className="field"><span>Unit</span><input value={value("unit")} readOnly aria-readonly="true" required /></label>
                <label className="field"><span>Currency</span><input value={value("currency")} onChange={(event) => update("currency", event.target.value.toUpperCase())} minLength={3} maxLength={3} placeholder="NGN" required /></label>
                <label className="field"><span>Unit Price</span><input type="number" min="0" step="0.01" inputMode="decimal" value={value("unitPrice")} onChange={(event) => update("unitPrice", event.target.value)} required /></label>
                <label className="field"><span>Ordered At</span><input type="datetime-local" value={value("orderedAt")} onChange={(event) => update("orderedAt", event.target.value)} required /></label>
              </>}
              <label className={`field ${styles.fullWidth}`}><span>Evidence IDs</span><textarea value={value("evidenceIds")} onChange={(event) => update("evidenceIds", event.target.value)} rows={3} maxLength={2400} /><small>Optional. Separate up to 20 authorized evidence IDs with commas.</small></label>
            </div>
            <aside className={styles.actionPane}>
              {active === "supplier" ? <ShieldCheck size={26} aria-hidden="true" /> : active === "purchase-request" ? <ClipboardList size={26} aria-hidden="true" /> : <PackageCheck size={26} aria-hidden="true" />}
              <p className="form-note">{active === "supplier"
                ? "Supplier identity is stored separately from requests and orders."
                : active === "purchase-request"
                  ? "A request must be reviewed and independently approved before it can back an order."
                  : canCreateOrder
                    ? "Item and quantity come from the selected approved request. Ordering and receipt remain separate audited actions."
                    : "Create an active supplier and approve a purchase request before recording an order."}</p>
              <Btn primary type="submit" disabled={busy !== "" || (active === "purchase-order" && !canCreateOrder)} aria-busy={busy === "create"}>
                {busy !== "create" && <Plus size={16} />}
                <AsyncButtonLabel busy={busy === "create"} idle={active === "supplier" ? "Save Supplier" : active === "purchase-request" ? "Save Purchase Request" : "Save Purchase Order Draft"} busyText="Saving authorized record…" />
              </Btn>
            </aside>
          </form>
        )}

        {notice && <p className="mt" role="status">{notice}</p>}
        {(state === "available" || state === "no-data") && (
          <div className={styles.register}>
            <div className="row between wrap"><h3>{labels[active]} Register</h3><span className="metadata">{visible.length} loaded record{visible.length === 1 ? "" : "s"}</span></div>
            {!visible.length && <p>{activeQuery ? "No loaded authorized records match this search." : `No authorized ${labels[active].toLocaleLowerCase()} have been recorded yet.`}</p>}
            {visible.map((record) => {
              const data = record.data;
              const title = data.kind === "supplier" ? `${data.supplierCode} · ${data.name}`
                : data.kind === "purchase-request" ? `${data.requestCode} · ${data.itemCode}`
                  : `${data.orderCode} · ${data.itemCode}`;
              const detail = data.kind === "supplier" ? data.contactEmail || "No contact email recorded"
                : data.kind === "purchase-request" ? `${data.quantity} ${data.unit} requested`
                  : `${data.quantity} ${data.unit} · ${data.currency} ${data.unitPrice} per unit`;
              return <article className={styles.record} key={record.id}>
                <div><strong>{title}</strong><p>{detail}</p><small>{record.state} · Revision {record.revision}</small></div>
                <div className="row wrap">{(workflow[active][record.state] || []).map((action) => {
                  const key = record.id + ":" + action.to;
                  return <Btn key={action.to} small disabled={busy !== ""} aria-busy={busy === key} onClick={() => void transition(record, action.to)}>
                    <AsyncButtonLabel busy={busy === key} idle={action.label} busyText="Applying…" />
                  </Btn>;
                })}</div>
              </article>;
            })}
          </div>
        )}
      </Panel>
    </section>
  );
}
