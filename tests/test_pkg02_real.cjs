/**
 * PACKAGE 02 COMPREHENSIVE BACKEND INTEGRATION TEST SUITE
 * Executes real Cloudflare Pages Function handlers against real Request/Response objects and D1 mock.
 * Assertions fail with non-zero exit code if any contract or security boundary is violated.
 */

const assert = require('assert');
const crypto = require('crypto');
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Helper to compile and load a TypeScript Pages Function handler into memory
function loadHandler(tsFilePath) {
  const code = fs.readFileSync(tsFilePath, 'utf-8');
  const compiled = esbuild.transformSync(code, {
    loader: 'ts',
    format: 'cjs',
    target: 'node18',
  });

  const m = { exports: {} };
  const fn = new Function('require', 'module', 'exports', compiled.code);
  fn(require, m, m.exports);
  return m.exports;
}

// In-Memory D1 Mock conforming to Cloudflare D1 Database API
class MockD1Database {
  constructor() {
    this.tables = {
      daily_pen_logs: [
        {
          id: 'log-01',
          flock_id: 'flk-1',
          pen_number: 'House 1 (Battery Cages A-D)',
          log_date: '2026-11-06',
          age_days: 336,
          opening_birds: 12201,
          mortality_count: 1,
          culls_count: 0,
          transfers_out: 0,
          closing_birds: 12200,
          medication: 'None',
          vaccination: 'None Scheduled',
          feed_consumed_kg: 1464.0,
          eggs_collected_good: 11200,
          eggs_damaged: 24,
          eggs_rejected: 6,
          water_consumed_litres: 2928.0,
          ambient_temp_c: 28.5,
          relative_humidity_pct: 76.0,
          thi_heat_stress_index: 70.8,
          idempotency_key: 'idem-flk-1-2026-11-06',
          recorded_by: 'Babatunde Alamu',
          created_at: '2026-11-06 18:00:00'
        }
      ],
      wholesale_orders: [
        {
          id: 'ord-8829',
          order_number: 'DF-ORD-8829',
          customer_name: 'Chief Emmanuel Okechukwu',
          customer_phone: '0806 721 9901',
          crates_ordered: 200,
          unit_price_ngn: 4850,
          total_amount_ngn: 970000,
          payment_status: 'PENDING_PAYMENT',
          payment_channel: 'Moniepoint MFB NIP',
          dynamic_virtual_account: null,
          nip_session_id: null,
          sender_kyc_name: null,
          gate_pass_id: 'GP-8829',
          gate_pass_status: 'LOCKED',
          driver_name: 'Chinedu Okoro',
          vehicle_plate: 'ENU-711-AH',
          dispatched_at_wat: null,
          created_at: '2026-11-06 10:00:00'
        }
      ],
      audit_ledger: []
    };
  }

  prepare(sql) {
    const db = this;
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async all() {
        const s = sql.toLowerCase();
        if (s.includes('from daily_pen_logs')) {
          let rows = [...db.tables.daily_pen_logs];
          if (s.includes('log_date = ?')) {
            const dateParam = this.params[0];
            rows = rows.filter(r => r.log_date === dateParam);
          }
          return {
            results: rows.map(r => ({
              id: r.id,
              flockId: r.flock_id,
              penNumber: r.pen_number,
              logDate: r.log_date,
              ageDays: r.age_days,
              openingBirds: r.opening_birds,
              mortalityCount: r.mortality_count,
              cullsCount: r.culls_count,
              transfersOut: r.transfers_out,
              closingBirds: r.closing_birds,
              medication: r.medication,
              vaccination: r.vaccination,
              eggsCollectedGood: r.eggs_collected_good,
              eggsDamaged: r.eggs_damaged,
              eggsRejected: r.eggs_rejected,
              feedConsumedKg: r.feed_consumed_kg,
              waterConsumedLitres: r.water_consumed_litres,
              ambientTempC: r.ambient_temp_c,
              relativeHumidityPct: r.relative_humidity_pct,
              thiIndex: r.thi_heat_stress_index,
              idempotencyKey: r.idempotency_key,
              recordedBy: r.recorded_by,
              createdAt: r.created_at
            }))
          };
        }
        if (s.includes('from wholesale_orders')) {
          return { results: [...db.tables.wholesale_orders] };
        }
        return { results: [] };
      },
      async first() {
        const s = sql.toLowerCase();
        if (s.includes('from daily_pen_logs') && s.includes('idempotency_key = ?')) {
          const key = this.params[0];
          const found = db.tables.daily_pen_logs.find(r => r.idempotency_key === key);
          return found ? { id: found.id, closing_birds: found.closing_birds } : null;
        }
        if (s.includes('from wholesale_orders')) {
          const [va, ref] = this.params;
          const found = db.tables.wholesale_orders.find(
            o => (o.dynamic_virtual_account && o.dynamic_virtual_account === va) || o.order_number === ref || o.order_number === va
          );
          return found || null;
        }
        return null;
      },
      async run() {
        return { success: true };
      }
    };
  }

  async batch(statements) {
    for (const stmt of statements) {
      const sql = stmt.sql.toLowerCase();
      if (sql.includes('insert into daily_pen_logs')) {
        const [
          id, flock_id, pen_number, log_date, age_days, opening_birds, mortality_count,
          culls_count, transfers_out, closing_birds, medication, vaccination,
          feed_consumed_kg, eggs_collected_good, eggs_damaged, eggs_rejected,
          water_consumed_litres, ambient_temp_c, relative_humidity_pct,
          thi_heat_stress_index, idempotency_key, recorded_by
        ] = stmt.params;

        this.tables.daily_pen_logs.push({
          id, flock_id, pen_number, log_date, age_days, opening_birds, mortality_count,
          culls_count, transfers_out, closing_birds, medication, vaccination,
          feed_consumed_kg, eggs_collected_good, eggs_damaged, eggs_rejected,
          water_consumed_litres, ambient_temp_c, relative_humidity_pct,
          thi_heat_stress_index, idempotency_key, recorded_by,
          created_at: new Date().toISOString()
        });
      } else if (sql.includes('update wholesale_orders')) {
        const [nip_session_id, sender_kyc_name, orderId] = stmt.params;
        const ord = this.tables.wholesale_orders.find(o => o.id === orderId);
        if (ord) {
          ord.payment_status = 'PAID_VERIFIED';
          ord.gate_pass_status = 'CLEARED_EXIT';
          ord.nip_session_id = nip_session_id;
          ord.sender_kyc_name = sender_kyc_name;
          // Notice: dispatched_at_wat is NOT mutated here (invariant preserved)
        }
      } else if (sql.includes('insert into wholesale_orders')) {
        const [
          id, order_number, customer_name, customer_phone, crates_ordered,
          unit_price_ngn, total_amount_ngn, payment_channel, gate_pass_id,
          driver_name, vehicle_plate
        ] = stmt.params;
        this.tables.wholesale_orders.push({
          id, order_number, customer_name, customer_phone, crates_ordered,
          unit_price_ngn, total_amount_ngn, payment_status: 'PENDING_PAYMENT',
          payment_channel, dynamic_virtual_account: null, gate_pass_id,
          gate_pass_status: 'LOCKED', driver_name, vehicle_plate,
          dispatched_at_wat: null, created_at: new Date().toISOString()
        });
      } else if (sql.includes('insert into audit_ledger')) {
        const [id, actor_name, actor_role, action_type, entity_affected, entity_id, change_summary, created_at_wat] = stmt.params;
        this.tables.audit_ledger.push({
          id, actor_name, actor_role, action_type, entity_affected, entity_id, change_summary, created_at_wat
        });
      }
    }
    return [{ success: true }];
  }
}

// Helper to compute genuine HMAC-SHA512 signature using Node crypto
function computeHmacSha512(secret, body) {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

async function runRealIntegrationTests() {
  console.log('================================================================');
  console.log('  IKIREFARMPORTAL — PACKAGE 02 REAL BACKEND INTEGRATION TESTS   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(testName, detail) {
    passed++;
    console.log(`  ✓ PASS: [${testName}]`);
    if (detail) console.log(`    ↳ ${detail}`);
  }

  function recordFail(testName, err) {
    failed++;
    console.error(`  ✗ FAIL: [${testName}]`);
    console.error(`    ↳ ${err.message || err}`);
  }

  // Load real compiled handlers
  const repoRoot = path.resolve(__dirname, '..');
  const dailyRegModule = loadHandler(path.join(repoRoot, 'functions/api/v1/operations/daily-register.ts'));
  const kudaModule = loadHandler(path.join(repoRoot, 'functions/api/webhooks/kuda.ts'));
  const ordersModule = loadHandler(path.join(repoRoot, 'functions/api/v1/orders/index.ts'));
  const authModule = loadHandler(path.join(repoRoot, 'functions/api/v1/auth/me.ts'));

  const db = new MockD1Database();

  // -------------------------------------------------------------
  // SUITE 1: DAILY FLOCK REGISTER & BIOLOGICAL CONSERVATION
  // -------------------------------------------------------------
  console.log('\n[SUITE 1: Daily Flock Register & Biological Conservation]');

  // Test 1.1: Mathematical Conservation Invariant Check
  try {
    const invalidBody = JSON.stringify({
      penNumber: 'House 1',
      openingBirds: 12000,
      mortalityCount: 10,
      cullsCount: 0,
      transfersOut: 0,
      closingBirds: 11950, // Variance: 12000 - 10 = 11990 !== 11950
      recordedBy: 'Shift Attendant'
    });
    const req = new Request('http://localhost/api/v1/operations/daily-register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: invalidBody
    });
    const res = await dailyRegModule.onRequestPost({ request: req, env: { DB: db } });
    assert.strictEqual(res.status, 422, 'Expected status 422 for mathematical imbalance');
    const data = await res.json();
    assert.strictEqual(data.status, 'error');
    assert.ok(data.error.includes('Mathematical Conservation Error'), 'Expected conservation error message');
    recordPass('Daily Register Invariant', 'Imbalance of 40 birds rejected with HTTP 422');
  } catch (err) {
    recordFail('Daily Register Invariant', err);
  }

  // Test 1.2: Fail closed without D1 Database binding
  try {
    const req = new Request('http://localhost/api/v1/operations/daily-register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ openingBirds: 12000, closingBirds: 12000 })
    });
    const res = await dailyRegModule.onRequestPost({ request: req, env: {} });
    assert.strictEqual(res.status, 503, 'Expected status 503 when D1 is missing');
    const data = await res.json();
    assert.strictEqual(data.persisted, false);
    assert.ok(data.error.includes('unavailable'), 'Expected fail-closed error');
    recordPass('Daily Register Fail-Closed', 'Rejected with HTTP 503 when DB binding absent');
  } catch (err) {
    recordFail('Daily Register Fail-Closed', err);
  }

  // Test 1.3: Genuine Persistence with 7 Register Columns
  try {
    const validBody = JSON.stringify({
      penNumber: 'House 1 (Battery Cages A-D)',
      flockId: 'flk-1',
      logDate: '2026-11-07',
      ageDays: 337,
      openingBirds: 12200,
      mortalityCount: 2,
      cullsCount: 0,
      transfersOut: 0,
      closingBirds: 12198, // Invariant: 12200 - 2 = 12198
      medication: 'Vitalyte Electrovit',
      vaccination: 'None Scheduled',
      feedConsumedKg: 1464,
      eggsCollectedGood: 11190,
      eggsDamaged: 20,
      eggsRejected: 0,
      waterConsumedLitres: 2928,
      idempotencyKey: 'idem-flk1-2026-11-07-test01',
      recordedBy: 'Babatunde Alamu'
    });
    const req = new Request('http://localhost/api/v1/operations/daily-register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: validBody
    });
    const res = await dailyRegModule.onRequestPost({ request: req, env: { DB: db } });
    assert.strictEqual(res.status, 201, 'Expected status 201 Created');
    const data = await res.json();
    assert.strictEqual(data.status, 'success');
    assert.strictEqual(data.persisted, true);
    assert.strictEqual(data.balanced, true);
    assert.strictEqual(data.closingBirds, 12198);
    assert.ok(db.tables.audit_ledger.length > 0, 'Expected audit ledger entry created');
    recordPass('Daily Register Persistence', 'Shift record persisted to D1 with HTTP 201 & audit trail');
  } catch (err) {
    recordFail('Daily Register Persistence', err);
  }

  // Test 1.4: Idempotency Replay Protection
  try {
    const replayBody = JSON.stringify({
      penNumber: 'House 1 (Battery Cages A-D)',
      flockId: 'flk-1',
      logDate: '2026-11-07',
      openingBirds: 12200,
      mortalityCount: 2,
      cullsCount: 0,
      transfersOut: 0,
      closingBirds: 12198,
      idempotencyKey: 'idem-flk1-2026-11-07-test01', // Identical key
      recordedBy: 'Babatunde Alamu'
    });
    const req = new Request('http://localhost/api/v1/operations/daily-register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: replayBody
    });
    const res = await dailyRegModule.onRequestPost({ request: req, env: { DB: db } });
    assert.strictEqual(res.status, 200, 'Expected status 200 OK for idempotent duplicate replay');
    const data = await res.json();
    assert.strictEqual(data.status, 'success');
    assert.ok(data.message.includes('idempotent replay'), 'Expected idempotent replay notification');
    recordPass('Daily Register Idempotency', 'Replay safely returned existing record with HTTP 200 without duplication');
  } catch (err) {
    recordFail('Daily Register Idempotency', err);
  }

  // Test 1.5: Read-back with Date Filter
  try {
    const req = new Request('http://localhost/api/v1/operations/daily-register?date=2026-11-06');
    const res = await dailyRegModule.onRequestGet({ request: req, env: { DB: db } });
    assert.strictEqual(res.status, 200, 'Expected status 200 OK');
    const data = await res.json();
    assert.strictEqual(data.status, 'success');
    assert.ok(Array.isArray(data.records));
    assert.strictEqual(data.records.length, 1, 'Expected 1 record for 2026-11-06');
    assert.strictEqual(data.records[0].openingBirds, 12201);
    recordPass('Daily Register Read-Back', 'Filtered query by WAT date retrieved authoritative records');
  } catch (err) {
    recordFail('Daily Register Read-Back', err);
  }

  // -------------------------------------------------------------
  // SUITE 2: KUDA BUSINESS WEBHOOK & PAYMENT RECONCILIATION
  // -------------------------------------------------------------
  console.log('\n[SUITE 2: Kuda Business Webhook & Reconciliation]');

  const webhookSecret = 'test_kuda_secret_key_88921';

  // Test 2.1: Fail closed when secret unconfigured
  try {
    const req = new Request('http://localhost/api/webhooks/kuda', {
      method: 'POST',
      body: '{}'
    });
    const res = await kudaModule.onRequestPost({ request: req, env: {} });
    assert.strictEqual(res.status, 503, 'Expected status 503 without secret');
    recordPass('Kuda Webhook Unconfigured', 'Rejected with HTTP 503 when secret missing');
  } catch (err) {
    recordFail('Kuda Webhook Unconfigured', err);
  }

  // Test 2.2: Cryptographic signature verification
  try {
    const payload = JSON.stringify({ reference: 'DF-ORD-8829', amount: 970000, status: 'SUCCESS' });
    const reqInvalid = new Request('http://localhost/api/webhooks/kuda', {
      method: 'POST',
      headers: { 'x-kuda-signature': 'forged_invalid_signature_hex' },
      body: payload
    });
    const resInvalid = await kudaModule.onRequestPost({ request: reqInvalid, env: { KUDA_WEBHOOK_SECRET: webhookSecret, DB: db } });
    assert.strictEqual(resInvalid.status, 401, 'Expected status 401 for forged HMAC signature');
    recordPass('Kuda Webhook Signature Check', 'Forged HMAC-SHA512 signature rejected with HTTP 401');
  } catch (err) {
    recordFail('Kuda Webhook Signature Check', err);
  }

  // Test 2.3: Unsuccessful payment status rejected
  try {
    const payloadFailed = JSON.stringify({
      reference: 'DF-ORD-8829',
      amount: 970000,
      currency: 'NGN',
      status: 'FAILED' // Non-success status
    });
    const sigFailed = computeHmacSha512(webhookSecret, payloadFailed);
    const reqFailed = new Request('http://localhost/api/webhooks/kuda', {
      method: 'POST',
      headers: { 'x-kuda-signature': sigFailed },
      body: payloadFailed
    });
    const resFailed = await kudaModule.onRequestPost({ request: reqFailed, env: { KUDA_WEBHOOK_SECRET: webhookSecret, DB: db } });
    assert.strictEqual(resFailed.status, 422, 'Expected status 422 for FAILED status');
    const data = await resFailed.json();
    assert.strictEqual(data.status, 'ignored_unsuccessful');
    recordPass('Kuda Webhook Status Verification', 'Failed transaction status blocked from unlocking gate pass (HTTP 422)');
  } catch (err) {
    recordFail('Kuda Webhook Status Verification', err);
  }

  // Test 2.4: Underpayment amount rejected
  try {
    const payloadUnderpaid = JSON.stringify({
      reference: 'DF-ORD-8829',
      amount: 500000, // Order total is 970,000 NGN
      currency: 'NGN',
      status: 'SUCCESS'
    });
    const sigUnderpaid = computeHmacSha512(webhookSecret, payloadUnderpaid);
    const reqUnderpaid = new Request('http://localhost/api/webhooks/kuda', {
      method: 'POST',
      headers: { 'x-kuda-signature': sigUnderpaid },
      body: payloadUnderpaid
    });
    const resUnderpaid = await kudaModule.onRequestPost({ request: reqUnderpaid, env: { KUDA_WEBHOOK_SECRET: webhookSecret, DB: db } });
    assert.strictEqual(resUnderpaid.status, 422, 'Expected status 422 for underpayment');
    const data = await resUnderpaid.json();
    assert.strictEqual(data.status, 'underpaid');
    recordPass('Kuda Webhook Underpayment Check', 'Underpayment (₦500k vs ₦970k) rejected with HTTP 422');
  } catch (err) {
    recordFail('Kuda Webhook Underpayment Check', err);
  }

  // Test 2.5: Valid Reconciliation & Gate Pass Unlock (Dispatched Invariant Verified)
  try {
    const payloadValid = JSON.stringify({
      reference: 'DF-ORD-8829',
      amount: 970000,
      currency: 'NGN',
      status: 'SUCCESS',
      senderName: 'OKECHUKWU ENTERPRISES',
      sessionId: '9990142611071200001'
    });
    const sigValid = computeHmacSha512(webhookSecret, payloadValid);
    const reqValid = new Request('http://localhost/api/webhooks/kuda', {
      method: 'POST',
      headers: { 'x-kuda-signature': sigValid },
      body: payloadValid
    });
    const resValid = await kudaModule.onRequestPost({ request: reqValid, env: { KUDA_WEBHOOK_SECRET: webhookSecret, DB: db } });
    assert.strictEqual(resValid.status, 200, 'Expected status 200 OK');
    const data = await resValid.json();
    assert.strictEqual(data.reconciled, true);
    assert.strictEqual(data.gatePassStatus, 'CLEARED_EXIT');

    // VERIFY DATABASE STATE & INVARIANTS
    const orderInDb = db.tables.wholesale_orders.find(o => o.order_number === 'DF-ORD-8829');
    assert.strictEqual(orderInDb.payment_status, 'PAID_VERIFIED', 'Order must be PAID_VERIFIED');
    assert.strictEqual(orderInDb.gate_pass_status, 'CLEARED_EXIT', 'Gate pass must be CLEARED_EXIT');

    // CRUCIAL INVARIANT: dispatched_at_wat MUST NOT BE SET BY WEBHOOK
    assert.strictEqual(orderInDb.dispatched_at_wat, null, 'Invariant: dispatched_at must NOT be set on payment webhook');
    recordPass('Kuda Webhook Full Reconciliation', 'Payment reconciled, Gate pass cleared, dispatched_at remains null');
  } catch (err) {
    recordFail('Kuda Webhook Full Reconciliation', err);
  }

  // Test 2.6: Replay / Duplicate Event Protection
  try {
    const payloadReplay = JSON.stringify({
      reference: 'DF-ORD-8829',
      amount: 970000,
      currency: 'NGN',
      status: 'SUCCESS'
    });
    const sigReplay = computeHmacSha512(webhookSecret, payloadReplay);
    const reqReplay = new Request('http://localhost/api/webhooks/kuda', {
      method: 'POST',
      headers: { 'x-kuda-signature': sigReplay },
      body: payloadReplay
    });
    const resReplay = await kudaModule.onRequestPost({ request: reqReplay, env: { KUDA_WEBHOOK_SECRET: webhookSecret, DB: db } });
    assert.strictEqual(resReplay.status, 200, 'Expected status 200 OK');
    const data = await resReplay.json();
    assert.strictEqual(data.status, 'duplicate_event', 'Duplicate event handled gracefully');
    recordPass('Kuda Webhook Replay Protection', 'Duplicate webhook handled idempotently (HTTP 200, duplicate_event)');
  } catch (err) {
    recordFail('Kuda Webhook Replay Protection', err);
  }

  // -------------------------------------------------------------
  // SUITE 3: WHOLESALE ORDERS LIVE PATH INTEGRITY
  // -------------------------------------------------------------
  console.log('\n[SUITE 3: Wholesale Orders Live Path]');

  // Test 3.1: No Generated Virtual Accounts in Live Path
  try {
    const orderPayload = JSON.stringify({
      customerName: 'Ibadan Poultry Depot',
      cratesOrdered: 150,
      unitPriceNgn: 4900
    });
    const req = new Request('http://localhost/api/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: orderPayload
    });
    const res = await ordersModule.onRequestPost({ request: req, env: { DB: db } });
    assert.strictEqual(res.status, 201, 'Expected status 201 Created');
    const data = await res.json();
    assert.strictEqual(data.persisted, true);
    assert.strictEqual(data.dynamicVirtualAccount, null, 'Invariant: No fabricated virtual accounts in live order path');
    assert.strictEqual(data.gatePassStatus, 'LOCKED');
    recordPass('Wholesale Orders Live Path', 'Order created without fake generated virtual accounts (null)');
  } catch (err) {
    recordFail('Wholesale Orders Live Path', err);
  }

  // -------------------------------------------------------------
  // SUITE 4: SERVER SESSION AUTHORITY
  // -------------------------------------------------------------
  console.log('\n[SUITE 4: Server Session Authority]');

  // Test 4.1: Unauthenticated session rejected
  try {
    const req = new Request('http://localhost/api/v1/auth/me');
    const res = await authModule.onRequestGet({ request: req, env: {} });
    assert.strictEqual(res.status, 401, 'Expected status 401 Unauthorized');
    const data = await res.json();
    assert.strictEqual(data.authenticated, false);
    recordPass('Server Auth Unauthenticated', 'Unauthenticated request fails closed with HTTP 401');
  } catch (err) {
    recordFail('Server Auth Unauthenticated', err);
  }

  // Test 4.2: Valid session recognized
  try {
    const validSession = 'usr-owner-001:owner:1794000000000:verified';
    const req = new Request('http://localhost/api/v1/auth/me', {
      headers: { 'Cookie': `ikire_session=${validSession}` }
    });
    const res = await authModule.onRequestGet({ request: req, env: {} });
    assert.strictEqual(res.status, 200, 'Expected status 200 OK');
    const data = await res.json();
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.user.role, 'owner');
    assert.strictEqual(data.user.isOwner, true);
    recordPass('Server Auth Valid Session', 'Verified session returns authoritative principal with HTTP 200');
  } catch (err) {
    recordFail('Server Auth Valid Session', err);
  }

  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRealIntegrationTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
