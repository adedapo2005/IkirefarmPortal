"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Database, RefreshCw, ShieldCheck } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { formatFinanceLedgerAmount, parseFinanceLedgerListing,
  type FinanceLedgerEntry } from "@/lib/finance-ledger-evidence";
import FinanceJournalControls from "./FinanceJournalControls";
import LoggedTimestamp from "./LoggedTimestamp";
import styles from "./FinanceEvidenceRegister.module.css";

type State = "loading" | "available" | "no-data" | "authentication-required" | "hidden" | "unavailable";
type Snapshot = Readonly<{ scopeKey: string; status: State; entries: FinanceLedgerEntry[]; checkedAt: number | null }>;

function scopeFingerprint(person: Persona) {
  return JSON.stringify([
    person.id, person.principalSource, person.email, person.accessState, person.restriction,
    Object.entries(person.organizationScope || {}).sort(([a], [b]) => a.localeCompare(b)),
    [...person.permissions].sort(),
    Object.entries(person.permissionScopes || {}).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

const statusCopy: Record<Exclude<State, "available">, { title: string; explanation: string }> = {
  loading: { title: "Checking authorized ledger entries", explanation: "Reading the current Finance record source without changing any records." },
  "no-data": { title: "No ledger entries returned for this scope", explanation: "The record service responded, but no entries were returned. This is not a zero balance, a reconciled journal, or proof that no financial activity occurred." },
  "authentication-required": { title: "Sign-in required", explanation: "Your Finance session needs to be renewed. No previous account's ledger entries are retained here." },
  hidden: { title: "Ledger entries are not available in this scope", explanation: "The current account has no accessible ledger result. No record details are disclosed." },
  unavailable: { title: "Ledger record source temporarily unavailable", explanation: "No previously loaded entries are shown. Retry after the authorized service becomes available." },
};
const pageSize = 8;
const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

export default function FinanceEvidenceRegister({ person }: { person: Persona }) {
  const scopeKey = scopeFingerprint(person);
  const [refresh, setRefresh] = useState(0);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    scopeKey, status: "loading", entries: [], checkedAt: null,
  }));
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSnapshot({ scopeKey, status: "loading", entries: [], checkedAt: null });
    setVisibleCount(pageSize);
    async function load() {
      try {
        const response = await fetch("/api/portal/v7/commercial-finance/ledger-entry", {
          credentials: "same-origin",
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!active) return;
        if (!response.ok) {
          const status: State = response.status === 401 ? "authentication-required"
            : [403, 404].includes(response.status) ? "hidden" : "unavailable";
          setSnapshot({ scopeKey, status, entries: [], checkedAt: null });
          return;
        }
        const listing = parseFinanceLedgerListing(await response.json());
        if (!active) return;
        setSnapshot({ scopeKey, status: listing.state, entries: listing.entries, checkedAt: Date.now() });
      } catch {
        if (active) setSnapshot({ scopeKey, status: "unavailable", entries: [], checkedAt: null });
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [scopeKey, refresh]);

  // Clear the old principal's rows synchronously on a scope or permission change.
  const current: Snapshot = snapshot.scopeKey === scopeKey ? snapshot
    : { scopeKey, status: "loading", entries: [], checkedAt: null };
  const entries = current.status === "available" ? current.entries : [];
  const shown = entries.slice(0, visibleCount);
  const checked = current.checkedAt ? new Date(current.checkedAt).toISOString() : null;
  const empty = current.status !== "available";
  return <><section className={styles.register} aria-labelledby="finance-evidence-title"
    data-finance-evidence="live" data-finance-evidence-state={current.status} aria-busy={current.status === "loading"}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}><Database size={15} aria-hidden="true" /> Finance Evidence · Authorized Records</p>
        <h2 id="finance-evidence-title">Finance Entry Register</h2>
        <p className={styles.subtitle}>Individual recorded debit and credit entries. Not a balanced journal, bank reconciliation, cash balance or profit report.</p>
      </div>
      <div className={styles.controls}>
        <span className={styles.state} data-ledger-connection-state>
          {current.status === "available" || current.status === "no-data" ? "Record Service Connected"
            : current.status === "loading" ? "Checking Source" : "Source Unavailable"}
        </span>
        <button type="button" className={styles.refresh} onClick={() => setRefresh((v) => v + 1)}
          disabled={current.status === "loading"} aria-label="Refresh authorized ledger entries">
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>
    </header>
    <div className={styles.provenance}>
      <ShieldCheck size={15} aria-hidden="true" />
      <span>Source: Authenticated FarmPortal Finance records</span>
      <span>·</span><span>{checked ? <>Last checked: <LoggedTimestamp value={checked}/></> : "No fresh results"}</span>
      <span>·</span><strong>Not reconciled</strong>
    </div>
    {empty ? <div className={styles.empty} role={current.status === "unavailable" || current.status === "authentication-required" ? "alert" : "status"}>
      <CircleAlert size={22} aria-hidden="true" />
      <div><h3>{statusCopy[current.status as Exclude<State, "available">].title}</h3>
        <p>{statusCopy[current.status as Exclude<State, "available">].explanation}</p>
      </div>
    </div> : <>
      <div className={styles.summary} role="status">
        <span><strong>{entries.length}</strong> authorized {entries.length === 1 ? "entry" : "entries"} returned</span>
        <span>Recorded direction is not a verified account balance.</span>
      </div>
      <div className={styles.tableScroll} tabIndex={0} aria-label="Authorized individual Finance entries, horizontally scrollable when needed">
        <table className={styles.table}>
          <caption>Recorded Finance entries in this authorized scope, with their own state and evidence references; no reconciled totals.</caption>
          <thead><tr><th scope="col">Entry</th><th scope="col">Account</th><th scope="col">Recorded At</th><th scope="col">Direction</th><th scope="col">Recorded Amount</th><th scope="col">Source</th><th scope="col">State</th><th scope="col">Evidence IDs</th></tr></thead>
          <tbody>{shown.map((item) => <tr key={item.id}>
            <td><strong>{item.entryCode}</strong><small>Revision {item.revision}</small></td>
            <td>{item.accountCode}</td><td><LoggedTimestamp value={item.occurredAt}/></td>
            <td><span className={item.direction === "debit" ? styles.debit : styles.credit}>{item.direction === "debit" ? <ArrowDownLeft size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}{statusLabel(item.direction)}</span></td>
            <td className={styles.amount}>{formatFinanceLedgerAmount(item)}<small>{item.currency}</small></td>
            <td>{statusLabel(item.sourceType)}{item.sourceId && <small title={item.sourceId}>{item.sourceId}</small>}</td>
            <td><span className={styles.recordState}>{statusLabel(item.state)}</span></td>
            <td>{item.evidenceCount} referenced</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileRecords} aria-label="Authorized Finance entry cards">
        {shown.map((item) => <article key={item.id}>
          <div className={styles.cardHead}><strong>{item.entryCode}</strong><span className={styles.recordState}>{statusLabel(item.state)}</span></div>
          <p className={styles.amount}>{formatFinanceLedgerAmount(item)} <small>{item.currency} · {statusLabel(item.direction)}</small></p>
          <dl><div><dt>Account</dt><dd>{item.accountCode}</dd></div><div><dt>Recorded At</dt><dd><LoggedTimestamp value={item.occurredAt}/></dd></div><div><dt>Source</dt><dd>{statusLabel(item.sourceType)}{item.sourceId ? ` · ${item.sourceId}` : ""}</dd></div><div><dt>Evidence</dt><dd>{item.evidenceCount} IDs referenced</dd></div></dl>
        </article>)}
      </div>
      {entries.length > shown.length && <div className={styles.more}><span>Showing {shown.length} of {entries.length} authorized entries</span>
        <button className={styles.refresh} type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>Show More Entries</button>
      </div>}
    </>}
    <p className={styles.disclaimer}>Record state and evidence references reflect what the service returned; neither constitutes settlement, bank matching, maker-checker approval or independently verified profitability.</p>
  </section><div className={styles.journalControlWrap}><FinanceJournalControls person={person}/></div></>;
}
