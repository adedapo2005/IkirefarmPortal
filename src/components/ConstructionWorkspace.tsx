import React, { useState } from 'react';
import { 
  HardHat, Plus, Search, CheckCircle2, AlertTriangle, ShieldCheck, 
  Building2, Hammer, FileSpreadsheet, ArrowUpRight, DollarSign, Calendar
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../lib/temporal.ts';

interface ConstructionProject {
  id: string;
  projectName: string;
  location: string;
  phase: string;
  progressPercent: number;
  agreedBudgetNGN: number;
  disbursedNGN: number;
  contractorName: string;
  targetCompletionDate: string;
  status: 'On Schedule' | 'Material Delay' | 'Inspection Gate';
}

interface BOQItem {
  id: string;
  itemCode: string;
  description: string;
  category: 'Structural Steel' | 'Civil Masonry' | 'Roofing & Cladding' | 'Plumbing & Water';
  unit: string;
  budgetQty: number;
  deliveredQty: number;
  unitRateNGN: number;
  totalCostNGN: number;
  testedPass: boolean;
}

const PROJECTS: ConstructionProject[] = [
  {
    id: 'proj-01',
    projectName: 'Layer House 04 Expansion (15,000 Birds Automated Unit)',
    location: 'Balogun-Ikire Complex, Sector B',
    phase: 'Structural Steel Erection & Cage Foundation',
    progressPercent: 68,
    agreedBudgetNGN: 48500000,
    disbursedNGN: 33200000,
    contractorName: 'Apex Civil Engineering Ltd (Engr. Olatunbosun)',
    targetCompletionDate: '15 Dec 2026',
    status: 'On Schedule',
  },
  {
    id: 'proj-02',
    projectName: 'Deep Aquifer Borehole & Industrial Water Treatment Plant',
    location: 'Balogun-Ikire Complex, North Boundary',
    phase: 'Submersible Pump Installation & Overhead Tank Tower',
    progressPercent: 85,
    agreedBudgetNGN: 14200000,
    disbursedNGN: 12000000,
    contractorName: 'HydraTech Drillers Nigeria',
    targetCompletionDate: '25 Nov 2026',
    status: 'Inspection Gate',
  },
  {
    id: 'proj-03',
    projectName: 'Biosecurity Vehicle Disinfection Wash-Bay & Guard Post',
    location: 'Balogun-Ikire Main Gate Entrance',
    phase: 'Concrete Apron Slab & High-Pressure Mist Plumbing',
    progressPercent: 42,
    agreedBudgetNGN: 6800000,
    disbursedNGN: 2850000,
    contractorName: 'Al-Barakah Construction & Masonry',
    targetCompletionDate: '10 Dec 2026',
    status: 'On Schedule',
  },
];

const BOQ_ITEMS: BOQItem[] = [
  {
    id: 'boq-01',
    itemCode: 'STL-16MM',
    description: 'High-Yield Deformed Steel Rebar 16mm (Tiger TMT)',
    category: 'Structural Steel',
    unit: 'Tonnes',
    budgetQty: 18,
    deliveredQty: 18,
    unitRateNGN: 1250000,
    totalCostNGN: 22500000,
    testedPass: true,
  },
  {
    id: 'boq-02',
    itemCode: 'CEM-42.5R',
    description: 'Dangote Falcon 42.5R Portland Cement (50kg bags)',
    category: 'Civil Masonry',
    unit: 'Bags',
    budgetQty: 1200,
    deliveredQty: 950,
    unitRateNGN: 9200,
    totalCostNGN: 11040000,
    testedPass: true,
  },
  {
    id: 'boq-03',
    itemCode: 'ROOF-ALZ',
    description: '0.55mm Heavy-Duty Aluzinc Corrugated Roofing Sheets',
    category: 'Roofing & Cladding',
    unit: 'Bundles',
    budgetQty: 85,
    deliveredQty: 85,
    unitRateNGN: 72000,
    totalCostNGN: 6120000,
    testedPass: true,
  },
  {
    id: 'boq-04',
    itemCode: 'AGG-GRAN',
    description: '3/4 inch Clean Quarry Granite Chippings (20T Tipper)',
    category: 'Civil Masonry',
    unit: 'Trips',
    budgetQty: 24,
    deliveredQty: 20,
    unitRateNGN: 210000,
    totalCostNGN: 5040000,
    testedPass: true,
  },
];

export const ConstructionWorkspace: React.FC = () => {
  const [projects, setProjects] = useState<ConstructionProject[]>(PROJECTS);
  const [boqList, setBoqList] = useState<BOQItem[]>(BOQ_ITEMS);
  const [activeTab, setActiveTab] = useState<'projects' | 'boq'>('projects');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalCapExCommitted = projects.reduce((sum, p) => sum + p.agreedBudgetNGN, 0);
  const totalDisbursed = projects.reduce((sum, p) => sum + p.disbursedNGN, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Projects & Assets</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Civil Construction Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <HardHat className="w-6 h-6 text-[#008751]" />
            Balogun-Ikire Capital Construction ERP
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live site diaries, Bill of Quantities (BOQ) material drawdowns, artisan milestone claims, and 28-day concrete cube compression evidence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="period-tabs flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'projects' ? 'bg-white text-[#008751] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Sites ({projects.length})
            </button>
            <button
              onClick={() => setActiveTab('boq')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'boq' ? 'bg-white text-[#008751] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BOQ Takeoff Register
            </button>
          </div>
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total CapEx Budget</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{formatNaira(totalCapExCommitted)}</span>
            <span className="text-[11px] text-slate-500 font-sans">3 Approved Sites</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Disbursed to Contractors</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">{formatNaira(totalDisbursed)}</span>
            <span className="text-[11px] text-slate-500 font-sans">{((totalDisbursed / totalCapExCommitted) * 100).toFixed(0)}% Disbursed</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Retention Fund Escrow</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-blue-600">{formatNaira(totalCapExCommitted * 0.05)}</span>
            <span className="text-[10px] text-blue-600 font-sans">5% Defect Escrow</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Structural QA Tests</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-emerald-700">100% Passed</span>
            <span className="text-[10px] text-emerald-600 font-sans">28-day Cube Tests</span>
          </div>
        </div>
      </div>

      {activeTab === 'projects' ? (
        /* Projects List */
        <div className="grid grid-cols-1 gap-4">
          {projects.map((proj) => (
            <div key={proj.id} className="premium-card p-6 rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#005A36]">
                      {proj.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{proj.id}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{proj.projectName}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{proj.location} • Contractor: <strong className="text-slate-700">{proj.contractorName}</strong></p>
                </div>

                <div className="text-right font-mono-numbers">
                  <span className="text-xs text-slate-400 block">Agreed Contract Value</span>
                  <span className="text-lg font-bold text-slate-900">{formatNaira(proj.agreedBudgetNGN)}</span>
                  <span className="text-xs text-emerald-700 block mt-0.5">Paid: {formatNaira(proj.disbursedNGN)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Current Phase: {proj.phase}</span>
                  <span className="text-[#008751] font-mono-numbers">{proj.progressPercent}% Complete</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#008751] to-[#00A86B] rounded-full transition-all duration-500"
                    style={{ width: `${proj.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Target Handover Date: <strong className="text-slate-800">{proj.targetCompletionDate}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-[#008751]" />
                    Site Diary & Geotagged Photos Verified
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* BOQ Takeoff Table */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-800">Bill of Quantities (BOQ) Verified Material Ledger</span>
            <span className="text-xs text-slate-500">Quality Spec: 28-day Concrete Crush Test &gt;= 25 N/mm²</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item Code & Material</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Budget Qty</th>
                  <th className="py-3 px-4 text-right">Delivered Qty</th>
                  <th className="py-3 px-4 text-right">Unit Rate (NGN)</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Total Commitment</th>
                  <th className="py-3 px-4 text-center">Structural QA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {boqList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-slate-900 block">{item.description}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.itemCode}</span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatCount(item.budgetQty)} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCount(item.deliveredQty)} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {formatNaira(item.unitRateNGN)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#008751]">
                      {formatNaira(item.totalCostNGN)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#005A36]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Certified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
