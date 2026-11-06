"use client";

import {ArrowUpRight,ChartNoAxesCombined,CircleAlert,Clock3,Info,ShieldCheck} from "lucide-react";
import {canPage} from "@/lib/portal-model";
import type {WorkspaceProps} from "./PortalExperience";
import styles from "./FarmProfitabilityPendingView.module.css";

const financialMeasures=[
  {
    label:"Farm Sales",
    note:"Confirmed external sales must be matched to the approved farm and period.",
    accent:"sales",
  },
  {
    label:"Total Business Costs",
    note:"Production costs and running expenses must be verified and allocated once.",
    accent:"costs",
  },
  {
    label:"Operating Profit",
    note:"Sales less matched production costs and farm running expenses.",
    accent:"profit",
  },
  {
    label:"Cash Available",
    note:"Only reconciled cash and bank records can establish available money.",
    accent:"cash",
  },
] as const;

const sourceChecks=[
  {
    title:"Sales & Money Owed",
    detail:"Eggs, birds, livestock, feed and other sales, including payments still outstanding.",
  },
  {
    title:"Production Costs",
    detail:"Chicks, feed consumed, medicines, vaccines, livestock care and other direct costs.",
  },
  {
    title:"Farm Running Expenses",
    detail:"Staff wages, fuel, electricity, repairs, transport, security and shared overhead.",
  },
  {
    title:"Cash & Bank Evidence",
    detail:"Money actually received and paid. Profit is not the same as bank balance.",
  },
] as const;

/**
 * FarmPortal pre-production truth-in-data fallback (Issue #110).
 * No sample income, fictional forecast or made-up cost values are allowed
 * on the real Profitability route. This component does not query, write or
 * calculate accounting data. Rich charts return only with an authorised
 * source-complete Finance report and proper role/period reconciliation.
 */
export default function FarmProfitabilityPendingView({
  person,go,
}:{
  person:WorkspaceProps["person"];
  go:WorkspaceProps["go"];
}){
  const viewRevenue=canPage(person,"revenue");
  const viewExpenses=canPage(person,"expenses");
  return <section className={styles.root} aria-labelledby="farm-profit-pending-title">
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}><ChartNoAxesCombined size={17}/> FARM INTELLIGENCE</span>
        <h2 id="farm-profit-pending-title">Farm Profit &amp; Cash</h2>
        <p>Understand what the farm earns, what it spends and how much money is truly available.</p>
      </div>
      <span className={styles.sourceBadge}>
        <Clock3 size={17} aria-hidden="true"/> Awaiting Verified Financial Records
      </span>
    </header>

    <div className={styles.notice} role="status" aria-live="polite">
      <CircleAlert size={23} aria-hidden="true"/>
      <div>
        <strong>Financial Figures Not Yet Verified</strong>
        <p>A complete, approved Profit &amp; Cash report is not yet connected for this farm and reporting period.
          We will not use sample sales, expenses, profits or forecasts as recorded business results.</p>
      </div>
    </div>

    <div className={styles.kpis} aria-label="Financial measures awaiting approved records">
      {financialMeasures.map(measure=><article key={measure.label}
        className={styles.kpi+" "+styles[measure.accent]}>
        <span>{measure.label}</span>
        <strong aria-label={measure.label+": not yet verified"}>—</strong>
        <p>{measure.note}</p>
        <small><ShieldCheck size={14} aria-hidden="true"/> Source Verification Required</small>
      </article>)}
    </div>

    <div className={styles.sections}>
      <article className={styles.panel}>
        <div className={styles.panelHeading}>
          <span className={styles.iconCircle}><Info size={20} aria-hidden="true"/></span>
          <div><h3>Check Your Actual Farm Records</h3>
            <p>Use the existing authorised registers. The lists may be empty for your account or farm.</p>
          </div>
        </div>
        <div className={styles.actions}>
          {viewRevenue&&<button type="button" onClick={()=>go("revenue")}>
            Open Revenue Records <ArrowUpRight size={17} aria-hidden="true"/>
          </button>}
          {viewExpenses&&<button type="button" onClick={()=>go("expenses")}>
            Open Expense Records <ArrowUpRight size={17} aria-hidden="true"/>
          </button>}
          {!viewRevenue&&!viewExpenses&&<p>Finance record access is not available to this role.</p>}
        </div>
        <p className={styles.note}>A visible register or a confirmed sale is not proof of payment received.
          A posted expense is not automatically the production cost of goods sold.</p>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeading}>
          <span className={styles.iconCircle}><ShieldCheck size={20} aria-hidden="true"/></span>
          <div><h3>What We Need Before Showing Profit</h3>
            <p>Only approved source records should produce financial totals or upward/downward trends.</p>
          </div>
        </div>
        <div className={styles.checks}>
          {sourceChecks.map(item=><div key={item.title} className={styles.check}>
            <span className={styles.checkMarker}><Clock3 size={16} aria-hidden="true"/></span>
            <div><strong>{item.title}</strong><p>{item.detail}</p></div>
          </div>)}
        </div>
      </article>
    </div>

    <details className={styles.explainer}>
      <summary>How Will Farm Profit Be Calculated?</summary>
      <div className={styles.explainerBody}>
        <p><strong>Gross Profit</strong> = Sales minus the verified production cost of what was sold.</p>
        <p><strong>Operating Profit</strong> = Gross Profit minus farm running expenses and properly shared overhead.</p>
        <p><strong>Net Profit</strong> = Profit after applicable financing costs, tax and other reconciled items.</p>
        <p><strong>Cash Available</strong> comes from actual reconciled cash and bank records — not unpaid invoices.</p>
        <p>These rules apply across poultry, pigs, goats, snails, feed manufacturing and organic products,
          with each enterprise, flock, herd or production batch accounted for only once.</p>
      </div>
    </details>
    <footer className={styles.footer}>
      All amounts will be displayed in Nigerian Naira (₦), using Nigeria Time (WAT).
      Forecasts will be identified as planning scenarios, never as recorded income.
    </footer>
  </section>;
}
