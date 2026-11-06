"use client";

import LoggedTimestamp from "../LoggedTimestamp";

import React, {useId} from "react";
import {ArrowDown, ArrowRight, ArrowUp, Minus} from "lucide-react";
import {
  formatMetricValue,
  formatPercentChange,
  formatSignedChange,
  resolveMetric,
  type MetricContract,
  type MetricStatus,
} from "./metric-contract";
import styles from "./analytics-intelligence.module.css";

export type MetricKpiProps = {
  metric: MetricContract;
  now?: Date;
  // `inline` drops the card chrome for use inside an existing panel, so cards do not nest.
  variant?: "card" | "inline";
};

const STATUS_LABEL: Record<MetricStatus, string> = {
  loading: "Loading",
  ready: "Verified",
  empty: "No records",
  unavailable: "Unavailable",
  stale: "Stale",
  error: "Error",
};

export default function MetricKpi({metric, now, variant = "card"}: MetricKpiProps) {
  const titleId = useId();
  const view = resolveMetric(metric, now);
  const unavailable = view.status === "unavailable";
  const heading = unavailable ? `${metric.label} — Data unavailable` : metric.label;
  const showValue = view.value !== null;

  return (
    <section
      className={variant === "inline" ? `${styles.kpi} ${styles.inline}` : styles.kpi}
      aria-labelledby={titleId}
      aria-busy={view.status === "loading" || undefined}
      data-status={view.status}
      data-trend={view.trend}
    >
      <header className={styles.kpiHeader}>
        <h3 id={titleId} className={styles.kpiTitle}>{heading}</h3>
        <span className={styles.badge} data-status={view.status}>{STATUS_LABEL[view.status]}</span>
      </header>

      {view.status === "loading" ? (
        <div className={styles.skeleton} aria-hidden="true" />
      ) : showValue ? (
        <p className={styles.value}>{formatMetricValue(view.value, view.unit)}</p>
      ) : (
        <p className={styles.valueMissing}>
          <span aria-hidden="true">—</span>
          <span className="sr-only">Value not available</span>
        </p>
      )}

      <p className={styles.meta}>
        {metric.period.label}
        {metric.period.start && metric.period.end ? ` · ${metric.period.start} to ${metric.period.end}` : ""}
        {` · ${metric.scope.label}`}
      </p>

      {showValue && view.previous !== null && (
        <p className={styles.trend} data-tone={view.tone}>
          {view.trend === "up" && <ArrowUp size={16} aria-hidden="true" />}
          {view.trend === "down" && <ArrowDown size={16} aria-hidden="true" />}
          {view.trend === "flat" && <Minus size={16} aria-hidden="true" />}
          <span>
            {view.trend === "up" ? "Up " : view.trend === "down" ? "Down " : "No change "}
            {formatSignedChange(view.change, view.unit)} ({formatPercentChange(view.changePct, view.previous)}) against the previous period of {formatMetricValue(view.previous, view.unit)}
          </span>
        </p>
      )}
      {view.comparison && !view.comparison.valid && (
        <p className={styles.reason}>Comparison unavailable: {view.comparison.reason}</p>
      )}
      {view.comparison?.valid && view.previous === null && (
        <p className={styles.reason}>Previous period is not fully verified, so no change is shown.</p>
      )}

      {view.target && (
        <p className={styles.target}>
          Target {formatMetricValue(view.target.value, view.unit)}
          {view.target.progressPct !== null ? ` · ${Math.round(view.target.progressPct)}% reached` : ""}
        </p>
      )}

      {view.reason && <p className={styles.reason}>{view.reason}</p>}

      <p className={styles.source}>
        Source: {metric.source.name}
        {metric.asOf ? <> · As of <LoggedTimestamp value={metric.asOf}/></> : ""}
      </p>

      {view.canDrilldown && metric.drilldown && (
        <a className={styles.drilldown} href={metric.drilldown.href} aria-label={`Open ${metric.label} records`}>
          Open records
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
