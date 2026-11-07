-- ============================================================================
-- DAENEM AGRO-ALLIED FARMS ERP — AUTHORITATIVE D1 RELATIONAL DATABASE SCHEMA
-- Cloudflare D1 Distributed SQLite Engine (Osun State, Nigeria)
-- ============================================================================

-- 1. Identity, Access & 48-Hour Provisional Lifecycle
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    department TEXT NOT NULL DEFAULT 'Operations',
    access_state TEXT NOT NULL DEFAULT 'provisional', -- 'owner' | 'assigned' | 'no_role' | 'provisional' | 'provisional_expired'
    farm_scope TEXT NOT NULL DEFAULT 'ikire',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    provisional_expires_at DATETIME,
    approved_by TEXT,
    approved_at DATETIME
);

-- 2. Human Resources & Staff Master
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    staff_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    role_title TEXT NOT NULL,
    basic_salary INTEGER NOT NULL,
    housing_allowance INTEGER NOT NULL DEFAULT 0,
    transport_allowance INTEGER NOT NULL DEFAULT 0,
    other_allowances INTEGER NOT NULL DEFAULT 0,
    apply_paye INTEGER NOT NULL DEFAULT 1, -- 1 = apply Osun PAYE, 0 = optional bypass
    apply_pension INTEGER NOT NULL DEFAULT 1, -- 1 = apply PenCom 8%, 0 = optional bypass
    apply_nhf INTEGER NOT NULL DEFAULT 0, -- 1 = apply NHF 2.5%, 0 = optional bypass
    payment_bank TEXT NOT NULL,
    account_number TEXT NOT NULL,
    verified_account_name TEXT NOT NULL,
    kyc_tier TEXT DEFAULT 'Tier 3 (BVN/NIN)',
    status TEXT NOT NULL DEFAULT 'Approved & Signed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enterprise Payroll Runs & Digital Payslip Vault
CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL, -- e.g. 'November 2026'
    gross_total INTEGER NOT NULL,
    paye_tax_total INTEGER NOT NULL,
    pension_total INTEGER NOT NULL,
    net_disbursed_total INTEGER NOT NULL,
    funding_account_id TEXT NOT NULL,
    funding_bank_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Review', -- 'Draft' | 'Approved' | 'Paid via NIP'
    nip_batch_reference TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    disbursed_at_wat TEXT
);

CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY,
    payroll_run_id TEXT REFERENCES payroll_runs(id),
    employee_id TEXT REFERENCES employees(id),
    staff_id TEXT NOT NULL,
    period TEXT NOT NULL,
    basic_salary INTEGER NOT NULL,
    housing_allowance INTEGER NOT NULL,
    transport_allowance INTEGER NOT NULL,
    gross_pay INTEGER NOT NULL,
    paye_tax INTEGER NOT NULL,
    pension_employee INTEGER NOT NULL,
    nhf_deduction INTEGER NOT NULL,
    net_pay INTEGER NOT NULL,
    payment_bank TEXT NOT NULL,
    account_number TEXT NOT NULL,
    verified_account_name TEXT NOT NULL,
    nip_session_id TEXT,
    disbursed_at_wat TEXT,
    status TEXT NOT NULL DEFAULT 'Approved & Signed'
);

-- 4. Biological Flock Registry & Conservation Ledger
CREATE TABLE IF NOT EXISTS flocks (
    id TEXT PRIMARY KEY,
    batch_code TEXT UNIQUE NOT NULL, -- e.g. 'FLK-2026-04'
    breed TEXT NOT NULL DEFAULT 'ISA Brown',
    bird_count INTEGER NOT NULL,
    placement_date DATE NOT NULL,
    age_weeks INTEGER NOT NULL,
    housing_pen TEXT NOT NULL, -- e.g. 'House 1'
    opening_birds INTEGER NOT NULL,
    current_mortality_rate REAL DEFAULT 0.0,
    lay_percentage REAL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'Active'
);

-- 5. Daily 7-Column Pen Register (Mathematical Conservation Invariant)
-- Equation: Opening + Intake - Mortality - Culls - Transfers = Closing
CREATE TABLE IF NOT EXISTS daily_pen_logs (
    id TEXT PRIMARY KEY,
    flock_id TEXT REFERENCES flocks(id),
    pen_number TEXT NOT NULL,
    log_date DATE NOT NULL,
    opening_birds INTEGER NOT NULL,
    mortality_count INTEGER NOT NULL DEFAULT 0,
    culls_count INTEGER NOT NULL DEFAULT 0,
    transfers_out INTEGER NOT NULL DEFAULT 0,
    closing_birds INTEGER NOT NULL,
    eggs_collected_good INTEGER NOT NULL DEFAULT 0,
    eggs_damaged INTEGER NOT NULL DEFAULT 0,
    eggs_rejected INTEGER NOT NULL DEFAULT 0,
    feed_consumed_kg REAL NOT NULL DEFAULT 0.0,
    water_consumed_litres REAL NOT NULL DEFAULT 0.0,
    ambient_temp_c REAL,
    relative_humidity_pct REAL,
    thi_heat_stress_index REAL,
    recorded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_flock_math CHECK (closing_birds = opening_birds - mortality_count - culls_count - transfers_out)
);

-- 6. Egg Grading, Sizing & Cold Room Storage
CREATE TABLE IF NOT EXISTS egg_batches (
    id TEXT PRIMARY KEY,
    batch_code TEXT UNIQUE NOT NULL,
    grading_date DATE NOT NULL,
    jumbo_crates INTEGER NOT NULL DEFAULT 0,
    large_crates INTEGER NOT NULL DEFAULT 0,
    medium_crates INTEGER NOT NULL DEFAULT 0,
    pullet_crates INTEGER NOT NULL DEFAULT 0,
    total_crates INTEGER NOT NULL,
    damaged_eggs INTEGER NOT NULL DEFAULT 0,
    cold_room_id TEXT NOT NULL DEFAULT 'Chamber 1',
    storage_temp_c REAL DEFAULT 16.4,
    status TEXT NOT NULL DEFAULT 'In Cold Storage',
    qc_inspector TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Grain Silos, Milling & Feed Balancer
CREATE TABLE IF NOT EXISTS feed_silos (
    id TEXT PRIMARY KEY,
    silo_code TEXT UNIQUE NOT NULL, -- e.g. 'SILO-01'
    grain_type TEXT NOT NULL, -- 'Yellow Maize' | 'Soybean Meal' | 'Wheat Offal' | 'Limestone'
    max_capacity_tonnes REAL NOT NULL DEFAULT 120.0,
    current_level_tonnes REAL NOT NULL,
    last_refill_date DATE,
    sensor_telemetry_status TEXT DEFAULT 'Online (Ultrasonic)',
    reorder_alert_active INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Wholesale Orders, Bank Ingestion & Anti-Fraud QR Gate Pass
CREATE TABLE IF NOT EXISTS wholesale_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL, -- e.g. 'DF-ORD-8821'
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    crates_ordered INTEGER NOT NULL,
    unit_price_ngn INTEGER NOT NULL,
    total_amount_ngn INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT', -- 'PENDING_PAYMENT' | 'PAID_VERIFIED' | 'DISPATCHED'
    payment_channel TEXT DEFAULT 'Moniepoint MFB NIP',
    dynamic_virtual_account TEXT,
    nip_session_id TEXT,
    sender_kyc_name TEXT,
    gate_pass_id TEXT, -- e.g. 'GP-8821'
    gate_pass_status TEXT DEFAULT 'LOCKED', -- 'LOCKED' | 'CLEARED_EXIT' | 'EXPIRED'
    driver_name TEXT,
    vehicle_plate TEXT,
    dispatched_at_wat TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Forensic Audit & Immutable Transaction Trail
CREATE TABLE IF NOT EXISTS audit_ledger (
    id TEXT PRIMARY KEY,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action_type TEXT NOT NULL, -- e.g. 'PAYROLL_DISBURSE' | 'PAYMENT_WEBHOOK' | 'GATE_PASS_RELEASE' | 'PEN_RECORD_CREATE'
    entity_affected TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    change_summary TEXT NOT NULL,
    provenance_hash TEXT,
    ip_address TEXT DEFAULT '127.0.0.1',
    created_at_wat TEXT NOT NULL
);

-- Initial Master Seed Records
INSERT OR IGNORE INTO feed_silos (id, silo_code, grain_type, max_capacity_tonnes, current_level_tonnes, last_refill_date) VALUES
('silo-1', 'SILO-01', 'Yellow Maize', 120.0, 84.5, '2026-11-01'),
('silo-2', 'SILO-02', 'Soybean Meal (48% Protein)', 80.0, 52.0, '2026-11-03'),
('silo-3', 'SILO-03', 'Wheat Offal', 60.0, 41.2, '2026-11-04'),
('silo-4', 'SILO-04', 'Limestone / Calcium Grit', 40.0, 28.6, '2026-11-05');
