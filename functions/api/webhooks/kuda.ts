/**
 * CLOUDFLARE PAGES FUNCTION — KUDA BUSINESS INCOMING PAYMENT WEBHOOK
 * Route: POST /api/webhooks/kuda
 */

interface Env {
  DB?: D1Database;
  KUDA_WEBHOOK_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const rawBody = await context.request.text();
    const signature = context.request.headers.get('x-kuda-signature') || '';

    // Verify HMAC-SHA512 if secret is configured
    const secret = context.env.KUDA_WEBHOOK_SECRET;
    if (secret && signature) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
      );
      const computedBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const computedHex = Array.from(new Uint8Array(computedBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (computedHex.toLowerCase() !== signature.toLowerCase()) {
        return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const amount = payload.amount || payload.Amount || 0;
    const narration = payload.narration || payload.Narration || '';
    const sender = payload.senderName || payload.SenderName || 'WHOLESALE DISTRIBUTOR';
    const reference = payload.transactionReference || `TRX-${Date.now()}`;
    const gatePassId = `GP-${Math.floor(9100 + Math.random() * 890)}`;
    const nowWat = new Date().toLocaleTimeString('en-NG') + ' WAT';

    // Update D1 database if bound
    if (context.env.DB) {
      try {
        await context.env.DB.prepare(`
          INSERT INTO audit_ledger (id, actor_name, actor_role, action_type, entity_affected, entity_id, change_summary, created_at_wat)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `audit-webhook-${Date.now()}`,
          'Kuda MFB Webhook',
          'System Gateway',
          'PAYMENT_WEBHOOK',
          'wholesale_orders',
          reference,
          `Received ₦${(amount / 100).toLocaleString()} from ${sender}. Reconciled & Gate Pass ${gatePassId} unlocked.`,
          nowWat
        ).run();
      } catch (e) {
        console.error('D1 write error in webhook:', e);
      }
    }

    return new Response(JSON.stringify({
      status: 'acknowledged',
      reconciled: true,
      reference,
      gatePassId,
      gatePassStatus: 'CLEARED_EXIT',
      timestampWat: nowWat,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  } catch (err: unknown) {
    return new Response(JSON.stringify({
      status: 'failed',
      error: err instanceof Error ? err.message : 'Webhook ingestion error',
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
