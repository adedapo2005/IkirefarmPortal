/**
 * CLOUDFLARE PAGES FUNCTION — DAILY PEN REGISTER & FLOCK CONSERVATION
 * Route: GET & POST /api/v1/operations/daily-register
 * Enforces: Opening - Mortality - Culls - Transfers = Closing
 * Authoritative Storage: D1 table `daily_pen_logs` + `flocks` + `audit_ledger`
 */

interface Env {
  DB?: D1Database;
}

interface DailyPenRecordPayload {
  penNumber: string;
  flockId?: string;
  logDate?: string;
  openingBirds: number;
  mortalityCount?: number;
  cullsCount?: number;
  transfersOut?: number;
  closingBirds: number;
  eggsCollectedGood?: number;
  eggsDamaged?: number;
  eggsRejected?: number;
  feedConsumedKg?: number;
  waterConsumedLitres?: number;
  ambientTempC?: number;
  relativeHumidityPct?: number;
  thiIndex?: number;
  recordedBy: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // If D1 is bound, query live records; fail closed if DB query fails
  if (!context.env.DB) {
    return new Response(JSON.stringify({
      status: 'unavailable',
      error: 'Authoritative D1 database binding is not configured.',
      records: [],
      totalFlockSize: 0,
      averageLayPercentage: 0,
      totalEggsToday: 0,
      totalMortalityToday: 0,
    }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const { results } = await context.env.DB.prepare(`
      SELECT 
        id,
        flock_id AS flockId,
        pen_number AS penNumber,
        log_date AS logDate,
        opening_birds AS openingBirds,
        mortality_count AS mortalityCount,
        culls_count AS cullsCount,
        transfers_out AS transfersOut,
        closing_birds AS closingBirds,
        eggs_collected_good AS eggsCollectedGood,
        eggs_damaged AS eggsDamaged,
        eggs_rejected AS eggsRejected,
        feed_consumed_kg AS feedConsumedKg,
        water_consumed_litres AS waterConsumedLitres,
        ambient_temp_c AS ambientTempC,
        relative_humidity_pct AS relativeHumidityPct,
        thi_heat_stress_index AS thiIndex,
        recorded_by AS recordedBy,
        created_at AS createdAt
      FROM daily_pen_logs 
      ORDER BY log_date DESC, created_at DESC 
      LIMIT 100
    `).all();

    const records = results || [];

    // Calculate genuine aggregates from actual records
    const totalFlockSize = records.reduce((sum, r) => sum + (Number((r as any).closingBirds) || 0), 0);
    const totalEggsToday = records.reduce((sum, r) => sum + (Number((r as any).eggsCollectedGood) || 0), 0);
    const totalMortalityToday = records.reduce((sum, r) => sum + (Number((r as any).mortalityCount) || 0), 0);
    const totalOpening = records.reduce((sum, r) => sum + (Number((r as any).openingBirds) || 0), 0);
    const averageLayPercentage = totalOpening > 0 ? Number(((totalEggsToday / totalOpening) * 100).toFixed(1)) : 0;

    return new Response(JSON.stringify({
      status: 'success',
      source: 'Cloudflare D1 Production Relational Database',
      totalFlockSize,
      averageLayPercentage,
      totalEggsToday,
      totalMortalityToday,
      records,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({
      status: 'error',
      error: err instanceof Error ? err.message : 'D1 query failed',
      records: [],
      totalFlockSize: 0,
      averageLayPercentage: 0,
      totalEggsToday: 0,
      totalMortalityToday: 0,
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // Fail closed: cannot persist without database
  if (!context.env.DB) {
    return new Response(JSON.stringify({
      status: 'error',
      error: 'Authoritative D1 database binding is unavailable. Shift record cannot be persisted.',
      persisted: false,
    }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const body = (await context.request.json()) as DailyPenRecordPayload;

    const opening = Number(body.openingBirds) || 0;
    const mortality = Number(body.mortalityCount) || 0;
    const culls = Number(body.cullsCount) || 0;
    const transfers = Number(body.transfersOut) || 0;
    const closing = Number(body.closingBirds);

    // Negative counts check
    if (opening < 0 || mortality < 0 || culls < 0 || transfers < 0 || closing < 0) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'Biological counts must be non-negative numbers.',
      }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Mathematical Conservation Invariant Check
    // Equation: Opening - Mortality - Culls - Transfers = Closing
    const calculatedClosing = opening - mortality - culls - transfers;
    if (calculatedClosing !== closing) {
      return new Response(JSON.stringify({
        status: 'error',
        error: `Mathematical Conservation Error: Opening (${opening}) - Mortality (${mortality}) - Culls (${culls}) - Transfers (${transfers}) = ${calculatedClosing}, but stated closing stock is ${closing}. Headcount must balance exactly.`,
      }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      });
    }

    const logId = `log-${Date.now()}`;
    const logDate = body.logDate || new Date().toISOString().split('T')[0];
    const flockId = body.flockId || 'flk-1';
    const recordedBy = body.recordedBy || 'Authorized Operator';
    const nowWat = new Date().toLocaleTimeString('en-NG') + ' WAT';

    // Execute atomic D1 insert & audit trail
    await context.env.DB.batch([
      context.env.DB.prepare(`
        INSERT INTO daily_pen_logs (
          id, flock_id, pen_number, log_date, opening_birds, mortality_count, culls_count, transfers_out, closing_birds,
          eggs_collected_good, eggs_damaged, eggs_rejected, feed_consumed_kg, water_consumed_litres,
          ambient_temp_c, relative_humidity_pct, thi_heat_stress_index, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logId, flockId, body.penNumber, logDate, opening, mortality,
        culls, transfers, closing, Number(body.eggsCollectedGood) || 0, Number(body.eggsDamaged) || 0,
        Number(body.eggsRejected) || 0, Number(body.feedConsumedKg) || 0, Number(body.waterConsumedLitres) || 0,
        body.ambientTempC ?? null, body.relativeHumidityPct ?? null,
        body.thiIndex ?? null, recordedBy
      ),
      context.env.DB.prepare(`
        INSERT INTO audit_ledger (id, actor_name, actor_role, action_type, entity_affected, entity_id, change_summary, created_at_wat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `audit-${Date.now()}`,
        recordedBy,
        'Shift Attendant',
        'PEN_RECORD_CREATE',
        'daily_pen_logs',
        logId,
        `Logged shift for ${body.penNumber}: Opening ${opening}, Mortality ${mortality}, Culls ${culls}, Closing ${closing}`,
        nowWat
      ),
    ]);

    return new Response(JSON.stringify({
      status: 'success',
      id: logId,
      message: 'Pen shift record verified and permanently persisted to D1.',
      persisted: true,
      balanced: true,
      closingBirds: closing,
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });

  } catch (err: unknown) {
    return new Response(JSON.stringify({
      status: 'failed',
      error: err instanceof Error ? err.message : 'Failed to persist pen register record',
      persisted: false,
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
