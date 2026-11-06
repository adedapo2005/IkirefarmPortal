"use client";

import { useSyncExternalStore } from "react";
import { metricWidgetCatalog, widgetLayout } from "@/lib/widget-layout";
import { canPage, has, Persona } from "@/lib/portal-model";
import { Btn, Panel } from "./Common";

export default function PersonalizedWidgets({ person, go }: { person: Persona; go: (id: string) => void }) {
  useSyncExternalStore(widgetLayout.subscribe, widgetLayout.revision, () => 0);
  if (!has(person, "widgets.manage")) return null;
  const available = metricWidgetCatalog.filter((widget) => has(person, widget.permission) && canPage(person, widget.route));
  const stored = widgetLayout.get(person.id);
  const layout = stored?.length ? stored : available.slice(0, 6).map((widget) => ({ id: widget.id, visible: true, size: "Standard", collapsed: false }));
  const visible = layout.filter((item) => item.visible && available.some((widget) => widget.id === item.id));

  return (
    <section className="personalized-widgets" data-zero-click="authenticated-widgets">
      <div className="row between wrap">
        <div><span className="eyebrow">AUTHORIZED OPERATIONAL PULSE</span><h2>Your information widgets</h2></div>
        {canPage(person, "widget-studio") && <Btn onClick={() => go("widget-studio")}>Configure widgets</Btn>}
      </div>
      <p>Primary status is always visible. Sample and unavailable states are never presented as live ERP data.</p>
      <div className="widget-canvas">
        {visible.map((item) => {
          const definition = available.find((widget) => widget.id === item.id)!;
          return (
            <Panel key={item.id} title={definition.label} className={`metric-widget widget-tile ${item.size === "Wide" ? "wide" : ""}`}>
              {!item.collapsed && <div className="metric-widget-preview" data-accent={definition.accent}>
                <span>SAMPLE / AUTHORIZED SCOPE</span>
                <strong>{definition.value}</strong>
                <small>{definition.status}</small>
                <p>{definition.description}</p>
                <Btn onClick={() => go(definition.route)}>Open detail</Btn>
              </div>}
            </Panel>
          );
        })}
      </div>
    </section>
  );
}
