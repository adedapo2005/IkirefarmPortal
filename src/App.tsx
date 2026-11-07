import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SignInGateway } from './components/SignInGateway.tsx';
import PortalExperience from './components/portal/PortalExperience';
import { permissionCatalog } from './lib/portal-model';
import { PORTAL_ME_CONTRACT_VERSION, type AuthenticatedPrincipal } from './lib/authenticated-principal';

interface ServerUser {
  id: string;
  email: string;
  displayName: string;
  employeeNo: string;
  role: string;
  isOwner: boolean;
  department: string;
  jobTitle: string;
  issuedAt?: string;
}

export function App() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [serverUser, setServerUser] = useState<ServerUser | null>(null);
  const [isDemoPersona, setIsDemoPersona] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('owner');
  const [userName, setUserName] = useState<string>('Adedapo Daenem');
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get('route');
    if (routeParam) return routeParam;
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash || 'dashboard';
  });

  // Verify server session on mount (Authoritative Server Session Check)
  const verifyServerSession = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json() as { authenticated: boolean; user?: ServerUser };
        if (data.authenticated && data.user) {
          setServerUser(data.user);
          setUserRole(data.user.role || 'owner');
          setUserName(data.user.displayName || 'Adedapo Daenem');
          setIsDemoPersona(false);
          setAuthStatus('authenticated');
          return;
        }
      }
    } catch {
      // Server unreachable or unauthenticated - fail closed to SignInGateway
    }
    setAuthStatus('unauthenticated');
  }, []);

  useEffect(() => {
    void verifyServerSession();

    const syncRouteFromHash = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      if (rawHash) {
        setCurrentRoute(rawHash);
      }
    };

    window.addEventListener('hashchange', syncRouteFromHash);
    return () => window.removeEventListener('hashchange', syncRouteFromHash);
  }, [verifyServerSession]);

  // Demo Persona Preview handler (strictly isolated and flagged)
  const handleSelectDemoPersona = (role: string, name: string) => {
    setIsDemoPersona(true);
    setUserRole(role || 'owner');
    setUserName(name || 'Adedapo Daenem');
    setAuthStatus('authenticated');
    setCurrentRoute('dashboard');
    window.location.hash = '#/dashboard';
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore network errors on signout
    }
    setServerUser(null);
    setIsDemoPersona(false);
    setAuthStatus('unauthenticated');
    setUserRole('owner');
    setCurrentRoute('dashboard');
    window.location.hash = '';
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const principal: AuthenticatedPrincipal = useMemo(() => {
    const isOwner = userRole === 'owner';
    const isManager = userRole === 'manager';
    const isFinance = userRole === 'finance';
    const isVet = userRole === 'vet';
    const isProvisional = userRole === 'provisional';

    // Scoped permissions per role - fails closed rather than granting universal 'all' authority
    const rolePermissions = isOwner
      ? permissionCatalog
      : isManager
      ? permissionCatalog.filter((p) => p.startsWith('farm.') || p.startsWith('flocks.') || p.startsWith('inventory.') || p.startsWith('daily_register.') || p.startsWith('eggs.') || p.startsWith('feed.') || p.startsWith('dashboard.'))
      : isFinance
      ? permissionCatalog.filter((p) => p.startsWith('finance.') || p.startsWith('commercial.') || p.startsWith('payroll.') || p.startsWith('banking.') || p.startsWith('dashboard.'))
      : isVet
      ? permissionCatalog.filter((p) => p.startsWith('farm.health.') || p.startsWith('vaccination.') || p.startsWith('flocks.view') || p.startsWith('dashboard.'))
      : ['dashboard.view'];

    const roleScope = isOwner ? 'all' : isManager || isFinance ? 'department' : 'assigned';

    return {
      id: serverUser?.id || `daenem-${userRole}-001`,
      email: serverUser?.email || (isOwner ? 'adedapo@daenemfarms.com' : `${userRole}@daenemfarms.com`),
      displayName: serverUser?.displayName || userName || (isOwner ? 'Adedapo Daenem' : `Daenem ${userRole.toUpperCase()}`),
      employeeNo: serverUser?.employeeNo || (isOwner ? 'DF-EXEC-001' : `DF-${userRole.toUpperCase()}-002`),
      phone: '+234 803 000 0000',
      department: serverUser?.department || (isOwner ? 'Executive Command' : isManager ? 'Farm Operations' : isFinance ? 'Finance & Treasury' : isVet ? 'Flock Health' : 'General Operations'),
      jobTitle: serverUser?.jobTitle || (isOwner ? 'Owner & Chief Executive' : isManager ? 'Farm Operations Manager' : isFinance ? 'Financial Controller' : isVet ? 'Head Veterinarian' : 'Staff Member'),
      status: 'active',
      isOwner,
      accessState: isProvisional ? 'provisional' : isOwner ? 'owner' : 'assigned',
      restriction: isProvisional ? 'provisional' : 'none',
      farmAuthorized: !isProvisional,
      roles: [
        {
          id: userRole,
          name: isOwner ? 'Owner (Executive)' : isManager ? 'Farm Manager' : isFinance ? 'Finance Lead' : isVet ? 'Head Vet' : 'Operations',
          status: 'active',
          isSystemOwner: isOwner,
          isWorkflowRole: true,
        },
      ],
      permissions: rolePermissions,
      deniedPermissions: [],
      permissionScopes: Object.fromEntries(rolePermissions.map((p) => [p, roleScope as any])),
      permissionScopeSets: {},
      organizationScope: {
        companyKey: 'daenem-farms',
        companyLabel: 'DAENEM Farms Limited',
        departmentKey: isOwner ? 'executive' : userRole,
        departmentLabel: isOwner ? 'Executive Office' : 'Operations',
        locationKey: 'ikire',
        timezone: 'Africa/Lagos',
      },
      lifecycleStatus: 'active',
      assignedTimezone: 'Africa/Lagos',
      assignedLocation: 'Balogun-Ikire',
      contractVersion: PORTAL_ME_CONTRACT_VERSION,
      securityStamp: 'SEC-STAMP-DAENEM-VERIFIED',
    };
  }, [userRole, userName, serverUser, isDemoPersona]);

  if (authStatus === 'checking') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px'
      }}>
        <span>Verifying secure server session...</span>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <SignInGateway onSignInSuccess={handleSelectDemoPersona} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Explicit warning banner if operating in unverified preview mode */}
      {isDemoPersona && (
        <aside
          role="status"
          aria-label="Demo Persona Warning"
          style={{
            backgroundColor: '#1e293b',
            color: '#fef08a',
            borderBottom: '1px solid #ca8a04',
            padding: '8px 20px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              backgroundColor: '#ca8a04',
              color: '#0f172a',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '0.04em'
            }}>
              LOCAL PREVIEW MODE
            </span>
            <span>
              Operating as <strong>{principal.displayName}</strong> ({principal.jobTitle}). Development preview credentials — session is unverified on server.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '4px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Exit to Sign In
          </button>
        </aside>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PortalExperience
          initialRoute={currentRoute || 'dashboard'}
          principal={principal}
          reviewMode={false}
          onLogout={handleSignOut}
        />
      </div>
    </div>
  );
}

export default App;
