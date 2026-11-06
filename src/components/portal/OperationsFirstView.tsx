"use client";

import React from "react";
import { Bird, Egg, HeartPulse, RefreshCw, Syringe, Wheat } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { canPage } from "@/lib/portal-model";
import { Chip } from "./Common";

import { useFarmOperationsSummary, type FarmSummaryAuthority } from "./useFarmOperationsSummary";
const signals = [
  { id: "active-flocks", label: "Active Flocks", route: "flocks", icon: Bird },
  { id: "posted-feed", label: "Posted Feed Movements", route: "feed", icon: Wheat },
  { id: "open-health", label: "Open Health Events", route: "health", icon: HeartPulse },
  { id: "verified-eggs", label: "Verified Egg Batches", route: "eggs", icon: Egg },
  { id: "planned-vaccinations", label: "Planned Vaccinations", route: "vaccinations", icon: Syringe },
] as const;

export default function OperationsFirstView({ person, go, ...authority }: {
  person: Persona; go: (route: string) => void;
} & FarmSummaryAuthority) {
  const { state, payload, refresh } = useFarmOperationsSummary(person, authority);
  const items = payload?.items || [];
  const visible = signals.filter((signal) => canPage(person, signal.route));
  if (!visible.length) return null;
  const ready = state === "available" || state === "no-data";
  const available = ready ? visible.filter((signal) => items.some((item) => item.id === signal.id)) : [];
  return (
    <section className="operations-first-view" aria-labelledby="operations-first-title">
      <header>
        <div>
          <span className="eyebrow">Current Farm Pulse · Authorised D1 Records</span>
          <h2 id="operations-first-title">Today&apos;s Operating Position</h2>
        </div>
        <div className="row wrap">
          <Chip tone={ready ? "blue" : "amber"}>
            {state === "loading" ? "Checking Live Records" : state === "available" ? "Live Records Verified"
              : state === "no-data" ? "No Verified Records Yet" : state === "sign-in" ? "Sign In Required"
              : state === "restricted" ? "No Authorised Figures" : "Data Source Unavailable"}
          </Chip>
          <button className="btn ghost" type="button" disabled={state === "loading"}
            onClick={() => void refresh()} aria-label="Refresh Live Farm Records">
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>
      {ready && available.length > 0 ? (
        <div className="operations-first-grid" aria-live="polite">
          {available.map(({ id, label, route, icon: Icon }) => {
            const item = items.find((row) => row.id === id)!;
            return <button key={id} type="button" onClick={() => go(route)}>
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              <strong>{item.count.toLocaleString("en-NG")}</strong>
              <small>{item.authorizedRecords === 0 ? "No authorised records yet" : "Verified State · Open Workspace"}</small>
            </button>;
          })}
        </div>
      ) : (
        <p className="form-note" role="status">
          {state === "loading" ? "Checking verified farm records…"
            : state === "sign-in" ? "Sign in to view your authorised figures."
            : state === "restricted" ? "Your account is not authorised to view these measures."
            : state === "unavailable" ? "Live figures could not be verified. No sample figures are displayed."
            : "No authorised operational measures are available."}
        </p>
      )}
      {ready && <p className="form-note" role="status">
        Counts represent server-authorised records in this farm, not actual bird totals, egg trays,
        stock runway or reconciliation outcomes. A zero means no matching record was found, not proof that no event occurred.
      </p>}
    </section>
  );
}
