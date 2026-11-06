"use client";

import { useEffect, useState } from "react";
import type { Persona } from "@/lib/portal-model";
import { analyticsSessionContext } from "@/lib/analytics-session-context";
import { ChartNoAxesCombined, CircleAlert, ShieldCheck } from "lucide-react";
import { Btn, Chip, Panel } from "./Common";
import ProductionTrendChart from "./analytics-intelligence/ProductionTrendChart";
import ProductionSourceNotice, { hasVerifiedProductionSource } from "./analytics-intelligence/ProductionSourceNotice";
import { unavailableEggsCollected } from "./analytics-intelligence/egg-collection";
import type { MetricContract } from "./analytics-intelligence/metric-contract";
import { STAGE22_DEFINITIONS, type Stage22MetricKey } from "./analytics-intelligence/stage22-kpi-definitions";
import styles from "./InventoryProcurementDesk.module.css";

type SourceState = "loading" | "available" | "hidden" | "sign-in" | "unavailable";
type AnalyticsPayload = {
  metric: MetricContract;
  connected: Stage22MetricKey[];
  pending: Stage22MetricKey[];
};

export default function ProductionAnalyticsDesk({person, authorityStamp}: {person: Persona; authorityStamp: string}) {
  const company = person.organizationScope?.companyKey?.trim() || "";
  const location = person.organizationScope?.locationKey?.trim() || "";
  const account = person.authenticatedAccountId?.trim() || "";
  if (!company || !location || !authorityStamp || (person.principalSource === "authenticated" && !account)) {
    return <section id="production-analytics-workspace" role="status">Production analytics are unavailable until your account and farm scope can be confirmed.</section>;
  }
  // A changed principal, company, site or grants must discard prior screen state
  // during render, before an effect can clear it.
  const scopeKey = JSON.stringify([
    authorityStamp, person.principalSource, account, person.id, person.employeeId, person.accessState,
    person.restriction, person.farm,
    Object.entries(person.organizationScope || {}).sort(([a], [b]) => a.localeCompare(b)),
    Object.entries(person.permissionScopes || {}).sort(([a], [b]) => a.localeCompare(b)),
    [...person.permissions].sort(),
  ]);
  return <ProductionAnalyticsWorkspace key={scopeKey} expectedLocation={location} authorityStamp={authorityStamp}/>;
}

function ProductionAnalyticsWorkspace({expectedLocation, authorityStamp}: {expectedLocation: string; authorityStamp: string}) {
  const [state, setState] = useState<SourceState>("loading");
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState("loading");
      try {
        const context = await analyticsSessionContext(authorityStamp);
        if (!active) return;
        const response = await fetch("/api/portal/v7/analytics/production?days=30", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json", "x-farm-analytics-context": context },
        });
        if (!active) return;
        if (response.status === 401) { setPayload(null); setState("sign-in"); return; }
        if (response.status === 403 || response.status === 404) { setPayload(null); setState("hidden"); return; }
        if (!response.ok) throw new Error("unavailable");
        const body = await response.json() as Partial<AnalyticsPayload>;
        if (!active) return;
        if (!body.metric || !body.metric.scope || !body.metric.source || !Array.isArray(body.connected) || !Array.isArray(body.pending)) throw new Error("unavailable");
        // The cookie-backed server session can change independently of the
        // rendered principal. Never attach a different site's response to it.
        if (!body.metric.scope.authorized || body.metric.scope.label !== expectedLocation) {
          setPayload(null);
          setState("hidden");
          return;
        }
        // The server currently withholds egg analytics pending coverage. Do not
        // revive a formerly ready value from an old response or client cache.
        // Removing this guard requires the same reviewed release as the server hold.
        const metric = {
          ...unavailableEggsCollected(body.metric.scope, {label: "Last 30 days", start: null, end: null}),
          unavailableReason: "Egg-record coverage cannot be confirmed, so farm totals and trends are unavailable.",
        };
        setPayload({
          metric,
          connected: body.connected.filter((key) => key !== "egg-collection"),
          pending: [...new Set([...body.pending, "active-birds" as const])],
        });
        setState("available");
      } catch {
        if (active) { setPayload(null); setState("unavailable"); }
      }
    };
    void load();
    return () => { active = false; };
  }, [reloadKey, expectedLocation, authorityStamp]);

  const sourceVerified = state === "available" && payload !== null && hasVerifiedProductionSource(payload.metric);
  const status = state === "loading" ? "Loading verified production records…"
    : state === "available" ? (sourceVerified ? "Verified producer connected" : "Source unavailable")
      : state === "hidden" ? "Unavailable in this scope"
        : state === "sign-in" ? "Sign in required" : "Producer unavailable";

  return <section id="production-analytics-workspace" tabIndex={-1} className={styles.console}>
    <Panel
      title="Production Analytics · Verified Egg Intelligence"
      description="Read the current and previous 30-day egg-collection periods from server-authorized, verified egg-batch records. Missing days remain missing and are never converted to zero."
      action={(state !== "hidden" && state !== "sign-in") ? (
        <Btn small type="button" disabled={state === "loading"} onClick={() => { setPayload(null); setState("loading"); setReloadKey((key) => key + 1); }}>
          {state === "loading" ? "Loading verified records…" : "Refresh verified records"}
        </Btn>
      ) : undefined}
    >
      <div className="row between wrap" aria-live="polite"><Chip tone={sourceVerified ? "blue" : "amber"}>{status}</Chip><span className="metadata">API v7 · Stage 22 producer contract</span></div>

      {state === "loading" && <div className="auth-state mt" role="status"><ChartNoAxesCombined size={20} aria-hidden="true"/><span>Loading the authorized egg-batch producer. No cached or illustrative values are shown while this request is pending.</span></div>}
      {state === "hidden" && <p className="mt" role="status">Production analytics are unavailable in your authorized scope. No production values are disclosed.</p>}
      {state === "sign-in" && <p className="mt" role="status">Sign in to load authorized production analytics.</p>}
      {state === "unavailable" && <p className="mt" role="alert">The verified production-analytics producer could not be reached. Fixtures, estimates, and cached sample values are not shown.</p>}

      {state === "available" && payload && <>
        <ProductionSourceNotice metric={payload.metric}/>
        <div className="mt"><ProductionTrendChart metric={payload.metric} defaultWindowDays={30}/></div>

        <div className={styles.register}>
          <div className="row between wrap"><h3>Stage 22 Producer Coverage</h3><span className="metadata">{sourceVerified ? `${payload.connected.length} connected` : "Source unavailable"} · {payload.pending.length} withheld</span></div>
          <article className={styles.record}>
            <div><div className="row wrap"><Chip tone={sourceVerified ? "blue" : "gray"}>{sourceVerified ? "Connected" : "Unavailable"}</Chip><strong>{STAGE22_DEFINITIONS["egg-collection"].label}</strong></div><p>{STAGE22_DEFINITIONS["egg-collection"].basis}</p><small>Source: {STAGE22_DEFINITIONS["egg-collection"].producer}</small></div>
            <div className="row">{sourceVerified && <ShieldCheck size={16} aria-hidden="true"/>} <span>{sourceVerified ? "Server verified" : "Verification unavailable"}</span></div>
          </article>
          <div className="auth-state mt" role="status"><CircleAlert size={20} aria-hidden="true"/><span>{payload.pending.length} KPI contracts remain withheld until their named authoritative producers are connected. The page does not infer laying rate, mortality rate, live birds, feed conversion, revenue, profit, margin, or receivables.</span></div>
          <div className="grid2 mt">
            {payload.pending.map((key) => <article className="panel stack tight" key={key}><div className="row wrap"><ChartNoAxesCombined size={18} aria-hidden="true"/><strong>{STAGE22_DEFINITIONS[key].label}</strong></div><Chip tone="gray">Backend producer pending</Chip><small>{STAGE22_DEFINITIONS[key].producer}</small></article>)}
          </div>
        </div>
      </>}
    </Panel>
  </section>;
}
