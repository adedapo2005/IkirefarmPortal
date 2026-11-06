import React, { useState } from 'react';
import { 
  Landmark, DollarSign, ArrowUpRight, ArrowDownLeft, CheckCircle2, 
  AlertTriangle, Clock, ShieldCheck, RefreshCw, FileText, Check, Plus
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../../lib/temporal.ts';

interface FinanceHomeProps {
  onNavigate: (routeId: string) => void;
}

export const FinanceHome: React.FC<FinanceHomeProps> = ({ onNavigate }) => {
  const now = new Date();
  const dualTime = formatDualTime(now);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#005A36] to-[#008751] rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00A86B] text-white">
              Corporate Treasury Observatory
            </span>
            <span className="text-xs text-emerald-200">Role: Financial Controller (Folake Adeleke)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Treasury Position & Liquidity Bridge</h1>
          <p className="text-xs text-emerald-100 mt-1">
            Real-time multi-bank feeds, Monnify automated credit matching, and statutory tax compliance ledger.
          </p>
        </div>

        <div className="text-right font-mono-numbers">
          <span className="text-xs text-emerald-200 block">Total Liquid Position</span>
          <span className="text-2xl font-bold text-white block">{formatNaira(62590500)}</span>
          <span className="text-[11px] text-emerald-300 block">All 4 Banks Reconciled</span>
        </div>
      </div>

      {/* 4 Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Today's Inflow (Sales)</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">{formatNaira(5909000)}</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">14 Orders</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">1,690 Crates Eggs Dispatched</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Unmatched Credits</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-amber-600">{formatNaira(1225000)}</span>
            <span className="text-[11px] text-amber-700 font-bold font-sans">1 Deposit</span>
          </div>
          <span className="text-[10px] text-amber-600 block mt-1">Madam Grace Egg Depot (Awaiting Teller)</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Month-to-Date Revenue</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{formatNaira(38450000)}</span>
            <span className="text-[11px] text-slate-500 font-sans">Nov 2026</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block mt-1">↑ 8.4% vs Projected Runway</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">CapEx & Grain Commitments</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-blue-600">{formatNaira(4200000)}</span>
            <span className="text-[10px] text-blue-600 font-sans">PO-2026-089</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">15T Yellow Maize Bulk Intake</span>
        </div>
      </div>

      {/* Main Grid: Multi-Bank Feeds + Unreconciled Action Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: 4 Connected Banks Live Feeds (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#008751]" />
              <h2 className="text-sm font-bold text-slate-900">Synchronized Nigerian Bank Accounts</h2>
            </div>
            <button
              onClick={() => onNavigate('treasury')}
              className="text-xs text-[#008751] font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Treasury Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Providus */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-sm">Providus Bank — Wholesale Virtual Pool</span>
                <span className="text-slate-500 text-[11px] font-mono">Acc: 1100482910 • Monnify Direct Webhook Active</span>
              </div>
              <div className="text-right font-mono-numbers">
                <span className="font-bold text-[#008751] text-base block">{formatNaira(34500000)}</span>
                <span className="text-[10px] text-emerald-600 font-sans font-bold">● Real-time Synced</span>
              </div>
            </div>

            {/* Zenith */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-sm">Zenith Bank PLC — Operating & Grain Sourcing</span>
                <span className="text-slate-500 text-[11px] font-mono">Acc: 1014928471 • NIP Bulk Settlement Channel</span>
              </div>
              <div className="text-right font-mono-numbers">
                <span className="font-bold text-slate-900 text-base block">{formatNaira(18240500)}</span>
                <span className="text-[10px] text-emerald-600 font-sans font-bold">● Real-time Synced</span>
              </div>
            </div>

            {/* GTBank */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-sm">Guaranty Trust Bank (GTB) — Payroll & Statutory Escrow</span>
                <span className="text-slate-500 text-[11px] font-mono">Acc: 0284918274 • Osun PAYE & PenCom Remittance</span>
              </div>
              <div className="text-right font-mono-numbers">
                <span className="font-bold text-slate-900 text-base block">{formatNaira(9850000)}</span>
                <span className="text-[10px] text-emerald-600 font-sans font-bold">● Real-time Synced</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pending Approvals & Reconciliation Desk (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">3-Way Reconciliation Action Desk</h2>
              </div>
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">1 Action Due</span>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 mb-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded">Unmatched Inflow Alert</span>
              <h3 className="font-bold text-slate-900 mt-1">₦1,225,000 Credit Alert from Madam Grace Egg Depot</h3>
              <p className="text-slate-600 mt-0.5">Reference: ZEN-NIP-20261106-4419 • Matches draft order ORD-2026-890 (350 crates).</p>
              <button
                onClick={() => onNavigate('treasury')}
                className="mt-2.5 px-3 py-1.5 bg-[#008751] hover:bg-[#007043] text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
              >
                Match & Release Gate Pass
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">Upcoming Statutory Deadline</span>
              <h3 className="font-bold text-slate-900 mt-1">Osun State Internal Revenue Service (PAYE)</h3>
              <p className="text-slate-600 mt-0.5">Due Date: 10 Nov 2026 • Graded deduction schedule generated: ₦177,900.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('orders')}
              className="btn-primary-glow px-3 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Wholesale Orders</span>
            </button>
            <button
              onClick={() => onNavigate('payroll')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span>Payroll Platform</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
