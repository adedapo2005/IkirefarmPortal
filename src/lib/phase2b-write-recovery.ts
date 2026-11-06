"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Persona } from "./portal-model";
import { validateRecoveryProof, type RecoveryProof } from "./farm-recovery-proof";

type Marker = { key: string; token: string };

/**
 * The browser stores only a scoped opaque operation ID. Version 3 IDs are
 * sent to the durable server receipt protocol. A missing receipt is uncertain;
 * only verified commit/cancellation clears a marker. No automatic expiry.
 * Legacy markers were never sent to the server and cannot be safely cancelled
 * through this protocol. They remain blocked for authorized investigation.
 */
export function useScopedWriteRecovery(person: Persona, kind: "breed" | "house") {
  const company = person.organizationScope?.companyKey;
  const site = person.organizationScope?.locationKey;
  const actor = person.authenticatedAccountId;
  const legacyActor = person.id;
  const scope = JSON.stringify([person.principalSource, actor, legacyActor, company, site, kind]);
  const generation = useMemo(() => ({scope}), [scope]);
  const committedScope = useRef<typeof generation | null>(null);
  const resolvedScope = useRef<typeof generation | null>(null);
  useLayoutEffect(() => {
    committedScope.current = generation;
    return () => { if (committedScope.current === generation) committedScope.current = null; };
  }, [generation]);
  const isCurrent = () => committedScope.current === generation && resolvedScope.current === generation;
  const [displayGeneration, setDisplayGeneration] = useState<typeof generation | null>(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(true);
  const [recoverable, setRecoverable] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const validToken = (value: string | null): value is string => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
  const keyRef = useRef<string | null>(null);
  const legacyKeysRef = useRef<readonly string[] | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    resolvedScope.current = null; keyRef.current = null; legacyKeysRef.current = null;
    async function check() {
      try {
        if (person.principalSource !== "authenticated" || !actor || !legacyActor || !company || !site ||
            !globalThis.crypto?.subtle || !navigator.locks) return;
        const fingerprint = async (parts: string[]) => {
          const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parts)));
          return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
        };
        const oldSuffix = await fingerprint(["farmportal-write-recovery-v1", kind, legacyActor, company, site]);
        const suffix = await fingerprint(["farmportal-write-recovery-v3", kind, actor, company, site]);
        const legacyKeys = ["farmportal-pending-write-v1:" + oldSuffix, "farmportal-pending-write-v2:" + oldSuffix];
        const key = "farmportal-pending-write-v3:" + suffix;
        const hasLegacy = legacyKeys.some(item => localStorage.getItem(item) !== null);
        const marker = localStorage.getItem(key);
        if (cancelled || committedScope.current !== generation) return;
        resolvedScope.current = generation;
        setDisplayGeneration(generation);
        legacyKeysRef.current = legacyKeys;
        keyRef.current = key;
        setLegacy(hasLegacy);
        setRecoverable(!hasLegacy && validToken(marker));
        setBlocked(marker !== null || hasLegacy);
        setReady(true);
      } catch {
        // Unavailable storage or hashing is not evidence of a safe retry.
      }
    }
    void check();
    return () => { cancelled = true; mounted.current = false; };
  }, [actor, legacyActor, company, site, kind, person.principalSource, generation]);

  async function begin(): Promise<Marker | null> {
    const key = keyRef.current;
    const legacyKeys = legacyKeysRef.current;
    if (!isCurrent() || !ready || blocked || !key || !legacyKeys || !navigator.locks) return null;
    try {
      // Coordinate with earlier v2 clients in this browser profile.
      return await navigator.locks.request(legacyKeys[1], { mode: "exclusive", ifAvailable: true }, async lock => {
        if (!lock || !isCurrent() || keyRef.current !== key || legacyKeysRef.current !== legacyKeys ||
            legacyKeys.some(item => localStorage.getItem(item) !== null) || localStorage.getItem(key) !== null) {
          if (mounted.current) setBlocked(true);
          return null;
        }
        const token = crypto.randomUUID();
        localStorage.setItem(key, token);
        if (localStorage.getItem(key) !== token) {
          if (mounted.current) setBlocked(true);
          return null;
        }
        if (mounted.current) { setBlocked(true); setRecoverable(true); }
        return { key, token };
      });
    } catch {
      if (mounted.current) setBlocked(true);
      return null;
    }
  }

  function settle(marker: Marker, verified: boolean): boolean {
    try {
      if (verified && mounted.current && isCurrent() && keyRef.current === marker.key && legacyKeysRef.current &&
          !legacyKeysRef.current.some(item => localStorage.getItem(item) !== null) && localStorage.getItem(marker.key) === marker.token) {
        localStorage.removeItem(marker.key);
        if (localStorage.getItem(marker.key) === null) {
          if (mounted.current) { setBlocked(false); setRecoverable(false); }
          return true;
        }
      }
    } catch {
      // Keep the UI locked when marker state cannot be verified.
    }
    if (mounted.current) setBlocked(true);
    return false;
  }

  async function send(marker: Marker, url: string, options: RequestInit) {
    if (!isCurrent() || keyRef.current !== marker.key) throw new Error("RECOVERY_SCOPE_CHANGED");
    const headers = new Headers(options.headers);
    headers.set("x-farm-operation-id",marker.token);
    const response = await fetch(url,{...options,headers});
    if (response.ok && (response.headers.get("x-farm-operation-id") !== marker.token ||
        response.headers.get("x-farm-receipt-state") !== "committed")) {
      // Preserve an HTTP-success body for the controller's existing malformed
      // response check; never translate missing proof into a confirmed result.
      return Response.json({error:"RECEIPT_NOT_CONFIRMED"},{status:200});
    }
    return response;
  }

  async function reconcile(action: "check" | "cancel"): Promise<
    {proof: RecoveryProof; marker: Marker} | {denied: number} | null
  > {
    const key = keyRef.current;
    if (!isCurrent() || !ready || legacy || !recoverable || !key || !actor || !company || !site || !legacyKeysRef.current ||
        legacyKeysRef.current.some(item => localStorage.getItem(item) !== null)) return null;
    try {
      const token = localStorage.getItem(key);
      if (!validToken(token)) return null;
      const response = await fetch("/api/portal/v7/farm-operations/"+kind+"/write-recovery/"+token,{
        method:action === "check" ? "GET" : "POST",credentials:"same-origin",
        headers:{accept:"application/json","content-type":"application/json"},
        ...(action === "cancel" ? {body:JSON.stringify({action:"cancel"})} : {}),
      });
      if (!mounted.current || !isCurrent() || keyRef.current !== key) return null;
      if ([401,403,404].includes(response.status)) return {denied:response.status};
      if (!response.ok) return null;
      const proof = validateRecoveryProof(await response.json(),token,kind,actor,company,site);
      if (!mounted.current || !isCurrent() || keyRef.current !== key) return null;
      // The caller checks its authority epoch before clearing any marker or
      // rendering this proof. A newer denial must always win.
      return proof ? {proof,marker:{key,token}} : null;
    } catch { return null; }
  }

  return { ready: ready && displayGeneration === generation, blocked: displayGeneration !== generation || blocked,
    recoverable: displayGeneration === generation && recoverable, legacy: displayGeneration === generation && legacy, begin, settle, send, reconcile };
}
