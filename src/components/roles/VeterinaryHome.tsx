import React, { useState } from 'react';
import { 
  Syringe, Activity, AlertTriangle, CheckCircle2, ShieldCheck, 
  Clock, ArrowRight, Thermometer, Droplet, Plus, FileText, Check
} from 'lucide-react';
import { formatDualTime, formatCount } from '../../lib/temporal.ts';

interface VeterinaryHomeProps {
  onNavigate: (routeId: string) => void;
}

export const VeterinaryHome: React.FC<VeterinaryHomeProps> = ({ onNavigate }) => {
  const now = new Date();
  const dualTime = formatDualTime(now);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#005A36] to-[#008751] rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00A86B] text-white">
              Clinical Care & Biosecurity Desk
            </span>
            <span className="text-xs text-emerald-200">Role: Chief Resident Veterinarian (Dr. Segun Adewale)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Poultry Health, Necropsy & Biosecurity Radar</h1>
          <p className="text-xs text-emerald-100 mt-1">
            Flock clinical inspections, post-mortem pathology, vaccine cold-chain monitoring, and water chlorination.
          </p>
        </div>

        <div className="text-right font-mono-numbers">
          <span className="text-xs text-emerald-200 block">{dualTime.watDate}</span>
          <span className="text-2xl font-bold text-white block">98 / 100</span>
          <span className="text-[11px] text-emerald-300 block">Biosecurity Perimeter Pass</span>
        </div>
      </div>

      {/* 4 Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Birds Under Care</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{formatCount(48210)}</span>
            <span className="text-[11px] text-slate-500 font-sans">4 Houses</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block mt-1">Livability: 99.94%</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Today's Total Mortality</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">28 Birds</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">0.06% (Normal)</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Strict Threshold: &lt;0.15% per day</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Vaccine Cold-Chain</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-blue-600">4.2°C</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">Optimal (2-8°C)</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Solar Inverter Backup Active</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Water Chlorination</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">2.5 ppm</span>
            <span className="text-[11px] text-slate-500 font-sans">pH 6.8</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block mt-1">Borehole Treatment Verified</span>
        </div>
      </div>

      {/* Main Grid: Clinical Observations + Vaccine Planner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Morbidity & Necropsy Forensics (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">Clinical Rounds & Necropsy Pathology</h2>
            </div>
            <button
              onClick={() => onNavigate('daily-register')}
              className="text-xs text-[#008751] font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Inspect Pen Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* House 1 Flag */}
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">Necropsy Required</span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">House 01 Mortality Elevation (+8 Birds vs Target)</h3>
                  <p className="text-slate-600 mt-0.5">
                    Attendant reported 8 sudden mortalities in East Wing bottom tier. Gross pathology showed mild egg peritonitis in 2 carcasses. No respiratory lesions or swollen heads.
                  </p>
                </div>
                <button
                  onClick={() => alert('Post-Mortem Necropsy Evidence form opened.')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shrink-0 cursor-pointer shadow-xs"
                >
                  Post Pathology Report
                </button>
              </div>
            </div>

            {/* House 2 & 3 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm block">House 02 (Bovans White) & House 03 (ISA Brown)</span>
                <span className="text-slate-500 text-[11px]">Normal fecal consistency, active feeding, drinker flow rate verified at 80ml/min.</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#005A36]">
                Healthy Active
              </span>
            </div>

            {/* House 4 Pullet Health */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm block">House 04 (Pullet Rearing - Week 14)</span>
                <span className="text-slate-500 text-[11px]">Uniformity: 86% (Average body weight: 1,180g vs 1,160g breed standard).</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                Above Benchmark
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Scheduled Vaccination & Biosecurity Gate (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Syringe className="w-5 h-5 text-[#008751]" />
                <h2 className="text-sm font-bold text-slate-900">Vaccine Planner & Inoculations</h2>
              </div>
              <span className="text-xs text-emerald-700 font-bold">Upcoming 7 Days</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">Newcastle Lasota Booster</span>
                    <span className="text-slate-500 text-[11px]">House 03 • Drinking water administration • Target: 12,800 Birds</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Tomorrow (07 Nov)
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-2">
                  <span>Vaccine Lot: #NC-2026-992</span>
                  <span>•</span>
                  <span>Milk stabilizer ready</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">Infectious Coryza Inactivated (Subcut)</span>
                    <span className="text-slate-500 text-[11px]">House 04 Pullets (Week 15) • Syringe injection team assigned</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                    12 Nov 2026
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('daily-register')}
              className="btn-primary-glow px-3 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Open Daily Pen Register</span>
            </button>
            <button
              onClick={() => onNavigate('feed')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span>Aflatoxin Quality Lab</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
