"use client";

import React, { useMemo, useState } from "react";
import {
  BadgeCheck,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Building2,
  FileClock,
  Landmark,
  LockKeyhole,
  Network,
  TriangleAlert,
  Webhook,
} from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { has } from "@/lib/portal-model";
import { Btn, Chip, DataTable, Panel, Timeline } from "./Common";
import EnterpriseDataGrid from "./EnterpriseDataGrid";

const bankCandidates = [
  "Kuda Business",
  "Providus",
  "Wema",
  "Sterling",
  "Access",
  "GTBank",
  "FirstBank",
  "Zenith",
  "UBA",
  "Fidelity",
  "FCMB",
  "Keystone",
  "Union Bank",
] as const;
const aggregationCandidates = ["Mono", "Okra", "OnePipe", "Stitch"] as const;
const paymentCandidates = [
  "Paystack",
  "Flutterwave",
  "Monnify",
  "Squad",
  "Interswitch",
] as const;

const tabDefinitions = [
  ["overview", "Treasury", "banking.accounts.view"],
  ["accounts", "Accounts", "banking.accounts.view"],
  ["collections", "Collections", "banking.collections.view"],
  ["transfers", "Transfers", "banking.transfers.view"],
  ["reconcile", "Reconciliation", "banking.reconcile.view"],
  ["payroll", "Payroll Banking", "banking.payroll.view"],
  ["providers", "Provider Registry", "banking.providers.view"],
  ["audit", "Banking Audit", "banking.audit.view"],
] as const;

type TreasuryTab = (typeof tabDefinitions)[number][0];

const financialSummary = [
  ["Total Balance", "banking.accounts.view"],
  ["Available Cash", "banking.accounts.view"],
  ["Revenue Today", "banking.collections.view"],
  ["Revenue This Month", "banking.collections.view"],
  ["Payroll This Month", "banking.payroll.view"],
  ["Expenses This Month", "finance.view"],
  ["Accounts Receivable", "finance.view"],
  ["Accounts Payable", "finance.view"],
] as const;

const payrollSummary = [
  "Payroll Due This Month",
  "Payroll Sent",
  "Payroll Processing",
  "Payroll Failed",
  "Employee Count",
  "Monthly Payroll Cost",
] as const;

function UnavailableMetric({ label, value }: { label: string; value?: string }) {
  return (
    <article className="treasury-metric">
      <span>{label}</span>
      <strong>{value || "Unavailable"}</strong>
      <small>{value ? "SAMPLE / DESIGN DATA" : "Awaiting authoritative data"}</small>
    </article>
  );
}

function NoDataChart({ title, cadence, fixture=false }: { title: string; cadence: string; fixture?: boolean }) {
  return (
    <figure className="treasury-chart" aria-label={`${title}: no authoritative data`}>
      <figcaption>
        <strong>{title}</strong>
        <small>{cadence}</small>
      </figcaption>
      <div className="treasury-chart-grid" aria-hidden="true">
        <i style={fixture?{height:"42%"}:undefined}/><i style={fixture?{height:"68%"}:undefined}/><i style={fixture?{height:"54%"}:undefined}/><i style={fixture?{height:"82%"}:undefined}/><i style={fixture?{height:"63%"}:undefined}/>
      </div>
      <p>{fixture?"SAMPLE / DESIGN DATA · fictional trend":"No connected source · chart architecture ready"}</p>
    </figure>
  );
}

export function PayrollCommandCenter({ person, fixture=false }:{person:Persona;fixture?:boolean}) {
  const values=["₦1.80m","₦1.36m","₦270k","₦170k","12","₦1.80m"];
  return (
    <section className="payroll-command stack" data-zero-click="payroll-overview" aria-label="Payroll command center">
      <header className="payroll-command-head">
        <div>
          <span className="eyebrow">PAYROLL COMMAND CENTER · ZERO-CLICK</span>
          <h2>Every Salary Outcome Remains Visible Until Reconciled.</h2>
          <p>DESIGN FIXTURE · No employee bank details or company payroll values are loaded.</p>
        </div>
        <Chip tone="amber">{fixture?"SAMPLE / DESIGN DATA":"BACKEND REQUIRED"}</Chip>
      </header>
      <div className="treasury-metric-grid" data-zero-click="payroll-summary">
        {payrollSummary.map((label,index) => <UnavailableMetric key={label} label={label} value={fixture?values[index]:undefined} />)}
      </div>
      <section className="treasury-terminal" data-zero-click="salary-monitor">
          <header><div><span className="eyebrow">SALARY PROCESSING MONITOR</span><h3>{fixture?"Fictional batch outcomes":"No payroll batch submitted"}</h3></div><Chip tone="gray">{fixture?"SAMPLE / DESIGN DATA":"NO PROVIDER CONNECTED"}</Chip></header>
        <EnterpriseDataGrid id="salary-processing" title="Salary outcomes" description="Authorized payroll processing state; no company payroll records." person={person} exportPermission="banking.payroll.view" columns={[{id:"employee",label:"Employee",pinned:true},{id:"department",label:"Department"},{id:"salary",label:"Salary"},{id:"bank",label:"Bank"},{id:"status",label:"Transfer status"},{id:"submitted",label:"Submitted"},{id:"confirmed",label:"Confirmed"},{id:"reference",label:"Reference"}]} rows={fixture?[{employee:"Sample Employee A",department:"Farm Operations",salary:"₦180,000 · SAMPLE",bank:"Fictional Bank A",status:<Chip>Successful · fixture</Chip>,submitted:"10:02 · sample",confirmed:"10:04 · sample",reference:"PAY-S-01"},{employee:"Sample Employee B",department:"Inventory",salary:"₦150,000 · SAMPLE",bank:"Fictional Bank B",status:<Chip tone="amber">Awaiting confirmation</Chip>,submitted:"10:03 · sample",confirmed:"—",reference:"PAY-S-02"}]:[{employee:"No authorized batch",department:"—",salary:"Unavailable",bank:"—",status:"Awaiting confirmation",submitted:"—",confirmed:"—",reference:"—"}]}/>
      </section>
      <section className="treasury-chart-wall" data-zero-click="payroll-charts" aria-label="Payroll charts">
        <NoDataChart title="Salary payments by month" cadence="Monthly" fixture={fixture}/>
        <NoDataChart title="Payroll cost by department" cadence="Department" fixture={fixture}/>
        <NoDataChart title="Payroll cost by business unit" cadence="Business unit / branch" fixture={fixture}/>
        <NoDataChart title="Payroll cost by year" cadence="Annual" fixture={fixture}/>
        <NoDataChart title="Payroll vs revenue" cadence="Comparison" fixture={fixture}/>
        <NoDataChart title="Payroll trend analysis" cadence="Trend" fixture={fixture}/>
      </section>
      <section className="treasury-terminal" data-zero-click="payroll-report">
        <header><div><span className="eyebrow">PAYROLL REPORT</span><h3>Authorized monthly outcomes</h3></div><div className="row wrap"><Btn small>Excel · Sample</Btn><Btn small>CSV · Sample</Btn><Btn small>PDF · Sample</Btn><Btn small>Print · Sample</Btn></div></header>
        <EnterpriseDataGrid id="payroll-report" title="Monthly payroll report" description="Authorized sample report; exports are explicitly fictional." person={person} exportPermission="banking.payroll.view" columns={[{id:"month",label:"Month",pinned:true},{id:"staff",label:"Total staff"},{id:"paid",label:"Amount paid"},{id:"successful",label:"Successful"},{id:"failed",label:"Failed"},{id:"pending",label:"Pending"}]} rows={fixture?[{month:"September 2026 · sample",staff:"12",paid:"₦1.36m · SAMPLE",successful:"8",failed:"1",pending:"3"}]:[{month:"No reporting period",staff:"—",paid:"Unavailable",successful:"—",failed:"—",pending:"—"}]}/>
      </section>
    </section>
  );
}

export default function TreasuryDesk({ person }: { person: Persona }) {
  const allowedTabs = useMemo(
    () => tabDefinitions.filter(([, , permission]) => has(person, permission)),
    [person],
  );
  const [view, setView] = useState<TreasuryTab>(allowedTabs[0]?.[0] || "overview");
  const [match, setMatch] = useState<
    "UNMATCHED" | "PARTIAL" | "EXACT" | "OVERPAYMENT" | "DUPLICATE" | "REVERSED" | "REFUNDED"
  >("UNMATCHED");
  const [transferStage, setTransferStage] = useState(0);
  const [notice, setNotice] = useState("");
  const [fixture, setFixture] = useState(false);

  if (!allowedTabs.length) return null;
  if (!allowedTabs.some(([id]) => id === view)) setView(allowedTabs[0][0]);

  return (
    <section className="treasury-desk stack" aria-label="Banking and treasury control center">
      <div className="treasury-hero">
        <div>
          <span className="eyebrow">TREASURY COMMAND CENTER</span>
          <h2>Money movement begins with evidence.</h2>
          <p>
            SAMPLE / PROVIDERS NOT CONNECTED · No accounts, balances, transfers,
            bank files, credentials, payment links or webhook events exist in this review.
          </p>
        </div>
        <Landmark size={44} />
      </div>

      <div className="treasury-tabs" role="tablist" aria-label="Authorized treasury tools">
        {allowedTabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="treasury-fixture-switch" role="group" aria-label="Treasury review data mode"><span>Review data mode</span><button aria-pressed={!fixture} onClick={()=>setFixture(false)}>Safe disconnected</button><button aria-pressed={fixture} onClick={()=>setFixture(true)}>Sample data-rich fixture</button><Chip tone={fixture?"amber":"gray"}>{fixture?"SAMPLE / DESIGN DATA":"NO PROVIDER CONNECTED"}</Chip></div>
      {notice && <p className="cc-notice" role="status">{notice}</p>}

      {view === "overview" && (
        <div className="treasury-command stack" data-zero-click="treasury-overview">
          <section className="treasury-section" data-zero-click="financial-summary" aria-label="Financial summary">
            <header><div><span className="eyebrow">FINANCIAL SUMMARY</span><h2>Authorized Cash Position</h2></div><Chip tone="gray">AWAITING AUTHORITATIVE DATA</Chip></header>
            <div className="treasury-metric-grid">{financialSummary.filter(([,permission])=>has(person,permission)).map(([label],index)=><UnavailableMetric key={label} label={label} value={fixture?["₦5.84m","₦4.92m","₦560k","₦3.48m","₦1.80m","₦1.14m","₦2.10m","₦890k"][index]:undefined}/>)}</div>
          </section>

          <section className="treasury-situation">
            <span className="eyebrow">Executive Financial Pulse · First View</span>
            <strong>No Authoritative Bank Data</strong>
            <p>Values appear only after server authorization and account-scope filtering.</p>
            <div><span><Building2 /> Accounts <b>Unconnected</b></span><span><BanknoteArrowDown /> Collections <b>Unavailable</b></span><span><BanknoteArrowUp /> Payouts <b>Blocked</b></span></div>
          </section>

          {(has(person,"banking.collections.view") || has(person,"banking.transfers.view") || has(person,"banking.reconcile.view")) && <section className="treasury-terminal" data-zero-click="banking-activity" aria-label="Banking activity monitor">
            <header><div><span className="eyebrow">BANKING ACTIVITY MONITOR</span><h2>{fixture?"Fictional transaction density":"NO PROVIDER CONNECTED"}</h2></div><Chip tone="amber">{fixture?"SAMPLE / DESIGN DATA":"NO AUTHORITATIVE FEED"}</Chip></header>
            <div className="banking-activity-grid">
              {["Incoming Transactions","Outgoing Transactions","Pending","Failed","Refunded","Reversed"].map((label,index)=><article key={label}><span>{label}</span><strong>{fixture?["18","11","3","1","1","0"][index]:"—"}</strong><small>{fixture?"Fictional Event Count":"No Authoritative Events"}</small></article>)}
            </div>
            <EnterpriseDataGrid id="banking-transactions" title="Banking transactions" description="Provider-neutral normalized transaction design; never payment proof." person={person} exportPermission="banking.audit.view" columns={[{id:"reference",label:"Reference",pinned:true},{id:"direction",label:"Direction"},{id:"account",label:"Authorized account"},{id:"amount",label:"Amount"},{id:"state",label:"Provider state"},{id:"match",label:"Reconciliation"},{id:"freshness",label:"Freshness"}]} rows={fixture?[{reference:"BNK-S-101",direction:"Incoming",account:"Collections · ••4821",amount:"₦560,000 · SAMPLE",state:<Chip>Provider fixture</Chip>,match:"EXACT · review",freshness:"11 Sep · sample"},{reference:"BNK-S-102",direction:"Outgoing",account:"Operations · ••1098",amount:"₦210,000 · SAMPLE",state:<Chip tone="amber">Awaiting confirmation</Chip>,match:"PARTIAL",freshness:"11 Sep · sample"}]:[]}/>
          </section>}

          <section className="treasury-section" data-zero-click="cash-flow" aria-label="Cash flow analytics">
            <header><div><span className="eyebrow">CASH FLOW ANALYTICS</span><h2>Trend surfaces remain visible in no-data state.</h2></div><Chip tone="gray">NO CONNECTED SOURCE</Chip></header>
            <div className="treasury-chart-wall"><NoDataChart title="Daily cash flow" cadence="Daily" fixture={fixture}/><NoDataChart title="Weekly cash flow" cadence="Weekly" fixture={fixture}/><NoDataChart title="Monthly cash flow" cadence="Monthly" fixture={fixture}/><NoDataChart title="Revenue trend" cadence="Period comparison" fixture={fixture}/><NoDataChart title="Expense trend" cadence="Period comparison" fixture={fixture}/></div>
          </section>

          {has(person,"banking.accounts.view") && <section className="treasury-terminal" data-zero-click="account-monitor" aria-label="Bank account monitor">
            <header><div><span className="eyebrow">BANK ACCOUNT MONITOR</span><h2>No connected bank accounts</h2></div><Chip tone="amber">PROVIDER SETUP REQUIRED</Chip></header>
            <EnterpriseDataGrid id="bank-account-monitor" title="Authorized account monitor" description="Masked account-scoped architecture; provider connection is not implied." person={person} exportPermission="banking.accounts.view" columns={[{id:"bank",label:"Bank",pinned:true},{id:"nickname",label:"Account nickname"},{id:"masked",label:"Masked identifier"},{id:"status",label:"Status"},{id:"balance",label:"Balance"},{id:"available",label:"Available"},{id:"incoming",label:"Incoming today"},{id:"outgoing",label:"Outgoing today"},{id:"sync",label:"Last sync"}]} rows={fixture?[{bank:"Fictional Bank A",nickname:"Collections",masked:"•••• 4821",status:<Chip>DESIGN DATA</Chip>,balance:"₦3.24m · SAMPLE",available:"₦3.02m · SAMPLE",incoming:"₦560k · SAMPLE",outgoing:"₦120k · SAMPLE",sync:"Fixture timestamp"},{bank:"Fictional Bank B",nickname:"Operations",masked:"•••• 1098",status:<Chip tone="amber">Connection demo</Chip>,balance:"₦2.60m · SAMPLE",available:"₦1.90m · SAMPLE",incoming:"₦0 · SAMPLE",outgoing:"₦210k · SAMPLE",sync:"Fixture timestamp"}]:[]}/>
          </section>}

          <section className="transaction-center" data-zero-click="transaction-center" aria-label="Transaction center">
            <header><span className="eyebrow">TRANSACTION CENTER</span><h2>Incoming and outgoing money</h2><p>Rendered for situational awareness; all values await authoritative finance services.</p></header>
            <div>{[{title:"INCOMING MONEY",items:["Payments Today","Payments This Week","Payments This Month","Collection Rate","Outstanding Invoices"]},{title:"OUTGOING MONEY",items:["Supplier Payments","Salary Payments","Expense Payments","Transfer Requests","Scheduled Payments"]}].map(group=><section key={group.title}><h3>{group.title}</h3>{group.items.map(label=><span key={label}><b>{label}</b><em>Unavailable</em></span>)}</section>)}</div>
          </section>

          {has(person,"banking.payroll.view") && (
            <PayrollCommandCenter person={person} fixture={fixture}/>
          )}

          <Panel title="Decision boundary" description="A review surface cannot prove money moved."><Timeline items={[{ time: "Evidence", title: "Resolve an authorized source", description: "Account, statement, provider event and customer scope must come from the backend." },{ time: "Control", title: "Apply maker-checker", description: "The maker cannot approve their own transfer, allocation or adjustment." },{ time: "Result", title: "Wait for provider and ledger authority", description: "Submission, delivery and frontend success are never payment proof." }]}/></Panel>
        </div>
      )}

      {view === "accounts" && (
        <div className="treasury-grid">
          <Panel title="Connected-account observatory" description="Masked identity, ownership, currency, lifecycle and statement coverage.">
            <div className="treasury-empty">
              <Building2 size={28} />
              <strong>No connected bank accounts</strong>
              <p>
                Account discovery requires explicit consent, encrypted backend storage,
                scoped access, verification and a revocation audit.
              </p>
              <Chip tone="amber">BACKEND REQUIRED</Chip>
            </div>
            <Btn onClick={() => setNotice("Account connection remains blocked until an administrator selects and verifies a provider contract.")}>Preview connection policy</Btn>
          </Panel>
          <Panel title="Account relationship model">
            <DataTable
              headers={["Field", "Review rule"]}
              rows={[
                ["Account identity", "Masked; never expose credentials"],
                ["Balance", "Provider timestamp + currency required"],
                ["Statement", "Immutable source reference required"],
                ["Beneficiary", "Independent verification required"],
                ["Visibility", "Account + legal-entity + business-unit scope"],
              ]}
            />
          </Panel>
        </div>
      )}

      {view === "collections" && (
        <div className="collection-control">
          <section>
            <span className="eyebrow">COLLECTION REFERENCE</span>
            <h2>Resolve the obligation before opening a channel.</h2>
            <div className="collection-reference">
              <strong>COL-SAMPLE-001</strong>
              <small>Fictional reference · no amount</small>
              <Chip tone="gray">NOT CREATED</Chip>
            </div>
          </section>
          <Timeline
            items={[
              { time: "01", title: "Validate customer / invoice scope", description: "The current user and recipient must be entitled to the same authoritative obligation." },
              { time: "02", title: "Create server-side reference", description: "Amount, currency, expiry and permitted channel are signed on the backend." },
              { time: "03", title: "Open hosted collection path", description: "Provider tokenization and consent occur outside the review UI." },
              { time: "04", title: "Verify callback", description: "Signature, amount, currency, reference, replay and provider status are checked." },
              { time: "05", title: "Reconcile and communicate", description: "Allocation, receipt, customer balance, communication and audit follow authoritative posting." },
            ]}
          />
        </div>
      )}

      {view === "transfers" && (
        <div className="transfer-workbench">
          <section className="transfer-rail" aria-label="Sample transfer approval stages">
            {["Draft", "Maker review", "Independent checker", "Queued", "Provider result", "Reconciled"].map((stage, index) => (
              <button
                key={stage}
                aria-current={transferStage === index ? "step" : undefined}
                onClick={() => setTransferStage(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage}</strong>
              </button>
            ))}
          </section>
          <Panel title="Transfer request inspector" description="No bank detail or payment instruction is stored here.">
            <p>
              Selected stage: <strong>{["Draft", "Maker review", "Independent checker", "Queued", "Provider result", "Reconciled"][transferStage]}</strong>
            </p>
            <div className="blocked-boundary">
              <LockKeyhole />
              <div>
                <strong>Submission remains blocked</strong>
                <p>Beneficiary validation, amount limits, reason, evidence, checker identity, idempotency and provider configuration are absent.</p>
              </div>
            </div>
            <Btn onClick={() => setNotice("Blocked safely: the review Site cannot create or authorize a transfer.")}>Test blocked action</Btn>
          </Panel>
        </div>
      )}

      {view === "reconcile" && (
        <div className="reconcile-lab">
          <section className="match-selector">
            <span className="eyebrow">PAYMENT MATCH LAB · DESIGN FIXTURE</span>
            <h2>{match}</h2>
            <p>No statement or ledger transaction is loaded. Select a state to inspect its control language.</p>
            <div>
              {(["UNMATCHED", "PARTIAL", "EXACT", "OVERPAYMENT", "DUPLICATE", "REVERSED", "REFUNDED"] as const).map((state) => (
                <button key={state} aria-pressed={match === state} onClick={() => setMatch(state)}>{state}</button>
              ))}
            </div>
          </section>
          <Panel title="Server reconciliation pipeline">
            <div className="reconcile-pipeline">
              {["Provider event", "Signature + replay guard", "Normalized transaction", "Customer / reference match", "ERP allocation", "Receipt + communication", "Immutable audit"].map((step, index) => (
                <div key={step}><span>{index + 1}</span><strong>{step}</strong></div>
              ))}
            </div>
            <p className="form-note">Only a verified backend event may advance this pipeline. An EXACT visual state is not posting authority.</p>
          </Panel>
        </div>
      )}

      {view === "payroll" && (
        <PayrollCommandCenter person={person} fixture={fixture}/>
      )}

      {view === "providers" && (
        <div className="provider-registry">
          <ProviderGroup title="Candidate banks" icon={<BadgeCheck />} names={bankCandidates} />
          <ProviderGroup title="Open-banking candidates" icon={<Webhook />} names={aggregationCandidates} />
          <ProviderGroup title="Payment candidates" icon={<Network />} names={paymentCandidates} />
          <div className="blocked-boundary"><TriangleAlert /><div><strong>Capability verification required</strong><p>Names are retained only as candidates. Coverage, pricing, account type, transfer, webhook, settlement and regulatory claims require current official provider documentation and Owner approval.</p></div></div>
        </div>
      )}

      {view === "audit" && (
        <div className="treasury-audit">
          <section><FileClock size={34} /><h2>No banking audit events</h2><p>The review Site has not requested or moved money.</p></section>
          <Panel title="Required immutable context">
            <DataTable
              headers={["Event", "Required evidence"]}
              rows={[
                ["Account access", "Actor, role, scope, purpose, timestamp"],
                ["Transfer request", "Maker, beneficiary hash, amount, reason, evidence"],
                ["Approval", "Independent checker, decision, limits, policy version"],
                ["Provider result", "Provider event ID, signature result, raw status reference"],
                ["Reconciliation", "Match state, allocation, exception and final ledger reference"],
                ["Retry / reversal", "Idempotency key, original event and outcome"],
              ]}
            />
          </Panel>
        </div>
      )}
    </section>
  );
}

function ProviderGroup({
  title,
  icon,
  names,
}: {
  title: string;
  icon: React.ReactNode;
  names: readonly string[];
}) {
  return (
    <Panel title={title} description="VERIFICATION REQUIRED · not configured">
      <div className="provider-grid">
        {names.map((name) => (
          <span key={name}>
            {icon}
            {name}
            <small>Verification required</small>
          </span>
        ))}
      </div>
    </Panel>
  );
}
