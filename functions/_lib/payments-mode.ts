/**
 * PAYMENTS MODE — single source of truth for "simulated" vs "live".
 *
 * - simulated : fake lookups/transfers (demo data). Default.
 * - live      : real bank provider only. If provider credentials are missing the
 *               request FAILS CLOSED (never returns a fake success).
 *
 * Persisted in D1 table `system_settings` (key = 'payments_mode').
 */
export type PaymentsMode = 'simulated' | 'live';

export interface ModeEnv {
  DB?: D1Database;
  KUDA_API_KEY?: string;
  KUDA_CLIENT_KEY?: string;
  PAYMENTS_ADMIN_PIN?: string;
}

export async function readMode(env: ModeEnv): Promise<{ mode: PaymentsMode; persisted: boolean }> {
  if (!env.DB) return { mode: 'simulated', persisted: false };
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`
    ).run();
    const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = 'payments_mode'`).first<{ value: string }>();
    return { mode: row?.value === 'live' ? 'live' : 'simulated', persisted: true };
  } catch {
    return { mode: 'simulated', persisted: false };
  }
}

export async function writeMode(env: ModeEnv, mode: PaymentsMode): Promise<boolean> {
  if (!env.DB) return false;
  await readMode(env);
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('payments_mode', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(mode, new Date().toISOString()).run();
  return true;
}

export function liveProviderConfigured(env: ModeEnv): boolean {
  return Boolean(env.KUDA_API_KEY && env.KUDA_CLIENT_KEY);
}

export function liveBlockedResponse(reason: string): Response {
  return new Response(
    JSON.stringify({ status: 'failed', mode: 'live', error: reason }),
    { status: 503, headers: { 'content-type': 'application/json' } }
  );
}
