import React, { useState, useEffect } from 'react';
import { Clock, Globe, Sun, Moon, MapPin, Sparkles, Navigation, ShieldCheck } from 'lucide-react';

export interface ClockLocationConfig {
  id: string;
  name: string;
  sublabel: string;
  zone: string;
  offsetLabel: string;
  isPrimary?: boolean;
}

export const WORLD_CLOCKS: ClockLocationConfig[] = [
  {
    id: 'farm',
    name: 'Daenem Farm, Balogun-Ikire',
    sublabel: 'Osun State, Nigeria · Farm Operations Hub',
    zone: 'Africa/Lagos',
    offsetLabel: 'WAT · UTC+1',
    isPrimary: true,
  },
  {
    id: 'new-york',
    name: 'New York',
    sublabel: 'United States · Executive & Investor Hub',
    zone: 'America/New_York',
    offsetLabel: 'EST · UTC-5',
  },
  {
    id: 'london',
    name: 'London',
    sublabel: 'United Kingdom · Trade & Diaspora Hub',
    zone: 'Europe/London',
    offsetLabel: 'GMT · UTC+0',
  },
  {
    id: 'toronto',
    name: 'Toronto',
    sublabel: 'Canada · Agricultural Trade Network',
    zone: 'America/Toronto',
    offsetLabel: 'EST · UTC-5',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    sublabel: 'Japan · Poultry Tech & Equipment',
    zone: 'Asia/Tokyo',
    offsetLabel: 'JST · UTC+9',
  },
  {
    id: 'beijing',
    name: 'Beijing',
    sublabel: 'China · Feed & Milling Supply Chain',
    zone: 'Asia/Shanghai',
    offsetLabel: 'CST · UTC+8',
  },
  {
    id: 'moscow',
    name: 'Moscow',
    sublabel: 'Europe · Grain & Feed Commodities',
    zone: 'Europe/Moscow',
    offsetLabel: 'MSK · UTC+3',
  },
];

interface TimeData {
  time12: string;
  dateStr: string;
  hour24: number;
  minute: number;
  second: number;
  isDaytime: boolean;
}

function getTimeForZone(date: Date, zone: string): TimeData {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);

    const parts24 = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const h24 = Number(parts24.find(p => p.type === 'hour')?.value || 0);
    const m = Number(parts24.find(p => p.type === 'minute')?.value || 0);
    const s = Number(parts24.find(p => p.type === 'second')?.value || 0);

    const hourStr = parts.find(p => p.type === 'hour')?.value || '12';
    const minStr = parts.find(p => p.type === 'minute')?.value || '00';
    const secStr = parts.find(p => p.type === 'second')?.value || '00';
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || 'AM';

    return {
      time12: `${hourStr}:${minStr}:${secStr} ${dayPeriod}`,
      dateStr: dateParts,
      hour24: h24,
      minute: m,
      second: s,
      isDaytime: h24 >= 6 && h24 < 18,
    };
  } catch {
    return {
      time12: '—',
      dateStr: '—',
      hour24: 12,
      minute: 0,
      second: 0,
      isDaytime: true,
    };
  }
}

export const GlobalOperationsClockMatrix: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      {/* Matrix Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#008751]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-slate-900">
                Global Operations Clock Network
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#005A36] border border-emerald-200">
                7 Official Locations
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Synchronized West Africa Time (WAT) alongside international executive and supply chain partner hubs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live GPS Time Sync
          </span>
        </div>
      </div>

      {/* Responsive Clock Grid (Expands to 4-7 columns on wide/4K screens) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3.5">
        {WORLD_CLOCKS.map((clock) => {
          const t = getTimeForZone(currentDate, clock.zone);
          const hourDeg = (t.hour24 % 12) * 30 + t.minute * 0.5;
          const minDeg = t.minute * 6 + t.second * 0.1;
          const secDeg = t.second * 6;

          return (
            <div
              key={clock.id}
              className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
                clock.isPrimary
                  ? 'bg-gradient-to-br from-[#0c4937] via-[#093d2e] to-[#05281e] text-white border-2 border-emerald-400/50 shadow-md shadow-emerald-950/20 col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2 2xl:col-span-1'
                  : 'bg-white border border-slate-200 hover:border-emerald-300 text-slate-900 shadow-2xs hover:shadow-xs'
              }`}
            >
              {/* Primary Anchor Ribbon */}
              {clock.isPrimary && (
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 text-[9px] font-extrabold tracking-wide uppercase">
                  <Sparkles className="w-2.5 h-2.5" />
                  Farm Anchor
                </div>
              )}

              {/* Header: Location & Zone */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className={`text-[10px] font-bold block uppercase tracking-wider ${clock.isPrimary ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {clock.offsetLabel}
                  </span>
                  <h4 className={`text-xs font-bold truncate max-w-[170px] ${clock.isPrimary ? 'text-white' : 'text-slate-900'}`}>
                    {clock.name}
                  </h4>
                </div>

                {/* Day / Night Indicator */}
                <div
                  className={`p-1 rounded-lg shrink-0 ${
                    t.isDaytime
                      ? clock.isPrimary
                        ? 'bg-amber-400/20 text-amber-300'
                        : 'bg-amber-50 text-amber-600'
                      : clock.isPrimary
                      ? 'bg-indigo-400/20 text-indigo-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  title={t.isDaytime ? 'Daytime' : 'Nighttime'}
                >
                  {t.isDaytime ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Analog Dial & Digital Readout Body */}
              <div className="flex items-center gap-3">
                {/* SVG Analog Clock Face */}
                <div className="relative w-12 h-12 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    {/* Dial Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill={clock.isPrimary ? 'rgba(255,255,255,0.06)' : '#f8fafc'}
                      stroke={clock.isPrimary ? 'rgba(255,255,255,0.2)' : '#e2e8f0'}
                      strokeWidth="3"
                    />

                    {/* 12 Hour Ticks */}
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                      <line
                        key={deg}
                        x1="50"
                        y1="10"
                        x2="50"
                        y2={deg % 90 === 0 ? '16' : '13'}
                        stroke={clock.isPrimary ? 'rgba(255,255,255,0.4)' : '#94a3b8'}
                        strokeWidth={deg % 90 === 0 ? '3' : '1.5'}
                        transform={`rotate(${deg} 50 50)`}
                      />
                    ))}

                    {/* Hour Hand */}
                    <line
                      x1="50"
                      y1="50"
                      x2="50"
                      y2="26"
                      stroke={clock.isPrimary ? '#ffffff' : '#1e293b'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      transform={`rotate(${hourDeg} 50 50)`}
                    />

                    {/* Minute Hand */}
                    <line
                      x1="50"
                      y1="50"
                      x2="50"
                      y2="16"
                      stroke={clock.isPrimary ? '#6ee7b7' : '#059669'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      transform={`rotate(${minDeg} 50 50)`}
                    />

                    {/* Sweep Second Hand */}
                    <line
                      x1="50"
                      y1="56"
                      x2="50"
                      y2="12"
                      stroke={clock.isPrimary ? '#34d399' : '#10b981'}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      transform={`rotate(${secDeg} 50 50)`}
                    />

                    {/* Center Pin */}
                    <circle
                      cx="50"
                      cy="50"
                      r="3.5"
                      fill={clock.isPrimary ? '#34d399' : '#047857'}
                    />
                  </svg>
                </div>

                {/* Digital Readout */}
                <div className="grow min-w-0">
                  <div className={`font-mono font-bold tracking-tight text-sm leading-none ${clock.isPrimary ? 'text-white' : 'text-slate-900'}`}>
                    {t.time12}
                  </div>
                  <div className={`text-[10px] mt-1 truncate ${clock.isPrimary ? 'text-emerald-200/80' : 'text-slate-500'}`}>
                    {t.dateStr}
                  </div>
                  <div className={`text-[9px] truncate mt-0.5 ${clock.isPrimary ? 'text-emerald-300/60' : 'text-slate-400'}`}>
                    {clock.sublabel.split('·')[1] || clock.sublabel}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
