import React, { useEffect, useMemo, useState } from 'react';
import { Shield, ChevronDown, CheckCircle2 } from 'lucide-react';

const CANONICAL_PATH = "/approved-signin/";

interface SignInGatewayProps {
  onSignInSuccess: (role: string, name: string) => void;
}

export const SignInGateway: React.FC<SignInGatewayProps> = ({ onSignInSuccess }) => {
  const [search, setSearch] = useState("");
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  useEffect(() => {
    const source = new URLSearchParams(window.location.search);
    const allowed = new URLSearchParams();
    for (const key of ["auth", "invite", "token", "guarantor", "mode", "motion", "background", "presentation", "theme"]) {
      const value = source.get(key);
      if (value) allowed.set(key, value);
    }
    setSearch(allowed.toString());

    // Listen to iframe postMessage events if emitted
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DAENEM_SIGNIN_SUCCESS' || event.data === 'signed_in') {
        const role = event.data?.role || 'owner';
        const name = event.data?.name || 'Adedapo Daenem';
        onSignInSuccess(role, name);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSignInSuccess]);

  const source = useMemo(
    () => `${CANONICAL_PATH}${search ? `?${search}` : ""}`,
    [search],
  );

  return (
    <main id="main-content" className="canonical-signin-frame-shell relative w-full h-screen overflow-hidden bg-[#0e1613]">
      {/* Exact FarmPortal Approved Production Sign-In Gateway */}
      <iframe
        className="canonical-signin-frame w-full h-full border-0 block"
        src={source}
        title="DAENEM Farms Employee Portal Sign In"
        allow="clipboard-write; accelerometer; gyroscope"
      />

      {/* Discreet floating quick-switch dock for instant executive evaluation of role homepages */}
      <aside 
        aria-label="Direct Persona Switcher" 
        className="fixed top-3 right-3 z-50 flex items-center gap-1.5"
      >
        <div className="relative">
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium border border-slate-700 shadow-lg cursor-pointer transition-all hover:scale-105"
            title="Instant Cockpit Preview"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Portal Cockpit Preview</span>
            <span className="sm:hidden">Roles</span>
            <ChevronDown className={`w-3 h-3 text-white/70 transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`} />
          </button>

          {showPersonaMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700 p-2 shadow-2xl text-xs z-50 text-white">
              <div className="px-2 py-1.5 border-b border-white/10 mb-1 text-[11px] text-white/60 font-medium">
                Jump to Role-Specific Cockpit
              </div>
              <button
                onClick={() => {
                  setShowPersonaMenu(false);
                  onSignInSuccess('owner', 'Adedapo Daenem (Owner)');
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-emerald-600/30 flex items-center justify-between text-white group cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-emerald-300">Executive Owner Cockpit</div>
                  <div className="text-[10px] text-white/60">Full Capital, P&L, Strategy & Directorates</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100" />
              </button>

              <button
                onClick={() => {
                  setShowPersonaMenu(false);
                  onSignInSuccess('manager', 'Glory Mercy (Farm Manager)');
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-blue-600/30 flex items-center justify-between text-white group cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-blue-300">Farm Manager Operations</div>
                  <div className="text-[10px] text-white/60">Flock Batch Health, Feed Stocks & Silos</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100" />
              </button>

              <button
                onClick={() => {
                  setShowPersonaMenu(false);
                  onSignInSuccess('finance', 'Folake Adeleke (Financial Controller)');
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-amber-600/30 flex items-center justify-between text-white group cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-amber-300">Finance & Treasury</div>
                  <div className="text-[10px] text-white/60">Liquidity, Bank Accounts & Daily Collections</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100" />
              </button>

              <button
                onClick={() => {
                  setShowPersonaMenu(false);
                  onSignInSuccess('veterinary_lead', 'Dr. Segun Adewale (Lead Vet)');
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-600/30 flex items-center justify-between text-white group cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-purple-300">Lead Veterinarian</div>
                  <div className="text-[10px] text-white/60">Biosecurity, Mortalities & Clinical Alerts</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100" />
              </button>

              <button
                onClick={() => {
                  setShowPersonaMenu(false);
                  onSignInSuccess('operator', 'Sunday Okafor (Pen Attendant)');
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-teal-600/30 flex items-center justify-between text-white group cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-teal-300">Pen Attendant (My Day)</div>
                  <div className="text-[10px] text-white/60">Egg Collection, Water Meters & Feed Logs</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-teal-400 opacity-0 group-hover:opacity-100" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </main>
  );
};
