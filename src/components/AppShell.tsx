import React, { useState } from 'react';
import { 
  Building2, LogOut, ChevronDown, ChevronRight, Search, 
  Bell, Clock, Shield, Sparkles, LayoutDashboard, Bird, 
  Egg, Boxes, ShoppingCart, BadgePercent, Landmark, Users, 
  Wallet, HardHat, Truck, TrendingUp, MessageSquare, ShieldCheck,
  CheckCircle2, AlertTriangle, Info, Menu, X, Wheat, Syringe,
  PanelLeftClose, PanelLeft, ArrowUpRight, Plus, PackageCheck
} from 'lucide-react';
import { NAV_GROUPS, NavGroup, NavModule, NavLeaf } from '../lib/navigation.ts';
import { formatDualTime } from '../lib/temporal.ts';

interface AppShellProps {
  userRole: string;
  userName: string;
  currentRoute: string;
  onNavigate: (routeId: string) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  userRole,
  userName,
  currentRoute,
  onNavigate,
  onSignOut,
  children,
}) => {
  // Navigation State: Smart Accordion (one open group by default)
  const [openGroup, setOpenGroup] = useState<string>('command-center');
  const [compactRailMode, setCompactRailMode] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans pb-16 lg:pb-0">
      
      {/* Top Header Rail: Dual-Time Operations & System Status */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Left: Mobile Menu Trigger + Rail Collapse Toggle + Active Location */}
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Desktop Rail Mode Toggle */}
            <button
              type="button"
              onClick={() => setCompactRailMode(!compactRailMode)}
              title={compactRailMode ? "Expand Full Navigation" : "Collapse to Compact Rail"}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              {compactRailMode ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2.5">
              <img 
                src="/assets/daenem-farms-official-logo.png" 
                alt="DAENEM Logo" 
                className="h-8 w-auto object-contain daenem-logo-glow"
              />
              <div className="hidden sm:block">
                <span className="text-xs font-bold tracking-tight text-slate-900 block leading-tight">DAENEM FARMS</span>
                <span className="text-[10px] text-[#008751] font-bold uppercase tracking-wider block">Balogun-Ikire</span>
              </div>
            </div>

            {/* Prominent High-Priority Customer Orders Access Button */}
            <button
              type="button"
              onClick={() => {
                onNavigate('orders');
                setOpenGroup('sales-orders');
              }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#005A36] text-xs font-bold transition shadow-2xs cursor-pointer ml-2"
            >
              <BadgePercent className="w-4 h-4 text-[#008751]" />
              <span>Customer Orders</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                14
              </span>
            </button>

            {/* Contextual Breadcrumb Path */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 pl-4 border-l border-slate-200">
              <span className="truncate max-w-[140px] text-slate-500">{activeGroupTitle}</span>
              <span>&gt;</span>
              <span className="text-slate-900 font-semibold truncate max-w-[200px]">{activeLeafTitle}</span>
            </div>
          </div>

          {/* Middle: Universal Search Bar (Cmd+K) */}
          <div className="flex-1 max-w-md mx-2 hidden lg:block">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search orders, flocks, batches, POs, bank feeds (Cmd+K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-12 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden transition"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right: Dual WAT/EST Clock + Alerts + User Profile */}
          <div className="flex items-center gap-3">
            {/* Dual Time Display */}
            <div className="hidden xl:flex items-center gap-3 text-xs border-r border-slate-200 pr-3 font-mono-numbers">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Clock className="w-3.5 h-3.5 text-[#008751]" />
                <strong className="text-slate-900">Lagos:</strong> {dualTime.watTime}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-medium">
                <strong className="text-slate-700">New York:</strong> {dualTime.estTime}
              </span>
            </div>

            {/* Notification Bell */}
            <button 
              type="button" 
              onClick={() => onNavigate('notifications')}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
            </button>

            {/* Active User Badge & Sign Out */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-[#008751] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {userName.charAt(0)}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[130px]">{userName}</span>
                <span className="text-[10px] text-slate-500 capitalize block">{userRole}</span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Workspace Frame: Sidebar + Dynamic Route Content */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto overflow-hidden">
        
        {/* Approved Continuous Signature Green Sidebar (`#008751`) with Dual Compact/Expanded Mode */}
        <aside className={`
          bg-[#008751] text-white flex flex-col shrink-0 border-r border-[#007043] 
          fixed lg:static inset-y-14 lg:inset-y-0 left-0 z-20 transition-all duration-200 ease-in-out
          ${compactRailMode ? 'w-20' : 'w-76'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          
          {/* Sidebar Top: Operational Division Indicator */}
          {!compactRailMode ? (
            <div className="p-3.5 border-b border-[#007043] bg-[#005A36] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 block">Facility Station</span>
                <span className="text-xs font-bold text-white">Balogun-Ikire Complex</span>
              </div>
              <span className="text-[10px] bg-[#00A86B] text-white px-2 py-0.5 rounded-full font-bold">
                Online
              </span>
            </div>
          ) : (
            <div className="p-2 border-b border-[#007043] bg-[#005A36] text-center">
              <span className="text-[9px] uppercase font-bold text-emerald-300 block">IKIRE</span>
            </div>
          )}

          {/* Smart Accordion: Concise Executive ERP Directorates */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
            {NAV_GROUPS.map((group) => {
              const isGroupOpen = openGroup === group.id;
              
              if (compactRailMode) {
                // Compact Mode: Icon + Shortcode + Hover Flyout Context
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setCompactRailMode(false);
                      setOpenGroup(group.id);
                    }}
                    title={`${group.title} - ${group.description}`}
                    className={`w-full py-3 px-1 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                      isGroupOpen 
                        ? 'bg-[#005A36] text-white ring-1 ring-[#00A86B]' 
                        : 'text-emerald-100 hover:bg-[#007043] hover:text-white'
                    }`}
                  >
                    <div className="mb-1 text-emerald-300">
                      {getIcon(group.iconName)}
                    </div>
                    <span className="text-[9px] font-bold tracking-wider uppercase">{group.shortCode}</span>
                  </button>
                );
              }

              // Expanded Full Hierarchy Mode
              return (
                <div key={group.id} className="rounded-xl overflow-hidden mb-1 transition-all">
                  
                  {/* Group Header Accordion Trigger */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full px-3 py-2.5 flex items-center justify-between text-left font-bold tracking-wide transition cursor-pointer ${
                      isGroupOpen 
                        ? 'bg-[#005A36] text-white shadow-2xs' 
                        : 'text-emerald-100 hover:bg-[#007043] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="text-emerald-300 shrink-0">
                        {getIcon(group.iconName)}
                      </div>
                      <span className="text-[13px] font-bold tracking-tight truncate leading-tight">
                        {group.title}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-emerald-300 ${isGroupOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Modules and Leaves inside Group */}
                  {isGroupOpen && (
                    <div className="bg-[#00472A] p-2 space-y-2 border-t border-[#003822]">
                      {group.modules.map((module) => (
                        <div key={module.id} className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[9px] uppercase font-bold text-emerald-300/80 tracking-wider flex items-center gap-1.5">
                            <span>{module.title}</span>
                          </div>

                          <div className="space-y-0.5">
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
                                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition cursor-pointer ${
                                    isActive
                                      ? 'bg-[#00A86B] text-white font-bold shadow-xs'
                                      : 'text-emerald-100/90 hover:bg-[#005A36] hover:text-white'
                                  }`}
                                >
                                  <div className="truncate pr-2">
                                    <span className="block text-xs font-semibold leading-tight">{leaf.title}</span>
                                    <span className="block text-[10px] text-emerald-200/70 truncate leading-tight mt-0.5 font-normal">
                                      {leaf.description}
                                    </span>
                                  </div>

                                  {leaf.badgeCount !== undefined && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                                      leaf.badgeVariant === 'urgent'
                                        ? 'bg-rose-500 text-white'
                                        : leaf.badgeVariant === 'warning'
                                        ? 'bg-amber-400 text-slate-900'
                                        : 'bg-emerald-300 text-slate-900'
                                    }`}>
                                      {leaf.badgeCount}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer: Station Details */}
          {!compactRailMode ? (
            <div className="p-3 border-t border-[#007043] bg-[#005A36] text-[11px] text-emerald-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Fail-Closed RBAC
              </span>
              <span className="font-mono">v4.0.0</span>
            </div>
          ) : (
            <div className="p-2 border-t border-[#007043] bg-[#005A36] text-center text-emerald-300">
              <Shield className="w-4 h-4 mx-auto" />
            </div>
          )}

        </aside>

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>

      </div>

      {/* Mobile-First Bottom App Dock */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 py-2 px-4 z-40 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center text-[10px] font-medium transition cursor-pointer ${
            currentRoute === 'dashboard' ? 'text-[#008751] font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onNavigate('orders')}
          className={`flex flex-col items-center text-[10px] font-medium transition cursor-pointer ${
            currentRoute === 'orders' ? 'text-[#008751] font-bold' : 'text-slate-500'
          }`}
        >
          <BadgePercent className="w-5 h-5 mb-0.5" />
          <span>Orders</span>
        </button>

        <button
          onClick={() => onNavigate('daily-register')}
          className={`flex flex-col items-center text-[10px] font-medium transition cursor-pointer ${
            currentRoute === 'daily-register' ? 'text-[#008751] font-bold' : 'text-slate-500'
          }`}
        >
          <Bird className="w-5 h-5 mb-0.5" />
          <span>Register</span>
        </button>

        <button
          onClick={() => onNavigate('eggs')}
          className={`flex flex-col items-center text-[10px] font-medium transition cursor-pointer ${
            currentRoute === 'eggs' ? 'text-[#008751] font-bold' : 'text-slate-500'
          }`}
        >
          <Egg className="w-5 h-5 mb-0.5" />
          <span>Eggs</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center text-[10px] font-medium text-slate-500 hover:text-slate-900 transition cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </div>

    </div>
  );
};
