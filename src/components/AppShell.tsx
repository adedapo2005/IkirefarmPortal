import React, { useState } from 'react';
import { 
  Building2, LogOut, ChevronDown, ChevronRight, Search, 
  Bell, Clock, Shield, Sparkles, LayoutDashboard, Bird, 
  Egg, Boxes, ShoppingCart, BadgePercent, Landmark, Users, 
  Wallet, HardHat, Truck, TrendingUp, MessageSquare, ShieldCheck,
  CheckCircle2, AlertTriangle, Info, Menu, X, Wheat, Syringe,
  PanelLeftClose, PanelLeft, ArrowUpRight, Plus, PackageCheck,
  Sun, Moon, Globe, Check
} from 'lucide-react';
import { NAV_GROUPS, NavGroup, NavModule, NavLeaf } from '../lib/navigation.ts';
import { formatDualTime } from '../lib/temporal.ts';

interface AppShellProps {
  userRole: string;
  userName: string;
  currentRoute: string;
  onNavigate: (routeId: string) => void;
  onRoleChange?: (newRole: string, newName: string) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  userRole,
  userName,
  currentRoute,
  onNavigate,
  onRoleChange,
  onSignOut,
  children,
}) => {
  const [openGroup, setOpenGroup] = useState<string>('command-center');
  const [compactRailMode, setCompactRailMode] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const now = new Date();
  const dualTime = formatDualTime(now);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard className="w-4 h-4 shrink-0" />;
      case 'Bird': return <Bird className="w-4 h-4 shrink-0" />;
      case 'Egg': return <Egg className="w-4 h-4 shrink-0" />;
      case 'Wheat': return <Wheat className="w-4 h-4 shrink-0" />;
      case 'Syringe': return <Syringe className="w-4 h-4 shrink-0" />;
      case 'Boxes': return <Boxes className="w-4 h-4 shrink-0" />;
      case 'ShoppingCart': return <ShoppingCart className="w-4 h-4 shrink-0" />;
      case 'BadgePercent': return <BadgePercent className="w-4 h-4 shrink-0" />;
      case 'Landmark': return <Landmark className="w-4 h-4 shrink-0" />;
      case 'Users': return <Users className="w-4 h-4 shrink-0" />;
      case 'Wallet': return <Wallet className="w-4 h-4 shrink-0" />;
      case 'HardHat': return <HardHat className="w-4 h-4 shrink-0" />;
      case 'Truck': return <Truck className="w-4 h-4 shrink-0" />;
      case 'TrendingUp': return <TrendingUp className="w-4 h-4 shrink-0" />;
      case 'MessageSquare': return <MessageSquare className="w-4 h-4 shrink-0" />;
      case 'ShieldCheck': return <ShieldCheck className="w-4 h-4 shrink-0" />;
      case 'Shield': return <Shield className="w-4 h-4 shrink-0" />;
      default: return <LayoutDashboard className="w-4 h-4 shrink-0" />;
    }
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroup(openGroup === groupId ? '' : groupId);
  };

  // Find active group & leaf for breadcrumbs
  let activeGroupTitle = 'Command Center';
  let activeLeafTitle = 'Situation Room';
  for (const grp of NAV_GROUPS) {
    for (const mod of grp.modules) {
      for (const leaf of mod.leaves) {
        if (leaf.id === currentRoute) {
          activeGroupTitle = grp.title;
          activeLeafTitle = leaf.title;
          break;
        }
      }
    }
  }

  const roleLabelMap: Record<string, string> = {
    owner: 'Owner (Executive)',
    manager: 'Farm Manager',
    finance: 'Financial Controller',
    veterinary_lead: 'Veterinary Lead',
    operator: 'Pen Attendant',
    provisional: 'Provisional (48h)',
  };

  return (
    <div className={`min-h-screen font-sans ${darkMode ? 'dark night-preview' : ''}`}>
      
      {/* 100% FarmPortal Review Strip */}
      <div className="review-strip" data-review-environment="workspace" aria-label="Review environment status">
        <span className="review-safety-copy flex items-center gap-2">
          <span className="sample-tag font-bold">DAENEM ENTERPRISE</span>
          <span className="hidden sm:inline">Balogun-Ikire Facility Station · Live Zero-Leakage RBAC Enforcement</span>
          <span className="review-persona text-emerald-800 font-semibold">[{roleLabelMap[userRole] || userRole}]</span>
        </span>
        <span className="row flex items-center gap-3">
          <span className="text-[11px] text-slate-600 hidden md:inline font-mono">
            WAT {dualTime.watTime} | EST {dualTime.estTime}
          </span>
          <button 
            type="button" 
            onClick={() => setDarkMode(!darkMode)}
            className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 cursor-pointer flex items-center gap-1"
          >
            {darkMode ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            <span>{darkMode ? "Daylight" : "Dark"}</span>
          </button>
        </span>
      </div>

      {/* Main Shell: FarmPortal Authentic Premium Chrome */}
      <div className="shell flex min-h-[calc(100vh-34px)] w-full">
        
        {/* 100% FarmPortal Authenticated Sidebar */}
        <aside 
          className={`
            portal-sidebar flex flex-col shrink-0 text-white z-40 transition-all duration-200
            fixed lg:sticky top-0 lg:top-[34px] h-screen lg:h-[calc(100vh-34px)]
            ${compactRailMode ? 'w-20' : 'w-72'}
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
          style={{
            background: 'radial-gradient(circle at 12% 0%, rgba(190,218,176,.12), transparent 18rem), linear-gradient(180deg, #10372e 0%, #0d3028 48%, #0a2922 100%)',
            borderRight: '1px solid rgba(230,242,234,.09)',
            boxShadow: '12px 0 34px rgba(6,31,24,.08)'
          }}
        >
          {/* Sidebar Header: Official Brand Emblem */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img 
                src="/assets/daenem-farms-official-logo.png" 
                alt="DAENEM Farms" 
                className="h-9 w-auto object-contain shrink-0 drop-shadow-md"
              />
              {!compactRailMode && (
                <div className="truncate">
                  <span className="text-xs font-bold text-white tracking-wider uppercase block">DAENEM FARMS</span>
                  <span className="text-[10px] text-emerald-300 font-medium block">Balogun-Ikire</span>
                </div>
              )}
            </div>

            {/* Collapse toggle (desktop only) */}
            <button
              type="button"
              onClick={() => setCompactRailMode(!compactRailMode)}
              className="hidden lg:flex p-1 rounded-md text-emerald-300 hover:text-white hover:bg-white/10 cursor-pointer"
              title={compactRailMode ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {compactRailMode ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Sidebar Nav: Directorate Hierarchies with Active Gold Accents */}
          <nav className="flex-1 overflow-y-auto p-2.5 space-y-1.5 text-xs custom-scrollbar">
            {NAV_GROUPS.map((group) => {
              const isGroupOpen = openGroup === group.id;

              if (compactRailMode) {
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setCompactRailMode(false);
                      setOpenGroup(group.id);
                    }}
                    title={`${group.title} (${group.shortCode})`}
                    className={`w-full py-3 px-1 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                      isGroupOpen 
                        ? 'bg-white/10 text-[#fff2bb] ring-1 ring-[#d9bd67]' 
                        : 'text-emerald-100 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="mb-1 text-emerald-300">
                      {getIcon(group.iconName)}
                    </div>
                    <span className="text-[9px] font-bold tracking-wider uppercase">{group.shortCode}</span>
                  </button>
                );
              }

              return (
                <div key={group.id} className="rounded-xl overflow-hidden mb-1">
                  
                  {/* Directorate Header Trigger */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`nav-group-trigger w-full px-3 py-2 flex items-center justify-between text-left transition cursor-pointer ${
                      isGroupOpen ? 'text-white bg-white/5' : 'text-emerald-200/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-emerald-300">{getIcon(group.iconName)}</span>
                      <span className="font-bold text-[11px] uppercase tracking-wider truncate">{group.title}</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-emerald-400 ${isGroupOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Modules & Leaves inside Directorate */}
                  {isGroupOpen && (
                    <div className="pl-2 pr-1 py-1 space-y-1">
                      {group.modules.map((module) => (
                        <div key={module.id} className="space-y-0.5">
                          {module.leaves.map((leaf) => {
                            const isActive = currentRoute === leaf.id;

                            return (
                              <button
                                key={leaf.id}
                                type="button"
                                onClick={() => {
                                  onNavigate(leaf.id);
                                  setMobileMenuOpen(false);
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition cursor-pointer text-xs ${
                                  isActive
                                    ? 'bg-gradient-to-r from-[#d3bc65]/20 to-white/10 text-[#fff2bb] font-bold shadow-md border-l-3 border-[#d9bd67]'
                                    : 'text-emerald-100/90 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                <div className="truncate pr-1">
                                  <span className="block leading-tight font-medium">{leaf.title}</span>
                                  <span className="block text-[10px] text-emerald-200/60 truncate leading-tight mt-0.5">
                                    {leaf.description}
                                  </span>
                                </div>

                                {leaf.badgeCount !== undefined && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                                    leaf.badgeVariant === 'urgent'
                                      ? 'bg-rose-500 text-white'
                                      : leaf.badgeVariant === 'warning'
                                      ? 'bg-amber-400 text-slate-900'
                                      : 'bg-emerald-400 text-slate-900'
                                  }`}>
                                    {leaf.badgeCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer: Profile with Persona Switcher */}
          <div className="p-3 border-t border-white/10 bg-black/15">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-[#125945] border border-emerald-400 text-[#fff2bb] flex items-center justify-center text-xs font-bold shrink-0">
                  {userName.charAt(0)}
                </div>
                {!compactRailMode && (
                  <div className="truncate text-left">
                    <span className="text-xs font-bold text-white block leading-tight truncate">{userName}</span>
                    <span className="text-[10px] text-emerald-300 block">{roleLabelMap[userRole] || userRole}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 rounded-lg text-emerald-300 hover:text-rose-400 hover:bg-white/10 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Workspace Shell: Authentic Topbar + Main Viewport */}
        <div className="workspace flex-1 flex flex-col min-w-0 bg-[#F2F6F3]">
          
          {/* 100% FarmPortal Sticky Topbar */}
          <header 
            className="topbar sticky top-[34px] z-30 flex items-center justify-between gap-4 px-4 sm:px-8 border-b border-[#125945]/15 shadow-2xs backdrop-blur-md"
            style={{
              minHeight: '72px',
              background: 'rgba(255, 255, 255, 0.94)'
            }}
          >
            {/* Left: Mobile trigger + Context Title */}
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="topbar-context">
                <span className="text-xs text-slate-500 font-bold tracking-wide uppercase block">
                  DAENEM FARMS · Balogun-Ikire
                </span>
                <strong className="text-base text-slate-900 font-bold block leading-tight">
                  {activeLeafTitle}
                </strong>
              </div>
            </div>

            {/* Middle: Universal Search Launcher with Orb */}
            <div className="flex-1 max-w-md hidden md:block">
              <button
                type="button"
                onClick={() => onNavigate('search')}
                className="search-launch w-full flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white border border-[#125945]/15 hover:border-[#125945]/40 text-xs text-slate-500 transition shadow-2xs cursor-pointer"
              >
                <span className="search-orb shrink-0"></span>
                <span className="flex-1 text-left truncate">Search orders, flocks, grain silos, bank feeds...</span>
                <kbd className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-600">⌘ K</kbd>
              </button>
            </div>

            {/* Right: Operational Status + Customer Orders Shortcut + Role Selector */}
            <div className="flex items-center gap-3">
              
              {/* Customer Orders High-Intent Quick Access */}
              <button
                type="button"
                onClick={() => {
                  onNavigate('orders');
                  setOpenGroup('sales-orders');
                }}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#005A36] text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <BadgePercent className="w-4 h-4 text-[#008751]" />
                <span>Customer Orders</span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">14</span>
              </button>

              {/* Status Trigger Beacon */}
              <div className="statusTrigger hidden xl:inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Connected</span>
              </div>

              {/* Notification Bell */}
              <button 
                type="button" 
                onClick={() => onNavigate('bulletins')}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
              </button>

              {/* Role Switcher Dropdown */}
              {onRoleChange && (
                <div className="pl-2 border-l border-slate-200">
                  <select
                    value={userRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'owner') onRoleChange('owner', 'Adedapo Daenem (Owner)');
                      else if (val === 'manager') onRoleChange('manager', 'Glory Mercy (Farm Manager)');
                      else if (val === 'finance') onRoleChange('finance', 'Folake Adeleke (Financial Controller)');
                      else if (val === 'veterinary_lead') onRoleChange('veterinary_lead', 'Dr. Segun Adewale (Lead Vet)');
                      else if (val === 'operator') onRoleChange('operator', 'Sunday Okafor (Pen Attendant)');
                      else if (val === 'provisional') onRoleChange('provisional', 'Ibrahim Musa (Pending 48h)');
                    }}
                    className="text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold outline-hidden cursor-pointer hover:border-[#008751] shadow-2xs"
                  >
                    <option value="owner">Role: Owner (Executive)</option>
                    <option value="manager">Role: Farm Manager</option>
                    <option value="finance">Role: Financial Controller</option>
                    <option value="veterinary_lead">Role: Veterinary Lead</option>
                    <option value="operator">Role: Pen Attendant</option>
                    <option value="provisional">Role: Provisional (48h)</option>
                  </select>
                </div>
              )}

            </div>
          </header>

          {/* Breadcrumb Trail */}
          <div className="px-4 sm:px-8 pt-4 pb-1">
            <div className="breadcrumb flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span 
                onClick={() => onNavigate('dashboard')} 
                className="hover:text-slate-900 cursor-pointer flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5 text-[#008751]" />
                Balogun-Ikire
              </span>
              <span>/</span>
              <span>{activeGroupTitle}</span>
              <span>/</span>
              <span className="text-slate-900 font-bold">{activeLeafTitle}</span>
            </div>
          </div>

          {/* Main Viewport Content Area */}
          <main id="main-content" className="workspace-content flex-1 p-4 sm:p-8">
            {children}
          </main>

        </div>

      </div>

    </div>
  );
};

export default AppShell;
