import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, ArrowLeft, ArrowRight, Save, 
  HelpCircle, ChevronRight, TrendingUp, AlertCircle, Info,
  Sparkles, Calendar, Layers, Home, FileText
} from 'lucide-react';
import { formatDualTime, formatCount } from '../lib/temporal.ts';

interface AddFlockWorkspaceProps {
  onBackToFlocks: () => void;
  onFlockCreated: (flockData: any) => void;
}

export const AddFlockWorkspace: React.FC<AddFlockWorkspaceProps> = ({
  onBackToFlocks,
  onFlockCreated,
}) => {
  // 5 Step Chevrons
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string>('All changes saved - Last saved 2 seconds ago by Glory Mercy');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  // Form State
  const [flockName, setFlockName] = useState<string>('Layer Flock - Nov 2026');
  const [flockType, setFlockType] = useState<string>('Layers (Commercial Egg Production)');
  const [breed, setBreed] = useState<string>('ISA Brown');
  const [purpose, setPurpose] = useState<string>('Commercial Table Eggs');
  const [startDate, setStartDate] = useState<string>('2026-11-06');
  const [endDate, setEndDate] = useState<string>('');
  const [farmLocation, setFarmLocation] = useState<string>('Balogun-Ikire Main Complex');
  const [houseUnit, setHouseUnit] = useState<string>('House 03 (Automated Battery Cage)');
  const [intakeBirds, setIntakeBirds] = useState<number>(5000);
  const [hatcherySource, setHatcherySource] = useState<string>('CHI Farms Hatchery (Ibadan)');
  const [notes, setNotes] = useState<string>('Healthy day-old pullets received at optimal ambient temperature. Pre-heating verified.');

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      setSaveStatus(`Step ${currentStep} progress recorded`);
    } else {
      // Commit creation
      setToastVisible(true);
      setTimeout(() => {
        onFlockCreated({ flockName, breed, intakeBirds, houseUnit });
      }, 1500);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Top Breadcrumb Rail + Autosave Switcher + Back Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="hover:text-slate-900 cursor-pointer" onClick={onBackToFlocks}>Flocks</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Add New Flock</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Flock</h1>
          <p className="text-xs text-slate-500 mt-0.5">Enter the flock details below. Information will be saved automatically as you type.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Autosave Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-[#005A36]">
            <CheckCircle2 className="w-4 h-4 text-[#008751]" />
            <span className="font-medium">{saveStatus}</span>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <span>Auto-save</span>
            <input 
              type="checkbox" 
              checked={autoSaveEnabled} 
              onChange={() => setAutoSaveEnabled(!autoSaveEnabled)} 
              className="accent-[#008751] w-4 h-4 cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={onBackToFlocks}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Flocks
          </button>
        </div>
      </div>

      {/* 5-Step Chevron Progress Header */}
      <div className="grid grid-cols-5 gap-2 text-xs font-semibold">
        {[
          { step: 1, label: 'Basic Information', sub: 'Flock details and setup' },
          { step: 2, label: 'Stock & Breeds', sub: 'Birds, breed and source' },
          { step: 3, label: 'Housing & Location', sub: 'Farm, house and capacity' },
          { step: 4, label: 'Management Plan', sub: 'Feed, health and schedule' },
          { step: 5, label: 'Review & Create', sub: 'Confirm and save' },
        ].map((item) => {
          const isActive = currentStep === item.step;
          const isPassed = currentStep > item.step;

          return (
            <div 
              key={item.step}
              onClick={() => setCurrentStep(item.step)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                isActive 
                  ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500' 
                  : isPassed
                  ? 'bg-emerald-50/60 border-emerald-300 text-[#005A36]'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : isPassed
                  ? 'bg-[#008751] text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {item.step}
              </div>
              <div className="overflow-hidden">
                <span className={`block truncate font-bold text-xs ${isActive ? 'text-blue-900' : isPassed ? 'text-slate-900' : 'text-slate-600'}`}>
                  {item.label}
                </span>
                <span className="block truncate text-[10px] text-slate-400">{item.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Benchmark Dual-Column Layout: Left Form vs. Right Context Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Form Workstation (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs">
          
          <div className="border-l-4 border-[#008751] pl-3 mb-6">
            <h2 className="text-lg font-bold text-slate-900">
              {currentStep === 1 && 'Step 1: Basic Information'}
              {currentStep === 2 && 'Step 2: Stock, Hatchery & Population'}
              {currentStep === 3 && 'Step 3: Housing, Density & Facilities'}
              {currentStep === 4 && 'Step 4: Feeding & Vaccination Protocol'}
              {currentStep === 5 && 'Step 5: Review & Commit to Flock Ledger'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Provide the essential biological parameters for this poultry intake</p>
          </div>

          {currentStep === 1 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Flock Name *</label>
                  <input 
                    type="text" 
                    value={flockName} 
                    onChange={(e) => setFlockName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden" 
                    required 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Flock Type *</label>
                  <select 
                    value={flockType} 
                    onChange={(e) => setFlockType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden"
                  >
                    <option value="Layers (Commercial Egg Production)">Layers (Commercial Egg Production)</option>
                    <option value="Broilers (Meat Production)">Broilers (Meat Production)</option>
                    <option value="Pullet Rearing (Brooder Stage)">Pullet Rearing (Brooder Stage)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Breed *</label>
                  <select 
                    value={breed} 
                    onChange={(e) => setBreed(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden"
                  >
                    <option value="ISA Brown">ISA Brown (Genetic Laying Standard: 94% Peak)</option>
                    <option value="Bovans White">Bovans White</option>
                    <option value="Lohmann Brown">Lohmann Brown</option>
                    <option value="Ross 308">Ross 308 (Broiler)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Commercial Purpose *</label>
                  <input 
                    type="text" 
                    value={purpose} 
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Intake / Start Date *</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden font-mono" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Culled / End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden font-mono" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Facility Location</label>
                  <input 
                    type="text" 
                    value={farmLocation} 
                    readOnly
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 outline-hidden font-medium" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">House / Battery Pen Unit *</label>
                  <select 
                    value={houseUnit} 
                    onChange={(e) => setHouseUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden"
                  >
                    <option value="House 03 (Automated Battery Cage)">House 03 (Automated Battery Cage - 5,200 Capacity)</option>
                    <option value="House 01 (Deep Litter Brooder)">House 01 (Deep Litter Brooder - 6,000 Capacity)</option>
                    <option value="House 02 (Tiered Layer Pen)">House 02 (Tiered Layer Pen - 5,000 Capacity)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Operational Intake Notes</label>
                <textarea 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden"
                  placeholder="Add any veterinary or transport notes..."
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Intake Certified Bird Headcount *</label>
                  <input 
                    type="number" 
                    value={intakeBirds} 
                    onChange={(e) => setIntakeBirds(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers text-base font-bold outline-hidden" 
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Whole birds count verified by gate receiving clerk.</p>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hatchery / Source Supplier *</label>
                  <input 
                    type="text" 
                    value={hatcherySource} 
                    onChange={(e) => setHatcherySource(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-hidden" 
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep >= 3 && (
            <div className="p-8 text-center text-slate-500 text-xs">
              <Sparkles className="w-8 h-8 text-[#008751] mx-auto mb-2 animate-bounce" />
              <p className="font-semibold text-slate-700">Pre-flight checks passed successfully.</p>
              <p className="text-slate-400 mt-1">Stocking density: 12 birds/m² (Within Green Threshold). Click Next to proceed to final review.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={handlePrev}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
            >
              Previous Step
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 rounded-lg bg-[#008751] hover:bg-[#007043] text-white font-semibold text-xs shadow-sm hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {currentStep === 5 ? 'Commit Flock to Ledger' : 'Next Step'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* Right Contextual Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Radial Progress Gauge (e.g. 20% on Step 1) */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Flock Setup Progress</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#008751]"
                    strokeDasharray={`${currentStep * 20}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-bold text-sm text-slate-900 font-mono-numbers">
                  {currentStep * 20}%
                </span>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#008751]" />
                  <span>Basic Information</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block text-center text-[9px] leading-3 font-mono">2</span>
                  <span>Stock & Breeds</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block text-center text-[9px] leading-3 font-mono">3</span>
                  <span>Housing & Location</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Tips Box */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 text-xs text-[#005A36]">
            <div className="flex items-center gap-2 font-bold mb-2">
              <HelpCircle className="w-4 h-4 text-[#008751]" />
              <span>Operational Quick Tips</span>
            </div>
            <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-700">
              <li>Ensure House 03 nipple drinker water pressure is tested at 2.5 bar.</li>
              <li>Verify day-old chick temperature is stabilized between 32°C - 34°C.</li>
              <li>Confirm 25kg bags of Pre-starter mash are staged in Silo 2.</li>
            </ul>
          </div>

          {/* Recent Flocks List */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs text-xs">
            <h4 className="font-bold text-slate-900 mb-3">Active Farm Flocks</h4>
            <div className="space-y-3">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Flock 02 - Isa Brown</span>
                  <span className="text-[10px] text-slate-500 font-mono-numbers">4,912 birds • House 02</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#005A36] font-bold text-[10px]">
                  Peak Laying
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Flock 01 - Bovans</span>
                  <span className="text-[10px] text-slate-500 font-mono-numbers">5,200 birds • House 01</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#005A36] font-bold text-[10px]">
                  91.2% HDEP
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Telemetry Strip: 4 KPI Cards & Sparkline Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Flocks</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono-numbers">12</span>
            <span className="text-[11px] font-semibold text-emerald-600 font-mono-numbers">↑ 20% MoM</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Active Layers</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-blue-600 font-mono-numbers">8 Flocks</span>
            <span className="text-[11px] font-semibold text-emerald-600 font-mono-numbers">↑ 14%</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Certified Birds</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-purple-600 font-mono-numbers">{formatCount(24500)}</span>
            <span className="text-[11px] font-semibold text-emerald-600 font-mono-numbers">↑ 12%</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Monthly Eggs (Crates)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-amber-600 font-mono-numbers">{formatCount(18420)}</span>
            <span className="text-[11px] font-semibold text-emerald-600 font-mono-numbers">↑ 18%</span>
          </div>
        </div>
      </div>

      {/* Actor-Attributed Toast Confirmation */}
      {toastVisible && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#005A36] text-white p-4 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <strong className="block font-bold text-sm">Flock Created & Committed Successfully</strong>
            <span className="text-emerald-200 block">Saved by Glory Mercy • {formatDualTime().watTime}</span>
          </div>
        </div>
      )}

    </div>
  );
};
