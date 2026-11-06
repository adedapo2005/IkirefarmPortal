import type { Page } from "./portal-model";

// Explicit workspace parents only. A shared sidebar group is not a parent route.
const parents: Readonly<Record<string, string>> = {
  "construction-projects": "construction",
  "construction-costs-payments": "construction",
  "construction-people-suppliers": "construction",
  "construction-reconciliation-alerts": "construction",
  "import-new": "import-center",
  "import-templates": "import-center",
  "import-mappings": "import-center",
  "import-validation": "import-center",
  "import-processing": "import-center",
  "import-completed": "import-center",
  "import-failed": "import-center",
  "import-history": "import-center",
  "import-corrections": "import-center",
  "comm-templates": "communication",
  "comm-automation": "communication",
  "comm-campaigns": "communication",
  "comm-feedback": "communication",
  "comm-complaints": "communication",
  "comm-analytics": "communication",
  "comm-settings": "communication",
  "daily-brief": "dashboard",
  feed: "operations",
  "water-management": "operations",
  medication: "operations",
  mortality: "operations",
  eggs: "operations",
  houses: "flock-management",
  flocks: "flock-management",
  "breed-management": "flock-management",
  "flock-transfers": "flock-management",
  "production-analytics": "flock-management",
  "feed-stock": "inventory",
  "medication-stock": "inventory",
  equipment: "inventory",
  "purchase-orders": "inventory",
  expenses: "finance",
  revenue: "finance",
  profit: "finance",
  "financial-reports": "finance",
  employees: "people-overview",
  roles: "people-overview",
  "performance-management": "people-overview",
  "payroll-admin": "people-overview",
  "operational-reports": "reports-overview",
  "production-reports": "reports-overview",
  "financial-reporting": "reports-overview",
  "farm-settings": "administration-overview",
  audit: "administration-overview",
  permissions: "administration-overview",
  "ai-management": "administration-overview",
};

export type WorkspaceCrumb = {
  label: string;
  route?: string;
  current?: boolean;
};

export function workspaceBreadcrumbs(page: Page, allowed: readonly Page[]): WorkspaceCrumb[] {
  const visible = new Map(allowed.map((candidate) => [candidate.id, candidate]));
  const current = visible.get(page.id);
  if (!current) return [];

  const ancestors: Page[] = [];
  const visited = new Set([current.id]);
  let parentId = parents[current.id];
  while (parentId && !visited.has(parentId)) {
    const parent = visible.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    visited.add(parentId);
    parentId = parents[parentId];
  }

  const home = visible.get("dashboard");
  if (home && !visited.has(home.id)) ancestors.unshift(home);
  const crumbs: WorkspaceCrumb[] = ancestors.map((ancestor) => ({
    label: ancestor.title,
    route: ancestor.id,
  }));
  // Every intermediate breadcrumb is a real destination. For a top-level
  // workspace, the group link opens the first permitted page in that group.
  if (!parents[current.id] && current.id !== "dashboard" && current.group !== "Workspace") {
    const groupHome = allowed.find(
      (candidate) => candidate.group === current.group && candidate.id !== current.id,
    );
    crumbs.push({
      label: current.group,
      route: groupHome?.id || home?.id,
    });
  }
  crumbs.push({ label: current.title, current: true });
  return crumbs;
}
