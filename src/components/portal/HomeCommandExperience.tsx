"use client";

import React, { useEffect, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, CheckCircle2, Clock3,
  Command, Gauge, ListChecks, Pin, Search,
  Pause, Play, ShieldCheck, Sparkles, Star, TriangleAlert, Wifi
} from "lucide-react";
import { canPage, has, isOwnerPrincipal, pages, sampleNotifications } from "@/lib/portal-model";
import { Btn, Panel } from "./Common";
import type { WorkspaceProps } from "./PortalExperience";
import DashboardWeather from "./DashboardWeather";
import GatewayEditorialWidget from "./GatewayEditorialWidgets";
import HomeNewsIntelligence from "./HomeNewsIntelligence";

import HomeProductivitySuite from "./HomeProductivitySuite";
import "./Stage22Home.css";
import "./HomeSiteHero.css";

type HomeRoute = { id: string; title: string; detail: string; permission?: string };
const QUICK: HomeRoute[] = [
  { id: "operations", title: "Farm Operations", detail: "Daily routines and farm records" },
  { id: "myday", title: "My Day", detail: "Attendance, requests and tasks" },
  { id: "inventory", title: "Inventory", detail: "Stock levels and movements" },
  { id: "procurement", title: "Procurement", detail: "Purchase requests and suppliers" },
  { id: "expenses", title: "Expenses", detail: "Expense records and receipts" },
  { id: "leave", title: "Leave", detail: "Request leave and track its progress" },
  { id: "recruitment", title: "Recruitment", detail: "Applications and candidate progress" },
  { id: "security", title: "Security", detail: "Incidents and supporting records" },
];
const PULSE: HomeRoute[] = [
  { id: "operations", title: "Farm Operations", detail: "Live farm updates are not connected yet" },
  { id: "flocks", title: "Flocks", detail: "Live flock records are not connected yet" },
  { id: "feed", title: "Feed", detail: "Live feed balances are not connected yet" },
  { id: "eggs", title: "Egg Production", detail: "Live egg collections are not connected yet" },
  { id: "inventory", title: "Inventory", detail: "Live stock balances are not connected yet" },
  { id: "finance", title: "Finance", detail: "Live finance records are not connected yet" },
  { id: "security", title: "Security", detail: "Live incident updates are not connected yet" },
];
const APPROVALS: HomeRoute[] = [
  { id: "signup-admin", title: "Provisional Accounts", detail: "Review new accounts and approval history", permission: "signup.approve" },
  { id: "procurement", title: "Procurement", detail: "Review purchase requests and suppliers", permission: "procurement.approve" },
  { id: "expenses", title: "Expenses", detail: "Review expense records and receipts", permission: "expense.admin" },
  { id: "payroll-admin", title: "Payroll", detail: "Review payroll and payment records", permission: "payroll.admin" },
];

export default function HomeCommandExperience(p: WorkspaceProps) {
  const owner = isOwnerPrincipal(p.person);
  const [now, setNow] = useState(() => new Date());
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [scenePaused, setScenePaused] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const allowed = (id: string) => owner || canPage(p.person, id);
  // Role-based ordering is presentation only; canPage remains the access gate.
  const roleContext = (p.person.department + " " + p.person.job).toLowerCase();
  const preferred = owner ? ["operations","procurement","expenses","inventory","myday","security"]
    : /finance|account|payroll/.test(roleContext) ? ["expenses","procurement","inventory","myday"]
    : /human resources|people|recruit/.test(roleContext) ? ["recruitment","leave","myday","expenses"]
    : /security|guard/.test(roleContext) ? ["security","myday","operations"]
    : /manager|supervisor|farm|production|livestock/.test(roleContext) ? ["operations","inventory","procurement","myday"]
    : ["myday","leave","operations","expenses"];
  const quick = QUICK.filter((item) => allowed(item.id))
    .sort((a,b) => {
      const ar = preferred.indexOf(a.id), br = preferred.indexOf(b.id);
      return (ar < 0 ? 99 : ar) - (br < 0 ? 99 : br);
    }).slice(0, 6);
  const pulse = PULSE.filter((item) => allowed(item.id));
  const approvals = APPROVALS.filter((item) => allowed(item.id) && (owner || !item.permission || has(p.person, item.permission)));
  // Source gate: synthetic preview notifications are not live attention items.
  const authorizedNotices = p.notices.filter((notice) => allowed(notice.page) && !sampleNotifications.some(
    (fixture) => fixture.id === notice.id && fixture.title === notice.title && fixture.detail === notice.detail,
  ));
  const visiblePages = pages.filter((page) => page.id !== "dashboard" && allowed(page.id));
  const activityRoute = ["audit", "activity"].find((id) => pages.some((page) => page.id === id) && allowed(id));

  const openRoute = (id: string) => {
    if (!allowed(id)) return;
    setRecent((old) => [id, ...old.filter((x) => x !== id)].slice(0, 5));
    p.go(id);
  };
  const toggleFavorite = (id: string) => {
    if (!allowed(id)) return;
    setFavorites((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id].slice(0, 6));
  };
  const scrollHomePanels = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const panel = event.currentTarget;
    if (event.target !== panel || panel.scrollWidth <= panel.clientWidth) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    panel.scrollBy({
      left: (event.key === "ArrowRight" ? 1 : -1) * Math.round(panel.clientWidth * 0.8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const firstName = p.person.name.split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", hour: "2-digit", hourCycle: "h23",
  }).format(now));
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos", weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(now);
  const localTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(now);
  const roleSummary = owner
    ? "Your company-wide situation room for today’s farm, people and financial decisions."
    : /finance|account|payroll/.test(roleContext)
      ? "Your focused view of collections, expenses, payments and permitted financial work."
      : /manager|supervisor|farm|production|livestock/.test(roleContext)
        ? "Your operational view of farm work, production, stock and assigned people."
        : "Your personal workspace for assigned work, requests and permitted farm records.";
  const briefParts = [
    authorizedNotices.length ? `Unread work updates: ${authorizedNotices.filter((n) => !n.read).length}` : "Live work updates are not available yet",
    allowed("operations") ? "Farm Operations is available" : "",
    allowed("myday") ? "My Day is available" : "",
  ].filter(Boolean);

  return <section className="home-command-experience" aria-label="Your DAENEM Home">
    <header className={`home-command-hero home-site-hero${scenePaused ? " scene-paused" : ""}`}>
      <div className="home-site-hero-media" aria-hidden="true" />
      <div className="home-site-hero-shade" aria-hidden="true" />
      <div className="home-site-hero-copy">
        <span className="eyebrow"><Sparkles size={15}/>My DAENEM Home</span>
        <h1>{greeting}, {firstName}.</h1>
        <p>{roleSummary}</p>
        <div className="home-site-hero-actions">
          {quick[0] && <Btn onClick={() => openRoute(quick[0].id)}>Open {quick[0].title}<ArrowUpRight size={15}/></Btn>}
          {allowed("myday") && <button type="button" onClick={() => openRoute("myday")}>View Today’s Plan<ArrowUpRight size={15}/></button>}
        </div>
        <div className="home-site-hero-snapshot">
          <div><span>Role</span><strong>{owner ? "Business Owner" : p.person.job}</strong><small>{p.person.department}</small></div>
          <div><span>Attention</span><strong>{authorizedNotices.length ? `${authorizedNotices.filter((n) => !n.read).length} Unread` : "No Live Count"}</strong><small>Only Permitted Updates</small></div>
          <div><span>Farm Scope</span><strong>{p.person.farm ? "Assigned Farm" : "Authorized Scope"}</strong><small>Permission Controlled</small></div>
        </div>
      </div>
      <aside className="home-site-hero-brief" aria-label="DAENEM Daily Brief">
        <div><span>Live Briefing</span><strong>{owner ? "Owner View" : `${p.person.job} View`}</strong></div>
        <div className="home-command-time"><Clock3/><strong>{localTime}</strong><small>{date}</small></div>
        <div className="home-site-hero-status"><ShieldCheck/><span><strong>Workspace Ready</strong><small>{briefParts.join(" · ")}</small></span></div>
        <p>Live figures appear only when connected to verified FarmPortal records.</p>
      </aside>
      <button className="home-site-scene-toggle" type="button" aria-pressed={scenePaused} onClick={() => setScenePaused((value) => !value)}>{scenePaused ? <Play aria-hidden="true"/> : <Pause aria-hidden="true"/>}{scenePaused ? "Play Scene" : "Pause Scene"}</button>
    </header>

    <div className="home-command-grid">
      {allowed("myday") && <Panel title="My Day" description="Attendance, requests and your working day">
        <div className="home-mini-action"><ListChecks/><div><strong>Open Your Day</strong><small>Attendance, requests and daily tasks</small></div>
        <Btn onClick={() => openRoute("myday")}>Open <ArrowUpRight size={14}/></Btn></div>
      </Panel>}

      <Panel title="Needs Your Attention" description="Work updates and items needing attention">
        <div className="home-attention-stack">
          {authorizedNotices.slice(0, 4).map((notice) => <button key={notice.id} onClick={() => openRoute(notice.page)}>
            <TriangleAlert size={17}/><span><strong>{notice.title}</strong><small>{notice.detail}</small></span><ArrowUpRight size={14}/>
          </button>)}
          {!authorizedNotices.length && <div className="home-empty-safe"><CheckCircle2/><span>Live attention updates are not connected yet. Open your work areas to check for pending tasks.</span></div>}
        </div>
      </Panel>

      <Panel title="Quick Actions" description="Shortcuts for your role and daily work">
        <div className="home-action-grid">{quick.map((item) => <button key={item.id} onClick={() => openRoute(item.id)}>
          <Command size={17}/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight size={14}/>
        </button>)}</div>
      </Panel>
    </div>

    {pulse.length > 0 && <Panel title="Data Readiness" description="Operational areas waiting for live record connections">
      <div className="home-readiness-summary">
        <div className="home-readiness-icon"><Gauge size={22}/></div>
        <div><span className="eyebrow">SOURCE STATUS</span><strong>Live figures are not connected yet for these operational areas</strong>
        <small>Use the work areas below while their Home summaries are being connected to verified records.</small></div>
        <span className="home-readiness-count">{pulse.length} areas</span>
      </div>
      <div className="home-pulse-grid">{pulse.map((item) => <button key={item.id} onClick={() => openRoute(item.id)}>
        <Gauge size={17}/><span><strong>{item.title}</strong><small>{item.detail}</small></span>
        <em>Awaiting source</em><ArrowUpRight size={14}/>
      </button>)}</div>
    </Panel>}

    {approvals.length > 0 && <Panel title="My Approval Inbox" description="Open the approval areas assigned to you">
      <div className="home-action-grid">{approvals.map((item) => <button key={item.id} onClick={() => openRoute(item.id)}>
        <ListChecks size={17}/><span><strong>{item.title}</strong><small>{item.detail} · open to check pending requests</small></span><ArrowUpRight size={14}/>
      </button>)}</div>
    </Panel>}

    <HomeProductivitySuite showNewYork={owner || has(p.person, "clock.manage")} />



    <p className="home-widget-guide" role="note">Scroll, use the left or right arrow key, or swipe to explore more workspace widgets <span aria-hidden="true">→</span></p>
    <div className="home-context-grid" role="region" aria-label="Farm, news and editorial widgets" tabIndex={0} onKeyDown={scrollHomePanels}>
      {(owner || (has(p.person, "weather.view") && allowed("weather-lab"))) && <section aria-label="Farm Weather"><DashboardWeather/></section>}
      {(allowed("knowledge") || allowed("notices")) && <GatewayEditorialWidget kind="spotlight"/>}
      {(allowed("knowledge") || allowed("notices")) && <GatewayEditorialWidget kind="inspiration"/>}
      {(owner || allowed("market")) && <HomeNewsIntelligence roleContext={roleContext} owner={owner}/>}
    </div>

    <div className="home-context-grid" role="region" aria-label="Recent work, favourites and activity panels" tabIndex={0} onKeyDown={scrollHomePanels}>
      <Panel title="Continue Where You Left Off" description="Work opened from Home during this visit">
        <div className="home-route-list">{recent.filter(allowed).map((id) => {
          const page = pages.find((x) => x.id === id); if (!page) return null;
          return <button key={id} onClick={() => openRoute(id)}><Activity/><span><strong>{page.title}</strong><small>{page.description}</small></span></button>;
        })}
        {!recent.filter(allowed).length && <p>Work you open from Home will appear here during this visit.</p>}</div>
      </Panel>

      <Panel title="Favorites" description="Your shortcuts during this visit">
        <div className="home-route-list">{favorites.filter(allowed).map((id) => {
          const page = pages.find((x) => x.id === id); if (!page) return null;
          return <button key={id} onClick={() => openRoute(id)}><Star/><span><strong>{page.title}</strong><small>{page.description}</small></span></button>;
        })}
        {!favorites.filter(allowed).length && <div className="home-favorite-picks">{visiblePages.slice(0, 4).map((page) =>
          <button key={page.id} onClick={() => toggleFavorite(page.id)}><Pin size={14}/> Pin {page.title}</button>)}</div>}</div>
      </Panel>

      {activityRoute && <Panel title="Recent Activity" description="Your permitted activity records">
        <div className="home-notification-summary"><Activity/><div><strong>Live Activity Not Connected</strong>
        <small>Live activity is not connected to Home yet. Open Activity History to review the records available to you.</small></div>
        <Btn onClick={() => openRoute(activityRoute)}>Open</Btn></div>
      </Panel>}

      {allowed("notifications") && <Panel title="Notifications" description="Updates for work you can access">
        <div className="home-notification-summary"><Bell/><div><strong>{authorizedNotices.filter((n) => !n.read).length} Unread</strong>
        <small>Updates are shown only for work you can access.</small></div>
        <Btn onClick={() => openRoute("notifications")}>View</Btn></div>
      </Panel>}

      <Panel title="Search & Command" description="Find pages and work areas">
        <div className="home-search-surface"><Search/><div><strong>Find Your Work</strong>
        <small>Use Search in the top bar to find pages and work areas available to you.</small></div></div>
      </Panel>
    </div>

    <footer className="home-system-strip">
      <span><Wifi/> Application Session</span><strong>Access Granted</strong>
      <span><ShieldCheck/> Account Access</span><strong>Active</strong>
      <span><Activity/> Live Farm & Business Updates</span><strong>Not Fully Connected</strong>
    </footer>
  </section>;
}
