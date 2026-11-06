"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, FileCheck2, FileSpreadsheet, History, Layers3, ShieldCheck, UploadCloud, X } from "lucide-react";
import { Btn, Chip } from "./Common";
import type { WorkspaceProps } from "./PortalExperience";

export const importRoutes = ["import-center","import-new","import-templates","import-mappings","import-validation","import-processing","import-completed","import-failed","import-history","import-corrections"] as const;

const steps=["Upload","Detect","Worksheet","Preview","Map Columns","Validate","Duplicates","Dry Run","Review","Approve","Import","Reconcile","Audit"];
const sampleRows=[
  ["001","Dangote Cement 42.5R","120","Bag","Accepted"],
  ["002","Y12 Reinforcement","3.8","Tonne","Accepted"],
  ["003","Timber 1×12","","Piece","Required Quantity"],
  ["004","Dangote cement 42.5 r","40","Bag","Possible Duplicate"],
];

const routeContexts: Record<string, { step: number; title: string; purpose: string; state: string; next: string }> = {
  "import-center": { step: 7, title: "Import Control Tower", purpose: "Coordinate governed imports across authorized modules without bypassing business rules.", state: "Design fixture", next: "Choose a new import or inspect governed history." },
  "import-new": { step: 0, title: "New Governed Import", purpose: "Select a supported source, target module, worksheet and approval policy.", state: "Awaiting file", next: "Choose a structured file; no upload occurs in this preview." },
  "import-templates": { step: 3, title: "Import Templates", purpose: "Review versioned field definitions and data-preparation guidance before mapping.", state: "Template contract", next: "Backend must supply authoritative schemas and downloadable files." },
  "import-mappings": { step: 4, title: "Mapping Profiles", purpose: "Map source columns to stable target fields with required types and relationships.", state: "Draft mapping", next: "Validate against the authoritative module schema." },
  "import-validation": { step: 5, title: "Validation Workbench", purpose: "Resolve row errors, duplicate candidates and business-rule exceptions before dry run.", state: "Review required", next: "Correct rejected rows or approve explicit exceptions." },
  "import-processing": { step: 10, title: "Processing Monitor", purpose: "Observe an idempotent, tenant-scoped import after all required approvals.", state: "Backend pending", next: "No processing starts until server-side execution exists." },
  "import-completed": { step: 12, title: "Completed Imports", purpose: "Inspect accepted, rejected, skipped and updated row outcomes with audit evidence.", state: "Audit contract", next: "Open the immutable execution receipt when backend records exist." },
  "import-failed": { step: 5, title: "Failed Imports", purpose: "Diagnose validation or processing failures without hiding partial outcomes.", state: "Exception review", next: "Download errors, correct source data and create a new governed run." },
  "import-history": { step: 12, title: "Import History", purpose: "Trace file hash, actor, approvals, mapping version, results and correction lineage.", state: "Audit contract", next: "Filter immutable run records after backend integration." },
  "import-corrections": { step: 8, title: "Corrections & Reversals", purpose: "Prepare controlled corrections instead of silently overwriting authoritative records.", state: "Approval required", next: "Link the source import, reason, evidence and checker decision." },
};

export default function DataImportCenter({ route }: WorkspaceProps) {
  const context=routeContexts[route]||routeContexts["import-center"];
  const [step,setStep]=useState(context.step);
  const [file,setFile]=useState<string>("");
  const [mode,setMode]=useState("Create Only");
  const accepted=useMemo(()=>sampleRows.filter(row=>row[4]==="Accepted").length,[]);
  useEffect(()=>setStep(context.step),[context.step]);
  return <section className="data-import-center" data-import-route={route}>
    <div className="import-truth" role="note"><ShieldCheck/><div><strong>Design Fixture · No File Is Processed</strong><p>Structured formats are parsed directly before AI. Every authoritative import requires server validation, current permission, approval, idempotency and audit.</p></div><Chip tone="gray">Backend Required</Chip></div>
    <header className="import-route-brief" aria-label="Current import workspace contract"><div><span className="eyebrow">{route.replaceAll("-", " ").toUpperCase()}</span><h2>{context.title}</h2><p>{context.purpose}</p></div><dl><div><dt>Current State</dt><dd>{context.state}</dd></div><div><dt>Next Safe Action</dt><dd>{context.next}</dd></div></dl></header>
    <nav className="import-stage-rail" aria-label="Enterprise Import Workflow">{steps.map((label,index)=><button key={label} aria-current={step===index?"step":undefined} className={index<step?"complete":step===index?"active":""} onClick={()=>setStep(index)}><span>{index<step?<Check/>:String(index+1).padStart(2,"0")}</span><strong>{label}</strong></button>)}</nav>
    <div className="import-workbench">
      <section className="import-source-panel">
        <header><div><span className="eyebrow">DIRECT PARSING FIRST</span><h2>Source & Import Policy</h2></div><UploadCloud/></header>
        <label className="import-dropzone"><FileSpreadsheet/><strong>{file||"Choose A Structured Data File"}</strong><span>XLSX · XLS · CSV · TSV · ODS · Controlled JSON</span><input type="file" accept=".xlsx,.xls,.csv,.tsv,.ods,.json" onChange={event=>setFile(event.target.files?.[0]?.name||"")}/></label>
        <div className="import-policy-grid"><label>Target Module<select defaultValue="Construction Materials"><option>Construction Materials</option><option>Inventory Catalog</option><option>Suppliers</option><option>Customers</option><option>Employees</option><option>BOQ</option><option>Bank Statement Staging</option><option>Payroll Staging</option></select></label><label>Import Mode<select value={mode} onChange={event=>setMode(event.target.value)}><option>Create Only</option><option>Update Only</option><option>Controlled Upsert</option></select></label><label>Worksheet<select defaultValue="Materials"><option>Materials</option><option>Suppliers</option><option>Rates</option></select></label><label>Approval Policy<select defaultValue="Maker / Checker"><option>Maker / Checker</option><option>Authorized Review</option><option>Migration Control</option></select></label></div>
      </section>
      <section className="import-mapping-panel"><header><div><span className="eyebrow">MAPPING PROFILE</span><h2>Detected Columns</h2></div><Layers3/></header>{[["Item Name","Material Name","Required"],["Quantity","Quantity","Required"],["UOM","Base UOM","Validated Enum"],["Supplier","Supplier Match","Relationship"],["Unit Cost","Standard Cost","Currency"]].map(([source,target,rule])=><div className="mapping-row" key={source}><span>{source}</span><ArrowRight/><strong>{target}</strong><small>{rule}</small></div>)}<Btn>Save Mapping Profile</Btn></section>
    </div>
    <section className="import-validation-console">
      <header><div><span className="eyebrow">DRY RUN · SAMPLE DATA</span><h2>Row Validation & Reconciliation Preview</h2></div><div className="import-counts"><span><Check/> {accepted} Accepted</span><span><AlertTriangle/> 2 Need Review</span><span><X/> 0 Imported</span></div></header>
      <div className="import-table" role="region" aria-label="Sample import validation rows" tabIndex={0}><table><caption>Sample import dry-run results</caption><thead><tr>{["Row","Detected Item","Quantity","Unit","Result"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{sampleRows.map(row=><tr key={row[0]} data-state={row[4]==="Accepted"?"accepted":"review"}>{row.map((cell,index)=><td key={index}>{index===4?<Chip tone={cell==="Accepted"?"green":"amber"}>{cell}</Chip>:cell||"Missing"}</td>)}</tr>)}</tbody></table></div>
      <div className="import-decision"><div><FileCheck2/><span><strong>Dry Run Only</strong><small>No database write, stock movement, finance posting or payroll effect occurred.</small></span></div><div className="row wrap"><Btn>Download Error Report</Btn><Btn disabled>Authorize Import</Btn></div></div>
    </section>
    <div className="import-history-strip"><History/><strong>Import History Contract</strong><span>Uploader · approver · file hash · mapping · accepted/rejected/skipped/updated rows · timestamps · rollback/correction · audit</span></div>
  </section>;
}
