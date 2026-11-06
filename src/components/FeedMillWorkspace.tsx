import React, { useState } from 'react';
import { 
  Wheat, Plus, Search, CheckCircle2, AlertTriangle, ShieldCheck, 
  RotateCcw, Scale, Gauge, Factory, Calendar, Check
} from 'lucide-react';
import { formatDualTime, formatCount, formatNaira } from '../lib/temporal.ts';

interface SiloInventory {
  id: string;
  siloName: string;
  ingredient: string;
  capacityMT: number;
  currentStockMT: number;
  dailyBurnMT: number;
  daysRemaining: number;
  moisturePercent: number;
  aflatoxinPpb: number;
  qualityStatus: 'Cleared for Milling' | 'Quality Quarantine' | 'Re-test Required';
}

interface MillingBatch {
  id: string;
  batchNumber: string;
  formulaName: string;
  targetWeightKg: number;
  actualMilledKg: number;
  sacksPacked: number; // 50kg bags
  costPerBagNGN: number;
  milledDateWAT: string;
  millingSupervisor: string;
  status: 'Completed & Staged' | 'In Progress' | 'Quality Hold';
}

const SILOS: SiloInventory[] = [
  {
    id: 'silo-01',
    siloName: 'Silo A (North)',
    ingredient: 'Yellow Maize (Dry Grains)',
    capacityMT: 80,
    currentStockMT: 46.5,
    dailyBurnMT: 4.8,
    daysRemaining: 9.7,
    moisturePercent: 12.1,
    aflatoxinPpb: 7.2,
    qualityStatus: 'Cleared for Milling',
  },
  {
    id: 'silo-02',
    siloName: 'Silo B (Central)',
    ingredient: 'Soya Bean Meal (Solvent Extracted)',
    capacityMT: 50,
    currentStockMT: 28.2,
    dailyBurnMT: 2.1,
    daysRemaining: 13.4,
    moisturePercent: 11.4,
    aflatoxinPpb: 4.5,
    qualityStatus: 'Cleared for Milling',
  },
  {
    id: 'silo-03',
    siloName: 'Silo C (South)',
    ingredient: 'Wheat Offal (High Fiber)',
    capacityMT: 40,
    currentStockMT: 12.0,
    dailyBurnMT: 1.6,
    daysRemaining: 7.5,
    moisturePercent: 13.0,
    aflatoxinPpb: 8.9,
    qualityStatus: 'Cleared for Milling',
  },
  {
    id: 'silo-04',
    siloName: 'Bunker D (Additives)',
    ingredient: 'Limestone Grit & Oyster Shell',
    capacityMT: 30,
    currentStockMT: 19.8,
    dailyBurnMT: 1.0,
    daysRemaining: 19.8,
    moisturePercent: 3.2,
    aflatoxinPpb: 0.0,
    qualityStatus: 'Cleared for Milling',
  },
];

const INITIAL_BATCHES: MillingBatch[] = [
  {
    id: 'mb-801',
    batchNumber: 'MB-2026-1106-01',
    formulaName: 'Layer Mash Phase I (High Calcium)',
    targetWeightKg: 5000,
    actualMilledKg: 5020,
    sacksPacked: 100,
    costPerBagNGN: 19850,
    milledDateWAT: '06 Nov 2026, 08:30 AM WAT',
    millingSupervisor: 'Idris Oladele',
    status: 'Completed & Staged',
  },
  {
    id: 'mb-802',
    batchNumber: 'MB-2026-1105-02',
    formulaName: 'Layer Mash Phase II (Commercial)',
    targetWeightKg: 5000,
    actualMilledKg: 4990,
    sacksPacked: 100,
    costPerBagNGN: 18900,
    milledDateWAT: '05 Nov 2026, 02:40 PM WAT',
    millingSupervisor: 'Idris Oladele',
    status: 'Completed & Staged',
  },
  {
    id: 'mb-803',
    batchNumber: 'MB-2026-1105-01',
    formulaName: 'Grower Mash Special (Pullets)',
    targetWeightKg: 3000,
    actualMilledKg: 3010,
    sacksPacked: 60,
    costPerBagNGN: 21200,
    milledDateWAT: '05 Nov 2026, 09:15 AM WAT',
    millingSupervisor: 'Rasheed Bakare',
    status: 'Completed & Staged',
  },
];

export const FeedMillWorkspace: React.FC = () => {
  const [silos, setSilos] = useState<SiloInventory[]>(SILOS);
  const [batches, setBatches] = useState<MillingBatch[]>(INITIAL_BATCHES);
  const [isMillingModalOpen, setIsMillingModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Milling Modal State
  const [formula, setFormula] = useState<string>('Layer Mash Phase I');
  const [targetKg, setTargetKg] = useState<number>(5000);
  const [supervisor, setSupervisor] = useState<string>('Idris Oladele');

  const handleStartMilling = (e: React.FormEvent) => {
    e.preventDefault();
    const bags = Math.floor(targetKg / 50);
    const newBatch: MillingBatch[] = [
      {
        id: `mb-${Date.now()}`,
        batchNumber: `MB-2026-1106-0${batches.length + 1}`,
        formulaName: formula,
        targetWeightKg: targetKg,
        actualMilledKg: targetKg,
        sacksPacked: bags,
        costPerBagNGN: 19800,
        milledDateWAT: 'Just now (06 Nov 2026)',
        millingSupervisor: supervisor,
        status: 'Completed & Staged',
      },
      ...batches,
    ];
    setBatches(newBatch);
    setIsMillingModalOpen(false);
    setToastMessage(`Batch ${newBatch[0].batchNumber} milled successfully: ${formatCount(bags)} bags (50kg) staged!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Feed & Nutrition</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Feed Mill & Silos</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Wheat className="w-6 h-6 text-[#008751]" />
            Feed Mill & Grain Silos Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bulk grain storage silos, moisture & aflatoxin quality control, least-cost nutrition formulations, and 50kg bagging staging.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsMillingModalOpen(true)}
          className="btn-primary-glow px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Factory className="w-4 h-4" />
          Queue Milling Run
        </button>
      </div>

      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-[#005A36] text-xs rounded-xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Silo Capacities Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[#008751]" />
          Bulk Grain Silos & Storage Runway
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {silos.map((silo) => {
            const fillPct = ((silo.currentStockMT / silo.capacityMT) * 100).toFixed(0);
            const isLow = silo.daysRemaining < 10;
            return (
              <div key={silo.id} className="premium-card p-4 rounded-xl">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">{silo.siloName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-[#005A36]'
                  }`}>
                    {silo.daysRemaining.toFixed(1)} Days Left
                  </span>
                </div>
                
                <span className="text-[11px] text-slate-500 block mb-3">{silo.ingredient}</span>

                <div className="flex items-baseline justify-between mb-1.5 font-mono-numbers">
                  <span className="text-xl font-bold text-slate-900">{silo.currentStockMT} MT</span>
                  <span className="text-xs text-slate-400">/ {silo.capacityMT} MT ({fillPct}%)</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div 
                    className={`h-full rounded-full ${isLow ? 'bg-amber-500' : 'bg-[#008751]'}`} 
                    style={{ width: `${fillPct}%` }}
                  />
                </div>

                <div className="text-[10px] text-slate-500 space-y-1 border-t border-slate-100 pt-2 font-mono-numbers">
                  <div className="flex justify-between">
                    <span>Moisture:</span>
                    <span className="font-semibold text-slate-800">{silo.moisturePercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aflatoxin:</span>
                    <span className="font-semibold text-emerald-700">{silo.aflatoxinPpb} ppb (Safe &lt;20)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production Batch Milling Ledger */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-800">Milling Production Batches & 50kg Bag Yield</span>
          <span className="text-xs text-slate-500">Milling Efficiency: Standard 50kg Bags Packed with Batch QR Tags</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Batch #</th>
                <th className="py-3 px-4">Formulation Recipe</th>
                <th className="py-3 px-4 text-right">Target (kg)</th>
                <th className="py-3 px-4 text-right">Actual Output</th>
                <th className="py-3 px-4 text-right">50kg Sacks Packed</th>
                <th className="py-3 px-4 text-right">Cost Per Bag</th>
                <th className="py-3 px-4">Supervisor & Date</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 font-mono text-[11px]">
                    {b.batchNumber}
                  </td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-800">
                    {b.formulaName}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {formatCount(b.targetWeightKg)} kg
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCount(b.actualMilledKg)} kg
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#008751]">
                    {b.sacksPacked} Bags (50kg)
                  </td>
                  <td className="py-3 px-4 text-right text-slate-800">
                    {formatNaira(b.costPerBagNGN)}
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span className="text-slate-900 font-medium block text-xs">{b.millingSupervisor}</span>
                    <span className="text-[10px] text-slate-400">{b.milledDateWAT}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#005A36]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isMillingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Factory className="w-5 h-5 text-[#008751]" />
              Queue Milling Batch Production
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Select formula and target tonnage. Automated silo feed intake will decrement maize and soya silos proportionally.
            </p>

            <form onSubmit={handleStartMilling} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Formulation Recipe</label>
                <select
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-semibold"
                >
                  <option value="Layer Mash Phase I (High Calcium)">Layer Mash Phase I (High Calcium)</option>
                  <option value="Layer Mash Phase II (Commercial)">Layer Mash Phase II (Commercial)</option>
                  <option value="Grower Mash Special (Pullets)">Grower Mash Special (Pullets)</option>
                  <option value="Broiler Finisher (High Energy)">Broiler Finisher (High Energy)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Batch Weight (kg)</label>
                <input
                  type="number"
                  step="500"
                  min="1000"
                  value={targetKg}
                  onChange={(e) => setTargetKg(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono-numbers"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Yield: approximately {Math.floor(targetKg / 50)} bags of 50kg standard feed.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Milling Shift Supervisor</label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMillingModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-glow px-4 py-2 rounded-lg text-white font-bold cursor-pointer"
                >
                  Start Automated Batch Milling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
