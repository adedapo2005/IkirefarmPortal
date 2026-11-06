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

export interface NavDivision {
  id: string;
  title: string;          // Elaborated Professional Nigerian Operational Name
  shortCode: string;      // 2-3 char badge for compact mode
  iconName: string;
  description: string;
  modules: NavModule[];
}

// 10-Division Operational Architecture (Expanded, Disambiguated & Professional Nigerian Terminology)
export const NAV_DIVISIONS: NavDivision[] = [
  {
    id: 'executive-command',
    title: 'Executive Situation Room & Daily Command',
    shortCode: 'CMD',
    iconName: 'LayoutDashboard',
    description: 'Corporate farm situation room, operational signals, daily shift brief, and executive decisions',
    modules: [
      {
        id: 'command-core',
        title: 'Command Workspaces',
        iconName: 'LayoutDashboard',
        leaves: [
          { id: 'dashboard', title: 'Farm Situation Room', description: 'Enterprise executive overview and urgent decisions', permission: 'dashboard.view' },
          { id: 'daily-brief', title: 'Daily Operational Brief', description: 'Morning shift muster, weather impact, and attention queue', permission: 'dashboard.view' },
          { id: 'owner-decisions', title: 'Executive Decision Queue', badgeCount: 3, badgeVariant: 'urgent', description: 'CapEx requisitions, biological variance sign-offs, and approvals', permission: 'admin.view' },
          { id: 'myday', title: 'Shift Muster & My Day', description: 'Field attendant shift muster, personal tasks, and safety announcements', permission: 'myday.view' },
          { id: 'notifications', title: 'Operational Bulletins & Alerts', badgeCount: 4, badgeVariant: 'info', description: 'Critical biosecurity alerts, shift handovers, and system notices', permission: 'notifications.view' },
        ],
      },
    ],
  },
  {
    id: 'flock-lifecycle',
    title: 'Poultry Flocks & Pen Infrastructure',
    shortCode: 'FLK',
    iconName: 'Bird',
    description: 'Flock placement, biological cohort lifecycle, battery cages, and daily shift pen registers',
    modules: [
      {
        id: 'flock-operations',
        title: 'Flock Lifecycle Management',
        iconName: 'Bird',
        leaves: [
          { id: 'flocks', title: 'Flocks Register & Performance', description: 'Lifecycle cohorts from day-old chick placement to end-of-lay depopulation', permission: 'inventory.view' },
          { id: 'flock-add', title: 'Add New Flock Intake', description: 'Benchmark 5-step guided placement, stocking density, and health protocol', permission: 'inventory.edit' },
          { id: 'flock-transfers', title: 'Pen & Flock Transfers', description: 'Controlled bird movement, cage restock, and headcount balance attestation', permission: 'inventory.edit' },
          { id: 'breed-management', title: 'Poultry Breeds & Genetic Standards', description: 'ISA Brown, Bovans White, Lohmann performance target curves', permission: 'inventory.view' },
        ],
      },
      {
        id: 'pen-facilities',
        title: 'Pen Housing & Physical Assets',
        iconName: 'HardHat',
        leaves: [
          { id: 'houses', title: 'Houses, Battery Pens & Silos', description: 'Capacity thresholds, automated drinker lines, and ventilation probers', permission: 'operations.view' },
          { id: 'daily-register', title: '7-Column Daily Pen Register', badgeCount: 2, badgeVariant: 'warning', description: 'Age, Opening Stock, Mortality, Medication, Vaccine, Feed Intake, Closing Stock', permission: 'operations.edit' },
        ],
      },
    ],
  },
  {
    id: 'egg-production',
    title: 'Egg Room, Grading & Packing Operations',
    shortCode: 'EGG',
    iconName: 'Egg',
    description: 'Daily collection tallies, mechanical grading, crate packaging, and cold room stock reconciliation',
    modules: [
      {
        id: 'egg-handling',
        title: 'Egg Room Management',
        iconName: 'Egg',
        leaves: [
          { id: 'eggs', title: 'Daily Egg Collection & Shift Tally', description: 'Morning, midday, evening rounds, grading, and leaker accounting', permission: 'inventory.view' },
          { id: 'egg-grading', title: 'Egg Grading & Quality Sorting', description: 'Jumbo, Large, Medium grading standards and shell integrity inspection', permission: 'inventory.view' },
          { id: 'egg-coldroom', title: 'Crated Egg Inventory & Cold Room', description: 'Stock held in standardized 30-egg crated trays and master cartons', permission: 'inventory.view' },
          { id: 'egg-reconciliation', title: 'Shift Egg Balance Reconciliation', description: 'Reconciling daily collection totals against warehouse packing slips', permission: 'operations.edit' },
        ],
      },
    ],
  },
  {
    id: 'feed-milling',
    title: 'Feed Mill & Nutritional Manufacturing',
    shortCode: 'FED',
    iconName: 'Wheat',
    description: 'Grain intake, versioned formulation, least-cost batch milling, and silo inventory',
    modules: [
      {
        id: 'feed-processing',
        title: 'Feed Mill Operations',
        iconName: 'Wheat',
        leaves: [
          { id: 'feed', title: 'Feed Mill Batching & Production', description: 'Milling Starter, Grower, and Layer Mash with weighing verification', permission: 'inventory.view' },
          { id: 'feed-formulas', title: 'Least-Cost Feed Formulations', description: 'Protein, lysine, calcium nutritional profiles and raw grain balance', permission: 'inventory.view' },
          { id: 'feed-silos', title: 'Grain Silos & Bulk Storage Runway', description: 'Yellow maize, soya meal, wheat offal silo capacities and days remaining', permission: 'inventory.view' },
          { id: 'feed-quality', title: 'Quality Assurance & Silo Release', description: 'Moisture, aflatoxin testing, and lab clearance before flock discharge', permission: 'inventory.edit' },
        ],
      },
    ],
  },
  {
    id: 'health-biosecurity',
    title: 'Clinical Veterinary & Biosecurity Defense',
    shortCode: 'VET',
    iconName: 'Syringe',
    description: 'Necropsy forensics, vaccination schedules, pharmaceutical pharmacy, and quarantine perimeter',
    modules: [
      {
        id: 'clinical-veterinary',
        title: 'Poultry Clinical Desk',
        iconName: 'Syringe',
        leaves: [
          { id: 'health', title: 'Clinical Health Observations', description: 'Daily pen morbidity, respiratory symptoms, and post-mortem notes', permission: 'health.view' },
          { id: 'vaccinations', title: 'Vaccination Schedules & Records', description: 'Gumboro, Lasota, Marek vaccine tracking and withdrawal windows', permission: 'health.view' },
          { id: 'mortality', title: 'Mortality & Necropsy Forensics', badgeCount: 1, badgeVariant: 'urgent', description: 'Threshold breach alarms (>0.15%), autopsy photos, and lab samples', permission: 'health.view' },
          { id: 'pharmacy', title: 'Veterinary Pharmacy & Cold Chain', description: 'Refrigerated vaccines, antibiotics, vitamins, and expiration control', permission: 'inventory.view' },
        ],
      },
      {
        id: 'perimeter-defense',
        title: 'Biosecurity Protocols',
        iconName: 'Shield',
        leaves: [
          { id: 'biosecurity', title: 'Perimeter Biosecurity Defense', description: 'Vehicle tire bath chemical logs, visitor logs, and foot dip inspection', permission: 'security.view' },
          { id: 'quarantine', title: 'Quarantine & Isolation Pens', description: 'Holding facilities for sick or newly introduced poultry stock', permission: 'security.view' },
        ],
      },
    ],
  },
  {
    id: 'inventory-procurement',
    title: 'Inventory, Equipment & Sourcing Logistics',
    shortCode: 'INV',
    iconName: 'Boxes',
    description: 'General warehouse supplies, 3-way GRN, purchase orders, machinery, and fleet vehicles',
    modules: [
      {
        id: 'warehouse-sourcing',
        title: 'Warehouse & Procurement',
        iconName: 'Boxes',
        leaves: [
          { id: 'inventory', title: 'Warehouse Stock Observatory', description: 'Egg crates, packaging cartons, bedding, generator diesel, and spares', permission: 'inventory.view' },
          { id: 'procurement', title: 'Purchase Requisitions & RFQs', badgeCount: 2, badgeVariant: 'info', description: 'Competitive vendor quote sheets, pricing comparisons, and approvals', permission: 'procurement.view' },
          { id: 'purchase-orders', title: 'Purchase Orders & 3-Way GRN', description: 'Matching PO, Delivery Note, and Gate Goods Receipt Note (GRN)', permission: 'procurement.edit' },
          { id: 'suppliers', title: 'Suppliers & Hatcheries Directory', description: 'Hatchery ratings, raw ingredient suppliers, and payment terms', permission: 'procurement.view' },
        ],
      },
      {
        id: 'farm-machinery',
        title: 'Machinery & Fleet Logistics',
        iconName: 'Truck',
        leaves: [
          { id: 'equipment', title: 'Generators & Farm Equipment', description: 'Diesel generator runtime hours, maintenance schedules, and spares', permission: 'equipment.view' },
          { id: 'fleet', title: 'Logistics Trucks & Farm Fleet', description: 'Egg distribution vans, feed delivery tippers, and GPS route status', permission: 'tracking.view' },
        ],
      },
    ],
  },
  {
    id: 'commercial-finance',
    title: 'Commercial Sales, Orders & Nigerian Banking',
    shortCode: 'FIN',
    iconName: 'Landmark',
    description: 'Wholesale distributor sales, vehicle waybills, bank feeds, collections, and treasury',
    modules: [
      {
        id: 'commercial-sales',
        title: 'Wholesale Commerce',
        iconName: 'BadgePercent',
        leaves: [
          { id: 'customers', title: 'Wholesale Distributors & Off-takers', description: 'Customer credit limits, wholesale pricing tiers, and contact directory', permission: 'sales.view' },
          { id: 'orders', title: 'Customer Orders & Order-to-Cash', description: 'Stock reservations, invoice generation, and commercial fulfillment', permission: 'sales.view' },
          { id: 'dispatch', title: 'Dispatch Bays & Gate Exit Passes', description: 'Digital waybills, vehicle crate loading inspection, and gate releases', permission: 'sales.view' },
        ],
      },
      {
        id: 'banking-treasury',
        title: 'Banking & Treasury Observatory',
        iconName: 'Landmark',
        leaves: [
          { id: 'banking', title: 'Nigerian Corporate Bank Feeds', description: 'Providus, Zenith, GTB, Access balances and real-time transaction statements', permission: 'finance.view' },
          { id: 'collections', title: 'Customer Collections & Virtual Accounts', description: 'Monnify virtual accounts, direct NIP match, and cashier desk', permission: 'finance.view' },
          { id: 'reconciliation', title: 'Automated 3-Way Bank Reconciliation', description: 'Reconciling wholesale sales orders against confirmed bank credit alerts', permission: 'finance.edit' },
          { id: 'expenses', title: 'Operational Expense Vouchers', description: 'Field reimbursement claims, fuel receipts, and maker-checker sign-off', permission: 'finance.view' },
          { id: 'treasury', title: 'Treasury Command & Cash Bridge', description: '24-hour corporate liquidity bridge and 30-day CapEx forecasting', permission: 'finance.view' },
        ],
      },
    ],
  },
  {
    id: 'people-compensation',
    title: 'Workforce Operations & Enterprise Payroll',
    shortCode: 'HR',
    iconName: 'Users',
    description: 'Employee personnel directory, biometric attendance, statutory deductions, and payroll disbursement',
    modules: [
      {
        id: 'workforce-management',
        title: 'Workforce Operations',
        iconName: 'Users',
        leaves: [
          { id: 'employees', title: 'Personnel Directory & Staff Profiles', description: 'Active employees, farm station assignments, supervisors, and emergency contacts', permission: 'employees.view' },
          { id: 'attendance', title: 'Shift Attendance & Time Clock', description: 'Biometric time clock muster, shift rotations, and overtime hours', permission: 'attendance.view' },
          { id: 'leave', title: 'Leave & Absence Management', description: 'Annual, sick, compassionate leave requests and entitlement balances', permission: 'leave.view' },
          { id: 'recruitment', title: 'Recruitment & Onboarding Invitations', description: 'Job applications, candidate interviewing, and employee onboarding', permission: 'recruitment.view' },
        ],
      },
      {
        id: 'enterprise-payroll',
        title: 'Payroll & Compensation Platform',
        iconName: 'Wallet',
        leaves: [
          { id: 'payroll', title: 'Payroll Command Center', description: 'Monthly salaried, weekly casual, and piece-rate compensation runs', permission: 'payroll.view' },
          { id: 'statutory', title: 'Nigerian Statutory Taxes & Pensions', description: 'State PAYE graded brackets, Pension (8/10%), NHF (2.5%), and ITF tables', permission: 'payroll.view' },
          { id: 'loans', title: 'Staff Salary Advances & Emergency Loans', description: 'Loan disbursement approvals and automated payroll net pay amortization', permission: 'loans.view' },
          { id: 'payslips', title: 'Cryptographic Verified Payslips', description: 'Secure digital PDF payslips with QR code verification hashes', permission: 'payslips.view' },
        ],
      },
    ],
  },
  {
    id: 'capital-projects',
    title: 'Capital Construction & Facility Engineering',
    shortCode: 'ENG',
    iconName: 'HardHat',
    description: 'Balogun-Ikire layer house expansions, grain silos civil works, BOQ tracking, and contractors',
    modules: [
      {
        id: 'construction-intelligence',
        title: 'Construction ERP',
        iconName: 'HardHat',
        leaves: [
          { id: 'construction', title: 'Site Operations & Progress Logs', description: 'Active construction sites, daily engineer diaries, and weather delay logs', permission: 'construction.view' },
          { id: 'boq', title: 'Bill of Quantities (BOQ) & Takeoffs', description: 'Rebar steel, cement bags, granite, roofing sheets, and WBS budget tracking', permission: 'construction.view' },
          { id: 'materials', title: 'Site Materials & Delivery Testing', description: 'Concrete cube test reports, batch delivery testing, and consumption audit', permission: 'construction.view' },
          { id: 'contractors', title: 'Contractors & Valuation Certificates', description: 'Milestone completion claims, geotagged site photos, and interim payments', permission: 'construction.view' },
        ],
      },
    ],
  },
  {
    id: 'system-governance',
    title: 'Enterprise Governance, Audit & Studio',
    shortCode: 'ADM',
    iconName: 'ShieldCheck',
    description: 'Dynamic roles, 48h provisional user triage, immutable audit trail, cameras, and Portal Studio CMS',
    modules: [
      {
        id: 'governance-administration',
        title: 'Governance & Access Control',
        iconName: 'ShieldCheck',
        leaves: [
          { id: 'signup-admin', title: 'Provisional Account Control (48h)', badgeCount: 2, badgeVariant: 'urgent', description: '48-hour approval countdown, identity verification, and extension triage', permission: 'admin.view' },
          { id: 'rbac', title: 'Dynamic Roles & Permissions Studio', description: 'Create custom roles, assign granular permissions, and scope authority', permission: 'admin.view' },
          { id: 'master-data', title: 'Master Data Governance Center', description: 'Breeds, feed ingredients, units of measure, and expense chart of accounts', permission: 'admin.view' },
          { id: 'audit', title: 'Forensic Activity Ledger', description: 'Append-only event log with exact seconds, IP addresses, and before/after diffs', permission: 'audit.view' },
          { id: 'security', title: 'Security Perimeter & Camera Wall', description: 'CCTV probers with honest offline states and gate vehicle entry logs', permission: 'security.view' },
          { id: 'studio', title: 'FarmPortal Studio CMS', description: 'Sign-In gateway configuration and operational workspace visual editor', permission: 'settings.view' },
          { id: 'diagnostics', title: 'System Diagnostics & Edge Health', description: 'Cloudflare edge latency, D1 storage utilization, and service probers', permission: 'diagnostics.view' },
        ],
      },
    ],
  },
];
