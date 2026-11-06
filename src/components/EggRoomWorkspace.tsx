import React, { useState } from 'react';
import { 
  Egg, ShieldCheck, Thermometer, Plus, Search, CheckCircle2, 
  AlertTriangle, ArrowUpRight, Package, Box, RefreshCw, Truck
} from 'lucide-react';
import { formatDualTime, formatCount, formatNaira } from '../lib/temporal.ts';

interface EggShiftRecord {
  id: string;
  shiftDate: string;
  houseSource: string;
  totalEggsCollected: number;
  jumboCrates: number;
  largeCrates: number;
  mediumCrates: number;
  crackedRejects: number;
  masterCartonsPacked: number; // 12 Crates = 360 Eggs
  looseCratesRemaining: number;
  roomTempCelsius: number;
  gradedBy: string;
  reconciliationStatus: 'Balanced' | 'Variance Investigation' | 'Awaiting Dispatch Match';
}

const INITIAL_EGG_RECORDS: EggShiftRecord[] = [
  {
    id: 'egg-shift-101',
    shiftDate: '06 Nov 2026 (Morning Shift)',
    houseSource: 'House 1 & House 2',
    totalEggsCollected: 22860,
    jumboCrates: 120,
    largeCrates: 480,
    mediumCrates: 152,
    crackedRejects: 34,
    masterCartonsPacked: 62,
    looseCratesRemaining: 8,
    roomTempCelsius: 16.2,
    gradedBy: 'Abosede Adeyemi',
    reconciliationStatus: 'Balanced',
  },
  {
    id: 'egg-shift-102',
    shiftDate: '05 Nov 2026 (Afternoon Shift)',
    houseSource: 'House 3 & House 1',
    totalEggsCollected: 18450,
    jumboCrates: 95,
    largeCrates: 390,
    mediumCrates: 125,
    crackedRejects: 22,
    masterCartonsPacked: 50,
    looseCratesRemaining: 10,
    roomTempCelsius: 15.8,
    gradedBy: 'Funke Ojo',
    reconciliationStatus: 'Balanced',
  },
  {
    id: 'egg-shift-103',
    shiftDate: '05 Nov 2026 (Morning Shift)',
    houseSource: 'House 1, 2, 3',
    totalEggsCollected: 23100,
    jumboCrates: 130,
    largeCrates: 495,
    mediumCrates: 140,
    crackedRejects: 41,
    masterCartonsPacked: 63,
    looseCratesRemaining: 9,
    roomTempCelsius: 16.4,
    gradedBy: 'Abosede Adeyemi',
    reconciliationStatus: 'Balanced',
  },
];

interface EggRoomWorkspaceProps {
  onNavigateToOrders?: () => void;
}

export const EggRoomWorkspace: React.FC<EggRoomWorkspaceProps> = ({
  onNavigateToOrders,
}) => {
  const [records, setRecords] = useState<EggShiftRecord[]>(INITIAL_EGG_RECORDS);
  const [coldRoomTemp, setColdRoomTemp] = useState<number>(16.1);
  const [totalCratesInStock, setTotalCratesInStock] = useState<number>(3420);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Form State
  const [shiftName, setShiftName] = useState<string>('Afternoon Collection');
  const [totalCollected, setTotalCollected] = useState<number>(11200);
  const [jumbo, setJumbo] = useState<number>(60);
  const [large, setLarge] = useState<number>(240);
  const [medium, setMedium] = useState<number>(70);
  const [cracked, setCracked] = useState<number>(18);
  const [grader, setGrader] = useState<string>('Abosede Adeyemi');

  const handleRecordShiftGrading = (e: React.FormEvent) => {
    e.preventDefault();
    const sumCrates = Number(jumbo) + Number(large) + Number(medium);
    const cartons = Math.floor(sumCrates / 12);
    const remainingCrates = sumCrates % 12;

    const newRecord: EggShiftRecord = {
      id: `egg-shift-${Date.now()}`,
      shiftDate: `06 Nov 2026 (${shiftName})`,
      houseSource: 'House 1, 2 & 3',
      totalEggsCollected: Number(totalCollected),
      jumboCrates: Number(jumbo),
      largeCrates: Number(large),
      mediumCrates: Number(medium),
      crackedRejects: Number(cracked),
      masterCartonsPacked: cartons,
      looseCratesRemaining: remainingCrates,
      roomTempCelsius: coldRoomTemp,
      gradedBy: grader,
      reconciliationStatus: 'Balanced',
    };

    setRecords([newRecord, ...records]);
    setTotalCratesInStock(prev => prev + sumCrates);
    setIsEntryModalOpen(false);
    setToastMessage(`Egg grading entry logged: ${formatCount(sumCrates)} crates (${formatCount(cartons)} master cartons packed).`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Egg Production</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Cold Storage & Egg Room</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Egg className="w-6 h-6 text-[#008751]" />
            Egg Room & Cold Storage Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Shift collection tallies, grading (Jumbo / Large / Medium), standardized 30-egg crated packaging, 360-egg master cartons, and 16°C cold room control.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToOrders && (
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#005A36] text-xs font-bold rounded-xl cursor-pointer shadow-2xs flex items-center gap-2"
            >
              <Truck className="w-4 h-4 text-[#008751]" />
              Fulfill Wholesale Orders
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEntryModalOpen(true)}
            className="btn-primary-glow px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Log Shift Grading
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cold Room Stock</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">{formatCount(totalCratesInStock)} Crates</span>
            <span className="text-[11px] text-slate-500 font-sans">{Math.floor(totalCratesInStock / 12)} Cartons</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">({formatCount(totalCratesInStock * 30)} Standard Eggs)</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cold Room Climate</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-blue-600">{coldRoomTemp}°C</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">Optimal (15-18°C)</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Relative Humidity: 74%</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Reserved for Orders</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-amber-600">1,690 Crates</span>
            <span className="text-[11px] text-slate-500 font-sans">4 Wholesale Buyers</span>
          </div>
          <span className="text-[10px] text-amber-700 font-semibold block mt-1">Available Free: {formatCount(totalCratesInStock - 1690)} Crates</span>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Reject / Crack Rate</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">0.24%</span>
            <span className="text-[11px] text-emerald-600 font-bold font-sans">Below 0.50% Target</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Sent to bakery cull pool</span>
        </div>
      </div>

      {/* Shift Grading Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-800">Egg Intake & Grading Registers (Balogun-Ikire Main Cold Room)</span>
          <span className="text-xs text-slate-500">Commercial Standard: 1 Crate = 30 Eggs | 1 Master Carton = 12 Crates (360 Eggs)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Shift & Date</th>
                <th className="py-3 px-4">House Source</th>
                <th className="py-3 px-4 text-right">Intake (Eggs)</th>
                <th className="py-3 px-4 text-right">Jumbo Crates</th>
                <th className="py-3 px-4 text-right">Large Crates</th>
                <th className="py-3 px-4 text-right">Medium Crates</th>
                <th className="py-3 px-4 text-right">Master Cartons (12 Cr)</th>
                <th className="py-3 px-4 text-right">Rejects</th>
                <th className="py-3 px-4">Graded By & Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {records.map((r) => {
                const totalCrates = r.jumboCrates + r.largeCrates + r.mediumCrates;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 font-sans">
                      {r.shiftDate}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-700">
                      {r.houseSource}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCount(r.totalEggsCollected)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-800">
                      {formatCount(r.jumboCrates)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCount(r.largeCrates)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {formatCount(r.mediumCrates)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#008751]">
                      {r.masterCartonsPacked} Cartons
                      <span className="block text-[10px] text-slate-400 font-normal">+{r.looseCratesRemaining} loose crates</span>
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 font-bold">
                      {r.crackedRejects} eggs
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="text-slate-900 font-medium block text-xs">{r.gradedBy}</span>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-700 mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-[#008751]" />
                        <span>{r.reconciliationStatus}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Egg className="w-5 h-5 text-[#008751]" />
              Log Shift Egg Grading & Packaging
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter graded egg numbers. Conversion: 30 eggs/crate, 12 crates/master carton.
            </p>

            <form onSubmit={handleRecordShiftGrading} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shift Name</label>
                  <input
                    type="text"
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Raw Eggs Collected</label>
                  <input
                    type="number"
                    min="1"
                    value={totalCollected}
                    onChange={(e) => setTotalCollected(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jumbo (Crates)</label>
                  <input
                    type="number"
                    min="0"
                    value={jumbo}
                    onChange={(e) => setJumbo(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Large (Crates)</label>
                  <input
                    type="number"
                    min="0"
                    value={large}
                    onChange={(e) => setLarge(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Medium (Crates)</label>
                  <input
                    type="number"
                    min="0"
                    value={medium}
                    onChange={(e) => setMedium(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cracked / Leakers (Eggs)</label>
                  <input
                    type="number"
                    min="0"
                    value={cracked}
                    onChange={(e) => setCracked(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Grading Technician</label>
                  <input
                    type="text"
                    value={grader}
                    onChange={(e) => setGrader(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                    required
                  />
                </div>
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
                  Post to Cold Room Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
