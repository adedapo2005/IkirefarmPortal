import {useEffect, type ReactNode} from "react";

export const ANALYTICS_SESSION_WAIT_MS = 12_000;

export default function AnalyticsSessionGate({
  checking, timedOut = false, generation = null, onTimeout, onRetry, children,
}: {
  checking: boolean;
  timedOut?: boolean;
  generation?: number | null;
  onTimeout?: (generation: number) => void;
  onRetry?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!checking || generation === null || !onTimeout) return;
    const timer = window.setTimeout(() => onTimeout(generation), ANALYTICS_SESSION_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [checking, generation, onTimeout]);

  if (timedOut) {
    return <section id="production-analytics-workspace" aria-labelledby="analytics-session-recovery-title">
      <h3 id="analytics-session-recovery-title">Analytics Temporarily Unavailable</h3>
      <p role="alert">Your session could not be verified. Try again to load analytics.</p>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try Again</button>}
    </section>;
  }
  if (checking) {
    return <section id="production-analytics-workspace" role="status" aria-busy="true">Checking your session before showing analytics.</section>;
  }
  return children;
}
