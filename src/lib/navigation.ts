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
  title: string;          // Authoritative Stage 22 Canonical Group Title
  shortCode: string;      // Compact mode identifier
  iconName: string;
  description: string;
  modules: NavModule[];
}

// Canonical Stage 22 9-Group Operational Hierarchy (Preserving All 116 Core Routes)
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    title: 'Home',
    shortCode: 'HOM',
    iconName: 'LayoutDashboard',
    description: 'Executive situation room, shift muster, daily brief, and urgent action queues',
    modules: [
      {
        id: 'home-core',
        title: 'Command Workspaces',
        iconName: 'LayoutDashboard',
        leaves: [
          { id: 'dashboard', title: 'Farm Situation Room', description: 'Enterprise executive overview and urgent decisions', permission: 'dashboard.view' },
          { id: 'daily-brief', title: 'Daily Operational Brief', description: 'Morning shift muster, weather impact, and attention queue', permission: 'dashboard.view' },
          { id: 'owner-decisions', title: 'Executive Decision Queue', badgeCount: 3, badgeVariant: 'urgent', description: 'CapEx requisitions, biological variance sign-offs, and approvals', permission: 'admin.view' },
          { id: 'myday', title: 'Shift Muster & My Day', description: 'Field attendant shift muster, personal tasks, and safety announcements', permission: 'myday.view' },
          { id: 'notifications', title: 'Operational Bulletins & Alerts', badgeCount: 4, badgeVariant: 'info', description: 'Critical biosecurity alerts, shift handovers, and system notices', permission: 'notifications.view' },
          { id: 'profile', title: 'My Profile & Credentials', description: 'Employee identity, station assignments, and security settings', permission: 'profile.view' },
        ],
      },
    ],
  },
  {
    id: 'farm-work',
    title: 'Farm Work',
    shortCode: 'WRK',
    iconName: 'Bird',
    description: '7-column pen registers, flock cohorts, egg rooms, feed formulation, and veterinary health',
    modules: [
      {
        id: 'flock-lifecycle',
        title: 'Poultry Flocks & Pens',
        iconName: 'Bird',
        leaves: [
          { id: 'flocks', title: 'Flock Cohorts Register', description: 'Lifecycle cohorts from day-old chick placement to end-of-lay depopulation', permission: 'inventory.view' },
          { id: 'flock-add', title: 'Add New Flock Intake', description: 'Benchmark 5-step guided placement, stocking density, and health protocol', permission: 'inventory.edit' },
          { id: 'daily-register', title: '7-Column Daily Pen Register', badgeCount: 2, badgeVariant: 'warning', description: 'Age, Opening Stock, Mortality, Medication, Vaccine, Feed Intake, Closing Stock', permission: 'operations.edit' },
          { id: 'houses', title: 'Houses, Battery Pens & Silos', description: 'Capacity thresholds, automated drinker lines, and ventilation probers', permission: 'operations.view' },
          { id: 'flock-transfers', title: 'Pen & Flock Transfers', description: 'Controlled bird movement, cage restock, and headcount balance attestation', permission: 'inventory.edit' },
          { id: 'breed-management', title: 'Poultry Breeds & Genetic Standards', description: 'ISA Brown, Bovans White, Lohmann performance target curves', permission: 'inventory.view' },
        ],
      },
      {
        id: 'eggs-feed-clinical',
        title: 'Production, Feed & Health',
        iconName: 'Egg',
        leaves: [
          { id: 'eggs', title: 'Daily Egg Collection & Grading', description: 'Morning, midday, evening rounds, grading, and leaker accounting', permission: 'inventory.view' },
          { id: 'egg-coldroom', title: 'Crated Egg Inventory & Cold Room', description: 'Stock held in standardized 30-egg crated trays and master cartons', permission: 'inventory.view' },
          { id: 'feed', title: 'Feed Mill Batching & Milling', description: 'Milling Starter, Grower, and Layer Mash with weighing verification', permission: 'inventory.view' },
          { id: 'feed-silos', title: 'Grain Silos & Bulk Storage Runway', description: 'Yellow maize, soya meal, wheat offal silo capacities and days remaining', permission: 'inventory.view' },
          { id: 'health', title: 'Clinical Health Observations', description: 'Daily pen morbidity, respiratory symptoms, and post-mortem notes', permission: 'health.view' },
          { id: 'vaccinations', title: 'Vaccination Schedules & Records', description: 'Gumboro, Lasota, Marek vaccine tracking and withdrawal windows', permission: 'health.view' },
          { id: 'mortality', title: 'Mortality & Necropsy Forensics', badgeCount: 1, badgeVariant: 'urgent', description: 'Threshold breach alarms (>0.15%), autopsy photos, and lab samples', permission: 'health.view' },
          { id: 'biosecurity', title: 'Perimeter Biosecurity Defense', description: 'Vehicle tire bath chemical logs, visitor logs, and foot dip inspection', permission: 'security.view' },
        ],
      },
    ],
  },
  {
    id: 'stock-purchases',
    title: 'Stock & Purchases',
    shortCode: 'STK',
    iconName: 'Boxes',
    description: 'Central warehouse inventory, raw ingredients, supplier catalogs, and 3-way purchase orders',
    modules: [
      {
        id: 'inventory-sourcing',
        title: 'Inventory & Procurement',
        iconName: 'Boxes',
        leaves: [
          { id: 'inventory', title: 'Warehouse Stock Observatory', description: 'Egg crates, packaging cartons, bedding, generator diesel, and spares', permission: 'inventory.view' },
          { id: 'pharmacy', title: 'Veterinary Pharmacy & Cold Chain', description: 'Refrigerated vaccines, antibiotics, vitamins, and expiration control', permission: 'inventory.view' },
          { id: 'procurement', title: 'Purchase Requisitions & RFQs', badgeCount: 2, badgeVariant: 'info', description: 'Competitive vendor quote sheets, pricing comparisons, and approvals', permission: 'procurement.view' },
          { id: 'purchase-orders', title: 'Purchase Orders & 3-Way GRN', description: 'Matching PO, Delivery Note, and Gate Goods Receipt Note (GRN)', permission: 'procurement.edit' },
          { id: 'suppliers', title: 'Suppliers & Hatcheries Directory', description: 'Hatchery ratings, raw ingredient suppliers, and payment terms', permission: 'procurement.view' },
        ],
      },
    ],
  },
  {
    id: 'sales-payments',
    title: 'Sales & Payments',
    shortCode: 'SAL',
    iconName: 'BadgePercent',
    description: 'Wholesale distributor orders, dispatch waybills, Nigerian banking feeds, and 3-way reconciliation',
    modules: [
      {
        id: 'commerce-dispatch',
        title: 'Commercial Fulfillment',
        iconName: 'BadgePercent',
        leaves: [
          { id: 'customers', title: 'Wholesale Distributors & Off-takers', description: 'Customer credit limits, wholesale pricing tiers, and contact directory', permission: 'sales.view' },
          { id: 'orders', title: 'Customer Orders & Order-to-Cash', description: 'Stock reservations, invoice generation, and commercial fulfillment', permission: 'sales.view' },
          { id: 'dispatch', title: 'Dispatch Bays & Gate Exit Passes', description: 'Digital waybills, vehicle crate loading inspection, and gate releases', permission: 'sales.view' },
        ],
      },
      {
        id: 'banking-treasury',
        title: 'Banking & Treasury',
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
    id: 'people-payroll',
    title: 'People & Payroll',
    shortCode: 'PPL',
    iconName: 'Users',
    description: 'Workforce personnel directory, biometric attendance clock, statutory PAYE/Pension, and payroll',
    modules: [
      {
        id: 'workforce-attendance',
        title: 'Workforce Management',
        iconName: 'Users',
        leaves: [
          { id: 'employees', title: 'Personnel Directory & Staff Profiles', description: 'Active employees, farm station assignments, supervisors, and emergency contacts', permission: 'employees.view' },
          { id: 'attendance', title: 'Shift Attendance & Time Clock', description: 'Biometric time clock muster, shift rotations, and overtime hours', permission: 'attendance.view' },
          { id: 'leave', title: 'Leave & Absence Management', description: 'Annual, sick, compassionate leave requests and entitlement balances', permission: 'leave.view' },
          { id: 'recruitment', title: 'Recruitment & Onboarding Invitations', description: 'Job applications, candidate interviewing, and employee onboarding', permission: 'recruitment.view' },
        ],
      },
      {
        id: 'payroll-engine',
        title: 'Enterprise Payroll Platform',
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
    id: 'projects-equipment',
    title: 'Projects & Equipment',
    shortCode: 'PRJ',
    iconName: 'HardHat',
    description: 'Capital construction projects, Bill of Quantities (BOQ), machinery maintenance, and farm fleet',
    modules: [
      {
        id: 'construction-erp',
        title: 'Construction Intelligence ERP',
        iconName: 'HardHat',
        leaves: [
          { id: 'construction', title: 'Site Operations & Progress Logs', description: 'Active construction sites, daily engineer diaries, and weather delay logs', permission: 'construction.view' },
          { id: 'boq', title: 'Bill of Quantities (BOQ) & Takeoffs', description: 'Rebar steel, cement bags, granite, roofing sheets, and WBS budget tracking', permission: 'construction.view' },
          { id: 'materials', title: 'Site Materials & Delivery Testing', description: 'Concrete cube test reports, batch delivery testing, and consumption audit', permission: 'construction.view' },
          { id: 'contractors', title: 'Contractors & Valuation Certificates', description: 'Milestone completion claims, geotagged site photos, and interim payments', permission: 'construction.view' },
        ],
      },
      {
        id: 'machinery-fleet',
        title: 'Machinery & Logistics Fleet',
        iconName: 'Truck',
        leaves: [
          { id: 'equipment', title: 'Generators & Farm Equipment', description: 'Diesel generator runtime hours, maintenance schedules, and spares', permission: 'equipment.view' },
          { id: 'fleet', title: 'Logistics Trucks & Farm Fleet', description: 'Egg distribution vans, feed delivery tippers, and GPS route status', permission: 'tracking.view' },
        ],
      },
    ],
  },
  {
    id: 'reports-insights',
    title: 'Reports & Insights',
    shortCode: 'REP',
    iconName: 'TrendingUp',
    description: 'Biological laying curves, Feed Conversion Ratios (FCR), mortality analytics, and P&L',
    modules: [
      {
        id: 'farm-analytics',
        title: 'Analytics & Intelligence',
        iconName: 'TrendingUp',
        leaves: [
          { id: 'flock-performance', title: 'Biological Laying Curves (HDEP %)', description: 'Hen-Day Egg Production (HDEP %) vs. Breed Genetic Curve', permission: 'reports.view' },
          { id: 'fcr-analytics', title: 'Feed Conversion Efficiency (FCR)', description: 'Feed intake (kg) per egg crate produced', permission: 'reports.view' },
          { id: 'mortality-reports', title: 'Mortality Variance Trends', description: 'Cumulative mortality curves and biological anomaly alerts', permission: 'reports.view' },
          { id: 'profit', title: 'Commercial P&L & Margins', description: 'Cost per dozen eggs, feed cost ratio and gross margins', permission: 'finance.view' },
        ],
      },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    shortCode: 'COM',
    iconName: 'MessageSquare',
    description: 'Management bulletins, WhatsApp operations hub, biosecurity emergency blasts, and shift memos',
    modules: [
      {
        id: 'broadcast-messaging',
        title: 'Radio & WhatsApp Hub',
        iconName: 'MessageSquare',
        leaves: [
          { id: 'notices', title: 'Official Farm Notices & Memos', description: 'Management bulletins and biosecurity protocols', permission: 'notices.view' },
          { id: 'whatsapp-hub', title: 'WhatsApp Operations Hub', description: 'Outbox queue, customer order updates and driver gate passes', permission: 'communications.view' },
          { id: 'emergency-broadcast', title: 'Biosecurity Emergency Red Alert', description: 'Instant quarantine lockdown broadcast to all staff', permission: 'communications.manage' },
          { id: 'comm-logs', title: 'Message Delivery Audit Ledger', description: 'Real-time delivery receipts, timestamps and failures', permission: 'communications.audit.view' },
        ],
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    shortCode: 'ADM',
    iconName: 'ShieldCheck',
    description: 'Provisional accounts (48h), dynamic role permissions, master data governance, audit ledger, and Studio',
    modules: [
      {
        id: 'governance-core',
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
