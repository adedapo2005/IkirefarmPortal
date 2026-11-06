import React, { useState } from 'react';
import { 
  Bird, Egg, Wheat, AlertTriangle, CheckCircle2, Clock, 
  ArrowRight, ShieldCheck, Sun, CloudSun, Users, Calendar, 
  Activity, Plus, FileSpreadsheet, Truck, Check, RefreshCw
} from 'lucide-react';
import { formatDualTime, formatCount, formatNaira } from '../../lib/temporal.ts';

interface FarmManagerHomeProps {
  onNavigate: (routeId: string) => void;
}

export const FarmManagerHome: React.FC<FarmManagerHomeProps> = ({ onNavigate }) => {
  const now = new Date();
  const dualTime = formatDualTime(now);

  const [tasks, setTasks] = useState([
    { id: 't1', title: 'Verify House 01 & 02 Morning Egg Collections', house: 'House 1 & 2', status: 'Completed', time: '09:30 AM' },
    { id: 't2', title: 'Sign-off Daily Pen Register (Mortality & Feed intake)', house: 'All 4 Houses', status: 'Pending Review', time: '11:00 AM' },
    { id: 't3', title: 'Inspect Silo A Yellow Maize Discharge for Batch #804', house: 'Feed Mill', status: 'In Progress', time: '01:30 PM' },
    { id: 't4', title: 'Supervise Wholesale Truck Loading (Alhaji Musa 500 Crates)', house: 'Loading Bay 1', status: 'Ready for Dispatch', time: '02:00 PM' },
  ]);

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === 'Completed' ? 'Pending Review' : 'Completed' };
      }
      return t;
    }));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Banner: Farm Manager Operational Cockpit */}
      <div className="bg-gradient-to-r from-[#005A36] to-[#008751] rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00A86B] text-white">
              Operations Muster Cockpit
            </span>
            <span className="text-xs text-emerald-200">Role: General Farm Manager (Glory Mercy)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Balogun-Ikire Daily Farm Operations</h1>
          <p className="text-xs text-emerald-100 mt-1">
            Shift attendance muster, pen production targets, feed mill staging, and logistics dispatch gate.
          </p>
        </div>

        <div className="text-right font-mono-numbers">
          <span className="text-xs text-emerald-200 block">{dualTime.watDate}</span>
          <span className="text-lg font-bold text-white block">{dualTime.watTime}</span>
          <span className="text-[11px] text-emerald-300 block">Weather: 28°C Scattered Clouds</span>
        </div>
      </div>

      {/* 4 Operations KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Active Birds</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{formatCount(48210)}</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">4 Houses</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">99.94% Livability (0.06% Mort)</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Today's Egg Production</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">1,134 Crates</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">93.2% HDEP</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">(34,020 eggs graded & trayed)</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Feed Silo Runway</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-amber-700">9.7 Days</span>
            <span className="text-[11px] text-slate-500 font-sans">46.5 MT Maize</span>
          </div>
          <span className="text-[10px] text-amber-600 block mt-1">Daily consumption: 4.8 MT</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Staff on Shift Today</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-blue-600">22 / 24 Staff</span>
            <span className="text-[10px] text-blue-600 font-sans">Clocked In</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">2 on approved annual leave</span>
        </div>
      </div>

      {/* Main Grid: House Operations + Manager Task Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Pen Houses Real-time Status (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Bird className="w-5 h-5 text-[#008751]" />
              <h2 className="text-sm font-bold text-slate-900">Pen Houses Real-Time Shift Status</h2>
            </div>
            <button
              onClick={() => onNavigate('daily-register')}
              className="text-xs text-[#008751] font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>7-Column Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* House 1 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-sm">House 01 — ISA Brown (38 Wks)</span>
                <span className="text-slate-500 text-[11px]">12,440 Birds • Attendant: Babatunde Alamu</span>
              </div>
              <div className="text-right font-mono-numbers">
                <span className="font-bold text-[#008751] text-sm block">388 Crates</span>
                <span className="text-[10px] text-slate-500">93.6% HDEP • 8 Mort</span>
              </div>
            </div>

            {/* House 2 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-sm">House 02 — Bovans White (32 Wks)</span>
                <span className="text-slate-500 text-[11px]">12,035 Birds • Attendant: Sunday Adeleke</span>
              </div>
              <div className="text-right font-mono-numbers">
                <span className="font-bold text-[#008751] text-sm block">374 Crates</span>
                <span className="text-[10px] text-slate-500">93.3% HDEP • 11 Mort</span>
              </div>
            </div>

            {/* House 3 */}
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-sm">House 03 — ISA Brown (24 Wks)</span>
                  <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-bold">Needs Review</span>
                </div>
                <span className="text-slate-500 text-[11px]">12,793 Birds • Attendant: Kazeem Olatunji</span>
              </div>
              <div className="text-right font-mono-numbers">
                <span className="font-bold text-[#008751] text-sm block">372 Crates</span>
                <span className="text-[10px] text-amber-700 font-bold">Pending Manager Sign-off</span>
              </div>
            </div>

            {/* House 4 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-sm">House 04 — Lohmann Pullets (14 Wks)</span>
                <span className="text-slate-500 text-[11px]">11,197 Rearing Pullets • Attendant: Emeka Eze</span>
              </div>
              <div className="text-right font-mono-numbers">
                <span className="font-bold text-slate-700 text-sm block">Rearing Phase</span>
                <span className="text-[10px] text-slate-400">Target Lay: Week 19</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Manager Daily Task Checklist & Quick Actions (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Shift Action Queue & Sign-offs</h2>
              </div>
              <span className="text-xs text-slate-400">{tasks.filter(t => t.status === 'Completed').length}/{tasks.length} Done</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {tasks.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => handleToggleTask(t.id)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    t.status === 'Completed' 
                      ? 'bg-slate-50/70 border-slate-200 text-slate-400' 
                      : 'bg-white border-slate-200 hover:border-[#008751] text-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                    t.status === 'Completed' ? 'bg-[#008751] border-[#008751] text-white' : 'border-slate-300'
                  }`}>
                    {t.status === 'Completed' && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1">
                    <span className={`font-semibold block ${t.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {t.title}
                    </span>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>{t.house}</span>
                      <span className="font-mono-numbers">{t.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('flock-add')}
              className="btn-primary-glow px-3 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Intake New Flock</span>
            </button>
            <button
              onClick={() => onNavigate('feed')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Wheat className="w-4 h-4 text-amber-700" />
              <span>Queue Milling Run</span>
            </button>
            <button
              onClick={() => onNavigate('orders')}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-4 h-4 text-[#008751]" />
              <span>Vehicle Dispatch</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
