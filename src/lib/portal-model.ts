export type Page = {
  id: string;
  title: string;
  group: string;
  icon: string;
  permission: string[];
  farm?: boolean;
  self?: string;
  api: string;
  authority: "existing" | "development" | "missing";
  dataState?: "live";
  dna: string;
  description: string;
  action?: string;
  write?: string;
};
const descriptions: Record<string, string> = {
  dashboard:
    "Executive situation room for today's farm operations, flock conservation, and financial performance.",
  myday: "Start your shift and keep your working day in view.",
  notifications: "Review updates that relate to your work.",
  profile:
    "Your identity, work information, account security, and preferences.",
  operations: "Coordinate today’s farm routines and operating records.",
  flocks: "Follow each flock from placement through its production cycle.",
  health: "Record observations and follow poultry health events.",
  feed: "Track feed received, consumed, and remaining.",
  vaccinations: "Keep scheduled vaccinations and treatment evidence together.",
  eggs: "Record collections and follow grading and production.",
  reconciliation:
    "Investigate differences between expected and recorded balances.",
  alerts: "Triage farm exceptions and follow their resolution.",
  inventory: "See available stock and trace its movement.",
  materials: "Review material quantities extracted from project documents.",
  finance: "Follow income, costs, and the evidence behind each transaction.",
  banking: "Design the verified account, collection, transfer and reconciliation boundary.",
  profit: "Compare recorded results with clearly stated projections.",
  expenses: "Review expense evidence and outstanding decisions.",
  construction: "Track project milestones, costs, and progress.",
  payroll: "Monthly compensation schedule with dynamic Osun State PAYE tax, PenCom 8% pension, and direct bank disbursement.",
  "payroll-admin": "Review payroll stages and resolve outstanding exceptions.",
  "daily-register": "Daily 7-column biological headcount and egg collection ledger for Houses 1 to 4.",
  orders: "Wholesale egg orders, real-time Moniepoint and NIP bank payment verification, and security gate exit passes.",
  treasury: "Authorized corporate bank sub-accounts, Kuda Business NIP settlement, and treasury reconciliation.",
  employees: "Find people and open authorized employee information.",
  invitations: "Prepare onboarding invitations and follow delivery status.",
  recruitment: "Move through applications with a clear candidate history.",
  "attendance-admin": "Review attendance patterns and investigate exceptions.",
  "signup-admin": "Review pending accounts and their approval windows.",
  leave: "Plan time away and follow your own leave requests.",
  loans: "Follow your own loan requests and repayment progress.",
  payslips: "Review your personal pay statements by period.",
  performance: "Connect your goals, progress, and review evidence.",
  chat: "Keep team conversations close to the work.",
  notices: "Stay informed about announcements relevant to you.",
  knowledge: "Find practical guides and continue your training.",
  security: "Review incidents, evidence, and response actions.",
  tracking: "Review assigned locations and available geofence evidence.",
  audit: "Trace recorded changes and synchronization events.",
  cameras: "Review authorized camera availability and device status.",
  rbac: "Inspect effective permissions and assigned scope.",
  admin: "Open the authorized administration areas available for design review.",
  settings: "Manage the Sites preview Sign-In presentation without changing production authentication.",
  "after-signin-studio": "Review the reserved management foundation for the current Sites after-login experience.",
  logs: "Find system events by severity and time.",
  diagnostics: "Review service checks and the evidence behind failures.",
  monitoring: "Follow service availability and signal history.",
};
const p = (
  id: string,
  title: string,
  group: string,
  icon: string,
  permission: string[],
  api: string,
  dna: string,
  extra: Partial<Page> = {},
): Page => ({
  id,
  title,
  group,
  icon,
  permission,
  api,
  dna,
  description: descriptions[id],
  authority: "existing",
  ...extra,
});
const constructionExperienceSpecs = [
  ["construction","Construction Dashboard","Overall construction cost, progress and items needing attention."],
  ["construction-projects","Projects","Reconstruct ongoing construction, start new projects and manage materials/evidence contextually."],
  ["construction-costs-payments","Costs & Payments","Track agreed costs, payments, advances, outstanding balances and linked Finance evidence."],
  ["construction-people-suppliers","People & Suppliers","Understand artisans, contractors and suppliers, their work, payments and evidence."],
  ["construction-reconciliation-alerts","Reconciliation & Alerts","Review unmatched records, possible duplicates, missing evidence and material differences."],
] as const;
const constructionExperiencePages: Page[] = constructionExperienceSpecs.map(([id, title, description]) =>
  p(id, title, "Construction Intelligence", "HardHat", ["construction.view"],
    id === "construction" ? "/api/portal/construction" : `Backend contract required for ${id}`,
    "One connected construction intelligence system", {
      authority: "development", description,
      write: ["construction", "construction-projects", "construction-costs-payments"].includes(id) ? "construction.edit" : undefined,
      action: id === "construction" ? "Add Cost" : id === "construction-projects" ? "Import Or Create Project" : id === "construction-costs-payments" ? "Add Cost / Payment" : undefined,
    }));
const importExperienceSpecs = [
  ["import-center","Data Import Center","Stage, validate, approve and reconcile structured enterprise data."],
  ["import-new","New Import","Upload and inspect a new structured source without bypassing business rules."],
  ["import-templates","Import Templates","Download and govern approved Daenem import structures."],
  ["import-mappings","Mapping Profiles","Map source columns to authorized fields and reusable profiles."],
  ["import-validation","Import Validation Errors","Resolve required fields, formats, relationships and duplicates."],
  ["import-processing","Import Processing","Monitor chunked/background processing and safe retry contracts."],
  ["import-completed","Completed Imports","Review accepted, rejected, skipped and updated row evidence."],
  ["import-failed","Failed Imports","Investigate file, validation, processing and authorization failures."],
  ["import-history","Import History","Trace uploader, approver, file hash, mapping and audit history."],
  ["import-corrections","Import Corrections","Apply authorized correction or rollback without erasing audit history."],
] as const;
const importExperiencePages: Page[] = importExperienceSpecs.map(([id,title,description])=>p(id,title,"Data & Migration","FileText",["import.view"],`Backend import staging contract required for ${id}`,"Upload-to-audit enterprise data pipeline",{authority:"development",description,write:id==="import-new"?"import.create":undefined,action:id==="import-new"?"Start Import":undefined}));

const purposeBuiltPages: Page[] = [
  p("flock-management", "Flock Management", "Flock Management", "Bird", ["inventory.view"], "/api/portal/v7/farm-operations/flock", "Authorized flock lifecycle register", {
    farm: true,
    description: "Create and review live flock records, then follow their server-controlled lifecycle.",
    action: "Add Flock",
    write: "inventory.edit",
    dataState: "live",
  }),
  p("water-management", "Water Management", "Operations", "Radio", ["farm.view"], "/api/portal/v7/farm-operations/water-check", "Authorized water availability and observation register", {
    farm: true,
    description: "Record water availability, meter evidence, visual checks, and observed exceptions without inventing consumption or quality results.",
    action: "Record Water Check",
    write: "farm.create",
    dataState: "live",
  }),
  p("medication", "Medication", "Operations", "Syringe", ["farm.health.view"], "/api/portal/v7/farm-operations/medication-administration", "Authorized medication administration evidence register", {
    farm: true,
    description: "Record medication administration, batch, recorded dose, reason, authorized instruction reference, and supporting evidence without generating clinical guidance.",
    action: "Record Medication",
    write: "farm.health.edit",
    dataState: "live",
  }),
  p("mortality", "Mortality", "Operations", "TriangleAlert", ["farm.view"], "/api/portal/v7/farm-operations/mortality-record", "Authorized mortality observation and review register", {
    farm: true,
    description: "Capture mortality count, time, observed cause status, disposition, escalation, and evidence without inventing expected ranges or diagnoses.",
    action: "Record Mortality",
    write: "farm.create",
    dataState: "live",
  }),
  p("houses", "Houses", "Flock Management", "HardHat", ["inventory.view"], "/api/portal/v7/farm-operations/house", "Authorized physical-house authority and linked placement context", {
    farm: true,
    description: "Maintain physical-house identity, capacity, readiness, sanitation, lifecycle, and linked flock evidence without inventing occupancy.",
    action: "Add House",
    write: "inventory.edit",
    dataState: "live",
  }),
  p("breed-management", "Breed Management", "Flock Management", "Bird", ["inventory.view"], "/api/portal/v7/farm-operations/breed", "Authorized breed identity and linked flock context", {
    farm: true,
    description: "Maintain the authorized breed register and review linked active flock records without invented performance claims.",
    action: "Add Breed",
    write: "inventory.edit",
    dataState: "live",
  }),
  p("flock-transfers", "Transfers", "Flock Management", "Truck", ["inventory.view"], "/api/portal/v7/farm-operations/flock-transfer", "Controlled flock movement and reconciliation workflow", {
    farm: true,
    description: "Plan, independently approve, reconcile, and complete authorized flock movements between houses.",
    action: "Plan Transfer",
    write: "inventory.edit",
    dataState: "live",
  }),
  p("production-analytics", "Production Analytics", "Flock Management", "ChartNoAxesCombined", ["farm.eggs.view"], "/api/portal/v7/analytics/production", "Verified egg-collection intelligence from authorized farm records", {
    farm: true,
    description: "Review verified egg-collection trends and previous-period evidence. Missing days remain gaps; backend-pending KPIs stay withheld.",
    dataState: "live",
  }),
  p("feed-stock", "Feed Stock", "Inventory", "Wheat", ["farm.feed.view"], "/api/portal/v7/farm-operations/feed", "Authorized feed movement and evidence register", {
    farm: true,
    description: "Record and review feed receipts, issues, consumption, wastage, and adjustments without inventing a current balance.",
    action: "Record Feed Movement",
    write: "farm.feed.edit",
    dataState: "live",
  }),
  p("medication-stock", "Medication Stock", "Inventory", "Syringe", ["inventory.view"], "/api/portal/v7/inventory-procurement/medication-stock-movement", "Authorized medication batch movement and expiry register", {
    farm: true,
    description: "Record and review medication receipts, issues, adjustments, wastage, batches, and expiry evidence without inventing balances.",
    action: "Record Medication Movement",
    write: "inventory.edit",
    dataState: "live",
  }),
  p("equipment", "Equipment", "Inventory", "HardHat", ["assets.view"], "/api/portal/v7/inventory-procurement/equipment", "Authorized equipment identity, condition, service evidence, and lifecycle register", {
    farm: true,
    description: "Maintain scoped equipment identity, observed condition, assignment, service evidence, and audited lifecycle changes.",
    action: "Add Equipment",
    write: "assets.edit",
    dataState: "live",
  }),
  p("purchase-orders", "Purchase Orders", "Inventory", "Package", ["procurement.view"], "/api/portal/v7/inventory-procurement/purchase-order", "Authorized supplier, request, order, and receiving workflow", {
    farm: true,
    description: "Prepare suppliers and purchase requests, then authorize and follow purchase orders through receiving.",
    action: "Create Purchase Order",
    write: "inventory.edit",
    dataState: "live",
  }),
  p("revenue", "Revenue", "Finance", "TrendingUp", ["finance.view"], "/api/portal/v7/commercial-finance/revenue", "Authorized revenue source, payment status, and evidence register", {
    description: "Record revenue against a verified customer, sales order, or documented external source and follow independent confirmation.",
    action: "Record Revenue",
    write: "finance.create",
    dataState: "live",
  }),
  p("financial-reports", "Financial Reports", "Finance", "FileText", ["finance.view"], "Backend reconciled financial-reporting contract required", "Financial reports awaiting reconciled producers", {
    authority: "missing",
    description: "Income, expense, cash-flow, and profitability reports remain unavailable until reconciled reporting producers are mounted.",
  }),
  p("financial-reporting", "Financial Reports", "Reports", "FileText", ["finance.view"], "Backend reconciled financial-reporting contract required", "Financial reporting awaiting reconciled producers", {
    authority: "missing",
    description: "Reporting outputs and distributions remain unavailable until reconciled period and provenance contracts are mounted.",
  }),
  p("people-overview", "People", "People", "UsersRound", ["hr.employee.view"], "/api/portal/v7/people-hr/employee-record", "Authorized People and HR record directory", {
    description: "Review the live employee, leave, attendance, payroll, and recruitment collections available in your scope.",
    dataState: "live",
  }),
  p("roles", "Roles", "People", "KeyRound", ["roles.manage"], "Backend role-management contract required", "Role management awaiting server persistence", {
    authority: "missing",
    description: "Sample in-memory role previews are not presented as persisted role definitions or assignments.",
  }),
  p("performance-management", "Performance", "People", "Target", ["performance.view_self"], "Backend performance-management contract required", "Performance management awaiting verified goals and reviews", {
    authority: "missing",
    description: "Goals, ratings, evidence, and review cycles remain unavailable until a dedicated server contract is mounted.",
  }),
  p("reports-overview", "Reports", "Reports", "FileText", ["analytics.view"], "Reporting contracts vary by module", "Report directory and status", {
    authority: "development",
    description: "Choose an operational, production, or financial report without crowding the dashboard.",
  }),
  p("operational-reports", "Operational Reports", "Reports", "FileText", ["farm.view"], "Backend operational-reporting contract required", "Operational reports awaiting period and provenance producers", {
    farm: true,
    authority: "missing",
    description: "Cross-operation period reports remain unavailable until a verified aggregation contract is mounted.",
  }),
  p("production-reports", "Production Reports", "Reports", "ChartNoAxesCombined", ["profit.view"], "Backend production-reporting contract required", "Production reports awaiting verified aggregations", {
    farm: true,
    authority: "missing",
    description: "Flock, egg, mortality, feed-efficiency, and production reports remain unavailable until verified aggregations are mounted.",
  }),
  p("administration-overview", "Administration", "Administration", "Settings2", ["users.admin"], "Administration contracts vary by module", "Administration directory and governance status", {
    authority: "development",
    description: "Open settings, audit logs, permissions, or AI management from one focused directory.",
  }),
  p("farm-settings", "Settings", "Administration", "Settings2", ["users.admin"], "Backend farm-settings contract required", "Farm settings awaiting server persistence", {
    authority: "missing",
    description: "Preview preferences are not presented as persisted farm configuration.",
  }),
  p("permissions", "Permissions", "Administration", "ShieldCheck", ["roles.manage"], "/api/portal/v699/rbac/catalog", "Permission assignment and scope review", {
    description: "Inspect and assign effective permissions with explicit farm, department, and record scope.",
  }),
  p("ai-management", "AI Management", "Administration", "Bot", ["ai-assistant.view"], "Backend AI governance contract required", "AI policy, source, and approval management", {
    authority: "development",
    description: "Control approved AI use, evidence sources, review gates, and audit expectations.",
  }),
  p("daily-brief", "Daily Brief", "Workspace", "Clock3", ["dashboard.view"], "/api/portal/dashboard", "Focused daily brief and attention queue", {
    description: "Review today’s brief, attention items, and permitted actions on a dedicated page.",
  }),
  p("owner-decisions", "Owner Decisions", "Owner Control", "Target", ["users.admin"], "Owner decision contracts vary by module", "Owner decision and approval workspace", {
    authority: "development",
    description: "Review owner-only decisions and approval evidence away from the dashboard.",
  }),
  p("executive-signals", "Executive Signals", "Management Intelligence", "ChartNoAxesCombined", ["finance.view"], "/api/portal/dashboard", "Executive operational and financial signals", {
    description: "Review cross-functional signals on a dedicated management page.",
  }),
  p("personalized-widgets", "Personalized Widgets", "System", "LayoutDashboard", ["widgets.manage"], "Backend widget preferences required", "Personalized widget configuration and review", {
    authority: "development",
    description: "Review and configure permitted widgets without turning the dashboard into a working screen.",
  }),
];

export const pages: Page[] = [
  p(
    "completion-center",
    "Implementation Completion Center",
    "System",
    "Target",
    ["implementation.review"],
    "Canonical feature register; backend status sources required",
    "Owner implementation control and evidence ledger",
    {
      authority: "development",
      description: "Track verified implementation, gaps, blockers, dependencies, decisions, and release deltas without hiding incomplete work.",
    },
  ),
  p(
    "table-studio",
    "Enterprise Table Studio",
    "System",
    "FileText",
    ["review.manage"],
    "Design fixture",
    "Record interrogation and column workbench",
    {
      authority: "missing",
      write: "table.export",
      description: "Accessible sample table configuration.",
    },
  ),
  p(
    "form-studio",
    "Smart Form Studio",
    "System",
    "FileText",
    ["review.manage"],
    "Design fixtures only",
    "Context, validation and review laboratory",
    {
      authority: "missing",
      description:
        "Fourteen representative record forms; no business mutation.",
    },
  ),
  p(
    "pigs",
    "Pig Farming",
    "Farm & Production",
    "PawPrint",
    ["pigs.view"],
    "Backend required; design fixture",
    "Breeding and farrowing board",
    {
      authority: "missing",
      description: "Breeding and farrowing board. Sample records only.",
      write: "pigs.edit",
      farm: true,
    },
  ),
  p(
    "goats",
    "Goat Herd",
    "Farm & Production",
    "PawPrint",
    ["goats.view"],
    "Backend required; design fixture",
    "Herd identity and relationship register",
    {
      authority: "missing",
      description:
        "Herd identity and relationship register. Sample records only.",
      write: "goats.edit",
      farm: true,
    },
  ),
  p(
    "snails",
    "Snail Production",
    "Farm & Production",
    "Shell",
    ["snails.view"],
    "Backend required; design fixture",
    "Pen and production-cycle atlas",
    {
      authority: "missing",
      description: "Pen and production-cycle atlas. Sample records only.",
      write: "snails.edit",
      farm: true,
    },
  ),
  p(
    "manufacturing",
    "Feed Manufacturing",
    "Farm & Production",
    "Factory",
    ["manufacturing.view"],
    "Backend required; design fixture",
    "Recipe-to-batch mass balance",
    {
      authority: "missing",
      description: "Recipe-to-batch mass balance. Sample records only.",
      write: "manufacturing.edit",
      farm: true,
    },
  ),
  p(
    "organic",
    "Organic Products",
    "Farm & Production",
    "Leaf",
    ["organic.view"],
    "Backend required; design fixture",
    "Collection-to-distribution traceability",
    {
      authority: "missing",
      description:
        "Collection-to-distribution traceability. Sample records only.",
      write: "organic.edit",
      farm: true,
    },
  ),
  p(
    "suppliers",
    "Supplier Management",
    "Stock & Finance",
    "ContactRound",
    ["procurement.view"],
    "/api/portal/v7/inventory-procurement/supplier-workspace",
    "Authenticated supplier sourcing register and evidence references",
    {
      farm: true,
      write: "inventory.edit",
      dataState: "live",
      description: "Live supplier identities, source evidence references and authorised supplier registration.",
    },
  ),
  p(
    "sales",
    "Sales & Distribution",
    "Stock & Finance",
    "Package",
    ["sales.view"],
    "Backend required; design fixture",
    "Fulfillment control room",
    {
      authority: "missing",
      description: "Fulfillment control room. Sample records only.",
      write: "sales.edit",
      farm: true,
    },
  ),
  p(
    "assets",
    "Asset Lifecycle",
    "Control & Assurance",
    "HardHat",
    ["assets.view"],
    "Backend required; design fixture",
    "Asset passport and service horizon",
    {
      authority: "missing",
      description: "Asset passport and service horizon. Sample records only.",
      write: "assets.edit",
      farm: true,
    },
  ),
  p(
    "infrastructure",
    "Infrastructure & Utilities",
    "Farm & Production",
    "Radio",
    ["infrastructure.view"],
    "Backend required; design fixture",
    "Utility availability and incident console",
    {
      authority: "missing",
      description:
        "Utility availability and incident console. Sample records only.",
      write: "infrastructure.edit",
      farm: true,
    },
  ),
  p(
    "logistics",
    "Logistics Control",
    "Stock & Finance",
    "Truck",
    ["logistics.view"],
    "Backend required; design fixture",
    "Dispatch lanes and exception inspector",
    {
      authority: "missing",
      description:
        "Dispatch lanes and exception inspector. Sample records only.",
      write: "logistics.edit",
      farm: true,
    },
  ),
  p(
    "fleet",
    "Fleet Operations",
    "Control & Assurance",
    "Car",
    ["fleet.view"],
    "Backend required; design fixture",
    "Vehicle readiness and maintenance calendar",
    {
      authority: "missing",
      description:
        "Vehicle readiness and maintenance calendar. Sample records only.",
      write: "fleet.edit",
      farm: true,
    },
  ),
  p(
    "biosecurity",
    "Biosecurity & Compliance",
    "Control & Assurance",
    "Shield",
    ["biosecurity.view"],
    "Backend required; design fixture",
    "Evidence-first inspection casebook",
    {
      authority: "missing",
      description: "Evidence-first inspection casebook. Sample records only.",
      write: "biosecurity.edit",
      farm: true,
    },
  ),
  p(
    "files",
    "Files & Evidence",
    "Control & Assurance",
    "FolderLock",
    ["files.view"],
    "Backend required; design fixture",
    "Secure evidence intake and version explorer",
    {
      authority: "missing",
      description:
        "Secure evidence intake and version explorer. Sample records only.",
      write: "files.edit",
      farm: true,
    },
  ),
  p(
    "field-admin",
    "Field Configuration",
    "System",
    "Settings2",
    ["field-admin.view"],
    "Backend required; design fixture",
    "Schema configuration workbench",
    {
      authority: "missing",
      description: "Schema configuration workbench. Sample records only.",
      write: "field-admin.edit",
    },
  ),
  p(
    "maker-checker",
    "Maker / Checker",
    "Control & Assurance",
    "Scale",
    ["maker-checker.view"],
    "Backend required; design fixture",
    "Variance and evidence decision bench",
    {
      authority: "missing",
      description: "Variance and evidence decision bench. Sample records only.",
      write: "maker-checker.edit",
      farm: true,
    },
  ),
  p(
    "workflow",
    "Workflow Studio",
    "System",
    "Workflow",
    ["workflow.view"],
    "Backend required; design fixture",
    "Trigger-condition-action canvas",
    {
      authority: "missing",
      description: "Trigger-condition-action canvas. Sample records only.",
      write: "workflow.edit",
    },
  ),
  p(
    "analytics",
    "Analytics Studio",
    "Control & Assurance",
    "ChartNoAxesCombined",
    ["analytics.view"],
    "Backend required; design fixture",
    "Data lens and comparison studio",
    {
      authority: "missing",
      description: "Data lens and comparison studio. Sample records only.",
      write: "analytics.edit",
      farm: true,
    },
  ),
  p(
    "chart-library",
    "Chart Library",
    "System",
    "TrendingUp",
    ["chart-library.view"],
    "Backend required; design fixture",
    "Business-question visualization laboratory",
    {
      authority: "missing",
      description:
        "Business-question visualization laboratory. Sample records only.",
      write: "chart-library.edit",
    },
  ),
  p(
    "ai-assistant",
    "Daenem AI Assistant",
    "System",
    "Bot",
    ["ai-assistant.view"],
    "Backend required; design fixture",
    "Grounded explanation and review workspace",
    {
      authority: "missing",
      description:
        "Grounded explanation and review workspace. Sample records only.",
      write: "ai-assistant.edit",
    },
  ),
  p(
    "clock-admin",
    "Global Operations Administration",
    "System",
    "Clock3",
    ["clock.manage"],
    "Backend required",
    "Location constellation and clock configuration",
    {
      authority: "missing",
      description: "Configure the sample global operations center.",
    },
  ),
  p(
    "weather-lab",
    "Weather Visual Lab",
    "System",
    "CloudSun",
    ["review.manage"],
    "No provider connected",
    "Atmospheric condition inspector",
    {
      authority: "missing",
      description: "Inspect 23 visual weather fixtures.",
    },
  ),
  p(
    "widget-studio",
    "Widget Studio",
    "System",
    "LayoutDashboard",
    ["widgets.manage"],
    "Backend required",
    "Layout canvas with accessible controls",
    {
      authority: "missing",
      description: "Arrange permitted workspace previews.",
    },
  ),
  p(
    "communication",
    "Customer Communication",
    "Customer Engagement",
    "MessagesSquare",
    ["communication.view"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p("customer-records", "Customer Records", "Customer Engagement", "ContactRound", ["commercial.view"], "/api/portal/v7/commercial-finance/customer", "Scoped customer registration and authorized record review", {farm:true, dataState:"live", description:"Register and review customer records in your authorized company and site. Creation requires commercial editing authority."}),
  p("sales-drafts", "Draft Sales Orders", "Sales & Distribution", "ShoppingCart", ["commercial.view"], "/api/portal/v7/commercial-finance/sales-order", "Scoped draft creation only; no stock or financial posting", {farm:true, dataState:"live", description:"Prepare a draft using an authorized customer. Submission, approval, fulfilment and posting are separate."}),
  p(
    "customers",
    "Customers",
    "Customer Engagement",
    "ContactRound",
    ["communication.view"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "comm-templates",
    "Template Studio",
    "Customer Engagement",
    "FileText",
    ["communication.templates.manage"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "letterhead-studio",
    "Letterhead Studio",
    "Customer Engagement",
    "FileText",
    ["communication.letterhead.manage"],
    "Backend required; no document renderer connected",
    "Approved brand document canvas + human review gates",
    {
      authority: "missing",
      description:
        "Design invoice, receipt, statement and communication letterheads from approved facts.",
    },
  ),
  p(
    "comm-automation",
    "Communication Automation",
    "Customer Engagement",
    "Activity",
    ["communication.automation.manage"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "comm-campaigns",
    "Customer Campaigns",
    "Customer Engagement",
    "Megaphone",
    ["communication.campaigns.manage"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "comm-feedback",
    "Customer Feedback",
    "Customer Engagement",
    "MessagesSquare",
    ["communication.feedback.view"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "comm-complaints",
    "Customer Complaints",
    "Customer Engagement",
    "Shield",
    ["communication.cases.view"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "comm-analytics",
    "Communication Analytics",
    "Customer Engagement",
    "TrendingUp",
    ["communication.analytics.view"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "comm-settings",
    "Communication Settings",
    "Customer Engagement",
    "Settings2",
    ["communication.settings.manage"],
    "Backend required; no provider connected",
    "Customer timeline + transaction inspector + reviewed composer",
    {
      authority: "missing",
      description:
        "Fictional customer engagement review. No real messages are sent.",
    },
  ),
  p(
    "approval-status",
    "Account Approval",
    "Workspace",
    "UserCheck",
    ["approval.self"],
    "Unconnected existing account lifecycle",
    "Approval deadline + personal status",
    { description: "Follow your approval window and permitted next steps." },
  ),
  p(
    "my-expenses",
    "My Expense Submissions",
    "Self-Service",
    "Receipt",
    ["expense.create", "expense.view_self"],
    "Unconnected expense self-service contract",
    "Receipt composer + own submission history",
    { description: "Prepare your own expense evidence and follow its review." },
  ),
  p(
    "hatchery",
    "Hatchery",
    "Farm & Production",
    "Egg",
    ["farm.view"],
    "Unverified hatchery development contract",
    "Incubation calendar + batch outcome",
    {
      farm: true,
      authority: "development",
      description: "Follow sample incubation batches and hatch outcomes.",
    },
  ),
  p(
    "procurement",
    "Procurement",
    "Stock & Finance",
    "Package",
    ["procurement.view"],
    "Unverified procurement development contract",
    "Quote comparison + sourcing stages",
    {
      farm: true,
      authority: "development",
      description: "Compare quotes and follow the purchase decision.",
    },
  ),
  p(
    "themes",
    "Theme Studio",
    "System",
    "Settings2",
    ["theme.manage"],
    "Existing Theme V10 integration unconnected",
    "Theme catalog + assignment preview",
    {
      authority: "missing",
      description:
        "Preview the ten retained theme identities and appearance controls.",
    },
  ),
  p(
    "market",
    "Market Intelligence",
    "Stock & Finance",
    "TrendingUp",
    ["market.view"],
    "No verified market intelligence contract",
    "Evidence completeness + radius selection",
    {
      farm: true,
      authority: "missing",
      description: "Inspect market coverage, sources, and forecast readiness.",
    },
  ),

  ...purposeBuiltPages,
  p(
    "dashboard",
    "Farm Overview",
    "Home",
    "LayoutDashboard",
    ["dashboard.view"],
    "/api/portal/dashboard",
    "Operational pulse and company decisions",
    { dataState: "live", description: "Executive situation room for today's farm operations, flock conservation, and financial performance." },
  ),
  p(
    "myday",
    "My Day",
    "Workspace",
    "Clock3",
    ["myday.view", "attendance.view", "attendance.create"],
    "/api/portal/attendance",
    "Shift dial + personal day timeline",
    { self: "myday", action: "Clock In", write: "attendance.create", dataState: "live" },
  ),
  p(
    "notifications",
    "Notifications",
    "Workspace",
    "Bell",
    ["notifications.view"],
    "/api/portal/notifications",
    "Priority inbox + message reading pane",
    { self: "notifications" },
  ),
  p(
    "profile",
    "My Profile",
    "Workspace",
    "UserRound",
    ["profile.view"],
    "/api/portal/v6/hr/profile",
    "Identity passport + career and security workspace",
  ),
  p(
    "operations",
    "Daily Farm Records",
    "Operations",
    "Tractor",
    ["farm.view"],
    "/api/portal/records?module=farm_ops",
    "Daily operating lanes + readiness checklist",
    { farm: true, action: "New Farm Record", write: "farm.create" },
  ),
  p(
    "flocks",
    "Batches",
    "Flock Management",
    "Bird",
    ["inventory.view"],
    "/api/portal/v7/farm-operations/flock",
    "Operational flock register + lifecycle-controlled records",
    { farm: true, action: "Add Flock", write: "inventory.edit", dataState: "live" },
  ),
  p(
    "health",
    "Poultry Health",
    "Farm & Production",
    "HeartPulse",
    ["farm.health.view"],
    "/api/portal/v7/farm-operations/health-event",
    "Authorized observation, treatment and mortality evidence register",
    { farm: true, action: "Record Observation", write: "farm.health.edit", dataState: "live" },
  ),
  p(
    "feed",
    "Feed Management",
    "Operations",
    "Wheat",
    ["farm.feed.view"],
    "/api/portal/v7/farm-operations/feed",
    "Authorized feed receipt, issue, consumption, wastage and adjustment register",
    { farm: true, action: "Record Feed", write: "farm.feed.edit", dataState: "live" },
  ),
  p(
    "vaccinations",
    "Vaccinations",
    "Farm & Production",
    "Syringe",
    ["vaccination.view"],
    "/api/portal/v7/farm-operations/vaccination",
    "Authorized vaccination administration and batch evidence register",
    { farm: true, action: "Record Vaccination", write: "vaccination.edit", dataState: "live" },
  ),
  p(
    "eggs",
    "Egg Collection",
    "Operations",
    "Egg",
    ["farm.eggs.view"],
    "/api/portal/v7/farm-operations/egg-batch",
    "Authorized flock collection, condition-count and verification evidence register",
    { farm: true, action: "Record Collection", write: "farm.eggs.edit", dataState: "live" },
  ),
  p(
    "reconciliation",
    "Reconciliation",
    "Farm & Production",
    "Scale",
    ["farm.reconciliation.view"],
    "Unverified development contract",
    "Balance equation + variance investigation",
    { farm: true, authority: "development" },
  ),
  p(
    "alerts",
    "Farm Alerts",
    "Farm & Production",
    "TriangleAlert",
    ["farm.alerts.view"],
    "Unverified development contract",
    "Exception queue + resolution evidence",
    { farm: true, authority: "development" },
  ),
  p(
    "inventory",
    "Inventory Overview",
    "Inventory",
    "Package",
    ["inventory.view"],
    "/api/portal/v7/inventory-procurement/stock-movement",
    "Authorized stock movement and evidence register",
    { farm: true, action: "Record Stock Movement", write: "inventory.edit", dataState: "live" },
  ),
  p(
    "materials",
    "Material Extraction",
    "Stock & Finance",
    "ScanLine",
    ["materials.ai"],
    "/api/portal/materials/extract",
    "Document intake + extraction review canvas",
    { action: "Choose Document", write: "materials.ai" },
  ),
  p(
    "finance",
    "Finance Overview",
    "Finance",
    "Wallet",
    ["finance.view"],
    "/api/portal/finance",
    "Period balance + financial ledger",
    { action: "New Transaction", write: "finance.create" },
  ),
  p(
    "banking",
    "Banking & Treasury",
    "Stock & Finance",
    "Landmark",
    ["finance.view"],
    "Provider verification and backend contracts required",
    "Treasury control surface + verified payment boundary",
    { authority: "missing", description: "Bank accounts, collections, transfers and reconciliation contracts. No real money movement." },
  ),
  p(
    "profit",
    "Profitability",
    "Finance",
    "TrendingUp",
    ["profit.view"],
    "/api/portal/profit; /api/portal/projection",
    "Actual and projected comparison + assumptions",
  ),
  p(
    "expenses",
    "Expenses",
    "Finance",
    "Receipt",
    ["finance.view"],
    "/api/portal/v7/commercial-finance/expense",
    "Authorized expense evidence + audited approval workflow",
    { action: "Record Expense", write: "finance.create", dataState: "live" },
  ),
  ...constructionExperiencePages,
  ...importExperiencePages,
  p(
    "payroll",
    "Payroll Updates",
    "Human Resources & Payroll",
    "Banknote",
    ["payroll.view"],
    "/api/v1/transfers/nip",
    "Statutory payroll compliance and verified salary settlement",
    { dataState: "live", description: "Monthly compensation schedule with dynamic Osun State PAYE tax, PenCom 8% pension, and direct bank disbursement." },
  ),
  p(
    "daily-register",
    "Daily Pen Register",
    "Flocks & Housing",
    "Egg",
    ["farm.view"],
    "/api/v1/operations/daily-register",
    "Flock inventory conservation and daily production tracking",
    { farm: true, dataState: "live", description: "Daily 7-column biological headcount and egg collection ledger for Houses 1 to 4." },
  ),
  p(
    "orders",
    "Wholesale Customer Orders",
    "Sales & Orders",
    "Receipt",
    ["commercial.view", "finance.view"],
    "/api/v1/orders",
    "Customer wholesale orders and anti-fraud payment reconciliation",
    { farm: true, dataState: "live", description: "Wholesale egg orders, real-time Moniepoint and NIP bank payment verification, and security gate exit passes." },
  ),
  p(
    "payroll-admin",
    "Payroll",
    "People",
    "BriefcaseBusiness",
    ["hr.payroll.view"],
    "/api/portal/v7/people-hr/payroll-batch",
    "Authorized payroll batch register",
    { dataState: "live" },
  ),
  p(
    "employees",
    "Employees",
    "People",
    "UsersRound",
    ["hr.employee.view"],
    "/api/portal/v7/people-hr/employee-record",
    "Authorized employee record register",
    { dataState: "live" },
  ),
  p(
    "invitations",
    "Invitations",
    "People & Work",
    "MailPlus",
    ["users.admin"],
    "/api/portal/invitations",
    "Onboarding delivery journey + invitation composer",
    { action: "New Invitation", write: "users.admin" },
  ),
  p(
    "recruitment",
    "Recruitment",
    "People & Work",
    "ContactRound",
    ["hr.recruitment.view"],
    "/api/portal/v7/people-hr/recruitment-candidate",
    "Authorized recruitment candidate register",
    { dataState: "live" },
  ),
  p(
    "attendance-admin",
    "Attendance Administration",
    "People & Work",
    "CalendarCheck",
    ["hr.attendance.view"],
    "/api/portal/v7/people-hr/attendance-record",
    "Authorized attendance record register",
    { dataState: "live" },
  ),
  p(
    "signup-admin",
    "Signup Administration",
    "People & Work",
    "UserCheck",
    ["signup.approve"],
    "/api/portal/v69/signup-approvals",
    "Approval window queue + identity review",
  ),
  p(
    "leave",
    "My Leave",
    "Self-Service",
    "CalendarDays",
    ["hr.leave.view"],
    "/api/portal/v7/people-hr/leave-request",
    "Personal request form + server-confirmed review history",
    { self: "leave-request", action: "Request Leave", write: "hr.leave.request", dataState: "live" },
  ),
  p(
    "loans",
    "My Loans",
    "Self-Service",
    "Landmark",
    ["loans.view_self"],
    "/api/portal/v6/hr/loans",
    "Repayment journey + request detail",
    { self: "v6-loans", action: "Request Loan", write: "loans.request" },
  ),
  p(
    "payslips",
    "My Payslips",
    "Self-Service",
    "FileText",
    ["payslip.view_self"],
    "/api/portal/v6/hr/payslips",
    "Personal statement + pay-period rail",
    { self: "v6-payslips" },
  ),
  p(
    "performance",
    "My Performance",
    "Self-Service",
    "Target",
    ["performance.view_self"],
    "/api/portal/v6/hr/performance",
    "Goal evidence + review timeline",
    { self: "v6-performance" },
  ),
  p(
    "chat",
    "Team Chat",
    "Communication",
    "MessagesSquare",
    ["chat.view"],
    "/api/portal/v6/chat",
    "Channel rail + conversational thread",
    { self: "v6-chat" },
  ),
  p(
    "notices",
    "Notice Board",
    "Communication",
    "Megaphone",
    ["notice.view"],
    "/api/portal/v6/notices",
    "Editorial announcement board",
    { self: "v6-notices" },
  ),
  p(
    "knowledge",
    "Knowledge & Training",
    "Communication",
    "BookOpen",
    ["knowledge.view", "training.view"],
    "/api/portal/knowledge (mapping pending)",
    "Learning library + reading workspace",
    { authority: "missing" },
  ),
  p(
    "security",
    "Security Incidents",
    "Control & Assurance",
    "Shield",
    ["security.view"],
    "/api/portal/security",
    "Incident command + evidence timeline",
  ),
  p(
    "tracking",
    "Tracking & Geofence",
    "Control & Assurance",
    "MapPin",
    ["tracking.view"],
    "/api/portal/tracking",
    "Spatial operations + coordinate evidence",
  ),
  p(
    "audit",
    "Audit Logs",
    "Administration",
    "History",
    ["audit.view"],
    "/api/portal/audit",
    "Chronological forensic rail + change inspector",
  ),
  p(
    "cameras",
    "Cameras",
    "Control & Assurance",
    "Camera",
    ["camera.view"],
    "/api/portal/v6/cameras",
    "Camera operations wall + device rail",
  ),
  p(
    "rbac",
    "Access Control",
    "Control & Assurance",
    "KeyRound",
    ["roles.manage"],
    "/api/portal/v699/rbac/catalog",
    "Effective permission matrix + scope explanation",
  ),
  p(
    "admin",
    "Admin Overview",
    "Admin",
    "ShieldCheck",
    ["users.admin", "auth.settings.view"],
    "Sites design preview only; no production endpoint",
    "Authorized frontend administration directory",
    { authority: "development" },
  ),
  p(
    "meta-integrations",
    "Meta & WhatsApp",
    "Admin",
    "MessageSquare",
    ["META_INTEGRATION_VIEW"],
    "/api/admin/integrations/meta",
    "Farms-only Meta products, encrypted credentials, WhatsApp assets, webhooks, templates and diagnostics",
    { dataState: "live" },
  ),
  p(
    "platform-storage",
    "Cloud Storage & Backup",
    "Admin",
    "FolderLock",
    ["PLATFORM_STORAGE_VIEW"],
    "/api/admin/platform/storage",
    "Cloudflare R2 authority, OneDrive mirror and secure weather provider configuration",
  ),
  p(
    "settings",
    "Sign-In Experience / Sign-In Studio",
    "Admin",
    "Settings2",
    ["users.admin", "auth.settings.view"],
    "/api/portal/settings",
    "Scoped configuration workbench",
  ),
  p(
    "after-signin-studio",
    "After-Sign-In Experience / After-Sign-In Studio",
    "Admin",
    "Monitor",
    ["users.admin", "auth.settings.view"],
    "Sites design preview only; no production endpoint",
    "Current Sites after-login experience management foundation",
    { authority: "development" },
  ),
  p(
    "logs",
    "System Logs",
    "System",
    "Terminal",
    ["logs.admin"],
    "/api/portal/v6/logs",
    "Dense log stream + severity filters",
  ),
  p(
    "diagnostics",
    "Diagnostics",
    "System",
    "Activity",
    ["diagnostics.view"],
    "/api/portal/v69/diagnostics",
    "Service dependency checks + evidence readout",
  ),
  p(
    "monitoring",
    "Monitoring",
    "System",
    "Radio",
    ["monitoring.view"],
    "/api/portal/v69/monitoring",
    "Service signal plots + status history",
  ),
];
export type PersonaId =
  | "owner"
  | "manager"
  | "operator"
  | "finance"
  | "employee"
  | "provisional"
  | "expired"
  | "no-role"
  | "hr"
  | "procurement"
  | "outside";
export type Persona = {
  id: string;
  /** Stable authenticated account identity; not a permission or credential. */
  authenticatedAccountId?: string;
  label: string;
  name: string;
  job: string;
  initials: string;
  permissions: string[];
  farm: boolean;
  self: string[];
  employeeId: string;
  department: string;
  email?: string;
  principalSource?: "authenticated" | "review-fixture";
  isOwner?: boolean;
  accessState?: "owner" | "assigned" | "no_role" | "provisional" | "provisional_expired";
  restriction?: "none" | "no-role" | "provisional" | "expired" | "disabled";
  permissionScopes?: Readonly<Record<string, "own" | "assigned" | "department" | "all">>;
  organizationScope?: Readonly<Record<string, string>> | null;
};
const personal = [
  "expense.create",
  "expense.view_self",
  "dashboard.view",
  "profile.view",
  "profile.edit",
  "myday.view",
  "attendance.create",
  "notifications.view",
  "hr.leave.view",
  "hr.leave.request",
  "loans.view_self",
  "loans.request",
  "payslip.view_self",
  "performance.view_self",
  "chat.view",
  "notice.view",
  "knowledge.view",
];
const self = [
  "myday",
  "notifications",
  "v6-profile",
  "leave-request",
  "v6-loans",
  "v6-payslips",
  "v6-performance",
  "v6-chat",
  "v6-notices",
];
export const personas: Persona[] = [
  {
    id: "owner",
    label: "Owner",
    name: "Adedapo Daenem",
    job: "Owner & Chief Executive",
    initials: "AD",
    permissions: ["*"],
    farm: true,
    self,
    employeeId: "DEMO-001",
    department: "Executive Office",
  },
  {
    id: "manager",
    label: "Farm Manager",
    name: "Sample Farm Manager",
    job: "Farm Manager",
    initials: "FM",
    permissions: [
      ...personal,
      "farm.view",
      "farm.create",
      "farm.edit",
      "inventory.view",
      "inventory.edit",
      "farm.health.view",
      "farm.health.edit",
      "farm.feed.view",
      "farm.feed.edit",
      "vaccination.view",
      "vaccination.edit",
      "farm.eggs.view",
      "farm.eggs.edit",
      "farm.reconciliation.view",
      "farm.alerts.view",
    ],
    farm: true,
    self,
    employeeId: "DEMO-002",
    department: "Farm Operations",
  },
  {
    id: "operator",
    label: "Restricted Farm Staff",
    name: "Sample Farm Operator",
    job: "Poultry Operator",
    initials: "FO",
    permissions: [...personal, "farm.view", "farm.eggs.view", "farm.eggs.edit"],
    farm: true,
    self,
    employeeId: "DEMO-003",
    department: "Poultry Operations",
  },
  {
    id: "finance",
    label: "Finance User",
    name: "Sample Accountant",
    job: "Accountant",
    initials: "SA",
    permissions: [
      ...personal,
      "finance.view",
      "finance.create",
      "finance.edit",
      "profit.view",
      "expense.admin",
      "expense.create",
      "construction.view",
      "import.view",
      "payroll.view",
      "banking.accounts.view",
      "banking.collections.view",
      "banking.reconcile.view",
      "banking.payroll.view",
    ],
    farm: true,
    self,
    employeeId: "DEMO-004",
    department: "Finance",
  },
  {
    id: "employee",
    label: "General Employee",
    name: "Sample Employee",
    job: "Team Member",
    initials: "SE",
    permissions: personal,
    farm: true,
    self,
    employeeId: "DEMO-005",
    department: "Business Services",
  },
  {
    id: "provisional",
    label: "Provisional Account",
    name: "Sample Applicant",
    job: "Awaiting Approval",
    initials: "PA",
    permissions: ["profile.view", "approval.self"],
    farm: false,
    self: [],
    employeeId: "Not Assigned",
    department: "Not Assigned",
  },
  {
    id: "expired",
    label: "Expired Provisional",
    name: "Sample Expired Applicant",
    job: "Approval Window Expired",
    initials: "EP",
    permissions: ["profile.view", "approval.self"],
    farm: false,
    self: [],
    employeeId: "Not Assigned",
    department: "Not Assigned",
  },
  {
    id: "no-role",
    label: "Approved · No Role",
    name: "Sample Approved Account",
    job: "Awaiting Access Assignment",
    initials: "NR",
    permissions: ["profile.view", "approval.self"],
    farm: false,
    self: [],
    employeeId: "Not Assigned",
    department: "Not Assigned",
  },
  {
    id: "hr",
    label: "HR",
    name: "Sample HR Reviewer",
    job: "HR Reviewer",
    initials: "HR",
    permissions: [
      ...personal,
      "users.admin",
      "attendance.admin",
      "recruitment.view",
      // V73 communications authority is explicit and limited to the HR
      // domain; it is not inherited by ordinary employees or operators.
      "communication.view",
      "communications.view",
      "communications.reply",
      "communications.initiate",
      "communications.notes",
      "communications.ai.generate",
      "communications.ai.refine",
      "communications.templates.view",
      "communications.send",
      "communications.audit.view",
      "hr.communications.view",
      "hr.recruitment.view",
      "hr.leave.view",
      "hr.training.view",
    ],
    farm: true,
    self,
    employeeId: "DEMO-008",
    department: "People",
  },
  {
    id: "procurement",
    label: "Inventory / Procurement",
    name: "Sample Procurement Officer",
    job: "Procurement Officer",
    initials: "IP",
    permissions: [
      ...personal,
      "inventory.view",
      "inventory.edit",
      "procurement.view",
      "procurement.approve",
      "import.view",
      "import.create",
    ],
    farm: true,
    self,
    employeeId: "DEMO-009",
    department: "Supply Chain",
  },
  {
    id: "outside",
    label: "Outside Farm Scope",
    name: "Sample External-Scope Employee",
    job: "Team Member",
    initials: "ES",
    permissions: [...personal, "farm.view", "farm.eggs.view", "inventory.view"],
    farm: false,
    self,
    employeeId: "DEMO-007",
    department: "Other Business Unit",
  },
];
// Role-only review authorization. Never use these fictional definitions as production roles.
export const sharedPermissions = [
  "shell.view",
  "search.view",
  "profile.security.view",
  "profile.preferences.view",
  "help.view",
  "appearance.view",
  "weather.view",
  "install.view",
  "release.view",
  "farm.eggs.approve",
  "farm.daily-report.view",
  "farm.daily-report.edit",
  "farm.daily-report.approve",
];
export const permissionCatalog = [
  ...new Set([
    ...pages.flatMap((p) => [...p.permission, ...(p.write ? [p.write] : [])]),
    ...personas.flatMap((p) => p.permissions.filter((k) => k !== "*")),
    ...sharedPermissions,
    // Catalogued for explicit, scoped recovery and audit access only; no default grant.
    "farm.daily-report.audit.view",
    "farm.daily-report.recovery.manage",
    "communication.scope.corporate",
    "communication.scope.assigned",
    "communication.contacts.view",
    "communication.transactions.view",
    "communication.compose",
    "communication.ai.draft",
    "communication.send",
    "communication.schedule",
    "communication.export",
    "communication.attachments.view",
    "communication.notes.view",
    "communication.preferences.edit",
    "communication.cases.edit",
    "communication.feedback.edit",
    "communication.bulk.send",
    "communication.audit.view",
    "communications.view",
    "communications.reply",
    "communications.initiate",
    "communications.assign",
    "communications.manage",
    "communications.notes",
    "communications.attachments.view",
    "communications.attachments.manage",
    "communications.export",
    "communications.templates.view",
    "communications.templates.create",
    "communications.templates.edit",
    "communications.templates.approve",
    "communications.automation.view",
    "communications.automation.manage",
    "communications.ai.generate",
    "communications.ai.refine",
    "communications.ai.approve",
    "communications.send",
    "communications.settings.view",
    "communications.settings.manage",
    "communications.audit.view",
    "communications.provider.manage",
    "META_INTEGRATION_VIEW",
    "META_INTEGRATION_MANAGE",
    "META_CREDENTIALS_MANAGE",
    "META_PRODUCTS_MANAGE",
    "META_WHATSAPP_MANAGE",
    "META_AUTH_MANAGE",
    "META_WEBHOOK_MANAGE",
    "META_TEMPLATE_MANAGE",
    "META_FACEBOOK_MANAGE",
    "META_INSTAGRAM_MANAGE",
    "META_DIAGNOSTICS_VIEW",
    "META_AUDIT_VIEW",
    "hr.communications.view",
    "hr.recruitment.view",
    "hr.leave.view",
    "hr.training.view",
    "review.manage",
    "roles.manage",
    "theme.manage",
    "inventory.approve",
    "manufacturing.approve",
    "procurement.approve",
    "banking.accounts.view",
    "banking.collections.view",
    "banking.transfers.view",
    "banking.reconcile.view",
    "banking.payroll.view",
    "banking.providers.view",
    "banking.audit.view",
    // Backend operation permissions must be recognized by the same canonical
    // server validator as the navigation permissions above. They authorize
    // explicit scoped actions, never wildcard or cross-company access.
    "commercial.view",
    "commercial.edit",
    "commercial.approve",
    "finance.approve",
    "hr.employee.manage",
    "hr.leave.manage",
    "hr.leave.approve",
    "hr.attendance.record",
    "hr.attendance.manage",
    "hr.payroll.manage",
    "hr.payroll.approve",
    "hr.recruitment.manage",
    "files.create",
    "files.delete",
    "communications.scope.all",
    "suppliers.view",
    "alerts.view",
    "alerts.rules.view",
    "alerts.rules.manage",
    "alerts.admin_notice.send",
    "alerts.acknowledge",
    "alerts.resolve",
    "alerts.audit.view",
    "alerts.delivery.view",
  ]),
];
export const reviewRoles = personas
  .filter((p) => p.id !== "no-role")
  .map((p) => ({
    id: `review-role-${p.id}`,
    name: p.label,
    permissions:
      p.id === "owner"
        ? [...permissionCatalog]
        : [
            ...p.permissions,
            "shell.view",
            ...(p.id === "provisional" || p.id === "expired"
              ? ["help.view"]
              : sharedPermissions),
          ],
  }));
export const assignedRoles: Record<string, string[]> = Object.fromEntries(
  personas.map((p) => [
    p.id,
    p.id === "no-role" ? [] : [`review-role-${p.id}`],
  ]),
);
export function effectivePermissions(person: Persona) {
  if (person.principalSource === "authenticated") {
    return new Set(person.permissions);
  }
  return new Set([
    "profile.view",
    "shell.view",
    "profile.security.view",
    "profile.preferences.view",
    ...(assignedRoles[person.id] || []).flatMap(
      (id) => reviewRoles.find((r) => r.id === id)?.permissions || [],
    ),
  ]);
}
export function has(person: Persona, permission: string) {
  return effectivePermissions(person).has(permission);
}
export function isOwnerPrincipal(person: Persona) {
  return person.principalSource === "authenticated"
    ? person.isOwner === true && person.accessState === "owner"
    : person.id === "owner";
}
export function canRenderPortalShell(person: Persona) {
  if (person.principalSource !== "authenticated") return has(person, "shell.view");
  return person.restriction !== "disabled";
}
export function canView(person: Persona, page: Page) {
  const owner = isOwnerPrincipal(person);
  if (page.id === "platform-storage") {
    if (person.principalSource === "authenticated") {
      // Owner identity never replaces an assigned Cloud Storage capability.
      return person.restriction === "none" && has(person, "PLATFORM_STORAGE_VIEW");
    }
    return owner || has(person, "PLATFORM_STORAGE_VIEW");
  }
  if (person.principalSource === "authenticated") {
    if (person.restriction === "disabled") return false;
    // The current RBAC workbench is a synthetic review fixture. It remains
    // available only through the server-gated review environment until a
    // production-backed role-management surface exists.
    if (page.id === "rbac") return false;
    if (["no_role", "provisional", "provisional_expired"].includes(person.accessState || "")) {
      return ["approval-status", "profile"].includes(page.id);
    }
  }
  return (
    (page.id !== "rbac" || owner || has(person, "roles.manage")) &&
    (page.id !== "admin" || person.principalSource === "authenticated" || owner) &&
    (!["provisional", "expired"].includes(person.id) ||
      ["approval-status", "profile"].includes(page.id)) &&
    page.permission.some((k) => has(person, k)) &&
    (!page.farm || person.farm) &&
    (!page.self || person.self.includes(page.self) || (person.principalSource !== "authenticated" && owner))
  );
}
export const visiblePages = (person: Persona) =>
  pages.filter((page) => canView(person, page));
export const canPage = (person: Persona, id: string) => {
  const page = pages.find((p) => p.id === id);
  return !!page && canView(person, page);
};
/** Canonical public theme contract. Legacy aliases remain accepted for saved review URLs. */
export const themes = [
  ["reference-v3", "Reference V3", "#2463eb"],
  ["canopy-split", "Canopy Split", "#17744c"],
  ["orchard-mosaic", "Orchard Mosaic", "#945026"],
  ["horizon-command", "Horizon Command", "#1b6287"],
  ["field-atlas", "Field Atlas", "#435fad"],
  ["harvest-magazine", "Harvest Magazine", "#986724"],
  ["agro-glass-tower", "Agro Glass Tower", "#446e73"],
  ["sunrise-canvas", "Sunrise Canvas", "#ae522c"],
  ["command-dock", "Command Dock", "#2463eb"],
  ["greenhouse-panorama", "Greenhouse Panorama", "#2f7d68"],
] as const;
export const themeAliases: Record<string, (typeof themes)[number][0]> = {
  reference: "reference-v3", canopy: "canopy-split", orchard: "orchard-mosaic",
  horizon: "horizon-command", atlas: "field-atlas", harvest: "harvest-magazine",
  glass: "agro-glass-tower", sunrise: "sunrise-canvas", dock: "command-dock",
  pulse: "greenhouse-panorama",
};
export const canonicalThemeId = (value: string) =>
  themes.some(([id]) => id === value) ? value as (typeof themes)[number][0] : themeAliases[value] || "reference-v3";
export const themeCssAlias: Record<(typeof themes)[number][0], string> = {
  "reference-v3": "reference", "canopy-split": "canopy", "orchard-mosaic": "orchard",
  "horizon-command": "horizon", "field-atlas": "atlas", "harvest-magazine": "harvest",
  "agro-glass-tower": "glass", "sunrise-canvas": "sunrise", "command-dock": "dock",
  "greenhouse-panorama": "pulse",
};
export const sampleNotifications = [
  {
    id: "n1",
    page: "eggs",
    title: "Collection Ready For Review",
    detail: "House A · Morning collection · Sample record EC-041",
    time: "09:42 AM",
    priority: "Review",
    read: false,
  },
  {
    id: "n2",
    page: "vaccinations",
    title: "Upcoming Scheduled Vaccination",
    detail: "Sample flock FL-002 · Confirm schedule and evidence",
    time: "08:15 AM",
    priority: "Upcoming",
    read: false,
  },
  {
    id: "n3",
    page: "finance",
    title: "Ledger Evidence Requested",
    detail: "Sample transaction TX-108 · Supporting document needed",
    time: "Yesterday",
    priority: "Review",
    read: false,
  },
  {
    id: "n4",
    page: "leave",
    title: "Leave Request Updated",
    detail: "Your sample request is awaiting a decision.",
    time: "Yesterday",
    priority: "Personal",
    read: true,
  },
  {
    id: "n5",
    page: "knowledge",
    title: "A Guide For Your Workday",
    detail: "Daily record quality · Read the sample guide",
    time: "Monday",
    priority: "Learning",
    read: true,
  },
];
export const chartData = [
  { day: "Mon", eggs: 3310, feed: 460, income: 420, expense: 285 },
  { day: "Tue", eggs: 3405, feed: 475, income: 465, expense: 310 },
  { day: "Wed", eggs: 3360, feed: 462, income: 445, expense: 275 },
  { day: "Thu", eggs: 3550, feed: 490, income: 520, expense: 325 },
  { day: "Fri", eggs: 3612, feed: 480, income: 560, expense: 310 },
  { day: "Sat", eggs: 3500, feed: 476, income: 485, expense: 295 },
  { day: "Sun", eggs: 3690, feed: 488, income: 580, expense: 335 },
];
export const stateOptions = [
  "ready",
  "loading",
  "empty",
  "partial",
  "stale",
  "offline",
  "provider-unavailable",
  "api-error",
  "validation-failure",
  "session-expired",
  "permission-denied",
  "unauthorized-farm",
  "syncing",
  "sync-failure",
  "success",
];
export const authStates = [
  "default",
  "loading",
  "invalid",
  "provider-unavailable",
  "network-failure",
  "session-failure",
  "restricted",
  "verification",
  "temporary-password",
  "success",
];
let roleRevision = 0;
const roleListeners = new Set<() => void>();
export const subscribeRoles = (listener: () => void) => {
  roleListeners.add(listener);
  return () => {
    roleListeners.delete(listener);
  };
};
export const getRoleRevision = () => roleRevision;
export function saveReviewRole(
  actor: Persona,
  id: string,
  name: string,
  permissions: string[],
) {
  if (actor.principalSource === "authenticated" || actor.id !== "owner" || !has(actor, "roles.manage"))
    throw new Error("Action unavailable");
  if (id === "review-role-owner")
    throw new Error("The Owner role is protected");
  if (!name.trim() || permissions.some((p) => !permissionCatalog.includes(p)))
    throw new Error("Invalid role definition");
  const existing = reviewRoles.find((r) => r.id === id);
  if (existing) {
    existing.name = name.trim();
    existing.permissions = [...new Set(permissions)];
  } else
    reviewRoles.push({
      id,
      name: name.trim(),
      permissions: [...new Set(permissions)],
    });
  roleRevision++;
  roleListeners.forEach((f) => f());
}
export function assignReviewRoles(
  actor: Persona,
  subjectId: string,
  roleIds: string[],
) {
  if (
    actor.principalSource === "authenticated" ||
    actor.id !== "owner" ||
    !has(actor, "roles.manage") ||
    subjectId === "owner"
  )
    throw new Error("Action unavailable");
  if (
    !personas.some((p) => p.id === subjectId) ||
    roleIds.some(
      (id) =>
        !reviewRoles.some((r) => r.id === id) || id === "review-role-owner",
    )
  )
    throw new Error("Invalid assignment");
  assignedRoles[subjectId] = [...new Set(roleIds)];
  roleRevision++;
  roleListeners.forEach((f) => f());
}
