import React, { useState } from 'react';
import { 
  Bird, Egg, CheckCircle2, Clock, ShieldCheck, Check, 
  Plus, AlertCircle, Droplet, ArrowRight, Wheat
} from 'lucide-react';
import { formatDualTime, formatCount } from '../../lib/temporal.ts';

interface AttendantMyDayHomeProps {
  onNavigate: (routeId: string) => void;
}

export const AttendantMyDayHome: React.FC<AttendantMyDayHomeProps> = ({ onNavigate }) => {
  const now = new Date();
  const dualTime = formatDualTime(now);

  const [checklist, setChecklist] = useState([
    { id: 'c1', task: 'Morning Feeding: Dispense 750 kg Layer Mash Phase I into automated hopper', done: true, time: '07:15 AM' },
    { id: 'c2', task: 'Morning Egg Collection: Gather, grade and pack into 30-egg standardized crates', done: true, time: '09:30 AM' },
    { id: 'c3', task: 'Drinker Line Inspection: Check nipple line water pressure & flow (80ml/min)', done: true, time: '11:00 AM' },
    { id: 'c4', task: 'Afternoon Egg Collection: Collect tier 2 & 3 laid eggs and update shift tally', done: false, time: '02:00 PM' },
    { id: 'c5', task: 'Evening Headcount Census: Record mortality, culls and post closing balance', done: false, time: '04:30 PM' },
  ]);

  const toggleCheck = (id: string) => {
    setChecklist(checklist.map(item => {
      if (item.id === id) {
        return { ...item, done: !item.done };
      }
      return item;
    }));
  };

  const completedCount = checklist.filter(c => c.done).length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Banner: Attendant My Day Shift Station */}
      <div className="bg-gradient-to-r from-[#005A36] to-[#008751] rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00A86B] text-white">
              Field Shift Attendant Desk
            </span>
            <span className="text-xs text-emerald-200">Role: Pen Attendant (Sunday Okafor / Babatunde Alamu)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">My Working Day • House 01 East Wing</h1>
          <p className="text-xs text-emerald-100 mt-1">
            Assigned pen cohort: 12,440 ISA Brown Layers (38 Weeks Age). Shift Station: Balogun-Ikire Complex.
          </p>
        </div>

        <div className="text-right font-mono-numbers">
          <span className="text-xs text-emerald-200 block">Biometric Shift Clock</span>
          <span className="text-xl font-bold text-white block">Clocked In: 06:45 AM WAT</span>
          <span className="text-[11px] text-emerald-300 block">Station: Verified On-Site</span>
        </div>
      </div>

      {/* 4 Shift KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Assigned Bird Cohort</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{formatCount(12440)}</span>
            <span className="text-[11px] text-slate-500 font-sans">House 01</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block mt-1">Laying Peak: 93.6% HDEP</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Eggs Collected Today</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">388 Crates</span>
            <span className="text-[11px] text-slate-500 font-sans">11,640 Eggs</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">+14 loose eggs (6 cracked rejects)</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Feed Dispensed</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-amber-700">1,494 kg</span>
            <span className="text-[11px] text-slate-500 font-sans">30 Bags (50kg)</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">120 g/bird intake</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Mortality Count Today</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">8 Mort / 2 Cull</span>
            <span className="text-[10px] text-rose-600 font-sans font-bold">Investigated</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Reported to Resident Vet</span>
        </div>
      </div>

      {/* Main Grid: My Shift Checklist + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Shift Checklist (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#008751]" />
              <h2 className="text-sm font-bold text-slate-900">Shift Routine Checklist & SOP Tasks</h2>
            </div>
            <span className="text-xs font-bold text-[#008751]">
              {completedCount} of {checklist.length} Completed
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {checklist.map(item => (
              <div 
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${
                  item.done 
                    ? 'bg-slate-50/70 border-slate-200 text-slate-500' 
                    : 'bg-white border-slate-200 hover:border-[#008751] text-slate-900 shadow-2xs'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                  item.done ? 'bg-[#008751] border-[#008751] text-white' : 'border-slate-300'
                }`}>
                  {item.done && <Check className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1">
                  <span className={`text-sm font-semibold block leading-tight ${item.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {item.task}
                  </span>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>Standard Protocol: House 01 SOP</span>
                    <span className="font-mono-numbers font-medium">{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Attendant Immediate Logging Affordances (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#008751]" />
              Post Shift Logs
            </h3>

            <div className="space-y-2.5">
              <button
                onClick={() => onNavigate('daily-register')}
                className="btn-primary-glow w-full py-2.5 px-3 text-white rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Egg className="w-4 h-4" />
                  Post Egg Collection
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('daily-register')}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition"
              >
                <span className="flex items-center gap-2">
                  <Bird className="w-4 h-4 text-rose-600" />
                  Log Mortality & Culls
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-bold mb-1">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Biosecurity Shift Rule</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Change boots at House 01 sanitation ante-room. Ensure footbath is refreshed with Virkon-S disinfectant before entering pen corridors.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
