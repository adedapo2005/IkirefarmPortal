"use client";

import { ArrowRight, CircleAlert, Clock3, Gauge, ShieldCheck } from "lucide-react";
import type { Page } from "@/lib/portal-model";
import { modulePulseForAllowed } from "@/lib/farm-module-pulse";

/**
 * Read-only Stage 21C operational lens for the seven existing canonical module
 * dashboards. Missing real readings are explicit—not zero or example data.
 */
export default function ModuleOperationsPulse({
  route,
  allowed,
  go,
}: {
  route: string;
  allowed: readonly Page[];
  go: (route: string) => void;
}) {
  const pulse = modulePulseForAllowed(route, allowed);
  if (!pulse) return null;
  const auditRoute = pulse.auditRoute;

  return (
    <section className="purpose-module-pulse" data-module-pulse={pulse.route}
      aria-label={pulse.title + " operational view"}>
      <header className="purpose-pulse-heading">
        <div>
          <span className="purpose-pulse-eyebrow">
            <Gauge size={15} aria-hidden="true" /> Operational view
          </span>
          <h3>{pulse.title}</h3>
          <p>{pulse.introduction}</p>
        </div>
        <span className="purpose-pulse-source-state" role="status">
          <CircleAlert size={15} aria-hidden="true" /> Live records not yet verified
        </span>
      </header>

      <div className="purpose-pulse-body">
        <section className="purpose-pulse-indicators" aria-label="Operational indicators">
          <header>
            <h4>Signals to watch</h4>
            <p>Operational figures stay unavailable until a trusted, scope-checked source is connected.</p>
          </header>
          <div className="purpose-pulse-signal-grid">
            {pulse.indicators.map((indicator, index) => (
              <article className="purpose-pulse-signal" data-signal={indicator.id}
                data-tone={["teal", "violet", "orange"][index % 3]} key={indicator.id}>
                <span className="purpose-pulse-signal-title">{indicator.title}</span>
                <strong aria-label={indicator.title + ": not available"}>—</strong>
                <span className="purpose-pulse-unavailable">Awaiting verified records</span>
                <p>{indicator.requirement}</p>
                {indicator.route === route ? (
                  <small className="purpose-pulse-current">Current workspace</small>
                ) : (
                  <button type="button" onClick={() => go(indicator.route)}
                    aria-label={"Open " + indicator.title + " workspace"}>
                    Open workspace <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </article>
            ))}
          </div>
          {!pulse.indicators.length && (
            <p className="purpose-pulse-empty">
              No additional operational indicators are permitted for your role.
            </p>
          )}
        </section>

        <section className="purpose-pulse-next" aria-label="Authorized next steps">
          <header>
            <h4>Continue your work</h4>
            <p>Direct, permission-filtered destinations</p>
          </header>
          {pulse.actions.length ? (
            <ol>
              {pulse.actions.map((action, index) => (
                <li key={action.route}>
                  <span className="purpose-pulse-step">{index + 1}</span>
                  <button type="button" onClick={() => go(action.route)}>
                    <strong>{action.title}</strong>
                    <small>{action.description}</small>
                  </button>
                  <ArrowRight size={16} aria-hidden="true" />
                </li>
              ))}
            </ol>
          ) : (
            <p className="purpose-pulse-empty">No additional actions are authorized for your role.</p>
          )}
        </section>
      </div>

      <footer className="purpose-pulse-timeline" aria-label="Verified activity timeline status">
        <Clock3 size={18} aria-hidden="true" />
        <div>
          <strong>Verified activity timeline — awaiting connection</strong>
          <p>Required: {pulse.timelineRequirement}. No example events, timestamps or totals are presented as live.</p>
        </div>
        {auditRoute && auditRoute !== route && (
          <button type="button" onClick={() => go(auditRoute)}>
            <ShieldCheck size={15} aria-hidden="true" /> Open Audit Logs
          </button>
        )}
      </footer>
    </section>
  );
}
