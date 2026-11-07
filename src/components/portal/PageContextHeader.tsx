"use client";

import React from "react";
import { HelpCircle, Search, SlidersHorizontal } from "lucide-react";
import type { Page, Persona } from "@/lib/portal-model";
import { has } from "@/lib/portal-model";
import { titleCase } from "@/lib/ui-language";
import { Btn } from "./Common";

const purposeByGroup: Record<string, string> = {
  Home: "Prioritizes company decisions, monitors operational exceptions, and ensures executive oversight.",
  "Farm Work": "Maintains biological flock conservation, production logging, and biosecurity standards.",
  "Stock & Purchases": "Coordinates feed, medication, inventory balances, and supplier procurement.",
  "Sales & Payments": "Verifies customer wholesale payments and controls secure gate release.",
  "People & Payroll": "Calculates statutory deductions, ensures tax compliance, and settles staff pay.",
  "Projects & Equipment": "Tracks farm facility construction, machinery readiness, and infrastructure.",
  "Reports & Insights": "Provides operational analytics, yield metrics, and financial intelligence.",
  Communication: "Maintains authorized internal notices, messaging, and operational updates.",
  Administration: "Enforces permission controls, audit accountability, and system security.",
  "Farm & Production": "Maintains biological flock conservation, production logging, and biosecurity standards.",
  Finance: "Keeps financial records, banking reconciliation, and statutory deductions controlled.",
  "Stock & Finance": "Connects stock levels, feed formulation, wholesale orders, and payments.",
  "People & Work": "Supports workforce decisions, statutory deductions, and payroll verification.",
  Commercial: "Connects customer orders, bank payments, and gate fulfillment.",
  "Customer Engagement": "Connects customer identity, transactions, communication, and service history.",
  Operations: "Coordinates operational work, daily pen logs, and biological headcount.",
  "Control & Assurance": "Keeps evidence, incidents, activity, and controls reviewable.",
  System: "Supports configuration, review, diagnostics, and service continuity.",
  Admin: "Keeps administrative changes permissioned, explainable, and auditable.",
  Workspace: "Prioritizes the decisions, changes, and risks that matter now.",
  "Self-Service": "Supports authorized personal tasks without exposing administrative records.",
};

export default function PageContextHeader({
  page,
  person,
  period,
  onPeriodChange,
  onHelp,
  onPrimary,
  onSearch,
  showActions = true,
}: {
  page: Page;
  person: Persona;
  period?: string;
  onPeriodChange?: (value: string) => void;
  onHelp: () => void;
  onPrimary: () => void;
  onSearch: () => void;
  showActions?: boolean;
}) {
  const canWrite = Boolean(page.action && page.write && has(person, page.write));
  const groupPurpose = purposeByGroup[page.group] || "Keeps the current authorized work, evidence, status, and next actions accountable.";
  const purpose = page.dna || groupPurpose;
  const hasSearch = has(person, "search.view");
  const sourceStatus = page.dataState === "live"
    ? "Cloudflare D1 Database"
    : page.authority === "existing" ? "Integration pending"
      : page.authority === "development" ? "Under development" : "Design fixture";
  const locationKey = person.organizationScope?.locationKey;
  const assignedFarm = typeof locationKey === "string" ? locationKey.trim() : "";
  const farmSite = page.farm
    ? assignedFarm ? titleCase(assignedFarm.replace(/[-_]+/g, " ")) : "Authorized Farm Scope"
    : "Authorized Scope";

  return (
    <header className="page-context-header" data-page-context={page.id}>
      <div className="page-context-main">
        <span className="eyebrow">{titleCase(page.group)} · Authorized Workspace</span>
        <h1>{titleCase(page.title)}</h1>
        <span className="page-context-mobile-state" data-authority={page.authority} role="note">{sourceStatus}</span>
        <p className="page-context-overview"><strong>Overview.</strong> {page.description}</p>
        <p className="page-context-purpose"><strong>Business Purpose.</strong> {purpose}</p>
        <details className="page-context-mobile-purpose">
          <summary>More About This Page</summary>
          <p><strong>Overview.</strong> {page.description}</p>
          <p><strong>Business Purpose.</strong> {purpose}</p>
        </details>
      </div>
      <div className="page-context-side">
        <dl className="page-context-scope">
          <div><dt>Farm / Site</dt><dd>{farmSite}</dd></div>
          <div><dt>Business Unit</dt><dd>Daenem Farms</dd></div>
          <div><dt>Data State</dt><dd>{sourceStatus}</dd></div>
          {period && <div><dt>Reporting Period</dt><dd>{titleCase(period)}</dd></div>}
        </dl>
        {showActions && (
          <div className="page-context-actions" aria-label="Available Actions">
            <span className="page-context-actions-label">Available Actions</span>
            {canWrite && <Btn primary onClick={onPrimary}>{titleCase(page.action!)}</Btn>}
            {hasSearch && <Btn onClick={onSearch}><Search size={16}/>Search Records</Btn>}
            {onPeriodChange && period && (
              <label className="page-context-period"><SlidersHorizontal size={15}/><span className="sr-only">Reporting Period</span><select value={period} onChange={(event) => onPeriodChange(event.target.value)}><option>Today</option><option>Week</option><option>Month</option></select></label>
            )}
            {has(person, "help.view") && <Btn onClick={onHelp} aria-label="Page Help"><HelpCircle size={16}/><span className="page-context-help-text">Page Help</span></Btn>}
          </div>
        )}
      </div>
    </header>
  );
}
