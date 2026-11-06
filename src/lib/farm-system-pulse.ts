import type { Page } from "./portal-model";

/**
 * Stage 21C.3 display-only governance readiness contracts.
 * Not a configuration provider, an access grant, a lookup endpoint,
 * or evidence that any request or control is currently live.
 */
export const systemPulseRoutes = [
  "field-admin", "maker-checker", "workflow",
  "analytics", "chart-library", "ai-assistant",
] as const;

export type SystemPulseRoute = (typeof systemPulseRoutes)[number];

type ReadinessIndicator = Readonly<{
  id: string;
  title: string;
  requirement: string;
}>;
type NextRoute = Readonly<{ label: string; route: string }>;
type SystemPulseSpec = Readonly<{
  subtitle: string;
  indicators: readonly ReadinessIndicator[];
  actions: readonly NextRoute[];
  timeline: string;
}>;

export const systemPulseSpecs: Readonly<Record<SystemPulseRoute, SystemPulseSpec>> = {
  "field-admin": {
    subtitle: "Approved field labels, validation rules and access boundaries",
    indicators: [
      { id: "schemas", title: "Published field schemas", requirement: "Accepted schema revision, owning form and publishing approval" },
      { id: "exceptions", title: "Validation exceptions", requirement: "Server-validated rule failures linked to the correct field version" },
      { id: "permissions", title: "Visibility rule reviews", requirement: "Permission matrix, access testing and independent sign-off" },
    ],
    actions: [
      { label: "Review Smart Form Studio", route: "form-studio" },
      { label: "Review permissions", route: "permissions" },
      { label: "Review audit records", route: "audit" },
    ],
    timeline: "Versioned field edits, maker approval, publication, rollback and denied-access events",
  },
  "maker-checker": {
    subtitle: "Independent review, exception evidence and decision authority",
    indicators: [
      { id: "pending", title: "Decisions awaiting a checker", requirement: "Role-separated pending submissions and assigned reviewers" },
      { id: "variance", title: "Exceptions requiring evidence", requirement: "Expected and recorded values, supporting proof and policy thresholds" },
      { id: "revocations", title: "Access or delegation exceptions", requirement: "Authenticated, scope-checked roles and revocation history" },
    ],
    actions: [
      { label: "Review approval status", route: "approval-status" },
      { label: "Review audit trail", route: "audit" },
      { label: "Review permissions", route: "permissions" },
    ],
    timeline: "Submission, separate-maker-and-checker review, decision and auditable rejection or rollback",
  },
  workflow: {
    subtitle: "Controlled triggers, approvals and escalation readiness",
    indicators: [
      { id: "versions", title: "Approved workflow versions", requirement: "Published trigger and action revisions with an accountable owner" },
      { id: "exceptions", title: "Execution exceptions", requirement: "Authorized run IDs, validated outcomes and retry history" },
      { id: "escalation", title: "Escalations requiring review", requirement: "Escalation policy, due time, destination and approval evidence" },
    ],
    actions: [
      { label: "Review communication automations", route: "comm-automation" },
      { label: "Review role permissions", route: "permissions" },
      { label: "Review audit trail", route: "audit" },
    ],
    timeline: "Workflow draft, revision, maker-checker sign-off, execution, escalation and suspension",
  },
  analytics: {
    subtitle: "Source-verified analysis, periods and access-controlled comparisons",
    indicators: [
      { id: "sources", title: "Verified analysis sources", requirement: "Permissioned source registry, provenance and freshness checkpoint" },
      { id: "periods", title: "Comparable reporting periods", requirement: "Aligned units, dates, locations and reconciliation definitions" },
      { id: "exports", title: "Reports awaiting approval", requirement: "Versioned output, business-unit scope and approved export policy" },
    ],
    actions: [
      { label: "Open operational reports", route: "operational-reports" },
      { label: "Review production reports", route: "production-reports" },
      { label: "Review financial reports", route: "financial-reporting" },
    ],
    timeline: "Report source changes, run history, reviewer approvals and permission-scoped exports",
  },
  "chart-library": {
    subtitle: "Business-question visuals with documented, verified metric sources",
    indicators: [
      { id: "charts", title: "Approved chart definitions", requirement: "Named question, metric, dimension, unit and reviewer" },
      { id: "sources", title: "Missing source evidence", requirement: "Verified data contract, consistent granularity and refresh date" },
      { id: "a11y", title: "Accessible visual alternatives", requirement: "Equivalent data table, labels and non-colour-only semantics" },
    ],
    actions: [
      { label: "Review Analytics Studio", route: "analytics" },
      { label: "Open report directory", route: "reports-overview" },
      { label: "Review audit logs", route: "audit" },
    ],
    timeline: "Chart specification, source validation, accessibility review, publication and revision",
  },
  "ai-assistant": {
    subtitle: "Grounded AI drafting, source traceability and human approval",
    indicators: [
      { id: "source", title: "Approved evidence sources", requirement: "Permitted records, provenance, current timestamps and scope" },
      { id: "review", title: "Drafts awaiting human review", requirement: "Human-assigned reviewers, approval gates and recorded decisions" },
      { id: "policy", title: "AI policy exceptions", requirement: "Versioned safety rules, denied actions and escalation evidence" },
    ],
    actions: [
      { label: "Review AI management", route: "ai-management" },
      { label: "Review audit logs", route: "audit" },
      { label: "Review permissions", route: "permissions" },
    ],
    timeline: "Authorized source reads, generated drafts, reviewer actions, denials and policy revisions",
  },
};

export function isSystemPulseRoute(route: string): route is SystemPulseRoute {
  return Object.prototype.hasOwnProperty.call(systemPulseSpecs, route);
}

export function systemPulseForAllowed(route: string, allowed: readonly Page[]) {
  if (!isSystemPulseRoute(route)) return null;
  const permitted = new Set(allowed.map(page => page.id));
  if (!permitted.has(route)) return null;

  const spec = systemPulseSpecs[route];
  return {
    route,
    title: allowed.find(page => page.id === route)?.title || route,
    subtitle: spec.subtitle,
    indicators: spec.indicators,
    actions: spec.actions.filter(action => action.route !== route && permitted.has(action.route)),
    timeline: spec.timeline,
  };
}
