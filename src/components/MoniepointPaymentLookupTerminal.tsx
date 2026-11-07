import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Radio,
  Volume2,
  Search,
  Lock,
  Unlock,
  RefreshCw,
  Landmark,
} from 'lucide-react';
import { formatNaira } from '../lib/temporal.ts';
import {
  type PaymentLookupStage,
  type NibssLookupResult,
  provisionDynamicVirtualAccount,
  lookupNibssSessionId,
  playPosPaymentChime,
} from '../lib/moniepoint-nip-payment-engine.ts';
import { Panel, Btn, Chip } from './portal/Common';

export interface MoniepointLookupTarget {
  id: string;
  orderNumber: string;
  customerName: string;
  expectedAmountNgn: number;
  cratesCount?: number;
  defaultSessionId?: string;
}

interface MoniepointPaymentLookupTerminalProps {
  target: MoniepointLookupTarget;
  onPaymentVerified?: (result: NibssLookupResult) => void;
  compact?: boolean;
}

export const MoniepointPaymentLookupTerminal: React.FC<MoniepointPaymentLookupTerminalProps> = ({
  target,
  onPaymentVerified,
}) => {
  const virtualAccount = provisionDynamicVirtualAccount(
    target.orderNumber,
    target.customerName,
    target.expectedAmountNgn
  );

  const [sessionIdInput, setSessionIdInput] = useState<string>(
    target.defaultSessionId || '000013261106094812000481928310'
  );
  const [stage, setStage] = useState<PaymentLookupStage>('confirmed');
  const [lookupResult, setLookupResult] = useState<NibssLookupResult>({
    stage: 'confirmed',
    sessionId: target.defaultSessionId || '000013261106094812000481928310',
    rrn: '000481928310',
    amountCreditedNgn: target.expectedAmountNgn,
    verifiedSenderName: target.customerName.toUpperCase(),
    originatorBank: 'Moniepoint MFB → Providus VA Pool',
    channel: 'Moniepoint MFB NIP',
    orderNumber: target.orderNumber,
    gatePassId: 'GP-9924',
    settledTimestampWat: '09:48:12 AM WAT',
    provenanceLabel: 'Live NIBSS API',
  });
  const [copiedVa, setCopiedVa] = useState<boolean>(false);
  const [isRunningSequence, setIsRunningSequence] = useState<boolean>(false);

  useEffect(() => {
    setLookupResult((prev) => ({
      ...prev,
      amountCreditedNgn: target.expectedAmountNgn,
      verifiedSenderName: target.customerName.toUpperCase(),
      orderNumber: target.orderNumber,
    }));
  }, [target.orderNumber, target.customerName, target.expectedAmountNgn]);

  const handleCopyVa = () => {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(virtualAccount.accountNumber);
    }
    setCopiedVa(true);
    setTimeout(() => setCopiedVa(false), 2000);
  };

  const runAnimatedLookup = async (simulateFake = false) => {
    if (isRunningSequence) return;
    setIsRunningSequence(true);

    setStage('listening');
    playPosPaymentChime('ping');

    await new Promise((r) => setTimeout(r, 750));

    setStage('kyc_check');
    playPosPaymentChime('ping');

    await new Promise((r) => setTimeout(r, 850));

    const res = await lookupNibssSessionId({
      sessionId: simulateFake ? '00000000FAKE99182736' : sessionIdInput,
      orderNumber: target.orderNumber,
      expectedAmountNgn: target.expectedAmountNgn,
      expectedCustomerName: target.customerName,
      simulateFakeAlert: simulateFake,
    });

    setLookupResult(res);
    setStage(res.stage);
    setIsRunningSequence(false);

    if (res.stage === 'confirmed') {
      playPosPaymentChime('confirmed');
      if (onPaymentVerified) {
        onPaymentVerified(res);
      }
    } else {
      playPosPaymentChime('fraud_alert');
    }
  };

  return (
    <div className="grid2">
      {/* Left Panel: Dynamic Virtual Account & NIBSS 30-Digit Session ID Lookup Desk */}
      <Panel
        title="Customer Payment Lookup & Anti-Fake-Alert Desk"
        description={`Session-tied virtual account & 30-digit NIBSS verification for ${target.orderNumber} (${formatNaira(target.expectedAmountNgn)})`}
        actions={
          <Chip tone="blue">
            <Radio size={12} /> Webhook Listening ({virtualAccount.expiresInMinutes}m)
          </Chip>
        }
      >
        <div className="stack">
          <div className="panel" style={{ background: '#f6faf7', borderColor: '#cde0d6' }}>
            <div className="row between wrap">
              <div>
                <span className="eyebrow">
                  <Landmark size={13} /> SESSION-TIED VIRTUAL ACCOUNT ({virtualAccount.bankName})
                </span>
                <h3 style={{ marginTop: 6, fontSize: '1.35rem', letterSpacing: '0.03em' }}>
                  {virtualAccount.accountNumber.slice(0, 4)} {virtualAccount.accountNumber.slice(4, 7)}{' '}
                  {virtualAccount.accountNumber.slice(7)}
                </h3>
                <div className="metadata">
                  Beneficiary: <strong>{virtualAccount.accountName}</strong> · Ref: {virtualAccount.reservationReference}
                </div>
              </div>
              <Btn small onClick={handleCopyVa}>
                {copiedVa ? <Check size={14} /> : <Copy size={14} />}
                {copiedVa ? 'Copied VA' : 'Copy VA'}
              </Btn>
            </div>
          </div>

          <label className="field">
            <span>NIBSS 30-Digit Session ID / Moniepoint Transfer Reference</span>
            <div className="row wrap">
              <input
                type="text"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                placeholder="Enter 30-digit NIBSS Session ID…"
                style={{ flex: 1 }}
              />
              <Btn primary disabled={isRunningSequence} onClick={() => void runAnimatedLookup(false)}>
                <RefreshCw size={15} /> Verify &amp; Lookup
              </Btn>
              <Btn disabled={isRunningSequence} onClick={() => void runAnimatedLookup(true)}>
                <ShieldAlert size={15} /> Test Fake Alert
              </Btn>
            </div>
          </label>

          <div className="row between wrap" style={{ paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <span className="metadata">Inspect Verification States:</span>
            <div className="row wrap">
              <Btn
                small
                primary={stage === 'listening'}
                onClick={() => {
                  setStage('listening');
                  playPosPaymentChime('ping');
                }}
              >
                1. Radar Listening
              </Btn>
              <Btn
                small
                primary={stage === 'kyc_check'}
                onClick={() => {
                  setStage('kyc_check');
                  playPosPaymentChime('ping');
                }}
              >
                2. Sender KYC Lookup
              </Btn>
              <Btn
                small
                primary={stage === 'confirmed'}
                onClick={() => {
                  setStage('confirmed');
                  playPosPaymentChime('confirmed');
                }}
              >
                3. Payment Confirmed ✓
              </Btn>
              <Btn small primary={stage === 'fake_alert_rejected'} onClick={() => void runAnimatedLookup(true)}>
                4. Fake Alert Blocked
              </Btn>
            </div>
          </div>
        </div>
      </Panel>

      {/* Right Panel: Live Webhook & Gate Pass Release Telemetry */}
      <Panel
        title="Moniepoint / NIBSS NIP Live Settlement Telemetry"
        description="Real-time sender BVN name verification and automated security gate pass clearance"
        actions={
          <Chip tone={stage === 'fake_alert_rejected' ? 'red' : stage === 'kyc_check' ? 'amber' : 'green'}>
            <Volume2 size={12} /> POS Audio Active
          </Chip>
        }
      >
        <div className="stack">
          <div
            className="panel"
            style={{
              background:
                stage === 'fake_alert_rejected'
                  ? '#fdf3f2'
                  : stage === 'kyc_check'
                    ? '#fefaf0'
                    : '#f2faf6',
              borderColor:
                stage === 'fake_alert_rejected'
                  ? '#e8b4b0'
                  : stage === 'kyc_check'
                    ? '#e8d09c'
                    : '#9fd3bd',
            }}
          >
            <div className="row between wrap">
              <Chip tone={stage === 'fake_alert_rejected' ? 'red' : stage === 'kyc_check' ? 'amber' : 'green'}>
                {stage === 'listening' && 'QUERYING NIBSS NIP STREAM…'}
                {stage === 'kyc_check' && 'VERIFYING SENDER BVN NAME…'}
                {stage === 'confirmed' && 'NIP TRANSFER CONFIRMED ✓'}
                {stage === 'fake_alert_rejected' && 'FAKE ALERT BLOCKED · 0 NIBSS RECORD'}
              </Chip>
              <span className="metadata">{lookupResult.settledTimestampWat}</span>
            </div>

            <h3 style={{ marginTop: 10, fontSize: '1.5rem' }}>
              {stage === 'listening' && `Awaiting ${formatNaira(target.expectedAmountNgn)}`}
              {stage === 'kyc_check' && `${formatNaira(target.expectedAmountNgn)} Incoming`}
              {stage === 'confirmed' && formatNaira(lookupResult.amountCreditedNgn)}
              {stage === 'fake_alert_rejected' && '₦0.00 CREDITED'}
            </h3>
            <p className="muted" style={{ marginTop: 4 }}>
              {stage === 'fake_alert_rejected'
                ? lookupResult.failureReason
                : `Matched to ${target.orderNumber} (${target.customerName})`}
            </p>
          </div>

          <dl className="identity-facts">
            <div>
              <dt>Verified Sender Name</dt>
              <dd>{stage === 'fake_alert_rejected' ? 'NO SENDER RECORD FOUND' : target.customerName.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Originator Channel</dt>
              <dd>{lookupResult.originatorBank}</dd>
            </div>
            <div>
              <dt>NIBSS 30-Digit Session ID</dt>
              <dd>
                {sessionIdInput.slice(0, 10)}…{sessionIdInput.slice(-8)}
              </dd>
            </div>
            <div>
              <dt>Security Gate Release</dt>
              <dd>
                {stage === 'confirmed' ? (
                  <Chip>
                    <Unlock size={12} /> PASS #{lookupResult.gatePassId} UNLOCKED ✓
                  </Chip>
                ) : (
                  <Chip tone="red">
                    <Lock size={12} /> GATE PASS LOCKED (HOLD TRUCK)
                  </Chip>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </Panel>
    </div>
  );
};
