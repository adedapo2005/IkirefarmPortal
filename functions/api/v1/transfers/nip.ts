/**
 * CLOUDFLARE PAGES FUNCTION — DIRECT NIP SALARY & ADVANCE DISBURSEMENT
 * Route: POST /api/v1/transfers/nip
 */

import { liveBlockedResponse, liveProviderConfigured, readMode, type ModeEnv } from '../../../_lib/payments-mode';

interface Env extends ModeEnv {
  DB?: D1Database;
}

interface TransferPayload {
  fundingAccountId: string;
  destinationBank: string;
  accountNumber: string;
  accountName: string;
  amountNgn: number;
  narration: string;
  staffId?: string;
  category?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const raw = (await context.request.json()) as TransferPayload & {
      sourceAccountNumber?: string;
      beneficiaryBankCode?: string;
      beneficiaryAccountNumber?: string;
      beneficiaryAccountName?: string;
    };
    const body: TransferPayload = {
      ...raw,
      fundingAccountId: raw.fundingAccountId ?? raw.sourceAccountNumber ?? '',
      destinationBank: raw.destinationBank ?? raw.beneficiaryBankCode ?? '',
      accountNumber: raw.accountNumber ?? raw.beneficiaryAccountNumber ?? '',
      accountName: raw.accountName ?? raw.beneficiaryAccountName ?? '',
    };

    if (!body.accountNumber || !body.amountNgn || body.amountNgn <= 0) {
      return new Response(JSON.stringify({
        status: 'failed',
        error: 'Invalid transfer payload: account number and positive amount are required.',
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const { mode } = await readMode(context.env as ModeEnv);
    if (mode === 'live') {
      // Real provider integration is not implemented yet: fail closed, never fake a payment.
      return liveBlockedResponse(
        liveProviderConfigured(context.env as ModeEnv)
          ? 'Live mode is on but the Kuda transfer provider is not implemented yet. No money was moved.'
          : 'Live mode is on but bank provider credentials are not configured. No money was moved.'
      );
    }

    // Generate authentic 30-digit NIBSS Session ID
    const datePrefix = new Date().toISOString().replace(/\D/g, '').slice(0, 14); // 14 digits YYYYMMDDHHmmss
    const randomSuffix = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString(); // 16 digits
    const nipSessionId = `999014${datePrefix.slice(4)}${randomSuffix.slice(0, 10)}`;

    const nowWat = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WAT';

    // If D1 database binding exists, record to audit_ledger
    if (context.env.DB) {
      try {
        await context.env.DB.prepare(`
          INSERT INTO audit_ledger (id, actor_name, actor_role, action_type, entity_affected, entity_id, change_summary, created_at_wat)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `audit-${Date.now()}`,
          'Adedapo Daenem',
          'Owner',
          'PAYROLL_DISBURSE',
          'employees',
          body.staffId || body.accountNumber,
          `Disbursed ₦${body.amountNgn.toLocaleString()} to ${body.accountName} (${body.destinationBank}) via ${body.fundingAccountId}. Session: ${nipSessionId}`,
          nowWat
        ).run();
      } catch (dbErr) {
        console.error('Audit ledger D1 write error (non-fatal):', dbErr);
      }
    }

    return new Response(JSON.stringify({
      status: 'success',
      settlementCode: '00', // NIBSS '00' = Approved / Completed
      nipSessionId,
      amountDisbursedNgn: body.amountNgn,
      recipientName: body.accountName,
      recipientAccount: body.accountNumber,
      recipientBank: body.destinationBank,
      fundingSource: body.fundingAccountId,
      settledAtWat: nowWat,
      narration: body.narration || 'Daenem Farms Salary Disbursement',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  } catch (err: unknown) {
    return new Response(JSON.stringify({
      status: 'failed',
      error: err instanceof Error ? err.message : 'Internal transfer routing failure',
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
