/**
 * CLOUDFLARE PAGES FUNCTION — WHOLESALE CUSTOMER ORDERS & GATE PASSES
 * Route: GET & POST /api/v1/orders
 * Authoritative Storage: D1 table `wholesale_orders` + `audit_ledger`
 */

interface Env {
  DB?: D1Database;
}

interface OrderCreatePayload {
  customerName: string;
  customerPhone?: string;
  cratesOrdered: number;
  unitPriceNgn: number;
  paymentChannel?: string;
  driverName?: string;
  vehiclePlate?: string;
  creatorName?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.env.DB) {
    return new Response(JSON.stringify({
      status: 'unavailable',
      error: 'Authoritative D1 database binding is not configured.',
      orders: [],
    }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const { results } = await context.env.DB.prepare(`
      SELECT 
        id,
        order_number AS orderNumber,
        customer_name AS customerName,
        customer_phone AS customerPhone,
        crates_ordered AS cratesOrdered,
        unit_price_ngn AS unitPriceNgn,
        total_amount_ngn AS totalAmountNgn,
        payment_status AS paymentStatus,
        payment_channel AS paymentChannel,
        dynamic_virtual_account AS dynamicVirtualAccount,
        nip_session_id AS nipSessionId,
        sender_kyc_name AS senderKycName,
        gate_pass_id AS gatePassId,
        gate_pass_status AS gatePassStatus,
        driver_name AS driverName,
        vehicle_plate AS vehiclePlate,
        dispatched_at_wat AS dispatchedAtWat,
        created_at AS createdAt
      FROM wholesale_orders 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();

    return new Response(JSON.stringify({
      status: 'success',
      source: 'Cloudflare D1 Production Relational Database',
      orders: results || [],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({
      status: 'error',
      error: err instanceof Error ? err.message : 'D1 query failed',
      orders: [],
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.DB) {
    return new Response(JSON.stringify({
      status: 'error',
      error: 'Authoritative D1 database binding is unavailable. Order cannot be persisted.',
      persisted: false,
    }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const body = (await context.request.json()) as OrderCreatePayload;

    if (!body.customerName || !body.cratesOrdered || body.cratesOrdered <= 0 || !body.unitPriceNgn || body.unitPriceNgn <= 0) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'Customer name, positive crate count, and positive unit price are required.',
      }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      });
    }

    const orderId = `ord-${Date.now()}`;
    const orderNum = `DF-ORD-${Math.floor(8830 + Math.random() * 890)}`;
    const totalNgn = Number(body.cratesOrdered) * Number(body.unitPriceNgn);
    const gatePass = `GP-${orderNum.replace(/\D/g, '')}`;
    const actor = body.creatorName || 'Sales Desk';
    const nowWat = new Date().toLocaleTimeString('en-NG') + ' WAT';

    // Atomic insert of order + audit ledger entry
    // NOTE: dynamic_virtual_account is left NULL until provisioned by real banking integration
    await context.env.DB.batch([
      context.env.DB.prepare(`
        INSERT INTO wholesale_orders (
          id, order_number, customer_name, customer_phone, crates_ordered, unit_price_ngn,
          total_amount_ngn, payment_status, payment_channel, dynamic_virtual_account, gate_pass_id,
          gate_pass_status, driver_name, vehicle_plate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT', ?, NULL, ?, 'LOCKED', ?, ?)
      `).bind(
        orderId, orderNum, body.customerName, body.customerPhone || null,
        Number(body.cratesOrdered), Number(body.unitPriceNgn), totalNgn,
        body.paymentChannel || 'Moniepoint MFB NIP', gatePass,
        body.driverName || 'Awaiting Driver', body.vehiclePlate || 'Awaiting Vehicle'
      ),
      context.env.DB.prepare(`
        INSERT INTO audit_ledger (id, actor_name, actor_role, action_type, entity_affected, entity_id, change_summary, created_at_wat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `audit-${Date.now()}`,
        actor,
        'Sales Officer',
        'ORDER_CREATE',
        'wholesale_orders',
        orderId,
        `Created wholesale order ${orderNum} for ${body.customerName}: ${body.cratesOrdered} crates @ ₦${body.unitPriceNgn} = ₦${totalNgn}`,
        nowWat
      ),
    ]);

    return new Response(JSON.stringify({
      status: 'created',
      persisted: true,
      id: orderId,
      orderNumber: orderNum,
      totalAmountNgn: totalNgn,
      dynamicVirtualAccount: null,
      gatePassId: gatePass,
      gatePassStatus: 'LOCKED',
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });

  } catch (err: unknown) {
    return new Response(JSON.stringify({
      status: 'failed',
      error: err instanceof Error ? err.message : 'Invalid order payload',
      persisted: false,
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
