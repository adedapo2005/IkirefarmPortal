export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  scope: 'enterprise' | 'farm_site' | 'department';
  isCustom?: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionItem {
  id: string;
  name: string;
  category: string;
  description: string;
}

// Master Permission Registry (Categorized for Admin Custom Role Creation)
export const PERMISSION_CATALOG: PermissionItem[] = [
  // Flocks & Pens
  { id: 'flocks.create', name: 'Create Flock Intakes', category: 'Livestock Operations', description: 'Authorize intake and placement of day-old chicks/pullets' },
  { id: 'flocks.view', name: 'View Flock Lifecycle Records', category: 'Livestock Operations', description: 'Inspect age, stocking density, and health history' },
  { id: 'flocks.edit', name: 'Edit Flock Parameters', category: 'Livestock Operations', description: 'Modify target curves, house transfers, and depopulation' },
  { id: 'daily_register.submit', name: 'Submit 7-Column Daily Pen Log', category: 'Livestock Operations', description: 'Log mortality, medicine, vaccine, feed intake, and closing counts' },
  { id: 'daily_register.reconcile', name: 'Reconcile Pen Balance Discrepancies', category: 'Livestock Operations', description: 'Investigate and clear biological census variations' },

  // Eggs & Feed
  { id: 'eggs.collect', name: 'Record Egg Collections & Grading', category: 'Production & Processing', description: 'Log trays, crates, and leakers in egg room' },
  { id: 'feed.batch', name: 'Create Feed Mill Batches', category: 'Production & Processing', description: 'Formulate and mill least-cost feed rations' },
  { id: 'feed.quality_release', name: 'Quality Hold / Release', category: 'Production & Processing', description: 'Authorize silo discharge of newly milled rations' },

  // Commercial & Sales
  { id: 'sales.order_create', name: 'Create Wholesale Orders', category: 'Commercial & Sales', description: 'Draft wholesale egg and cull bird customer orders' },
  { id: 'sales.order_approve', name: 'Approve & Release Orders', category: 'Commercial & Sales', description: 'Authorize dispatch and stock reservation' },
  { id: 'sales.waybill_issue', name: 'Issue Waybills & Gate Passes', category: 'Commercial & Sales', description: 'Generate cryptographic vehicle exit passes' },

  // Banking & Treasury
  { id: 'banking.view_balances', name: 'View Corporate Bank Balances', category: 'Finance & Treasury', description: 'Inspect Providus, Zenith, GTB, and Access positions' },
  { id: 'banking.transfers_initiate', name: 'Initiate Bank Transfers', category: 'Finance & Treasury', description: 'Draft vendor and contractor disbursements' },
  { id: 'banking.transfers_authorize', name: 'Maker-Checker Dual Sign-off', category: 'Finance & Treasury', description: 'Cryptographic executive approval for bank releases' },
  { id: 'banking.reconcile', name: '3-Way Bank Reconciliation', category: 'Finance & Treasury', description: 'Match orders with Providus webhooks & statement credits' },

  // Workforce & Compensation
  { id: 'payroll.run_create', name: 'Draft Payroll Cycles', category: 'Workforce & Payroll', description: 'Compute salaried, casual, and piece-rate compensation' },
  { id: 'payroll.disburse', name: 'Authorize NIP Salary Batches', category: 'Workforce & Payroll', description: 'Release bank batch files for employee wages' },
  { id: 'attendance.manage', name: 'Attendance & Overtime Audit', category: 'Workforce & Payroll', description: 'Inspect biometric clocks and approve overtime' },

  // Capital Projects
  { id: 'construction.milestone_certify', name: 'Certify Contractor Claims', category: 'Capital Projects', description: 'Inspect concrete pours and sign interim payment certificates' },
  { id: 'construction.boq_manage', name: 'Manage Bill of Quantities', category: 'Capital Projects', description: 'Configure takeoffs, rebar, cement, and granite budgets' },

  // Governance & Administration
  { id: 'admin.roles_manage', name: 'Manage Roles & Dynamic RBAC', category: 'System Governance', description: 'Create, modify, and assign enterprise permissions' },
  { id: 'admin.provisional_review', name: 'Triage 48h Provisional Users', category: 'System Governance', description: 'Approve, reject, or extend review deadlines' },
  { id: 'admin.audit_view', name: 'Inspect Forensic Audit Ledger', category: 'System Governance', description: 'Review immutable events with exact seconds and diffs' },
  { id: 'admin.studio_cms', name: 'Configure Portal Studio CMS', category: 'System Governance', description: 'Customize Sign-In gateway and operational widgets' },
];

export const INITIAL_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Farm Owner & Executive',
    description: 'Unrestricted enterprise command, treasury authority, and executive situation room access',
    scope: 'enterprise',
    userCount: 2,
    permissions: PERMISSION_CATALOG.map(p => p.id),
  },
  {
    id: 'farm_manager',
    name: 'General Farm Manager',
    description: 'Balogun-Ikire operational muster, flock cycles, feed milling, and field team oversight',
    scope: 'farm_site',
    userCount: 3,
    permissions: [
      'flocks.create', 'flocks.view', 'flocks.edit', 'daily_register.submit', 'daily_register.reconcile',
      'eggs.collect', 'feed.batch', 'feed.quality_release', 'sales.order_create', 'sales.waybill_issue',
      'attendance.manage', 'construction.milestone_certify', 'admin.provisional_review'
    ],
  },
  {
    id: 'financial_controller',
    name: 'Financial Controller',
    description: 'Corporate treasury, banking observatory, 3-way sales reconciliation, and expenses',
    scope: 'enterprise',
    userCount: 2,
    permissions: [
      'sales.order_approve', 'banking.view_balances', 'banking.transfers_initiate', 
      'banking.reconcile', 'payroll.run_create', 'admin.audit_view'
    ],
  },
  {
    id: 'veterinary_lead',
    name: 'Lead Veterinarian & Biosecurity Officer',
    description: 'Flock clinical health, necropsy investigation, vaccination, and biosecurity protocols',
    scope: 'farm_site',
    userCount: 1,
    permissions: [
      'flocks.view', 'daily_register.submit', 'daily_register.reconcile', 'feed.quality_release'
    ],
  },
  {
    id: 'pen_attendant',
    name: 'Flock Attendant (Egg & Pen Operator)',
    description: 'Daily pen muster, feeding, egg collections, and shift handover routines',
    scope: 'department',
    userCount: 18,
    permissions: [
      'flocks.view', 'daily_register.submit', 'eggs.collect'
    ],
  },
];
