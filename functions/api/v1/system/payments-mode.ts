import { liveProviderConfigured, readMode, writeMode, type ModeEnv, type PaymentsMode } from '../../../_lib/payments-mode';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** GET /api/v1/system/payments-mode */
export const onRequestGet: PagesFunction<ModeEnv> = async ({ env }) => {
  const { mode, persisted } = await readMode(env);
  return json({ mode, persisted, liveProviderConfigured: liveProviderConfigured(env), pinRequired: Boolean(env.PAYMENTS_ADMIN_PIN) });
};

/** POST /api/v1/system/payments-mode  { mode: 'simulated' | 'live', pin?: string } */
export const onRequestPost: PagesFunction<ModeEnv> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { mode?: PaymentsMode; pin?: string };
  if (body.mode !== 'simulated' && body.mode !== 'live') return json({ error: 'mode must be "simulated" or "live".' }, 400);
  if (env.PAYMENTS_ADMIN_PIN && body.pin !== env.PAYMENTS_ADMIN_PIN) return json({ error: 'Invalid admin PIN.' }, 403);
  if (!(await writeMode(env, body.mode))) return json({ error: 'No database bound; mode cannot be saved.' }, 503);
  return json({ mode: body.mode, persisted: true, liveProviderConfigured: liveProviderConfigured(env) });
};
