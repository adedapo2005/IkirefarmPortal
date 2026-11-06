import React, { useState } from 'react';
import { 
  Bird, Calendar, ShieldCheck, AlertTriangle, CheckCircle2, 
  Plus, Search, Download, Filter, FileSpreadsheet, ArrowLeft,
  Egg, Wheat, Activity, Check, Save
} from 'lucide-react';
import { formatDualTime, formatCount } from '../lib/temporal.ts';

interface PenDailyRecord {
  id: string;
  houseId: string;
  houseName: string;
  flockBatch: string;
  breed: string;
  ageWeeks: number;
  ageDays: number;
  openingStock: number;
  mortality: number;
  culls: number;
  feedConsumedKg: number;
  feedType: string;
  eggsCrates: number;
  looseEggs: number;
  leakers: number;
  closingStock: number;
  hdepPercent: number; // Hen-Day Egg Production
  attendantName: string;
  status: 'Verified & Signed' | 'Pending Supervisor' | 'Discrepancy';
}

const INITIAL_RECORDS: PenDailyRecord[] = [
  {
    id: 'pen-rec-01',
    houseId: 'H1',
    houseName: 'House 1 (East Wing Cages)',
    flockBatch: 'LY-2025-04 (ISA Brown)',
    breed: 'ISA Brown',
    ageWeeks: 38,
    ageDays: 266,
    openingStock: 12450,
    mortality: 8,
    culls: 2,
    feedConsumedKg: 1494,
    feedType: 'Layer Mash Phase II',
    eggsCrates: 388,
    looseEggs: 14,
    leakers: 6,
    closingStock: 12440,
    hdepPercent: 93.6,
    attendantName: 'Babatunde Alamu',
    status: 'Verified & Signed',
  },
  {
    id: 'pen-rec-02',
    houseId: 'H2',
    houseName: 'House 2 (West Wing Cages)',
    flockBatch: 'LY-2025-05 (Bovans White)',
    breed: 'Bovans White',
    ageWeeks: 32,
    ageDays: 224,
    openingStock: 12050,
    mortality: 11,
    culls: 4,
    feedConsumedKg: 1446,
    feedType: 'Layer Mash Phase I',
    eggsCrates: 374,
    looseEggs: 8,
    leakers: 9,
    closingStock: 12035,
    hdepPercent: 93.3,
    attendantName: 'Sunday Adeleke',
    status: 'Verified & Signed',
  },
  {
    id: 'pen-rec-03',
    houseId: 'H3',
    houseName: 'House 3 (South Automated)',
    flockBatch: 'LY-2026-01 (ISA Brown)',
    breed: 'ISA Brown',
    ageWeeks: 24,
    ageDays: 168,
    openingStock: 12800,
    mortality: 6,
    culls: 1,
    feedConsumedKg: 1408,
    feedType: 'Layer Mash Phase I',
    eggsCrates: 372,
    looseEggs: 18,
    leakers: 4,
    closingStock: 12793,
    hdepPercent: 87.4,
    attendantName: 'Kazeem Olatunji',
    status: 'Pending Supervisor',
  },
  {
    id: 'pen-rec-04',
    houseId: 'H4',
    houseName: 'House 4 (Pullet Rearing Unit)',
    flockBatch: 'PL-2026-02 (Lohmann Tierzucht)',
    breed: 'Lohmann Brown',
    ageWeeks: 14,
    ageDays: 98,
    openingStock: 11200,
    mortality: 3,
    culls: 0,
    feedConsumedKg: 896,
    feedType: 'Grower Mash Special',
    eggsCrates: 0,
    looseEggs: 0,
    leakers: 0,
    closingStock: 11197,
    hdepPercent: 0,
    attendantName: 'Emeka Eze',
    status: 'Verified & Signed',
  },
];

interface DailyPenRegisterWorkspaceProps {
  onBackToDashboard?: () => void;
}

export const DailyPenRegisterWorkspace: React.FC<DailyPenRegisterWorkspaceProps> = ({
  onBackToDashboard,
}) => {
  const [records, setRecords] = useState<PenDailyRecord[]>(INITIAL_RECORDS);
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-06');
  const [selectedHouseFilter, setSelectedHouseFilter] = useState<string>('all');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Daily Log Form State
  const [targetHouse, setTargetHouse] = useState<string>('H3');
  const [newMortality, setNewMortality] = useState<number>(5);
  const [newCulls, setNewCulls] = useState<number>(1);
  const [newFeedKg, setNewFeedKg] = useState<number>(1420);
  const [newCrates, setNewCrates] = useState<number>(375);
  const [newLoose, setNewLoose] = useState<number>(12);
  const [newLeakers, setNewLeakers] = useState<number>(5);
  const [attendant, setAttendant] = useState<string>('Babatunde Alamu');

  const filteredRecords = records.filter(r => {
    return selectedHouseFilter === 'all' || r.houseId === selectedHouseFilter;
  });

  const totalBirdsOpening = filteredRecords.reduce((sum, r) => sum + r.openingStock, 0);
  const totalMortality = filteredRecords.reduce((sum, r) => sum + r.mortality, 0);
  const totalCrates = filteredRecords.reduce((sum, r) => sum + r.eggsCrates, 0);
  const totalFeedKg = filteredRecords.reduce((sum, r) => sum + r.feedConsumedKg, 0);
  const avgHdep = (
    filteredRecords.filter(r => r.hdepPercent > 0).reduce((sum, r) => sum + r.hdepPercent, 0) /
    (filteredRecords.filter(r => r.hdepPercent > 0).length || 1)
  ).toFixed(1);

  const handleSaveDailyRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = records.find(r => r.houseId === targetHouse);
    const opening = existing ? existing.closingStock : 12500;
    const closing = opening - Number(newMortality) - Number(newCulls);
    const totalEggs = Number(newCrates) * 30 + Number(newLoose);
    const hdep = opening > 0 ? ((totalEggs / opening) * 100).toFixed(1) : '0';

    const newRecord: PenDailyRecord = {
      id: `pen-rec-${Date.now()}`,
      houseId: targetHouse,
      houseName: `House ${targetHouse.replace('H', '')} Operational Unit`,
      flockBatch: `FL-${targetHouse}-2026`,
      breed: 'ISA Brown',
      ageWeeks: 35,
      ageDays: 245,
      openingStock: opening,
      mortality: Number(newMortality),
      culls: Number(newCulls),
      feedConsumedKg: Number(newFeedKg),
      feedType: 'Layer Mash Phase I',
      eggsCrates: Number(newCrates),
      looseEggs: Number(newLoose),
      leakers: Number(newLeakers),
      closingStock: closing,
      hdepPercent: parseFloat(hdep),
      attendantName: attendant,
      status: 'Verified & Signed',
    };

    setRecords([newRecord, ...records.filter(r => r.houseId !== targetHouse)]);
    setIsEntryModalOpen(false);
    setToastMessage(`Daily record for House ${targetHouse} saved and verified! Closing headcount: ${formatCount(closing)} birds.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Flocks & Housing</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Daily Pen Register</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-[#008751]" />
            7-Column Daily Pen Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Balogun-Ikire strict biological conservation ledger: Age, Opening Headcount, Mortality, Culls, Feed Intake, Egg Yield (30-Egg Crates), and Closing Headcount.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-white shadow-2xs text-slate-700 outline-hidden"
          />

          <button
            type="button"
            onClick={() => setIsEntryModalOpen(true)}
            className="btn-primary-glow px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Post Daily Pen Log
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-[#005A36] text-xs rounded-xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 4 Summary Kpis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Birds On Site</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{formatCount(totalBirdsOpening)}</span>
            <span className="text-[11px] text-slate-500 font-sans">Across 4 Houses</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Today's Egg Production</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">{formatCount(totalCrates)} Crates</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">Avg {avgHdep}% HDEP</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">({formatCount(totalCrates * 30)} Standard Eggs)</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Daily Feed Intake</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-amber-700">{formatCount(totalFeedKg)} kg</span>
            <span className="text-[11px] text-slate-500 font-sans">{(totalFeedKg / 50).toFixed(1)} Bags (50kg)</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Daily Mortality</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{totalMortality} Birds</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">0.06% (Normal &lt;0.15%)</span>
          </div>
        </div>
      </div>

      {/* Main 7-Column Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Operational Pen Ledgers:</span>
            <span className="text-xs text-slate-500">Date: {selectedDate} (WAT Lagos)</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedHouseFilter}
              onChange={(e) => setSelectedHouseFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-hidden font-medium"
            >
              <option value="all">All Houses</option>
              <option value="H1">House 1 (East Wing)</option>
              <option value="H2">House 2 (West Wing)</option>
              <option value="H3">House 3 (South Automated)</option>
              <option value="H4">House 4 (Pullet Rearing)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">House & Cohort</th>
                <th className="py-3 px-3 text-center">Age (Wks/Days)</th>
                <th className="py-3 px-4 text-right">Opening Stock</th>
                <th className="py-3 px-4 text-right">Mortality / Culls</th>
                <th className="py-3 px-4 text-right">Feed Consumed</th>
                <th className="py-3 px-4 text-right">Eggs (30-Egg Crates)</th>
                <th className="py-3 px-3 text-center">HDEP %</th>
                <th className="py-3 px-4 text-right">Closing Stock</th>
                <th className="py-3 px-4">Attendant & Sign-off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {filteredRecords.map((r) => {
                const mortRate = ((r.mortality / (r.openingStock || 1)) * 100);
                const isMortWarning = mortRate > 0.15;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-slate-900 block">{r.houseName}</span>
                      <span className="text-[10px] text-slate-500">{r.flockBatch}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-800">{r.ageWeeks} wks</span>
                      <span className="text-[10px] text-slate-400 block font-normal">{r.ageDays} d</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCount(r.openingStock)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`font-bold ${isMortWarning ? 'text-rose-600' : 'text-slate-900'}`}>
                          {r.mortality} mort
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">{r.culls} cull</span>
                      </div>
                      <span className="block text-[10px] text-slate-400">
                        ({mortRate.toFixed(2)}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-slate-900">{formatCount(r.feedConsumedKg)} kg</span>
                      <span className="block text-[10px] text-slate-400 font-sans">
                        {(r.feedConsumedKg / (r.openingStock || 1) * 1000).toFixed(0)} g/bird
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-[#008751]">
                        {formatCount(r.eggsCrates)} Crates
                      </span>
                      <span className="block text-[10px] text-slate-400 font-sans">
                        +{r.looseEggs} loose ({r.leakers} leakers)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {r.hdepPercent > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          {r.hdepPercent}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Rearing (0%)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 bg-slate-50/50">
                      {formatCount(r.closingStock)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="text-slate-900 font-medium block text-xs">{r.attendantName}</span>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-700 mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-[#008751]" />
                        <span>{r.status}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Bird className="w-5 h-5 text-[#008751]" />
              Post Daily Pen Register Entry
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter official shift count. Biological conservation is strictly enforced: Closing = Opening - Mortality - Culls.
            </p>

            <form onSubmit={handleSaveDailyRecord} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target House & Flock</label>
                <select
                  value={targetHouse}
                  onChange={(e) => setTargetHouse(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-semibold"
                >
                  <option value="H1">House 1 - ISA Brown (Layer)</option>
                  <option value="H2">House 2 - Bovans White (Layer)</option>
                  <option value="H3">House 3 - ISA Brown (Layer)</option>
                  <option value="H4">House 4 - Lohmann Brown (Pullet)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mortality Count (Birds)</label>
                  <input
                    type="number"
                    min="0"
                    value={newMortality}
                    onChange={(e) => setNewMortality(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Culls (Unthrifty / Sick)</label>
                  <input
                    type="number"
                    min="0"
                    value={newCulls}
                    onChange={(e) => setNewCulls(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Eggs (30-Crates)</label>
                  <input
                    type="number"
                    min="0"
                    value={newCrates}
                    onChange={(e) => setNewCrates(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loose Eggs</label>
                  <input
                    type="number"
                    min="0"
                    max="29"
                    value={newLoose}
                    onChange={(e) => setNewLoose(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Leakers / Cracked</label>
                  <input
                    type="number"
                    min="0"
                    value={newLeakers}
                    onChange={(e) => setNewLeakers(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Feed Consumed (kg)</label>
                <input
                  type="number"
                  min="0"
                  value={newFeedKg}
                  onChange={(e) => setNewFeedKg(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Shift Attendant Name</label>
                <input
                  type="text"
                  value={attendant}
                  onChange={(e) => setAttendant(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-glow px-4 py-2 rounded-lg text-white font-bold cursor-pointer"
                >
                  Save & Attest Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
