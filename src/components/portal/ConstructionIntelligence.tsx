"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileSpreadsheet,
  HardHat,
  MessageSquareText,
  PackageCheck,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Btn, Chip, Panel } from "./Common";
import { SmartTextarea } from "@/components/ui/smart-input";
import { canPage } from "@/lib/portal-model";
import { constructionPrimaryRoute, constructionPrimaryRoutes, constructionRoutes } from "@/lib/construction-routes";
export { constructionRoutes };
import type { WorkspaceProps } from "./PortalExperience";
import ContextualCommunicationAction from "./ContextualCommunicationAction";
type PrimaryRoute = (typeof constructionPrimaryRoutes)[number];

const primaryNavigation: ReadonlyArray<readonly [PrimaryRoute,string,string]> = [
  ["construction","Construction Dashboard","Overall cost, progress and items needing attention"],
  ["construction-projects","Projects","Ongoing imports, new projects, materials and evidence"],
  ["construction-costs-payments","Costs & Payments","Agreed costs, payments, advances and outstanding balances"],
  ["construction-people-suppliers","People & Suppliers","Artisans, contractors, suppliers and payment history"],
  ["construction-reconciliation-alerts","Reconciliation & Alerts","Unmatched records, possible duplicates and material differences"],
];

function SampleNotice() {
  return <div className="construction-disclosure" role="note"><ShieldCheck aria-hidden="true"/><div><strong>Design Fixture / Provider Required</strong><p>This screen proves the approved workflow only. No live WhatsApp, bank, payment, AI or construction source is asserted until an authorized provider or backend is connected.</p></div><Chip tone="gray">Non-Production</Chip></div>;
}

function ConstructionNav({ route, go }: { route: PrimaryRoute; go: WorkspaceProps["go"] }) {
  return <nav className="construction-route-tabs" aria-label="Construction Areas">{primaryNavigation.map(([id,label,detail])=><button type="button" key={id} className={route===id?"active":""} onClick={()=>go(id)} aria-current={route===id?"page":undefined}><strong>{label}</strong><small>{detail}</small></button>)}</nav>;
}

function Dashboard({ go }: Pick<WorkspaceProps,"go">) {
  const attention = [
    ["Unmatched Transactions","Bank or statement evidence needing a construction match"],
    ["Material Differences","Purchased, received, used or remaining quantities that do not reconcile"],
    ["Possible Duplicate Payments","Similar records requiring human review"],
    ["Missing Evidence","Costs or payments without enough supporting records"],
  ] as const;
  return <div className="construction-command-center">
    <section className="construction-hero"><div><span className="eyebrow">Construction Intelligence</span><h1>See What Was Built, What It Cost And What Needs Attention.</h1><p>Reconstruct ongoing construction from existing evidence, continue tracking it live, and use the same lifecycle for future projects.</p></div><HardHat aria-hidden="true"/></section>
    <div className="construction-kpi-grid">{[
      ["Total Construction Spend","Provider Required"],["Approved Budget","Provider Required"],["Outstanding Payments","Provider Required"],["Materials Cost","Provider Required"],["Active Projects","Provider Required"],["Items Needing Review","Provider Required"],
    ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong><small>No fabricated metric</small></article>)}</div>
    <div className="construction-two-column"><Panel title="Start Here" description="Use existing evidence first; enter new construction only when needed."><div className="construction-action-list"><button onClick={()=>go("construction-projects")}><FileSpreadsheet/><span><strong>Import Existing / Ongoing Construction</strong><small>WhatsApp, spreadsheet, bank evidence, receipts, images and voice notes feed one ledger.</small></span></button><button onClick={()=>go("construction-projects")}><Building2/><span><strong>Start New Construction Project</strong><small>Create the project once, then record activity live through the same lifecycle.</small></span></button></div></Panel><Panel title="Needs Attention" description="One review queue instead of separate risk, banking and evidence pages."><div className="mini-list">{attention.map(([title,detail])=><button key={title} onClick={()=>go("construction-reconciliation-alerts")}><span className="list-symbol"><AlertTriangle/></span><span className="grow"><strong>{title}</strong><small>{detail}</small></span><Chip tone="amber">Review</Chip></button>)}</div></Panel></div>
    <Panel title="Ask Construction" description="Answers must be grounded in authorized records and supporting evidence."><label className="construction-ai-query"><Search/><input aria-label="Ask Construction" placeholder="How much have we spent on Staff Quarters?"/><Btn>Prepare Evidence-Based Answer</Btn></label></Panel>
  </div>;
}

function Projects({ detail }: Pick<WorkspaceProps,"detail">) {
  const [mode,setMode]=useState<"import"|"new">("import");
  const [tab,setTab]=useState("Overview");
  const [projectNotes,setProjectNotes]=useState("");
  const tabs=["Overview","Costs","Materials","People","Evidence"];
  return <div className="construction-project-workspace"><section className="construction-hero"><div><span className="eyebrow">Projects</span><h1>Reconstruct Ongoing Work Or Start A New Project.</h1><p>Historical imports and live entry feed the same Construction Ledger.</p></div><Building2/></section>
    <div className="construction-segmented"><button className={mode==="import"?"active":""} onClick={()=>setMode("import")}>Import Existing / Ongoing Construction</button><button className={mode==="new"?"active":""} onClick={()=>setMode("new")}>Start New Construction Project</button></div>
    {mode==="import"?<Panel title="Import & Reconstruct" description="Do not re-enter history that already exists in your evidence."><div className="construction-import-flow">{["Import","Extract","Propose Matches","Human Review","Reconstruct Ledger","Continue Live"].map((step,index)=><div key={step}><span>{index+1}</span><strong>{step}</strong></div>)}</div><div className="construction-source-grid">{[[MessageSquareText,"WhatsApp Export","Messages, conversations, receipts, images and voice notes"],[FileSpreadsheet,"Spreadsheet","Historical expenses and project records"],[Banknote,"Bank Evidence","Statements or connected transactions when approved"],[PackageCheck,"Receipts & Images","Receipts, invoices, quotations and site photographs"]].map(([Icon,title,desc])=>{const I=Icon;return <article key={String(title)}><I/><strong>{String(title)}</strong><small>{String(desc)}</small><Chip tone="amber">Provider / Import Required</Chip></article>})}</div><p className="form-note">Original evidence stays intact. AI may suggest relationships, but uncertain matches require human review before affecting the ledger.</p></Panel>:<Panel title="New Construction Project" description="Only capture the information needed to begin; the rest grows with the project."><div className="construction-form-grid"><label>Project Name<input placeholder="e.g. Staff Quarters"/></label><label>Farm Area / Location<input placeholder="Where the work is happening"/></label><label>Construction Type<input placeholder="Building, Road, Drainage, Borehole..."/></label><label>Expected Budget<input inputMode="decimal" placeholder="Optional starting estimate"/></label><label>Start Date<input type="date"/></label><label>Expected Completion<input type="date"/></label></div><div className="construction-full-field"><SmartTextarea label="Description / Notes" rows={3} placeholder="What is being built and anything management should know" value={projectNotes} onValueChange={setProjectNotes} description="Local correction and suggestions only · no provider transmission" suggestions={["construction","evidence","project","review","site","work"]}/></div><Btn primary>Save Draft Project</Btn></Panel>}
    <Panel title="Project Workspace" description="Useful construction detail stays inside the project instead of becoming more navigation pages."><div className="construction-segmented">{tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</div><div className="construction-project-empty"><Building2/><h3>{tab}</h3><p>Authorized project records will appear here when the backend is connected. Materials use Purchased → Received → Used → Remaining, and evidence stays attached to the relevant project record.</p><Btn onClick={()=>detail(`${tab} Evidence`,<p>WhatsApp, photos, voice notes, receipts, invoices, spreadsheet rows and bank evidence belong to the project record rather than separate Construction pages.</p>)}>View Evidence Contract</Btn></div></Panel>
  </div>;
}

function CostsPayments({ detail }: Pick<WorkspaceProps,"detail">) {
  return <div className="construction-finance-workspace"><section className="construction-hero"><div><span className="eyebrow">Costs & Payments</span><h1>One Construction Cost Ledger.</h1><p>Keep agreed costs, payments, advances and outstanding balances understandable without duplicating Finance or Banking.</p></div><CircleDollarSign/></section><Panel title="Construction Cost Ledger" description="Requested, Approved, Paid and Reconciled remain separate states."><div className="construction-ledger-head"><span>Date</span><span>Project</span><span>Description</span><span>Person / Supplier</span><span>Agreed</span><span>Paid</span><span>Outstanding</span><span>Evidence</span><span>Status</span></div><div className="construction-ledger-empty"><Banknote/><strong>No Authoritative Construction Cost Records Connected</strong><p>Finance / Treasury remains authoritative for actual payment and bank settlement. Construction displays project context and linked evidence.</p></div></Panel><div className="construction-two-column"><Panel title="Payment State" description="Never treat approval as proof that money moved."><div className="construction-state-chain">{["Requested","Approved","Paid","Reconciled"].map((s,i)=><div key={s}><span>{i+1}</span><strong>{s}</strong></div>)}</div></Panel><Panel title="Cash Advances" description="Track advances inside Costs & Payments, not another module."><p className="body-copy">Advance Issued → Person → Purpose → Project → Amount Used → Evidence → Amount Returned → Outstanding.</p><Chip tone="amber">Provider / Backend Required</Chip></Panel></div><Btn onClick={()=>detail("Cost Evidence",<p>An expanded cost record should show requester, approver, recipient, purpose, project/location, agreed amount, paid amount, outstanding balance, payment source, evidence and reconciliation status.</p>)}>Preview Expanded Record Contract</Btn></div>;
}

function PeopleSuppliers({ detail, person, go }: Pick<WorkspaceProps,"detail"|"person"|"go">) {
  return <div className="construction-commercial-workspace"><section className="construction-hero"><div><span className="eyebrow">People & Suppliers</span><h1>Know Who Received Money And What It Was For.</h1><p>One consolidated view for artisans, contractors and suppliers.</p></div><UsersRound/></section><Panel title="People & Supplier Profiles" description="Reuse shared supplier identity where available; do not create a duplicate supplier master."><div className="construction-profile-grid">{["Artisans","Contractors","Suppliers"].map(title=><article key={title}><UsersRound/><strong>{title}</strong><small>Jobs · Projects · Total Agreed · Total Paid · Outstanding · Materials · Evidence · Alerts</small><div className="row wrap"><Btn small onClick={()=>detail(`${title} Profile`,<p>The profile should answer how much this person or supplier has received and exactly what they were paid for, with linked jobs, transactions and evidence.</p>)}>Profile Contract</Btn><ContextualCommunicationAction person={person} detail={detail} go={go} useCaseId="construction-contact" recordLabel={title}/></div></article>)}</div></Panel></div>;
}

function ReconciliationAlerts({ detail }: Pick<WorkspaceProps,"detail">) {
  const suggestions=[
    ["Possible Match","WhatsApp payment discussion + spreadsheet row + bank transaction","94%",["Same Recipient","Same Amount","Same Date Range","Same Project Context"]],
    ["Material Difference","Purchased quantity does not yet reconcile with received / used evidence","Review",["Purchase Evidence Present","Delivery Evidence Missing"]],
  ] as const;
  return <div className="construction-intelligence-workspace"><section className="construction-hero"><div><span className="eyebrow">Reconciliation & Alerts</span><h1>Review What Does Not Reconcile.</h1><p>AI proposes matches and irregularities; people confirm the financial truth.</p></div><AlertTriangle/></section><Panel title="Review Queue" description="Neutral language: Needs Review, Possible Duplicate, Unmatched, Evidence Missing, Material Difference."><div className="intelligence-radar">{suggestions.map(([title,desc,confidence,reasons])=><article key={title}><span className="risk-score">{confidence}</span><div><strong>{title}</strong><p>{desc}</p><small>Reasons: {reasons.join(" · ")}</small></div><div className="row wrap"><Btn small onClick={()=>detail("Review Match",<div><p>{desc}</p><p><strong>Why Suggested:</strong> {reasons.join(", ")}</p></div>)}>Review</Btn><Btn small>Confirm</Btn><Btn small>Not Same</Btn><Btn small>Review Later</Btn></div></article>)}</div></Panel><Panel title="What Belongs Here" description="One review area instead of separate banking, risk, WhatsApp and evidence pages."><div className="construction-alert-grid">{["Unmatched Bank Transactions","Possible Duplicate Payments","Missing Evidence","Material Differences","Unresolved Advances","Uncertain AI Matches","Cost Overruns","Outstanding Payments"].map(item=><div key={item}><CheckCircle2/><span>{item}</span></div>)}</div></Panel></div>;
}

export default function ConstructionIntelligence(props: WorkspaceProps) {
  const route=constructionPrimaryRoute(props.route);
  if (route === "admin") return <section className="construction-intelligence construction-consolidated" aria-label="Construction settings">
    <SampleNotice/><Panel title="Construction Settings" description="Construction configuration is managed in Admin.">
      <p>Construction configuration is managed in the account administration workspace.</p>
      {canPage(props.person, "admin") && <Btn onClick={() => props.go("admin")}>Open Admin</Btn>}
    </Panel>
  </section>;
  if (!route) return <section className="construction-intelligence construction-consolidated" aria-label="Unavailable Construction destination">
    <SampleNotice/><Panel title="Destination Unavailable" description="This Construction destination is not recognized.">
      <p>No project or financial record was opened.</p>
    </Panel>
  </section>;
  let content: React.ReactNode;
  if(route==="construction-projects") content=<Projects detail={props.detail}/>;
  else if(route==="construction-costs-payments") content=<CostsPayments detail={props.detail}/>;
  else if(route==="construction-people-suppliers") content=<PeopleSuppliers detail={props.detail} person={props.person} go={props.go}/>;
  else if(route==="construction-reconciliation-alerts") content=<ReconciliationAlerts detail={props.detail}/>;
  else content=<Dashboard go={props.go}/>;
  return <section className="construction-intelligence construction-consolidated" data-construction-primary-route={route}><SampleNotice/><ConstructionNav route={route} go={props.go}/>{content}</section>;
}
