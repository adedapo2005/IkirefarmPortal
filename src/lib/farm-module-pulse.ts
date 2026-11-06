import type { Page } from "./portal-model";

/**
 * Stage 21C source-gated dashboard specification.
 * This is presentation metadata, NOT an operational data provider.
 * Do not substitute route-contract presence for authenticated record readings.
 */
export type ModulePulseRoute =
  | "operations" | "flock-management" | "inventory" | "finance"
  | "people-overview" | "reports-overview" | "administration-overview";

export type ModulePulseIndicator = Readonly<{
  id: string;
  title: string;
  requirement: string;
  route: string;
}>;

export type ModulePulseAction = Readonly<{
  title: string;
  description: string;
  route: string;
}>;

type ModulePulseSpec = Readonly<{
  title: string;
  introduction: string;
  indicators: readonly ModulePulseIndicator[];
  actions: readonly ModulePulseAction[];
  timelineRequirement: string;
}>;

export const modulePulseSpecs: Readonly<Record<ModulePulseRoute, ModulePulseSpec>> = {
  operations: {
    title: "Daily Farm Operations",
    introduction: "Collections, feed, water and flock health — one clear daily operating picture.",
    indicators: [
      { id: "collections", title: "Eggs collected today", route: "eggs", requirement: "Requires dated, approved collection records" },
      { id: "feed", title: "Feed consumed", route: "feed", requirement: "Requires verified feed movements and flock allocation" },
      { id: "health", title: "Mortality exceptions", route: "mortality", requirement: "Requires flock-linked health and mortality records" },
    ],
    actions: [
      { title: "Review egg collections", description: "Open the collection records for your assigned farm", route: "eggs" },
      { title: "Review water checks", description: "Inspect today's water observations and exceptions", route: "water-management" },
      { title: "Review medication", description: "Verify treatment evidence and follow-up", route: "medication" },
    ],
    timelineRequirement: "Timestamped daily farm events and authorized exceptions",
  },
  "flock-management": {
    title: "Flock & House Performance",
    introduction: "Follow bird placement, house readiness and movement across the production cycle.",
    indicators: [
      { id: "birds", title: "Active birds", route: "flocks", requirement: "Requires a reconciled flock placement ledger" },
      { id: "houses", title: "House occupancy", route: "houses", requirement: "Requires verified capacity and placement records" },
      { id: "movements", title: "Transfers awaiting review", route: "flock-transfers", requirement: "Requires approved movement and count reconciliation" },
    ],
    actions: [
      { title: "Review flocks", description: "Check assigned batches and their production stage", route: "flocks" },
      { title: "Review house readiness", description: "Check housing capacity and occupancy evidence", route: "houses" },
      { title: "Review flock transfers", description: "Investigate movement and approval requirements", route: "flock-transfers" },
    ],
    timelineRequirement: "Placement, transfer and flock-status history",
  },
  inventory: {
    title: "Stock & Procurement Readiness",
    introduction: "Understand available stock, expiring supplies and outstanding purchasing decisions.",
    indicators: [
      { id: "stock", title: "Stock on hand", route: "inventory", requirement: "Requires reconciled item balances and units" },
      { id: "expiry", title: "Medication expiry exposure", route: "medication-stock", requirement: "Requires batch numbers and verified expiry dates" },
      { id: "purchase", title: "Purchase orders outstanding", route: "purchase-orders", requirement: "Requires approved orders and delivery receipts" },
    ],
    actions: [
      { title: "Review inventory", description: "Check authorized stock and movement records", route: "inventory" },
      { title: "Review feed stock", description: "Compare feed receipts and consumption records", route: "feed-stock" },
      { title: "Review purchase orders", description: "Follow orders requiring an approval or delivery check", route: "purchase-orders" },
    ],
    timelineRequirement: "Stock movements, goods received and purchasing approvals",
  },
  finance: {
    title: "Finance & Payment Evidence",
    introduction: "View collections, costs, outstanding receivables and reconciled financial results.",
    indicators: [
      { id: "revenue", title: "Collections (₦)", route: "revenue", requirement: "Requires verified receipts and settlement allocation" },
      { id: "expenses", title: "Expenses awaiting review (₦)", route: "expenses", requirement: "Requires authorized, dated expense evidence" },
      { id: "profit", title: "Profit or loss (₦)", route: "profit", requirement: "Requires a reconciled ledger and reporting period" },
    ],
    actions: [
      { title: "Review revenue", description: "Inspect sales and payment evidence", route: "revenue" },
      { title: "Review expenses", description: "Open submitted costs and supporting documents", route: "expenses" },
      { title: "Open financial reports", description: "Choose the period and source completeness check", route: "financial-reports" },
    ],
    timelineRequirement: "Posted journals, settlement changes and approval receipts",
  },
  "people-overview": {
    title: "People & Team Performance",
    introduction: "Keep employee records, responsibilities and performance reviews in context.",
    indicators: [
      { id: "employees", title: "Employees assigned", route: "employees", requirement: "Requires authoritative, scope-filtered employee records" },
      { id: "reviews", title: "Performance reviews due", route: "performance-management", requirement: "Requires dated appraisal cycles and assigned reviewers" },
      { id: "payroll", title: "Payroll exceptions", route: "payroll-admin", requirement: "Requires role-authorized and reconciled payroll runs" },
    ],
    actions: [
      { title: "Review employees", description: "Open authorized workforce records", route: "employees" },
      { title: "Review performance", description: "Check goals, evidence and approved review periods", route: "performance-management" },
      { title: "Review payroll", description: "Inspect a permitted pay cycle without changing balances", route: "payroll-admin" },
    ],
    timelineRequirement: "Workforce changes, approvals and documented review outcomes",
  },
  "reports-overview": {
    title: "Reports & Business Intelligence",
    introduction: "Select the correct report, time window, calculation basis and authorized source.",
    indicators: [
      { id: "operations", title: "Operational reporting", route: "operational-reports", requirement: "Requires selected farm, period and verified daily records" },
      { id: "production", title: "Production trends", route: "production-reports", requirement: "Requires dated, comparable flock production measures" },
      { id: "financial", title: "Financial results (₦)", route: "financial-reporting", requirement: "Requires reconciled finance data and permissioned exports" },
    ],
    actions: [
      { title: "Operational reports", description: "Select your authorized farm and reporting period", route: "operational-reports" },
      { title: "Production reports", description: "Review a flock and comparison window", route: "production-reports" },
      { title: "Financial reporting", description: "Inspect completeness and reconciled assumptions", route: "financial-reporting" },
    ],
    timelineRequirement: "Report runs, approvals and source-revision history",
  },
  "administration-overview": {
    title: "Administration & System Assurance",
    introduction: "Review configuration, access policy, accountability and approved AI controls.",
    indicators: [
      { id: "access", title: "Access requests", route: "permissions", requirement: "Requires verified access-grant and revocation events" },
      { id: "audit", title: "Audit events", route: "audit", requirement: "Requires authenticated, immutable audit event sources" },
      { id: "ai", title: "AI decisions awaiting review", route: "ai-management", requirement: "Requires source attribution and human-approval logs" },
    ],
    actions: [
      { title: "Review access", description: "Inspect authorized role assignments and policy scope", route: "permissions" },
      { title: "Review audit logs", description: "Trace changes only from verified audit sources", route: "audit" },
      { title: "Review farm settings", description: "Inspect current values and change-control rules", route: "farm-settings" },
    ],
    timelineRequirement: "Administrator changes, security events and approvals",
  },
};

export function isModulePulseRoute(value: string): value is ModulePulseRoute {
  return Object.prototype.hasOwnProperty.call(modulePulseSpecs, value);
}

export function modulePulseForAllowed(route: string, allowed: readonly Page[]) {
  if (!isModulePulseRoute(route)) return null;
  const permitted = new Set(allowed.map((page) => page.id));
  if (!permitted.has(route)) return null;
  const spec = modulePulseSpecs[route];
  return {
    route,
    title: spec.title,
    introduction: spec.introduction,
    // A restricted employee must not see even a pending count or action
    // for a route that is outside their permitted role or company scope.
    indicators: spec.indicators.filter((indicator) => permitted.has(indicator.route)),
    actions: spec.actions.filter((action) => permitted.has(action.route)),
    timelineRequirement: spec.timelineRequirement,
    auditRoute: permitted.has("audit") ? "audit" : null,
  };
}
