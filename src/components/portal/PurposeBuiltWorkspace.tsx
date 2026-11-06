"use client";

import { useId, useState } from "react";

import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  Layers3,
  ListTodo,
  Route,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import {
  type Persona,
  canPage,
  has,
  isOwnerPrincipal,
  type sampleNotifications,
  visiblePages,
} from "@/lib/portal-model";
import { buildFarmNavigation, navigationContext } from "@/lib/farm-navigation";
import ModuleOperationsPulse from "./ModuleOperationsPulse";
import commandJump from "./FarmCommandJump.module.css";

type Notice = (typeof sampleNotifications)[number];

const dedicatedRoutes = [
  "financial-reports",
  "financial-reporting",
  "roles",
  "performance-management",
  "reports-overview",
  "operational-reports",
  "production-reports",
  "administration-overview",
  "farm-settings",
  "ai-management",
] as const;

export const purposeBuiltRoutes: readonly string[] = dedicatedRoutes;

const workflowCopy: Record<string, {
  objective: string;
  steps: readonly string[];
  evidence: readonly string[];
}> = {
  "water-management": {
    objective: "Confirm water availability and record one complete water check.",
    steps: ["Choose house or flock", "Record quantity and quality", "Review exceptions before submission"],
    evidence: ["Source and meter", "Recorded time", "Quality or treatment note"],
  },
  medication: {
    objective: "Record medication administration with a traceable reason and dosage.",
    steps: ["Select flock and medication", "Confirm dosage and administrator", "Attach or reference supporting evidence"],
    evidence: ["Medication batch", "Dosage basis", "Withdrawal or follow-up date"],
  },
  mortality: {
    objective: "Capture mortality accurately and identify unusual patterns early.",
    steps: ["Select flock and date", "Enter count and likely cause", "Escalate when the expected range is exceeded"],
    evidence: ["Count and house", "Observation", "Escalation status"],
  },
  houses: {
    objective: "Review one house’s capacity, occupancy, readiness, and linked flock.",
    steps: ["Choose a house", "Review readiness and occupancy", "Open the linked batch when action is required"],
    evidence: ["Capacity", "Occupancy", "Last readiness check"],
  },
  "breed-management": {
    objective: "Maintain one authorized breed record and its production context.",
    steps: ["Choose or create breed", "Confirm production characteristics", "Review linked batches"],
    evidence: ["Breed identity", "Source", "Performance context"],
  },
  "flock-transfers": {
    objective: "Plan a controlled flock movement without losing count or approval evidence.",
    steps: ["Select origin and destination", "Confirm bird count and date", "Review and submit for approval"],
    evidence: ["Origin and destination", "Count reconciliation", "Approval trail"],
  },
  "production-analytics": {
    objective: "Understand one production question before opening deeper analysis.",
    steps: ["Choose flock and period", "Select production measure", "Compare trend and supporting records"],
    evidence: ["Selected period", "Source completeness", "Comparison basis"],
  },
  "feed-stock": {
    objective: "Review feed balance and address one stock exposure.",
    steps: ["Choose feed type", "Review receipts and consumption", "Resolve variance or reorder need"],
    evidence: ["Opening balance", "Movements", "Closing balance"],
  },
  "medication-stock": {
    objective: "Review available medication and act on one expiry or reorder exposure.",
    steps: ["Choose medication", "Review quantity and expiry", "Open the required stock action"],
    evidence: ["Batch number", "Expiry date", "Movement trail"],
  },
  equipment: {
    objective: "Confirm one equipment item is identified, assigned, and service-ready.",
    steps: ["Choose equipment", "Review condition and assignment", "Schedule or document required service"],
    evidence: ["Asset identity", "Condition", "Service evidence"],
  },
  "purchase-orders": {
    objective: "Prepare or review one purchase order with a clear approval trail.",
    steps: ["Choose supplier and items", "Review quantity and commercial terms", "Submit through the approval path"],
    evidence: ["Supplier quote", "Order value", "Approval status"],
  },
  revenue: {
    objective: "Review or record one revenue item with its source and payment evidence.",
    steps: ["Choose revenue source", "Confirm amount and date", "Link payment or supporting evidence"],
    evidence: ["Source", "Payment status", "Evidence reference"],
  },
  "financial-reports": {
    objective: "Open the right financial report for the question being answered.",
    steps: ["Choose report type", "Set reporting period", "Review assumptions and source completeness"],
    evidence: ["Reporting period", "Source status", "Export or review trail"],
  },
  "financial-reporting": {
    objective: "Review one financial reporting output without changing ledger records.",
    steps: ["Choose report and period", "Review source completeness", "Open the authorized export or review path"],
    evidence: ["Reporting period", "Ledger source status", "Review or export trail"],
  },
  roles: {
    objective: "Define one role’s responsibilities before assigning permissions.",
    steps: ["Choose role", "Review responsibilities", "Confirm separation from individual permission assignment"],
    evidence: ["Role purpose", "Responsibilities", "Review owner"],
  },
  "performance-management": {
    objective: "Review one performance cycle with clear goals and supporting evidence.",
    steps: ["Choose employee or team", "Review goals and progress", "Record the review outcome"],
    evidence: ["Goal period", "Progress evidence", "Review status"],
  },
  "operational-reports": {
    objective: "Generate one operational report without mixing record-entry tasks.",
    steps: ["Choose operation and period", "Apply farm or house scope", "Review completeness before export"],
    evidence: ["Scope", "Reporting period", "Source completeness"],
  },
  "production-reports": {
    objective: "Generate one production report for a clearly defined flock and period.",
    steps: ["Choose flock and report", "Set comparison period", "Review source and calculation notes"],
    evidence: ["Flock scope", "Comparison period", "Calculation basis"],
  },
  "farm-settings": {
    objective: "Change one post-login workspace setting with a clear explanation of its effect.",
    steps: ["Choose setting category", "Review current value and impact", "Save through the authorized configuration path"],
    evidence: ["Previous value", "New value", "Change audit"],
  },
  "ai-management": {
    objective: "Review one AI capability’s approved sources, human gate, and audit expectation.",
    steps: ["Choose AI capability", "Review permitted evidence sources", "Confirm approval and logging requirements"],
    evidence: ["Source policy", "Human review gate", "Audit status"],
  },
};

function DashboardCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string | number;
  detail: string;
  tone: "green" | "teal" | "violet" | "orange";
}) {
  return (
    <article className="purpose-dashboard-kpi" data-tone={tone}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function PurposeBuiltDashboard({
  person,
  go,
  notices,
}: {
  person: Persona;
  go: (route: string) => void;
  notices: Notice[];
}) {
  const allowed = visiblePages(person);
  const actionable = allowed.filter((page) => page.action && page.write && has(person, page.write));
  const unread = notices.filter((notice) => !notice.read);
  const connected = allowed.filter((page) => page.dataState === "live");
  const sections = buildFarmNavigation(allowed).filter((section) => section.id !== "extended-workspaces");

  return (
    <section className="purpose-dashboard" aria-label="Farm Overview">
      <div className="purpose-dashboard-kpis" aria-label="Key performance indicators">
        <DashboardCard title="Authorized workspaces" value={allowed.length} detail="Permission-filtered" tone="green" />
        <DashboardCard title="Connected workspaces" value={connected.length} detail="Verified live source" tone="teal" />
        <DashboardCard title="Unread notifications" value={unread.length} detail="Needs review" tone="violet" />
        <DashboardCard title="Available actions" value={actionable.length} detail="Within your role" tone="orange" />
      </div>

      <div className="purpose-dashboard-grid">
        <section className="purpose-dashboard-panel purpose-dashboard-alerts" aria-labelledby="dashboard-alerts">
          <header>
            <span><CircleAlert size={18} /></span>
            <div>
              <h2 id="dashboard-alerts">Alerts</h2>
              <p>Items that may need attention</p>
            </div>
          </header>
          <div className="purpose-dashboard-list">
            {unread.slice(0, 3).map((notice) => (
              <button key={notice.id} onClick={() => go(notice.page)}>
                <span>
                  <strong>{notice.title}</strong>
                  <small>{notice.detail}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!unread.length && <p className="purpose-dashboard-empty">No unread alerts in your authorized scope.</p>}
          </div>
        </section>

        <section className="purpose-dashboard-panel" aria-labelledby="dashboard-tasks">
          <header>
            <span><ListTodo size={18} /></span>
            <div>
              <h2 id="dashboard-tasks">Tasks</h2>
              <p>Role-authorized next actions</p>
            </div>
          </header>
          <div className="purpose-dashboard-list">
            {actionable.slice(0, 4).map((page) => (
              <button key={page.id} onClick={() => go(page.id)}>
                <span>
                  <strong>{page.action}</strong>
                  <small>{page.title}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!actionable.length && <p className="purpose-dashboard-empty">No writable tasks are available for this role.</p>}
          </div>
        </section>

        <section className="purpose-dashboard-panel" aria-labelledby="dashboard-notifications">
          <header>
            <span><Bell size={18} /></span>
            <div>
              <h2 id="dashboard-notifications">Notifications</h2>
              <p>Recent authorized updates</p>
            </div>
          </header>
          <div className="purpose-dashboard-list">
            {notices.slice(0, 4).map((notice) => (
              <button key={notice.id} onClick={() => go(notice.page)}>
                <span>
                  <strong>{notice.title}</strong>
                  <small>{notice.time} · {notice.priority}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </section>

        <section className="purpose-dashboard-panel purpose-dashboard-actions" aria-labelledby="dashboard-actions">
          <header>
            <span><Zap size={18} /></span>
            <div>
              <h2 id="dashboard-actions">Quick Actions</h2>
              <p>Open a focused workspace</p>
            </div>
          </header>
          <div className="purpose-dashboard-action-grid">
            {sections.flatMap((section) => section.modules).filter((module) => module.landingRoute !== "dashboard").slice(0, 6).map((module) => (
              <button key={module.id} onClick={() => go(module.landingRoute)}>
                <Layers3 size={17} />
                <span>{module.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="purpose-dashboard-panel purpose-dashboard-activity" aria-labelledby="dashboard-activity">
          <header>
            <span><Activity size={18} /></span>
            <div>
              <h2 id="dashboard-activity">Recent Activity</h2>
              <p>Truthful activity-source status</p>
            </div>
          </header>
          <div className="purpose-dashboard-activity-state">
            <SearchCheck size={22} />
            <div>
              <strong>Activity feed connection pending</strong>
              <p>No invented production activity is displayed. Open Audit Logs for available recorded evidence.</p>
            </div>
            {canPage(person, "audit") && <button onClick={() => go("audit")}>Open Audit Logs <ArrowRight size={15} /></button>}
          </div>
        </section>
      </div>
    </section>
  );
}

export default function PurposeBuiltWorkspace({
  route,
  person,
  go,
}: {
  route: string;
  person: Persona;
  go: (route: string) => void;
}) {
  const allowed = visiblePages(person);
  const page = allowed.find((candidate) => candidate.id === route);
  if (!page) return null;

  const context = navigationContext(route, allowed);
  const related = context.module?.pages.filter((candidate) => candidate.id !== route) || [];
  const copy = workflowCopy[route];
  const isOverview = ["flock-management", "people-overview", "reports-overview", "administration-overview"].includes(route);
  const sourceStatus = page.dataState === "live" ? "Connected live contract" : page.authority === "development" ? "Integration in progress" : "Contract pending";
  const authorizedPages = context.module?.pages || [page];
  const availableActions = authorizedPages.filter((candidate) => candidate.action && candidate.write && has(person, candidate.write));
  const connectedPages = authorizedPages.filter((candidate) => candidate.dataState === "live");
  const pendingPages = authorizedPages.filter((candidate) => candidate.dataState !== "live");
  const moduleSummary = {
    "flock-management": { heading: "Flock & House Command", guidance: "Track batches, houses, transfers and production exceptions from their authoritative records.", facts: ["Bird count requires a live flock ledger", "House occupancy requires verified placement records", "Mortality and production trends require dated observations"] },
    "people-overview": { heading: "People & Workforce Command", guidance: "Review employees, assigned responsibilities, performance and the approved payroll path.", facts: ["Headcount requires verified employee records", "Attendance and leave need authorized workforce sources", "Payroll figures are restricted until reconciled"] },
    "reports-overview": { heading: "Reports & Intelligence Command", guidance: "Find the right operational, production or financial reporting workspace.", facts: ["Reporting period and scope must be stated", "Exports require permission and provenance", "Missing source feeds must not appear as zero"] },
    "administration-overview": { heading: "Administration & Governance Command", guidance: "Locate configuration, access controls, audit trails and operational governance.", facts: ["Every permission is enforced at the server", "Configuration changes require an audit trail", "Security indicators require verified provider signals"] },
  }[route as "flock-management" | "people-overview" | "reports-overview" | "administration-overview"];

  return (
    <section className="purpose-workspace" aria-label={page.title}>
      <header className="purpose-workspace-brief">
        <div>
          <span className="purpose-workspace-eyebrow"><Target size={16} /> Single-purpose workspace</span>
          <h2>{copy?.objective || page.description}</h2>
          <p>{page.dna}</p>
        </div>
        <dl>
          <div><dt>Module</dt><dd>{context.module?.label || page.group}</dd></div>
          <div><dt>Source</dt><dd>{sourceStatus}</dd></div>
          <div><dt>Access</dt><dd>Permission filtered</dd></div>
        </dl>
      </header>

      {isOverview ? (
        <div className="purpose-module-command" aria-label={`${page.title} module dashboard`}>
          {moduleSummary && (
            <header className="purpose-module-command-heading">
              <span><Gauge size={18} aria-hidden="true" /> Module command centre</span>
              <h3>{moduleSummary.heading}</h3>
              <p>{moduleSummary.guidance}</p>
            </header>
          )}
          <div className="purpose-module-command-metrics" aria-label="Authorized module capability counts">
            <article data-tone="green"><small>Available workspaces</small><strong>{authorizedPages.length}</strong><span>Within your access scope</span></article>
            <article data-tone="teal"><small>Connected contracts</small><strong>{connectedPages.length}</strong><span>Integration metadata, not live totals</span></article>
            <article data-tone="violet"><small>Available record actions</small><strong>{availableActions.length}</strong><span>Permission-filtered entry points</span></article>
            <article data-tone="orange"><small>Contracts to verify</small><strong>{pendingPages.length}</strong><span>No invented operational figures</span></article>
          </div>
          <section className="purpose-module-command-readiness" aria-label="Operational data readiness">
            <div>
              <ShieldCheck size={18} aria-hidden="true" />
              <strong>Operational figures awaiting verified sources</strong>
              <p>These indicators describe available application capabilities only. No bird counts, naira totals, stock balances or employee headcounts are fabricated.</p>
            </div>
            {moduleSummary && <ul>{moduleSummary.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>}
          </section>
          {availableActions.length > 0 && (
            <nav className="purpose-module-command-actions" aria-label="Authorized module actions">
              <h4>Start a task</h4>
              <div>{availableActions.slice(0, 5).map((candidate) => (
                <button type="button" key={candidate.id} onClick={() => go(candidate.id)}>
                  <ArrowRight size={15} aria-hidden="true" /><span>{candidate.action}</span>
                </button>
              ))}</div>
            </nav>
          )}
        </div>
      ) : null}

      {isOverview && <ModuleOperationsPulse route={route} allowed={allowed} go={go} />}

      {isOverview ? (
        <section className="purpose-module-directory" aria-labelledby={`${route}-directory`}>
          <header>
            <h3 id={`${route}-directory`}>{context.module?.label || page.title} workspaces</h3>
            <p>Choose the dedicated page for the task you need to complete.</p>
          </header>
          <div>
            {related.map((candidate) => (
              <button key={candidate.id} onClick={() => go(candidate.id)}>
                <span className="purpose-module-icon"><Route size={18} /></span>
                <span>
                  <strong>{candidate.title}</strong>
                  <small>{candidate.description}</small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="purpose-workspace-layout">
          <section className="purpose-workflow" aria-labelledby={`${route}-workflow`}>
            <header>
              <span><ClipboardCheck size={19} /></span>
              <div>
                <h3 id={`${route}-workflow`}>Task path</h3>
                <p>Summary first, then the required workflow.</p>
              </div>
            </header>
            <ol>
              {(copy?.steps || ["Review current scope", "Open the required record", "Complete the authorized next step"]).map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <div><strong>{step}</strong><small>{index === 0 ? "Start here" : "Continue when ready"}</small></div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="purpose-evidence" aria-labelledby={`${route}-evidence`}>
            <header>
              <ShieldCheck size={19} />
              <h3 id={`${route}-evidence`}>Evidence required</h3>
            </header>
            <ul>
              {(copy?.evidence || ["Authorized scope", "Source record", "Review status"]).map((item) => (
                <li key={item}><CheckCircle2 size={16} /> {item}</li>
              ))}
            </ul>
            <p><Sparkles size={15} /> Automation may assist preparation; the authorized record and human review remain authoritative.</p>
          </aside>
        </div>
      )}

      {related.length > 0 && !isOverview && (
        <nav className="purpose-related" aria-label={`Related ${context.module?.label || page.group} pages`}>
          <span><Gauge size={17} /> Continue in {context.module?.label || page.group}</span>
          <div>
            {related.slice(0, 5).map((candidate) => (
              <button key={candidate.id} onClick={() => go(candidate.id)}>
                {candidate.title}<ArrowRight size={14} />
              </button>
            ))}
          </div>
        </nav>
      )}

      {isOwnerPrincipal(person) && page.authority !== "existing" && (
        <p className="purpose-contract-note">
          <CircleAlert size={16} />
          This dedicated page preserves the approved information architecture while its authoritative backend contract remains visibly incomplete.
        </p>
      )}
    </section>
  );
}

export function ModuleCommandSummary({ route, person, go }: {
  route: "operations" | "inventory" | "finance";
  person: Persona;
  go: (route: string) => void;
}) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const overviewId = useId();
  const canJumpToDaily = route === "operations" && person.principalSource === "authenticated" && person.restriction === "none" && person.farm && has(person,"farm.daily-report.view");
  const moveToDaily = () => {
    const target = document.getElementById("daily-flock-report-workspace");
    if (!target) return;
    target.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"start"});
    target.focus({preventScroll:true});
  };
  const allowed = visiblePages(person);
  const context = navigationContext(route, allowed);
  const modulePages = context.module?.pages || [];
  if (!modulePages.some((page) => page.id === route)) return null;
  const actionable = modulePages.filter((page) => page.action && page.write && has(person, page.write));
  const connected = modulePages.filter((page) => page.authority === "existing");
  const pending = modulePages.filter((page) => page.authority !== "existing");
  const descriptor = {
    operations: {
      title: "Farm Operations Command",
      intro: "Coordinate daily records, feed, water, medication, mortality and egg collection.",
      status: "Live bird counts and health totals require verified farm records.",
    },
    inventory: {
      title: "Inventory & Procurement Command",
      intro: "Review stock, equipment, medication, feed and authorized purchase orders.",
      status: "Available quantities and reorder exposure require an authoritative stock ledger.",
    },
    finance: {
      title: "Finance & Revenue Command",
      intro: "Open expenses, revenue, profit analysis and financial reporting in the approved scope.",
      status: "Naira balances, collections and outstanding amounts require reconciled accounting data.",
    },
  }[route];
  return (
    <section className="purpose-module-command purpose-module-command-compact" aria-label={`${descriptor.title} dashboard`}>
      <header className="purpose-module-command-heading">
        <span><Gauge size={18} aria-hidden="true" /> Module dashboard</span>
        <h2>{descriptor.title}</h2>
        <p>{descriptor.intro}</p>
        {canJumpToDaily && <button className={commandJump.jump} type="button" onClick={moveToDaily}><span><ClipboardCheck size={19} aria-hidden="true"/> Open Daily Flock Report</span><ArrowRight size={17} aria-hidden="true"/></button>}
      </header>
      {canJumpToDaily && <button className={commandJump.overviewToggle} type="button" aria-expanded={overviewOpen} aria-controls={overviewId} onClick={() => setOverviewOpen((open) => !open)}>{overviewOpen ? "Hide Operations Overview" : "Show Operations Overview"} <span aria-hidden="true">{overviewOpen ? "−" : "+"}</span></button>}
      <div id={overviewId} className={canJumpToDaily && !overviewOpen ? commandJump.overviewCollapsed : commandJump.overview}>
      <div className="purpose-module-command-metrics" aria-label="Module capability counts">
        <article data-tone="green"><small>Authorized workspaces</small><strong>{modulePages.length}</strong><span>Accessible to your role</span></article>
        <article data-tone="teal"><small>Existing contracts</small><strong>{connected.length}</strong><span>Source classifications only</span></article>
        <article data-tone="violet"><small>Available actions</small><strong>{actionable.length}</strong><span>Permission-filtered entries</span></article>
        <article data-tone="orange"><small>Integration to confirm</small><strong>{pending.length}</strong><span>Not represented as live data</span></article>
      </div>
      <div className="purpose-module-command-status">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>{descriptor.status} Existing functional workspaces below remain available.</p>
      </div>
      <ModuleOperationsPulse route={route} allowed={allowed} go={go} />
      <nav className="purpose-module-command-links" aria-label={`${descriptor.title} workspaces`}>
        {modulePages.filter((page) => page.id !== route).slice(0, 8).map((page) => (
          <button type="button" key={page.id} onClick={() => go(page.id)}>
            <span>{page.title}</span><ArrowRight size={15} aria-hidden="true" />
          </button>
        ))}
      </nav>
      {canJumpToDaily && <button className={commandJump.continueDaily} type="button" onClick={moveToDaily}>Continue To Daily Flock Report <ArrowRight size={17} aria-hidden="true"/></button>}
      </div>
    </section>
  );
}
