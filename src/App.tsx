import React, { useState } from 'react';
import { SignInGateway } from './components/SignInGateway.tsx';
import { AppShell } from './components/AppShell.tsx';
import { SituationRoom } from './components/SituationRoom.tsx';
import { AddFlockWorkspace } from './components/AddFlockWorkspace.tsx';
import { RoleManagementWorkspace } from './components/RoleManagementWorkspace.tsx';
import { CustomerOrdersWorkspace } from './components/CustomerOrdersWorkspace.tsx';
import { DailyPenRegisterWorkspace } from './components/DailyPenRegisterWorkspace.tsx';
import { EggRoomWorkspace } from './components/EggRoomWorkspace.tsx';
import { FeedMillWorkspace } from './components/FeedMillWorkspace.tsx';
import { BankingTreasuryWorkspace } from './components/BankingTreasuryWorkspace.tsx';
import { PayrollWorkspace } from './components/PayrollWorkspace.tsx';
import { ConstructionWorkspace } from './components/ConstructionWorkspace.tsx';
import { CompletionCenterWorkspace } from './components/CompletionCenterWorkspace.tsx';
import { Shield, Clock, AlertTriangle, ArrowRight, UserCheck } from 'lucide-react';
import { formatDualTime } from './lib/temporal.ts';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('owner');
  const [userName, setUserName] = useState<string>('Adedapo Daenem');
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');

  const handleSignInSuccess = (role: string, name: string) => {
    setUserRole(role);
    setUserName(name);
    setIsAuthenticated(true);
    setCurrentRoute('dashboard');
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setUserRole('owner');
    setCurrentRoute('dashboard');
  };

  if (!isAuthenticated) {
    return <SignInGateway onSignInSuccess={handleSignInSuccess} />;
  }

  // Provisional 48-Hour Holding Room Workspace
  if (userRole === 'provisional') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/assets/daenem-farms-official-logo.png" alt="DAENEM Logo" className="h-8 w-auto object-contain daenem-logo-glow" />
            <span className="font-bold text-slate-900 text-sm">DAENEM Farms Balogun-Ikire</span>
          </div>
          <button 
            onClick={handleSignOut}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
          >
            Sign Out
          </button>
        </header>

        <main className="max-w-xl mx-auto p-6 text-center">
          <div className="bg-white border border-amber-200 rounded-2xl p-8 shadow-md">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Provisional Account Under Review</h1>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Your provisional account has been registered with DAENEM Farms. Access to operational ERP modules is currently locked pending administrator verification and role assignment.
            </p>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-left space-y-2 mb-6 text-amber-900">
              <div className="flex justify-between font-semibold">
                <span>Account Status:</span>
                <span className="text-amber-700">Pending Review</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Remaining Review Window:</span>
                <span className="text-amber-700 font-mono-numbers">47 Hours : 42 Mins</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Submitted Name:</span>
                <span>{userName}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Need immediate clearance? Contact Farm HR at <strong>hr@farms.daenem.com</strong> or your shift supervisor.
            </p>
          </div>
        </main>

        <footer className="text-center text-xs text-slate-400 py-4">
          © 2026 DAENEM Farms. Fail-Closed Zero-Leakage RBAC Enforcement.
        </footer>
      </div>
    );
  }

  // Routing Helper
  const isCommandRoute = ['dashboard', 'owner-decisions', 'daily-brief', 'myday', 'bulletins'].includes(currentRoute);
  const isSalesRoute = ['orders', 'order-create', 'dispatch', 'customers', 'pricing-catalog', 'point-of-sale'].includes(currentRoute);
  const isFlockRoute = ['daily-register', 'flocks', 'houses', 'weight-sampling', 'lighting-program', 'breed-benchmarks'].includes(currentRoute);
  const isEggRoute = ['eggs', 'egg-collections', 'egg-grading', 'egg-reconciliation'].includes(currentRoute);
  const isFeedRoute = ['feed', 'feed-formulas', 'feed-silos', 'feed-quality', 'feed-consumption'].includes(currentRoute);
  const isTreasuryRoute = ['treasury', 'banking', 'collections', 'reconciliation', 'expenses', 'general-ledger'].includes(currentRoute);
  const isPayrollRoute = ['payroll', 'employees', 'attendance', 'leave', 'statutory', 'payslips'].includes(currentRoute);
  const isConstructionRoute = ['construction', 'boq', 'materials', 'equipment', 'fleet'].includes(currentRoute);
  const isGovernanceRoute = ['completion-center', 'audit', 'master-data', 'security', 'diagnostics', 'studio'].includes(currentRoute);

  return (
    <AppShell
      userRole={userRole}
      userName={userName}
      currentRoute={currentRoute}
      onNavigate={(routeId) => setCurrentRoute(routeId)}
      onSignOut={handleSignOut}
    >
      {/* Dynamic Route Switching */}
      {isCommandRoute && <SituationRoom onNavigate={(routeId) => setCurrentRoute(routeId)} />}
      
      {/* Customer Orders & Wholesale Commerce */}
      {isSalesRoute && <CustomerOrdersWorkspace />}

      {/* 7-Column Daily Pen Register & Flock Cohorts */}
      {isFlockRoute && <DailyPenRegisterWorkspace onBackToDashboard={() => setCurrentRoute('dashboard')} />}

      {/* 5-Step Guided Chick Placement Wizard */}
      {currentRoute === 'flock-add' && (
        <AddFlockWorkspace 
          onBackToFlocks={() => setCurrentRoute('flocks')}
          onFlockCreated={() => setCurrentRoute('flocks')}
        />
      )}

      {/* Egg Room & Cold Storage Inventory */}
      {isEggRoute && (
        <EggRoomWorkspace onNavigateToOrders={() => setCurrentRoute('orders')} />
      )}

      {/* Feed Mill, Grain Silos, and Formulations */}
      {isFeedRoute && <FeedMillWorkspace />}

      {/* Finance, Corporate Treasury & Multi-Bank Feeds */}
      {isTreasuryRoute && <BankingTreasuryWorkspace />}

      {/* Human Resources, Biometric Attendance & Payroll Platform */}
      {isPayrollRoute && <PayrollWorkspace />}

      {/* Balogun-Ikire Capital Construction ERP & BOQ */}
      {isConstructionRoute && <ConstructionWorkspace />}

      {/* Full Admin Dynamic Role & Permission Creation Studio */}
      {currentRoute === 'rbac' && <RoleManagementWorkspace />}

      {/* Implementation Completion Center & Governance */}
      {isGovernanceRoute && <CompletionCenterWorkspace />}

      {/* Fallback Scoped Module Workspace for unrouted leaves */}
      {!isCommandRoute && 
       !isSalesRoute && 
       !isFlockRoute && 
       !isEggRoute && 
       !isFeedRoute && 
       !isTreasuryRoute && 
       !isPayrollRoute && 
       !isConstructionRoute &&
       !isGovernanceRoute &&
       currentRoute !== 'flock-add' && 
       currentRoute !== 'rbac' && (
        <div className="premium-card rounded-2xl p-8 max-w-4xl">
          <div className="flex items-center gap-3 text-slate-900 font-bold text-lg mb-2">
            <Shield className="w-5 h-5 text-[#008751]" />
            <span>Workspace Directorate: {currentRoute.replace('-', ' ').toUpperCase()}</span>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Operational workspace scoped for Balogun-Ikire Facility Unit. Enforcing strict conservation invariants, maker-checker authorization, and dual Lagos WAT/New York EST reporting.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCurrentRoute('orders')}
              className="btn-primary-glow px-4 py-2 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              <span>Open Customer Orders</span>
              <span className="px-1.5 py-0.2 bg-rose-500 rounded-full text-[10px] font-bold">14</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentRoute('daily-register')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
            >
              Open Daily Pen Register
            </button>
            <button
              type="button"
              onClick={() => setCurrentRoute('construction')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
            >
              Open Construction ERP
            </button>
            <button
              type="button"
              onClick={() => setCurrentRoute('completion-center')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
            >
              Open Completion Center
            </button>
            <button
              type="button"
              onClick={() => setCurrentRoute('dashboard')}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Return to Situation Room
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default App;
