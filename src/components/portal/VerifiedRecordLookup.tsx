"use client";

import { useEffect, useState } from "react";
import { Search, ShieldCheck, ArrowUpRight } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { has } from "@/lib/portal-model";
import {
  findAuthorizedRecordSuggestions,
  suggestionSource,
  type AuthorizedRecordSuggestion,
  type AuthorizedSuggestionsResult,
} from "@/lib/farm-form-suggestions";

import styles from './VerifiedRecordLookup.module.css';
import { stage21TaskAccess } from '@/lib/stage21-task-destinations';

const initial: AuthorizedSuggestionsResult = { status: "enter-query", items: [] };

export default function VerifiedRecordLookup({ person, formId, canLeave }: { person: Persona; formId: string; canLeave?:()=>boolean }) {
  const source = suggestionSource(formId);
  const canView = Boolean(source && has(person, source.viewPermission));
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AuthorizedSuggestionsResult>(initial);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<AuthorizedRecordSuggestion | null>(null);
  const trimmed = query.trim();
  const context=JSON.stringify(person);
  const requestKey=JSON.stringify([formId,context,trimmed]);
  const [resultKey,setResultKey]=useState('');
  const [chosenKey,setChosenKey]=useState('');
  const visibleResult=resultKey===requestKey?result:initial;
  const visibleChosen=chosenKey===requestKey?chosen:null;
  const taskAccess=stage21TaskAccess(person,formId);

  useEffect(() => {
    if (!source || !canView || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true);
      void findAuthorizedRecordSuggestions(formId, trimmed, (permission) => has(person, permission), fetch, controller.signal)
        .then((response) => {
          if (!controller.signal.aborted) {setResult(response);setResultKey(requestKey);}
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [formId, trimmed, canView, person, source, requestKey]);

  return (
    <section className="stage21-verified-lookup" aria-label="Verified reference lookup">
      {taskAccess&&<div className={styles.task} role="region" aria-label="Task destination">
        <strong>{taskAccess.task.title}</strong>
        <p>{taskAccess.allowed?taskAccess.task.limitation:'This task is unavailable for your assigned access. No task records are requested here.'}</p>
        {taskAccess.href&&<><a className="link-button" href={taskAccess.href} onClick={event=>{if(canLeave&&!canLeave())event.preventDefault();}}>{taskAccess.canCreate?'Open '+taskAccess.task.title+' Workspace':'View '+taskAccess.task.title+' Only'}<ArrowUpRight size={16} aria-hidden="true"/></a><small>{taskAccess.canCreate?'Assigned create capability; live authorization, required references and site holds are rechecked in the workspace.':'Read-only access. Creation and approvals require separate assigned permissions.'} Company, site and record scope remain server-enforced. Opening a page does not complete the task.</small></>}
      </div>}
      <div className="stage21-verified-lookup-heading">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Authorized Reference Lookup</strong>
          <small>Read-only references from permitted FarmPortal records. Never submitted from this design lab. This lookup does not complete the task. Record authenticity is not certified by a reference selection.</small>
        </div>
      </div>
      {!source ? (
        <p role="status">No verified record source is mapped for this form yet. Use the clearly labelled sample context while its contract is reviewed.</p>
      ) : !canView ? (
        <p role="status">Record lookup unavailable for your assigned permissions. No records are requested.</p>
      ) : (
        <>
          <label className="stage21-verified-lookup-search">
            <Search size={16} aria-hidden="true" />
            <span>Find {source.label.toLowerCase()} reference</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResult(initial);
                setChosen(null);
              }}
              placeholder={"Type 2+ letters or reference characters"}
              autoComplete="off"
              aria-label={"Search authorized " + source.label.toLowerCase() + " records"}
              aria-controls="stage21-reference-results"
              aria-busy={busy}
              aria-describedby="stage21-reference-lookup-help"
            />
          </label>
          <p id="stage21-reference-lookup-help" className="sr-only">Type at least two characters. Results are read-only and are not copied into your draft.</p>
          <div id="stage21-reference-results" aria-live="polite" aria-atomic="true" aria-label="Verified reference results">
            {trimmed.length < 2 ? (
              <p>Search the authenticated record catalogue. Nothing is preloaded or copied into a draft.</p>
            ) : busy ? (
              <p>Checking authorized {source.label.toLowerCase()} references…</p>
            ) : visibleResult.status === "available" ? (
              <ul className="stage21-verified-lookup-results">
                {visibleResult.items.map((item) => (
                  <li key={item.id}>
                    <button type="button" aria-pressed={visibleChosen?.id === item.id} onClick={() => {setChosen(item);setChosenKey(requestKey);}}>
                      <strong>{item.label}</strong>
                      <small>{item.reference} · Verified record · revision {item.revision}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{
                visibleResult.status === "authentication-required" ? "Sign in again to look up verified records." :
                visibleResult.status === "no-data" ? "No matching authorized records. Do not invent a reference." :
                visibleResult.status === "permission-required" ? "This record type is not permitted for your role." :
                visibleResult.status === "unavailable" ? "Verified record source unavailable. Sample entries remain separate." :
                "Preparing an authorized lookup…"
              }</p>
            )}
          </div>
          {visibleChosen && (
            <p className="stage21-verified-lookup-selected" role="status">
              Verified reference selected for review: <strong>{visibleChosen.reference}</strong>. This is not inserted into a sample or submitted to the backend.
            </p>
          )}
        </>
      )}
    </section>
  );
}
