"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, ChevronDown, CircleAlert, ClipboardCheck, Clock3, ShieldAlert } from "lucide-react";
import type { Page } from "@/lib/portal-model";
import { specialistPulseForAllowed } from "@/lib/farm-specialist-pulse";
import { isSystemPulseRoute, systemPulseForAllowed } from "@/lib/farm-system-pulse";

/** A compact operational dashboard beside, never instead of, an established specialist workspace. */
export default function SpecialistModulePulse({
  route, allowed, go,
}: {
  route: string;
  allowed: readonly Page[];
  go: (route: string) => void;
}) {
  const isSystemWorkspace = isSystemPulseRoute(route);
  const pulse = specialistPulseForAllowed(route, allowed) ?? systemPulseForAllowed(route, allowed);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 900px)");
    const update = () => {
      if (detailsRef.current) detailsRef.current.open = desktop.matches;
    };
    // Responsive default only: preserve native pointer toggling without
    // racing the disclosure with React state. Keyboard activation is explicit.
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, [route]);

  // Supplier Management now owns its verified D1 dashboard. Keep the generic
  // specialist readiness fixture for the other unconnected modules only.
  if (!pulse || route === "suppliers") return null;
  return (
    <details ref={detailsRef} className="specialist-pulse" data-specialist-pulse={pulse.route}>
      <summary className="specialist-pulse-summary" tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          // One intentional toggle for either keyboard activation key.
          // Do not also let the native default toggle the disclosure.
          event.preventDefault();
          if (detailsRef.current) detailsRef.current.open = !detailsRef.current.open;
        }}>
        <span className="specialist-pulse-symbol"><ClipboardCheck size={19} aria-hidden="true" /></span>
        <span className="specialist-pulse-intro">
          <small>{isSystemWorkspace ? "System & governance dashboard" : "Specialist module dashboard"}</small>
          <strong>{pulse.title} — {isSystemWorkspace ? "control readiness" : "operational readiness"}</strong>
          <span>{pulse.subtitle}</span>
        </span>
        <span className="specialist-pulse-state">
          <CircleAlert size={14} aria-hidden="true" /> {isSystemWorkspace ? "Control sources unverified" : "Live data unverified"}
        </span>
        <ChevronDown className="specialist-pulse-chevron" size={19} aria-hidden="true" />
      </summary>

      <div className="specialist-pulse-expanded">
        <div className="specialist-pulse-indicators" role="group" aria-label={isSystemWorkspace ? "Required control indicators" : "Required operational indicators"}>
          {pulse.indicators.map((indicator, index) => (
            <article key={indicator.id} className="specialist-pulse-indicator"
              data-indicator={indicator.id} data-tone={["teal", "violet", "orange"][index % 3]}>
              <small>{indicator.title}</small>
              <strong>
                <span aria-hidden="true">—</span>
                <span className="sr-only">{indicator.title}: data unavailable</span>
              </strong>
              <span>{isSystemWorkspace ? "Awaiting verified controls" : "Awaiting verified records"}</span>
              <p>{indicator.requirement}</p>
            </article>
          ))}
        </div>

        <div className="specialist-pulse-bottom">
          <section className="specialist-pulse-steps" aria-label="Authorized related work">
            <h4>Continue your work</h4>
            {pulse.actions.length ? (
              <div className="specialist-pulse-links">
                {pulse.actions.map(action => (
                  <button type="button" key={action.route} onClick={() => go(action.route)}>
                    {action.label} <ArrowRight size={15} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : <p>No additional linked workspace is authorized for your role.</p>}
          </section>

          <section className="specialist-pulse-timeline" aria-label="Source and activity readiness">
            <Clock3 size={17} aria-hidden="true" />
            <div>
              <h4>Activity history requires verified sources</h4>
              <p>{pulse.timeline}. This dashboard does not show fictional events as live.</p>
            </div>
            <ShieldAlert size={17} aria-hidden="true" />
          </section>
        </div>
      </div>
    </details>
  );
}
