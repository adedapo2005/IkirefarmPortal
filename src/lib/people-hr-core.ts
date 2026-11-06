import {
  ResourceWorkflowService,
  type ResourceDefinition,
  type ResourceRepository,
  type ResourceTransition,
} from "./resource-workflow.ts";

export type PeopleHrData = Readonly<{
  kind: "employee-record" | "leave-request" | "attendance-record" | "attendance-session" | "payroll-batch" | "recruitment-candidate";
  reference: string;
  subjectId: string;
  occurredAt: string;
  endedAt?: string;
  leaveType?: "annual" | "sick" | "personal" | "unpaid" | "other";
  reason?: string;
  amountMinor?: number;
  currency?: string;
  evidenceIds?: readonly string[];
}>;
export type PeopleHrKind = PeopleHrData["kind"];
export type PeopleHrServices = Readonly<Record<PeopleHrKind, ResourceWorkflowService<PeopleHrData>>>;

const permissions: Record<PeopleHrKind, { view: string; create: string; edit: string }> = {
  "employee-record": { view: "hr.employee.view", create: "hr.employee.manage", edit: "hr.employee.manage" },
  "leave-request": { view: "hr.leave.view", create: "hr.leave.request", edit: "hr.leave.manage" },
  "attendance-record": { view: "hr.attendance.view", create: "hr.attendance.record", edit: "hr.attendance.manage" },
  "attendance-session": { view: "attendance.view", create: "attendance.create", edit: "attendance.create" },
  "payroll-batch": { view: "hr.payroll.view", create: "hr.payroll.manage", edit: "hr.payroll.manage" },
  "recruitment-candidate": { view: "hr.recruitment.view", create: "hr.recruitment.manage", edit: "hr.recruitment.manage" },
};

const bounded = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
function validTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day)) return false;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  const zone = match[8];
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return false;
  return true;
}
function validate(data: PeopleHrData, kind: PeopleHrKind): readonly string[] {
  const errors: string[] = [];
  if (!data || typeof data !== "object" || data.kind !== kind) return ["data kind does not match resource"];
  if (!bounded(data.reference, 120)) errors.push("reference is invalid");
  if (!bounded(data.subjectId, 120)) errors.push("subject is invalid");
  if (!validTimestamp(data.occurredAt)) errors.push("date is invalid");
  if (kind === "attendance-session" && data.endedAt !== undefined && (!validTimestamp(data.endedAt) || Date.parse(data.endedAt) <= Date.parse(data.occurredAt))) errors.push("clock-out date is invalid");
  if (kind === "leave-request") {
    if (!["annual", "sick", "personal", "unpaid", "other"].includes(data.leaveType || "")) errors.push("leave type is invalid");
    if (!validTimestamp(data.endedAt) || Date.parse(data.endedAt!) < Date.parse(data.occurredAt) || Date.parse(data.endedAt!) - Date.parse(data.occurredAt) > 366 * 86_400_000) errors.push("leave end date is invalid");
    if (typeof data.reason !== "string" || data.reason.trim().length < 10 || data.reason.length > 500) errors.push("leave reason is invalid");
  }
  if (kind === "payroll-batch") {
    if (!Number.isSafeInteger(data.amountMinor) || (data.amountMinor ?? -1) < 0) errors.push("amount in minor units is invalid");
    if (typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency)) errors.push("currency is invalid");
  }
  if (data.evidenceIds !== undefined && (!Array.isArray(data.evidenceIds) || data.evidenceIds.length > 20 || data.evidenceIds.some((id) => !bounded(id, 120)))) errors.push("evidence ids are invalid");
  return errors;
}
const t = (from: string | readonly string[], to: string, action: ResourceTransition["action"], permission: string, approvalPermission?: string): ResourceTransition => ({ from, to, action, permission, approvalPermission });

const definitions = Object.fromEntries((Object.keys(permissions) as PeopleHrKind[]).map((kind) => {
  const p = permissions[kind];
  const isApproval = kind === "leave-request" || kind === "payroll-batch";
  const transitions = kind === "leave-request"
    ? [t("requested", "approved", "approve", p.edit, "hr.leave.approve"), t("requested", "rejected", "approve", p.edit, "hr.leave.approve")]
    : kind === "payroll-batch"
      ? [t("draft", "approved", "approve", p.edit, "hr.payroll.approve"), t("approved", "paid-recorded", "approve", p.edit, "hr.payroll.approve")]
      : kind === "attendance-session" ? [t("clocked-in", "clocked-out", "edit", p.edit)]
        : kind === "attendance-record" ? [t("draft", "recorded", "edit", p.edit)]
          : kind === "employee-record" ? [t("active", "inactive", "edit", p.edit)]
          : [t("new", "screening", "edit", p.edit), t("screening", "closed", "edit", p.edit)];
  const initialState = kind === "leave-request" ? "requested" : kind === "attendance-session" ? "clocked-in" : kind === "payroll-batch" || kind === "attendance-record" ? "draft" : kind === "employee-record" ? "active" : "new";
  const mutableStates = kind === "employee-record" ? ["active", "inactive"]
    : kind === "leave-request" ? ["requested"]
      : kind === "attendance-session" ? ["clocked-in"]
        : kind === "attendance-record" || kind === "payroll-batch" ? ["draft"]
          : ["new", "screening"];
  return [kind, Object.freeze({ resourceType: `hr-${kind}`, initialState, mutableStates, requireMakerChecker: isApproval, ...(kind === "leave-request" ? { createPermissions: ["hr.leave.manage"] } : {}), permissions: { create: p.create, edit: p.edit, delete: p.edit }, transitions, validate: (data: PeopleHrData) => validate(data, kind) })];
})) as unknown as Record<PeopleHrKind, ResourceDefinition<PeopleHrData>>;

export const PEOPLE_HR_DEFINITIONS: Readonly<Record<PeopleHrKind, ResourceDefinition<PeopleHrData>>> = Object.freeze(definitions);
export function createPeopleHrServices(repository: ResourceRepository<PeopleHrData>, now?: () => string): PeopleHrServices {
  return Object.freeze(Object.fromEntries((Object.keys(PEOPLE_HR_DEFINITIONS) as PeopleHrKind[]).map((kind) => [kind, new ResourceWorkflowService(PEOPLE_HR_DEFINITIONS[kind], repository, now)])) as Record<PeopleHrKind, ResourceWorkflowService<PeopleHrData>>);
}
