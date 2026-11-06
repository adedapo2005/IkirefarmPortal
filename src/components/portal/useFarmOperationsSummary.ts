"use client";

import { useEffect, useState } from "react";
import type { Persona } from "@/lib/portal-model";
import { analyticsSessionContext } from "@/lib/analytics-session-context";

export type FarmSummaryAuthority = {
  authorityStamp?: string;
  sessionChecking?: boolean;
  sessionTimedOut?: boolean;
  onSessionRetry?: () => void;
};
type SummaryState = "loading" | "available" | "no-data" | "sign-in" | "restricted" | "unavailable";
type PulseMetric = { id: string; count: number; authorizedRecords: number };
type Recap = { id: string; label: string; route: string; state: string; updatedAt: string | null };
type Summary = { state: "available" | "no-data"; items: PulseMetric[]; recent: Recap[] };
type Result = { requestKey: string; state: SummaryState; payload: Summary | null };

function validSummary(value: unknown): value is Summary {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<Summary>;
  return (body.state === "available" || body.state === "no-data")
    && Array.isArray(body.items) && body.items.every((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return typeof row.id === "string" && Number.isSafeInteger(row.count) && Number(row.count) >= 0
        && Number.isSafeInteger(row.authorizedRecords) && Number(row.authorizedRecords) >= Number(row.count);
    })
    && Array.isArray(body.recent) && body.recent.every((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return typeof row.id === "string" && typeof row.label === "string" && typeof row.route === "string"
        && typeof row.state === "string" && (row.updatedAt === null || typeof row.updatedAt === "string");
    });
}

/** Private summary consumers share the existing authenticated-session freshness precondition.
 * A context hash is not a credential. The handler still resolves and authorizes the cookie principal.
 */
export function useFarmOperationsSummary(person: Persona, {
  authorityStamp = "", sessionChecking = false, sessionTimedOut = false, onSessionRetry,
}: FarmSummaryAuthority) {
  const usable = person.principalSource === "authenticated" && Boolean(person.authenticatedAccountId?.trim())
    && Boolean(person.organizationScope?.companyKey?.trim()) && Boolean(person.organizationScope?.locationKey?.trim())
    && person.farm && person.restriction === "none" && Boolean(authorityStamp);
  const scopeKey = JSON.stringify([
    authorityStamp, person.principalSource, person.authenticatedAccountId, person.id, person.accessState,
    person.restriction, person.farm, [...person.permissions].sort(),
    Object.entries(person.organizationScope || {}).sort(([a], [b]) => a.localeCompare(b)),
    Object.entries(person.permissionScopes || {}).sort(([a], [b]) => a.localeCompare(b)),
    sessionChecking, sessionTimedOut,
  ]);
  const [generation, setGeneration] = useState(0);
  const [scopeEpoch, setScopeEpoch] = useState({ key: scopeKey, value: 0 });
  // Returning to an earlier scope must not match its previous result tag.
  // Guarded render-time adjustment prevents even a one-frame revival.
  if (scopeEpoch.key !== scopeKey) setScopeEpoch({ key: scopeKey, value: scopeEpoch.value + 1 });
  const requestKey = JSON.stringify([scopeKey, scopeEpoch.value, generation]);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!usable || sessionChecking || sessionTimedOut) return;
    const controller = new AbortController();
    let active = true;
    const commit = (state: SummaryState, payload: Summary | null = null) => {
      if (active) setResult({ requestKey, state, payload });
    };
    const load = async () => {
      try {
        const context = await analyticsSessionContext(authorityStamp);
        if (!active) return;
        const response = await fetch("/api/portal/v7/farm-operations/summary", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
          headers: { accept: "application/json", "x-farm-analytics-context": context },
        });
        if (!active) return;
        if (response.status === 401) return commit("sign-in");
        if (response.status === 403 || response.status === 404) return commit("restricted");
        if (!response.ok) throw new Error("UNAVAILABLE");
        const body: unknown = await response.json();
        if (!active) return;
        if (!validSummary(body)) throw new Error("INVALID_SOURCE");
        commit(body.state, body);
      } catch {
        if (active) commit("unavailable");
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [authorityStamp, requestKey, usable, sessionChecking, sessionTimedOut]);

  const refresh = () => {
    if (sessionChecking) return;
    if (sessionTimedOut) { onSessionRetry?.(); return; }
    setGeneration(value => value + 1);
  };

  // Tag results by scope AND request generation. Conceal obsolete state in the
  // render that observes a change, before effect cleanup or the next fetch.
  const current = result?.requestKey === requestKey ? result : null;
  const state: SummaryState = sessionChecking ? "loading" : sessionTimedOut ? "unavailable"
    : !usable ? "restricted" : current?.state || "loading";
  const payload = state === "available" || state === "no-data" ? current?.payload || null : null;
  return { state, payload, refresh };
}
