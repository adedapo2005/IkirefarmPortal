export const constructionPrimaryRoutes = [
  "construction",
  "construction-projects",
  "construction-costs-payments",
  "construction-people-suppliers",
  "construction-reconciliation-alerts",
] as const;

export const constructionCompatibilityRoutes = [
  "construction-command","construction-organizations","construction-project-detail","construction-cost-control","construction-assets","construction-areas","construction-cost-codes","construction-boq","construction-boq-detail","construction-boq-variance","construction-materials","construction-material-detail","construction-stores","construction-stock-movement","construction-consumption","construction-procurement","construction-quote-comparison","construction-work-packages","construction-work-orders","construction-work-order-detail","construction-suppliers","construction-contractors","construction-artisans","construction-contracts","construction-contract-detail","construction-variations","construction-retentions","construction-progress","construction-daily-reports","construction-inspections","construction-issues","construction-payments","construction-payment-request","construction-payment-approval","construction-bank-accounts","construction-transactions","construction-reconciliation","construction-whatsapp-inbox","construction-documents","construction-risk","construction-forecasting","construction-qs","construction-reports","construction-ai","construction-settings",
] as const;

export const constructionRoutes = [...constructionPrimaryRoutes, ...constructionCompatibilityRoutes] as const;

type PrimaryRoute = (typeof constructionPrimaryRoutes)[number];
type ConstructionDestination = PrimaryRoute | "admin" | null;

export const constructionCompatibilityMap: Record<string, PrimaryRoute> = {
  "construction-command":"construction",
  "construction-organizations":"construction-projects",
  "construction-project-detail":"construction-projects",
  "construction-cost-control":"construction-costs-payments",
  "construction-assets":"construction-projects",
  "construction-areas":"construction-projects",
  "construction-cost-codes":"construction-projects",
  "construction-boq":"construction-projects",
  "construction-boq-detail":"construction-projects",
  "construction-boq-variance":"construction-projects",
  "construction-materials":"construction-projects",
  "construction-material-detail":"construction-projects",
  "construction-stores":"construction-projects",
  "construction-stock-movement":"construction-projects",
  "construction-consumption":"construction-projects",
  "construction-procurement":"construction-costs-payments",
  "construction-quote-comparison":"construction-costs-payments",
  "construction-work-packages":"construction-projects",
  "construction-work-orders":"construction-projects",
  "construction-work-order-detail":"construction-projects",
  "construction-suppliers":"construction-people-suppliers",
  "construction-contractors":"construction-people-suppliers",
  "construction-artisans":"construction-people-suppliers",
  "construction-contracts":"construction-people-suppliers",
  "construction-contract-detail":"construction-people-suppliers",
  "construction-variations":"construction-projects",
  "construction-retentions":"construction-costs-payments",
  "construction-progress":"construction-projects",
  "construction-daily-reports":"construction-projects",
  "construction-inspections":"construction-projects",
  "construction-issues":"construction-projects",
  "construction-payments":"construction-costs-payments",
  "construction-payment-request":"construction-costs-payments",
  "construction-payment-approval":"construction-costs-payments",
  "construction-bank-accounts":"construction-costs-payments",
  "construction-transactions":"construction-costs-payments",
  "construction-reconciliation":"construction-reconciliation-alerts",
  "construction-whatsapp-inbox":"construction-reconciliation-alerts",
  "construction-documents":"construction-projects",
  "construction-risk":"construction-reconciliation-alerts",
  "construction-forecasting":"construction",
  "construction-qs":"construction-projects",
  "construction-reports":"construction",
  "construction-ai":"construction",
  "construction-settings":"construction",
};

export function constructionPrimaryRoute(route: string): ConstructionDestination {
  if ((constructionPrimaryRoutes as readonly string[]).includes(route)) return route as PrimaryRoute;
  if (route === "construction-settings") return "admin";
  return constructionCompatibilityMap[route] ?? null;
}
