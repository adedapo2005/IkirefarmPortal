"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ArrowRightLeft, Bird, CheckCircle2, ClipboardList, House, Layers3, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { canPage, has, isOwnerPrincipal, type Persona } from "@/lib/portal-model";
import { FLOCK_COVERAGE_HEADER, FLOCK_COVERAGE_VERSION, FLOCK_CLIENT_UPDATE_REQUIRED } from "@/lib/flock-coverage-compat";
import styles from "./FlockControlDashboard.module.css";

export type FlockReferences = {
  houses: { id: string; code: string; name: string; capacityBirds: number; readiness: string }[];
  breeds: { id: string; code: string; name: string; species: "chicken" | "turkey" | "duck"; productionClass: string }[];
};
type FlockOverview = FlockReferences & {
  state: "available" | "no-data";
  source: string;
  asOf: string;
  authorisedRecords: number;
  meaning: string;
  coverage: "unverified";
  measures: { activeFlocks: number; recordedOpeningBirds: number; activeHouses: number; readyHouses: number; transfersToReview: number; approvedTransfers: number };
  recentFlocks: { id: string; code: string; name: string; breed: string; house: string; openingBirds: number; placementDate: string; state: string }[];
};
type SourceState = "loading" | "available" | "no-data" | "sign-in" | "restricted" | "unavailable" | "update-required";
const validCount = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
function validOverview(value: unknown): value is FlockOverview {
  if (!value || typeof value !== "object") return false;
  const x = value as Record<string, unknown>;
  if (x.coverage !== "unverified" || !["available", "no-data"].includes(String(x.state)) || !Array.isArray(x.houses) ||
      !Array.isArray(x.breeds) || !Array.isArray(x.recentFlocks) || !x.measures || typeof x.measures !== "object") return false;
  const m = x.measures as Record<string, unknown>;
  if (!["activeFlocks","recordedOpeningBirds","activeHouses","readyHouses","transfersToReview","approvedTransfers"].every(k => validCount(m[k]))) return false;
  if (!x.houses.every((r: unknown) => r && typeof r === "object" && typeof (r as FlockReferences["houses"][number]).code === "string")) return false;
  if (!x.breeds.every((r: unknown) => r && typeof r === "object" && typeof (r as FlockReferences["breeds"][number]).code === "string")) return false;
  return x.recentFlocks.every((r: unknown) => r && typeof r === "object" && typeof (r as FlockOverview["recentFlocks"][number]).code === "string");
}
const statusText: Record<SourceState, string> = {
  loading: "Checking Current Farm", available: "Completeness Not Confirmed", "no-data": "No Authorised Records Found",
  "sign-in": "Sign In Required", restricted: "Access Restricted", unavailable: "Records Unavailable",
  "update-required": "Reload Required",
};

export function FlockUpdateRequiredNotice() {
  return <div role="alert">
    <p>This version cannot display flock records safely. Reload FarmPortal to get the latest version.</p>
    <button type="button" className={styles.secondaryAction} onClick={() => window.location.reload()}>Reload FarmPortal</button>
  </div>;
}

export default function FlockControlDashboard({
  person, go, revision, onReferences,
}: { person: Persona; go: (route: string) => void; revision: number; onReferences: (data: FlockReferences | null) => void }) {
  const [state, setState] = useState<SourceState>("loading");
  const [overview, setOverview] = useState<FlockOverview | null>(null);
  const [fetchToken, setFetchToken] = useState(0);
  const load = useCallback(async () => {
    setState("loading"); setOverview(null); onReferences(null);
    try {
      const response = await fetch("/api/portal/v7/farm-operations/flock-workspace", {
        credentials: "same-origin", cache: "no-store",
        headers: { accept: "application/json", [FLOCK_COVERAGE_HEADER]: FLOCK_COVERAGE_VERSION },
      });
      if (response.status === 401) { setState("sign-in"); return; }
      if (response.status === 403 || response.status === 404) { setState("restricted"); return; }
      if (response.status === 409) {
        const body: unknown = await response.json();
        if (body && typeof body === "object" && "error" in body && body.error === FLOCK_CLIENT_UPDATE_REQUIRED) {
          setState("update-required");
          return;
        }
        throw new Error("SOURCE_UNAVAILABLE");
      }
      if (!response.ok) throw new Error("SOURCE_UNAVAILABLE");
      const data: unknown = await response.json();
      if (!validOverview(data)) throw new Error("INVALID_FLOCK_SOURCE");
      const records = data as FlockOverview;
      setOverview(records);
      onReferences({ houses: records.houses, breeds: records.breeds });
      setState(records.state);
    } catch { setState("unavailable"); onReferences(null); }
  }, [onReferences]);
  useEffect(() => { void load(); }, [load, revision, fetchToken]);

  const measures = overview?.measures;
  const ready = state === "available" || state === "no-data";
  const canAdd = person.restriction !== "disabled" && (has(person, "inventory.edit") || isOwnerPrincipal(person)) && ready && Boolean(overview?.houses.length) && Boolean(overview?.breeds.length);
  const canNavigate = (route: string) => canPage(person, route);
  const focusForm = () => {
    const form = document.getElementById("farm-operation-flock-form");
    if (!form) return;
    form.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    form.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  };

  return <section className={styles.root} aria-labelledby="flock-control-heading">
    <div className={styles.hero}>
      <div className={styles.heroText}>
        <span className={styles.overline}><Bird size={17} aria-hidden="true" /> Farm Intelligence / Flock Control</span>
        <h2 id="flock-control-heading">Flock And House Records You Can Access</h2>
        <p>Follow your authorised placement records, house readiness and transfers.</p>
        <div className={styles.heroActions}>
          {canAdd && <button type="button" className={styles.primaryAction} onClick={focusForm}>Add Flock <ArrowRight size={17} aria-hidden="true" /></button>}
          {canNavigate("houses") && <button type="button" className={styles.secondaryAction} onClick={() => go("houses")}>House Register <House size={17} aria-hidden="true" /></button>}
          <button type="button" className={styles.secondaryAction} onClick={() => setFetchToken(v => v+1)} disabled={state==="loading"} aria-label="Refresh Flock Control Data"><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
        </div>
      </div>
      <div className={styles.heroNumber} aria-live="polite">
        <span>Authorised Active Flocks</span>
        <strong>{ready ? measures?.activeFlocks.toLocaleString("en-NG") : "—"}</strong>
        <small>{ready ? "Active flock records you can access" : statusText[state]}</small>
      </div>
    </div>

    <div className={styles.sourceLine} role="status">
      <span className={styles.sourcePending}>{ready ? <TriangleAlert size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />} {statusText[state]}</span>
      <span>{ready ? "Only authorised records are shown. Completeness not confirmed; totals may be incomplete." : "No fallback sample figures"}</span>
    </div>

    {ready && measures && overview ? <>
      <div className={styles.metrics} aria-label="Signals from your authorised flock, house and transfer records">
        <div className={styles.metric}><span><Bird size={19} aria-hidden="true" /> Opening Birds In Your Authorised Flocks</span><strong>{measures.recordedOpeningBirds.toLocaleString("en-NG")}</strong><small>Initial placements in authorised active flocks, not live bird balance</small></div>
        <div className={styles.metric}><span><House size={19} aria-hidden="true" /> Ready Houses In Your Authorised Records</span><strong>{measures.readyHouses.toLocaleString("en-NG")} <em>/ {measures.activeHouses.toLocaleString("en-NG")}</em></strong><small>Ready versus active authorised house records</small></div>
        <div className={styles.metric}><span><ArrowRightLeft size={19} aria-hidden="true" /> Transfers In Your Authorised Records</span><strong>{measures.transfersToReview.toLocaleString("en-NG")}</strong><small>Awaiting review · {measures.approvedTransfers} approved awaiting completion</small></div>
      </div>
      <div className={styles.lower}>
        <section className={styles.readiness} aria-labelledby="flock-readiness-title">
          <div className={styles.panelHeading}><span className={styles.panelIcon}><Layers3 size={20} /></span><div><h3 id="flock-readiness-title">Placement Readiness</h3><p>Prepare verified master records before assigning birds.</p></div></div>
          <div className={styles.progressRail} role="img" aria-label={measures.activeHouses ? `${measures.readyHouses} of ${measures.activeHouses} authorised active houses are ready` : "No active houses in your authorised records"}>
            <span style={{width:measures.activeHouses ? `${Math.min(100,measures.readyHouses/measures.activeHouses*100)}%` : "0%"}} />
          </div>
          <div className={styles.step}>
            {overview.houses.length ? <CheckCircle2 size={19} aria-hidden="true" /> : <TriangleAlert size={19} aria-hidden="true" />}
            <div><strong>1. Active, Ready House</strong><p>{overview.houses.length ? `${overview.houses.length} eligible authorised house records` : "No eligible ready house is available in your authorised records."}</p></div>
            {canNavigate("houses") && <button type="button" onClick={() => go("houses")}>Open Houses <ArrowRight size={14}/></button>}
          </div>
          <div className={styles.step}>
            {overview.breeds.length ? <CheckCircle2 size={19} aria-hidden="true" /> : <TriangleAlert size={19} aria-hidden="true" />}
            <div><strong>2. Registered Breed</strong><p>{overview.breeds.length ? `${overview.breeds.length} authorised active breed options` : "No active breed is available in your authorised records."}</p></div>
            {canNavigate("breed-management") && <button type="button" onClick={() => go("breed-management")}>Manage Breeds <ArrowRight size={14}/></button>}
          </div>
          <div className={styles.step}>
            <ClipboardList size={19} aria-hidden="true" />
            <div><strong>3. Record Flock Placement</strong><p>Reference an eligible house, matching breed, placement date and opening bird count.</p></div>
            {canAdd && <button type="button" onClick={focusForm}>Add Flock <ArrowRight size={14}/></button>}
          </div>
        </section>
        <section className={styles.recent} aria-labelledby="recent-flock-title">
          <div className={styles.panelHeading}><span className={styles.panelIcon}><Bird size={20}/></span><div><h3 id="recent-flock-title">Placement Register</h3><p>Latest authorised flock records in this farm.</p></div></div>
          {overview.recentFlocks.length ? <div className={styles.flockList}>{overview.recentFlocks.map(flock =>
            <div className={styles.flockRow} key={flock.id}>
              <span className={styles.flockMark} aria-hidden="true">F</span>
              <div><strong>{flock.name}</strong><small>{flock.code} · {flock.house} · {flock.breed}</small></div>
              <div className={styles.flockCount}><strong>{flock.openingBirds.toLocaleString("en-NG")}</strong><small>opening birds</small></div>
              <span className={styles.stateTag}>{flock.state.replace(/-/g," ")}</span>
            </div>
          )}</div> : <div className={styles.empty}><Bird size={30} aria-hidden="true"/><strong>No Authorised Flock Records Found</strong><p>No authorised flock records are available to display.</p></div>}
          {canNavigate("flock-transfers") && <button type="button" className={styles.textAction} onClick={() => go("flock-transfers")}>Review Flock Transfers <ArrowRight size={16}/></button>}
        </section>
      </div>
      <p className={styles.provenance}>Source: {overview.source}. Totals cover only records you are authorised to view. Recorded opening birds are not a mortality-adjusted headcount or stock forecast. No sample records or invented changes.</p>
    </> : <div className={styles.unavailable} role="status">
      {state==="loading" ? "Checking authorised flock, house and breed records…" :
      state==="update-required" ? <FlockUpdateRequiredNotice/> :
      state==="sign-in" ? "Sign in to load Flock Control." :
      state==="restricted" ? "These flock records are outside your authorised scope." :
      "Flock Control could not verify live records. Try Refresh; if the problem continues, contact your farm administrator. No example figures are shown."}
    </div>}
  </section>;
}
