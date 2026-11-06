"use client";

import { useEffect, useState } from "react";
import { CircleAlert, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import styles from "./FinanceJournalControls.module.css";
import LoggedTimestamp from "./LoggedTimestamp";

type JournalSnapshot = {
  scopeKey: string;
  status: "loading" | "ready" | "hidden" | "sign-in" | "unavailable";
  count: number | null;
  checkedAt: number | null;
};
const scopeOf = (person: Persona) => JSON.stringify([
  person.id, person.email, person.principalSource, person.restriction, person.accessState,
  Object.entries(person.organizationScope || {}).sort(([a],[b]) => a.localeCompare(b)),
  [...person.permissions].sort(),
  Object.entries(person.permissionScopes || {}).sort(([a],[b]) => a.localeCompare(b)),
]);

function verifiedReadiness(data: unknown): number {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("INVALID_JOURNAL_GATE");
  const row = data as Record<string, unknown>;
  if (row.state !== "posting-disabled" || row.source !== "authenticated-finance-journal-records"
    || row.postingAvailable !== false || row.legacyIndividualEntriesCertified !== false
    || row.balancesCertified !== false || !Number.isSafeInteger(row.journalRecordCount)
    || (row.journalRecordCount as number) < 0 || !row.statusCounts || typeof row.statusCounts !== "object") {
    throw new Error("INVALID_JOURNAL_GATE");
  }
  const counts = row.statusCounts as Record<string, unknown>;
  if (!["draft","submitted","posted"].every(name => Number.isSafeInteger(counts[name]) && Number(counts[name]) >= 0)
    || Number(counts.draft) + Number(counts.submitted) + Number(counts.posted) !== row.journalRecordCount) {
    throw new Error("INVALID_JOURNAL_GATE");
  }
  return row.journalRecordCount as number;
}

export default function FinanceJournalControls({ person }: { person: Persona }) {
  const scopeKey = scopeOf(person);
  const [refreshIndex, refresh] = useState(0);
  const [snapshot, setSnapshot] = useState<JournalSnapshot>({
    scopeKey, status: "loading", count: null, checkedAt: null,
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSnapshot({ scopeKey, status: "loading", count: null, checkedAt: null });
    const load = async () => {
      try {
        const response = await fetch("/api/portal/v7/finance-journal/readiness", {
          method: "GET", credentials: "same-origin", cache: "no-store",
          headers: { accept: "application/json" }, signal: controller.signal,
        });
        if (!active) return;
        if (!response.ok) {
          setSnapshot({scopeKey, count: null, checkedAt: null,
            status: response.status === 401 ? "sign-in" :
              [403,404].includes(response.status) ? "hidden" : "unavailable"});
          return;
        }
        const count = verifiedReadiness(await response.json());
        if (active) setSnapshot({ scopeKey, status: "ready", count, checkedAt: Date.now() });
      } catch {
        if (active) setSnapshot({ scopeKey, status: "unavailable", count: null, checkedAt: null });
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [scopeKey, refreshIndex]);

  const current = snapshot.scopeKey === scopeKey ? snapshot :
    { scopeKey, status: "loading" as const, count: null, checkedAt: null };
  const connected = current.status === "ready";
  const checked = current.checkedAt ? new Date(current.checkedAt).toISOString() : null;

  return <section className={styles.panel} aria-labelledby="finance-balanced-journal-title"
    aria-busy={current.status === "loading"} data-journal-readiness-state={current.status}>
    <div className={styles.header}>
      <div className={styles.titleBlock}>
        <p className={styles.eyebrow}><ShieldCheck size={15} aria-hidden="true"/> Finance Integrity · Separate Journal Controls</p>
        <h2 id="finance-balanced-journal-title">Balanced Journal Posting Gate</h2>
        <p>Each journal must have matching debit and credit amounts in exact currency minor units. An individual ledger entry is not a balanced journal.</p>
      </div>
      <div className={styles.actions}>
        <span className={styles.locked}><LockKeyhole size={15} aria-hidden="true"/> Posting Disabled</span>
        <button className={styles.refresh} type="button" disabled={current.status === "loading"}
          onClick={() => refresh(n => n + 1)} aria-label="Refresh journal integrity controls">
          <RefreshCw size={15} aria-hidden="true"/> Refresh
        </button>
      </div>
    </div>
    <div className={styles.grid}>
      <div className={styles.step}>
        <span className={styles.number}>01</span>
        <strong>Balanced lines required</strong>
        <p>Two or more accounts, debit and credit equality, one currency, no floating-point rounding.</p>
      </div>
      <div className={styles.step}>
        <span className={styles.number}>02</span>
        <strong>Independent approval required</strong>
        <p>The maker cannot approve their own submitted journal. Record revisions and audit events must remain atomic.</p>
      </div>
      <div className={styles.step}>
        <span className={styles.number}>03</span>
        <strong>Posting not activated</strong>
        <p>Account catalogue, duplicate prevention, reversals and real posting acceptance still need approval.</p>
      </div>
    </div>
    <div className={styles.status} role={connected || current.status === "loading" ? "status" : "alert"}>
      <CircleAlert size={18} aria-hidden="true"/>
      <div>
        {connected
          ? <><strong>Read-only journal source connected</strong>
             <p>{current.count} journal record{current.count === 1 ? "" : "s"} returned in this authorized scope · checked <LoggedTimestamp value={checked}/>. This is not a financial balance or verified posting total.</p></>
          : <><strong>{current.status === "loading" ? "Checking authorized journal source" :
               current.status === "sign-in" ? "Sign-in required" :
               current.status === "hidden" ? "Journal source is not visible in this scope" :
               "Journal source temporarily unavailable"}</strong>
             <p>Posting remains disabled. No prior-account journal details or record counts are displayed.</p></>}
      </div>
    </div>
    <p className={styles.disclaimer}>No bank matching, reconciled cash, account balances or audited profitability is certified. Existing single-line ledger postings remain outside this new journal contract.</p>
  </section>;
}
