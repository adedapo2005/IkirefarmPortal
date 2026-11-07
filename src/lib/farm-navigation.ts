import type { Page } from "./portal-model";

export type FarmNavigationModule = {
  id: string;
  label: string;
  landingRoute: string;
  pages: Page[];
};

export type FarmNavigationSection = {
  id: string;
  label: string;
  modules: FarmNavigationModule[];
};

type ModuleSpec = {
  id: string;
  label: string;
  landingRoute: string;
  routes: readonly string[];
};

type SectionSpec = {
  id: string;
  label: string;
  modules: readonly ModuleSpec[];
};

// 14 Professional, Concise Commercial Poultry ERP Navigation Sections (Daenem Farms Ikire)
const primarySections: readonly SectionSpec[] = [
  {
    id: "command-center",
    label: "Command Center",
    modules: [
      {
        id: "executive-oversight",
        label: "Executive Oversight",
        landingRoute: "dashboard",
        routes: ["dashboard", "daily-brief", "myday", "notifications", "bulletins", "profile"],
      },
    ],
  },
  {
    id: "sales-orders",
    label: "Sales & Orders",
    modules: [
      {
        id: "customer-orders-sales",
        label: "Customer Orders & Sales",
        landingRoute: "orders",
        routes: ["orders", "order-create", "dispatch", "customers", "pricing-catalog", "point-of-sale", "communication"],
      },
    ],
  },
  {
    id: "flocks-housing",
    label: "Flocks & Housing",
    modules: [
      {
        id: "cohorts-housing",
        label: "Cohorts & Housing",
        landingRoute: "flocks",
        routes: ["flocks", "daily-register", "houses", "breed-management", "flock-transfers", "weight-sampling", "lighting-program", "breed-benchmarks", "brooding-units"],
      },
    ],
  },
  {
    id: "egg-production",
    label: "Egg Production",
    modules: [
      {
        id: "collections-cold-room",
        label: "Collections & Cold Room",
        landingRoute: "eggs",
        routes: ["eggs", "egg-collections", "egg-grading", "egg-reconciliation"],
      },
    ],
  },
  {
    id: "feed-milling",
    label: "Feed & Milling",
    modules: [
      {
        id: "feed-mill-silos",
        label: "Feed Mill & Silos",
        landingRoute: "feed",
        routes: ["feed", "feed-stock", "feed-formulas", "feed-silos", "feed-quality", "feed-consumption"],
      },
    ],
  },
  {
    id: "health-veterinary",
    label: "Health & Veterinary",
    modules: [
      {
        id: "clinical-care-biosecurity",
        label: "Clinical Care & Biosecurity",
        landingRoute: "medication",
        routes: ["medication", "medication-stock", "mortality", "water-management", "biosecurity", "vaccinations", "health"],
      },
    ],
  },
  {
    id: "inventory-stores",
    label: "Inventory & Stores",
    modules: [
      {
        id: "warehouse-materials",
        label: "Warehouse & Materials",
        landingRoute: "inventory",
        routes: ["inventory", "equipment", "stock-movements", "diesel-fuel", "cycle-counts"],
      },
    ],
  },
  {
    id: "purchasing-vendors",
    label: "Purchasing & Vendors",
    modules: [
      {
        id: "purchasing-pipeline",
        label: "Purchasing Pipeline",
        landingRoute: "procurement",
        routes: ["procurement", "purchase-orders", "goods-receipts", "suppliers"],
      },
    ],
  },
  {
    id: "finance-banking",
    label: "Finance & Banking",
    modules: [
      {
        id: "banking-cash-flow",
        label: "Banking & Cash Flow",
        landingRoute: "finance",
        routes: ["finance", "expenses", "revenue", "profit", "treasury", "collections", "reconciliation", "general-ledger", "financial-reports"],
      },
    ],
  },
  {
    id: "human-resources",
    label: "Human Resources & Payroll",
    modules: [
      {
        id: "workforce-payroll",
        label: "Workforce & Payroll",
        landingRoute: "payroll",
        routes: ["payroll", "payroll-admin", "people-overview", "employees", "roles", "performance-management", "attendance", "leave", "payslips"],
      },
    ],
  },
  {
    id: "projects-assets",
    label: "Projects & Assets",
    modules: [
      {
        id: "construction-fleet",
        label: "Construction & Fleet",
        landingRoute: "construction",
        routes: ["construction", "boq", "materials", "fleet"],
      },
    ],
  },
  {
    id: "reports-analytics",
    label: "Reports & Analytics",
    modules: [
      {
        id: "intelligence-audits",
        label: "Intelligence & Audits",
        landingRoute: "reports-overview",
        routes: ["reports-overview", "operational-reports", "production-reports", "production-analytics", "flock-performance", "fcr-analytics", "mortality-reports"],
      },
    ],
  },
  {
    id: "admin-governance",
    label: "Admin & Governance",
    modules: [
      {
        id: "security-control",
        label: "Security & Control",
        landingRoute: "administration-overview",
        routes: ["administration-overview", "farm-settings", "audit", "permissions", "signup-admin", "master-data", "security", "diagnostics", "completion-center", "studio", "ai-management"],
      },
    ],
  },
];

export function buildFarmNavigation(allowed: readonly Page[]): FarmNavigationSection[] {
  const byRoute = new Map(allowed.map((page) => [page.id, page]));
  const claimed = new Set<string>();

  const primary = primarySections
    .map((section) => ({
      id: section.id,
      label: section.label,
      modules: section.modules
        .map((module) => {
          const pages = module.routes
            .map((route) => byRoute.get(route))
            .filter((page): page is Page => Boolean(page));
          pages.forEach((page) => claimed.add(page.id));
          return {
            id: module.id,
            label: module.label,
            landingRoute: byRoute.has(module.landingRoute)
              ? module.landingRoute
              : pages[0]?.id || module.landingRoute,
            pages,
          };
        })
        .filter((module) => module.pages.length > 0),
    }))
    .filter((section) => section.modules.length > 0);

  const remaining = allowed.filter((page) => !claimed.has(page.id));
  if (!remaining.length) return primary;

  // Group any remaining allowed pages neatly under an additional directorate
  const remainingGroups = [...new Set(remaining.map((p) => p.group))];
  if (remainingGroups.length > 0) {
    primary.push({
      id: "operations-additional",
      label: "Specialized Services",
      modules: remainingGroups.map((group) => {
        const pages = remaining.filter((p) => p.group === group);
        return {
          id: `module-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          label: group,
          landingRoute: pages[0].id,
          pages,
        };
      }),
    });
  }

  return primary;
}

export function navigationContext(
  route: string,
  allowed: readonly Page[],
): { section?: FarmNavigationSection; module?: FarmNavigationModule } {
  const sections = buildFarmNavigation(allowed);
  for (const section of sections) {
    const activeModule = section.modules.find((candidate) =>
      candidate.pages.some((page) => page.id === route),
    );
    if (activeModule) return { section, module: activeModule };
  }
  return {};
}
