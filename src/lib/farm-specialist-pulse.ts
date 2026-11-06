import type { Page } from "./portal-model";

export const specialistPulseRoutes = [
  "pigs", "goats", "snails", "manufacturing", "organic",
  "suppliers", "sales", "assets", "infrastructure", "logistics",
  "fleet", "biosecurity", "files",
] as const;

export type SpecialistPulseRoute = (typeof specialistPulseRoutes)[number];

type ReadinessIndicator = Readonly<{
  id: string;
  title: string;
  requirement: string;
}>;
type NextRoute = Readonly<{ label: string; route: string }>;
type SpecialistPulseSpec = Readonly<{
  subtitle: string;
  indicators: readonly ReadinessIndicator[];
  actions: readonly NextRoute[];
  timeline: string;
}>;

/**
 * Stage 21C.2 presentation contracts, not live data or new backend authorities.
 * Metric requirements are deliberately descriptive; nothing here can authorize
 * reading, posting, submitting, or changing a master-workspace record.
 */
export const specialistPulseSpecs: Readonly<Record<SpecialistPulseRoute, SpecialistPulseSpec>> = {
  pigs: {
    subtitle: "Breeding, farrowing and grow-out readiness",
    indicators: [
      {id: "farrowing", title: "Litters needing review", requirement: "Verified sow, litter, gestation and farrowing records"},
      {id: "growth", title: "Grow-out groups", requirement: "Animal counts, age bands, weights and feed history"},
      {id: "health", title: "Health exceptions", requirement: "Dated observations, evidence and veterinary review"},
    ],
    actions: [{label: "Review feed records",route: "feed"}, {label: "Review animal health",route: "health"}],
    timeline: "Tagged animals, breeding events, farrowing reviews and authorized movements",
  },
  goats: {
    subtitle: "Herd identity, kidding and movement evidence",
    indicators: [
      {id: "herd", title: "Registered animals", requirement: "Reconciled animal tags, herd and parentage references"},
      {id: "kidding", title: "Kidding follow-ups", requirement: "Confirmed mating and birth dates with a responsible reviewer"},
      {id: "movements", title: "Movement exceptions", requirement: "Pen transfers, animal counts and health clearance"},
    ],
    actions: [{label: "Review health",route:"health"},{label:"Review vaccinations",route:"vaccinations"}],
    timeline: "Tag registrations, verified weights, kidding and pen movement",
  },
  snails: {
    subtitle: "Pen performance and production-cycle trace",
    indicators: [
      {id:"nursery",title:"Nursery stock",requirement:"Verified pen placement, batch and surviving counts"},
      {id:"environment",title:"Environmental checks",requirement:"Dated humidity, temperature and pen-condition observations"},
      {id:"harvest",title:"Harvest awaiting stock",requirement:"Approved harvest weights, units and stock movements"},
    ],
    actions:[{label:"Review inventory",route:"inventory"},{label:"Review farm alerts",route:"alerts"}],
    timeline:"Pen lifecycle, feeding, mortality and authorized harvest acceptance",
  },
  manufacturing: {
    subtitle: "Feed recipe, material balance and release evidence",
    indicators: [
      {id:"materials",title:"Raw material availability",requirement:"Verified stock lots and ingredient quantities in kg"},
      {id:"variance",title:"Batch mass balance",requirement:"Versioned recipe, input, output and measured waste in kg"},
      {id:"holds",title:"Quality-release holds",requirement:"Signed-off tests, traceable batches and authorized approvals"},
    ],
    actions:[{label:"Review feed stock",route:"feed-stock"},{label:"Review stock",route:"inventory"}],
    timeline:"Lot receipt, formulation revision, mixing, QA hold and release",
  },
  organic: {
    subtitle: "Traceable organic production from batch to buyer",
    indicators: [
      {id:"batches",title:"Traceable batches",requirement:"Collection origin, batch key and processing timestamps"},
      {id:"quality",title:"Quality evidence outstanding",requirement:"Inspection results, packaging and certification evidence"},
      {id:"dispatch",title:"Dispatch reconciliation",requirement:"Accepted stock, order and delivered quantities"},
    ],
    actions:[{label:"Review sales",route:"sales"},{label:"Review inventory",route:"inventory"}],
    timeline:"Collection, processing, packaging, stock acceptance and dispatch",
  },
  suppliers: {
    subtitle: "Supplier credibility, quotations and receiving decisions",
    indicators: [
      {id:"suppliers",title:"Approved suppliers",requirement:"Verified supplier identities and approval lifecycle"},
      {id:"quotes",title:"Quotes awaiting decision",requirement:"Comparable quote versions, quantities and pricing"},
      {id:"quality",title:"Receiving exceptions",requirement:"Purchase order, goods receipt and quality evidence"},
    ],
    actions:[{label:"Review purchase orders",route:"purchase-orders"},{label:"Review procurement",route:"procurement"}],
    timeline:"Supplier approval, quotes, order issuance, delivery and inspection",
  },
  sales: {
    subtitle: "Order-to-settlement handoffs without invented sales",
    indicators: [
      {id:"orders",title:"Orders awaiting fulfilment",requirement:"Authorized orders, quantities and available stock"},
      {id:"dispatch",title:"Deliveries awaiting evidence",requirement:"Linked loads, proof of delivery and customer acceptance"},
      {id:"settlement",title:"Receivables outstanding (₦)",requirement:"Posted invoices, reconciled receipts and settlement allocation"},
    ],
    actions:[{label:"Review logistics",route:"logistics"},{label:"Review customer communication",route:"communication"}],
    timeline:"Order, reservation, dispatch, acceptance, invoice and receipt",
  },
  assets: {
    subtitle: "Asset identity, service readiness and custody",
    indicators: [
      {id:"registered",title:"Registered assets",requirement:"Verified asset tags, custodian, location and category"},
      {id:"service",title:"Maintenance due",requirement:"Service plan, meter readings and approved work orders"},
      {id:"retire",title:"Retirement decisions",requirement:"Condition evidence, approval and disposal audit"},
    ],
    actions:[{label:"Review equipment",route:"equipment"},{label:"Review audit logs",route:"audit"}],
    timeline:"Asset receipt, assignment, inspection, service and disposal",
  },
  infrastructure: {
    subtitle: "Water, power, fuel and critical utility readiness",
    indicators: [
      {id:"availability",title:"Utility availability",requirement:"Authorized readings and time-stamped observations"},
      {id:"incidents",title:"Open utility incidents",requirement:"Reported faults, severity, owner and resolution evidence"},
      {id:"maintenance",title:"Maintenance follow-up",requirement:"Approved service records, part usage and cost references"},
    ],
    actions:[{label:"Review water checks",route:"water-management"},{label:"Review equipment",route:"equipment"}],
    timeline:"Utility inspections, fault reports, work orders and closure",
  },
  logistics: {
    subtitle: "Dispatch coordination and delivery-proof control",
    indicators: [
      {id:"loads",title:"Loads awaiting dispatch",requirement:"Committed order, load plan and authorized vehicle allocation"},
      {id:"intransit",title:"Deliveries requiring proof",requirement:"Verified dispatch events, signed delivery or exceptions"},
      {id:"variance",title:"Load quantity differences",requirement:"Ordered, loaded, delivered and returned quantity reconciliation"},
    ],
    actions:[{label:"Review sales orders",route:"sales"},{label:"Review fleet readiness",route:"fleet"}],
    timeline:"Load creation, picking, dispatch, delivery acceptance and exceptions",
  },
  fleet: {
    subtitle: "Roadworthiness, inspection and assignment evidence",
    indicators: [
      {id:"fleet",title:"Vehicles available",requirement:"Vehicle registration, readiness and approved duty status"},
      {id:"service",title:"Service due",requirement:"Verified mileage, inspection notes and maintenance plan"},
      {id:"trips",title:"Trips needing reconciliation",requirement:"Authorized driver, route, fuel and completed trip evidence"},
    ],
    actions:[{label:"Review logistics",route:"logistics"},{label:"Review equipment",route:"equipment"}],
    timeline:"Inspection, assignments, servicing, refuelling and trip closure",
  },
  biosecurity: {
    subtitle: "Biosecurity inspections and exception escalation",
    indicators: [
      {id:"cases",title:"Cases awaiting review",requirement:"Dated inspection, site scope, reported observation and owner"},
      {id:"evidence",title:"Evidence incomplete",requirement:"Authorized sample chain, documents and reviewer decision"},
      {id:"followup",title:"Follow-ups overdue",requirement:"Approved actions, due dates and closure evidence"},
    ],
    actions:[{label:"Review security incidents",route:"security"},{label:"Review poultry health",route:"health"}],
    timeline:"Entry controls, inspections, evidence reviews and resolution",
  },
  files: {
    subtitle: "Secure record evidence and approved versions",
    indicators: [
      {id:"files",title:"Files awaiting verification",requirement:"Authoritative file metadata, owner and linked business record"},
      {id:"versions",title:"Versions awaiting approval",requirement:"Versioned original, change reason and approved reviewer"},
      {id:"retention",title:"Retention decisions",requirement:"Classification, retention policy and immutable disposal evidence"},
    ],
    actions:[{label:"Review audit logs",route:"audit"},{label:"Review form policies",route:"form-studio"}],
    timeline:"File intake, scan, verification, approval and retention actions",
  },
};

export function isSpecialistPulseRoute(route: string): route is SpecialistPulseRoute {
  return Object.prototype.hasOwnProperty.call(specialistPulseSpecs, route);
}

export function specialistPulseForAllowed(route: string, allowed: readonly Page[]) {
  if (!isSpecialistPulseRoute(route)) return null;
  const permitted = new Set(allowed.map(page => page.id));
  if (!permitted.has(route)) return null;
  const config = specialistPulseSpecs[route];
  return {
    route,
    title: allowed.find(page=>page.id===route)?.title || route,
    subtitle: config.subtitle,
    indicators: config.indicators,
    actions: config.actions.filter(action=>permitted.has(action.route) && action.route!==route),
    timeline: config.timeline,
  };
}
