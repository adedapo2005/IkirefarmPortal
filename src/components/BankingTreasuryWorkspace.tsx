import React, { useState } from 'react';
import { 
  Landmark, CreditCard, ArrowDownLeft, ArrowUpRight, Search, 
  CheckCircle2, Clock, AlertTriangle, ShieldCheck, DollarSign,
  Building2, RefreshCw, FileText, Check
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../lib/temporal.ts';

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  ledgerBalance: number;
  availableBalance: number;
  lastSyncWAT: string;
  status: 'Active & Connected' | 'Sync Delayed';
}

interface BankTransaction {
  id: string;
  reference: string;
  channel: 'Providus Direct' | 'Monnify Dynamic VA' | 'Zenith NIP' | 'GTBank NIP';
  type: 'Credit' | 'Debit';
  amount: number;
  payerOrBeneficiary: string;
  purpose: string;
  timestampWAT: string;
  reconciliationStatus: 'Matched to Order' | 'Unmatched Credit' | 'Operating Expense';
  matchedDocId?: string;
}

const ACCOUNTS: BankAccount[] = [
  {
    id: 'ba-01',
    bankName: 'Providus Bank',
    accountNumber: '1100482910',
    accountType: 'Automated Wholesale Virtual Accounts Pool',
    ledgerBalance: 34500000,
    availableBalance: 34500000,
    lastSyncWAT: '06 Nov 2026, 12:45 PM WAT',
    status: 'Active & Connected',
  },
  {
    id: 'ba-02',
    bankName: 'Zenith Bank PLC',
    accountNumber: '1014928471',
    accountType: 'Operating Main & Grain Procurement',
    ledgerBalance: 18240500,
    availableBalance: 18240500,
    lastSyncWAT: '06 Nov 2026, 12:30 PM WAT',
    status: 'Active & Connected',
  },
  {
    id: 'ba-03',
    bankName: 'Guaranty Trust Bank (GTB)',
    accountNumber: '0284918274',
    accountType: 'Payroll & Statutory Tax Escrow',
    ledgerBalance: 9850000,
    availableBalance: 9850000,
    lastSyncWAT: '06 Nov 2026, 12:00 PM WAT',
    status: 'Active & Connected',
  },
];

const TRANSACTIONS: BankTransaction[] = [
  {
    id: 'tx-501',
    reference: 'PROV-CR-20261106-9921',
    channel: 'Providus Direct',
    type: 'Credit',
    amount: 1750000,
    payerOrBeneficiary: 'Alhaji Musa Agro-Allied',
    purpose: 'Payment for 500 Crates Eggs (ORD-2026-892)',
    timestampWAT: '06 Nov 2026, 09:28 AM WAT',
    reconciliationStatus: 'Matched to Order',
    matchedDocId: 'ORD-2026-892',
  },
  {
    id: 'tx-502',
    reference: 'MONN-VA-20261106-8812',
    channel: 'Monnify Dynamic VA',
    type: 'Credit',
    amount: 864000,
    payerOrBeneficiary: 'Heritage Supermarkets Hub',
    purpose: 'Payment for 240 Crates Eggs (ORD-2026-891)',
    timestampWAT: '06 Nov 2026, 08:42 AM WAT',
    reconciliationStatus: 'Matched to Order',
    matchedDocId: 'ORD-2026-891',
  },
  {
    id: 'tx-503',
    reference: 'ZEN-NIP-20261106-4419',
    channel: 'Zenith NIP',
    type: 'Credit',
    amount: 1225000,
    payerOrBeneficiary: 'Madam Grace Egg Depot',
    purpose: 'Wholesale Egg Advance (Awaiting Teller Verification)',
    timestampWAT: '06 Nov 2026, 07:10 AM WAT',
    reconciliationStatus: 'Unmatched Credit',
    matchedDocId: 'Pending Match',
  },
  {
    id: 'tx-504',
    reference: 'ZEN-DR-20261105-1102',
    channel: 'Zenith NIP',
    type: 'Debit',
    amount: 4500000,
    payerOrBeneficiary: 'Olam Grains Nigeria Ltd',
    purpose: 'Yellow Maize Bulk Intake - 30 Metric Tonnes (PO-2026-088)',
    timestampWAT: '05 Nov 2026, 03:15 PM WAT',
    reconciliationStatus: 'Operating Expense',
    matchedDocId: 'PO-2026-088',
  },
];

export const BankingTreasuryWorkspace: React.FC = () => {
  const [transactions, setTransactions] = useState<BankTransaction[]>(TRANSACTIONS);
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalLiquidity = ACCOUNTS.reduce((sum, acc) => sum + acc.availableBalance, 0);

  const handleMatchOrder = (txId: string) => {
    setTransactions(transactions.map(t => {
      if (t.id === txId) {
        return {
          ...t,
          reconciliationStatus: 'Matched to Order',
          matchedDocId: 'ORD-2026-890 (Reconciled)',
        };
      }
      return t;
    }));
    setToastMessage(`Transaction ${txId} successfully 3-way matched to Customer Order!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredTx = transactions.filter(t => {
    const matchesChannel = selectedChannelFilter === 'all' || t.channel.includes(selectedChannelFilter);
    const matchesSearch = t.payerOrBeneficiary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Finance & Banking</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Treasury & Bank Feeds</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Landmark className="w-6 h-6 text-[#008751]" />
            Corporate Treasury & Nigerian Banking Feeds
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-bank feeds (Providus, Zenith, GTBank), Monnify automated credit webhooks, and 3-way order-to-cash reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Total Liquid Treasury</span>
            <span className="text-xl font-bold text-[#008751] font-mono-numbers">{formatNaira(totalLiquidity)}</span>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-[#005A36] text-xs rounded-xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 3 Bank Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ACCOUNTS.map((acc) => (
          <div key={acc.id} className="premium-card p-5 rounded-2xl relative overflow-hidden">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">{acc.bankName}</span>
                <span className="text-[11px] font-mono text-slate-500">{acc.accountNumber}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {acc.status}
              </span>
            </div>

            <div className="mb-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Available Balance</span>
              <span className="text-2xl font-bold text-slate-900 font-mono-numbers">{formatNaira(acc.availableBalance)}</span>
            </div>

            <div className="text-[10px] text-slate-500 flex justify-between border-t border-slate-100 pt-3">
              <span className="truncate max-w-[180px]">{acc.accountType}</span>
              <span className="font-mono-numbers">{acc.lastSyncWAT.split(',')[1]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction & Reconciliation Feed */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-800">Live Bank Feeds & Audit Match:</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search payer, ref, purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-hidden w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedChannelFilter}
              onChange={(e) => setSelectedChannelFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-hidden font-medium"
            >
              <option value="all">All Banking Channels</option>
              <option value="Providus">Providus Direct</option>
              <option value="Monnify">Monnify Dynamic VA</option>
              <option value="Zenith">Zenith NIP</option>
              <option value="GTBank">GTBank NIP</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Ref</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Payer / Beneficiary</th>
                <th className="py-3 px-4">Description / Purpose</th>
                <th className="py-3 px-4 text-right">Amount (NGN)</th>
                <th className="py-3 px-4 text-center">3-Way Reconciliation</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {filteredTx.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block font-mono text-[11px]">{tx.reference}</span>
                    <span className="text-[10px] text-slate-400 font-sans">{tx.timestampWAT}</span>
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">
                      {tx.channel}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-900">
                    {tx.payerOrBeneficiary}
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate">
                    {tx.purpose}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${tx.type === 'Credit' ? 'text-[#008751]' : 'text-slate-900'}`}>
                    {tx.type === 'Credit' ? '+' : '-'}{formatNaira(tx.amount)}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    {tx.reconciliationStatus === 'Matched to Order' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#005A36]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Matched: {tx.matchedDocId}
                      </span>
                    )}
                    {tx.reconciliationStatus === 'Unmatched Credit' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Unmatched Credit
                      </span>
                    )}
                    {tx.reconciliationStatus === 'Operating Expense' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        Matched: {tx.matchedDocId}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    {tx.reconciliationStatus === 'Unmatched Credit' ? (
                      <button
                        type="button"
                        onClick={() => handleMatchOrder(tx.id)}
                        className="px-2.5 py-1 bg-[#008751] hover:bg-[#007043] text-white text-[10px] font-bold rounded-lg cursor-pointer shadow-2xs"
                      >
                        Match to Order
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Reconciled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
