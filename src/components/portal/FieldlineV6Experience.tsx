"use client";

import { useId, useMemo, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, BellRing,
  Bird, CalendarDays, CheckCheck, ChevronRight, CircleAlert,
  ClipboardCheck, CloudSun, Coins, DatabaseZap, FileCheck2, Gauge, HeartPulse,
  Layers3, LockKeyhole, MessageCircle, RadioTower, ScanLine, ShieldAlert,
  ShieldCheck, Sprout, TrendingUp, Wheat, Zap,
} from "lucide-react";
import { fieldlineView } from "@/lib/stage24-fieldline-rbac";
import type { Authority, MissionData } from "@/lib/stage24-fieldline-rbac";
import type { FieldlineHistoryDay } from "@/lib/stage24-fieldline-history";
import "./FieldlineV6Experience.css";

export type FieldlineEntryRoute = "feed" | "mortality" | "medication" | "vaccinations" | "reconciliation";
type MetricSource = "mortality" | "feed" | "medication" | "vaccinations";
type Page = "reports" | "review" | "finance" | "audit" | FieldlineEntryRoute;
type Props = Readonly<{
  authority: Authority;
  source: MissionData | null;
  historyDays?: readonly FieldlineHistoryDay[];
  canReview?: boolean;
  quickActions?: readonly FieldlineEntryRoute[];
  onNavigate?: (page: Page) => void;
}>;

const display = (value?: number, suffix = "") =>
  value !== undefined && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 }).format(value) + suffix
    : "Not Confirmed";
const proven = (value?: number) =>
  value !== undefined && Number.isFinite(value) && value >= 0;
const ordinal = (value: number) => String(value).padStart(2, "0");
const sourceStates = {
  approved: {
    label: "Source Approved",
    title: "An Approved Source. Not Yet A Certified Stock Balance.",
    text: "Continue Evidence And Stock Reconciliation Before Making A Final Operational Decision.",
    tone: "ready",
  },
  missing: {
    label: "Evidence Missing",
    title: "A Decision Is Waiting On Evidence.",
    text: "The Selected Day Does Not Have An Approved Source. Resolve The Record Before Certification.",
    tone: "attention",
  },
  "source-conflict": {
    label: "Source Conflict",
    title: "The Source Requires Independent Review.",
    text: "Contradictory Evidence Must Be Resolved Before Any Stock Or Performance Conclusion.",
    tone: "critical",
  },
  unavailable: {
    label: "Source Unconfirmed",
    title: "Today's Source Is Not Yet Confirmed.",
    text: "The Report Reader Has Not Established An Approved Projection For The Selected Local Day.",
    tone: "unavailable",
  },
} as const;
type Question = "priority" | "mortality" | "feed" | "sell" | null;
const commandCatalog = [
  {route:"feed",label:"Feed Operations",detail:"Consumption & Stock",icon:Wheat},
  {route:"mortality",label:"Mortality Register",detail:"Incidents & Records",icon:HeartPulse},
  {route:"medication",label:"Medication Ledger",detail:"Treatment Evidence",icon:ShieldCheck},
  {route:"vaccinations",label:"Vaccination Register",detail:"Schedules & Events",icon:Sprout},
  {route:"reconciliation",label:"Stock Reconciliation",detail:"Physical Count & Proof",icon:ScanLine},
] as const satisfies readonly {route:FieldlineEntryRoute;label:string;detail:string;icon:typeof Bird}[];


function MetricCard({ label, value, note, icon: Icon, index, state = "recorded", sourceIds = [], sourceRoute, onNavigate }: {
  label: string; value: string; note: string; icon: typeof Bird; index: number; state?: "recorded" | "missing"; sourceIds?: readonly string[]; sourceRoute?: FieldlineEntryRoute; onNavigate?: Props["onNavigate"];
}) {
  return <article className={"f6-metric f6-metric-" + state} style={{animationDelay: (index * 45) + "ms"}}>
    <div className="f6-metric-top"><span className="f6-metric-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true"/></span><span className="f6-metric-origin">LOCAL DAY / WAT</span></div>
    <span className="f6-metric-name">{label}</span><strong>{value}</strong>
    <small>{note}</small>{sourceIds.length>0 && sourceRoute && onNavigate && <details className="f6-metric-sources"><summary>{sourceIds.length} Verified Source{sourceIds.length===1?"":"s"}</summary><ul>{sourceIds.map(id=><li key={id}><code>{id}</code></li>)}</ul><button type="button" onClick={()=>onNavigate(sourceRoute)}>Open {sourceRoute==="feed"?"Feed":sourceRoute==="mortality"?"Mortality":sourceRoute==="medication"?"Medication":"Vaccination"} Workspace <ArrowUpRight size={14} aria-hidden="true"/></button></details>}
  </article>;
}

function Signal({ label, value, note, index, source }: { label: string; value: string; note: string; index: number; source?: Readonly<{id:string;revision:number}> }) {
  return <div className="f6-signal" aria-label={label + ": " + value + ". " + note}>
    <span className="f6-signal-index">{ordinal(index + 1)}</span><span className="f6-signal-name">{label}</span>
    <strong>{value}</strong><small>{note}</small>
    {source && <details className="f6-signal-source"><summary>Placement Record</summary><code>{source.id}</code><small>Revision {source.revision}</small></details>}
  </div>;
}

export default function FieldlineV6Experience({
  authority, source, historyDays = [], onNavigate, canReview = false, quickActions = [],
}: Props) {
  const view = useMemo(() => fieldlineView(authority, source), [authority, source]);
  const [question, setQuestion] = useState<Question>(null);
  const [trend, setTrend] = useState<"reports" | "approved" | "physicalCount">("reports");
  const [alertFilter, setAlertFilter] = useState<"all" | "urgent" | "review">("all");
  const [playbackOffset, setPlaybackOffset] = useState(0);
  const alertsId = useId();
  if (view.status !== "ready" || !source) {
    return <section className="f6" aria-label="Fieldline Farm Intelligence">
      <div className="f6-locked" role="status"><LockKeyhole size={25} aria-hidden="true"/><div>
        <strong>{view.status === "loading" ? "Verifying Farm Access" : "Farm Intelligence Unavailable"}</strong>
        <p>Only Authenticated, Farm-Scoped Operational Sources Can Be Displayed.</p>
      </div></div>
    </section>;
  }

  const status = sourceStates[source.approvalState ?? "unavailable"];
  const recordCount = source.reportCount ?? 0;
  const linkedEvidence = source.linkedEvidence ?? 0;
  const waiting = source.pendingReviews ?? 0;
  const validDays = historyDays.filter(day => day.localDate <= source.localDate).slice(-7);
  const chartValue = (day: FieldlineHistoryDay) => trend === "physicalCount"
    ? day.physicalCount?.status === "recorded" ? day.physicalCount.value : undefined
    : day[trend];
  const maxBars = Math.max(1, ...validDays.map(day => chartValue(day) ?? 0));
  const recordedDays = validDays.some(day => day.reports > 0);
  const playbackIndex = Math.max(0, validDays.length - 1 - playbackOffset);
  const playbackDay = validDays[playbackIndex];
  const recordStatus = (v: number | undefined, kind: MetricSource) =>
    source.metricStates?.[kind] === "none-recorded" ? "Explicit None Today" :
      source.metricStates?.[kind] === "awaiting-verification" ? "Awaiting Verification" :
        proven(v) ? "Recorded Source" : "Not Recorded";
  const sourceRefs=(kind:MetricSource)=>source.sourceRefs?.[kind]??[];
  const daysSincePlacement = source.placementDate && /^\d{4}-\d{2}-\d{2}$/.test(source.placementDate)
    ? Math.floor((Date.parse(source.localDate + "T00:00:00Z") - Date.parse(source.placementDate + "T00:00:00Z")) / 86_400_000)
    : null;
  const age = daysSincePlacement !== null && Number.isFinite(daysSincePlacement) && daysSincePlacement >= 0
    ? String(daysSincePlacement) + " Days" : "—";
  const signals = [
    {label:"Age",value:age,note:age === "—" ? "Placement Not Linked" : "Days Since Placement · Hatch Age Unconfirmed"},
    {label:"Opening Stock",value:source.openingBirds !== undefined && source.localDate === source.placementDate ? display(source.openingBirds," Birds") : "—",note:source.openingBirds === undefined ? "Authorized Placement Unavailable" : source.localDate === source.placementDate ? "Initial Placement · Not Live Stock" : "Prior-Day Closing Reconciliation Required",source:source.localDate === source.placementDate ? source.placementSource : undefined},
    {label:"Mortality",value:display(source.mortality),note:recordStatus(source.mortality,"mortality")},
    {label:"Medication",value:display(source.medicationEvents),note:recordStatus(source.medicationEvents,"medication")},
    {label:"Vaccination",value:display(source.vaccinationEvents),note:recordStatus(source.vaccinationEvents,"vaccinations")},
    {label:"Feed Intake",value:display(source.feedKg, " Kg"),note:recordStatus(source.feedKg,"feed")},
    {label:"Closing Stock",value:"—",note:"Not Yet Certified"},
  ];
  const missionIndicators = [
    {name:"Daily Record",known:recordCount>0,detail:recordCount + " Report(s)",icon:ClipboardCheck},
    {name:"Source Evidence",known:linkedEvidence>0,detail:linkedEvidence + " Link(s)",icon:Layers3},
    {name:"Physical Count",known:proven(source.physicalCount),detail:proven(source.physicalCount)?"Recorded":"Unconfirmed",icon:Bird},
    {name:"Feed Source",known:proven(source.feedKg),detail:recordStatus(source.feedKg,"feed"),icon:Wheat},
    {name:"Mortality",known:proven(source.mortality),detail:recordStatus(source.mortality,"mortality"),icon:HeartPulse},
    {name:"Medication",known:proven(source.medicationEvents),detail:recordStatus(source.medicationEvents,"medication"),icon:ShieldCheck},
    {name:"Vaccination",known:proven(source.vaccinationEvents),detail:recordStatus(source.vaccinationEvents,"vaccinations"),icon:Sprout},
    {name:"Independent Review",known:waiting === 0 && source.approvalState === "approved",detail:waiting + " Waiting",icon:ScanLine},
  ];
  const sourceMetricCount = [source.physicalCount,source.mortality,source.medicationEvents,
    source.vaccinationEvents,source.feedKg].filter(proven).length;
  const copilotAnswers: Record<Exclude<Question,null>,string> = {
    priority: view.copilot,
    mortality: source.metricStates?.mortality === "none-recorded"
      ? "Explicit None Today Was Recorded For Mortality. No Clinical Trend Or Baseline Is Implied."
      : proven(source.mortality)
      ? "The Selected Day Records " + display(source.mortality) + " Mortalities. No Comparable Clinical Trend Or Verified Baseline Is Available From This Projection."
      : "Mortality Trend Cannot Be Inferred Without A Confirmed Local-Day Source And Historical Comparators.",
    feed: source.metricStates?.feed === "none-recorded"
      ? "Explicit None Today Was Recorded For Feed Use. No Feed Runway Is Implied."
      : proven(source.feedKg)
      ? "The Local-Day Source Records " + display(source.feedKg," Kg") + ". Feed Runway Requires Reconciled Inventory, Consumption History And Target Stock Levels."
      : "A Feed Runway Or Reorder Recommendation Is Unavailable Until Verified Feed Use And Inventory Are Connected.",
    sell: "A Sell-Date Prediction Requires Confirmed Weights, Growth, Stock, Feed And Market Prices. The Canonical Daily Report Alone Does Not Supply Them.",
  };
  const visibleAlerts = view.alerts.filter(alert => alertFilter === "all" || alert.priority === alertFilter);
  const permittedCommands = commandCatalog.filter(command => quickActions.includes(command.route));
  return <section className="f6" aria-labelledby="f6-title">
    <div className="f6-section-start"><div><span className="f6-kicker"><span className="f6-accent-line"/> STAGE 24 / DAILY FLOCK INTELLIGENCE</span><h2 id="f6-title">An Intelligent View Of Every Day<span className="f6-period">.</span></h2><p>Source-Controlled Operations · Selected Flock {source.flockCode} · {source.localDate} WAT</p></div><span className="f6-verification"><ShieldCheck size={16} aria-hidden="true"/> Authenticated Scope</span></div>

    <div className={"f6-command f6-command-" + status.tone}>
      <div className="f6-command-left"><span className="f6-command-eyebrow"><Zap size={15} aria-hidden="true"/> EXECUTIVE BRIEFING / SOURCE-BOUND INTELLIGENCE</span>
        <h3>{status.title}</h3><p>{status.text}</p>
        {onNavigate && <div className="f6-command-actions"><button type="button" onClick={()=>onNavigate("reports")}>Review Daily Record <ArrowUpRight size={17} aria-hidden="true"/></button>
          {canReview&&<button className="f6-button-outline" type="button" onClick={()=>onNavigate("review")}>Open Review Queue <ChevronRight size={17} aria-hidden="true"/></button>}</div>}
        <div className="f6-command-foot"><div><span>LOCAL-DAY REPORTS</span><strong>{recordCount}</strong></div><div><span>LINKED EVIDENCE</span><strong>{linkedEvidence}</strong></div><div><span>REVIEW PRIORITIES</span><strong>{waiting}</strong></div></div>
      </div>
      <div className="f6-command-right"><div className="f6-radial"><span className="f6-radial-center"><ShieldCheck size={31} aria-hidden="true"/><strong>{status.label}</strong><small>Not A Health Score</small></span></div>
        <div className="f6-command-right-bottom"><span>LOCAL-DAY OBSERVATIONS</span><strong>{sourceMetricCount} Of 5 Source Values Present</strong><small>Not Independently Certified · No Health Score</small></div></div>
    </div>

    <div className="f6-subheading"><span className="f6-kicker">01 / OPERATIONAL AWARENESS</span><h3>Farm Mission Control<span className="f6-period">.</span></h3><p>Real Source States, Not Simulated Sensor Telemetry.</p></div>
    <div className="f6-mission-grid">{missionIndicators.map(({name,known,detail,icon:Icon})=>
      <div key={name} className={"f6-mission-cell " + (known ? "f6-mission-verified":"f6-mission-unconfirmed")}>
        <span className="f6-mission-top"><Icon size={19} strokeWidth={1.8} aria-hidden="true"/><i aria-hidden="true"/></span><strong>{name}</strong><small>{detail}</small>
      </div>)}</div>

    <div className="f6-metric-grid">
      <MetricCard label="Physical Count" value={display(source.physicalCount)} note="Not Reconciled Closing Stock" icon={Bird} index={0} state={proven(source.physicalCount)?"recorded":"missing"}/>
      <MetricCard label="Mortality" value={display(source.mortality)} note={recordStatus(source.mortality,"mortality")} icon={HeartPulse} index={1} state={proven(source.mortality)?"recorded":"missing"} sourceIds={sourceRefs("mortality")} sourceRoute="mortality" onNavigate={onNavigate}/>
      <MetricCard label="Feed Used" value={display(source.feedKg," Kg")} note={recordStatus(source.feedKg,"feed")} icon={Wheat} index={2} state={proven(source.feedKg)?"recorded":"missing"} sourceIds={sourceRefs("feed")} sourceRoute="feed" onNavigate={onNavigate}/>
      <MetricCard label="Medication" value={display(source.medicationEvents)} note={recordStatus(source.medicationEvents,"medication")} icon={ShieldCheck} index={3} state={proven(source.medicationEvents)?"recorded":"missing"} sourceIds={sourceRefs("medication")} sourceRoute="medication" onNavigate={onNavigate}/>
      <MetricCard label="Vaccinations" value={display(source.vaccinationEvents)} note={recordStatus(source.vaccinationEvents,"vaccinations")} icon={Sprout} index={4} state={proven(source.vaccinationEvents)?"recorded":"missing"} sourceIds={sourceRefs("vaccinations")} sourceRoute="vaccinations" onNavigate={onNavigate}/>
      <MetricCard label="Linked Sources" value={String(linkedEvidence)} note="References, Not Approval" icon={Layers3} index={5} state={linkedEvidence?"recorded":"missing"}/>
    </div>

    {permittedCommands.length>0 && onNavigate && <section className="f6-command-deck" aria-label="Authorized Farm Workspaces">
      <div className="f6-command-deck-intro">
        <span className="f6-kicker">QUICK ACCESS / PERMITTED OPERATIONS</span>
        <strong>Move From Insight To Action<span className="f6-period">.</span></strong>
        <small>Opens Existing Workspaces. Record Permissions Are Checked Again By The Destination.</small>
      </div>
      <div className={"f6-command-deck-items"+(permittedCommands.length<=2?" f6-deck-sparse":"")}>{permittedCommands.map(({route,label,detail,icon:Icon},index)=>
        <button key={route} type="button" className="f6-deck-button" onClick={()=>onNavigate(route)} aria-label={"Open "+label}>
          <span className="f6-deck-number">{ordinal(index+1)}</span>
          <span className="f6-deck-icon"><Icon size={23} strokeWidth={1.8} aria-hidden="true"/></span>
          <span className="f6-deck-copy"><strong>{label}</strong><small>{detail}</small></span>
          <ArrowUpRight size={18} className="f6-deck-arrow" aria-hidden="true"/>
        </button>)}</div>
    </section>}

    <div className="f6-subheading"><span className="f6-kicker">02 / THE LIVING PICTURE</span><h3>Understand The Flock Before The Decision<span className="f6-period">.</span></h3><p>Operational Precision With Every Missing Source Visible.</p></div>
    <div className="f6-feature-row">
      <article className="f6-panel f6-twin"><div className="f6-panel-head"><div><span className="f6-kicker">FLOCK DIGITAL TWIN / SOURCE VIEW</span><h4>Flock Vitality / {source.flockCode}</h4></div><Bird size={23} aria-hidden="true"/></div>
        <div className="f6-twin-inner"><div className="f6-twin-orbit"><div><Bird size={40} strokeWidth={1.3} aria-hidden="true"/><strong>{display(source.physicalCount)}</strong><span>Physically Counted</span></div></div>
          <div className="f6-twin-detail"><span>AUTHORIZED FLOCK SNAPSHOT</span><strong>{source.flockCode}</strong><div className="f6-twin-detail-grid"><div><small>House</small><b>{source.house || "Not Linked"}</b></div><div><small>Age</small><b>{age}</b></div><div><small>Mortality</small><b>{display(source.mortality)}</b></div><div><small>Stock Reconciliation</small><b>Pending</b></div></div>
          <p><CircleAlert size={15} aria-hidden="true"/> Physical Count Is Not A Certified Closing Stock Balance.</p></div></div>
      </article>
      <article className="f6-panel f6-insights"><div className="f6-panel-head"><div><span className="f6-kicker">DECISION INTELLIGENCE</span><h4>What Needs Attention</h4></div><BellRing size={21} aria-hidden="true"/></div>
        <div className="f6-alert-controls" aria-label="Alert Priority Filter">{(["all","urgent","review"] as const).map(f=><button key={f} type="button" className={alertFilter===f?"active":""} onClick={()=>setAlertFilter(f)} aria-pressed={alertFilter===f}>{f==="all"?"All Priorities":f==="urgent"?"Attention":"Reviews"}</button>)}</div>
        <div id={alertsId} className="f6-alert-list">{visibleAlerts.length?visibleAlerts.map((a,i)=><div className="f6-alert-item" key={a.id}><span className={"f6-alert-mark f6-alert-mark-"+a.priority} aria-hidden="true"/><div><small>PRIORITY {ordinal(i+1)} / {a.priority.toUpperCase()}</small><strong>{a.message}</strong></div><ArrowUpRight size={17} aria-hidden="true"/></div>):<p className="f6-empty-alert">No Matching Priority In The Authorized Source.</p>}</div>
        <div className="f6-panel-foot"><span><ShieldCheck size={14} aria-hidden="true"/> Independent Review Is Always Required</span>{canReview&&<button type="button" disabled={!onNavigate} onClick={()=>onNavigate?.("review")}>Review Queue <ArrowRight size={15}/></button>}</div>
      </article>
    </div>

    <div className="f6-feature-row f6-feature-row-trends">
      <article className="f6-panel f6-trends"><div className="f6-panel-head"><div><span className="f6-kicker">03 / AUTHORIZED SOURCE ANALYTICS</span><h4>Flock History / Last 7 Days</h4></div><BarChart3 size={22} aria-hidden="true"/></div>
        <div className="f6-chart-toolbar"><p>Approved Physical Counts And Report Statuses From This Authorized Flock. Gaps Are Not Zero Counts.</p><div role="group" aria-label="Evidence Trend Measure"><button className={trend==="reports"?"active":""} type="button" onClick={()=>setTrend("reports")} aria-pressed={trend==="reports"}>Reports</button><button className={trend==="approved"?"active":""} type="button" onClick={()=>setTrend("approved")} aria-pressed={trend==="approved"}>Approved</button><button className={trend==="physicalCount"?"active":""} type="button" onClick={()=>setTrend("physicalCount")} aria-pressed={trend==="physicalCount"}>Physical Count</button></div></div>
        <div className="f6-chart" role="group" aria-label="Seven-Day Report History. Select A Bar To Inspect Its Verified Record Counts.">
          {validDays.map((day,i)=><button type="button" className={"f6-chart-column "+(i===playbackIndex?"f6-chart-selected":"")} key={day.localDate}
            onClick={()=>setPlaybackOffset(validDays.length-1-i)} aria-pressed={i===playbackIndex}
            aria-label={day.localDate+": "+day.reports+" Reports, "+day.approved+" Approved, "+day.evidenceRefs+" Evidence Links"+(trend==="physicalCount"?"; Physical Count: "+(day.physicalCount?.status==="conflict"?"Source Conflict":display(chartValue(day))):"")}>
            <span className="f6-chart-value">{chartValue(day) === undefined ? day.physicalCount?.status === "conflict" ? "!" : "—" : new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(chartValue(day)!)}</span>
            <span className="f6-chart-track"><span className="f6-chart-bar" style={{height:(chartValue(day)??0)>0?(14+(chartValue(day)??0)/maxBars*86)+"%":"0%",animationDelay:i*65+"ms"}}/></span>
            <span className="f6-chart-date">{day.localDate.slice(5)}</span>
          </button>)}
        </div>
        <div className="f6-chart-inspector" role="status" aria-live="polite" aria-atomic="true">
          <div className="f6-chart-inspector-date"><span>SELECTED HISTORY / SOURCE RECORD</span><strong>{playbackDay?.localDate??"No Authorized History"}</strong><small>Viewing History Only · Active Report Date Remains {source.localDate}</small></div>
          <div className="f6-chart-inspector-metrics"><div><span>Reports</span><strong>{playbackDay?.reports??0}</strong></div><div><span>Approved</span><strong>{playbackDay?.approved??0}</strong></div><div><span>Linked Evidence</span><strong>{playbackDay?.evidenceRefs??0}</strong></div></div>
        </div>
        {trend === "physicalCount" && <p className="f6-count-provenance" role="status">
          <Bird size={17} aria-hidden="true"/><span><strong>Physical Count / {playbackDay?.physicalCount?.status === "conflict" ? "Source Conflict" : display(playbackDay?.physicalCount?.value)}</strong>
          <small>{playbackDay?.physicalCount?.status === "recorded" ? "One Approved Daily Report · Not Reconciled Closing Stock" : playbackDay?.physicalCount?.status === "conflict" ? "Multiple Approved Reports · Resolve Before Using This Count" : "No Unique Approved Physical Count For This Day"}</small>
          {playbackDay?.physicalCount?.sourceId && <code>Source: {playbackDay.physicalCount.sourceId}</code>}</span>
        </p>}
        {!recordedDays&&<p className="f6-data-note"><DatabaseZap size={16} aria-hidden="true"/> No Authorized Reports In This Seven-Day Window. Trend Values Are Not Invented.</p>}
        <div className="f6-mini-trend-grid"><div><span>Feed Consumption Trend</span><strong>Not Available</strong><small>Requires Verified Daily Series</small></div><div><span>Mortality Baseline</span><strong>Not Available</strong><small>Requires Comparable Source History</small></div><div><span>Weight Gain Trend</span><strong>Not Connected</strong><small>Requires Calibrated Weight Records</small></div></div>
      </article>
      <article className="f6-panel f6-weather"><div className="f6-panel-head"><div><span className="f6-kicker">ENVIRONMENT & OPERATIONS</span><h4>Weather Intelligence</h4></div><CloudSun size={23} aria-hidden="true"/></div>
        <div className="f6-weather-symbol"><CloudSun size={56} strokeWidth={1.25} aria-hidden="true"/><div><span>FARM CONDITIONS</span><strong>Not Connected</strong><p>No Live Weather Or Sensor Reading Is Available.</p></div></div>
        <div className="f6-weather-check"><span>Temperature</span><b>—</b></div><div className="f6-weather-check"><span>Humidity</span><b>—</b></div><div className="f6-weather-check"><span>Weather Impact Guidance</span><b>Awaiting Source</b></div>
        <p className="f6-data-note"><RadioTower size={15} aria-hidden="true"/> Live Conditions Require An Authorized Weather Or Device Integration.</p>
      </article>
    </div>

    <details className="f6-optional-analysis">
      <summary><span>Optional Planning Insights</span><small>Guided Questions And Forecast Readiness</small></summary>
    <div className="f6-feature-row f6-feature-row-decision">
      <article className="f6-panel f6-copilot"><div className="f6-panel-head"><div><span className="f6-kicker">04 / EXPLAINABLE FARM COPILOT</span><h4>Ask The Farm. Check The Source.</h4></div><MessageCircle size={23} aria-hidden="true"/></div>
        <div className="f6-copilot-intro"><span className="f6-copilot-icon"><MessageCircle size={25} aria-hidden="true"/></span><div><strong>Farm Copilot / Guided Analysis</strong><small>Rules-Based Only · No External AI Model · No Unverified Predictions</small></div></div>
        <div className="f6-copilot-prompts">{([
          ["priority","What Matters Most Now?"],["mortality","Why Are Mortalities Being Reviewed?"],
          ["feed","How Much Feed Will We Need?"],["sell","When Could This Flock Be Sold?"],
        ] as const).map(([key,label])=><button type="button" key={key} className={question===key?"active":""} onClick={()=>setQuestion(old=>old===key?null:key)} aria-expanded={question===key}>{label}<ArrowUpRight size={17} aria-hidden="true"/></button>)}</div>
        {question&&<div className="f6-copilot-answer" role="status"><ShieldCheck size={19} aria-hidden="true"/><p>{copilotAnswers[question]}</p></div>}
      </article>
      <article className="f6-panel f6-prediction"><div className="f6-panel-head"><div><span className="f6-kicker">05 / DECISIONS BEFORE DEADLINES</span><h4>Predictive Action Readiness</h4></div><Gauge size={23} aria-hidden="true"/></div>
        <div className="f6-prediction-row"><span><TrendingUp size={17}/> Sell-Date Forecast</span><strong>Data Required</strong></div>
        <div className="f6-prediction-row"><span><Wheat size={17}/> Feed Inventory Runway</span><strong>Data Required</strong></div>
        <div className="f6-prediction-row"><span><Coins size={17}/> Profit Projection</span><strong>Finance Grant + Sources Required</strong></div>
        <div className="f6-prediction-row"><span><Activity size={17}/> Mortality Risk</span><strong>Validated Model Required</strong></div>
        <p className="f6-data-note"><ShieldAlert size={16} aria-hidden="true"/> These Are Integration Dependencies, Not Active AI Forecasts.</p>
      </article>
    </div>
    </details>

    <div className="f6-subheading"><span className="f6-kicker">06 / OPERATIONAL PROOF</span><h3>Every Number Has A Source<span className="f6-period">.</span></h3><p>Seven Signals And An Independent Evidence Chain.</p></div>
    <div className="f6-signal-grid">{signals.map((s,i)=><Signal key={s.label} {...s} index={i}/>)}</div>
    <div className="f6-evidence-line"><div className="f6-panel-head"><div><span className="f6-kicker">RECORD → EVIDENCE → REVIEW → CERTIFICATION</span><h4>Evidence In Motion</h4></div><FileCheck2 size={22} aria-hidden="true"/></div>
      <div className="f6-evidence-track">{([
        [ClipboardCheck,"Record",recordCount+" Report(s)",recordCount>0],
        [Layers3,"Evidence",linkedEvidence+" Reference(s)",linkedEvidence>0],
        [ScanLine,"Verification","Independent Source Check",source.approvalState==="approved"],
        [CheckCheck,"Review",waiting+" Pending",source.approvalState==="approved"&&waiting===0],
        [ShieldCheck,"Certified","Not Yet Certified",false],
      ] as const).map(([Icon,label,detail,complete],i)=><div className={"f6-evidence-step "+(complete?"f6-evidence-complete":"")} key={label}>
        <span className="f6-evidence-icon"><Icon size={22} aria-hidden="true"/></span><span className="f6-evidence-index">{ordinal(i+1)}</span><strong>{label}</strong><small>{detail}</small>{i<4&&<ChevronRight className="f6-evidence-chevron" size={18} aria-hidden="true"/>}
      </div>)}</div><p className="f6-evidence-disclaimer"><CircleAlert size={17} aria-hidden="true"/> Approval Is Not Equivalent To Stock Reconciliation, Full Audit Readiness Or Certified Farm Health.</p>
    </div>

    <div className="f6-tail-row"><article className="f6-panel f6-activity"><div className="f6-panel-head"><div><span className="f6-kicker">07 / SOURCED OPERATIONAL TIMELINE</span><h4>Flock Record Activity</h4></div><CalendarDays size={22} aria-hidden="true"/></div>
      {validDays.filter(day=>day.reports>0).length?
        <><div className="f6-playback"><div className="f6-playback-heading"><span>REWIND FARM / AUTHORIZED HISTORY</span><strong aria-live="polite">{playbackDay?.localDate ?? "No Confirmed Date"}</strong></div><div className="f6-playback-nav"><button type="button" onClick={()=>setPlaybackOffset(offset=>Math.min(validDays.length-1,offset+1))} disabled={playbackOffset>=validDays.length-1} aria-label="Previous Reporting Day">Older Day <ChevronRight size={15} className="f6-backward-icon" aria-hidden="true"/></button><div className="f6-playback-dots" aria-hidden="true">{validDays.map((day,i)=><span key={day.localDate} className={i===playbackIndex?"active":""}/>)}</div><button type="button" onClick={()=>setPlaybackOffset(offset=>Math.max(0,offset-1))} disabled={playbackOffset===0} aria-label="Next Reporting Day">Newer Day <ChevronRight size={15} aria-hidden="true"/></button></div><div className="f6-playback-facts" aria-live="polite"><div><span>Reports</span><strong>{playbackDay?.reports??0}</strong></div><div><span>Evidence Links</span><strong>{playbackDay?.evidenceRefs??0}</strong></div><div><span>Approved</span><strong>{playbackDay?.approved??0}</strong></div></div></div><div className="f6-activity-list">{validDays.filter(day=>day.reports>0).slice().reverse().map(day=><div key={day.localDate} className="f6-activity-item"><span className="f6-activity-dot"/><div><strong>{day.localDate}</strong><small>{day.reports} Report(s) · {day.evidenceRefs} Source Link(s)</small></div><span>{day.approved} Approved</span></div>)}</div></>:
        <div className="f6-no-activity"><DatabaseZap size={29} aria-hidden="true"/><p>No Confirmed Record Activity For The Selected Seven-Day Period.</p></div>}
    </article>
    <article className="f6-panel f6-next"><div className="f6-panel-head"><div><span className="f6-kicker">08 / NEXT BEST ACTIONS</span><h4>Act Without Losing Context</h4></div><Zap size={22} aria-hidden="true"/></div>
      {onNavigate&&<button className="f6-task" type="button" onClick={()=>onNavigate("reports")}><ClipboardCheck size={19} aria-hidden="true"/><span><strong>Open Daily Register</strong><small>Inspect Or Continue Authorized Report Entry</small></span><ArrowUpRight size={18}/></button>}
      {canReview&&<button className="f6-task" type="button" onClick={()=>onNavigate?.("review")} disabled={!onNavigate}><ScanLine size={19} aria-hidden="true"/><span><strong>Open Review Queue</strong><small>Independent Approval Remains Required</small></span><ArrowUpRight size={18}/></button>}
      {view.canShowAudit&&<button className="f6-task" type="button" onClick={()=>onNavigate?.("audit")} disabled={!onNavigate}><FileCheck2 size={19} aria-hidden="true"/><span><strong>Evidence & Audit</strong><small>Authorized Audit Workspace</small></span><ArrowUpRight size={18}/></button>}
      <div className="f6-zone-area"><span className="f6-kicker">AUTHORIZED ZONE / SOURCE TOPOLOGY</span><div className="f6-zone-map">
        <div className="f6-zone-route" aria-hidden="true"/><div className="f6-zone-node"><Bird size={27} strokeWidth={1.6} aria-hidden="true"/><strong>{source.house || "Assigned House"}</strong><small>{source.flockCode}</small></div>
        <div className="f6-zone-copy"><span>FLOCK LOCATION</span><strong>Current Authorized Scope</strong><small>Full-Site Occupancy Requires A Verified Facility Map. Other Flocks Are Not Disclosed.</small></div>
      </div></div>
    </article></div>

    {view.canShowFinance&&<article className="f6-panel f6-finance"><div className="f6-panel-head"><div><span className="f6-kicker">PRIVATE / INDEPENDENT FINANCE AUTHORITY</span><h4>Financial Intelligence</h4></div><Coins size={22} aria-hidden="true"/></div>
      <div className="f6-finance-grid">{view.financial.map(item=><div key={item.id}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
      <p className="f6-data-note"><ShieldCheck size={15} aria-hidden="true"/> Only A Separately Authorized Finance Data Contract May Populate These Values.</p>
      <button type="button" className="f6-finance-action" disabled={!onNavigate} onClick={()=>onNavigate?.("finance")}>Open Authorized Finance <ArrowUpRight size={16}/></button>
    </article>}
    <footer className="f6-footer"><span>FIELDLINE 06 / SOURCE-BOUND OPERATIONAL INTELLIGENCE</span><span>DAENEM FARM OPERATIONS · NOT A LIVE SENSOR OR AI CERTIFICATION SERVICE</span></footer>
  </section>;
}
