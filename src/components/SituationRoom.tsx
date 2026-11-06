import React from 'react';
import { 
  AlertTriangle, DollarSign, Activity, CheckCircle2, 
  ArrowRight, ShieldAlert, FileText, ChevronRight, Clock,
  BadgePercent, Bird, Egg, Wheat, Landmark, Users, Plus, ShieldCheck,
  TrendingUp, Sun, CloudRain, Wind, Droplets, Sparkles, Truck,
  Compass, Eye, ArrowUpRight
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../lib/temporal.ts';

interface SituationRoomProps {
  onNavigate: (routeId: string) => void;
}

export const SituationRoom: React.FC<SituationRoomProps> = ({ onNavigate }) => {
  const now = new Date();
  const dualTime = formatDualTime(now);

  return (
    <div className="home-command-experience f6 space-y-6 max-w-[2180px] mx-auto font-sans pb-12">
      
      {/* 100% FarmPortal Hero Banner: Stage 22 Home Command Hero */}
      <section className="home-command-hero">
        <div>
          <span className="eyebrow">
            <span className="w-2 h-2 rounded-full bg-[#e9c990] animate-pulse"></span>
            DAENEM FARMS • BALOGUN-IKIRE SITE COMMAND
          </span>
          <h1 className="mt-2 text-white">The Farm's Work. Clearly Connected.</h1>
          <p className="mt-2 max-w-2xl text-emerald-100">
            Real-time agro-industrial operations, biological health monitoring, and enterprise decision management for the Balogun-Ikire Facility.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Fail-Closed RBAC Active
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 text-[#12bf80]" />
              Zero-Leakage Conservation Enforced
            </span>
          </div>
        </div>

        {/* Dual WAT/EST Mission Clock Card */}
        <div className="home-command-time shrink-0">
          <div className="text-xs uppercase tracking-wider text-emerald-300 font-bold mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#d2ad72]" />
            Dual Operational Time
          </div>
          <div className="space-y-1">
            <div>
              <small className="block text-[10px] text-emerald-200 font-medium">Lagos (WAT):</small>
              <strong className="text-base text-white font-mono-numbers block">{dualTime.watTime}</strong>
              <small className="text-[10px] text-emerald-300">{dualTime.watDate}</small>
            </div>
            <div className="pt-1.5 border-t border-emerald-800/60">
              <small className="block text-[10px] text-emerald-200 font-medium">New York (EST):</small>
              <strong className="text-sm text-emerald-100 font-mono-numbers block">{dualTime.estTime}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Executive Brief Banner */}
      <div className="home-daily-brief p-4 rounded-xl flex items-center justify-between gap-4 flex-wrap shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#c39a50]/20 text-[#855e1a] flex items-center justify-center font-bold text-xs shrink-0">
            AM
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Morning Executive Brief • Balogun-Ikire Operating Phase</h2>
            <p className="text-xs text-slate-600">
              Hen-day production at 89.4% (+0.8% week-on-week). 14 wholesale egg orders staged for morning dispatch. All 4 borehole chlorination levels nominal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={() => onNavigate('orders')}
            className="px-3 py-1.5 bg-[#008751] hover:bg-[#007043] text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Review Orders</span>
            <span className="px-1.5 py-0.2 bg-rose-500 rounded-full text-[10px] font-bold">14</span>
          </button>
          <button 
            type="button" 
            onClick={() => onNavigate('daily-register')}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Pen Registers
          </button>
        </div>
      </div>

      {/* Fieldline V6 Executive Mission Grid: 6 Authoritative Enterprise Metrics */}
      <section className="space-y-3">
        <div className="f6-section-start">
          <div>
            <div className="f6-kicker">
              <span className="f6-accent-line"></span>
              ENTERPRISE AGRIBUSINESS METRICS
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Live Operating Radar</h2>
            <p className="text-xs text-slate-500">Authoritative real-time telemetry across poultry cohorts, processing, feeds and liquid assets</p>
          </div>
          <div className="f6-verification">
            <ShieldCheck className="w-4 h-4 text-[#066946]" />
            <span>Audited &amp; Synchronized</span>
          </div>
        </div>

        <div className="f6-metric-grid">
          {/* 1. Flock Cohort */}
          <div 
            onClick={() => onNavigate('flocks')} 
            className="f6-metric cursor-pointer group"
          >
            <div className="f6-metric-top">
              <span className="f6-metric-origin">BIOLOGY</span>
              <div className="f6-metric-icon group-hover:scale-110 transition-transform">
                <Bird className="w-4 h-4" />
              </div>
            </div>
            <span className="f6-metric-name">Flock Population</span>
            <strong className="font-mono-numbers text-slate-900 group-hover:text-[#008751]">84,200</strong>
            <small className="text-slate-500">Across 7 Houses (ISA Brown &amp; Bovans)</small>
          </div>

          {/* 2. Hen-Day Egg Production */}
          <div 
            onClick={() => onNavigate('flock-performance')} 
            className="f6-metric cursor-pointer group"
          >
            <div className="f6-metric-top">
              <span className="f6-metric-origin">EFFICIENCY</span>
              <div className="f6-metric-icon group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <span className="f6-metric-name">Hen-Day Production</span>
            <strong className="font-mono-numbers text-slate-900 group-hover:text-[#008751]">89.4%</strong>
            <small className="text-emerald-700 font-semibold">+0.8% vs. 88.6% Target Standard</small>
          </div>

          {/* 3. Feed Runway */}
          <div 
            onClick={() => onNavigate('feed')} 
            className="f6-metric cursor-pointer group"
          >
            <div className="f6-metric-top">
              <span className="f6-metric-origin">MILL &amp; SILOS</span>
              <div className="f6-metric-icon group-hover:scale-110 transition-transform">
                <Wheat className="w-4 h-4 text-amber-700" />
              </div>
            </div>
            <span className="f6-metric-name">Feed Stock Runway</span>
            <strong className="font-mono-numbers text-slate-900 group-hover:text-[#008751]">9.7 Days</strong>
            <small className="text-slate-500">142T Yellow Maize • 68T Soya Meal</small>
          </div>

          {/* 4. Egg Cold Room */}
          <div 
            onClick={() => onNavigate('eggs')} 
            className="f6-metric cursor-pointer group"
          >
            <div className="f6-metric-top">
              <span className="f6-metric-origin">COLD CHAIN</span>
              <div className="f6-metric-icon group-hover:scale-110 transition-transform">
                <Egg className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <span className="f6-metric-name">Egg Room Crates</span>
            <strong className="font-mono-numbers text-slate-900 group-hover:text-[#008751]">3,420</strong>
            <small className="text-slate-500">102,600 eggs held at 16°C cold room</small>
          </div>

          {/* 5. Liquid Treasury */}
          <div 
            onClick={() => onNavigate('treasury')} 
            className="f6-metric cursor-pointer group"
          >
            <div className="f6-metric-top">
              <span className="f6-metric-origin">TREASURY</span>
              <div className="f6-metric-icon group-hover:scale-110 transition-transform">
                <Landmark className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <span className="f6-metric-name">Net Corporate Liquidity</span>
            <strong className="font-mono-numbers text-slate-900 group-hover:text-[#008751] text-lg">₦142.6M</strong>
            <small className="text-slate-500">Providus, Zenith &amp; GTBank Feeds</small>
          </div>

          {/* 6. Active Shift Workforce */}
          <div 
            onClick={() => onNavigate('attendance')} 
            className="f6-metric cursor-pointer group"
          >
            <div className="f6-metric-top">
              <span className="f6-metric-origin">WORKFORCE</span>
              <div className="f6-metric-icon group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <span className="f6-metric-name">Biometric Attendance</span>
            <strong className="font-mono-numbers text-slate-900 group-hover:text-[#008751]">38 / 40</strong>
            <small className="text-slate-500">95% Shift muster confirmed on site</small>
          </div>
        </div>
      </section>

      {/* Two-Column Command Operations: Weather/News Wire & Attention Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Live Agricultural Weather & Agribusiness Intelligence (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Farm Agricultural Weather Card */}
          <div className="bg-white border border-[#c8dcd0] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-[#008751]">
                  <Sun className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Agricultural Weather &amp; Microclimate</h3>
                  <span className="text-[11px] text-slate-500">Balogun-Ikire Coordinates: 7.36°N, 4.18°E • Open-Meteo Precision</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Live Sensors
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#f2f7f4] border border-[#d2e4d9] mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Ambient Temp</span>
                <strong className="text-2xl font-bold text-slate-900 font-mono-numbers block mt-1">26°C</strong>
                <small className="text-[11px] text-slate-500">Feels like 27°C (79°F)</small>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Relative Humidity</span>
                <strong className="text-2xl font-bold text-slate-900 font-mono-numbers block mt-1">78%</strong>
                <small className="text-[11px] text-slate-500">Pen comfort range</small>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Wind Velocity</span>
                <strong className="text-2xl font-bold text-slate-900 font-mono-numbers block mt-1">7 mph</strong>
                <small className="text-[11px] text-slate-500">Direction: WSW</small>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Photoperiod</span>
                <strong className="text-2xl font-bold text-slate-900 font-mono-numbers block mt-1">11h 48m</strong>
                <small className="text-[11px] text-slate-500">Sunrise: 6:31 AM WAT</small>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                <span className="text-[10px] text-slate-500 block font-bold uppercase">Farm Rain Risk</span>
                <span className="text-xs font-bold text-emerald-700 block mt-0.5">Low • 8% Chance</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                <span className="text-[10px] text-slate-500 block font-bold uppercase">Heat Index Stress</span>
                <span className="text-xs font-bold text-slate-800 block mt-0.5">Normal (THI: 72)</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                <span className="text-[10px] text-slate-500 block font-bold uppercase">Biosecurity Footbaths</span>
                <span className="text-xs font-bold text-[#008751] block mt-0.5">Freshly Recharged</span>
              </div>
            </div>
          </div>

          {/* Nigerian Agribusiness Market Wire */}
          <div className="bg-white border border-[#c8dcd0] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#008751]" />
                <h3 className="text-sm font-bold text-slate-900">Nigerian Agribusiness &amp; Commodity Wire</h3>
              </div>
              <span className="text-[11px] text-slate-500">27/27 Live Verified Sources</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span className="font-bold text-[#008751]">GRAIN COMMODITIES</span>
                  <span>14 mins ago</span>
                </div>
                <h4 className="font-bold text-slate-900">Maize Landing Costs Steady Across Southwest Hubs</h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Bulk yellow maize deliveries from Kaduna holding at ₦420,000/tonne. Daenem silo runway maintains 142 tonnes in reserve.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span className="font-bold text-amber-700">WHOLESALE EGG RATES</span>
                  <span>1 hour ago</span>
                </div>
                <h4 className="font-bold text-slate-900">Lagos &amp; Ibadan Egg Crate Benchmark: ₦3,500 – ₦3,700</h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Wholesale crate pricing remains solid across Bodija and Mile 12 markets with strong festive season advance bookings.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Urgent Decision Queue & 24h Cash Bridge (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Urgent Decision Queue */}
          <div className="bg-white border border-[#c8dcd0] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">Executive Decision Queue</h2>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                3 Pending Action
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Bio-Variance</span>
                  <span className="text-[10px] text-rose-600 font-semibold">House 01</span>
                </div>
                <h3 className="font-bold text-slate-900 mt-1">Mortality Spike (+8 Birds above threshold)</h3>
                <p className="text-slate-600 mt-0.5">Post-mortem review required by Attending Veterinarian.</p>
                <div className="mt-2.5 pt-2 border-t border-rose-200/60 flex justify-end">
                  <button 
                    onClick={() => onNavigate('daily-register')}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold text-[11px] cursor-pointer"
                  >
                    Inspect Ledger
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">CapEx Sign-Off</span>
                  <span className="text-[10px] font-mono font-semibold text-slate-600">PO-2026-089</span>
                </div>
                <h3 className="font-bold text-slate-900 mt-1">₦4,200,000 for 15-Tonne Bulk Maize Intake</h3>
                <p className="text-slate-600 mt-0.5">3-way quote matrix validated. Awaiting Owner authorization.</p>
                <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex justify-end">
                  <button 
                    onClick={() => onNavigate('feed')}
                    className="px-2.5 py-1 bg-[#008751] hover:bg-[#007043] text-white rounded-md font-semibold text-[11px] cursor-pointer"
                  >
                    Authorize Requisition
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">Access Governance</span>
                  <span className="text-[10px] text-amber-600 font-semibold font-mono">Expires 28h</span>
                </div>
                <h3 className="font-bold text-slate-900 mt-1">Provisional User: Ibrahim Musa (Attendant)</h3>
                <p className="text-slate-600 mt-0.5">NIN identity and WhatsApp credential verified.</p>
                <div className="mt-2.5 pt-2 border-t border-slate-200 flex justify-end">
                  <button 
                    onClick={() => onNavigate('rbac')}
                    className="px-2.5 py-1 border border-slate-300 hover:bg-white text-slate-800 rounded-md font-semibold text-[11px] cursor-pointer"
                  >
                    Assign Role &amp; Permissions
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 24-Hour Corporate Treasury Cash Bridge */}
          <div className="bg-white border border-[#c8dcd0] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#008751]" />
                <h2 className="text-sm font-bold text-slate-900">24-Hour Treasury Cash Bridge</h2>
              </div>
              <button 
                onClick={() => onNavigate('treasury')} 
                className="text-xs text-[#008751] font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Full Treasury</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mb-4">
              <span className="text-xs text-slate-500 block">Total Corporate Net Liquidity</span>
              <span className="text-2xl font-bold text-slate-900 font-mono-numbers">{formatNaira(142650400)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono-numbers">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] block font-sans">Providus (Collections)</span>
                <span className="font-bold text-slate-900 block mt-1">{formatNaira(68450000)}</span>
                <span className="text-[10px] text-emerald-600 font-sans">Monnify Auto-Sweep</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] block font-sans">Zenith (Operations)</span>
                <span className="font-bold text-slate-900 block mt-1">{formatNaira(45200400)}</span>
                <span className="text-[10px] text-slate-500 font-sans">Disbursements</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] block font-sans">GTBank (Feed Escrow)</span>
                <span className="font-bold text-slate-900 block mt-1">{formatNaira(24000000)}</span>
                <span className="text-[10px] text-slate-500 font-sans">Grain Procurement</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] block font-sans">Petty Cash Vault</span>
                <span className="font-bold text-slate-900 block mt-1">{formatNaira(5000000)}</span>
                <span className="text-[10px] text-slate-500 font-sans">On-Farm Imprest</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default SituationRoom;
