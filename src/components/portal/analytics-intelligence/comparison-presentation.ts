// Period-level comparison rows for reusable analytical presentation. Pure: every value comes from the resolved view.
import {
  formatMetricValue,
  formatPercentChange,
  formatSignedChange,
  type MetricView,
} from "./metric-contract";

// `accent` picks the item's colour cue (current period, previous period, change, target). It never changes the text.
export type ComparisonAccent = "current" | "previous" | "change" | "target";

export type ComparisonItem = Readonly<{
  label: string;
  value: string;
  accent: ComparisonAccent;
}>;

export function periodComparisonItems(view: MetricView): ComparisonItem[] {
  const currentItem: ComparisonItem = {
    label: "Reporting period total",
    value: view.value === null ? "Not shown" : formatMetricValue(view.value, view.unit),
    accent: "current",
  };

  let previousValue: string;
  if (view.comparison === null) previousValue = "No comparison supplied";
  else if (!view.comparison.valid) previousValue = `Not compared: ${view.comparison.reason}`;
  else if (view.previous === null) previousValue = "Not fully verified";
  else previousValue = formatMetricValue(view.previous, view.unit);

  const changeValue = view.change === null
    ? "Not comparable"
    : `${formatSignedChange(view.change, view.unit)} (${formatPercentChange(view.changePct, view.previous)})`;

  const targetValue = view.target === null
    ? "No verified target"
    : view.target.progressPct === null
      ? `Target ${formatMetricValue(view.target.value, view.unit)}`
      : `Target ${formatMetricValue(view.target.value, view.unit)} · ${Math.round(view.target.progressPct)}% reached`;

  return [
    currentItem,
    {label: "Previous period total", value: previousValue, accent: "previous"},
    {label: "Change", value: changeValue, accent: "change"},
    {label: "Target", value: targetValue, accent: "target"},
  ];
}
