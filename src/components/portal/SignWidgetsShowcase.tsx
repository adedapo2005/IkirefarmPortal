import React from 'react';
import { 
  CloudSun, Droplets, Wind, Gauge, Sunrise, Sunset, 
  TrendingUp, Newspaper, Sparkles, ShieldCheck, Activity,
  AlertCircle, CheckCircle2, ChevronRight, Landmark, ArrowUpRight,
  Radio, Sun, Cpu
} from 'lucide-react';
import { formatNaira } from '../../lib/temporal.ts';

export const SignWidgetsShowcase: React.FC = () => {
  return (
    <div className="space-y-6">
      
      {/* 2-Column or 3-Column Responsive Widget Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* ========================================================================= */}
        {/* WIDGET 1: BALOGUN-IKIRE MICROCLIMATE & POULTRY HEAT STRESS INDEX          */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <CloudSun className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Farm Weather &amp; Microclimate</h4>
                  <span className="text-[10px] text-slate-400 font-semibold block">Daenem Farm · Balogun-Ikire, Osun</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Sensors
              </span>
            </div>

            {/* Main Temp & Condition */}
            <div className="flex items-baseline justify-between mt-4">
              <div>
                <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                  29°C
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Partly Sunny · Feels like <strong className="text-slate-800">32°C</strong>
                </div>
              </div>

              {/* Poultry THI Health Index */}
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Flock Heat Stress (THI)</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-block mt-0.5">
                  71 THI · Optimal Comfort ✓
                </span>
              </div>
            </div>

            {/* Environmental Metric Badges */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <Droplets className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Humidity</span>
                <strong className="text-xs text-slate-800 font-mono">78% RH</strong>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <Wind className="w-3.5 h-3.5 text-teal-500 mx-auto mb-1" />
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Wind</span>
                <strong className="text-xs text-slate-800 font-mono">12 km/h SW</strong>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <Gauge className="w-3.5 h-3.5 text-purple-500 mx-auto mb-1" />
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Barometer</span>
                <strong className="text-xs text-slate-800 font-mono">1012 hPa</strong>
              </div>
            </div>
          </div>

          {/* Sunrise / Sunset Footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <Sunrise className="w-3.5 h-3.5 text-amber-500" />
              Sunrise: <strong className="text-slate-700">06:28 AM</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Sunset className="w-3.5 h-3.5 text-indigo-500" />
              Sunset: <strong className="text-slate-700">06:44 PM</strong>
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* WIDGET 2: AGRICULTURAL MARKET INTELLIGENCE & COMMODITY BENCHMARKS         */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#008751]">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Poultry &amp; Feed Market Index</h4>
                  <span className="text-[10px] text-slate-400 font-semibold block">Southwest Nigeria Trading Benchmark</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                Daily Index
              </span>
            </div>

            {/* Commodity Price Cards */}
            <div className="space-y-2 mt-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <strong className="text-xs text-slate-800 block">Table Eggs (Wholesale Crate)</strong>
                  <span className="text-[10px] text-slate-400">Ikire / Ibadan / Lagos depot average</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-[#008751]">₦4,900 – ₦5,200</div>
                  <span className="text-[9px] text-emerald-600 font-semibold">+2.8% this week</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <strong className="text-xs text-slate-800 block">Yellow Maize (Metric Tonne)</strong>
                  <span className="text-[10px] text-slate-400">North-to-South transit price</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-slate-800">₦740,000 / MT</div>
                  <span className="text-[9px] text-slate-500 font-medium">Stable</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <strong className="text-xs text-slate-800 block">Soybean Meal (48% Protein)</strong>
                  <span className="text-[10px] text-slate-400">Feed mill formulation ingredient</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-slate-800">₦610,000 / MT</div>
                  <span className="text-[9px] text-emerald-600 font-semibold">Supply steady</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
            <span>Source: Daenem Farm Market Desk</span>
            <span className="text-[#008751] font-bold">Updated Today ✓</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* WIDGET 3: DAILY SPOTLIGHT, INSPIRATION & GATEWAY STATUS                   */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Leadership &amp; Operations Thought</h4>
                  <span className="text-[10px] text-slate-400 font-semibold block">Daenem Farms Executive Spotlight</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                Editorial
              </span>
            </div>

            {/* Inspiration Quote */}
            <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-slate-50 to-purple-50/30 border border-slate-200/80">
              <blockquote className="text-xs italic text-slate-700 leading-relaxed">
                “Precision in commercial poultry lies not in guessing tomorrow’s yield, but in strictly mastering today’s water intake, feed conversion, and biosecurity sanitation.”
              </blockquote>
              <div className="mt-2 text-right">
                <span className="text-[10px] font-bold text-slate-900">— Daenem Operations Protocol</span>
                <span className="text-[9px] text-slate-400 block">Ikire Farm Centre Guidelines</span>
              </div>
            </div>

            {/* Gateway Infrastructure Health Strip */}
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  NIBSS NIP Payment Router:
                </span>
                <strong className="text-emerald-700">Operational (99.98%)</strong>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Solar Inverter &amp; Grid Power:
                </span>
                <strong className="text-emerald-700">100% Online (24.2 kW)</strong>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Egg Cold Storage (Chamber 1):
                </span>
                <strong className="text-emerald-700 font-mono">16.4°C Target</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
            <span>Biosecurity Gate Check: <strong>Active</strong></span>
            <span className="text-emerald-700 font-bold">All Passes Cleared ✓</span>
          </div>
        </div>

      </div>

    </div>
  );
};
