"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Bot, ChevronRight, CloudRain, CloudSun, Download, Droplets,
  Gauge, HeartHandshake, Lightbulb, Monitor, Moon, Navigation, Newspaper,
  PanelsTopLeft, Radio, RefreshCw, ShieldCheck, Sparkles, Sun, Sunrise, Sunset,
  ThermometerSun, Wifi, Wind, X,
} from "lucide-react";
import { initialClockLocations } from "@/lib/experience-model";

export type SignInColorMode = "daylight" | "dark" | "auto";
type IntelligenceSurface =
  | "farm-weather" | "hq-weather" | "clocks" | "news"
  | "ai" | "motivation" | "status" | "menu";

type Props = {
  placement: "adaptive";
  mode: SignInColorMode;
  onModeChange: (mode: SignInColorMode) => void;
};

// Keep the forecast contract ready for a provider without rendering
// plausible observations while no verified source is connected.
const farmHourly = [
  ["Now", "—°", "—"], ["+3h", "—°", "—"], ["+6h", "—°", "—"],
  ["+9h", "—°", "—"], ["+12h", "—°", "—"], ["+15h", "—°", "—"],
];
const farmDaily = [
  ["Today", "—°", "—°", "—"], ["Tomorrow", "—°", "—°", "—"],
  ["Monday", "—°", "—°", "—"], ["Tuesday", "—°", "—°", "—"],
  ["Wednesday", "—°", "—°", "—"],
];

function zonedParts(now: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { hour: n("hour"), minute: n("minute"), second: n("second") };
}

function DigitalTime({ now, zone }: { now: Date; zone: string }) {
  return <>
    <strong>{new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true,
    }).format(now)}</strong>
    <small>{new Intl.DateTimeFormat("en-US", {
      timeZone: zone, weekday: "short", month: "short", day: "numeric",
    }).format(now)}</small>
  </>;
}

function AnalogClock({ now, zone, label }: { now: Date; zone: string; label: string }) {
  const { hour, minute, second } = zonedParts(now, zone);
  const isDay = hour >= 6 && hour < 18;
  return <article className="intel-clock" data-phase={isDay ? "day" : "night"}>
    <div className="analog-clock" aria-hidden="true"
      style={{ "--second-start": `${second * 6}deg` } as React.CSSProperties}>
      <span className="clock-orbit" />
      {[0,1,2,3,4,5,6,7,8,9,10,11].map((tick) =>
        <i key={tick} style={{ transform: `rotate(${tick * 30}deg)` }} />)}
      <b className="hour-hand" style={{ transform: `rotate(${hour * 30 + minute / 2}deg)` }} />
      <b className="minute-hand" style={{ transform: `rotate(${minute * 6 + second / 10}deg)` }} />
      <b className="second-hand" />
      <span className="clock-pin" />
    </div>
    <div className="clock-copy">
      <span className="clock-label">{label}</span>
      <DigitalTime now={now} zone={zone} />
      <em>{zone.replaceAll("_", " ")}</em>
    </div>
  </article>;
}

function ModeSelector({ mode, onModeChange }: Pick<Props, "mode" | "onModeChange">) {
  const modes = [["daylight", "Daylight", Sun], ["dark", "Dark", Moon], ["auto", "Auto", Monitor]] as const;
  return <div className="signin-mode-selector" role="group" aria-label="Appearance mode">
    {modes.map(([value, label, Icon]) => <button key={value} type="button"
      aria-pressed={mode === value} className={mode === value ? "is-active" : ""}
      onClick={() => onModeChange(value)}>
      <Icon aria-hidden="true" /><span>{label}</span>
    </button>)}
  </div>;
}

function TruthBadge({ children }: { children: React.ReactNode }) {
  return <span className="truth-badge"><Radio aria-hidden="true" />{children}</span>;
}

function FarmWeatherSummary({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="farm-weather-summary" onClick={onOpen}
    aria-label="Open Daenem Farm weather intelligence">
    <span className="weather-light" aria-hidden="true"><CloudSun /></span>
    <span className="weather-place">
      <small>DAENEM FARM · BALOGUN-IKIRE</small>
      <strong>Farm Weather Intelligence</strong>
      <em>Illustrative readings · Live provider pending</em>
    </span>
    <span className="weather-temperature"><b>—°</b><small>Feels —</small></span>
    <span className="weather-condition"><strong>Provider unavailable</strong>
      <small><Droplets /> — <Wind /> —</small></span>
    <span className="weather-open">Full outlook <ChevronRight /></span>
  </button>;
}

function WeatherCard({
  kind,
  onOpen,
}: {
  kind: "farm" | "hq";
  onOpen: () => void;
}) {
  const farm = kind === "farm";
  const Icon = farm ? Sun : CloudSun;
  return <button
    type="button"
    className={`auth-v24-weather-card auth-v24-weather-${kind}`}
    onClick={onOpen}
    aria-label={`Open ${farm ? "Daenem Farm Weather — Balogun-Ikire" : "Headquarters Weather — Ibadan"}`}
  >
    <header>
      <span><Navigation aria-hidden="true" />{farm ? "Daenem Farm Weather — Balogun-Ikire" : "Headquarters Weather — Ibadan"}</span>
      <small>DESIGN WEATHER · PROVIDER PENDING</small>
    </header>
    <div className="auth-v24-weather-main">
      <Icon className="auth-v24-weather-icon" aria-hidden="true" />
      <div className="auth-v24-weather-temp"><strong>—°</strong><span>Unavailable</span><small>Feels like —</small></div>
      <dl>
        <div><dt><Droplets />Humidity</dt><dd>—</dd></div>
        <div><dt><Wind />Wind</dt><dd>—</dd></div>
        <div><dt><CloudRain />Rain chance</dt><dd>—</dd></div>
      </dl>
    </div>
    <footer>
      <span><Sunrise />Sunrise <b>—</b></span>
      <span><Sunset />Sunset <b>—</b></span>
      <span className="auth-v24-mini-forecast"><i>Forecast</i><i>unavailable</i></span>
    </footer>
  </button>;
}

function FarmWeatherDetail() {
  const weatherStates = [
    ["Loading", "Skeleton + polite status", "ready"],
    ["Live", "Only after provider confirmation", "locked"],
    ["Sample / Design", "Current visible state", "active"],
    ["Stale", "Timestamp + caution retained", "ready"],
    ["Offline", "Cached context, no live claim", "ready"],
    ["Unavailable", "Safe retry path", "ready"],
    ["Provider Error", "Error boundary + reference", "ready"],
  ] as const;
  return <div className="weather-detail-grid">
    <section className="weather-hero-detail">
      <div><span className="intel-eyebrow">DAENEM FARM · BALOGUN-IKIRE</span>
        <h2>Farm Weather Intelligence</h2><TruthBadge>Provider unavailable</TruthBadge></div>
      <CloudSun className="weather-main-icon" aria-hidden="true" />
      <div className="weather-big-number">—°<small>Feels like —</small></div>
      <p>Live observation unavailable. Connect an approved provider before using weather for operational decisions.</p>
      <div className="weather-freshness"><RefreshCw /> Provider unavailable · Last real update unavailable</div>
    </section>
    <section className="weather-metric-grid" aria-label="Weather details">
      <article><Droplets /><span>Humidity</span><strong>—</strong></article>
      <article><Wind /><span>Wind</span><strong>—</strong></article>
      <article><CloudRain /><span>Rain chance</span><strong>—</strong></article>
      <article><Gauge /><span>Pressure</span><strong>—</strong></article>
      <article><Navigation /><span>Visibility</span><strong>—</strong></article>
      <article><CloudRain /><span>Rain context</span><strong>Unavailable</strong></article>
      <article><Sunrise /><span>Sunrise</span><strong>—</strong></article>
      <article><Sunset /><span>Sunset</span><strong>—</strong></article>
    </section>
    <section className="weather-forecast-block">
      <header><div><span className="intel-eyebrow">HOURLY OUTLOOK</span><h3>Plan the next field window</h3></div><small>Illustrative · Not live</small></header>
      <div className="hourly-ribbon">{farmHourly.map(([time,temp,rain]) =>
        <article key={time}><span>{time}</span><CloudRain /><strong>{temp}</strong><small>{rain === "—" ? "Unavailable" : `${rain} rain`}</small></article>)}</div>
    </section>
    <section className="weather-forecast-block">
      <header><div><span className="intel-eyebrow">5-DAY OUTLOOK</span><h3>Growing and logistics context</h3></div><small>Illustrative · Not live</small></header>
      <div className="daily-forecast">{farmDaily.map(([day,high,low,rain]) =>
        <article key={day}><strong>{day}</strong><CloudSun /><span>{high} / {low}</span><small>{rain === "—" ? "Unavailable" : `${rain} rain`}</small></article>)}</div>
    </section>
    <section className="farm-context-strip">
      <ThermometerSun /><div><span>Farm-relevant context</span><strong>Heat load elevated after midday</strong><small>Confirm with on-site instruments before operational decisions.</small></div>
      <Droplets /><div><span>Moisture watch</span><strong>Ventilation check suggested</strong><small>Illustrative guidance only; no sensor connection.</small></div>
    </section>
    <section className="weather-state-contract" aria-label="Weather data state designs">
      <header><div><span className="intel-eyebrow">DATA-STATE CONTRACT</span><h3>Every provider condition stays explicit</h3></div><small>Experience states · Backend integration pending</small></header>
      <div>{weatherStates.map(([state, description, tone]) => <article key={state} data-tone={tone}>
        <span aria-hidden="true" /><strong>{state}</strong><small>{description}</small>
      </article>)}</div>
    </section>
  </div>;
}

function HqWeatherDetail() {
  return <div className="hq-weather-detail">
    <header><div><span className="intel-eyebrow">HEADQUARTERS WEATHER</span><h2>Daenem Headquarters</h2>
      <p>Operational travel and office-arrival context, separate from the farm forecast.</p></div>
      <TruthBadge>Provider not configured</TruthBadge></header>
    <section className="hq-weather-stage"><CloudSun aria-hidden="true" />
      <div><strong>—°</strong><span>Feels —</span></div><div><b>Provider unavailable</b><span>No live observation</span></div></section>
    <div className="weather-metric-grid">
      <article><Droplets /><span>Humidity</span><strong>—</strong></article>
      <article><Wind /><span>Wind</span><strong>—</strong></article>
      <article><CloudRain /><span>Rain chance</span><strong>—</strong></article>
      <article><RefreshCw /><span>Freshness</span><strong>Live update unavailable</strong></article>
    </div>
    <p className="provider-truth-note">No headquarters weather provider is connected. Live observations will appear only after an approved source is configured.</p>
  </div>;
}

function NewsDetail() {
  return <div className="news-detail">
    <header><div><span className="intel-eyebrow">WORLD & INDUSTRY NEWS</span><h2>Signals worth checking</h2></div>
      <TruthBadge>Approved feed pending</TruthBadge></header>
    <article className="news-lead">
      <div className="news-visual"><Newspaper /><span>Verified image will load with an approved source</span></div>
      <div><span className="news-category">AGRICULTURE · UNAVAILABLE</span>
        <h3>Verified agriculture headlines will appear here</h3>
        <p>The portal will display source, category, timestamp and imagery only after an approved feed is connected.</p>
        <small>No source connected · Freshness unavailable</small></div>
    </article>
    <div className="news-queue">
      <article><span>POULTRY</span><strong>Provider-ready editorial position</strong><small>Source pending · Not live</small></article>
      <article><span>MARKETS</span><strong>Verified market context position</strong><small>Source pending · Not live</small></article>
      <article><span>WORLD</span><strong>Global operations briefing position</strong><small>Source pending · Not live</small></article>
    </div>
  </div>;
}

function AiDetail() {
  return <div className="ai-detail">
    <header><div><span className="intel-eyebrow">AI INSPIRATION</span><h2>A thoughtful start to the day</h2></div>
      <TruthBadge>AI provider pending</TruthBadge></header>
    <section className="ai-orb-stage"><div className="ai-orb"><Bot /></div><div>
      <span>CURATED PROMPT · NOT AI GENERATED</span>
      <blockquote>“What is the one field observation your next shift will need?”</blockquote>
      <p>Capture the evidence now, so the next decision begins with context.</p></div></section>
    <div className="ai-guardrail"><ShieldCheck /><div><strong>Human authority stays in control</strong>
      <p>Future AI may suggest, summarize and explain. It will not approve payments, permissions, inventory or other authoritative records.</p></div></div>
  </div>;
}

function MotivationDetail() {
  return <div className="motivation-detail">
    <header><div><span className="intel-eyebrow">EMPLOYEE MOTIVATION</span><h2>Today’s shared focus</h2></div>
      <TruthBadge>Owner-managed message slot</TruthBadge></header>
    <section className="motivation-stage"><HeartHandshake /><span>DAILY FOCUS</span>
      <blockquote>Leave every record clearer than you found it.</blockquote>
      <p>Accurate handovers protect the team, the flock and the farm.</p></section>
    <div className="motivation-foot"><span>Editorial placeholder · Not personalized</span>
      <span>Rotation and media controls require authorized content</span></div>
  </div>;
}

function StatusDetail() {
  const statuses = [
    ["Portal", "Preview available", "observed", Activity],
    ["Authentication", "Connection not verified", "unknown", ShieldCheck],
    ["Connectivity", "Browser online", "observed", Wifi],
    ["Install / PWA", "Production capability pending", "pending", Download],
    ["Weather provider", "Not configured", "pending", CloudSun],
    ["News & AI providers", "Not configured", "pending", Radio],
  ] as const;
  return <div className="status-detail">
    <header><div><span className="intel-eyebrow">SYSTEM STATUS</span><h2>Access readiness</h2>
      <p>Status is explicit about what this public surface can and cannot verify.</p></div>
      <TruthBadge>Checked in this browser</TruthBadge></header>
    <div className="status-stack">{statuses.map(([name,value,state,Icon]) =>
      <article key={name} data-state={state}><Icon /><div><strong>{name}</strong><small>{value}</small></div><span>{state}</span></article>)}</div>
    <p className="provider-truth-note">A visible preview is not proof that production authentication, backend services, providers or service health are verified.</p>
  </div>;
}

function IntelligenceMenu({ onSelect }: { onSelect: (surface: Exclude<IntelligenceSurface, "menu">) => void }) {
  const items = [
    ["farm-weather", "Farm Weather", "Full field outlook", CloudSun],
    ["hq-weather", "HQ Weather", "Separate office outlook", CloudRain],
    ["clocks", "Seven World Clocks", "Analog, digital and timezone", Gauge],
    ["news", "World & Industry News", "Approved feed pending", Newspaper],
    ["ai", "AI Inspiration", "Provider pending", Bot],
    ["motivation", "Employee Motivation", "Owner-managed focus", HeartHandshake],
    ["status", "System Status", "Access and provider health", Activity],
  ] as const;
  return <div className="mobile-intelligence-menu">
    <header><span className="intel-eyebrow">DAENEM INTELLIGENCE</span><h2>Choose an intelligence surface</h2>
      <p>Every desktop capability remains reachable in the compact Sign-In composition.</p></header>
    <div>{items.map(([surface, title, description, Icon]) => <button type="button" key={surface} onClick={() => onSelect(surface)}>
      <Icon aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ChevronRight aria-hidden="true" />
    </button>)}</div>
  </div>;
}

export default function PublicSignInCockpit({ placement, mode, onModeChange }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [surface, setSurface] = useState<IntelligenceSurface | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let timer = 0;
    const syncClock = () => {
      window.clearInterval(timer);
      setNow(new Date());
      if (!document.hidden) timer = window.setInterval(() => setNow(new Date()), 1000);
    };
    syncClock();
    document.addEventListener("visibilitychange", syncClock);
    const requested = new URLSearchParams(window.location.search).get("panel") as IntelligenceSurface | null;
    if (["farm-weather","hq-weather","clocks","news","ai","motivation","status","menu"].includes(requested || "")) setSurface(requested);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncClock);
    };
  }, []);
  useEffect(() => {
    if (!surface) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSurface(null);
      if (event.key !== "Tab") return;
      const sheet = closeRef.current?.closest(".intel-sheet");
      const controls = sheet?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus.current?.focus();
    };
  }, [surface]);
  const surfaceTitle = useMemo(() => ({
    "farm-weather": "Daenem Farm Weather", "hq-weather": "Headquarters Weather",
   clocks: "World Time", news: "World & Industry News", ai: "AI Inspiration",
    motivation: "Employee Motivation", status: "System Status", menu: "Daenem Intelligence Menu",
  } as const), []);
  const renderSurface = () => {
    if (surface === "farm-weather") return <FarmWeatherDetail />;
    if (surface === "hq-weather") return <HqWeatherDetail />;
    if (surface === "news") return <NewsDetail />;
    if (surface === "ai") return <AiDetail />;
    if (surface === "motivation") return <MotivationDetail />;
    if (surface === "status") return <StatusDetail />;
    if (surface === "menu") return <IntelligenceMenu onSelect={setSurface} />;
    return <div className="clock-gallery"><header><div><span className="intel-eyebrow">DAENEM WORLD TIME</span>
      <h2>Seven operating locations</h2><p>Local time, date, timezone and day/night context.</p></div>
      <TruthBadge>Device time · No provider required</TruthBadge></header>
      <div className="clock-gallery-grid">{initialClockLocations.map((location) =>
        <AnalogClock key={location.id} now={now} zone={location.zone} label={location.name} />)}</div></div>;
  };
  return <section className={`public-signin-cockpit public-signin-cockpit-${placement} auth-v24-intelligence`}
    aria-label="Daenem public intelligence">
    <div className="signin-intel-topline auth-v24-mode-row"><span><Sparkles /> DAENEM INTELLIGENCE</span>
      <ModeSelector mode={mode} onModeChange={onModeChange} />
      <button type="button" className="mobile-intel-menu-trigger" aria-label="Open all intelligence surfaces" aria-haspopup="dialog" onClick={() => setSurface("menu")}><PanelsTopLeft aria-hidden="true" /></button></div>
    <div className="auth-v24-weather-deck" aria-label="Weather intelligence">
      <WeatherCard kind="farm" onOpen={() => setSurface("farm-weather")} />
      <WeatherCard kind="hq" onOpen={() => setSurface("hq-weather")} />
    </div>
    <section className="auth-v24-clock-panel" aria-label="Global Time">
      <button type="button" className="auth-v24-section-heading" onClick={() => setSurface("clocks")}>
        <span><Gauge />Global Time</span><small><i /> Device time · 7 locations <ChevronRight /></small>
      </button>
      <div className="signin-clock-dock" data-zero-click="world-clocks" role="region" aria-label="Scrollable seven-clock gallery" tabIndex={0}>{initialClockLocations.map((location) =>
        <AnalogClock key={location.id} now={now} zone={location.zone} label={location.id === "farm" ? "Balogun-Ikire" : location.name} />)}</div>
    </section>
    <div className="signin-intel-launchers auth-v24-widget-grid" aria-label="Open intelligence widgets" data-zero-click="public-widgets">
      <button type="button" className="auth-v24-widget auth-v24-news" onClick={() => setSurface("news")}>
        <header><span><Newspaper />World &amp; Industry News</span><ChevronRight /></header>
        <div className="auth-v24-news-layout"><span className="auth-v24-widget-art"><Radio /></span><span><em>AGRICULTURE · PROVIDER PENDING</em><b>Verified farm intelligence will appear here</b><small>No approved feed connected · Freshness unavailable</small></span></div>
      </button>
      <button type="button" className="auth-v24-widget auth-v24-ai" onClick={() => setSurface("ai")}>
        <header><span><Lightbulb />AI Inspiration</span><ChevronRight /></header>
        <div className="auth-v24-ai-layout"><span className="auth-v24-widget-art"><Sparkles /></span><span><em>CURATED · NOT LIVE AI</em><b>“What field observation will the next shift need?”</b><small>AI provider pending</small></span></div>
      </button>
      <button type="button" className="auth-v24-widget auth-v24-motivation" onClick={() => setSurface("motivation")}>
        <header><span><HeartHandshake />Employee Motivation</span><ChevronRight /></header>
        <div><em>OWNER-MANAGED MESSAGE SLOT</em><b>Great things in agriculture are done by teams who believe.</b><small>Editorial placeholder · Not personalized</small></div>
      </button>
      <button type="button" className="auth-v24-widget auth-v24-status" onClick={() => setSurface("status")}>
        <header><span><Activity />System Status</span><ChevronRight /></header>
        <div><span><i data-state="observed" />Review surface <b>Observed</b></span><span><i data-state="unknown" />Authentication <b>Unverified</b></span><span><i data-state="pending" />Providers <b>Pending</b></span></div>
      </button>
    </div>
    {surface && <div className="intel-overlay" role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && setSurface(null)}>
      <section className="intel-sheet" role="dialog" aria-modal="true" aria-label={surfaceTitle[surface]}>
        <button ref={closeRef} type="button" className="intel-sheet-close" aria-label={`Close ${surfaceTitle[surface]}`}
          onClick={() => setSurface(null)}><X /></button>
        {renderSurface()}
      </section>
    </div>}
  </section>;
}
