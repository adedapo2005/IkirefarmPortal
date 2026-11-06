// Stage 22 role-aware analytics source contracts. These state which measures each role needs, which are withheld by
// default, and which are still waiting on a backend source. They are NOT authorization. The server decides what each
// person may see, and this file never widens a role's access on the frontend. No dashboard is built or redesigned here.
import {STAGE22_DEFINITIONS, type Stage22MetricKey} from "./stage22-kpi-definitions";

export const STAGE22_ROLES = ["owner-executive", "farm-manager", "finance", "hr", "employee"] as const;
export type Stage22Role = (typeof STAGE22_ROLES)[number];

export type Stage22RoleScope = "company" | "farm" | "finance" | "workforce" | "own";

export type Stage22RoleContract = Readonly<{
  role: Stage22Role;
  label: string;
  scope: Stage22RoleScope;
  // Measures this role needs for its analytics, once the backend supplies verified sources.
  requiredKeys: readonly Stage22MetricKey[];
  // Measures withheld from this role by default. Only an explicit server grant for that scope may show them.
  withheldKeys: readonly Stage22MetricKey[];
  // Needs that this registry does not define, so they must be specified by their own owner before use.
  outOfRegistry: readonly string[];
  notes: string;
  authority: "backend-rbac";
}>;

const MONEY_KEYS: readonly Stage22MetricKey[] = ["sales-revenue", "expenses", "profit", "profit-margin", "receivables"];

export const STAGE22_ROLE_CONTRACTS: Readonly<Record<Stage22Role, Stage22RoleContract>> = {
  "owner-executive": {
    role: "owner-executive",
    label: "Owner and executive management",
    scope: "company",
    requiredKeys: [
      "egg-collection",
      "laying-rate",
      "mortality-count",
      "mortality-rate",
      "active-birds",
      "feed-consumption",
      "feed-conversion-ratio",
      ...MONEY_KEYS,
    ],
    withheldKeys: [],
    outOfRegistry: [],
    notes:
      "Company-wide totals need company-level authority from the server. A farm-only permission must never widen to company totals on the frontend.",
    authority: "backend-rbac",
  },
  "farm-manager": {
    role: "farm-manager",
    label: "Farm Managers",
    scope: "farm",
    requiredKeys: [
      "egg-collection",
      "laying-rate",
      "mortality-count",
      "mortality-rate",
      "active-birds",
      "feed-consumption",
      "feed-conversion-ratio",
    ],
    withheldKeys: MONEY_KEYS,
    outOfRegistry: [],
    notes: "Farm-scoped operations only. Money measures are withheld unless the server grants a finance scope for that farm.",
    authority: "backend-rbac",
  },
  finance: {
    role: "finance",
    label: "Finance and Accounting",
    scope: "finance",
    requiredKeys: ["sales-revenue", "expenses", "profit", "profit-margin", "receivables", "egg-collection"],
    withheldKeys: [],
    outOfRegistry: ["Payment reconciliation status and approval queues belong to the Finance and Monnify source contracts."],
    notes:
      "Egg collection is context for revenue and cost. Finance does not receive individual staff records through these measures.",
    authority: "backend-rbac",
  },
  hr: {
    role: "hr",
    label: "HR and authorized workforce managers",
    scope: "workforce",
    requiredKeys: [],
    withheldKeys: MONEY_KEYS,
    outOfRegistry: [
      "Headcount, attendance rate, leave balance and shift coverage are workforce measures with their own source contract.",
    ],
    notes:
      "No production or money measure in this registry is required for HR. Workforce figures must be specified separately before any HR analytics is built.",
    authority: "backend-rbac",
  },
  employee: {
    role: "employee",
    label: "General Employees",
    scope: "own",
    requiredKeys: [],
    withheldKeys: MONEY_KEYS,
    outOfRegistry: ["Personal tasks, attendance and pay information are not analytics measures in this registry."],
    notes:
      "General employees receive no company-level figure by default. Farm-level production may appear only when the server grants that farm scope.",
    authority: "backend-rbac",
  },
};

export function getStage22RoleContract(role: Stage22Role): Stage22RoleContract {
  return STAGE22_ROLE_CONTRACTS[role];
}

// Required measures that cannot be shown yet because their authoritative source is not connected.
export function pendingKeysFor(role: Stage22Role): readonly Stage22MetricKey[] {
  return STAGE22_ROLE_CONTRACTS[role].requiredKeys.filter(
    (key) => STAGE22_DEFINITIONS[key].availability === "backend-pending",
  );
}
