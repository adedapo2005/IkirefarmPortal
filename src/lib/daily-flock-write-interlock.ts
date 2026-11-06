"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Persona } from "./portal-model";

type Pending = { key: string; token: string };

/** A safety interlock, not a receipt. Nothing except an opaque UUID is stored.
 * Missing storage, a corrupt marker, denial and an empty read all fail closed.
 * Only the matching confirmed server response may remove this marker. */
export function useDailyFlockWriteInterlock(person?: Persona) {
  const actor = person?.authenticatedAccountId;
  const legacyActor = person?.id;
  const company = person?.organizationScope?.companyKey;
  const site = person?.organizationScope?.locationKey;
  const scope = JSON.stringify([person?.principalSource, actor, legacyActor, company, site]);
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
  const [legacyBlocked, setLegacyBlocked] = useState(false);
  const keyRef = useRef<string | null>(null);
  const legacyKeyRef = useRef<readonly string[] | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    resolvedScope.current = null; keyRef.current = null; legacyKeyRef.current = null;
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setReady(false); setBlocked(true); setLegacyBlocked(false);
      try {
        if (person?.principalSource !== "authenticated" || !actor || !legacyActor || !company || !site ||
            !crypto?.subtle || !navigator.locks) return;
        const fingerprint = async (parts: string[]) => {
          const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parts)));
          return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
        };
        const oldSuffix = await fingerprint(["daily-flock-pending-v1", legacyActor, company, site]);
        const suffix = await fingerprint(["daily-flock-pending-v3", actor, company, site]);
        const legacyKeys = ["farmportal-daily-flock-pending-v1:" + oldSuffix,
          "farmportal-daily-flock-pending-v2:" + oldSuffix];
        const key = "farmportal-daily-flock-pending-v3:" + suffix;
        const hasLegacy = legacyKeys.some(item => localStorage.getItem(item) !== null);
        const marker = localStorage.getItem(key);
        if (!active || committedScope.current !== generation) return;
        resolvedScope.current = generation;
        setDisplayGeneration(generation);
        legacyKeyRef.current = legacyKeys; keyRef.current = key;
        setLegacyBlocked(hasLegacy); setBlocked(hasLegacy || marker !== null); setReady(true);
      } catch { /* Storage failure must not permit a write. */ }
    }
    void load();
    return () => { active = false; mounted.current = false; };
  }, [actor, legacyActor, company, site, person?.principalSource, generation]);

  async function begin(): Promise<Pending | null> {
    const key = keyRef.current;
    const legacyKey = legacyKeyRef.current;
    if (!isCurrent() || !ready || blocked || !key || !legacyKey || !navigator.locks) return null;
    try {
      // Share the legacy v2 browser lock while checking both old markers.
      return await navigator.locks.request(legacyKey[1], {mode:"exclusive",ifAvailable:true}, lock => {
        if (!lock || !isCurrent() || keyRef.current !== key || legacyKeyRef.current !== legacyKey ||
            legacyKey.some(item => localStorage.getItem(item) !== null) || localStorage.getItem(key) !== null) {
          if (mounted.current) setBlocked(true);
          return null;
        }
        const token = crypto.randomUUID();
        localStorage.setItem(key, token);
        if (localStorage.getItem(key) !== token) {
          if (mounted.current) setBlocked(true);
          return null;
        }
        if (mounted.current) setBlocked(true);
        return {key,token};
      });
    } catch {
      if (mounted.current) setBlocked(true);
      return null;
    }
  }

  function confirm(pending: Pending): boolean {
    try {
      if (!mounted.current || !isCurrent() || keyRef.current !== pending.key || !legacyKeyRef.current ||
          legacyKeyRef.current.some(item => localStorage.getItem(item) !== null) || localStorage.getItem(pending.key) !== pending.token) return false;
      localStorage.removeItem(pending.key);
      if (localStorage.getItem(pending.key) !== null) return false;
      setBlocked(false); return true;
    } catch { return false; }
  }
  function pending(): Pending | null {
    try {
      const key = keyRef.current, legacyKey = legacyKeyRef.current;
      if (!isCurrent() || !ready || !key || !legacyKey || legacyKey.some(item => localStorage.getItem(item) !== null)) return null;
      const token = localStorage.getItem(key);
      return token && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token) ? {key,token} : null;
    } catch { return null; }
  }
  return {ready: ready && displayGeneration === generation, blocked: displayGeneration !== generation || blocked,
    legacyBlocked: displayGeneration === generation && legacyBlocked, begin,confirm,pending};
}
