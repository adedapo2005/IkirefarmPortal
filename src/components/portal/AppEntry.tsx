"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  type AuthenticatedPrincipal,
  validatePortalMe,
} from "@/lib/authenticated-principal";
import { permissionCatalog } from "@/lib/portal-model";
import { createSessionBoundary } from "@/lib/session-boundary";
import { signInPath } from "@/lib/signin-routing";

const PortalExperience = lazy(() => import("./PortalExperience"));
const knownPermissions = new Set(permissionCatalog);

type EntryState =
  | { kind: "checking" }
  | { kind: "authorized"; principal: AuthenticatedPrincipal }
  | { kind: "unauthorized" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "invalid-contract" };

function AppLoading() {
  return (
    <main className="state-surface" aria-busy="true">
      <p>Checking your secure workspace session…</p>
    </main>
  );
}

function AccessUnavailable({ retry }: { retry: () => void }) {
  return (
    <main className="state-surface">
      <h1>Workspace Unavailable</h1>
      <p>Your workspace could not be opened safely. No application information has been displayed.</p>
      <div className="row wrap mt">
        <button className="btn primary" onClick={retry}>Try Again</button>
        <a className="btn" href="/sign-in">Return To Sign-In</a>
      </div>
    </main>
  );
}

function removeNormalRuntimePersonaOverrides() {
  const url = new URL(window.location.href);
  let changed = false;
  if (url.searchParams.has("persona")) {
    url.searchParams.delete("persona");
    changed = true;
  }
  if (/([?&])persona=/i.test(url.hash)) {
    url.hash = url.hash.replace(/([?&])persona=[^&]*/gi, "$1").replace(/[?&]$/, "");
    changed = true;
  }
  if (changed) window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Normal application entry. A successful HTTP status is not authorization:
 * the complete v6.9.9 principal contract is validated before any privileged
 * component can mount.
 */
export default function AppEntry() {
  const [entry, setEntry] = useState<EntryState>({ kind: "checking" });
  const [analyticsSessionChecking, setAnalyticsSessionChecking] = useState(false);
  const [analyticsSessionTimedOut, setAnalyticsSessionTimedOut] = useState(false);
  const [analyticsSessionGeneration, setAnalyticsSessionGeneration] = useState<number | null>(null);
  const activeSessionCheck = useRef<number | null>(null);
  const [sessionBoundary] = useState(createSessionBoundary);

  const checkSession = useCallback(async () => {
    const request = sessionBoundary.beginRequest();
    if (!request) return;
    // Hide analytics while the existing session lifecycle check is pending.
    // Other workspace routes remain mounted for an unchanged valid session.
    const { generation, signal } = request;
    activeSessionCheck.current = generation;
    setAnalyticsSessionGeneration(generation);
    setAnalyticsSessionTimedOut(false);
    setAnalyticsSessionChecking(true);
    const canCommit = () => sessionBoundary.canCommit(generation);
    const commit = (next: EntryState) => {
      if (!canCommit()) return false;
      setEntry(next);
      return true;
    };
    try {
      const response = await fetch("/api/portal/me", {
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" },
        signal,
      });
      if (!canCommit()) return;
      if (response.status === 401) return void commit({ kind: "unauthorized" });
      if (response.status === 403) return void commit({ kind: "denied" });
      if (!response.ok) return void commit({ kind: "unavailable" });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json"))
        return void commit({ kind: "invalid-contract" });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return void commit({ kind: "invalid-contract" });
      }
      if (!canCommit()) return;
      const validated = validatePortalMe(
        payload,
        response.headers.get("x-daenem-rbac"),
        knownPermissions,
      );
      if (!validated.ok) return void commit({ kind: "invalid-contract" });
      removeNormalRuntimePersonaOverrides();
      commit({ kind: "authorized", principal: validated.principal });
    } catch {
      if (signal.aborted || !canCommit()) return;
      commit({ kind: "unavailable" });
    } finally {
      if (activeSessionCheck.current === generation) activeSessionCheck.current = null;
      if (canCommit()) setAnalyticsSessionChecking(false);
    }
  }, [sessionBoundary]);

  const timeoutAnalyticsSession = useCallback((generation: number) => {
    // Only the still-running check may be cancelled; a completed or newer
    // check must never be invalidated by an old timer.
    if (activeSessionCheck.current !== generation || !sessionBoundary.canCommit(generation)) return;
    activeSessionCheck.current = null;
    sessionBoundary.invalidate();
    setAnalyticsSessionChecking(false);
    setAnalyticsSessionTimedOut(true);
  }, [sessionBoundary]);

  useEffect(() => {
    void checkSession();
    const revalidateVisibleSession = () => {
      if (!sessionBoundary.logoutStarted() && !document.hidden) void checkSession();
    };
    const restoreSession = () => {
      if (!sessionBoundary.logoutStarted()) void checkSession();
    };
    document.addEventListener("visibilitychange", revalidateVisibleSession);
    window.addEventListener("pageshow", restoreSession);
    return () => {
      sessionBoundary.invalidate();
      document.removeEventListener("visibilitychange", revalidateVisibleSession);
      window.removeEventListener("pageshow", restoreSession);
    };
  }, [checkSession, sessionBoundary]);

  const logout = useCallback(async () => {
    if (!sessionBoundary.beginLogout()) return;
    // Logout is terminal for this mounted entry.  Revalidation events and
    // every in-flight response must stay unable to restore authority even if
    // the logout request is slow or fails.
    setEntry({ kind: "unauthorized" });
    try {
      await fetch("/api/portal/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
    } finally {
      window.location.assign("/signin");
    }
  }, [sessionBoundary]);

  // Keep the public gateway on its own route. A failed session check must
  // never mount Sign-In inside the authenticated /app.html workspace.
  // During logout wait for the logout request before leaving the page.
  useEffect(() => {
    if (entry.kind === "unauthorized" && !sessionBoundary.logoutStarted()) {
      window.location.replace(signInPath(window.location.search));
    }
  }, [entry.kind, sessionBoundary]);

  if (entry.kind === "checking") return <AppLoading />;
  if (entry.kind === "unauthorized") return <AppLoading />;
  if (entry.kind === "denied" || entry.kind === "unavailable" || entry.kind === "invalid-contract")
    return <AccessUnavailable retry={() => void checkSession()} />;

  if (!window.location.hash || window.location.hash === "#/signin") {
    const nextRoute =
      entry.principal.accessState === "no_role" ||
      entry.principal.accessState === "provisional" ||
      entry.principal.accessState === "provisional_expired"
        ? "approval-status"
        : "dashboard";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/${nextRoute}`);
  }

  return (
    <Suspense fallback={<AppLoading />}>
      <PortalExperience
        key={entry.principal.securityStamp}
        initialRoute="dashboard"
        principal={entry.principal}
        analyticsSessionChecking={analyticsSessionChecking}
        analyticsSessionTimedOut={analyticsSessionTimedOut}
        analyticsSessionGeneration={analyticsSessionGeneration}
        onAnalyticsSessionTimeout={timeoutAnalyticsSession}
        onAnalyticsSessionRetry={checkSession}
        onLogout={logout}
      />
    </Suspense>
  );
}
