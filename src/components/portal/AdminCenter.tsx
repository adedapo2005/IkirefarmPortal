"use client";

import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  CloudSun,
  Database,
  FileClock,
  FileText,
  Gauge,
  Globe2,
  History,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  LockKeyhole,
  Menu,
  MessageSquare,
  Moon,
  PanelLeft,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  UsersRound,
  GitBranch,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./admin-center.module.css";
import GatewayEditorialStudio from "./GatewayEditorialStudio";
import RegistrationEmailSettings from "./RegistrationEmailSettings";

type StudioId =
  | "overview"
  | "security"
  | "search"
  | "version"
  | "weather"
  | "market"
  | "logs"
  | "alerting"
  | "knowledge"
  | "communications"
  | "editorial"
  | "modules"
  | "integrations"
  | "help";

type IconType = typeof ShieldCheck;

type StudioItem = {
  id: StudioId;
  label: string;
  description: string;
  icon: IconType;
  group: string;
};

const studios: StudioItem[] = [
  { id: "overview", label: "Admin Center", description: "Owner command center and operating boundary.", icon: LayoutGrid, group: "Command" },
  { id: "security", label: "Security & Authentication", description: "Policy, provider, recovery and privileged-account controls.", icon: KeyRound, group: "Control" },
  { id: "search", label: "AI Search Studio", description: "Permission-aware command and search experience.", icon: Sparkles, group: "Control" },
  { id: "version", label: "Version Management", description: "Release history, evidence and rollback design.", icon: GitBranch, group: "Control" },
  { id: "weather", label: "Weather Settings", description: "Organizational Weather preferences and provider contract.", icon: CloudSun, group: "Experience" },
  { id: "market", label: "Market Intelligence AI", description: "Evidence-first farm price and demand intelligence.", icon: Globe2, group: "Intelligence" },
  { id: "logs", label: "Logs & Observability", description: "Audit, diagnostics, monitoring and correlation.", icon: Terminal, group: "Assurance" },
  { id: "alerting", label: "Notifications & Alerting", description: "Site-wide Owner attention, escalation and targeted notices.", icon: Bell, group: "Assurance" },
  { id: "knowledge", label: "Knowledge & Training", description: "Documentation, help, learning and walkthroughs.", icon: BookOpen, group: "Enablement" },
  { id: "communications", label: "Communications Hub", description: "WhatsApp, Email and SMS provider-ready workspace.", icon: MessageSquare, group: "Operations" },
  { id: "editorial", label: "Sign-In Editorial", description: "Owner-approved Daily Spotlight and Employee Inspiration.", icon: BookOpen, group: "Experience" },
  { id: "modules", label: "Farm Operations Configuration", description: "Permission-safe register of Farms ERP capabilities.", icon: Settings2, group: "Operations" },
  { id: "integrations", label: "Integrations & Providers", description: "Server gateways and provider health contracts.", icon: Database, group: "Assurance" },
  { id: "help", label: "Help & Support Studio", description: "Contextual help, support routing and user success.", icon: LifeBuoy, group: "Enablement" },
];

const studioGroups = [
  "Menu & Navigation Studio",
  "Permission & Role Studio",
  "AI Search Studio",
  "Widget Control Studio",
  "Weather Settings Studio",
  "Version Management Studio",
  "Help & Support Studio",
  "Notification Studio",
  "Profile & Account Studio",
  "Theme & Glow Studio",
  "Business / Farm Area Studio",
  "System Status Studio",
  "Admin Center Core Studio",
  "Security & Authentication Studio",
  "Market Intelligence AI Studio",
  "Logs, Audit & Observability Studio",
  "Knowledge, Training & Documentation Studio",
  "Communications Studio",
  "Workflow & Automation Studio",
  "Farm Operations Configuration Studio",
  "Integrations & Provider Studio",
  "Analytics & Reporting Studio",
  "Data, Files & Evidence Studio",
  "PWA, Mobile & Offline Studio",
  "Content, News & Announcement Studio",
  "Release, Deployment & Recovery Studio",
];

const searchDestinations = [
  ["Farm Operations", "Module", "modules"],
  ["Security & Authentication", "Settings", "security"],
  ["Market Intelligence AI", "Workspace", "market"],
  ["System Logs & Audit", "Assurance", "logs"],
  ["Notifications & Alerting", "Assurance", "alerting"],
  ["Knowledge & Training", "Enablement", "knowledge"],
  ["Weather Settings", "Experience", "weather"],
  ["Version Center", "Release", "version"],
  ["Provider Integrations", "System", "integrations"],
] as const;

const moduleFamilies = [
  ["Farm Operations", ["Poultry", "Eggs", "Flocks", "Brooding", "Pens / Housing", "Bird Movements", "Mortality", "Culling", "Vaccinations", "Medication", "Disease Events", "Weight Tracking"]],
  ["Livestock & Products", ["Feed", "Feed Formulation", "Feed Manufacturing", "Pigs", "Goats", "Snails", "Organic Products / Manure", "Biosecurity", "Veterinary Records"]],
  ["Commerce & Supply", ["Inventory", "Stores", "Procurement", "Suppliers", "Customers", "Wholesale Distributors", "Quotations", "Orders", "Invoices", "Payment Tracking", "Dispatch", "Delivery"]],
  ["Finance & People", ["Expenses", "Cash / Bank / POS", "Assets", "Machinery / Equipment", "Maintenance", "Fuel", "Water", "Power", "Staff", "Attendance", "Payroll", "Leave", "Loans", "Payslips", "Performance", "Discipline", "Recruitment"]],
  ["Control & Enablement", ["Tasks", "Approvals", "Documents", "Reporting", "Compliance", "Farm Incident Reporting", "Security", "Cameras", "Tracking", "Geofencing", "Audit", "Notifications", "Chat", "Notice Board", "Knowledge", "Training", "Files", "Offline / Sync", "PWA"]],
] as const;

const products = ["Live Chicken", "Fresh Eggs / Crate", "Pigs", "Goats", "Snails", "Chicken Feed", "Organic Manure / Products"];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "amber" | "green" | "red" }) {
  return <span className={`${styles.badge} ${styles[`badge${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>{children}</span>;
}

function EmptyState({ title, detail, icon: Icon = Database }: { title: string; detail: string; icon?: IconType }) {
  return <div className={styles.emptyState}><span className={styles.emptyIcon}><Icon aria-hidden="true" /></span><div><strong>{title}</strong><p>{detail}</p></div></div>;
}

function Surface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`${styles.surface} ${className}`}>{children}</section>;
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

export default function AdminCenter({ onExit, isOwner = false }: { onExit: () => void; isOwner?: boolean }) {
  const [active, setActive] = useState<StudioId>("overview");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<"day" | "night">("day");
  const [weatherUnit, setWeatherUnit] = useState<"F" | "C">("F");
  const [minimumLength, setMinimumLength] = useState(6);
  const [policySaved, setPolicySaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchDestinations;
    return searchDestinations.filter(([label, category]) => `${label} ${category}`.toLowerCase().includes(normalized));
  }, [query]);
  const visibleStudios = studios.filter((item) => isOwner || item.id !== "editorial");
  const selected = visibleStudios.find((item) => item.id === active) ?? visibleStudios[0];

  function navigate(next: string) {
    if (visibleStudios.some((item) => item.id === next)) setActive(next as StudioId);
    setSearchOpen(false);
    setQuery("");
  }

  return <div className={`${styles.shell} ${theme === "night" ? styles.night : ""}`} data-testid="farms-admin-center">
    <header className={styles.topbar}>
      <div className={styles.brandBlock}><div className={styles.brandMark}>D</div><div><strong>Daenem Farms</strong><span>Owner Administration</span></div></div>
      <div className={styles.commandBar}>
        <Search aria-hidden="true" />
        <input aria-label="AI Search" value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Search people, farms, settings, help…" />
        <kbd>⌘ K</kbd>
        {searchOpen && <div className={styles.searchPopover} role="dialog" aria-label="AI Search results"><div className={styles.searchPopoverHead}><span><Sparkles size={15} /> Authorized suggestions</span><button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={15} /></button></div>{query && <div className={styles.ghostHint}>Try <strong>“{query} settings”</strong> · Search is grounded to your permitted Farm scope.</div>}<div className={styles.searchResults}>{matches.map(([label, category, destination]) => <button key={label} type="button" onClick={() => navigate(destination)}><span className={styles.resultIcon}><ArrowUpRight size={15} /></span><span><strong>{label}</strong><small>{category} · Owner access</small></span><ChevronRight size={15} /></button>)}</div>{!matches.length && <p className={styles.searchEmpty}>No authorized destination matches this query.</p>}<div className={styles.searchFoot}><History size={14} /> Recent and hidden destinations are permission-filtered.</div></div>}
      </div>
      <div className={styles.topActions}>
        <button type="button" className={styles.topAction} onClick={() => navigate("help")}><CircleHelp size={17} /><span>Help</span></button>
        <button type="button" className={styles.topAction} onClick={() => navigate("weather")}><CloudSun size={17} /><span>{weatherUnit}°</span></button>
        <button type="button" className={styles.topAction} onClick={() => navigate("version")}><GitBranch size={17} /><span>Versions</span></button>
        <button type="button" className={styles.topAction} onClick={() => navigate("alerting")}><Bell size={17} /><span>Alerts</span><i className={styles.alertDot} /></button>
        <button type="button" className={styles.topAction} onClick={() => navigate("overview")}><UsersRound size={17} /><span>Profile</span></button>
        <button type="button" className={styles.themeButton} onClick={() => setTheme(theme === "day" ? "night" : "day")} aria-label="Toggle display theme">{theme === "day" ? <Moon size={17} /> : <Sun size={17} />}</button>
      </div>
    </header>

    <div className={styles.body}>
      <aside className={styles.rail}>
        <div className={styles.railHeader}><div><span className={styles.eyebrow}>Control Plane</span><strong>Farms Admin</strong></div><button type="button" aria-label="Collapse navigation"><PanelLeft size={17} /></button></div>
        <nav className={styles.railNav} aria-label="Admin Studios">
          <span className={styles.navLabel}>Core workspaces</span>
          {visibleStudios.map((item) => { const Icon = item.icon; return <button type="button" className={active === item.id ? styles.navItemActive : styles.navItem} key={item.id} onClick={() => setActive(item.id)}><Icon size={17} /><span>{item.label}</span>{item.id === "overview" && <Badge tone="blue">Owner</Badge>}</button>; })}
          <button type="button" className={styles.navItem} onClick={() => setExpanded(!expanded)}><Menu size={17} /><span>All Admin Studios</span><ChevronRight size={15} className={expanded ? styles.rotate : ""} /></button>
          {expanded && <div className={styles.studioDirectory}>{studioGroups.map((name) => <div key={name}><span>{name}</span><small>Design ready · backend boundary</small></div>)}</div>}
        </nav>
        <div className={styles.railFooter}><ShieldCheck size={16} /><div><strong>Owner-only surface</strong><span>No production writes in this review pass.</span></div></div>
      </aside>

      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb"><ol className={styles.breadcrumbList}><li><button type="button" onClick={onExit}>Farm Overview</button><ChevronRight aria-hidden="true" size={14} /></li>{selected.id !== "overview" && <li><button type="button" onClick={() => navigate("overview")}>Admin Center</button><ChevronRight aria-hidden="true" size={14} /></li>}<li><span aria-current="page">{selected.label}</span></li><li className={styles.breadcrumbMeta}><Badge tone="amber">RELEASE STATUS UNAVAILABLE</Badge><span className={styles.savedState}><span />Review mode</span></li></ol></nav>
        {active === "overview" && <Overview onNavigate={navigate} isOwner={isOwner} />}
        {active === "security" && <Security minimumLength={minimumLength} setMinimumLength={setMinimumLength} saved={policySaved} save={() => setPolicySaved(true)} />}
        {active === "search" && <SearchStudio query={query} setQuery={setQuery} navigate={navigate} />}
        {active === "version" && <VersionCenter onNavigate={navigate} />}
        {active === "weather" && <WeatherSettings unit={weatherUnit} setUnit={setWeatherUnit} />}
        {active === "market" && <MarketIntelligence />}
        {active === "logs" && <Logs />}
        {active === "alerting" && <Alerting />}
        {active === "knowledge" && <Knowledge />}
        {active === "communications" && <Communications />}
        {active === "editorial" && isOwner && <GatewayEditorialStudio />}
        {active === "modules" && <Modules />}
        {active === "integrations" && <Integrations />}
        {active === "help" && <Help />}
      </main>
    </div>
  </div>;
}

function Overview({ onNavigate, isOwner }: { onNavigate: (id: string) => void; isOwner: boolean }) {
  return <div className={styles.page}>
    <SectionHeading eyebrow="Owner command center" title="Administer Farms from Farms." detail="One governed control plane for identity, experience, intelligence and evidence. Every card below states its backend boundary." action={<button type="button" className={styles.primaryButton} onClick={() => onNavigate("security")}><KeyRound size={16} />Review Security Policy</button>} />
    <div className={styles.heroGrid}><div className={styles.heroPanel}><div className={styles.heroOrb}><ShieldCheck size={24} /></div><div><span className={styles.eyebrow}>Sovereign Farms administration</span><h2>Keep the operational truth close to the work.</h2><p>Portal-owned administration is designed here. WebAdmin is not required for Farms configuration.</p><div className={styles.inlineMeta}><Badge tone="amber">Owner authorization not verified here</Badge><Badge>Production writes disabled</Badge><Badge tone="amber">Backend contracts visible</Badge></div></div></div><div className={styles.healthPanel}><div className={styles.healthHeader}><span>System posture</span><Activity size={17} /></div><div className={styles.healthRow}><span>Public Sign-In</span><strong>Release metadata unavailable</strong><i className={styles.healthWarn} /></div><div className={styles.healthRow}><span>Weather provider</span><strong>Not configured</strong><i className={styles.healthWarn} /></div><div className={styles.healthRow}><span>AI provider</span><strong>Not configured</strong><i className={styles.healthWarn} /></div><div className={styles.healthRow}><span>Audit stream</span><strong>Backend required</strong><i className={styles.healthWarn} /></div></div></div>
    <div className={styles.cardGrid}><ActionCard icon={KeyRound} title="Security & Authentication" detail="Default password minimum 6 characters. Policy controls are designed here and explicitly unbound until the auth backend reads them." status="Backend integration required" onClick={() => onNavigate("security")} /><ActionCard icon={Sparkles} title="AI Search" detail="Typing-ahead command surface with permission-filtered destinations and no hidden module disclosure." status="UI ready · provider not configured" onClick={() => onNavigate("search")} /><ActionCard icon={Globe2} title="Market Intelligence AI" detail="Farm price intelligence with radius, evidence, freshness and confidence contracts." status="No verified market observation" onClick={() => onNavigate("market")} /><ActionCard icon={Terminal} title="Logs & Observability" detail="Forensic log, audit, diagnostics, monitoring and correlation workspace." status="Log stream not connected" onClick={() => onNavigate("logs")} /><ActionCard icon={Bell} title="Notifications & Alerting" detail="Site-wide Owner attention, escalation, acknowledgement and targeted user notices." status="Delivery providers required" onClick={() => onNavigate("alerting")} /><ActionCard icon={BookOpen} title="Knowledge & Training" detail="Help center, guides, courses and AI knowledge assistant boundary." status="Content pipeline required" onClick={() => onNavigate("knowledge")} /><ActionCard icon={MessageSquare} title="Communications Hub" detail="WhatsApp Business, Email and SMS queues designed for future provider integration." status="Provider required" onClick={() => onNavigate("communications")} /></div>
    <Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Authorized quick actions</span><h2>Move from decision to the right studio.</h2></div><span className={styles.surfaceNote}>No action below writes production data.</span></div><div className={styles.quickGrid}><QuickAction label="Manage navigation" icon={Menu} note="Menu & Navigation Studio" onClick={() => onNavigate("modules")} /><QuickAction label="Review versions" icon={FileClock} note="Version Center" onClick={() => onNavigate("version")} /><QuickAction label="Configure Weather" icon={CloudSun} note="Default unit · Fahrenheit" onClick={() => onNavigate("weather")} /><QuickAction label="Open Help Center" icon={LifeBuoy} note="Documentation & support" onClick={() => onNavigate("help")} />{isOwner && <QuickAction label="Publish Sign-In content" icon={BookOpen} note="Daily Spotlight & Employee Inspiration" onClick={() => onNavigate("editorial")} />}</div></Surface>
  </div>;
}

function ActionCard({ icon: Icon, title, detail, status, onClick }: { icon: IconType; title: string; detail: string; status: string; onClick: () => void }) {
  return <button type="button" className={styles.actionCard} onClick={onClick}><span className={styles.actionIcon}><Icon size={20} /></span><span className={styles.actionCopy}><strong>{title}</strong><p>{detail}</p><small>{status}</small></span><ArrowUpRight size={17} /></button>;
}

function QuickAction({ label, note, icon: Icon, onClick }: { label: string; note: string; icon: IconType; onClick: () => void }) {
  return <button type="button" className={styles.quickAction} onClick={onClick}><span className={styles.quickIcon}><Icon size={17} /></span><span><strong>{label}</strong><small>{note}</small></span><ChevronRight size={15} /></button>;
}

function Security({ minimumLength, setMinimumLength, saved, save }: { minimumLength: number; setMinimumLength: (value: number) => void; saved: boolean; save: () => void }) {
  return <div className={styles.page}><SectionHeading eyebrow="Security & Authentication Studio" title="Make policy explicit." detail="Admin-configurable defaults are visible without pretending that frontend controls enforce authentication." action={<Badge tone="amber">BACKEND INTEGRATION REQUIRED</Badge>} /><div className={styles.twoColumn}><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Password policy</span><h2>Default account protection</h2></div><LockKeyhole size={19} /></div><div className={styles.policyHero}><strong>{minimumLength}</strong><span>characters<br /><small>default minimum</small></span></div><label className={styles.rangeField}>Minimum password length <output>{minimumLength}</output><input type="range" min={6} max={32} value={minimumLength} onChange={(event) => setMinimumLength(Number(event.target.value))} /></label><div className={styles.policyOptions}><PolicyToggle label="Uppercase required" /><PolicyToggle label="Lowercase required" /><PolicyToggle label="Number required" /><PolicyToggle label="Symbol required" /><PolicyToggle label="Password history" /><PolicyToggle label="Common-password protection" /></div><div className={styles.boundaryCallout}><ShieldCheck size={17} /><span><strong>Configuration contract</strong><small>The authentication backend must read this same policy. No production enforcement was changed in this pass.</small></span></div><button type="button" className={styles.secondaryButton} onClick={save}><Check size={15} />{saved ? "Policy draft noted" : "Save policy draft"}</button></Surface><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Authentication controls</span><h2>Provider posture</h2></div><Badge>Owner-only</Badge></div><ProviderRow name="Password authentication" detail="Default minimum · 6 characters" status="Design contract" icon={LockKeyhole} /><ProviderRow name="Microsoft" detail="Provider button and callback contract" status="Not connected" icon={Globe2} /><ProviderRow name="Google" detail="Provider button and callback contract" status="Not connected" icon={Globe2} /><ProviderRow name="MFA / recovery" detail="Organization policy and recovery behavior" status="Backend integration required" icon={ShieldCheck} /><div className={styles.noteBox}><strong>Safe boundary</strong><p>Visual policy controls cannot grant roles, bypass sessions, expose secrets or change the public Sign-In.</p></div></Surface></div></div>;
}

function PolicyToggle({ label }: { label: string }) {
  const [on, setOn] = useState(false);
  return <label className={styles.policyToggle}><span>{label}</span><button type="button" aria-pressed={on} onClick={() => setOn(!on)} className={on ? styles.switchOn : styles.switchOff}><i /></button><small>{on ? "On" : "Off"}</small></label>;
}

function ProviderRow({ name, detail, status, icon: Icon }: { name: string; detail: string; status: string; icon: IconType }) {
  return <div className={styles.providerRow}><span className={styles.providerIcon}><Icon size={17} /></span><span><strong>{name}</strong><small>{detail}</small></span><Badge tone={status === "Not connected" ? "amber" : "neutral"}>{status}</Badge><button type="button" className={styles.textButton}>Configure</button></div>;
}

function SearchStudio({ query, setQuery, navigate }: { query: string; setQuery: (value: string) => void; navigate: (id: string) => void }) {
  const results = searchDestinations.filter(([label, category]) => `${label} ${category}`.toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.page}><SectionHeading eyebrow="AI Search Studio" title="Find the next permitted action." detail="A command experience for Farms, grounded in authorization before ranking, suggestion or history." action={<Badge tone="blue">Provider-agnostic UI</Badge>} /><Surface className={styles.searchStudio}><div className={styles.searchHero}><div className={styles.aiOrb}><Sparkles size={30} /></div><div><h2>Typing-ahead intelligence</h2><p>Search modules, settings, help and authorized records without revealing anything outside the current scope.</p></div></div><div className={styles.largeSearch}><Search size={19} /><input autoFocus aria-label="Search authorized Farms destinations" placeholder="Try “password policy”, “Weather”, or “market price”" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></div>{query && <div className={styles.ghostHint}>Prediction: <strong>{query} settings</strong> <span>· Press Enter to inspect the highest-ranked authorized result.</span></div>}<div className={styles.searchResultGrid}>{(results.length ? results : [["No authorized result", "Search", "overview"]] as const).map(([label, category, id]) => <button type="button" className={styles.searchResultCard} key={label} onClick={() => navigate(id)}><span className={styles.resultIcon}><ArrowUpRight size={16} /></span><span><strong>{label}</strong><small>{category} · Permission-filtered</small></span><ChevronRight size={16} /></button>)}</div></Surface><div className={styles.twoColumn}><Surface><div className={styles.surfaceHeading}><h2>Authorized categories</h2><Badge tone="green">Zero disclosure</Badge></div><div className={styles.categoryList}>{["Employees", "Farm records", "Products", "Modules", "Files", "Reports", "Versions", "Help & documentation", "Settings", "Actions"].map((item) => <span key={item}><Check size={14} />{item}</span>)}</div></Surface><Surface><div className={styles.surfaceHeading}><h2>Search posture</h2><Activity size={17} /></div><div className={styles.statLine}><span>Ranking model</span><strong>Not connected</strong></div><div className={styles.statLine}><span>Search history</span><strong>Permission-filtered design</strong></div><div className={styles.statLine}><span>AI orb</span><strong>Reactive, bounded</strong></div><div className={styles.noteBox}><p>No AI request runs on keystrokes in this UI-only pass. Provider connection and server-side indexing are required.</p></div></Surface></div></div>;
}

function VersionCenter({ onNavigate }: { onNavigate: (id: string) => void }) {
  return <div className={styles.page}><SectionHeading eyebrow="Version Center" title="Know what is live before changing anything." detail="Release history is separated from the current public pointer. Rollback remains a deliberate backend operation." action={<Badge tone="amber">RELEASE METADATA UNAVAILABLE</Badge>} /><Surface><div className={styles.versionHero}><div><span className={styles.eyebrow}>Public Sign-In</span><h2>Review only</h2><p>No verified release pointer or saved version history is available in this candidate.</p></div><div className={styles.versionActions}><button type="button" className={styles.secondaryButton} onClick={() => onNavigate("overview")}><Archive size={15} />Release notes</button><button type="button" className={styles.primaryButton} onClick={() => onNavigate("security")}><ShieldCheck size={15} />Review safeguards</button></div></div><EmptyState title="No verified release records" detail="This review candidate has no release metadata endpoint. Live and saved release labels are withheld until a trusted source is connected." icon={FileClock} /></Surface><div className={styles.twoColumn}><Surface><div className={styles.surfaceHeading}><h2>Change evidence</h2><FileClock size={17} /></div><EmptyState title="Release audit stream not connected" detail="Changed by, affected areas and request correlation will appear when the authoritative audit backend is bound." icon={FileText} /></Surface><Surface><div className={styles.surfaceHeading}><h2>Rollback guard</h2><History size={17} /></div><p className={styles.bodyCopy}>A rollback target is visible for design review only. No pointer, deployment or production D1 row was changed in this pass.</p><button type="button" className={styles.secondaryButton} onClick={() => onNavigate("logs")}><Terminal size={15} />Inspect audit boundary</button></Surface></div></div>;
}

function VersionRow({ current = false, name, detail, meta }: { current?: boolean; name: string; detail: string; meta: string }) {
  return <div className={styles.versionRow}><span className={current ? styles.versionMarkerCurrent : styles.versionMarker}><Check size={14} /></span><span><strong>{name}</strong><small>{detail}</small></span><Badge tone={current ? "green" : "neutral"}>{meta}</Badge><button type="button" className={styles.textButton}>Compare</button></div>;
}

function WeatherSettings({ unit, setUnit }: { unit: "F" | "C"; setUnit: (unit: "F" | "C") => void }) {
  return <div className={styles.page}><SectionHeading eyebrow="Weather Settings Studio" title="Set the environmental language." detail="Fahrenheit is the organizational default. Provider data remains separate from display preferences." action={<Badge tone="blue">DEFAULT · FAHRENHEIT</Badge>} /><div className={styles.twoColumn}><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Display defaults</span><h2>Temperature and atmosphere</h2></div><CloudSun size={19} /></div><div className={styles.segmented}><button type="button" className={unit === "F" ? styles.segmentActive : ""} onClick={() => setUnit("F")}>°F Fahrenheit</button><button type="button" className={unit === "C" ? styles.segmentActive : ""} onClick={() => setUnit("C")}>°C Celsius</button></div><ProviderRow name="Primary Weather provider" detail="Current, hourly and daily contract" status="Provider required" icon={CloudSun} /><ProviderRow name="Farm / HQ locations" detail="Balogun-Ikire · Ibadan" status="Configured locations" icon={Globe2} /><div className={styles.policyOptions}><PolicyToggle label="Animated atmospheric states" /><PolicyToggle label="Reduced-motion safe" /></div></Surface><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Location register</span><h2>Supported locations</h2></div><Badge tone="amber">NO LIVE OBSERVATIONS</Badge></div>{["Daenem Farms — Balogun-Ikire", "HQ — Ibadan", "Toronto", "London", "New York", "Moscow", "Tokyo", "Beijing"].map((location) => <div className={styles.locationRow} key={location}><span className={styles.locationDot} /><strong>{location}</strong><small>Provider location ID required</small></div>)}</Surface></div><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Truthful data contract</span><h2>Unavailable means unavailable.</h2></div><Badge tone="amber">PROVIDER REQUIRED</Badge></div><div className={styles.dataContract}><span>Condition</span><strong>Weather Unavailable</strong><span>Temperature</span><strong>Not rendered without trusted observation</strong><span>Freshness</span><strong>Observed / Cached timestamp required</strong></div></Surface></div>;
}

function MarketIntelligence() {
  const [radius, setRadius] = useState("50 miles");
  return <div className={styles.page}><SectionHeading eyebrow="Market Intelligence AI · Farm Price Intelligence" title="Price with evidence, not guesses." detail="A dedicated decision workspace for Daenem products. Recommendations remain unavailable until a verified market source is connected." action={<Badge tone="amber">DATA SOURCE NOT CONFIGURED</Badge>} /><div className={styles.marketToolbar}><div className={styles.radiusGroup}><span>Analysis radius</span>{["10 miles", "20 miles", "30 miles", "50 miles", "70 miles", "100 miles", "200 miles", "Custom"].map((item) => <button type="button" key={item} className={radius === item ? styles.radiusActive : ""} onClick={() => setRadius(item)}>{item}</button>)}</div><Badge tone="blue">Window · 30 days</Badge></div><div className={styles.productGrid}>{products.map((product) => <article className={styles.productCard} key={product}><div className={styles.productHeader}><span className={styles.productIcon}><Globe2 size={16} /></span><div><strong>{product}</strong><small>{radius} · market scope</small></div></div><div className={styles.priceEmpty}><span>—</span><p>No verified market observation</p></div><div className={styles.productFooter}><Badge tone="amber">Evidence required</Badge><span>Confidence · —</span></div></article>)}</div><div className={styles.twoColumn}><Surface><div className={styles.surfaceHeading}><h2>Decision frame</h2><Gauge size={17} /></div><div className={styles.decisionGrid}>{[["Daenem price", "—"], ["Observed market low", "—"], ["Observed market high", "—"], ["Recommended price", "—"], ["Expected revenue impact", "—"], ["Expected demand impact", "—"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></Surface><Surface><div className={styles.surfaceHeading}><h2>Recommendation contract</h2><Bot size={17} /></div><EmptyState title="No recommendation generated" detail="HOLD / RAISE / REDUCE / MATCH / PROMOTE / BUNDLE / UPSELL require source, observed date, freshness, confidence and explanation." icon={Sparkles} /></Surface></div></div>;
}

function Logs() {
  return <div className={styles.page}><SectionHeading eyebrow="Logs · Audit · Observability" title="Follow the evidence trail." detail="A technical environment for request correlation, permission context, provider failures and release history." action={<Badge tone="amber">LOG STREAM NOT CONNECTED</Badge>} /><div className={styles.logToolbar}><div className={styles.filterChips}><button type="button" className={styles.filterActive}>All</button><button type="button">Errors</button><button type="button">Security</button><button type="button">Provider</button><button type="button">Release</button></div><button type="button" className={styles.secondaryButton}><Archive size={15} />Export contract</button></div><Surface><div className={styles.logTable}><div className={styles.logHeader}><span>Severity</span><span>Event</span><span>Source</span><span>Timestamp</span><span>State</span></div><EmptyState title="No connected log records" detail="No synthetic events are shown. The authoritative stream must supply timestamp, actor, target, request ID, correlation ID and sanitized error context." icon={Terminal} /></div></Surface><div className={styles.cardGrid}><ActionCard icon={ShieldCheck} title="Access Logs" detail="Sign-in, role, permission and security event families." status="Backend required" onClick={() => {}} /><ActionCard icon={Activity} title="System Health" detail="Application, APIs, database, jobs and provider state." status="Provider required" onClick={() => {}} /><ActionCard icon={FileClock} title="Change Audit" detail="Before/after state, version, evidence and actor context." status="Backend required" onClick={() => {}} /></div></div>;
}

function Knowledge() {
  return <div className={styles.page}><SectionHeading eyebrow="Knowledge · Training · Documentation" title="Help people succeed in the work." detail="A governed content platform for guides, lessons, troubleshooting and permission-aware answers." action={<Badge tone="amber">CONTENT PIPELINE REQUIRED</Badge>} /><div className={styles.knowledgeGrid}>{[[BookOpen, "Knowledge Base", "Purpose, setup, permissions, best practices and related articles."], [LifeBuoy, "Help Center", "Contextual help, FAQs and troubleshooting paths."], [FileText, "Documentation", "Owner, administrator, developer, API and feature documentation."], [Sparkles, "AI Knowledge Assistant", "Answers grounded only in authorized published documentation."], [Archive, "Training Academy", "Courses, lessons, quizzes, exams, badges and progress."], [UsersRound, "Walkthrough Library", "Approved interactive guides and annotated screenshots."]].map(([Icon, title, detail]) => { const I = Icon as IconType; return <button type="button" className={styles.knowledgeCard} key={title as string}><span className={styles.actionIcon}><I size={20} /></span><span><strong>{title as string}</strong><p>{detail as string}</p><small>Design ready · backend content required</small></span><ChevronRight size={16} /></button>; })}</div><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Article contract</span><h2>Every feature can teach itself.</h2></div><Badge tone="blue">CONTENT MODEL</Badge></div><div className={styles.articleChips}>{["Purpose", "Who can access it", "Setup", "Best practices", "Troubleshooting", "FAQ", "Security notes", "Examples", "Video", "Walkthroughs"].map((item) => <span key={item}>{item}</span>)}</div><div className={styles.boundaryCallout}><BookOpen size={17} /><span><strong>Permission-aware knowledge</strong><small>Restricted documentation, hidden modules and unauthorized AI context remain undisclosed.</small></span></div></Surface></div>;
}

function Alerting() {
  const [tab, setTab] = useState<"overview" | "rules" | "notices" | "history" | "email">("overview");
  const [severity, setSeverity] = useState("Critical");
  const [recipient, setRecipient] = useState("Owner");
  return <div className={styles.page}>
    <SectionHeading eyebrow="Site-Wide Owner / Admin Alerting" title="Bring important matters to the right person." detail="One governed alert service for Farms modules. Events become alerts, alerts become notifications, and delivery remains permission-aware and auditable." action={<Badge tone="amber">PROVIDERS REQUIRED FOR EXTERNAL DELIVERY</Badge>} />
    <div className={styles.segmented} style={{ flexWrap: "wrap", rowGap: 6 }}>{[["overview","Overview"],["rules","Rules"],["notices","Admin Notices"],["history","Delivery & History"],["email","Email Settings"]].map(([id,label]) => <button type="button" key={id} className={tab === id ? styles.segmentActive : ""} onClick={() => setTab(id as typeof tab)}>{label}</button>)}</div>
    {tab === "email" && <RegistrationEmailSettings />}
    {tab === "overview" && <><div className={styles.cardGrid}><ActionCard icon={Activity} title="Open Attention Items" detail="Critical system, finance, security, operational and integration events converge here after permission filtering." status="Authoritative event stream required" onClick={() => setTab("history")} /><ActionCard icon={ShieldCheck} title="Zero Disclosure" detail="An alert is generated and delivered only when the recipient is authorized to know the underlying record or condition." status="Mandatory boundary" onClick={() => {}} /><ActionCard icon={Bell} title="Acknowledgement & Escalation" detail="Critical or configured alerts remain active until acknowledged, actioned or resolved." status="Rule-driven" onClick={() => setTab("rules")} /></div><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Canonical flow</span><h2>Event → Alert → Notification → Acknowledgement → Resolution</h2></div><Activity size={17} /></div><div className={styles.queueGrid}>{["Event detected","Alert created / deduplicated","Channels planned","Delivered / viewed","Acknowledged / actioned","Resolved / audited"].map((item) => <div key={item}><strong>{item}</strong><small>One traceable lifecycle</small></div>)}</div><EmptyState title="No connected site-wide alert stream" detail="No live incident, payment, security, approval or provider event is fabricated in this review surface. Modules can publish into the shared alert contract when backend bindings are connected." icon={Bell} /></Surface></>}
    {tab === "rules" && <><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Notification rule</span><h2>Event → Severity → Recipient → Channel → Escalation</h2></div><Badge tone="blue">ADMIN CONFIGURABLE</Badge></div><div className={styles.dataContract}><span>Critical</span><strong>WhatsApp + Email + In-App + Pop-Up</strong><span>High</span><strong>WhatsApp + In-App</strong><span>Medium</span><strong>Email + In-App</strong><span>Low</span><strong>In-App Only</strong><span>Quiet Hours</span><strong>Configurable; Critical may override</strong><span>Deduplication</span><strong>Repeated events group into one alert</strong></div></Surface><div className={styles.cardGrid}><ActionCard icon={Gauge} title="Severity & Thresholds" detail="Critical / High / Medium / Low with module-specific conditions and configurable thresholds." status="No hard-coded business thresholds" onClick={() => {}} /><ActionCard icon={UsersRound} title="Recipients" detail="User, role, department/group or all authorized users, always checked against underlying record permission." status="Permission-aware" onClick={() => {}} /><ActionCard icon={History} title="Escalation" detail="Escalate when configured acknowledgement or resolution deadlines are missed; suppress notification storms." status="Cooldown + recurrence" onClick={() => {}} /></div></>}
    {tab === "notices" && <><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Admin-to-user notice</span><h2>Target an authorized audience without leaving the platform.</h2></div><Badge tone="amber">NO SEND IN REVIEW MODE</Badge></div><div className={styles.twoColumn}><label className={styles.policyToggle}><span>Severity</span><select value={severity} onChange={(e) => setSeverity(e.target.value)}><option>Normal</option><option>Important</option><option>Warning</option><option>Critical</option><option>Required Action</option></select><small>Controls prominence and acknowledgement policy.</small></label><label className={styles.policyToggle}><span>Recipient</span><select value={recipient} onChange={(e) => setRecipient(e.target.value)}><option>Owner</option><option>Individual User</option><option>Multiple Users</option><option>Role</option><option>Department / Group</option><option>All Authorized Users</option></select><small>Final recipients are permission filtered.</small></label></div><label className={styles.policyToggle}><span>Notice</span><textarea rows={4} placeholder="Write the notice users should receive..."/><small>Important notices may appear on the screen the user is currently using.</small></label><div className={styles.inlineMeta}><Badge>In-App</Badge><Badge>Pop-Up</Badge><Badge tone="amber">WhatsApp Provider Required</Badge><Badge tone="amber">Email Provider Required</Badge></div><button type="button" className={styles.primaryButton} disabled><Send size={15} />Send Disabled In Review Mode</button></Surface></>}
    {tab === "history" && <><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Delivery and acknowledgement</span><h2>Sent → Delivered → Viewed → Acknowledged → Actioned</h2></div><FileClock size={17} /></div><EmptyState title="No authoritative alert history connected" detail="History will record trigger, severity, recipient, channel, delivery state, view state, acknowledgement, related record and resolution without fabricating events." icon={FileClock} /></Surface><div className={styles.cardGrid}><ActionCard icon={MessageSquare} title="WhatsApp" detail="Uses the existing approved Communications provider boundary, templates, consent/routing and delivery events." status="Provider required" onClick={() => {}} /><ActionCard icon={Send} title="Email" detail="Uses the shared Communications delivery boundary rather than a second email stack." status="Provider required" onClick={() => {}} /><ActionCard icon={Bell} title="In-App & Pop-Up" detail="Immediate application delivery with acknowledgement when configured." status="Backend binding required" onClick={() => {}} /></div></>}
  </div>;
}
function Communications() {
  const [area, setArea] = useState<"overview" | "privacy">("overview");
  return <div className={styles.page}>
    <SectionHeading eyebrow="Communications Studio" title="One queue for approved conversations." detail="WhatsApp Business, Email and SMS are represented as provider-ready channels. No Meta, email or SMS connection is implied." action={<Badge tone="amber">PROVIDER REQUIRED</Badge>} />
    <div className={styles.segmented} role="tablist" aria-label="Communications areas">
      <button type="button" role="tab" aria-selected={area === "overview"} className={area === "overview" ? styles.segmentActive : ""} onClick={() => setArea("overview")}>Channels & Queue</button>
      <button type="button" role="tab" aria-selected={area === "privacy"} className={area === "privacy" ? styles.segmentActive : ""} onClick={() => setArea("privacy")}>WhatsApp Privacy &amp; Routing</button>
    </div>
    {area === "overview" && <><div className={styles.channelGrid}>{[[MessageSquare, "WhatsApp Business", "Multiple Farms numbers · queues · assignment · templates"], [Send, "Email", "Inbound/outbound thread contract · delivery state"], [MessageSquare, "SMS", "Routing · business hours · escalation"]].map(([Icon, name, detail]) => { const I = Icon as IconType; return <article className={styles.channelCard} key={name as string}><span className={styles.channelIcon}><I size={21} /></span><div><strong>{name as string}</strong><p>{detail as string}</p></div><Badge tone="amber">Not connected</Badge><button type="button" className={styles.secondaryButton}>Configure</button></article>; })}</div><Surface><div className={styles.surfaceHeading}><h2>Queue and audit model</h2><Activity size={17} /></div><div className={styles.queueGrid}>{["View", "Reply", "Assign", "Manage"].map((permission) => <div key={permission}><strong>{permission}</strong><small>Permission gate</small></div>)}</div><EmptyState title="No inbound conversations" detail="Provider connectivity is required before messages, delivery state, attachments, notes or analytics can appear." icon={MessageSquare} /></Surface></>}
    {area === "privacy" && <>
      <Surface>
        <div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Owner / Admin · WhatsApp</span><h2>Privacy &amp; Routing</h2></div><Badge tone="amber">SERVER CONTRACT REQUIRED</Badge></div>
        <p className={styles.bodyCopy}>Contact exclusions must be enforced before inbox persistence, search, notifications, analytics, exports and website replies. No privacy rules or live conversations are connected in this candidate.</p>
        <div className={styles.dataContract}>
          <span>Shared Inbox</span><strong>Allowed · Hidden · Owner Only</strong>
          <span>Website Reply</span><strong>Allowed · Blocked</strong>
          <span>Notifications</span><strong>On · Muted</strong>
          <span>Message retention</span><strong>Normal · Redacted · Minimal audit</strong>
          <span>Historical import</span><strong>Include · Exclude, when provider permits</strong>
          <span>Rule management</span><strong>E.164 · bulk import · expiry · preview · audit · emergency pause</strong>
        </div>
        <div className={styles.boundaryCallout}><LockKeyhole size={17} /><span><strong>Controls unavailable until server enforcement is connected</strong><small>This frontend contract has no privacy-rule endpoint, rule schema, revision token, or server-derived Owner/Admin authorization decision. Settings are read-only here; no browser-side permission or policy state is accepted.</small></span></div>
      </Surface>
      <Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Truthful connection state</span><h2>No provider or inbox state is implied.</h2></div><MessageSquare size={17} /></div><EmptyState title="WhatsApp coexistence and private inbox are not connected" detail="No data request is made because the authenticated portal API does not expose a privacy endpoint. The existing WhatsApp provider state remains integration required." icon={MessageSquare} /></Surface>
    </>}
  </div>;
}

function Modules() {
  return <div className={styles.page}><SectionHeading eyebrow="Farm Operations Configuration" title="Keep the register honest." detail="The Farms capability map remains reachable without declaring a backend module operational when it is only designed." action={<Badge tone="blue">ZERO FABRICATED METRICS</Badge>} /><div className={styles.moduleFamilies}>{moduleFamilies.map(([family, items]) => <Surface key={family}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Capability family</span><h2>{family}</h2></div><Badge tone="amber">BACKEND REQUIRED</Badge></div><div className={styles.moduleList}>{items.map((item) => <div className={styles.moduleItem} key={item}><span className={styles.moduleIcon}><Check size={13} /></span><span><strong>{item}</strong><small>Reachability contract preserved · operational data not connected</small></span><ChevronRight size={14} /></div>)}</div></Surface>)}</div></div>;
}

function Integrations() {
  return <div className={styles.page}><SectionHeading eyebrow="Integrations & Provider Studio" title="Connect the source, then show the state." detail="Provider gateways are server-side contracts. No credentials are displayed, stored in page documents or sent to the browser." action={<Badge tone="amber">NO PROVIDERS CONNECTED</Badge>} /><div className={styles.integrationGrid}>{[[Bot, "AI", "Image understanding · text assistant · critique"], [CloudSun, "Weather", "Current · hourly · daily · alerts · freshness"], [Globe2, "Maps", "Farm locations · global operations · overlays"], [FileText, "News", "Real headlines · source · timestamp"], [Archive, "Calendar", "Events · agenda · approvals"], [MessageSquare, "Social / Traffic", "Provider-ready adapters"]].map(([Icon, name, detail]) => { const I = Icon as IconType; return <article className={styles.integrationCard} key={name as string}><span className={styles.integrationIcon}><I size={18} /></span><div><strong>{name as string}</strong><p>{detail as string}</p><small>Provider Required · Test connection unavailable</small></div><button type="button" className={styles.secondaryButton}>Configure</button></article>; })}</div><Surface><div className={styles.surfaceHeading}><h2>Secret boundary</h2><LockKeyhole size={17} /></div><div className={styles.boundaryCallout}><ShieldCheck size={17} /><span><strong>Server gateway only</strong><small>Secrets belong in platform-supported server-side environment storage. No client SDK, D1 plaintext configuration or page design document receives a secret.</small></span></div></Surface></div>;
}

function Help() {
  return <div className={styles.page}><SectionHeading eyebrow="Help & Support Studio" title="Make the next answer easy to find." detail="A calm support surface with contextual help, documentation, troubleshooting and role-safe routing." action={<Badge tone="blue">OWNER CONFIGURABLE</Badge>} /><div className={styles.helpGrid}>{[[LifeBuoy, "Help Center", "Search published guides and supported workflows."], [CircleHelp, "FAQs", "Answer the questions people ask at the point of work."], [BookOpen, "Documentation", "Link permissions, setup, examples and advanced usage."], [MessageSquare, "Support Requests", "Route configured support channels with status and ownership."], [Sparkles, "Knowledge Assistant", "Explain authorized documentation without disclosing hidden areas."], [Archive, "Release Notes", "Connect version changes to affected workflows."]].map(([Icon, title, detail]) => { const I = Icon as IconType; return <button type="button" className={styles.helpCard} key={title as string}><span className={styles.actionIcon}><I size={19} /></span><span><strong>{title as string}</strong><p>{detail as string}</p></span><ArrowUpRight size={16} /></button>; })}</div><Surface><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Contextual support contract</span><h2>Relevant help, not a wall of links.</h2></div><Badge tone="green">PERMISSION-AWARE</Badge></div><p className={styles.bodyCopy}>The platform can attach help to a page, role, workflow and state. Provider-backed support contact details remain unconfigured until an authorized channel is connected.</p></Surface></div>;
}
