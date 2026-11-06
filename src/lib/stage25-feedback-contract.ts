/**
 * Stage 25 — FarmPortal Account B feedback contract.
 *
 * For use only AFTER receiving a response from an authenticated, server-scoped
 * operation. This is a presentation adapter, NOT an authorization decision.
 * Never fabricate a record, audit trail, payment settlement or stock movement.
 */

export type FeedbackAction =
  | "create" | "update" | "submit" | "approve" | "post" | "receive"
  | "issue" | "settle" | "deliver" | "delete";

export type FeedbackState = "saved" | "submitted" | "approved" | "posted"
  | "received" | "issued" | "settled" | "delivered" | "deleted"
  | "pending" | "conflict" | "denied" | "validation-error"
  | "unavailable" | "failed" | "unconfirmed";

export type FeedbackTone = "success" | "info" | "warning" | "error";

export type FeedbackResult = {
  state: FeedbackState;
  tone: FeedbackTone;
  title: string;
  message: string;
  recordId: string | null;
  revision: number | null;
  auditId: string | null;
  occurredAt: string | null;
  canOpenRecord: boolean;
  canShowAudit: boolean;
  /** No financial amount, identity or private record details here. */
};

export type OperationResponse = {
  httpStatus: number;
  action: FeedbackAction;
  /** The JSON body returned by the authenticated server, not caller-generated form state. */
  body: unknown;
  /** True only when a separately authenticated, server-authorized audit read succeeds. */
  auditReadAuthorized?: boolean;
};

const finiteId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim() === value &&
  value.length >= 1 &&
  value.length <= 160 &&
  /^[A-Za-z0-9][A-Za-z0-9._:\-]*$/.test(value);

const recordRevision = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 1;

const validTimestamp = (v: unknown): v is string => {
  if (typeof v !== "string") return false;
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.exec(v);
  if (!match) return false;
  const [, y, m, day, hh, mm, ss, offset] = match;
  const calendar = new Date(0);
  calendar.setUTCFullYear(Number(y), Number(m) - 1, Number(day));
  if (calendar.getUTCFullYear() !== Number(y) || calendar.getUTCMonth() !== Number(m) - 1 ||
      calendar.getUTCDate() !== Number(day) || Number(hh) > 23 ||
      Number(mm) > 59 || Number(ss) > 59) return false;
  if (offset !== "Z") {
    const hours = Number(offset.slice(1, 3));
    const minutes = Number(offset.slice(4, 6));
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return false;
  }
  return Number.isFinite(Date.parse(v));
};

const outcome: Record<FeedbackAction, { state: FeedbackState; title: string }> = {
  create: { state: "saved", title: "Record Created" },
  update: { state: "saved", title: "Changes Saved" },
  submit: { state: "submitted", title: "Submitted For Review" },
  approve: { state: "approved", title: "Approval Confirmed" },
  post: { state: "posted", title: "Posting Confirmed" },
  receive: { state: "received", title: "Receipt Recorded" },
  issue: { state: "issued", title: "Stock Issue Recorded" },
  settle: { state: "settled", title: "Settlement Confirmed" },
  deliver: { state: "delivered", title: "Delivery Confirmed" },
  delete: { state: "deleted", title: "Record Removed" },
};

function base(state: FeedbackState, tone: FeedbackTone, title: string, message: string): FeedbackResult {
  return {state, tone, title, message, recordId:null, revision:null, auditId:null,
    occurredAt:null, canOpenRecord:false, canShowAudit:false};
}

/**
 * Fail closed. HTTP 200/201 is insufficient without an explicit canonical
 * receipt matching action, revision, record ID and the precise completed state.
 *
 * Expected API payload:
 * { ok:true, action:"create", state:"saved",
 *   record:{id:"...", revision:1}, occurredAt:"2026-10-28T10:00:00+01:00",
 *   audit:{id:"..."} }.
 * A 202 / pending response is not a completed write.
 */
export function interpretOperationFeedback(input: OperationResponse): FeedbackResult {
  const {httpStatus, action, body, auditReadAuthorized = false} = input;
  if (!Number.isInteger(httpStatus) || (httpStatus < 100 && httpStatus !== 0) || httpStatus > 599 || !Object.hasOwn(outcome,action)) {
    return base("unconfirmed","error","Outcome Not Confirmed","Check the record before trying again.");
  }
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 404) {
    return base("denied","error","Action Unavailable","You do not have access to this action or record.");
  }
  if (httpStatus === 409 || httpStatus === 412) {
    return base("conflict","warning","Record Changed","Refresh the record and review the latest changes before retrying.");
  }
  if (httpStatus === 400 || httpStatus === 422) {
    return base("validation-error","warning","Please Review The Details","Correct the highlighted information and try again.");
  }
  if (httpStatus === 0 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) {
    return base("unavailable","error","Unable To Confirm","The operation could not be confirmed. Check its status before retrying.");
  }
  if (httpStatus === 202) {
    return base("pending","info","Request Received","The request is pending. It is not yet confirmed as complete.");
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return base("failed","error","Action Not Completed","Please review the request and try again.");
  }
  if (httpStatus !== 200 && httpStatus !== 201) {
    return base("unconfirmed","warning","Outcome Not Confirmed","The server did not return a completed record receipt.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return base("unconfirmed","warning","Outcome Not Confirmed","The server did not return a completed record receipt.");
  }
  const data = body as Record<string,unknown>;
  const expected = outcome[action];
  const record = data.record && typeof data.record === "object" && !Array.isArray(data.record)
    ? data.record as Record<string,unknown> : null;
  if (data.ok !== true || data.action !== action || data.state !== expected.state ||
      !record || !finiteId(record.id) || !recordRevision(record.revision)) {
    return base("unconfirmed","warning","Outcome Not Confirmed","The server did not return a matching completed record receipt.");
  }

  const audit = data.audit && typeof data.audit === "object" && !Array.isArray(data.audit)
    ? data.audit as Record<string,unknown> : null;
  const canShowAudit = auditReadAuthorized && !!audit && finiteId(audit.id);
  const occurredAt = validTimestamp(data.occurredAt) ? data.occurredAt : null;

  return {
    state: expected.state, tone:"success", title:expected.title,
    message: action === "settle" ? "Settlement was confirmed by the authorized server." :
      action === "submit" ? "The submission is recorded. Approval is not implied." :
      action === "issue" ? "The authorized stock issue is recorded. Consumption is not implied." :
      "The authorized server confirmed this action.",
    recordId:record.id, revision:record.revision,
    auditId:canShowAudit ? audit!.id as string : null,
    occurredAt, canOpenRecord:action !== "delete", canShowAudit:!!canShowAudit,
  };
}
