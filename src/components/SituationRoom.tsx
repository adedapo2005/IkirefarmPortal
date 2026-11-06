import React from 'react';
import { 
  AlertTriangle, DollarSign, Activity, CheckCircle2, 
  ArrowRight, ShieldAlert, FileText, ChevronRight, Clock,
  BadgePercent, Bird, Egg, Wheat, Landmark, Users, Plus, ShieldCheck
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../lib/temporal.ts';

interface SituationRoomProps {
  onNavigate: (routeId: string) => void;
}

export const SituationRoom: React.FC<SituationRoomProps> = ({ onNavigate }) => {
  const now = new Date();
  const dualTime = formatDualTime(now);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Banner: DAENEM Farms Balogun-Ikire Real-Time Pulse */}
      <div className="bg-gradient-to-r from-[#005A36] to-[#008751] rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block mb-1">
            Enterprise Command Cockpit
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Farm Situation Room • Balogun-Ikire</h1>
          <p className="text-xs text-emerald-100 mt-1">Live operational pulse, biological health radar and executive decision queue</p>
        </div>
        <div className="text-right font-mono-numbers">
          <span className="text-xs text-emerald-200 block">{dualTime.watDate}</span>
          <span className="text-lg font-bold text-white block">{dualTime.watTime}</span>
        </div>
      </div>

      {/* High-Priority Executive Quick Launch Dock */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className="p-3.5 bg-white hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-400 rounded-xl text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <BadgePercent className="w-5 h-5 text-[#008751] group-hover:scale-110 transition-transform" />
            <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">14</span>
          </div>
          <span className="text-xs font-bold text-slate-900 block group-hover:text-[#008751]">Customer Orders</span>
          <span className="text-[10px] text-slate-500 block">Wholesale & POS</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('daily-register')}
          className="p-3.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Bird className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[10px] font-bold">7</span>
          </div>
          <span className="text-xs font-bold text-slate-900 block group-hover:text-[#008751]">Daily Pen Register</span>
          <span className="text-[10px] text-slate-500 block">7-Column Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('eggs')}
          className="p-3.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Egg className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-slate-400">16°C</span>
          </div>
          <span className="text-xs font-bold text-slate-900 block group-hover:text-[#008751]">Egg Cold Room</span>
          <span className="text-[10px] text-slate-500 block">3,420 Crates Held</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('feed')}
          className="p-3.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Wheat className="w-5 h-5 text-amber-700 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-emerald-700">9.7d</span>
          </div>
          <span className="text-xs font-bold text-slate-900 block group-hover:text-[#008751]">Feed Mill & Silos</span>
          <span className="text-[10px] text-slate-500 block">Maize & Soya Stock</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('treasury')}
          className="p-3.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Landmark className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-[#008751]">Live</span>
          </div>
          <span className="text-xs font-bold text-slate-900 block group-hover:text-[#008751]">Treasury Feeds</span>
          <span className="text-[10px] text-slate-500 block">Providus & Zenith</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('rbac')}
          className="p-3.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <ShieldCheck className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-purple-700 font-mono">24 Perms</span>
          </div>
          <span className="text-xs font-bold text-slate-900 block group-hover:text-purple-700">Dynamic Roles</span>
          <span className="text-[10px] text-slate-500 block">Custom RBAC Studio</span>
        </button>
      </div>

      {/* 4 Pillars Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Pillar 1: Urgent Decision Queue (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">Urgent Decision Queue</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
              3 Pending Action
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">High Biological Variance</span>
                <h3 className="font-bold text-slate-900 mt-1">House 01 Mortality Spike (+8 Birds above threshold)</h3>
                <p className="text-slate-600 mt-0.5">Post-mortem review required by Attending Veterinarian.</p>
              </div>
              <button 
                onClick={() => onNavigate('daily-register')}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shrink-0 cursor-pointer"
              >
                Inspect Ledger
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">CapEx Requisition</span>
                <h3 className="font-bold text-slate-900 mt-1">PO-2026-089 (₦4,200,000 for 15-Tonne Maize Intake)</h3>
                <p className="text-slate-600 mt-0.5">3-way quote matrix validated. Awaiting Owner authorization.</p>
              </div>
              <button 
                onClick={() => onNavigate('feed')}
                className="px-3 py-1.5 bg-[#008751] hover:bg-[#007043] text-white rounded-lg font-semibold shrink-0 cursor-pointer"
              >
                Inspect Silo
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">Access Governance</span>
                <h3 className="font-bold text-slate-900 mt-1">Provisional Account: Ibrahim Musa (Expires in 28h)</h3>
                <p className="text-slate-600 mt-0.5">Farm Attendant applicant submitted verified NIN & WhatsApp.</p>
              </div>
              <button 
                onClick={() => onNavigate('rbac')}
                className="px-3 py-1.5 border border-slate-300 hover:bg-white text-slate-700 rounded-lg font-semibold shrink-0 cursor-pointer"
              >
                Triage & Assign Role
              </button>
            </div>
          </div>
        </div>

        {/* Pillar 2: 24-Hour Treasury Cash Bridge (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#008751]" />
              <h2 className="text-sm font-bold text-slate-900">24-Hour Treasury Cash Bridge</h2>
            </div>
            <button 
              onClick={() => onNavigate('treasury')} 
              className="text-xs text-[#008751] font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View Multi-Bank Feed</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mb-4">
            <span className="text-xs text-slate-500 block">Total Corporate Net Liquidity</span>
            <span className="text-2xl font-bold text-slate-900 font-mono-numbers">{formatNaira(142650400)}</span>
          </div>

          {/* 4 Connected Nigerian Banks */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono-numbers">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block font-sans">Providus (Collections)</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{formatNaira(48200000)}</strong>
              <span className="text-[10px] text-emerald-600 font-sans">● Virtual Accounts Live</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block font-sans">Zenith (Operations)</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{formatNaira(62150000)}</strong>
              <span className="text-[10px] text-emerald-600 font-sans">● NIP Settlement Active</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block font-sans">GTBank (Payroll & Tax)</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{formatNaira(24800000)}</strong>
              <span className="text-[10px] text-slate-500 font-sans">● Cycle Locked</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block font-sans">Access (CapEx Reserve)</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{formatNaira(7500400)}</strong>
              <span className="text-[10px] text-slate-500 font-sans">● Escrow Guarded</span>
            </div>
          </div>
        </div>

      </div>

      {/* Pillar 3 & 4: Biological Health Radar + Live Evidence Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Pillar 3: Biological Health Radar (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">Biological Health Radar</h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#005A36] font-bold">
              Biosecurity: 98/100
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 text-xs font-mono-numbers">
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
              <span className="text-slate-500 text-[11px] block font-sans">Certified Birds</span>
              <strong className="text-purple-900 text-lg block mt-0.5">{formatCount(48210)}</strong>
              <span className="text-[10px] text-emerald-600 font-sans">7 Houses Active</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-slate-500 text-[11px] block font-sans">Daily HDEP Laying</span>
              <strong className="text-amber-900 text-lg block mt-0.5">88.4%</strong>
              <span className="text-[10px] text-emerald-600 font-sans">↑ 1.2% vs Target</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-slate-500 text-[11px] block font-sans">Feed FCR (kg/crate)</span>
              <strong className="text-blue-900 text-lg block mt-0.5">1.82</strong>
              <span className="text-[10px] text-emerald-600 font-sans">Optimal Efficiency</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            All flock biological parameters are governed by strict mathematical conservation. Daily shift closures auto-freeze at 23:00 WAT preventing retrospective record alteration.
          </p>
        </div>

        {/* Pillar 4: Live Evidence Stream (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Verified Evidence Stream</h2>
            </div>
            <span className="text-xs text-slate-400">Balogun-Ikire Gate</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">500 Crates Egg Wholesale Dispatch</span>
                <span className="text-slate-500 text-[11px]">Truck KSF-192-XA • Waybill #WB-9921 • Gate Pass Verified</span>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">1,000L Diesel Delivery Offloaded</span>
                <span className="text-slate-500 text-[11px]">Generator Silo 1 • Dipstick Verified 985L Net</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
