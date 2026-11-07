/**
 * CLOUDFLARE PAGES FUNCTION — EMPLOYEES & STATUTORY COMPENSATION LEDGER
 * Route: GET & POST /api/v1/payroll/employees
 */

interface Env {
  DB?: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (context.env.DB) {
    try {
      const { results } = await context.env.DB.prepare(`
        SELECT 
          id,
          staff_id AS staffId,
          full_name AS fullName,
          department,
          role_title AS roleTitle,
          basic_salary AS basicSalary,
          housing_allowance AS housingAllowance,
          transport_allowance AS transportAllowance,
          apply_paye AS applyPaye,
          apply_pension AS applyPension,
          apply_nhf AS applyNhf,
          payment_bank AS paymentBank,
          account_number AS accountNumber,
          verified_account_name AS verifiedAccountName,
          kyc_tier AS kycTier,
          status,
          created_at AS createdAt
        FROM employees
        ORDER BY staff_id ASC
      `).all();

      if (results && results.length > 0) {
        return new Response(JSON.stringify({
          status: 'success',
          source: 'Cloudflare D1 Production Relational Database',
          employees: results.map(r => ({
            ...r,
            applyPaye: Boolean(r.applyPaye),
            applyPension: Boolean(r.applyPension),
            applyNhf: Boolean(r.applyNhf),
          })),
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    } catch (e) {
      console.error('D1 employees query error:', e);
    }
  }

  return new Response(JSON.stringify({ status: 'failed', error: 'No database bound or no employees found.' }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.DB) {
    return new Response(JSON.stringify({ status: 'failed', error: 'Database unavailable' }), { status: 503 });
  }

  try {
    const body = await context.request.json() as {
      id: string;
      applyPaye?: boolean;
      applyPension?: boolean;
      applyNhf?: boolean;
    };

    if (!body.id) {
      return new Response(JSON.stringify({ status: 'failed', error: 'Missing employee id' }), { status: 400 });
    }

    await context.env.DB.prepare(`
      UPDATE employees
      SET apply_paye = COALESCE(?, apply_paye),
          apply_pension = COALESCE(?, apply_pension),
          apply_nhf = COALESCE(?, apply_nhf)
      WHERE id = ?
    `).bind(
      body.applyPaye !== undefined ? (body.applyPaye ? 1 : 0) : null,
      body.applyPension !== undefined ? (body.applyPension ? 1 : 0) : null,
      body.applyNhf !== undefined ? (body.applyNhf ? 1 : 0) : null,
      body.id
    ).run();

    return new Response(JSON.stringify({ status: 'success', updated: body.id }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'failed', error: String(err) }), { status: 500 });
  }
};
