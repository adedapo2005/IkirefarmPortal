-- Seed Initial Production Data for Daenem Agro-Allied Farms
INSERT OR IGNORE INTO employees (id, staff_id, full_name, department, role_title, basic_salary, housing_allowance, transport_allowance, apply_paye, apply_pension, apply_nhf, payment_bank, account_number, verified_account_name, kyc_tier, status) VALUES
('pr-01', 'DF-24-001', 'Glory Mercy Adetokunbo', 'Farm Operations', 'General Farm Manager', 600000, 50000, 30000, 1, 1, 0, 'Zenith Bank PLC', '2081928374', 'GLORY MERCY ADETOKUNBO', 'Tier 3 (BVN/NIN Verified)', 'Signed & Ready'),
('pr-02', 'DF-24-004', 'Dr. Segun Adewale (DVM)', 'Veterinary & Health', 'Chief Resident Veterinarian', 400000, 45000, 35000, 1, 1, 0, 'Guaranty Trust Bank (GTBank)', '0192837461', 'DR. SEGUN ADEWALE (DVM)', 'Tier 3 (BVN/NIN Verified)', 'Signed & Ready'),
('pr-03', 'DF-24-012', 'Idris O. Oladele', 'Feed & Nutrition', 'Head of Milling & Feed Formulation', 280000, 25000, 20000, 1, 1, 0, 'Access Bank PLC', '1482910482', 'IDRIS O. OLADELE', 'Tier 3 (BVN/NIN Verified)', 'Signed & Ready'),
('pr-04', 'DF-24-019', 'Babatunde Sunday Alamu', 'Layer Management', 'Senior Poultry Husbandry Supervisor', 240000, 25000, 15000, 1, 1, 0, 'First Bank of Nigeria', '3092817456', 'BABATUNDE SUNDAY ALAMU', 'Tier 3 (BVN/NIN Verified)', 'Signed & Ready');

INSERT OR IGNORE INTO flocks (id, batch_code, breed, bird_count, placement_date, age_weeks, housing_pen, opening_birds, current_mortality_rate, lay_percentage, status) VALUES
('flk-1', 'FLK-2026-01', 'ISA Brown', 12200, '2026-04-12', 48, 'House 1 (Battery Cages A-D)', 12200, 0.08, 91.8, 'Active'),
('flk-2', 'FLK-2026-02', 'Lohmann Brown', 12050, '2026-05-02', 45, 'House 2 (Battery Cages E-H)', 12050, 0.06, 92.4, 'Active'),
('flk-3', 'FLK-2026-03', 'Novogen White', 12110, '2026-06-18', 38, 'House 3 (Battery Cages J-M)', 12110, 0.05, 93.1, 'Active'),
('flk-4', 'FLK-2026-04', 'ISA Brown Pullets', 12105, '2026-08-20', 29, 'House 4 (Battery Cages N-Q)', 12105, 0.03, 88.5, 'Active');

INSERT OR IGNORE INTO daily_pen_logs (
  id, flock_id, pen_number, log_date, age_days, opening_birds, mortality_count, culls_count, transfers_out,
  closing_birds, medication, vaccination, feed_consumed_kg, eggs_collected_good, eggs_damaged, eggs_rejected,
  water_consumed_litres, ambient_temp_c, relative_humidity_pct, thi_heat_stress_index, idempotency_key, recorded_by
) VALUES
('log-01', 'flk-1', 'House 1 (Battery Cages A-D)', '2026-11-06', 336, 12201, 1, 0, 0, 12200, 'None', 'None Scheduled', 1464.0, 11200, 24, 6, 2928.0, 28.5, 76.0, 70.8, 'idem-flk-1-2026-11-06', 'Babatunde Alamu'),
('log-02', 'flk-2', 'House 2 (Battery Cages E-H)', '2026-11-06', 315, 12052, 2, 0, 0, 12050, 'None', 'ND+IB Booster', 1446.0, 11134, 18, 4, 2892.0, 28.7, 75.5, 71.0, 'idem-flk-2-2026-11-06', 'Babatunde Alamu'),
('log-03', 'flk-3', 'House 3 (Battery Cages J-M)', '2026-11-06', 266, 12111, 1, 0, 0, 12110, 'Vitalyte Electrovit', 'None Scheduled', 1453.0, 11274, 21, 5, 2906.0, 28.4, 76.2, 70.6, 'idem-flk-3-2026-11-06', 'Glory Mercy Adetokunbo'),
('log-04', 'flk-4', 'House 4 (Battery Cages N-Q)', '2026-11-06', 203, 12105, 0, 0, 0, 12105, 'None', 'Deworming Piperazine', 1331.0, 10713, 14, 3, 2662.0, 28.6, 75.8, 70.9, 'idem-flk-4-2026-11-06', 'Dr. Segun Adewale');

INSERT OR IGNORE INTO wholesale_orders (id, order_number, customer_name, customer_phone, crates_ordered, unit_price_ngn, total_amount_ngn, payment_status, payment_channel, dynamic_virtual_account, nip_session_id, sender_kyc_name, gate_pass_id, gate_pass_status, driver_name, vehicle_plate, dispatched_at_wat) VALUES
('ord-8821', 'DF-ORD-8821', 'Alhaji Rasheed Akanni', '0803 491 8294', 120, 4900, 588000, 'PAID_VERIFIED', 'Moniepoint MFB NIP', '8049882101', '999014261106093411000849201842', 'RASHEED AKANNI ENT', 'GP-8821', 'CLEARED_EXIT', 'Kabiru Sanusi', 'KTU-842-XB (Isuzu 5-Ton)', '06 Nov 2026, 09:42 AM WAT'),
('ord-8824', 'DF-ORD-8824', 'Madam Folake Super Stores', '0802 819 4721', 80, 4950, 396000, 'PAID_VERIFIED', 'Moniepoint MFB NIP', '8049882402', '999014261106112044000192847102', 'FOLAKE VENTURES LTD', 'GP-8824', 'CLEARED_EXIT', 'Tunde Bakare', 'BDG-119-YA (Mitsubishi Canter)', '06 Nov 2026, 11:35 AM WAT'),
('ord-8829', 'DF-ORD-8829', 'Chief Emmanuel Okechukwu', '0806 721 9901', 200, 4850, 970000, 'PENDING_PAYMENT', 'Providus Bank Dynamic NUBAN', '9920194820', NULL, 'Pending Transfer', 'GP-8829', 'LOCKED', 'Chinedu Okoro', 'ENU-711-AH (Man Diesel 10-Ton)', 'Awaiting Gate Clearance');
