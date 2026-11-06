"use client";

import React from "react";
import type {ComparisonItem} from "./comparison-presentation";
import styles from "./analytics-intelligence.module.css";

export type ComparisonListProps = {
  label: string;
  // Visible explanation of the dates the totals cover. Optional, so a secondary list can rely on the one above it.
  caption?: string;
  items: readonly ComparisonItem[];
  // "hero" is the primary total and its change; "secondary" is the supporting figures.
  variant?: "hero" | "secondary";
};

// Reusable definition list for period comparisons. Values are supplied already formatted by the caller.
// Items are separated by a coloured edge and hairline spacing, not by nested boxes.
export default function ComparisonList({label, caption, items, variant = "secondary"}: ComparisonListProps) {
  return (
    <section className={styles.comparison} aria-label={label} data-variant={variant}>
      {caption && <p className={styles.caption}>{caption}</p>}
      <dl className={styles.comparisonList}>
        {items.map((item) => (
          <div key={item.label} className={styles.comparisonItem} data-accent={item.accent}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
