"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CircleAlert, FileText, RefreshCw, Search, ShieldCheck } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import {
  combineFinanceFinderPages, financeFinderKinds, financeFinderMoney,
  matchesFinanceFinderRecord, parseFinanceFinderPage,
  type FinanceFinderKind, type FinanceFinderPage, type FinanceFinderRecord,
} from "@/lib/finance-record-finder";
import LoggedTimestamp from "./LoggedTimestamp";
import styles from "./FinanceRecordFinder.module.css";

type SourceState = "loading" | "available" | "no-data" | "hidden" | "authentication-required" | "unavailable";
type Snapshot = Readonly<{ scopeKey: string; state: SourceState; records: readonly FinanceFinderRecord[]; readAt: number | null }>;
const sourceNames: Record<FinanceFinderKind, string> = {
  revenue: "Revenue", expense: "Expenses", "ledger-entry": "Ledger Entries",
};
const pageSize = 10;
const emptyRecords: readonly FinanceFinderRecord[] = Object.freeze([]);
const label = (value: string) => value.replaceAll("-", " ").replace(/\b\w/g, m => m.toUpperCase());
const scopeFingerprint = (person: Persona) => JSON.stringify([
  person.id, person.principalSource, person.email, person.accessState, person.restriction,
  Object.entries(person.organizationScope || {}).sort(([a], [b]) => a.localeCompare(b)),
  [...person.permissions].sort(),
  Object.entries(person.permissionScopes || {}).sort(([a], [b]) => a.localeCompare(b)),
]);
const messages: Record<Exclude<SourceState,"available">,{title:string;description:string}> = {
  loading: { title: "Checking your authorized Finance records", description: "Reading Revenue, Expense, and Ledger Entry registers without changing any records." },
  "no-data": { title: "No Finance records returned for this scope", description: "The record services responded, but these three collections contain no visible entries in the current authorized scope. This does not establish a zero balance or zero financial activity." },
  hidden: { title: "Records unavailable in this scope", description: "One or more requested Finance sources cannot be accessed under the current permissions. Previous record details have been cleared." },
  "authentication-required": { title: "Sign-in required", description: "Renew your Finance session to inspect authorized records. Previous account data has been cleared." },
  unavailable: { title: "Finance record sources unavailable", description: "An authorized record source could not be fully verified. To avoid partial or misleading results, no records are displayed. Try again." },
};
class FinderReadError extends Error {
  constructor(readonly kind: SourceState) { super(kind); }
}
async function readKind(kind: FinanceFinderKind, signal: AbortSignal): Promise<FinanceFinderPage> {
  const all: FinanceFinderRecord[] = [];
  const seen = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 12; pageNumber++) {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch("/api/portal/v7/commercial-finance/" + kind + "?" + query.toString(), {
      credentials: "same-origin", cache: "no-store",
      headers: { accept: "application/json" }, signal,
    });
    if (response.status === 401) throw new FinderReadError("authentication-required");
    if (response.status === 403 || response.status === 404) throw new FinderReadError("hidden");
    if (!response.ok) throw new FinderReadError("unavailable");
    const listing = parseFinanceFinderPage(kind, await response.json());
    for (const record of listing.records) {
      if (seen.has(record.key)) throw new FinderReadError("unavailable");
      seen.add(record.key);
      all.push(record);
    }
    if (all.length > 2000) throw new FinderReadError("unavailable");
    if (!listing.nextCursor) return {
      records: all,
      nextCursor: null,
      state: all.length ? "available" : "no-data",
    };
    if (cursors.has(listing.nextCursor)) throw new FinderReadError("unavailable");
    cursors.add(listing.nextCursor);
    cursor = listing.nextCursor;
  }
  throw new FinderReadError("unavailable");
}
function statusDetail(state: SourceState) {
  return messages[state === "available" ? "no-data" : state];
}

export default function FinanceRecordFinder({ person }: { person: Persona }) {
  const scopeKey = scopeFingerprint(person);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ scopeKey, state: "loading", records: [], readAt: null }));
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | FinanceFinderKind>("all");
  const [selectedKey, setSelectedKey] = useState("");
  const [showCount, setShowCount] = useState(pageSize);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSnapshot({ scopeKey, state: "loading", records: [], readAt: null });
    setSearch("");
    setKind("all");
    setSelectedKey("");
    setShowCount(pageSize);
    const read = async () => {
      try {
        const listings = await Promise.all(financeFinderKinds.map(item => readKind(item, controller.signal)));
        if (!active) return;
        const records = combineFinanceFinderPages(listings);
        const hashParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
        const wantedKind = hashParams.get("kind");
        const wantedRecord = hashParams.get("record");
        const hasDeepLink = Boolean(wantedKind || wantedRecord);
        const wantedKey = wantedKind && wantedRecord ? wantedKind + ":" + wantedRecord : "";
        setSelectedKey(hasDeepLink ? (records.some(item => item.key === wantedKey) ? wantedKey : "__hidden__") : "");
        setSnapshot({ scopeKey, state: records.length ? "available" : "no-data", records, readAt: Date.now() });
      } catch (err) {
        if (!active) return;
        setSnapshot({ scopeKey, state: err instanceof FinderReadError ? err.kind : "unavailable", records: [], readAt: null });
      }
    };
    void read();
    return () => { active = false; controller.abort(); };
  }, [scopeKey, refresh]);

  // Scope switches must drop prior records during render, even before the next effect runs.
  const current = snapshot.scopeKey === scopeKey ? snapshot :
    { scopeKey, state: "loading" as SourceState, records: [], readAt: null };
  const entries = current.state === "available" ? current.records : emptyRecords;
  const filtered = useMemo(() =>
    entries.filter(record => (kind === "all" || record.kind === kind) && matchesFinanceFinderRecord(record, search)),
    [entries, kind, search],
  );
  const selected = filtered.find(record => record.key === selectedKey)
    || (!selectedKey || !filtered.some(item => item.key === selectedKey) && selectedKey !== "__hidden__"
      ? filtered[0] : undefined);
  const shown = filtered.slice(0, showCount);
  const readAt = current.readAt ? new Date(current.readAt).toISOString() : null;

  const selectRecord = (record: FinanceFinderRecord) => {
    setSelectedKey(record.key);
    // Only allow already authorized identities into the route, never load an unverified deep link.
    window.history.replaceState(null, "", "#/finance?kind=" + encodeURIComponent(record.kind)
      + "&record=" + encodeURIComponent(record.id));
  };
  return <section className={styles.finder} data-finance-finder="source-bound"
    data-finance-finder-state={current.state} aria-labelledby="finance-record-finder-title" aria-busy={current.state === "loading"}>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}><Search size={16} aria-hidden="true"/> Finance Records · Authorized Search</p>
        <h2 id="finance-record-finder-title">Finance Record Finder And Detail</h2>
        <p>Find individual Revenue, Expense and Ledger Entry records. These are not a verified bank transaction feed, reconciled journal or profit report.</p>
      </div>
      <button type="button" className={styles.refresh} disabled={current.state === "loading"}
        onClick={() => setRefresh(value => value + 1)} aria-label="Refresh authorized Finance finder">
        <RefreshCw size={16} aria-hidden="true"/> Refresh Records
      </button>
    </div>
    <div className={styles.sourceBar}>
      <ShieldCheck size={16} aria-hidden="true"/>
      <span>Authenticated, permission-scoped Finance record services</span>
      <span className={styles.separator}>·</span>
      <strong>{current.state === "available" || current.state === "no-data" ? "Sources Connected" :
        current.state === "loading" ? "Checking Sources" : "Access Unavailable"}</strong>
      {readAt && <><span className={styles.separator}>·</span><span>Checked <LoggedTimestamp value={readAt}/></span></>}
    </div>
    {current.state !== "available" ? <div className={styles.message} role={["unavailable","authentication-required","hidden"].includes(current.state) ? "alert" : "status"}>
      <CircleAlert size={22} aria-hidden="true"/>
      <div><h3>{statusDetail(current.state).title}</h3><p>{statusDetail(current.state).description}</p></div>
    </div> : <>
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={17} aria-hidden="true"/>
          <span className="sr-only">Search authorized Finance records</span>
          <input value={search} onChange={event => { setSearch(event.target.value); setShowCount(pageSize); }}
            placeholder="Search Code, Description, Source Or Status"/>
        </label>
        <div role="group" aria-label="Filter Finance record type" className={styles.filters}>
          {(["all", ...financeFinderKinds] as const).map(option =>
            <button key={option} type="button" aria-pressed={kind === option}
              onClick={() => { setKind(option); setShowCount(pageSize); }}>
              {option === "all" ? "All Records" : sourceNames[option]}
            </button>)}
        </div>
      </div>
      <p className={styles.count} role="status">{filtered.length} of {entries.length} authorized records in this loaded scope. No account balances calculated.</p>
      {filtered.length === 0 ? <div className={styles.message} role="status">
        <Search size={20} aria-hidden="true"/><div><h3>No matching authorized records</h3><p>Adjust the search or record-type filter. A missing match does not reveal whether a hidden record exists.</p></div>
      </div> :
      <div className={styles.layout}>
        <div className={styles.results} role="group" aria-label="Authorized Finance record search results">
          {shown.map(record =>
            <button key={record.key} type="button" onClick={() => selectRecord(record)}
              aria-pressed={selected?.key === record.key} className={styles.result}>
              <span className={styles.resultTop}><strong>{record.code}</strong><span className={styles.type}>{sourceNames[record.kind]}</span></span>
              <span className={styles.resultSummary}>{record.summary}</span>
              <span className={styles.resultBottom}>{label(record.state)} · <LoggedTimestamp value={record.occurredAt}/> · {record.currency}</span>
            </button>)}
          {showCount < filtered.length && <button type="button" className={styles.more}
            onClick={() => setShowCount(n => n + pageSize)}>Show More Records ({filtered.length - shown.length} remaining)</button>}
        </div>
        {selected ? <article className={styles.detail} data-finance-selected-kind={selected.kind} aria-label="Selected authorized Finance record detail">
          <div className={styles.detailHead}>
            <div><p className={styles.eyebrow}>{sourceNames[selected.kind]} · Read-Only Detail</p>
              <h3>{selected.code}</h3><p>{selected.summary}</p></div>
            <span className={styles.stateChip}>{label(selected.state)}</span>
          </div>
          <div className={styles.money}>
            <span>Recorded Amount</span>
            <strong>{financeFinderMoney(selected.amount, selected.currency)}</strong>
            <small>{selected.currency} · This is an individual recorded amount, not a balance or proof of settlement.</small>
          </div>
          <dl className={styles.facts}>
            <div><dt>Record Kind</dt><dd>{sourceNames[selected.kind]}</dd></div>
            <div><dt>Record ID</dt><dd>{selected.id}</dd></div>
            <div><dt>Recorded At</dt><dd><LoggedTimestamp value={selected.occurredAt}/></dd></div>
            <div><dt>Revision</dt><dd>{selected.revision}</dd></div>
            <div><dt>Workflow State</dt><dd>{label(selected.state)}</dd></div>
            <div><dt>Evidence References</dt><dd>{selected.evidenceCount} ID{selected.evidenceCount === 1 ? "" : "s"} recorded · Files not verified</dd></div>
            {selected.kind === "ledger-entry" && <>
              <div><dt>Account Code</dt><dd>{selected.accountCode}</dd></div>
              <div><dt>Entry Direction</dt><dd className={styles.direction}>{selected.direction === "debit" ? <ArrowDownRight size={15} aria-hidden="true"/> : <ArrowUpRight size={15} aria-hidden="true"/>}{label(selected.direction || "")}</dd></div>
            </>}
            {selected.category && <div><dt>Expense Category</dt><dd>{selected.category}</dd></div>}
            {selected.paymentStatus && <div><dt>Recorded Payment Status</dt><dd>{label(selected.paymentStatus)} · Not independently settled</dd></div>}
            {selected.sourceType && <div><dt>Declared Source Type</dt><dd>{label(selected.sourceType)}</dd></div>}
            {selected.sourceId && <div><dt>Declared Source ID</dt><dd>{selected.sourceId} · Target not independently verified here</dd></div>}
          </dl>
          <div className={styles.disclosure}><FileText size={18} aria-hidden="true"/>
            <p>Details are taken only from authorized Finance source records. Evidence IDs are references, not opened files. This finder does not establish journal balance, bank matching, cash received, or audited profitability.</p>
          </div>
        </article> : <div className={styles.message}><CircleAlert size={18} aria-hidden="true"/>
          <div><h3>Record unavailable in this selection</h3><p>Select an authorized result to view its details. Hidden record identities are never disclosed.</p></div>
        </div>}
      </div>}
    </>}
  </section>;
}
