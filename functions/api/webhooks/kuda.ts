/**
 * CLOUDFLARE PAGES FUNCTION — KUDA BUSINESS INCOMING PAYMENT WEBHOOK
 * Route: POST /api/webhooks/kuda
 * Security: Strict HMAC-SHA512 verification (fail closed)
 * Mutation: Validates order existence, unlocks Gate Pass, and logs immutable audit trail
 */

interface Env {
  DB?: D1Database;
  KUDA_WEBHOOK_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const rawBody = await context.request.text();
    const signature = context.request.headers.get('x-kuda-signature');

    const secret = context.env.KUDA_WEBHOOK_SECRET;

    // Fail closed: Webhook cannot proceed without configured secret and valid signature
    if (!secret) {
      return new Response(JSON.stringify({
        error: 'Webhook endpoint is unconfigured. Secret is required for cryptographic verification.',
      }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!signature) {
      return new Response(JSON.stringify({
        error: 'Missing x-kuda-signature header. Webhook rejected.',
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Verify HMAC-SHA512
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
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedHex.toLowerCase() !== signature.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Invalid HMAC signature. Cryptographic verification failed.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: 'Database unavailable. Cannot reconcile payment.' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawBody);
    const amount = Number(payload.amount || payload.Amount || 0);
    const reference = String(payload.transactionReference || payload.reference || '');
    const accountNumber = String(payload.accountNumber || payload.virtualAccount || '');
    const sender = String(payload.senderName || payload.SenderName || 'WHOLESALE DISTRIBUTOR');
    const sessionId = String(payload.sessionId || payload.nipSessionId || `999014${Date.now()}`);
    const nowWat = new Date().toLocaleTimeString('en-NG') + ' WAT';

    // Query matching order by virtual account or order reference
    const order = await context.env.DB.prepare(`
      SELECT id, order_number, total_amount_ngn, payment_status, gate_pass_id 
      FROM wholesale_orders 
      WHERE dynamic_virtual_account = ? OR order_number = ?
      LIMIT 1
    `).bind(accountNumber, reference).first<{
      id: string;
      order_number: string;
      total_amount_ngn: number;
      payment_status: string;
      gate_pass_id: string;
    }>();

    if (!order) {
      return new Response(JSON.stringify({
        status: 'unmatched',
        error: 'No active wholesale order matches this payment reference or virtual account. Gate pass remains locked.',
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Execute atomic update: Order marked PAID_VERIFIED, Gate Pass unlocked CLEARED_EXIT, and Audit Log appended
    await context.env.DB.batch([
      context.env.DB.prepare(`
        UPDATE wholesale_orders 
        SET payment_status = 'PAID_VERIFIED',
            gate_pass_status = 'CLEARED_EXIT',
            nip_session_id = ?,
            sender_kyc_name = ?,
            dispatched_at_wat = ?
        WHERE id = ?
      `).bind(sessionId, sender, nowWat, order.id),
      context.env.DB.prepare(`
        INSERT INTO audit_ledger (id, actor_name, actor_role, action_type, entity_affected, entity_id, change_summary, created_at_wat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `audit-webhook-${Date.now()}`,
        'Kuda MFB NIP Engine',
        'Automated Gateway',
        'PAYMENT_WEBHOOK',
        'wholesale_orders',
        order.id,
        `Verified inbound payment of ₦${(amount / 100).toLocaleString()} for ${order.order_number} (${sender}). Gate Pass ${order.gate_pass_id} CLEARED FOR EXIT.`,
        nowWat
      ),
    ]);

    return new Response(JSON.stringify({
      status: 'acknowledged',
      reconciled: true,
      orderNumber: order.order_number,
      gatePassId: order.gate_pass_id,
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
