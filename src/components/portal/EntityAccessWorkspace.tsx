"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity, FileText, History, Link2, Search, ShieldCheck } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { has } from "@/lib/portal-model";
import { titleCase } from "@/lib/ui-language";
import { Btn, Chip } from "./Common";
import FinanceRecordFinder from "./FinanceRecordFinder";

type EntityRecord = {
  id: string;
  name: string;
  status: string;
  meta: string;
  metrics: [string, string][];
  timeline: string[];
};

type EntityConfig = {
  noun: string;
  permission: string;
  actionPermission?: string;
  records: EntityRecord[];
};

const configs: Record<string, EntityConfig> = {
  employees: { noun: "Employee", permission: "users.admin", actionPermission: "users.admin", records: [{ id: "EMP-S-014", name: "Sample Employee — A", status: "Active Review Record", meta: "Farm Operations · Daenem Farms Ikire", metrics: [["Employment", "Full-Time"], ["Payroll Eligibility", "Review Required"], ["Attendance", "Fixture Only"]], timeline: ["Employment record opened", "Farm assignment reviewed", "Training evidence added"] }] },
  customers: { noun: "Customer", permission: "communication.view", actionPermission: "communication.compose", records: [{ id: "CUS-S-024", name: "Sample Distributor — North", status: "Active Review Relationship", meta: "Wholesale · Transaction Data Is Fictional", metrics: [["Outstanding Balance", "Unavailable"], ["Orders", "3 Sample"], ["Preferred Channel", "WhatsApp"]], timeline: ["Sample order confirmed", "Invoice communication drafted", "Feedback request scheduled"] }] },
  suppliers: { noun: "Supplier", permission: "suppliers.view", actionPermission: "suppliers.edit", records: [{ id: "SUP-S-009", name: "Sample Feed Inputs Ltd.", status: "Qualification Review", meta: "Raw Materials · No Production Contract", metrics: [["Purchase Orders", "4 Sample"], ["Quality Score", "Not Connected"], ["Balance", "Unavailable"]], timeline: ["Quotation received", "Inspection evidence reviewed", "Delivery performance noted"] }] },
  banking: { noun: "Bank Account", permission: "banking.accounts.view", records: [{ id: "ACC-S-4821", name: "Collections Account", status: "No Provider Connected", meta: "Fictional Bank A · •••• 4821 · NGN", metrics: [["Current Balance", "Unavailable"], ["Available Balance", "Unavailable"], ["Last Sync", "Never"]], timeline: ["Provider selection required", "Consent not granted", "No statement imported"] }] },
  finance: { noun: "Transaction", permission: "finance.view", records: [] },
  "payroll-admin": { noun: "Payroll Payment", permission: "payroll.view", actionPermission: "payroll.admin", records: [{ id: "PAY-S-102", name: "Sample Salary Payment", status: "Awaiting Confirmation", meta: "September 2026 · Employee Identity Restricted", metrics: [["Gross Pay", "₦180,000 · Sample"], ["Deductions", "Unavailable"], ["Net Pay", "Unavailable"]], timeline: ["Sample batch prepared", "Independent approval required", "Provider result unavailable"] }] },
  flocks: { noun: "Flock", permission: "flocks.view", records: [{ id: "FLK-S-204", name: "Sample Layer Flock 204", status: "Production Stage", meta: "House 04 · Daenem Farms Ikire", metrics: [["Birds", "3,248"], ["Age", "32 Weeks"], ["Mortality", "Review Required"]], timeline: ["Placement recorded", "Vaccination evidence attached", "Production stage entered"] }] },
  procurement: { noun: "Purchase Order", permission: "procurement.view", actionPermission: "procurement.approve", records: [{ id: "PO-S-1048", name: "Sample Feed Ingredient Order", status: "Inspection Pending", meta: "Supplier And Values Are Fictional", metrics: [["Order Value", "₦840,000 · Sample"], ["Received", "Partial"], ["Approval", "Independent Checker"]], timeline: ["Purchase request approved", "Quotation compared", "Receiving evidence requested"] }] },
  security: { noun: "Security Incident", permission: "security.view", actionPermission: "security.manage", records: [{ id: "SEC-S-031", name: "Sample Gate Exception", status: "Investigating", meta: "Evidence-First Review · No Real CCTV", metrics: [["Priority", "High"], ["Evidence", "2 Sample Files"], ["Owner", "Security Team"]], timeline: ["Exception recorded", "Gate pass cross-check opened", "Independent review assigned"] }] },
  recruitment: { noun: "Recruitment Candidate", permission: "recruitment.view", actionPermission: "recruitment.manage", records: [{ id: "CAN-S-018", name: "Sample Candidate — B", status: "Structured Interview", meta: "Farm Operations Role · Fictional Profile", metrics: [["Stage", "Interview"], ["Evidence", "3 Documents"], ["Decision", "Pending"]], timeline: ["Application received", "Eligibility reviewed", "Interview panel scheduled"] }] },
};

export const entityAccessRoutes = Object.keys(configs);

export default function EntityAccessWorkspace({ route, person }: { route: string; person: Persona }) {
  const config = configs[route];
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(config?.records[0]?.id || "");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => config?.records.filter((record) => `${record.id} ${record.name} ${record.status}`.toLowerCase().includes(query.toLowerCase())) || [], [config, query]);
  useEffect(() => {
    if (!config) return;
    const queryString = location.hash.split("?")[1] || "";
    const requested = new URLSearchParams(queryString).get("record");
    if (!requested) return;
    const authorized = config.records.find((record) => record.id === requested);
    if (authorized) setSelectedId(authorized.id);
    else setNotice("This record is unavailable in the current authorized scope.");
  }, [config]);
  if (!config || !has(person, config.permission)) return null;
  const selected = config.records.find((record) => record.id === selectedId) || filtered[0];
  if (route === "finance") return <FinanceRecordFinder person={person}/>;
  return (
    <section className={`entity-access entity-${route}`} data-entity-access={route} aria-labelledby={`${route}-entity-title`}>
      <header className="entity-access-head"><div><span className="eyebrow">Permission-Safe Entity Access · Sample / Design Data</span><h2 id={`${route}-entity-title`}>{config.noun} Finder And Detail</h2><p>Locate a known authorized record directly, then inspect its status, relationships, evidence, and history without leaving this workspace.</p></div><Chip tone="blue">Current Scope Re-Evaluated</Chip></header>
      <div className="entity-access-layout">
        <aside className="entity-finder" aria-label={`${config.noun} discovery`}><><label><Search size={17}/><span className="sr-only">Search {config.noun} Records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.noun}, ID, Or Status`}/></label><div className="entity-quick-filters" aria-label="Quick Filters"><button aria-pressed="true">Needs Review</button><button>Current Scope</button><button>Recent</button></div>{filtered.map((record) => <button key={record.id} className={selected?.id === record.id ? "active" : ""} onClick={() => { setSelectedId(record.id); history.replaceState(null, "", `#/${route}?record=${encodeURIComponent(record.id)}`); }}><strong>{record.name}</strong><span>{record.id}</span><small>{record.status}</small></button>)}{!filtered.length && <p>No Authorized Records Match This Search.</p>}</></aside>
        {selected && <article className="entity-detail" id={`record-${selected.id.toLowerCase()}`}><header><div><span>{selected.id}</span><h3>{selected.name}</h3><p>{selected.meta}</p></div><Chip tone="amber">{selected.status}</Chip></header><div className="entity-metrics">{selected.metrics.map(([label, value]) => <div key={label}><span>{titleCase(label)}</span><strong>{value}</strong></div>)}</div><div className="entity-detail-regions"><section><h4><Activity size={17}/>Related Activity</h4><p>Authorized transactions, assignments, and operational events remain linked to their source records.</p></section><section><h4><Link2 size={17}/>Related Records</h4><p>Relationships resolve by permission and current scope; hidden records never appear as counts or links.</p></section><section><h4><FileText size={17}/>Files And Evidence</h4><p>Evidence requires record permission, file permission, retention rules, and an auditable download.</p></section><section><h4><ShieldCheck size={17}/>Audit Boundary</h4><p>Frontend review state is not an authoritative audit record. Backend persistence is required.</p></section></div><section className="entity-timeline"><h4><History size={17}/>Timeline And History</h4>{selected.timeline.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}</section><footer><Btn onClick={() => setNotice(`${config.noun} review link prepared for this design session.`)}>Copy Review Link</Btn>{config.actionPermission && has(person, config.actionPermission) && <Btn primary onClick={() => setNotice(`Authorized ${config.noun.toLowerCase()} action opened in design-review mode.`)}>Open Authorized Action</Btn>}</footer>{notice && <p className="entity-notice" role="status">{notice}</p>}</article>}
      </div>
      <div className="entity-state-contract" aria-label="Entity access state contract"><strong>Production Record Contract</strong><span>Stable Record ID</span><span>Permission And Field Scope</span><span>Not Found Without Disclosure</span><span>Archived / Deleted State</span><span>Audit And Evidence</span><span>Mobile Record View</span><small>DESIGN READY · Authoritative deep-link resolution and state enforcement require backend services.</small></div>
    </section>
  );
}
