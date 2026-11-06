"use client";

import React from "react";
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus} from "lucide-react";
import {differenceTone, formatInspectionDay, type DayInspection} from "./day-inspection";
import {
  formatMetricValue,
  formatPercentChange,
  formatSignedChange,
  type MetricPolarity,
  type MetricUnit,
} from "./metric-contract";
import styles from "./analytics-intelligence.module.css";

export type DayInspectorProps = {
  label: string;
  inspection: DayInspection | null;
  unit: MetricUnit;
  polarity: MetricPolarity;
  showPrevious: boolean;
  canEarlier: boolean;
  canLater: boolean;
  onStep: (step: 1 | -1) => void;
};

// Keyboard alternative to clicking a point: the buttons move the selected day, and the readout is announced politely.
export default function DayInspector({label, inspection, unit, polarity, showPrevious, canEarlier, canLater, onStep}: DayInspectorProps) {
  const change = inspection ? differenceTone(inspection.difference, polarity) : null;
  const ChangeIcon = change?.direction === "up" ? ArrowUp : change?.direction === "down" ? ArrowDown : Minus;

  return (
    <div className={styles.inspector} role="group" aria-label={`${label} day inspector`}>
      {/* aria-disabled (not disabled) keeps keyboard focus on the control when the window edge is reached. */}
      <button type="button" className={styles.stepButton} onClick={() => canEarlier && onStep(-1)} aria-disabled={!canEarlier}>
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Earlier day</span>
      </button>

      <div className={styles.inspectorReadout} aria-live="polite">
        {inspection === null ? (
          <span>No day selected.</span>
        ) : (
          // Keyed by the selected day, so the readout settles in again whenever the day changes.
          <div key={inspection.date} className={styles.readoutBody}>
            <p className={styles.inspectorDate}>
              <span className={styles.eyebrow}>Selected day</span>
              <strong>{formatInspectionDay(inspection.date)}</strong>
            </p>
            <span className={styles.readoutRow} data-series="collected">
              <span className={styles.swatch} data-series="collected" aria-hidden="true" />
              Collected: {formatMetricValue(inspection.value, unit)}
            </span>
            {showPrevious && (
              <span className={styles.readoutRow} data-series="previous">
                <span className={styles.swatch} data-series="previous" aria-hidden="true" />
                Previous period: {formatMetricValue(inspection.previous, unit)}
              </span>
            )}
            {change && (
              // Direction and sign are carried by the icon and the text, so tone colour is never the only cue.
              <span className={styles.readoutChip} data-tone={change.tone}>
                <ChangeIcon size={15} aria-hidden="true" />
                Difference: {formatSignedChange(inspection.difference, unit)} ({formatPercentChange(inspection.differencePct, inspection.previous)})
              </span>
            )}
          </div>
        )}
      </div>

      <button type="button" className={styles.stepButton} onClick={() => canLater && onStep(1)} aria-disabled={!canLater}>
        <span>Later day</span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
