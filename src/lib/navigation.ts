export interface NavLeaf {
  id: string;
  title: string;
  badgeCount?: number;
  badgeVariant?: 'urgent' | 'warning' | 'info';
  description: string;
  permission: string;
}

export interface NavModule {
  id: string;
  title: string;
  iconName: string;
  leaves: NavLeaf[];
}

export interface NavGroup {
  id: string;
  title: string;          // Concise, professional, executive ERP directorate name
  shortCode: string;      // 3-char badge for compact rail
  iconName: string;
  description: string;
  modules: NavModule[];
}

// Enterprise Agribusiness ERP Navigation Directory
// Simpler, concise, professional directorates with high coverage across all 716+ operational capabilities
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'command-center',
    title: 'Command Center',
    shortCode: 'CMD',
    iconName: 'LayoutDashboard',
    description: 'Executive situation room, shift muster, morning brief, and urgent owner sign-offs',
    modules: [
      {
        id: 'cmd-executive',
        title: 'Executive Oversight',
        iconName: 'LayoutDashboard',
        leaves: [
          { id: 'dashboard', title: 'Situation Room', description: 'Real-time operational pulse, dual Lagos/NY time, and cash bridge', permission: 'dashboard.view' },
          { id: 'owner-decisions', title: 'Decision Queue', badgeCount: 5, badgeVariant: 'urgent', description: 'CapEx approvals, bio-variance sign-offs, and critical gate overrides', permission: 'admin.view' },
          { id: 'daily-brief', title: 'Daily Brief', description: 'Morning executive muster, weather alerts, and shift handovers', permission: 'dashboard.view' },
          { id: 'myday', title: 'My Day Desk', description: 'Field attendant muster, assigned tasks, and shift logs', permission: 'myday.view' },
          { id: 'bulletins', title: 'Bulletins & Alerts', badgeCount: 8, badgeVariant: 'info', description: 'Biosecurity alerts, staff announcements, and system alerts', permission: 'notifications.view' },
        ],
      },
    ],
  },
  {
    id: 'sales-orders',
    title: 'Sales & Orders',
    shortCode: 'ORD',
    iconName: 'BadgePercent',
    description: 'Wholesale customer orders, stock allocation, dispatch bay, pricing, and gate passes',
    modules: [
      {
        id: 'sales-core',
        title: 'Customer Orders & Sales',
        iconName: 'BadgePercent',
        leaves: [
          { id: 'orders', title: 'Customer Orders', badgeCount: 14, badgeVariant: 'urgent', description: 'Active wholesale egg orders, stock reservation, and fulfillment queue', permission: 'sales.view' },
          { id: 'order-create', title: 'New Customer Order', description: 'Fast guided wholesale order entry, customer pricing, and credit checks', permission: 'sales.edit' },
          { id: 'dispatch', title: 'Dispatch & Waybills', badgeCount: 6, badgeVariant: 'warning', description: 'Loading bays, digital waybills, vehicle passes, and security checks', permission: 'sales.view' },
          { id: 'customers', title: 'Wholesale Clients', description: 'Distributor directory, credit limits, contracts, and payment history', permission: 'sales.view' },
          { id: 'pricing-catalog', title: 'Price Schedules', description: 'Wholesale egg crate rates, cull bird pricing, and volume discounts', permission: 'sales.view' },
          { id: 'point-of-sale', title: 'Gate POS Retail', description: 'Direct farm gate cash/transfer retail collections and receipts', permission: 'sales.edit' },
        ],
      },
    ],
  },
  {
    id: 'flocks-housing',
    title: 'Flocks & Housing',
    shortCode: 'FLK',
    iconName: 'Bird',
    description: 'Flock cohorts, pen houses, 7-column daily registers, cage density, and breed benchmarks',
    modules: [
      {
        id: 'flock-management',
        title: 'Cohorts & Housing',
        iconName: 'Bird',
        leaves: [
          { id: 'flocks', title: 'Flock Batches', description: 'Active layer and broiler cohorts across all houses', permission: 'inventory.view' },
          { id: 'flock-add', title: 'Add Flock Intake', description: 'Benchmark 5-step guided chick placement flow', permission: 'inventory.edit' },
          { id: 'daily-register', title: 'Daily Pen Register', badgeCount: 7, badgeVariant: 'warning', description: '7-column ledger: Age, Opening, Mortality, Culls, Feed, Eggs, Closing', permission: 'operations.edit' },
          { id: 'houses', title: 'Houses & Battery Cages', description: 'Pen infrastructure, cage capacity, drinkers, and stocking density', permission: 'operations.view' },
          { id: 'weight-sampling', title: 'Weight Sampling', description: 'Weekly pullet body weight uniformity and CV% tracking', permission: 'operations.view' },
          { id: 'lighting-program', title: 'Lighting & Photoperiod', description: 'Automated light stimulation lux and daylight schedules', permission: 'operations.view' },
          { id: 'breed-benchmarks', title: 'Breed Standards', description: 'ISA Brown and Bovans White standard genetic performance curves', permission: 'inventory.view' },
        ],
      },
    ],
  },
  {
    id: 'egg-production',
    title: 'Egg Production',
    shortCode: 'EGG',
    iconName: 'Egg',
    description: 'Shift collection tallies, grading, crated tray packaging, cold storage, and reconciliation',
    modules: [
      {
        id: 'egg-operations',
        title: 'Collections & Cold Room',
        iconName: 'Egg',
        leaves: [
          { id: 'eggs', title: 'Egg Room & Cold Storage', badgeCount: 3, badgeVariant: 'info', description: 'Stock held in standardized 30-egg crated trays and master cartons', permission: 'inventory.view' },
          { id: 'egg-collections', title: 'Shift Collections', description: 'Morning and afternoon collection tallies by pen house', permission: 'inventory.view' },
          { id: 'egg-grading', title: 'Grading & Sizing', description: 'Jumbo, Large, Medium grading, weight sorting, and reject tallies', permission: 'inventory.view' },
          { id: 'egg-reconciliation', title: 'Egg Reconciliation', badgeCount: 2, badgeVariant: 'warning', description: 'Reconciling shift house collections against cold storage packing slips', permission: 'operations.edit' },
        ],
      },
    ],
  },
  {
    id: 'feed-milling',
    title: 'Feed & Milling',
    shortCode: 'FED',
    iconName: 'Wheat',
    description: 'Bulk grain intake, nutrition formulation, least-cost batch milling, and silo inventory',
    modules: [
      {
        id: 'milling-silos',
        title: 'Feed Mill & Silos',
        iconName: 'Wheat',
        leaves: [
          { id: 'feed', title: 'Feed Mill & Silos', badgeCount: 4, badgeVariant: 'info', description: 'Grain silos, batch milling production, and 50kg bag staging', permission: 'inventory.view' },
          { id: 'feed-formulas', title: 'Formulation Recipes', description: 'Least-cost nutritional recipes and ingredient balance ratios', permission: 'inventory.view' },
          { id: 'feed-silos', title: 'Grain Silo Capacities', badgeCount: 2, badgeVariant: 'warning', description: 'Yellow maize, soya meal, and wheat offal stock runways', permission: 'inventory.view' },
          { id: 'feed-quality', title: 'Quality & Lab Tests', description: 'Moisture, aflatoxin testing, and silo discharge clearance', permission: 'inventory.edit' },
          { id: 'feed-consumption', title: 'Consumption Tracking', description: 'House feed allocations, intake per bird (g/day), and wastage logs', permission: 'inventory.view' },
        ],
      },
    ],
  },
  {
    id: 'health-veterinary',
    title: 'Health & Veterinary',
    shortCode: 'VET',
    iconName: 'Syringe',
    description: 'Clinical rounds, vaccination schedules, necropsy pathology, and pharmacy cold-chain',
    modules: [
      {
        id: 'veterinary-core',
        title: 'Clinical Care & Biosecurity',
        iconName: 'Syringe',
        leaves: [
          { id: 'health', title: 'Clinical Rounds', description: 'Daily pen inspections, morbidity notes, and veterinarian observations', permission: 'health.view' },
          { id: 'vaccinations', title: 'Vaccine Planner', badgeCount: 3, badgeVariant: 'urgent', description: 'Scheduled inoculations, administration logs, and withdrawal windows', permission: 'health.view' },
          { id: 'mortality', title: 'Mortality Forensics', badgeCount: 1, badgeVariant: 'urgent', description: 'Post-mortem necropsy records, photos, and threshold alarms', permission: 'health.view' },
          { id: 'pharmacy', title: 'Pharmacy & Cold-Chain', description: 'Refrigerated vaccines, antibiotics, vitamins, and expiry dates', permission: 'inventory.view' },
          { id: 'biosecurity', title: 'Biosecurity Perimeter', description: 'Perimeter footbaths, vehicle tire sprays, and sanitation logs', permission: 'security.view' },
          { id: 'water-sanitation', title: 'Water Quality & Chlorine', description: 'Borehole chlorination levels, pH checks, and line flushing', permission: 'health.view' },
        ],
      },
    ],
  },
  {
    id: 'hatchery-incubation',
    title: 'Hatchery & Brooding',
    shortCode: 'HAT',
    iconName: 'Egg',
    description: 'Setter machines, egg candling, hatcher takeoff, chick sexing, and brooding units',
    modules: [
      {
        id: 'hatchery-ops',
        title: 'Incubation & Hatching',
        iconName: 'Egg',
        leaves: [
          { id: 'hatchery-setters', title: 'Setter Machines', description: 'Setter trays, turning angles, temperature, and humidity sensors', permission: 'operations.view' },
          { id: 'hatchery-candling', title: 'Candling & Fertility', description: 'Day 18 candling fertility checks and infertile egg removal', permission: 'operations.view' },
          { id: 'hatchery-takeoff', title: 'Hatcher Takeoff', description: 'Day-old chick (DOC) takeoff tallies, hatchability %, and grading', permission: 'operations.view' },
          { id: 'brooding-units', title: 'Brooding Chambers', description: 'Gas brooders, ambient temperature curves, and chick paper bedding', permission: 'operations.view' },
        ],
      },
    ],
  },
  {
    id: 'inventory-stores',
    title: 'Inventory & Stores',
    shortCode: 'INV',
    iconName: 'Boxes',
    description: 'Central farm warehouse, packaging supplies, diesel tanks, and stock audits',
    modules: [
      {
        id: 'stores-management',
        title: 'Warehouse & Materials',
        iconName: 'Boxes',
        leaves: [
          { id: 'inventory', title: 'Stock Observatory', description: 'Standard egg crates, master cartons, wood shavings, and spares', permission: 'inventory.view' },
          { id: 'stock-movements', title: 'Material Transfers', description: 'Store issues, pen requisitions, and inter-facility stock movements', permission: 'inventory.edit' },
          { id: 'diesel-fuel', title: 'Diesel & Fuel Storage', badgeCount: 2, badgeVariant: 'warning', description: 'Bulk diesel tank levels, generator dips, and consumption logs', permission: 'inventory.view' },
          { id: 'cycle-counts', title: 'Stock Audits & Count', description: 'Periodic physical inventory verification and variance adjustments', permission: 'inventory.edit' },
        ],
      },
    ],
  },
  {
    id: 'purchasing-vendors',
    title: 'Purchasing & Vendors',
    shortCode: 'PUR',
    iconName: 'ShoppingCart',
    description: 'Purchase requisitions, vendor quote comparisons, purchase orders, and goods receipts',
    modules: [
      {
        id: 'procurement-core',
        title: 'Purchasing Pipeline',
        iconName: 'ShoppingCart',
        leaves: [
          { id: 'procurement', title: 'Purchase Requisitions', badgeCount: 6, badgeVariant: 'info', description: 'Departmental purchase requests, budget approvals, and sign-offs', permission: 'procurement.view' },
          { id: 'purchase-orders', title: 'Purchase Orders', badgeCount: 4, badgeVariant: 'warning', description: 'Official supplier POs and 3-way matching against Goods Receipts', permission: 'procurement.edit' },
          { id: 'goods-receipts', title: 'Goods Receipt (GRN)', description: 'Gate intake weight bridge inspection and warehouse acceptance', permission: 'procurement.edit' },
          { id: 'suppliers', title: 'Vendor Directory', description: 'Hatchery ratings, grain supplier contracts, and credit terms', permission: 'procurement.view' },
        ],
      },
    ],
  },
  {
    id: 'finance-banking',
    title: 'Finance & Banking',
    shortCode: 'FIN',
    iconName: 'Landmark',
    description: 'Corporate bank feeds, Monnify collections, 3-way bank reconciliation, and cash liquidity',
    modules: [
      {
        id: 'treasury-banking',
        title: 'Banking & Cash Flow',
        iconName: 'Landmark',
        leaves: [
          { id: 'treasury', title: 'Treasury & Bank Feeds', description: 'Multi-bank balances (Providus, Zenith, GTB) and real-time liquidity', permission: 'finance.view' },
          { id: 'collections', title: 'Customer Collections', badgeCount: 9, badgeVariant: 'urgent', description: 'Monnify virtual accounts, direct NIP credits, and cashier desk', permission: 'finance.view' },
          { id: 'reconciliation', title: '3-Way Reconciliation', badgeCount: 5, badgeVariant: 'warning', description: 'Matching customer orders against verified bank credit statements', permission: 'finance.edit' },
          { id: 'expenses', title: 'Expense Vouchers', badgeCount: 8, badgeVariant: 'info', description: 'Farm operational expense petty cash and vendor disbursement vouchers', permission: 'finance.view' },
          { id: 'general-ledger', title: 'General Ledger', description: 'Double-entry agricultural accounting chart of accounts', permission: 'finance.view' },
        ],
      },
    ],
  },
  {
    id: 'human-resources',
    title: 'Human Resources',
    shortCode: 'HR',
    iconName: 'Users',
    description: 'Staff directory, biometric attendance clock, statutory taxes (PAYE), and payroll platform',
    modules: [
      {
        id: 'hr-workforce',
        title: 'Workforce & Payroll',
        iconName: 'Users',
        leaves: [
          { id: 'payroll', title: 'Payroll Platform', badgeCount: 1, badgeVariant: 'urgent', description: 'Monthly salaried, casual staff, and NIP direct deposit schedule', permission: 'payroll.view' },
          { id: 'employees', title: 'Staff Directory', description: 'Active employees, duty stations, emergency contacts, and files', permission: 'employees.view' },
          { id: 'attendance', title: 'Biometric Time Clock', badgeCount: 4, badgeVariant: 'warning', description: 'Shift muster, fingerprint clock-in logs, and overtime tracking', permission: 'attendance.view' },
          { id: 'leave', title: 'Leave Requests', badgeCount: 3, badgeVariant: 'info', description: 'Annual, sick, and compassionate leave requests and approvals', permission: 'leave.view' },
          { id: 'statutory', title: 'Statutory Remittances', description: 'Osun State PAYE tax, Pension (8/10%), NHF, and ITF compliance', permission: 'payroll.view' },
          { id: 'payslips', title: 'Verified Payslips', description: 'Digital employee payslips with security verification codes', permission: 'payslips.view' },
        ],
      },
    ],
  },
  {
    id: 'projects-assets',
    title: 'Projects & Assets',
    shortCode: 'ENG',
    iconName: 'HardHat',
    description: 'Balogun-Ikire civil expansion, BOQ takeoffs, Perkins diesel generators, and delivery fleet',
    modules: [
      {
        id: 'engineering-assets',
        title: 'Construction & Fleet',
        iconName: 'HardHat',
        leaves: [
          { id: 'construction', title: 'Site Construction', badgeCount: 2, badgeVariant: 'info', description: 'Layer house 4 expansion, site diary, and progress milestones', permission: 'construction.view' },
          { id: 'boq', title: 'Bill of Quantities (BOQ)', description: 'Structural steel, cement bags, granite, roofing, and contractor drawdowns', permission: 'construction.view' },
          { id: 'equipment', title: 'Generators & Machinery', description: 'Perkins 250kVA generator runtime hours, maintenance schedules, and spares', permission: 'equipment.view' },
          { id: 'fleet', title: 'Distribution Fleet', description: 'Egg delivery vans, feed tipper trucks, maintenance, and fuel logs', permission: 'tracking.view' },
        ],
      },
    ],
  },
  {
    id: 'reports-analytics',
    title: 'Reports & Analytics',
    shortCode: 'REP',
    iconName: 'TrendingUp',
    description: 'Hen-Day Production (HDEP), Feed Conversion Ratio (FCR), mortality forensics, and P&L',
    modules: [
      {
        id: 'analytics-core',
        title: 'Intelligence & Audits',
        iconName: 'TrendingUp',
        leaves: [
          { id: 'flock-performance', title: 'Egg Laying Curves', description: 'Hen-Day Egg Production % compared against genetic breed benchmarks', permission: 'reports.view' },
          { id: 'fcr-analytics', title: 'Feed Efficiency (FCR)', description: 'Feed intake (kg) consumed per crate of eggs produced', permission: 'reports.view' },
          { id: 'mortality-reports', title: 'Mortality Analytics', description: 'Cumulative mortality trends, house comparisons, and risk flags', permission: 'reports.view' },
          { id: 'profit', title: 'Commercial P&L', description: 'Gross margins, feed cost ratio, and net profit per crate', permission: 'finance.view' },
          { id: 'regulatory-audit', title: 'Regulatory & NAQS', description: 'Nigerian Agricultural Quarantine Service and environmental audit packs', permission: 'reports.view' },
        ],
      },
    ],
  },
  {
    id: 'administration-studio',
    title: 'Admin & Governance',
    shortCode: 'ADM',
    iconName: 'ShieldCheck',
    description: 'Provisional users (48h), dynamic role permissions, master data control, and audit logs',
    modules: [
      {
        id: 'admin-governance',
        title: 'Security & Control',
        iconName: 'ShieldCheck',
        leaves: [
          { id: 'rbac', title: 'Roles & Permissions', description: 'Create custom roles, assign granular permissions, and scope authority', permission: 'admin.view' },
          { id: 'signup-admin', title: 'Provisional Users (48h)', badgeCount: 3, badgeVariant: 'urgent', description: 'Review new employee sign-ups, approve access, or extend holding window', permission: 'admin.view' },
          { id: 'master-data', title: 'Master Data Governance', description: 'Breeds, feed raw ingredients, units of measure, and account charts', permission: 'admin.view' },
          { id: 'audit', title: 'Forensic Audit Ledger', description: 'Tamper-evident system activity log with exact seconds and before/after diffs', permission: 'audit.view' },
          { id: 'security', title: 'Security & Gate Pass', description: 'Perimeter surveillance, CCTV feeds, and security checkpoint logs', permission: 'security.view' },
          { id: 'studio', title: 'Portal Studio CMS', description: 'Visual gateway layout, brand identity customizer, and theme settings', permission: 'settings.view' },
          { id: 'diagnostics', title: 'Edge & Cloud Health', description: 'Cloudflare Workers latency, D1 query health, and offline probers', permission: 'diagnostics.view' },
        ],
      },
    ],
  },
];
