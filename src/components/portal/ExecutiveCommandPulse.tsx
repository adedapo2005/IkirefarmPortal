"use client";

import { ArrowUpRight, Landmark, RadioTower } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { canPage, has, isOwnerPrincipal } from "@/lib/portal-model";
import { Btn, Chip } from "./Common";

const signals = [
  { label: "Farm operations", permission: "farm.view", route: "operations", value: "Awaiting source", status: "Operational pulse unavailable" },
  { label: "Inventory exceptions", permission: "inventory.view", route: "inventory", value: "—", status: "No authoritative count" },
  { label: "Expense approvals", permission: "expense.admin", route: "expenses", value: "—", status: "Decision queue unavailable" },
  { label: "Finance summary", permission: "finance.view", route: "finance", value: "Unavailable", status: "Ledger not connected" },
  { label: "Banking state", permission: "banking.accounts.view", route: "banking", value: "0 connected", status: "Provider setup required" },
  { label: "Payroll state", permission: "payroll.view", route: "payroll", value: "Unavailable", status: "No payroll batch" },
  { label: "Sales fulfillment", permission: "sales.view", route: "sales", value: "—", status: "Orders unavailable" },
  { label: "Communication queue", permission: "communication.view", route: "communication", value: "—", status: "Providers not configured" },
] as const;

const enterpriseMatrix = [
  {label:"Production",permission:"farm.view",route:"operations",state:"Awaiting source",attention:"No authoritative production snapshot"},
  {label:"Feed",permission:"feed.view",route:"feed",state:"Runway unavailable",attention:"Stock and consumption need verification"},
  {label:"Egg output",permission:"eggs.view",route:"eggs",state:"Output unavailable",attention:"Collection source not connected"},
  {label:"Procurement",permission:"procurement.view",route:"procurement",state:"2 sample decisions",attention:"Fictional quotation review"},
  {label:"Cash & revenue",permission:"finance.view",route:"banking",state:"Unavailable",attention:"No connected account or ledger"},
  {label:"Expenses",permission:"expense.admin",route:"expenses",state:"Queue unavailable",attention:"Evidence service required"},
  {label:"People",permission:"employee.view",route:"employees",state:"Directory sample",attention:"Authoritative workforce required"},
  {label:"Attendance",permission:"attendance.view",route:"attendance",state:"Unavailable",attention:"No attendance feed"},
  {label:"Recruitment",permission:"recruitment.view",route:"recruitment",state:"2 sample cases",attention:"Fictional review only"},
  {label:"Security",permission:"security.view",route:"security",state:"No live incident feed",attention:"Evidence providers disconnected"},
  {label:"Approvals",permission:"signup.approve",route:"signup-admin",state:"3 sample reviews",attention:"One fictional expiry"},
  {label:"Weather",permission:"weather.view",route:"weather-lab",state:"Provider unavailable",attention:"Visual fixtures only"},
  {label:"System health",permission:"security.view",route:"settings",state:"Review shell online",attention:"Backend diagnostics unavailable"},
] as const;

export default function ExecutiveCommandPulse({ person, go }: { person: Persona; go: (id: string) => void }) {
  if (!has(person, "finance.view") && !isOwnerPrincipal(person)) return null;
  const visible = signals.filter((signal) => has(person, signal.permission) && canPage(person, signal.route));
  const matrix = enterpriseMatrix.filter((signal)=>has(person,signal.permission)&&canPage(person,signal.route));
  return (
    <section className="executive-command-pulse" data-zero-click="executive-command-center" aria-label="Executive operations command center">
      <header>
        <div><span className="eyebrow"><RadioTower size={15} /> EXECUTIVE OPERATIONS COMMAND CENTER</span><h2>Authorized signals. No mystery tiles.</h2><p>Primary state is visible now; drill-down adds evidence and history.</p></div>
        <Chip tone="amber">SAMPLE / UNAVAILABLE STATES</Chip>
      </header>
      <div className="executive-signal-grid">
        {visible.map((signal) => <article key={signal.label}><span>{signal.label}</span><strong>{signal.value}</strong><small>{signal.status}</small><Btn small onClick={() => go(signal.route)}>Open evidence <ArrowUpRight size={14}/></Btn></article>)}
      </div>
      <div className="executive-priority-terminal" aria-label="What needs attention, what changed, decisions and risk">
        <section><span className="eyebrow">WHAT NEEDS ATTENTION</span><strong>Authoritative operating feeds</strong><p>Farm, cash, payroll and security values remain unavailable until scoped services respond.</p></section>
        <section><span className="eyebrow">WHAT CHANGED</span><strong>Sample decisions are visible</strong><p>Procurement and provisional-account fixtures demonstrate decision density, not real activity.</p></section>
        <section><span className="eyebrow">WHAT REQUIRES A DECISION</span><strong>Evidence before approval</strong><p>Only authorized routes reveal their queues; backend maker-checker remains authoritative.</p></section>
        <section><span className="eyebrow">WHERE RISK EXISTS</span><strong>Disconnected sources</strong><p>Unavailable is rendered as a state, never replaced by fabricated operational confidence.</p></section>
      </div>
      <section className="executive-domain-matrix" aria-label="Authorized enterprise domain state">
        <header><div><span className="eyebrow">ENTERPRISE OPERATING MATRIX · SAMPLE / UNAVAILABLE STATES</span><h3>Farm, commercial, cash, people and assurance in one decision surface.</h3></div></header>
        <div>{matrix.map(signal=><article key={signal.label}><button onClick={()=>go(signal.route)}><span>{signal.label}</span><strong>{signal.state}</strong><small>{signal.attention}</small><ArrowUpRight size={14}/></button></article>)}</div>
      </section>
      {canPage(person,"banking") && <footer><Landmark size={18}/><span>Treasury overview exposes financial summary, activity, cash-flow, account monitoring, payroll and transaction state together.</span><Btn onClick={()=>go("banking")}>Open Treasury Terminal</Btn></footer>}
    </section>
  );
}
