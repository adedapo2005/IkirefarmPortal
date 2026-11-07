import React, { useState, useEffect, useMemo } from 'react';
import { SignInGateway } from './components/SignInGateway.tsx';
import PortalExperience from './components/portal/PortalExperience';
import { permissionCatalog } from './lib/portal-model';
import type { AuthenticatedPrincipal } from './lib/authenticated-principal';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('session') === 'active' || params.get('auth') === 'true' || localStorage.getItem('daenem_auth') === 'true';
  });
  const [userRole, setUserRole] = useState<string>(() => {
    if (typeof window === 'undefined') return 'owner';
    const params = new URLSearchParams(window.location.search);
    return params.get('role') || 'owner';
  });
  const [userName, setUserName] = useState<string>('Adedapo Daenem');
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get('route');
    if (routeParam) return routeParam;
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash || 'dashboard';
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session') === 'active' || params.get('auth') === 'true' || localStorage.getItem('daenem_auth') === 'true') {
      setIsAuthenticated(true);
      const roleParam = params.get('role');
      if (roleParam) {
        setUserRole(roleParam);
      }
      const routeParam = params.get('route');
      if (routeParam) {
        setCurrentRoute(routeParam);
      }
    }

    const syncRouteFromHash = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      if (rawHash) {
        setCurrentRoute(rawHash);
      } else if (params.get('session') === 'active' || localStorage.getItem('daenem_auth') === 'true') {
        window.location.hash = '#/dashboard';
        setCurrentRoute('dashboard');
      }
    };

    if (window.location.hash) {
      syncRouteFromHash();
    } else if (params.get('session') === 'active' || localStorage.getItem('daenem_auth') === 'true') {
      window.location.hash = '#/dashboard';
      setCurrentRoute('dashboard');
    }
    window.addEventListener('hashchange', syncRouteFromHash);
    return () => window.removeEventListener('hashchange', syncRouteFromHash);
  }, []);

  const handleSignInSuccess = (role: string, name: string) => {
    localStorage.setItem('daenem_auth', 'true');
    setUserRole(role || 'owner');
    setUserName(name || 'Adedapo Daenem');
    setIsAuthenticated(true);
    setCurrentRoute('dashboard');
    window.location.hash = '#/dashboard';
  };

  const handleSignOut = () => {
    localStorage.removeItem('daenem_auth');
    setIsAuthenticated(false);
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
      id: `daenem-${userRole}-001`,
      email: isOwner ? 'adedapo@daenemfarms.com' : `${userRole}@daenemfarms.com`,
      displayName: userName || (isOwner ? 'Adedapo Daenem' : `Daenem ${userRole.toUpperCase()}`),
      employeeNo: isOwner ? 'DF-EXEC-001' : `DF-${userRole.toUpperCase()}-002`,
      phone: '+234 803 000 0000',
      department: isOwner ? 'Executive Command' : isManager ? 'Farm Operations' : isFinance ? 'Finance & Treasury' : isVet ? 'Flock Health' : 'General Operations',
      jobTitle: isOwner ? 'Owner & Chief Executive' : isManager ? 'Farm Operations Manager' : isFinance ? 'Financial Controller' : isVet ? 'Head Veterinarian' : 'Staff Member',
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
      lifecycle: { status: 'active' },
      activeSession: true,
      issuedAt: new Date().toISOString(),
    };
  }, [userRole, userName]);

  if (!isAuthenticated) {
    return <SignInGateway onSignInSuccess={handleSignInSuccess} />;
  }

  return (
    <PortalExperience
      initialRoute={currentRoute || 'dashboard'}
      principal={principal}
      reviewMode={false}
      onLogout={handleSignOut}
    />
  );
}

export default App;
