/** Single-attempt UI delivery control; no network, persistence or receipt endpoint is owned here. */
import { captureCanonicalDailyFlockExpectation, interpretCanonicalDailyFlockFeedback } from "./stage25-canonical-daily-flock-feedback.ts";
import type { CanonicalDailyFlockExpectation } from "./stage25-canonical-daily-flock-feedback.ts";
import type { FeedbackResult } from "./stage25-feedback-contract.ts";

export type CanonicalDailyFlockRequest = CanonicalDailyFlockExpectation & Readonly<{
  send: () => Promise<{ readonly status: number; json: () => Promise<unknown> }>;
}>;
export type CanonicalDailyFlockDelivery = Readonly<{
  feedback: FeedbackResult;
  confirmed: boolean;
  suppressDuplicate: boolean;
  preserveInput: boolean;
  refreshHistory: boolean;
  requiresSignIn: boolean;
  requiresReconciliation: boolean;
}>;
const unresolved = (): FeedbackResult => ({
  state: "unconfirmed", tone: "warning", title: "Reconciliation Required",
  message: "An Earlier Report Request May Have Reached The Server. Keep Your Entries And Do Not Retry Until It Is Reconciled.",
  recordId: null, revision: null, auditId: null, occurredAt: null, canOpenRecord: false, canShowAudit: false,
});
const invalidInput = (): FeedbackResult => ({ ...unresolved(), state: "validation-error", title: "Review The Report Details",
  message: "Select A Valid Flock, Date And Report Revision Before Sending This Request.",
});

export function createCanonicalDailyFlockActionController() {
  let busy = false;
  // Component-lifetime guard only. It is not durable cross-reload/device idempotency.
  let reconciliation = false;
  const wrap = (feedback: FeedbackResult, requiresSignIn = false): CanonicalDailyFlockDelivery => {
    const confirmed = feedback.state === "saved" || feedback.state === "submitted";
    // Authority can disappear after a write commits but before its response is released.
    // A masked denial is therefore not evidence that no mutation occurred.
    if (feedback.state === "denied") feedback = { ...feedback,
      message: "Access Is Unavailable And The Write Outcome Is Not Confirmed. Do Not Retry Until Access And The Earlier Request Are Reconciled.",
    };
    if (["unconfirmed", "unavailable", "pending", "conflict", "denied"].includes(feedback.state)) reconciliation = true;
    return { feedback, confirmed, suppressDuplicate: false, preserveInput: !confirmed,
      refreshHistory: confirmed || feedback.state === "conflict", requiresSignIn, requiresReconciliation: reconciliation };
  };
  return {
    get busy() { return busy; },
    get requiresReconciliation() { return reconciliation; },
    async run(input: CanonicalDailyFlockRequest): Promise<CanonicalDailyFlockDelivery> {
      if (reconciliation) return { feedback: unresolved(), confirmed: false, suppressDuplicate: true,
        preserveInput: true, refreshHistory: false, requiresSignIn: false, requiresReconciliation: true };
      if (busy) return { feedback: { ...unresolved(), state: "pending", tone: "info", title: "Request In Progress",
        message: "The Current Report Request Is Still Being Processed. Do Not Send It Again." },
        confirmed: false, suppressDuplicate: true, preserveInput: true, refreshHistory: false,
        requiresSignIn: false, requiresReconciliation: false };
      // Acquire before every await, including the caller's transport promise.
      busy = true;
      try {
        const expected = captureCanonicalDailyFlockExpectation(input);
        if (!expected || typeof input.send !== "function") return wrap(invalidInput());
        const response = await input.send();
        if (!response || !Number.isInteger(response.status)) return wrap(unresolved());
        if (response.status !== 200 && response.status !== 201) {
          // Denials/errors are never parsed; they may contain unauthorized or arbitrary body data.
          return wrap(interpretCanonicalDailyFlockFeedback({ ...expected, httpStatus: response.status, body: null }), response.status === 401);
        }
        if (typeof response.json !== "function") return wrap(unresolved());
        const body = await response.json();
        return wrap(interpretCanonicalDailyFlockFeedback({ ...expected, httpStatus: response.status, body }));
      } catch {
        // A lost/aborted response or malformed JSON can follow a committed mutation.
        return wrap(unresolved());
      } finally {
        busy = false;
      }
    },
  };
}
