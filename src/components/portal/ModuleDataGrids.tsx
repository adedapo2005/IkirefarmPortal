"use client";

import React from "react";
import type { Persona } from "@/lib/portal-model";
import { has } from "@/lib/portal-model";
import EnterpriseDataGrid, { type EnterpriseColumn } from "./EnterpriseDataGrid";
import FinanceEvidenceRegister from "./FinanceEvidenceRegister";
import { Chip } from "./Common";

const definitions: Record<string, { title: string; description: string; columns: EnterpriseColumn[]; rows: Record<string, React.ReactNode>[]; exportPermission?: string; importPermission?: string; bulkPermission?: string }> = {
  "payroll-admin": {
    title: "Payroll administration monitor",
    description: "Privacy-scoped sample outcomes. Company payroll data is not connected.",
    columns: [{id:"reference",label:"Reference",pinned:true},{id:"period",label:"Period"},{id:"group",label:"Authorized cohort"},{id:"employees",label:"Employees"},{id:"amount",label:"Gross amount",permission:"payroll.admin"},{id:"successful",label:"Successful"},{id:"failed",label:"Failed"},{id:"pending",label:"Pending"},{id:"status",label:"Batch status"}],
    rows: [{reference:"PAY-S-009",period:"September 2026 · sample",group:"Sample payroll group",employees:"12",amount:"₦1,800,000 · SAMPLE",successful:"8",failed:"1",pending:"3",status:<Chip tone="amber">Awaiting confirmation</Chip>}], exportPermission:"payroll.admin",bulkPermission:"payroll.admin",
  },
  employees: {
    title: "Workforce directory",
    description: "Field-level privacy removes columns the current role cannot access.",
    columns: [{id:"employee",label:"Employee",pinned:true},{id:"id",label:"Employee ID"},{id:"department",label:"Department"},{id:"site",label:"Farm / site"},{id:"role",label:"Role"},{id:"status",label:"Account state"},{id:"contact",label:"Contact",permission:"employee.manage"},{id:"session",label:"Session risk",permission:"security.view"}],
    rows: [{employee:"Sample Employee A",id:"EMP-S-001",department:"Farm Operations",site:"Daenem Farms Ikire",role:"Farm operator",status:<Chip>Active · sample</Chip>,contact:"sample-a@example.invalid",session:"No live session"},{employee:"Sample Employee B",id:"EMP-S-002",department:"Inventory",site:"Daenem Farms Ikire",role:"Store reviewer",status:<Chip tone="amber">Review · sample</Chip>,contact:"sample-b@example.invalid",session:"No live session"}], exportPermission:"employee.manage",bulkPermission:"employee.manage",
  },
  procurement: {
    title: "Sourcing and receiving ledger",
    description: "Purchase request through reconciliation with maker-checker and evidence visibility.",
    columns: [{id:"request",label:"Request",pinned:true},{id:"item",label:"Item"},{id:"stage",label:"Stage"},{id:"supplier",label:"Supplier"},{id:"quote",label:"Quote"},{id:"maker",label:"Maker"},{id:"checker",label:"Checker",permission:"procurement.approve"},{id:"evidence",label:"Evidence"},{id:"exception",label:"Exception"}],
    rows: [{request:"PR-S-001",item:"Sample layer feed",stage:"Quote comparison",supplier:"Fictional Supplier A",quote:"₦680,000 · SAMPLE",maker:"Sample requester",checker:"Unassigned",evidence:"Quotation pack",exception:<Chip tone="amber">Decision required</Chip>},{request:"PR-S-002",item:"Sample packaging",stage:"Receiving",supplier:"Fictional Supplier B",quote:"₦120,000 · SAMPLE",maker:"Sample requester",checker:"Sample reviewer",evidence:"Delivery photo ref",exception:<Chip>None recorded</Chip>}], exportPermission:"procurement.view",importPermission:"procurement.create",bulkPermission:"procurement.approve",
  },
  recruitment: {
    title: "Applicant case register",
    description: "Case-stage and evidence view; sample people are fictional and no hiring action is submitted.",
    columns: [{id:"case",label:"Case",pinned:true},{id:"candidate",label:"Candidate"},{id:"role",label:"Role"},{id:"stage",label:"Stage"},{id:"owner",label:"Assigned reviewer"},{id:"evidence",label:"Evidence"},{id:"risk",label:"Attention"},{id:"contact",label:"Contact",permission:"recruitment.manage"}],
    rows: [{case:"REC-S-011",candidate:"Sample Applicant A",role:"Farm technician",stage:"Evidence review",owner:"Sample recruiter",evidence:"2 references",risk:<Chip tone="amber">One gap</Chip>,contact:"applicant-a@example.invalid"},{case:"REC-S-012",candidate:"Sample Applicant B",role:"Accounts assistant",stage:"Interview planning",owner:"Sample recruiter",evidence:"Complete · sample",risk:<Chip>On track</Chip>,contact:"applicant-b@example.invalid"}], exportPermission:"recruitment.view",bulkPermission:"recruitment.manage",
  },
  audit: {
    title: "Forensic activity ledger",
    description: "Immutable-event contract with actor, scope, evidence and outcome. No production audit events.",
    columns: [{id:"event",label:"Event",pinned:true},{id:"time",label:"Time"},{id:"actor",label:"Actor"},{id:"scope",label:"Scope"},{id:"action",label:"Action"},{id:"evidence",label:"Evidence"},{id:"outcome",label:"Outcome"},{id:"hash",label:"Integrity ref",permission:"audit.manage"}],
    rows: [{event:"AUD-S-201",time:"11 Sep 09:42 · sample",actor:"Sample reviewer",scope:"Inventory / Ikire",action:"Reviewed variance",evidence:"EV-S-019",outcome:<Chip>Recorded fixture</Chip>,hash:"Not generated"},{event:"AUD-S-202",time:"11 Sep 10:15 · sample",actor:"Sample checker",scope:"Procurement / Ikire",action:"Returned request",evidence:"EV-S-020",outcome:<Chip tone="amber">Reason required</Chip>,hash:"Not generated"}], exportPermission:"audit.view",
  },
};

export const representativeGridRoutes = Object.freeze(["finance", ...Object.keys(definitions)]);

export default function ModuleDataGrid({ route, person }: { route: string; person: Persona }) {
  if (route === "finance") return has(person, "finance.view") ? <FinanceEvidenceRegister person={person}/> : null;
  const definition = definitions[route];
  if (!definition) return null;
  return <EnterpriseDataGrid id={`${route}-enterprise-grid`} person={person} {...definition}/>;
}
