"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "lucide-react";
import type { FeedbackResult } from "@/lib/stage25-feedback-contract";
import styles from "./Stage25ActionFeedback.module.css";

export type Stage25ActionFeedbackProps = {
  /** Trusted presentation model: created only from an authorized server result. */
  feedback: FeedbackResult;
  /** No client-origin record number, audit ID, actor, amount or location text. */
  context?: "Flock Record" | "Daily Flock Report" | "Farm Operations";
};

/**
 * Static, inline feedback that cannot obscure a Save button, centered dialog,
 * mobile keyboard or report history. No timer-driven success, synthetic audit
 * link, persistent decorative motion or unauthorized navigation.
 */
export default function Stage25ActionFeedback({
  feedback,
  context = "Farm Operations",
}: Stage25ActionFeedbackProps) {
  const tone = feedback.tone;
  const urgent = tone === "error" || tone === "warning";
  const Icon = tone === "success"
    ? CheckCircle2
    : tone === "warning"
      ? AlertTriangle
      : tone === "error"
        ? CircleAlert
        : Info;

  return (
    <section
      className={styles.feedback}
      data-tone={tone}
      data-stage25-feedback={feedback.state}
      aria-label={context + " Feedback"}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className={styles.iconSurface} aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <div className={styles.content}>
        <p className={styles.eyebrow}>{context}</p>
        <strong className={styles.title}>{feedback.title}</strong>
        <p className={styles.message}>{feedback.message}</p>
      </div>
    </section>
  );
}
