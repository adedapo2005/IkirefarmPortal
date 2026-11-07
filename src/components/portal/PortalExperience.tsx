"use client";
import { farmConfiguration } from "@/lib/review-metadata";
import LoggedTimestamp from "./LoggedTimestamp";
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  lazy,
  Suspense,
} from "react";
import {
  Factory,
  Truck,
  Car,
  PawPrint,
  Shell,
  FolderLock,
  Workflow,
  Bot,
  ChartNoAxesCombined,
  LayoutDashboard,
  Clock3,
  Bell,
  UserRound,
  Tractor,
  Bird,
  HeartPulse,
  Wheat,
  Syringe,
  Egg,
  Scale,
  TriangleAlert,
  Package,
  ScanLine,
  Wallet,
  TrendingUp,
  Receipt,
  HardHat,
  Banknote,
  BriefcaseBusiness,
  UsersRound,
  MailPlus,
  ContactRound,
  CalendarCheck,
  UserCheck,
  CalendarDays,
  Landmark,
  FileText,
  Target,
  MessagesSquare,
  Megaphone,
  BookOpen,
  Shield,
  ShieldCheck,
  MapPin,
  History,
  Camera,
  KeyRound,
  Settings2,
  Terminal,
  Activity,
  Radio,
  Search,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  LogOut,
  Eye,
  EyeOff,
  Download,
  SlidersHorizontal,
  WifiOff,
  Sun,
  Check,
  Monitor,
  LockKeyhole,
  Globe,
  Leaf,
  LoaderCircle,
  CloudOff,
  Info,
  Pause,
  Play,
  Menu,
  Crown,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  pages,
  personas,
  visiblePages,
  canPage,
  canView,
  has,
  canRenderPortalShell,
  isOwnerPrincipal,
  sampleNotifications,
  themes,
  canonicalThemeId,
  themeCssAlias,
  stateOptions,
  authStates,
  Page,
  Persona,
  PersonaId,
} from "@/lib/portal-model";
import {
  type AuthenticatedPrincipal,
  principalToPersona,
} from "@/lib/authenticated-principal";
import RoleManager from "./RoleManager";
import PersonalizedWidgets from "./PersonalizedWidgets";
import PublicSignInCockpit, { type SignInColorMode } from "./PublicSignInCockpit";
import CanonicalProductionSignIn from "./CanonicalProductionSignIn";
import { AfterSignInStudioFoundation } from "./AdminExperience";
import ExecutiveCommandPulse from "./ExecutiveCommandPulse";
import ModuleDataGrid, { representativeGridRoutes } from "./ModuleDataGrids";
import PageContextHeader from "./PageContextHeader";
import AnalyticsSessionGate from "./analytics-intelligence/AnalyticsSessionGate";
import WorkspaceSystemMenu from "./WorkspaceSystemMenu";
import { workspaceBreadcrumbs } from "@/lib/workspace-navigation";
import { buildFarmNavigation, navigationContext } from "@/lib/farm-navigation";
import { navigationPreferenceKey } from "@/lib/farm-navigation-focus";
import { commandPaletteScopeOwner, commandPaletteView, commandPaletteSetOpen, commandPaletteSetQuery, type CommandPaletteOwner, type CommandPaletteState } from "@/lib/farm-command-palette-state";
import { visibleReviewNotifications } from "@/lib/farm-notification-visibility";
import PurposeBuiltWorkspace, { PurposeBuiltDashboard, ModuleCommandSummary, purposeBuiltRoutes } from "./PurposeBuiltWorkspace";
import SpecialistModulePulse from "./SpecialistModulePulse";
import { isSpecialistPulseRoute } from "@/lib/farm-specialist-pulse";
import { isSystemPulseRoute } from "@/lib/farm-system-pulse";
import NavigationShortcuts from "./NavigationShortcuts";
import AuthenticatedRecordCommandResults from "./AuthenticatedRecordCommandResults";
import shellStyles from "./WorkspaceShell.module.css";
import routeStyles from "./WorkspaceRoutes.module.css";
import EntityAccessWorkspace, { entityAccessRoutes } from "./EntityAccessWorkspace";
import OperationsFirstView from "./OperationsFirstView";
import { subscribeRoles, getRoleRevision } from "@/lib/portal-model";
import { GoldenPages, OwnerHome } from "./GoldenPages";
import HomeCommandExperience from "./HomeCommandExperience";
import "./PostLoginBrandMotion.css";
import {
  Brand,
  Btn,
  Panel,
  Chip,
  SelectField,
  Empty,
  Loading,
} from "./Common";
const Profile = lazy(() =>
  import("./WorkspacePages").then((m) => ({ default: m.Profile })),
);
const MyDay = lazy(() =>
  import("./WorkspacePages").then((m) => ({ default: m.MyDay })),
);
const CommunicationCenter = lazy(() => import("./CommunicationCenter"));
const CommunicationsWorkspace = lazy(() => import("./CommunicationsWorkspace"));
const TableStudio = lazy(() => import("./TableStudio"));
const SmartForms = lazy(() => import("./SmartForms"));
const MasterWorkspaces = lazy(() => import("./MasterWorkspaces"));
const ExperienceLabs = lazy(() => import("./ExperienceLabs"));
const GlobalOperations = lazy(() => import("./GlobalOperations"));
const DashboardWeather = lazy(() => import("./DashboardWeather"));
const SyncDesk = lazy(() => import("./SyncDesk"));
const TreasuryDesk = lazy(() => import("./TreasuryDesk"));
const PayrollCommandCenter = lazy(() =>
  import("./TreasuryDesk").then((module) => ({ default: module.PayrollCommandCenter })),
);
const MarketIntelligence = lazy(() => import("./MarketIntelligence"));
const LetterheadStudio = lazy(() => import("./LetterheadStudio"));
const ImplementationCompletionCenter = lazy(() => import("./ImplementationCompletionCenter"));
const ConstructionIntelligence = lazy(() => import("./ConstructionIntelligence"));
const DataImportCenter = lazy(() => import("./DataImportCenter"));
import { constructionPrimaryRoute, constructionRoutes } from "@/lib/construction-routes";
import { importRoutes } from "./DataImportCenter";
const DomainPages = lazy(() => import("./DomainPages"));
const FlockTransferDesk = lazy(() => import("./FlockTransferDesk"));
const BreedManagementDesk = lazy(() => import("./BreedManagementDesk"));
const ProductionAnalyticsDesk = lazy(() => import("./ProductionAnalyticsDesk"));
const SignInPresentationControls = lazy(() => import("./SignInPresentationControls"));
const AdminCenter = lazy(() => import("./AdminCenter"));
const MetaProviderControlPlane = lazy(() => import("./MetaProviderControlPlane"));
const PlatformStorageDesk = lazy(() => import("./PlatformStorageDesk"));
const SecurityCentre = lazy(() => import("./SecurityCentre"));
const CameraEvidenceCentre = lazy(() => import("./CameraEvidenceCentre"));
const FilesEvidenceCentre = lazy(() => import("./FilesEvidenceCentre"));
const icons: Record<string, React.ElementType> = {
  Factory,
  Truck,
  Car,
  PawPrint,
  Shell,
  Leaf,
  FolderLock,
  Workflow,
  Bot,
  ChartNoAxesCombined,
  LayoutDashboard,
  Clock3,
  Bell,
  UserRound,
  Tractor,
  Bird,
  HeartPulse,
  Wheat,
  Syringe,
  Egg,
  Scale,
  TriangleAlert,
  Package,
  ScanLine,
  Wallet,
  TrendingUp,
  Receipt,
  HardHat,
  Banknote,
  BriefcaseBusiness,
  UsersRound,
  MailPlus,
  ContactRound,
  CalendarCheck,
  UserCheck,
  CalendarDays,
  Landmark,
  FileText,
  Target,
  MessagesSquare,
  Megaphone,
  BookOpen,
  Shield,
  ShieldCheck,
  Monitor,
  MapPin,
  History,
  Camera,
  KeyRound,
  Settings2,
  Terminal,
  Activity,
  Radio,
};
const livePrimaryActionPages = new Set(["flock-management", "flocks", "houses", "breed-management", "flock-transfers", "feed", "feed-stock", "eggs", "health", "vaccinations", "water-management", "medication", "mortality", "inventory", "medication-stock", "equipment", "purchase-orders", "finance", "revenue", "expenses", "leave"]);
const liveOperationActionTargets: Record<string, string> = {
  "flock-management": "flock",
  flocks: "flock",
  feed: "feed",
  "feed-stock": "feed",
  eggs: "egg-batch",
  health: "health-event",
  vaccinations: "vaccination",
  "water-management": "water-check",
  medication: "medication-administration",
  mortality: "mortality-record",
};

export type WorkspaceProps = {
  person: Persona;
  authorityStamp?: string;
  sessionChecking?: boolean;
  sessionTimedOut?: boolean;
  onSessionRetry?: () => void;
  route: string;
  go: (s: string) => void;
  detail: (title: string, body: React.ReactNode) => void;
  action: (page: Page) => void;
  period: string;
  notices: typeof sampleNotifications;
  markRead: (id: string) => void;
  theme: string;
  setTheme: (s: string) => void;
  reduced: boolean;
  setReduced: (b: boolean) => void;
};
const weatherConditions = [
  "clear",
  "mainly-clear",
  "partly-cloudy",
  "cloudy-overcast",
  "fog",
  "mist-haze",
  "light-drizzle",
  "drizzle",
  "heavy-drizzle",
  "light-rain",
  "rain",
  "heavy-rain",
  "freezing-rain",
  "light-showers",
  "showers",
  "heavy-showers",
  "light-snow",
  "snow",
  "heavy-snow",
  "snow-showers",
  "thunderstorm",
  "thunderstorm-with-hail",
  "severe-thunderstorm-with-hail",
];
function getPicTheme(iconName: string, pageId: string) {
  const s = (pageId + " " + iconName).toLowerCase();
  if (s.includes("egg")) return "pic-theme-egg";
  if (s.includes("flock") || s.includes("pen") || s.includes("brood") || s.includes("housing")) return "pic-theme-flock";
  if (s.includes("feed") || s.includes("milling") || s.includes("silo") || s.includes("wheat")) return "pic-theme-feed";
  if (s.includes("health") || s.includes("vet") || s.includes("vacc") || s.includes("medical")) return "pic-theme-health";
  if (s.includes("sale") || s.includes("order") || s.includes("pos") || s.includes("cart")) return "pic-theme-sales";
  if (s.includes("pay") || s.includes("staff") || s.includes("hr") || s.includes("people") || s.includes("roster")) return "pic-theme-people";
  if (s.includes("bank") || s.includes("moniepoint") || s.includes("treasury") || s.includes("finance") || s.includes("dollar")) return "pic-theme-treasury";
  if (s.includes("report") || s.includes("analytic") || s.includes("fcr") || s.includes("chart")) return "pic-theme-reports";
  if (s.includes("admin") || s.includes("governance") || s.includes("security") || s.includes("setting")) return "pic-theme-admin";
  if (s.includes("kpi") || s.includes("metric") || s.includes("gauge")) return "pic-theme-kpi";
  if (s.includes("store") || s.includes("inventory") || s.includes("stock") || s.includes("box") || s.includes("package")) return "pic-theme-stores";
  return "pic-theme-command";
}

function PageIcon({ page }: { page: Page }) {
  const Icon = icons[page.icon] || Leaf;
  const themeClass = getPicTheme(page.icon || "", page.id || "");
  return (
    <span className={"modern-nav-pic-plate " + themeClass}>
      <Icon size={17} />
    </span>
  );
}

function WorkspaceBreadcrumb({
  person,
  page,
  go,
}: {
  person: Persona;
  page: Page;
  go: (route: string) => void;
}) {
  const crumbs = workspaceBreadcrumbs(page, visiblePages(person));
  if (!crumbs.length) return null;
  return (
    <nav className={`workspace-breadcrumb ${shellStyles.breadcrumb}`} aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, index) => (
          <li key={crumb.route || `${index}-${crumb.label}`}>
            {crumb.current ? <span aria-current="page">{crumb.label}</span>
              : crumb.route ? <button type="button" onClick={() => go(crumb.route!)}>{crumb.label}</button>
                : <span className={shellStyles.breadcrumbContext}>{crumb.label}</span>}
            {index < crumbs.length - 1 && <ChevronRight aria-hidden="true" size={14} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function WorkspaceToolbar({
  person,
  page,
  go,
  onSearch,
  onHelp,
  onPrimary,
  period,
  onPeriodChange,
}: {
  person: Persona;
  page: Page;
  go: (route: string) => void;
  onSearch: () => void;
  onHelp: () => void;
  onPrimary: () => void;
  period?: string;
  onPeriodChange?: (value: string) => void;
}) {
  const allowed = visiblePages(person);
  const context = navigationContext(page.id, allowed);
  const modulePages = context.module?.pages || [page];
  const position = modulePages.findIndex((candidate) => candidate.id === page.id);
  const previous = position > 0 ? modulePages[position - 1] : undefined;
  const next = position >= 0 && position < modulePages.length - 1 ? modulePages[position + 1] : undefined;
  const canWrite = Boolean(page.action && page.write && has(person, page.write) && livePrimaryActionPages.has(page.id));

  return (
    <section className="workspace-toolbar" role="toolbar" aria-label={`${page.title} tools`}>
      <div className="workspace-toolbar-context">
        <button type="button" onClick={() => go("dashboard")} aria-label="Open Farm Overview">
          <LayoutDashboard size={17} />
          <span>Farm Overview</span>
        </button>
        <span className="workspace-toolbar-section">
          {context.section?.label || page.group}
          {context.module && context.module.label !== context.section?.label ? ` · ${context.module.label}` : ""}
        </span>
        <span className="workspace-toolbar-position">{position + 1} of {modulePages.length}</span>
      </div>
      <div className="workspace-toolbar-actions">
        <button type="button" onClick={() => previous && go(previous.id)} disabled={!previous} aria-label={previous ? `Previous page: ${previous.title}` : "No previous page"}>
          <ChevronLeft size={17} />
          <span>Previous</span>
        </button>
        <button type="button" onClick={() => next && go(next.id)} disabled={!next} aria-label={next ? `Next page: ${next.title}` : "No next page"}>
          <span>Next</span>
          <ChevronRight size={17} />
        </button>
        {has(person, "search.view") && (
          <button type="button" onClick={onSearch}>
            <Search size={17} />
            <span>Search</span>
          </button>
        )}
        {onPeriodChange && period && (
          <label className="workspace-toolbar-period">
            <SlidersHorizontal size={16} />
            <span className="sr-only">Reporting Period</span>
            <select value={period} onChange={(event) => onPeriodChange(event.target.value)}>
              <option>Today</option>
              <option>Week</option>
              <option>Month</option>
            </select>
          </label>
        )}
        {has(person, "help.view") && (
          <button type="button" onClick={onHelp}>
            <HelpCircle size={17} />
            <span>Help</span>
          </button>
        )}
        {canWrite && (
          <button type="button" className="workspace-toolbar-primary" onClick={onPrimary}>
            <PageIcon page={page} />
            <span>{page.action}</span>
          </button>
        )}
      </div>
    </section>
  );
}

const WORK_GROUPS = [
  { id: "overview", label: "Overview" },
  { id: "farm-operations", label: "Farm Operations" },
  { id: "stock-logistics", label: "Stock & Logistics" },
  { id: "finance", label: "Finance" },
  { id: "people", label: "People" },
  { id: "reports", label: "Reports" },
  { id: "administration", label: "Administration" },
] as const;

const SECTION_WORK_GROUP: Record<string, string> = {
  "command-center": "overview",
  "flocks-housing": "farm-operations",
  "egg-production": "farm-operations",
  "feed-milling": "farm-operations",
  "health-veterinary": "farm-operations",
  "hatchery-incubation": "farm-operations",
  "inventory-stores": "stock-logistics",
  "purchasing-vendors": "stock-logistics",
  "projects-assets": "stock-logistics",
  "sales-orders": "finance",
  "finance-banking": "finance",
  "human-resources": "people",
  "reports-analytics": "reports",
  "admin-governance": "administration",
  "operations-additional": "administration",
};

const SECTION_PICTURE: Record<string, { icon: React.ComponentType<{ size?: number }>; tone: string }> = {
  "command-center": { icon: LayoutDashboard, tone: "pic-theme-command" },
  "flocks-housing": { icon: Bird, tone: "pic-theme-flock" },
  "egg-production": { icon: Egg, tone: "pic-theme-egg" },
  "feed-milling": { icon: Wheat, tone: "pic-theme-feed" },
  "health-veterinary": { icon: HeartPulse, tone: "pic-theme-health" },
  "hatchery-incubation": { icon: Shell, tone: "pic-theme-kpi" },
  "inventory-stores": { icon: Package, tone: "pic-theme-stores" },
  "purchasing-vendors": { icon: Truck, tone: "pic-theme-stores" },
  "projects-assets": { icon: HardHat, tone: "pic-theme-treasury" },
  "sales-orders": { icon: Receipt, tone: "pic-theme-sales" },
  "finance-banking": { icon: Landmark, tone: "pic-theme-treasury" },
  "human-resources": { icon: UsersRound, tone: "pic-theme-people" },
  "reports-analytics": { icon: ChartNoAxesCombined, tone: "pic-theme-reports" },
  "admin-governance": { icon: ShieldCheck, tone: "pic-theme-admin" },
};

function SectionIcon({ sectionId, page }: { sectionId: string; page?: Page }) {
  const picture = SECTION_PICTURE[sectionId];
  const Icon = picture?.icon || (page ? icons[page.icon] : undefined) || Leaf;
  return (
    <span className={"modern-nav-pic-plate ws-pic " + (picture?.tone || "pic-theme-command")} aria-hidden="true">
      <Icon size={20} />
    </span>
  );
}

function Navigation({
  person,
  route,
  go,
  logout,
  roleRevision,
  onHelp,
}: {
  person: Persona;
  route: string;
  go: (s: string) => void;
  logout: () => void;
  roleRevision: number;
  onHelp?: () => void;
}) {
  const { setOpenMobile, state: desktopState, isMobile, toggleSidebar } = useSidebar();
  const sidebarContentRef = useRef<HTMLDivElement | null>(null);
  const state = isMobile ? "expanded" : desktopState;
  const allowed = useMemo(() => {
    // Review role grants can change while the persona object stays the same.
    // Observe the external-store revision to invalidate this permission snapshot.
    void roleRevision;
    return visiblePages(person);
  }, [person, roleRevision]);
  const sections = useMemo(() => buildFarmNavigation(allowed), [allowed]);
  const navPreferenceKey = navigationPreferenceKey(person, "accordion");
  const activeSection = sections.find((section) =>
    section.modules.some((module) => module.pages.some((page) => page.id === route)),
  );
  const activeModule = activeSection?.modules.find((module) =>
    module.pages.some((page) => page.id === route),
  );
  const activeSectionId = activeSection?.id;
  const activeModuleId = activeModule?.id;
  const [openSections, setOpenSections] = useState<string[]>(["workspace"]);
  const [openModules, setOpenModules] = useState<string[]>([]);
  const [loadedNavPreferenceKey, setLoadedNavPreferenceKey] = useState<string | null>("");
  const visibleOpenSections = loadedNavPreferenceKey === navPreferenceKey ? openSections : ["workspace"];
  const visibleOpenModules = loadedNavPreferenceKey === navPreferenceKey ? openModules : [];

  useEffect(() => {
    let savedSections: string[] = [];
    let savedModules: string[] = [];
    let savedRoute: string | undefined;
    if (navPreferenceKey) {
      try {
        // Never import another employee's preferences or the old shared Stage 19 key.
        const saved = window.localStorage.getItem(navPreferenceKey);
        const parsed = saved ? JSON.parse(saved) as { sections?: unknown; modules?: unknown; route?: unknown } : {};
        if (Array.isArray(parsed.sections)) savedSections = parsed.sections.filter((id): id is string => typeof id === "string");
        if (Array.isArray(parsed.modules)) savedModules = parsed.modules.filter((id): id is string => typeof id === "string");
        if (typeof parsed.route === "string") savedRoute = parsed.route;
      } catch {
        // Corrupt preferences never interfere with navigation.
      }
    }
    const permittedSections = new Set(sections.map((section) => section.id));
    const permittedModules = new Set(sections.flatMap((section) => section.modules.map((module) => module.id)));
    // Only restore a manually collapsed branch for the very same route.
    // A different destination always opens its own branch instead of retaining stale menus.
    const restore = savedRoute === route;
    const selectedSection = restore
      ? savedSections.find((id) => permittedSections.has(id))
      : activeSectionId || (permittedSections.has("workspace") ? "workspace" : sections[0]?.id);
    const selectedModule = restore
      ? savedModules.find((id) => permittedModules.has(id) && sections.some((section) =>
          section.id === selectedSection && section.modules.some((module) => module.id === id)))
      : activeModuleId;
    setOpenSections(selectedSection ? [selectedSection] : []);
    setOpenModules(selectedModule && selectedSection ? [selectedModule] : []);
    setLoadedNavPreferenceKey(navPreferenceKey);
    // Account changes must never inherit the previous employee's open branch.
  }, [navPreferenceKey, sections]);

  const lastActiveRouteRef = useRef({ key: navPreferenceKey, route });
  useEffect(() => {
    const previous = lastActiveRouteRef.current;
    if (previous.key === navPreferenceKey && previous.route === route) return;
    lastActiveRouteRef.current = { key: navPreferenceKey, route };
    // Back, Forward, command search, favourites, and mobile navigation all converge here.
    setOpenSections(activeSectionId ? [activeSectionId] : []);
    setOpenModules(activeModuleId ? [activeModuleId] : []);
  }, [route, activeSectionId, activeModuleId, navPreferenceKey]);

  useEffect(() => {
    if (state === "collapsed" || loadedNavPreferenceKey !== navPreferenceKey) return;
    const frame = window.requestAnimationFrame(() => {
      const container = sidebarContentRef.current;
      const activePage = container?.querySelector<HTMLElement>(
        '[data-slot="sidebar-menu-button"][data-active="true"]',
      );
      if (!container || !activePage) return;
      const containerBounds = container.getBoundingClientRect();
      const activeBounds = activePage.getBoundingClientRect();
      if (activeBounds.top < containerBounds.top || activeBounds.bottom > containerBounds.bottom) {
        const targetTop = container.scrollTop
          + activeBounds.top
          - containerBounds.top
          - (container.clientHeight - activeBounds.height) / 2;
        container.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    state,
    route,
    loadedNavPreferenceKey,
    navPreferenceKey,
    visibleOpenSections,
    visibleOpenModules,
  ]);

  useEffect(() => {
    if (!navPreferenceKey || loadedNavPreferenceKey !== navPreferenceKey) return;
    try {
      window.localStorage.setItem(
        navPreferenceKey,
        JSON.stringify({ sections: openSections, modules: openModules, route }),
      );
    } catch {
      // The workspace remains fully functional when storage is unavailable.
    }
  }, [navPreferenceKey, loadedNavPreferenceKey, openSections, openModules, route]);

  const navigate = (nextRoute: string) => {
    go(nextRoute);
    setOpenMobile(false);
  };

  const collapsed = state === "collapsed";
  const workGroups = WORK_GROUPS.map((group) => ({
    ...group,
    sections: sections.filter((section) => (SECTION_WORK_GROUP[section.id] || "administration") === group.id),
  })).filter((group) => group.sections.length > 0);
  const settingsRoute = ["settings", "farm-settings"].find((id) => canPage(person, id));
  const isOwner = person.id === "owner";

  return (
    <Sidebar collapsible="icon" className={`portal-sidebar ws-sidebar ${shellStyles.sidebar}`}>
      <SidebarHeader className="ws-head">
        <button
          type="button"
          className="ws-brand"
          onClick={() => navigate("dashboard")}
          aria-label={`${farmConfiguration.name} Home`}
        >
          <Brand />
        </button>
        {/* Only one authorised location exists today, so the selector is replaced by a read-only context label. */}
        <div className="ws-site" aria-label="Current farm context">
          <span className="ws-site-dot" aria-hidden="true" />
          {!collapsed && (
            <span className="ws-site-copy">
              <small>Current Farm</small>
              <strong>{farmConfiguration.name}</strong>
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent ref={sidebarContentRef} className="ws-content">
        <NavigationShortcuts person={person} route={route} pages={allowed} go={navigate} collapsed={collapsed} roleRevision={roleRevision} />
        <nav aria-label="Primary Navigation" className="ws-nav">
          {workGroups.map((group) => (
            <SidebarGroup key={group.id} className="ws-group">
              {!collapsed && <h2 className="ws-group-title">{group.label}</h2>}
              <ul className="ws-list">
                {group.sections.map((section) => {
                  const pages = section.modules.flatMap((module) => module.pages);
                  if (!pages.length) return null;
                  const sectionActive = pages.some((page) => page.id === route);
                  const sectionOpen = visibleOpenSections.includes(section.id);
                  const iconPage = section.modules[0]?.pages.find((page) => page.id === section.modules[0]?.landingRoute) || pages[0];
                  if (collapsed) {
                    return (
                      <li key={section.id} className="ws-item">
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="ws-rail-btn"
                                  data-active={sectionActive || undefined}
                                  aria-label={`${section.label} destinations`}
                                >
                                  <SectionIcon sectionId={section.id} page={iconPage} />
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={10} className={shellStyles.navTooltip} data-chrome="protected">
                              <span className={shellStyles.navTooltipCopy}>
                                <strong>{section.label}</strong>
                                <small>{group.label}</small>
                              </span>
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent side="right" align="start" sideOffset={12} className="ws-flyout" data-chrome="protected">
                            <p className="ws-flyout-title">{section.label}</p>
                            {pages.map((page) => (
                              <DropdownMenuItem
                                key={page.id}
                                onSelect={() => navigate(page.id)}
                                aria-current={route === page.id ? "page" : undefined}
                                className="ws-flyout-item"
                              >
                                {page.title}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  }
                  return (
                    <li key={section.id} className="ws-item" data-open={sectionOpen || undefined}>
                      <button
                        type="button"
                        className="ws-parent"
                        data-active={sectionActive || undefined}
                        aria-expanded={sectionOpen}
                        aria-controls={`ws-sub-${section.id}`}
                        onClick={() => {
                          setOpenSections((previous) => (previous.includes(section.id) ? [] : [section.id]));
                          setOpenModules([]);
                        }}
                      >
                        <SectionIcon sectionId={section.id} page={iconPage} />
                        <span className="ws-label">{section.label}</span>
                        <ChevronRight className="ws-chevron" size={17} aria-hidden="true" />
                      </button>
                      {sectionOpen && (
                        <ul className="ws-sub" id={`ws-sub-${section.id}`}>
                          {pages.map((page) => (
                            <li key={page.id}>
                              <a
                                href={`#/${page.id}`}
                                className="ws-leaf"
                                data-slot="sidebar-menu-button"
                                data-active={route === page.id || undefined}
                                aria-current={route === page.id ? "page" : undefined}
                                onClick={(event) => {
                                  event.preventDefault();
                                  navigate(page.id);
                                }}
                              >
                                <span className="ws-leaf-mark" aria-hidden="true" />
                                <span>{page.title}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="ws-foot">
        <div className="ws-exec">
          <button
            type="button"
            className="ws-exec-id"
            onClick={() => canPage(person, "profile") && navigate("profile")}
            aria-label={`Open profile for ${person.name}`}
          >
            <span className="ws-avatar">
              {person.initials}
              <span className="ws-avatar-status" aria-label="Online" />
            </span>
            {!collapsed && (
              <span className="ws-exec-copy">
                <strong>
                  {person.name}
                  {isOwner && <Crown size={14} className="ws-crown" aria-label="Verified executive" />}
                </strong>
                <small>{person.job}</small>
              </span>
            )}
          </button>
          {!collapsed && (
            <div className="ws-quick">
              <button
                type="button"
                disabled
                title={`${farmConfiguration.name} is your only authorised farm unit`}
                aria-label="Switch farm unit (only one authorised unit)"
              >
                <Building2 size={15} aria-hidden="true" />
                <span>Switch Unit</span>
              </button>
              <button
                type="button"
                disabled={!settingsRoute}
                onClick={() => settingsRoute && navigate(settingsRoute)}
                aria-label="System settings"
              >
                <Settings2 size={15} aria-hidden="true" />
                <span>Settings</span>
              </button>
              <button type="button" onClick={logout} aria-label="Secure sign-out">
                <LogOut size={15} aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
        <div className="ws-foot-bar">
          <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
            {!collapsed && <span>Collapse</span>}
          </button>
          {onHelp && !collapsed && (
            <button type="button" onClick={onHelp} aria-label="Help">
              <HelpCircle size={17} aria-hidden="true" />
              <span>Help</span>
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MobileNavigationDock({
  person,
  route,
  go,
}: {
  person: Persona;
  route: string;
  go: (route: string) => void;
}) {
  const { openMobile, setOpenMobile } = useSidebar();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingRestoreRef = useRef<MutationObserver | null>(null);
  const pendingExpiryRef = useRef<number | null>(null);
  const pendingFrameRef = useRef<number | null>(null);
  useEffect(() => {
    if (!openMobile) return;
    const cancelPending = () => {
      pendingRestoreRef.current?.disconnect();
      pendingRestoreRef.current = null;
      if (pendingExpiryRef.current !== null) window.clearTimeout(pendingExpiryRef.current);
      if (pendingFrameRef.current !== null) window.cancelAnimationFrame(pendingFrameRef.current);
      pendingExpiryRef.current = null;
      pendingFrameRef.current = null;
    };
    const restoreMenuAfterDrawerDismissal = () => {
      cancelPending();
      const menuButton = menuTriggerRef.current;
      if (!menuButton) return;
      // Observe before Radix handles Escape or overlay pointer dismissal.
      // The drawer stays mounted until its exit animation completes.
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]')) return;
        observer.disconnect();
        pendingRestoreRef.current = null;
        if (pendingExpiryRef.current !== null) window.clearTimeout(pendingExpiryRef.current);
        pendingExpiryRef.current = null;
        pendingFrameRef.current = window.requestAnimationFrame(() => {
          pendingFrameRef.current = window.requestAnimationFrame(() => {
            pendingFrameRef.current = null;
            if (menuButton.isConnected && !menuButton.inert) menuButton.focus({ preventScroll: true });
          });
        });
      });
      pendingRestoreRef.current = observer;
      observer.observe(document.body, { childList: true, subtree: true });
      // Cleanup limit, not a guessed animation/focus delay.
      pendingExpiryRef.current = window.setTimeout(cancelPending, 1800);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        if (["Enter", " ", "Tab"].includes(event.key)) cancelPending();
        return;
      }
      const input = document.querySelector<HTMLInputElement>(
        '[data-mobile="true"] .nav-shortcuts input[aria-label="Search authorized pages"]',
      );
      const target = event.target instanceof Element ? event.target : null;
      // Escape first clears an active search. Only an Escape that can close
      // the drawer should schedule focus restoration.
      if (input?.value && (target === input || target?.closest(".nav-shortcuts-results"))) return;
      restoreMenuAfterDrawerDismissal();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-slot="sheet-overlay"]')) {
        // Overlay click dismisses the Sheet without an Escape key.
        // Capture before Radix closes it, just as for keyboard dismissal.
        restoreMenuAfterDrawerDismissal();
      } else {
        cancelPending();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      // Do not disconnect the pending observer here: the portal's exit
      // animation outlives the openMobile=true effect.
    };
  }, [openMobile]);
  const destinations = [
    { route: "dashboard", label: "Overview", icon: LayoutDashboard },
    { route: "myday", label: "My Day", icon: Clock3 },
    { route: "notifications", label: "Alerts", icon: Bell },
  ].filter((item) => canPage(person, item.route));

  return (
    <nav
      className="mobile-navigation-dock"
      aria-label="Mobile workspace navigation"
      aria-hidden={openMobile || undefined}
      data-drawer-open={openMobile || undefined}
      inert={openMobile}
    >
      {destinations.map(({ route: destination, label, icon: Icon }) => (
        <button
          key={destination}
          type="button"
          data-active={route === destination || undefined}
          aria-current={route === destination ? "page" : undefined}
          onClick={() => {
            go(destination);
            setOpenMobile(false);
          }}
        >
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
      <button
        ref={menuTriggerRef}
        type="button"
        aria-label="Open all navigation"
        onClick={() => setOpenMobile(true)}
      >
        <Menu size={21} aria-hidden="true" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

const authBackgrounds = [1, 2, 3, 4, 5].map((index) => ({
  id: `auth-background-${index}`,
  image: `/assets/auth-v24/hero-0${index}-1672.webp`,
  srcSet: `/assets/auth-v24/hero-0${index}-640.webp 640w, /assets/auth-v24/hero-0${index}-1024.webp 1024w, /assets/auth-v24/hero-0${index}-1672.webp 1672w`,
}));

type PortalExperienceProps = {
  initialRoute?: string;
  principal?: AuthenticatedPrincipal;
  analyticsSessionChecking?: boolean;
  analyticsSessionTimedOut?: boolean;
  analyticsSessionGeneration?: number | null;
  onAnalyticsSessionTimeout?: (generation: number) => void;
  onAnalyticsSessionRetry?: () => void;
  reviewMode?: boolean;
  reviewPersonaId?: PersonaId;
  onLogout?: () => void | Promise<void>;
};

type DeploymentMetadata = {
  releaseLabel: string;
  environment: string;
  sourceRepository: string;
  sourceCommit: string;
  builtAtUtc: string | null;
  workerVersionId: string | null;
  workerVersionTag: string | null;
  workerVersionCreatedAtUtc: string | null;
};

const unavailableDeploymentMetadata: DeploymentMetadata = {
  releaseLabel: "Staging metadata unavailable",
  environment: "unknown",
  sourceRepository: "adedapo2005/daenem-farms",
  sourceCommit: "unknown",
  builtAtUtc: null,
  workerVersionId: null,
  workerVersionTag: null,
  workerVersionCreatedAtUtc: null,
};

function formatDeploymentTime(value: string | null) {
  return <LoggedTimestamp value={value} />;
}

function shortReleaseCommit(value: string) {
  return /^[0-9a-f]{40}$/i.test(value) ? value.slice(0, 12) : "Commit unavailable";
}

const closedPersona: Persona = {
  id: "unavailable",
  label: "Workspace Unavailable",
  name: "Workspace Unavailable",
  job: "Access Unavailable",
  initials: "DF",
  permissions: [],
  farm: false,
  self: [],
  employeeId: "",
  department: "",
  principalSource: "authenticated",
  isOwner: false,
  accessState: "assigned",
  restriction: "disabled",
};

function readSidebarOpen(key: string) {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === "true" || saved === "false") return saved === "true";
  } catch {
    // Storage unavailable: fall back to the viewport default.
  }
  // Standard desktop and 4K open expanded; tablets start on the compact rail.
  return window.innerWidth >= 1100;
}

function writeSidebarOpen(key: string, open: boolean) {
  try {
    window.localStorage.setItem(key, String(open));
  } catch {
    // Preference persistence is optional.
  }
}

export default function PortalExperience({
  initialRoute,
  principal,
  analyticsSessionChecking = false,
  analyticsSessionTimedOut = false,
  analyticsSessionGeneration = null,
  onAnalyticsSessionTimeout,
  onAnalyticsSessionRetry,
  reviewMode = false,
  reviewPersonaId = "owner",
  onLogout,
}: PortalExperienceProps = {}) {
  const roleRevision = useSyncExternalStore(
    subscribeRoles,
    getRoleRevision,
    () => 0,
  );
  const authenticatedPersona = useMemo(
    () => (principal ? principalToPersona(principal) : null),
    [principal],
  );
  const [initialized, setInitialized] = useState(false);
  const [route, setRoute] = useState(initialRoute || "signin"),
    [personId, setPersonId] = useState<PersonaId>(reviewPersonaId),
    [review, setReview] = useState(false),
    // The global palette must not retain a different principal's typed query
    // or open dialog during a same-shell account transition.
    [commandState, setCommandState] = useState<CommandPaletteState>({
      owner: null, open: false, query: "",
    }),
    [panel, setPanel] = useState<{
      title: string;
      body: React.ReactNode;
    } | null>(null),
    [modal, setModal] = useState<Page | null>(null),
    [authMode, setAuthMode] = useState("Employee Sign-In"),
    [authState, setAuthState] = useState("default"),
    [signupStep, setSignupStep] = useState(1),
    [signup, setSignup] = useState({
      fullName: "", email: "", phone: "", username: "", employeeId: "",
      department: "", verificationChannel: "email", password: "", confirmPassword: "",
    }),
    [usernameUsability, setUsernameUsability] = useState("idle"),
    [emailUsability, setEmailUsability] = useState("idle"),
    [showPassword, setShowPassword] = useState(false),
    [acceptedTerms, setAcceptedTerms] = useState(false),
    [remember, setRemember] = useState(false),
    [state, setState] = useState("ready"),
    [period, setPeriod] = useState("Week"),
    [theme, setTheme] = useState("reference-v3"),
    [colorMode, setColorMode] = useState<SignInColorMode>("daylight"),
    [backgroundIndex, setBackgroundIndex] = useState(0),
    [backgroundPaused, setBackgroundPaused] = useState(true),
    [reduced, setReduced] = useState(false),
    [notificationState, setNotificationState] = useState(sampleNotifications),
    [now, setNow] = useState(new Date("2026-09-11T09:00:00Z")),
    [weather, setWeather] = useState("partly-cloudy"),
    [weatherStatus, setWeatherStatus] = useState("provider-unavailable"),
    [dayPhase, setDayPhase] = useState("day"),
    [wind, setWind] = useState("calm"),
    [provider, setProvider] = useState("unavailable"),
    [deploymentMetadata, setDeploymentMetadata] = useState<DeploymentMetadata>(
      unavailableDeploymentMetadata,
    ),
    [recoveryStage, setRecoveryStage] = useState<"start" | "code" | "new-password" | "success">("start"),
    [recoveryNotice, setRecoveryNotice] = useState("");
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const commandReturnFocus = useRef<HTMLElement | null>(null);
  const commandFocusOwnerRef = useRef<CommandPaletteOwner | null>(null);
  const openCommand = () => {
    commandFocusOwnerRef.current = commandOwner;
    commandReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommand(true);
  };
  const usernameValidationSequence = useRef(0);
  const emailValidationSequence = useRef(0);
  const usernameFormatValid = /^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(signup.username);
  const emailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signup.email);
  const passwordPolicy = {
    length: signup.password.length >= 6,
    letter: /[A-Za-z]/.test(signup.password),
    number: /\d/.test(signup.password),
  };
  const passwordPolicyValid = Object.values(passwordPolicy).every(Boolean);
  const missingPasswordRules = [
    !passwordPolicy.length && "6 characters",
    !passwordPolicy.letter && "a letter",
    !passwordPolicy.number && "a number",
  ].filter(Boolean);
  const passwordsMatch = Boolean(signup.confirmPassword) && signup.password === signup.confirmPassword;
  const signupIdentityReady =
    signup.fullName.trim().length >= 2 &&
    /^[+()\d\s-]{7,20}$/.test(signup.phone) &&
    usernameFormatValid &&
    emailFormatValid;
  const signupSecurityReady = passwordPolicyValid && passwordsMatch && acceptedTerms;
  const signupClientReady = signupIdentityReady && signupSecurityReady;
  const person = reviewMode
    ? personas.find((candidate) => candidate.id === personId) || personas[0]
    : authenticatedPersona || closedPersona;
  // Scope both display and mutations at render time. An effect-only reset
  // would leave one render where a new principal sees a prior typed query.
  const commandOwner = commandPaletteScopeOwner(
    person, navigationPreferenceKey(person, "shortcuts"), roleRevision,
  );
  const { open: command, query } = commandPaletteView(commandState, commandOwner);
  const setCommand = (next: boolean | ((previous: boolean) => boolean)) =>
    setCommandState((previous) => commandPaletteSetOpen(previous, commandOwner, next));
  const setQuery = (next: string) =>
    setCommandState((previous) => commandPaletteSetQuery(previous, commandOwner, next));
  const allowed = visiblePages(person);
  const isConstructionRoute = (constructionRoutes as readonly string[]).includes(route);
  const resolvedRoute = isConstructionRoute ? constructionPrimaryRoute(route) : route;
  const current = allowed.find((p) => p.id === resolvedRoute);
  const farmScopeLabel = person.farm ? "Authorized Farm Scope" : "Personal Workspace";
  // Width is a per-user display preference only; it never affects permissions.
  const sidebarWidthKey = `farmportal.sidebar-open.${person.authenticatedAccountId || person.id}`;
  const [sidebarOpen, setSidebarOpen] = useState(() => readSidebarOpen(sidebarWidthKey));
  useEffect(() => {
    // Account switch: load that user's own width preference.
    setSidebarOpen(readSidebarOpen(sidebarWidthKey));
  }, [sidebarWidthKey]);
  // Sample notifications belong to Owner review fixtures only. A real
  // authenticated session must never interpret fixture alerts as live work.
  const notificationsUnavailable = !reviewMode && canPage(person, "notifications");
  const notices = canPage(person, "notifications")
    ? visibleReviewNotifications(reviewMode, notificationState, (page) => canPage(person, page))
    : [];
  useEffect(() => {
    const sync = () => {
      if (location.hash.startsWith("#/"))
        setRoute(location.hash.slice(2).split("?")[0] || "signin");
      else if (!location.hash) setRoute("signin");
    };
    sync();
    const reviewParams = new URLSearchParams(location.search);
    const samplePersona = reviewParams.get("persona");
    if (reviewMode && personas.some((candidate) => candidate.id === samplePersona))
      setPersonId(samplePersona as PersonaId);
    const selectedTheme = reviewParams.get("theme");
    if (selectedTheme) setTheme(canonicalThemeId(selectedTheme));
    const requestedMode = reviewParams.get("mode");
    const storedMode = window.localStorage.getItem("daenem-signin-mode");
    const nextMode = requestedMode === "dark" || requestedMode === "night"
      ? "dark"
      : requestedMode === "auto"
        ? "auto"
        : requestedMode === "daylight" || requestedMode === "day"
          ? "daylight"
          : storedMode === "dark" || storedMode === "auto" || storedMode === "daylight"
            ? storedMode
            : "daylight";
    setColorMode(nextMode);
    const requestedBackground = Number(reviewParams.get("background"));
    if (requestedBackground >= 1 && requestedBackground <= authBackgrounds.length) {
      setBackgroundIndex(requestedBackground - 1);
      setBackgroundPaused(true);
    }
    const selectedAuth = reviewParams.get("auth");
    if (authStates.includes(selectedAuth || "")) setAuthState(selectedAuth!);
    const form = reviewParams.get("form");
    if (form === "signup") {
      setAuthMode("Create Account");
      if (selectedAuth === "invalid") {
        setSignup((current) => ({
          ...current, fullName: "A", username: "1!", email: "not-an-email",
          phone: "123", password: "short", confirmPassword: "different",
        }));
      }
      if (reviewParams.get("step") === "2") {
        setSignupStep(1);
        setSignup((current) => ({
          ...current, fullName: "Amina Okafor", username: "amina.okafor",
          email: "amina@example.com", phone: "+234 800 000 0000",
          password: "Daenem2026", confirmPassword: "Daenem2026",
        }));
        setAcceptedTerms(true);
      }
    }
    if (form === "reset") {
      setAuthMode("Forgot Password");
      if (selectedAuth === "verification") setRecoveryStage("code");
    }
    setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
    setInitialized(true);
    window.addEventListener("hashchange", sync);
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.removeEventListener("hashchange", sync);
      clearInterval(timer);
    };
  }, [reviewMode]);
  useEffect(() => {
    let active = true;
    fetch("/api/release-metadata", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Release metadata unavailable");
        return response.json() as Promise<DeploymentMetadata>;
      })
      .then((metadata) => {
        if (active && metadata && typeof metadata.releaseLabel === "string") {
          setDeploymentMetadata(metadata);
        }
      })
      .catch(() => {
        if (active) setDeploymentMetadata(unavailableDeploymentMetadata);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (authMode !== "Create Account" || !signup.username) {
      setUsernameUsability("idle");
      return;
    }
    if (!usernameFormatValid) {
      setUsernameUsability("invalid-format");
      return;
    }
    const request = ++usernameValidationSequence.current;
    setUsernameUsability("checking");
    const timer = window.setTimeout(() => {
      if (request === usernameValidationSequence.current) setUsernameUsability("backend-required");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [authMode, signup.username, usernameFormatValid]);
  useEffect(() => {
    if (authMode !== "Create Account" || !signup.email) {
      setEmailUsability("idle");
      return;
    }
    if (!emailFormatValid) {
      setEmailUsability("invalid-format");
      return;
    }
    const request = ++emailValidationSequence.current;
    setEmailUsability("checking");
    const timer = window.setTimeout(() => {
      if (request === emailValidationSequence.current) setEmailUsability("backend-required");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [authMode, signup.email, emailFormatValid]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (route !== "signin" && has(person, "search.view")) {
          if (!command) {
            commandFocusOwnerRef.current = commandOwner;
            commandReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }
          setCommandState((previous) =>
            commandPaletteSetOpen(previous, commandOwner, (isOpen) => !isOpen));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [route, personId, roleRevision, command, person, commandOwner]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--primary",
      themes.find((t) => t[0] === theme)?.[2] || "#125945",
    );
    document.documentElement.classList.toggle("reduce-motion", reduced);
    document.documentElement.dataset.theme = themeCssAlias[canonicalThemeId(theme)];
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.mode = colorMode;
    document.documentElement.dataset.resolvedMode =
      colorMode === "auto" ? (systemDark ? "dark" : "daylight") : colorMode;
    if (initialized) window.localStorage.setItem("daenem-signin-mode", colorMode);
  }, [theme, reduced, colorMode, initialized]);
  useEffect(() => {
    if (colorMode !== "auto") return;
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const syncAutoMode = () => {
      document.documentElement.dataset.resolvedMode = preference.matches ? "dark" : "daylight";
    };
    syncAutoMode();
    preference.addEventListener("change", syncAutoMode);
    return () => preference.removeEventListener("change", syncAutoMode);
  }, [colorMode]);
  useEffect(() => {
    const syncVisibility = () => document.documentElement.classList.toggle("document-hidden", document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      document.documentElement.classList.remove("document-hidden");
    };
  }, []);
  useEffect(() => {
    if (route !== "signin" || backgroundPaused || reduced) return;
    const timer = window.setInterval(
      () => setBackgroundIndex((index) => (index + 1) % authBackgrounds.length),
      12000,
    );
    return () => window.clearInterval(timer);
  }, [route, backgroundPaused, reduced]);
  const go = (id: string) => {
    setPanel(null);
    setModal(null);
    setCommand(false);
    setQuery("");
    setState("ready");
    location.hash = "/" + id;
    setRoute(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const changePersona = (id: string) => {
    if (!reviewMode) return;
    setPersonId(id as PersonaId);
    setNotificationState(sampleNotifications);
    setPanel(null);
    setModal(null);
    setCommand(false);
    setQuery("");
    setState("ready");
    if (route !== "signin")
      go(
        id === "no-role"
          ? "profile"
          : ["provisional", "expired"].includes(id)
            ? "approval-status"
            : "dashboard",
      );
  };
  const detail = (title: string, body: React.ReactNode) =>
    setPanel({ title, body });
  const markRead = (id: string) =>
    setNotificationState((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  const action = (page: Page) => {
    if (!canView(person, page) || !page.write || !has(person, page.write) || !livePrimaryActionPages.has(page.id))
      return;
    const operationKind = liveOperationActionTargets[page.id];
    const targetId = page.id === "leave"
      ? "leave-request-form"
      : page.id === "inventory"
        ? "inventory-stock-movement-form"
        : page.id === "medication-stock"
          ? "medication-stock-movement-form"
          : page.id === "equipment"
            ? "equipment-workspace"
          : page.id === "houses"
            ? "house-register-workspace"
          : page.id === "breed-management"
            ? "breed-management-workspace"
          : page.id === "flock-transfers"
            ? "flock-transfer-workspace"
          : page.id === "purchase-orders"
            ? "procurement-workspace"
          : operationKind ? `farm-operation-${operationKind}-form` : "commercial-finance-records";
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    window.requestAnimationFrame(() => {
      if (page.id === "equipment" || page.id === "houses" || page.id === "breed-management" || page.id === "flock-transfers") {
        const createButton = target.querySelector<HTMLButtonElement>(
          page.id === "equipment"
            ? '[data-primary-action="equipment-create"]'
            : page.id === "houses"
              ? '[data-primary-action="house-create"]'
              : page.id === "breed-management"
                ? '[data-primary-action="breed-create"]'
                : '[data-primary-action="flock-transfer-create"]',
        );
        createButton?.click();
        window.requestAnimationFrame(() => {
          const form = document.getElementById(
            page.id === "equipment"
              ? "equipment-record-form"
              : page.id === "houses"
                ? "house-record-form"
                : page.id === "breed-management"
                  ? "breed-record-form"
                  : "flock-transfer-form",
          );
          (form?.querySelector<HTMLElement>("input:not(:disabled), select, textarea, button") || form || target).focus({ preventScroll: true });
        });
        return;
      }
      if (page.id === "purchase-orders") {
        const createButton = target.querySelector<HTMLButtonElement>('[data-primary-action="purchase-order-create"]');
        createButton?.click();
        window.requestAnimationFrame(() => {
          const form = document.getElementById("purchase-order-form");
          (form?.querySelector<HTMLElement>("input, select, textarea, button") || form || target).focus({ preventScroll: true });
        });
        return;
      }
      if (page.id === "finance" || page.id === "revenue" || page.id === "expenses") {
        // Finance Overview must open its actual ledger-entry workflow, never
        // the default Customer creation form. The server remains the authority
        // for permissions, draft validity and financial posting.
        if (page.id === "finance") {
          // Dispatch a single intent. The Finance desk switches to the Ledger
          // collection and opens the draft form only after an authorized read
          // completes; a fixed animation-frame delay can silently miss it.
          target.dispatchEvent(new Event('daenem:finance-ledger-create'));
          return;
        }
        const createButton = target.querySelector<HTMLButtonElement>('[data-primary-action="finance-create"]');
        if (createButton) {
          createButton.click();
          window.requestAnimationFrame(() => {
            const form = document.getElementById("commercial-finance-create-form");
            (form?.querySelector<HTMLElement>("input, select, textarea, button") || form || target).focus({ preventScroll: true });
          });
          return;
        }
      }
      (target.querySelector<HTMLElement>("input, select, textarea, button") || target).focus({ preventScroll: true });
    });
  };
  const logout = () => {
    setNotificationState(sampleNotifications);
    setAuthState("default");
    if (reviewMode) go("signin");
    else void onLogout?.();
  };
  const props: WorkspaceProps = {
    person,
    authorityStamp: principal?.securityStamp || "",
    sessionChecking: analyticsSessionChecking,
    sessionTimedOut: analyticsSessionTimedOut,
    onSessionRetry: onAnalyticsSessionRetry,
    route,
    go,
    detail,
    action,
    period,
    notices,
    markRead,
    theme,
    setTheme,
    reduced,
    setReduced,
  };
  const openHelp = () => {
    const authorityLabel = current?.authority === "existing"
      ? "Existing mapped service"
      : current?.authority === "development"
        ? "Development contract — not approved for production integration"
        : current
          ? "Source mapping pending"
          : "No workspace selected";
    const primaryAccess = current?.action
      ? current.write && has(person, current.write)
        ? `${current.action} is available in your current access.`
        : `${current.action} is not available in your current access.`
      : "This workspace has no primary write action.";
    detail(
      "Help & Support",
      <div className="stack contextual-help">
        <div className="stack tight">
          <Chip tone={current?.authority === "existing" ? "blue" : "amber"}>
            CONTEXTUAL HELP · PERMISSION-AWARE
          </Chip>
          <h2>{current?.title || "FarmPortal"}</h2>
          <p>{current?.description || "Find guidance for the FarmPortal workspace you are using."}</p>
        </div>
        {current && (
          <Panel title="Current Workspace">
            <dl className="identity-facts">
              <div><dt>Area</dt><dd>{current.group}</dd></div>
              <div><dt>Data authority</dt><dd>{authorityLabel}</dd></div>
              <div><dt>Primary action</dt><dd>{primaryAccess}</dd></div>
              <div><dt>Visibility</dt><dd>Shown only because this destination is permitted for your current account scope.</dd></div>
            </dl>
          </Panel>
        )}
        <Panel title="Keyboard Shortcuts">
          <p>Ctrl / Cmd + K — Search permitted pages and actions</p>
          <p>Ctrl / Cmd + B — Toggle navigation</p>
          <p>Escape — Close an open panel</p>
          <p>Tab / Shift + Tab — Move through controls</p>
        </Panel>
        <div className="row wrap">
          {canPage(person, "knowledge") && (
            <Btn onClick={() => go("knowledge")}>
              Open Knowledge & Training <ArrowUpRight size={17} />
            </Btn>
          )}
          <Btn onClick={openCommand}>
            Search FarmPortal <Search size={17} />
          </Btn>
        </div>
        <div className="auth-state" role="status">
          Support request submission and contact routing are not connected here yet. No ticket, message, or notification is created by opening Help. Authorized support channels must come from the configured Daenem directory and support service.
        </div>
      </div>,
    );
  };
  const release = () =>
    detail(
      "Version & Release Details",
      <div className="stack">
        <Chip tone="amber">{deploymentMetadata.releaseLabel}</Chip>
        <h3>FarmPortal Staging Release</h3>
        <p>
          This identity is supplied by the serving Cloudflare Worker and the
          exact Git release commit. Production remains unchanged.
        </p>
        <dl className="identity-facts">
          <div>
            <dt>Environment</dt>
            <dd>
              {deploymentMetadata.environment === "staging"
                ? "Cloudflare Staging"
                : "Metadata unavailable"}
            </dd>
          </div>
          <div>
            <dt>Source Repository</dt>
            <dd>{deploymentMetadata.sourceRepository}</dd>
          </div>
          <div>
            <dt>Source Commit</dt>
            <dd style={{ overflowWrap: "anywhere" }}>
              {deploymentMetadata.sourceCommit}
            </dd>
          </div>
          <div>
            <dt>Cloudflare Version</dt>
            <dd style={{ overflowWrap: "anywhere" }}>
              {deploymentMetadata.workerVersionId || "Unavailable"}
            </dd>
          </div>
          <div>
            <dt>Version Tag</dt>
            <dd>{deploymentMetadata.workerVersionTag || "Unavailable"}</dd>
          </div>
          <div>
            <dt>Release Built</dt>
            <dd>
              {formatDeploymentTime(
                deploymentMetadata.builtAtUtc)}
            </dd>
          </div>
          <div>
            <dt>Last Pushed To Stage</dt>
            <dd>
              {formatDeploymentTime(
                deploymentMetadata.workerVersionCreatedAtUtc)}
            </dd>
          </div>
        </dl>
        <p>
          The full commit and Worker version above are the authoritative
          identity for the page currently being served.
        </p>
      </div>,
    );
  const openNotificationPanel = () =>
    detail(
      "Your Notifications",
      <div className="stack">
        {notices.length ? (
          notices.map((n) => (
            <div key={n.id} className="attention-item">
              <Chip tone={n.priority === "Review" ? "amber" : "gray"}>
                {n.priority}
              </Chip>
              <strong>{n.title}</strong>
              <p>{n.detail}</p>
              <div className="row between">
                <small>{n.time}</small>
                <Btn
                  small
                  onClick={() => {
                    markRead(n.id);
                    go(n.page);
                  }}
                >
                  Open <ArrowUpRight size={15} />
                </Btn>
              </div>
            </div>
          ))
        ) : (
          <p>{notificationsUnavailable ? "Live Notifications Are Not Connected Yet." : "No Notifications In Your Authorized Scope."}</p>
        )}
        <Btn onClick={() => go("notifications")}>View All Notifications</Btn>
      </div>,
    );
  function authSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (authMode === "Forgot Password") {
      setRecoveryStage("code");
      setRecoveryNotice("If an eligible account matches those details, a recovery code will be sent through the selected channel.");
      setAuthState("verification");
      return;
    }
    if (authMode === "Create Account") {
      if (!signupClientReady) {
        setAuthState("invalid");
        return;
      }
      setAuthState("verification");
      return;
    }
    setAuthState("loading");
    window.setTimeout(() => setAuthState("network-failure"), 700);
  }
  const authMessages: Record<string, string> = {
    loading: "Signing in… Please keep this window open.",
    invalid:
      "The email, username, or password was not accepted. Check your details and try again.",
    "provider-unavailable":
      "This identity provider is unavailable. Use another enabled sign-in method.",
    "network-failure":
      "The authentication service connection is unavailable. Your credentials were not sent or stored.",
    "session-failure":
      "Your session could not be established. Please return to sign-in.",
    restricted:
      "This account is restricted. Contact an authorized Daenem administrator.",
    verification:
      "Verification is ready for the server-issued challenge. No email, SMS or code has been sent from this interface.",
    "temporary-password":
      "Change your temporary password before continuing.",
    success:
      "Authentication continuation is ready. A production session has not been created from this interface.",
  };
  const showAuth = route === "signin";
  useEffect(() => {
    if (!initialized) return;
    document.title = showAuth
      ? "Daenem Farms Portal | Sign In"
      : `${current?.title || "Workspace"} | Daenem Farms Portal`;
  }, [initialized, showAuth, current?.title]);
  useEffect(() => {
    if (!initialized || showAuth) return;
    if (resolvedRoute && resolvedRoute !== route) {
      setRoute(resolvedRoute);
      history.replaceState(null, "", "#/" + resolvedRoute);
      return;
    }
    if (!current) {
      const fallback = allowed[0]?.id;
      if (fallback) {
        setRoute(fallback);
        history.replaceState(null, "", "#/" + fallback);
      } else {
        setRoute("account");
        history.replaceState(null, "", "#/account");
      }
    }
  }, [initialized, personId, route, current, resolvedRoute, showAuth]);

  useEffect(() => {
    type ToolContext = {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean };
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ToolContext })
      .modelContext;
    if (!initialized || route === "signin" || !context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ToolContext["registerTool"]>[0]) => {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: "read_authorized_workspaces",
      title: "Read Authorized Workspaces",
      description:
        "List the workspaces available in the current fictional review persona and the visible destination. Does not read production information.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        preview: true,
        current: current?.id || "unavailable",
        workspaces: allowed.map((p) => ({ id: p.id, title: p.title })),
      }),
    });
    register({
      name: "open_authorized_workspace",
      title: "Open Authorized Workspace",
      description:
        "Navigate to an available design workspace using the same permission filter as the visible navigation. Does not create records or authenticate.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: unknown) => {
        if (
          !input ||
          typeof input !== "object" ||
          !("id" in input) ||
          typeof input.id !== "string" ||
          Object.keys(input).some((k) => k !== "id") ||
          !canPage(person, input.id)
        )
          throw new Error("Workspace unavailable in the current scope");
        const id = input.id;
        go(id);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return { preview: true, opened: id };
      },
    });
    return () => lifecycle.abort();
  }, [initialized, personId, route, roleRevision]);
  // The default public route is deterministic, so render Sign-In immediately.
  // Authenticated hash routes still retain the loading guard while client state resolves.
  if (!initialized && route !== "signin")
    return (
      <main className="state-surface" aria-busy="true">
        <Loading />
      </main>
    );
  if (showAuth)
    return (
      <>
        <a href="#main-content" className="skip-link">
          Skip To Content
        </a>
        <CanonicalProductionSignIn />
      </>
    );
  if (!showAuth && !canRenderPortalShell(person))
    return (
      <main className="state-surface">
        <h1>Account Access Unavailable</h1>
        <p>Your authenticated account cannot open this workspace.</p>
        <Btn onClick={logout}>Sign Out</Btn>
      </main>
    );
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip To Content
      </a>
      {!showAuth && reviewMode && <div className="review-strip" data-review-environment="workspace" aria-label="Review environment status">
        <span className="review-safety-copy">
          <span className="sample-tag">DESIGN PREVIEW</span>
          <span>Sample / design data only</span>
          <span>Production authentication and backend are not connected</span>
          <span className="review-persona">{person.label}</span>
        </span>
        {deploymentMetadata.workerVersionId && (
          <span className="signin-last-publish">
            {deploymentMetadata.releaseLabel} · STAGING · Pushed{" "}
            {formatDeploymentTime(
              deploymentMetadata.workerVersionCreatedAtUtc)}
          </span>
        )}
        <span className="row">
          {has(person, "review.manage") && (
            <a className="review-hub-link" href="/review">
              Review Hub
            </a>
          )}
          {has(person, "appearance.view") && (
            <button
              aria-label="Toggle day and night"
              onClick={() =>
                setColorMode(colorMode === "daylight" ? "dark" : "daylight")
              }
            >
              {colorMode === "daylight" ? "Dark" : "Daylight"}
            </button>
          )}
          {has(person, "review.manage") && (
            <button onClick={() => setReview(true)}>Review Controls</button>
          )}
        </span>
      </div>}
      {showAuth ? (
        <>
          <main
            id="main-content"
            className="signin signin-experience auth-v24"
            data-auth-mode={authMode.toLowerCase().replaceAll(" ", "-")}
          >
            <section
              className="signin-visual"
              aria-label="Conceptual Nigerian poultry farm"
            >
              <img
                key={authBackgrounds[backgroundIndex].id}
                className="farm-scene"
                src={authBackgrounds[backgroundIndex].image}
                srcSet={authBackgrounds[backgroundIndex].srcSet}
                sizes="100vw"
                width="1672"
                height="941"
                alt={`Conceptual Daenem Farms campus with a branded facility and agricultural monitoring drone, background ${backgroundIndex + 1} of ${authBackgrounds.length}`}
                fetchPriority="high"
                decoding="async"
              />
            </section>
            <div className="signin-composition">
            <header className="signin-masthead">
              <div className="auth-v24-brand" aria-label="Daenem Farms">
                <span className="auth-v24-brand-mark" aria-hidden="true"><Leaf /></span>
                <span><strong>DAENEM FARMS</strong><small>FOOD · PEOPLE · A BRIGHTER TOMORROW</small></span>
              </div>
              <div className="visual-utilities">
                <span className="location-tag">
                  <MapPin size={15} /> {farmConfiguration.name}
                </span>
                <button
                  className="signin-clock-launch"
                  aria-label="Open Global Operations Clock"
                  onClick={() =>
                    detail(
                      "Global Operations Center",
                      <Suspense fallback={<Loading route="world-clock" />}>
                        <GlobalOperations />
                      </Suspense>,
                    )
                  }
                >
                  <Globe size={15} /> <span>7 clocks</span>
                </button>
              </div>
            </header>
            <section className="signin-story" aria-labelledby="signin-story-title">
              <span className="eyebrow">Technology That Transforms Tomorrow</span>
              <h1 id="signin-story-title">
                Modern Agriculture.
                <br />
                <em>Naturally Better.</em>
              </h1>
              <p>
                Your people, your operations, your progress.
                <br />
                One connected Daenem Farms workspace.
              </p>
              <p className="scene-note">
                Conceptual farm artwork · Not a photograph of completed facilities
              </p>
            </section>
            <PublicSignInCockpit placement="adaptive" mode={colorMode} onModeChange={setColorMode} />
            <nav className="auth-v24-background-controls" aria-label="Farm background controls">
              <button type="button" aria-label="Previous farm background" onClick={() => setBackgroundIndex((index) => (index + authBackgrounds.length - 1) % authBackgrounds.length)}><ChevronLeft /></button>
              <span role="status" aria-live="polite">{authBackgrounds.map((background, index) => <button type="button" key={background.id} aria-label={`Show farm background ${index + 1}`} aria-current={backgroundIndex === index ? "true" : undefined} onClick={() => setBackgroundIndex(index)} />)}</span>
              <button type="button" aria-label={backgroundPaused ? "Resume automatic farm background rotation" : "Pause automatic farm background rotation"} aria-pressed={backgroundPaused} onClick={() => setBackgroundPaused((value) => !value)}>{backgroundPaused ? <Play /> : <Pause />}</button>
              <button type="button" aria-label="Next farm background" onClick={() => setBackgroundIndex((index) => (index + 1) % authBackgrounds.length)}><ChevronRight /></button>
            </nav>
            <section className="signin-auth">
              <div className="auth-top">
                <span className="row">
                  <Shield size={20} /> <span><b>Secure Access</b><small>Your Data. Our Priority.</small></span>
                </span>
              </div>
              <div className="auth-mobile-brand">
                <Brand />
              </div>
              <div className="auth-content">
                <span className="eyebrow">
                  {authMode === "Forgot Password"
                    ? "SECURE ACCOUNT RECOVERY"
                    : authMode === "Create Account"
                      ? "CREATE YOUR ACCOUNT"
                      : "WELCOME TO YOUR WORKSPACE"}
                </span>
                <h2>
                  {authMode === "Forgot Password"
                    ? "Recover Your Access."
                    : authMode === "Create Account"
                      ? "Join Daenem Farms."
                      : "Welcome Back."}
                </h2>
                <p>
                  {authMode === "Forgot Password"
                    ? "Start securely without revealing whether an account exists."
                    : authMode === "Create Account"
                      ? "Be part of a smarter, more sustainable future."
                      : "Secure Access To Your Data. Our Priority."}
                </p>
                <div className="auth-tabs" role="tablist" aria-label="Authentication method">
                  {[['Employee Sign-In', 'Sign In'], ['Create Account', 'Create Account']].map(([value, label]) => <button
                    key={value} type="button" role="tab" aria-selected={authMode === value}
                    data-state={authMode === value ? "active" : "inactive"}
                    onClick={() => {
                    setAuthMode(value);
                    setAuthState("default");
                    setSignupStep(1);
                    setSignup({
                      fullName: "", email: "", phone: "", username: "", employeeId: "",
                      department: "", verificationChannel: "email", password: "", confirmPassword: "",
                    });
                    setRecoveryStage("start");
                    setRecoveryNotice("");
                    setAcceptedTerms(false);
                  }}>{label}</button>)}
                </div>
                {authState !== "default" && authState !== "verification" && (
                  <div id="signin-auth-message"
                    className={`auth-state ${authState === "success" ? "success" : ""}`}
                    role={authState === "loading" || authState === "success" ? "status" : "alert"}
                    aria-live="polite"
                    style={{ marginBottom: 17 }}
                  >
                    {authMessages[authState]}
                    {authState === "success" && (
                      <Btn
                        primary
                        className="mt"
                        onClick={() => go("dashboard")}
                      >
                        Continue To Portal <ArrowRight size={17} />
                      </Btn>
                    )}
                  </div>
                )}
                {authState === "verification" ? (
                  authMode === "Forgot Password" ? (
                    <div className="recovery-flow" data-recovery-stage={recoveryStage}>
                      {recoveryStage === "code" && <>
                        <div className="auth-state success" role="status" aria-live="polite">
                          {recoveryNotice || "If an eligible account matches those details, a recovery code will be sent. This response does not confirm account existence."}
                        </div>
                        <label className="field">
                          Recovery Code
                          <InputOTP maxLength={6} aria-label="Six-digit recovery code">
                            <InputOTPGroup>{[0,1,2,3,4,5].map((i) => <InputOTPSlot index={i} key={i} />)}</InputOTPGroup>
                          </InputOTP>
                        </label>
                        <Btn primary onClick={() => { setRecoveryStage("new-password"); setRecoveryNotice(""); }}>
                          Verify Code <ArrowRight size={17} />
                        </Btn>
                        <div className="recovery-actions">
                          <button type="button" onClick={() => setRecoveryNotice("That code is invalid. Check the six digits and try again.")}>Invalid Code</button>
                          <button type="button" onClick={() => setRecoveryNotice("That code has expired. Request a new code to continue.")}>Expired Code</button>
                          <button type="button" onClick={() => setRecoveryNotice("A new code can be requested after the security timer. Repeated attempts may be rate-limited.")}>Resend Code</button>
                          <button type="button" onClick={() => setRecoveryNotice("Too many attempts. Recovery is temporarily rate-limited; try again later.")}>Rate-Limited State</button>
                        </div>
                      </>}
                      {recoveryStage === "new-password" && <>
                        <div className="auth-state">Code accepted for this experience state. Final verification remains server-authoritative.</div>
                        <label className="field">New Password
                          <input type={showPassword ? "text" : "password"} autoComplete="new-password"
                            minLength={6} pattern="(?=.*[A-Za-z])(?=.*\d).{6,}" required
                            aria-describedby="reset-password-policy" placeholder="6+ characters, letter and number" />
                          <span id="reset-password-policy" className="validation-message">Minimum 6 characters with a letter and a number.</span>
                        </label>
                        <label className="field">Confirm New Password
                          <input type={showPassword ? "text" : "password"} autoComplete="new-password"
                            minLength={6} required placeholder="Re-enter your password" />
                        </label>
                        <label className="remember"><Checkbox checked={showPassword} onCheckedChange={(value) => setShowPassword(value === true)} />Show passwords</label>
                        <Btn primary onClick={() => setRecoveryStage("success")}>Reset Password <ArrowRight size={17} /></Btn>
                        <button type="button" className="link-button" onClick={() => setRecoveryNotice("The password could not be reset. Request a new recovery code and try again.")}>Show Failure State</button>
                      </>}
                      {recoveryStage === "success" && <div className="recovery-success">
                        <ShieldCheck /><h3>Password Reset Complete</h3>
                        <p>Your password has been updated in this experience state. A connected backend must confirm the production result.</p>
                        <Btn primary onClick={() => { setAuthMode("Employee Sign-In"); setAuthState("default"); setRecoveryStage("start"); }}>Return To Sign In</Btn>
                      </div>}
                      {recoveryStage !== "success" && <button className="link-button" type="button"
                        onClick={() => { setAuthMode("Employee Sign-In"); setAuthState("default"); setRecoveryStage("start"); }}>
                        Return To Sign In
                      </button>}
                    </div>
                  ) : (
                    <div className="signup-verification-state">
                      <ShieldCheck />
                      <h3>Verify Your Contact Channel</h3>
                      <p>No code has been sent. The connected server must issue and validate the challenge.</p>
                      <label className="field">Verification Code
                        <InputOTP maxLength={6} aria-label="Six-digit verification code">
                          <InputOTPGroup>{[0,1,2,3,4,5].map((i) => <InputOTPSlot index={i} key={i} />)}</InputOTPGroup>
                        </InputOTP>
                      </label>
                      <div className="provisional-contract">
                        <strong>After verification</strong>
                        <span>Awaiting Approval · 48-hour default review window</span>
                        <span>Approval and role assignment are separate</span>
                        <span>Expired requests may receive an authorized extension, up to 168 hours per action</span>
                        <span>Approved + No Role and multiple-role outcomes remain supported</span>
                      </div>
                      <Btn primary disabled>Verify & Submit For Review</Btn>
                      <button className="link-button" type="button" onClick={() => { setAuthState("default"); setSignupStep(2); }}>Back To Account Details</button>
                    </div>
                  )
                ) : (
                  <form className="auth-form" onSubmit={authSubmit}>
                    {authMode === "Employee Sign-In" && (
                      <label className="field">
                        Email Or Username
                        <input
                          name="identity"
                          autoComplete="username"
                          type="text"
                          aria-describedby={authState !== "default" ? "signin-auth-message" : undefined}
                          placeholder="you@daenem.com"
                          required
                        />
                      </label>
                    )}
                    {authMode === "Forgot Password" && (
                      <>
                        <label className="field">
                          Username Or Email
                          <input name="identity" autoComplete="username" type="text" placeholder="Your username or email" required />
                          <span className="validation-message">The response will not disclose whether an account exists.</span>
                        </label>
                        <fieldset className="verification-channel">
                          <legend>Preferred Recovery Channel</legend>
                          <label><input type="radio" name="recoveryChannel" value="email"
                            checked={signup.verificationChannel === "email"}
                            onChange={() => setSignup((current) => ({ ...current, verificationChannel: "email" }))} /> Email</label>
                          <label><input type="radio" name="recoveryChannel" value="sms"
                            checked={signup.verificationChannel === "sms"}
                            onChange={() => setSignup((current) => ({ ...current, verificationChannel: "sms" }))} /> SMS</label>
                        </fieldset>
                      </>
                    )}
                    {authMode === "Create Account" && (
                      <div className="signup-validation-grid auth-v24-signup-grid">
                        <label className="field auth-v24-wide-field">
                          Full Name
                          <input name="fullName" autoComplete="name" value={signup.fullName}
                            onChange={(event) => setSignup((current) => ({ ...current, fullName: event.target.value }))}
                            placeholder="Your full name" required />
                        </label>
                        <label className="field auth-v24-wide-field">
                          Email Address
                          <input name="email" autoComplete="email" type="email" value={signup.email} onChange={(event) => setSignup((current) => ({ ...current, email: event.target.value }))} aria-describedby="email-validation" placeholder="you@daenem.com" required />
                          <span id="email-validation" className={`validation-message ${emailUsability}`} role="status">
                            {!signup.email ? "Enter a valid email address." : emailUsability === "invalid-format" ? "Enter a complete email address." : emailUsability === "checking" ? "Checking format…" : "Format Valid · Server Usability Check Required"}
                          </span>
                        </label>
                        <label className="field auth-v24-wide-field">
                          Username
                          <input name="username" autoComplete="username" value={signup.username} onChange={(event) => setSignup((current) => ({ ...current, username: event.target.value }))} aria-describedby="username-validation" placeholder="your.username" required />
                          <span id="username-validation" className={`validation-message ${usernameUsability}`} role="status">
                            {!signup.username ? "3–32 characters. Start with a letter." : usernameUsability === "invalid-format" ? "Use letters, numbers, periods, underscores, or hyphens." : usernameUsability === "checking" ? "Checking format…" : "Format Valid · Server Usability Check Required"}
                          </span>
                        </label>
                        <label className="field auth-v24-wide-field">
                          Phone Number
                          <input name="phone" autoComplete="tel" type="tel" value={signup.phone}
                            onChange={(event) => setSignup((current) => ({ ...current, phone: event.target.value }))}
                            aria-describedby="phone-validation" placeholder="+234 …" required />
                          <span id="phone-validation" className="validation-message" role="status">
                            {!signup.phone ? "Used only for an approved verification channel." : /^[+()\d\s-]{7,20}$/.test(signup.phone) ? "Phone format valid · final validation is server-authoritative." : "Enter a valid phone format."}
                          </span>
                        </label>
                        <label className="field">
                          Password
                          <div className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={signup.password} onChange={(event) => setSignup((current) => ({ ...current, password: event.target.value }))} aria-describedby="password-validation" placeholder="Minimum 6 characters" required minLength={6} /><button type="button" className="btn icon-btn ghost" aria-label={showPassword ? "Hide Password" : "Show Password"} aria-pressed={showPassword} onMouseDown={(event) => event.preventDefault()} onClick={() => setShowPassword((value) => !value)}><Eye className={`password-eye ${showPassword ? "is-hidden" : ""}`} size={18} aria-hidden="true"/><EyeOff className={`password-eye password-eye-off ${showPassword ? "is-visible" : ""}`} size={18} aria-hidden="true"/></button></div>
                          <span id="password-validation" className={`validation-message ${signup.password ? passwordPolicyValid ? "valid" : "invalid-format" : "idle"}`} role="status">{!signup.password ? "6+ characters, a letter and a number." : passwordPolicyValid ? "Password policy met" : `Add ${missingPasswordRules.join(", ").replace(/, ([^,]*)$/, " and $1")}.`}</span>
                        </label>
                        <label className="field">
                          Confirm Password
                          <div className="password-field"><input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" value={signup.confirmPassword} onChange={(event) => setSignup((current) => ({ ...current, confirmPassword: event.target.value }))} aria-describedby="confirm-password-validation" placeholder="Re-enter password" required minLength={6}/><button type="button" className="btn icon-btn ghost" aria-label={showPassword ? "Hide Confirmed Password" : "Show Confirmed Password"} aria-pressed={showPassword} onMouseDown={(event) => event.preventDefault()} onClick={() => setShowPassword((value) => !value)}><Eye className={`password-eye ${showPassword ? "is-hidden" : ""}`} size={18} aria-hidden="true"/><EyeOff className={`password-eye password-eye-off ${showPassword ? "is-visible" : ""}`} size={18} aria-hidden="true"/></button></div>
                          <span id="confirm-password-validation" className={`validation-message ${signup.confirmPassword ? passwordsMatch ? "valid" : "invalid-format" : "idle"}`} role="status">{!signup.confirmPassword ? "Confirmation required" : passwordsMatch ? "Passwords Match" : "Passwords Do Not Match"}</span>
                        </label>
                        <div className="auth-v24-password-policy" aria-label="Password policy"><strong>Password must contain</strong><span data-met={passwordPolicy.length}>6 or more characters</span><span data-met={passwordPolicy.letter}>At least one letter</span><span data-met={passwordPolicy.number}>At least one number</span></div>
                        <details className="auth-v24-employment-fields">
                          <summary>Employment details, if already issued</summary>
                          <div>
                            <label className="field">Employee ID<input name="employeeId" value={signup.employeeId} onChange={(event) => setSignup((current) => ({ ...current, employeeId: event.target.value }))} placeholder="Optional employee reference" /></label>
                            <label className="field">Department / Unit<select name="department" value={signup.department} onChange={(event) => setSignup((current) => ({ ...current, department: event.target.value }))}><option value="">To be assigned</option><option>Farm Operations</option><option>Administration</option><option>Finance</option><option>People & Culture</option><option>Other / To Be Assigned</option></select></label>
                            <fieldset className="verification-channel"><legend>Verification Channel</legend><label><input type="radio" name="verificationChannel" value="email" checked={signup.verificationChannel === "email"} onChange={() => setSignup((current) => ({ ...current, verificationChannel: "email" }))} /> Email</label><label><input type="radio" name="verificationChannel" value="sms" checked={signup.verificationChannel === "sms"} onChange={() => setSignup((current) => ({ ...current, verificationChannel: "sms" }))} /> SMS</label></fieldset>
                          </div>
                        </details>
                        <div className="provisional-contract auth-v24-provisional">
                          <strong>Provisional account review</strong>
                          <span>Awaiting Approval · 48-hour default review window</span>
                          <span>Approval and role assignment remain separate</span>
                          <span>Authorized extensions may be granted; expiry does not permanently destroy the request</span>
                        </div>
                        <label className="terms-check auth-v24-wide-field">
                          <Checkbox checked={acceptedTerms} onCheckedChange={(value) => setAcceptedTerms(value === true)} />
                          <span>I agree to the applicable <button type="button" onClick={() => detail("Terms & Conditions", <p>Approved Daenem terms remain authoritative and must be supplied by the connected Portal.</p>)}>Terms & Conditions</button> and acknowledge the <button type="button" onClick={() => detail("Privacy Policy", <p>The approved Daenem privacy policy remains authoritative.</p>)}>Privacy Policy</button>.</span>
                        </label>
                      </div>
                    )}
                    {authMode === "Employee Sign-In" && (
                      <label className="field">
                        {authState === "temporary-password" ? "New Password" : "Password"}
                        <div className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={authState === "temporary-password" ? "new-password" : "current-password"} aria-describedby={authState === "temporary-password" ? "temporary-password-policy" : authState !== "default" ? "signin-auth-message" : undefined} placeholder="Enter your password" required minLength={authState === "temporary-password" ? 6 : 1} pattern={authState === "temporary-password" ? "(?=.*[A-Za-z])(?=.*\\d).{6,}" : undefined}/><button type="button" className="btn icon-btn ghost" aria-label={showPassword ? "Hide Password" : "Show Password"} aria-pressed={showPassword} onMouseDown={(event) => event.preventDefault()} onClick={() => setShowPassword((value) => !value)}><Eye className={`password-eye ${showPassword ? "is-hidden" : ""}`} size={18} aria-hidden="true"/><EyeOff className={`password-eye password-eye-off ${showPassword ? "is-visible" : ""}`} size={18} aria-hidden="true"/></button></div>
                        {authState === "temporary-password" && <span id="temporary-password-policy" className="validation-message" role="status">Use 6 or more characters with a letter and a number.</span>}
                      </label>
                    )}
                    {authMode === "Employee Sign-In" && (
                      <div className="row between wrap">
                        <label className="remember">
                          <Checkbox
                            checked={remember}
                            onCheckedChange={(v) => setRemember(v === true)}
                          />
                          Remember Me
                        </label>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            setAuthMode("Forgot Password");
                            setAuthState("default");
                          }}
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}
                    <Btn
                      type="submit"
                      primary
                      disabled={authState === "loading" || (authMode === "Create Account" && !signupClientReady)}
                    >
                      {authState === "loading" ? (
                        <LoaderCircle className="loading-spin" size={18} />
                      ) : (
                        <>
                          {authMode === "Employee Sign-In"
                            ? "Sign In"
                            : authMode === "Create Account"
                              ? "Create Account"
                              : "Send Recovery Code"}
                          <ArrowRight size={18} />
                        </>
                      )}
                    </Btn>
                    {authMode === "Forgot Password" && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setAuthMode("Employee Sign-In")}
                      >
                        Back To Sign-In
                      </button>
                    )}
                  </form>
                )}
                {authMode !== "Forgot Password" && (
                  <>
                    <div className="auth-separator">Or Continue With</div>
                    <div className="provider-row">
                      {["Google", "Microsoft"].map((providerName) => (
                        <button
                          type="button"
                          key={providerName}
                          className="provider-button"
                          disabled={provider === "unavailable" || authState === "provider-unavailable"}
                          aria-describedby={`${providerName.toLowerCase()}-provider-state`}
                        >
                          <img
                            src={
                              providerName === "Google"
                                ? "/assets/google.png"
                                : "/assets/microsoft.svg"
                            }
                            alt=""
                          />
                          <span>Continue With {providerName}</span>
                          <small id={`${providerName.toLowerCase()}-provider-state`}>Not Configured</small>
                        </button>
                      ))}
                    </div>
                    <p className="auth-hint" role="status">Provider entry points are retained and disabled until configuration is verified.</p>
                  </>
                )}
              </div>
              <div className="auth-footer-disclosure">
                <div className="auth-footer">
                <button
                  onClick={() =>
                    detail(
                      "Terms & Conditions",
                      <p>
                        Approved Daenem terms must be linked from the authoritative
                        Portal. Legal content is not duplicated or invented here.
                      </p>,
                    )
                  }
                >
                  Terms & Conditions
                </button>
                <button
                  onClick={() =>
                    detail(
                      "Privacy Policy",
                      <p>
                        The existing approved Daenem privacy policy remains
                        authoritative. This interface does not persist credentials.
                      </p>,
                    )
                  }
                >
                  Privacy Policy
                </button>
                <button
                  onClick={() =>
                    detail(
                      "Install App",
                      <div className="stack">
                        <Download />
                        <h3>Installation Is Not Available</h3>
                        <p>
                          Installation requires the existing Daenem PWA event and
                          service worker. Neither is connected to this interface.
                        </p>
                      </div>,
                    )
                  }
                >
                  Install App
                </button>
                </div>
              </div>
            </section>
            </div>
          </main>
        </>
      ) : (
        <SidebarProvider
          open={sidebarOpen}
          onOpenChange={(open) => {
            setSidebarOpen(open);
            writeSidebarOpen(sidebarWidthKey, open);
          }}
          style={
            {
              "--sidebar-width": "280px",
              "--sidebar-width-icon": "78px",
            } as React.CSSProperties
          }
        >
          <div className={`shell ${shellStyles.premiumShell} ${routeStyles.routeSurfaces}`} data-experience="post-login-premium">
            <Navigation person={person} route={route} go={go} logout={logout} roleRevision={roleRevision} onHelp={has(person, "help.view") ? openHelp : undefined} />
            <div className={`workspace ${shellStyles.workspace}`}>
              <header className={`topbar ${shellStyles.topbar}`}>
                <div className="row">
                  <SidebarTrigger
                    aria-label="Toggle Navigation"
                    className="btn icon-btn ghost"
                  />
                  <div className="topbar-context">
                    <span>{farmConfiguration.name} · {farmScopeLabel}</span>
                    <strong>{current?.title || "Workspace"}</strong>
                  </div>
                </div>
                <span className={`mobile-only topbar-mobile-title ${shellStyles.mobileBrand}`}><img src="/assets/approved/daenem-logo-480.webp" width="1320" height="800" alt="Daenem Farms" /></span>
                {has(person, "search.view") && (
                  <button
                    ref={commandTriggerRef}
                    className={`search-launch ${shellStyles.searchLauncher}`}
                    onClick={openCommand}
                    aria-label="Search Your Workspace"
                  >
                    <Search className={shellStyles.mobileSearchIcon} size={18} aria-hidden="true" />
                    <span className="search-orb" />
                    <span>Search Your Workspace</span>
                    <kbd>⌘ K</kbd>
                  </button>
                )}
                <div className="row topbar-tools">
                  <WorkspaceSystemMenu
                    person={person}
                    releaseLabel={deploymentMetadata.releaseLabel}
                    onRelease={release}
                    onSync={() => detail("Sync & Connectivity", <Suspense fallback={<Loading route="sync" />}><SyncDesk /></Suspense>)}
                    onWeather={() => detail("Weather", <Suspense fallback={<Loading route="weather" />}><DashboardWeather /></Suspense>)}
                  />
                  {canPage(person, "notifications") && (
                    <button
                      className="btn icon-btn ghost notify-trigger"
                      aria-label={notificationsUnavailable ? "Notifications, Live Updates Unavailable" : `Notifications, ${notices.filter((n) => !n.read).length} unread`}
                      onClick={openNotificationPanel}
                    >
                      <Bell className="icon" />
                      {notices.some((n) => !n.read) && (
                        <span className="badge-count">
                          {notices.filter((n) => !n.read).length}
                        </span>
                      )}
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="top-account" aria-label="Account Menu">
                        <span className="avatar">{person.initials}</span>
                        <span className="name">
                          {person.name}
                          <small>{person.job}</small>
                        </span>
                        <ChevronDown size={14} className="desktop-only" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={`min-w-56 ${shellStyles.workspaceMenu}`} data-chrome="protected">
                      {canPage(person, "profile") && (
                        <DropdownMenuItem onSelect={() => go("profile")}>
                          <UserRound />
                          My Profile
                        </DropdownMenuItem>
                      )}
                      {has(person, "appearance.view") && (
                        <DropdownMenuItem
                          onSelect={() =>
                            detail(
                              "Appearance",
                              <Appearance
                                theme={theme}
                                setTheme={setTheme}
                                reduced={reduced}
                                setReduced={setReduced}
                              />,
                            )
                          }
                        >
                          <Sun />
                          Appearance
                        </DropdownMenuItem>
                      )}
                      {has(person, "install.view") && (
                        <DropdownMenuItem onSelect={() => detail("Install Daenem ERP App", <div className="stack"><Download /><h3>Installation unavailable</h3><p>This review has no service worker. No installation or push permission has been requested.</p></div>)}>
                          <Download />
                          Install Daenem ERP App
                        </DropdownMenuItem>
                      )}
                      {has(person, "help.view") && (
                        <DropdownMenuItem onSelect={openHelp}>
                          <HelpCircle />
                          Help & Support
                        </DropdownMenuItem>
                      )}
                      {has(person, "release.view") && (
                        <DropdownMenuItem onSelect={release}>
                          <Info />
                          Version & Release
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={logout}>
                        <LogOut />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>
              <main
                id="main-content"
                className={`workspace-content ${shellStyles.content}`}
                data-workspace={route}
              >
                {current && <WorkspaceBreadcrumb person={person} page={current} go={go} />}
                {current && route !== "completion-center" && (
                  <WorkspaceToolbar
                    person={person}
                    page={current}
                    go={go}
                    onSearch={openCommand}
                    onHelp={openHelp}
                    onPrimary={() => action(current)}
                    period={(["finance", "feed"].includes(route) || (route === "dashboard" && !isOwnerPrincipal(person))) ? period : undefined}
                    onPeriodChange={setPeriod}
                  />
                )}
                {current && route !== "completion-center" && (
                  <PageContextHeader
                    page={current}
                    person={person}
                    period={(["finance", "feed"].includes(route) || (route === "dashboard" && !isOwnerPrincipal(person))) ? period : undefined}
                    onPeriodChange={setPeriod}
                    onHelp={openHelp}
                    onPrimary={() => action(current)}
                    onSearch={openCommand}
                    showActions={false}
                  />
                )}
                {current && route !== "completion-center" && current.authority !== "existing" && (
                  <div className="page-lab-note">
                    {current.authority === "development"
                      ? "Development contract · Design exploration; integration is not approved."
                      : "Contract mapping pending · Design exploration."}
                  </div>
                )}
                {!current ? (
                  <div className="state-surface">
                    <h2>Welcome</h2>
                    <Btn onClick={logout}>Sign Out</Btn>
                  </div>
                ) : state === "permission-denied" ||
                  state === "unauthorized-farm" ? (
                  <div className="state-surface">
                    <Btn onClick={() => go(allowed[0]?.id || "account")}>
                      Continue
                    </Btn>
                  </div>
                ) : state === "loading" ? (
                  <Loading route={route} />
                ) : state === "session-expired" ? (
                  <div className="state-surface">
                    <LockKeyhole />
                    <h2>Your Session Has Expired</h2>
                    <p>
                      Sign in again to continue. Your workspace data is hidden.
                    </p>
                    <Btn primary onClick={logout}>
                      Return To Sign-In
                    </Btn>
                  </div>
                ) : [
                    "empty",
                    "offline",
                    "provider-unavailable",
                    "api-error",
                    "sync-failure",
                  ].includes(state) ? (
                  <Empty
                    title={
                      {
                        empty: "No Records Yet",
                        offline: "You’re Offline",
                        "provider-unavailable": "Provider Unavailable",
                        "api-error": "Unable To Load This Workspace",
                        "sync-failure": "Synchronization Needs Attention",
                      }[state]!
                    }
                    detail="This is a reviewable state preview. Sample records are hidden; no stale values are presented as current."
                    icon={state === "offline" ? <WifiOff /> : <CloudOff />}
                  />
                ) : (
                  <>
                    {state !== "ready" && (
                      <div
                        className="auth-state"
                        role="status"
                        style={{ marginBottom: 22 }}
                      >
                        {state === "partial"
                          ? "Partial Data — Some sample information could not be loaded."
                          : state === "stale"
                            ? "Stale Data — The following sample snapshot is not current."
                            : state === "syncing"
                              ? "Syncing — Sample changes are awaiting confirmation."
                              : state === "success"
                                ? "Success — The sample interaction completed."
                                : "Validation Failure — Review the highlighted information before continuing."}
                      </div>
                    )}
                    {["finance", "settings"].includes(route) &&
                      canPage(person, "communication") && (
                        <div className="cc-notice row wrap">
                          <Btn onClick={() => go("communication")}>
                            Customer Communication
                          </Btn>
                          {has(person, "communication.settings.manage") && (
                            <Btn onClick={() => go("comm-settings")}>
                              Communication Settings
                            </Btn>
                          )}
                          <small>
                            Authorized customer history and reviewed drafts.
                            Ledger values remain unchanged.
                          </small>
                        </div>
                      )}
                    {route === "dashboard" && (
                      <section className="foundation-home-composition" aria-label="FarmPortal intelligent Home">
                        <div id="foundation-home-today">
                          <HomeCommandExperience {...props} />
                        </div>
                      </section>
                    )}
                    {(["operations", "inventory", "finance"] as const).some((candidate) => candidate === route) && (
                      <ModuleCommandSummary route={route as "operations" | "inventory" | "finance"} person={person} go={go} />
                    )}
                    <Suspense fallback={<Loading route={route} />}>
                      {route === "operations" && <OperationsFirstView person={person} go={go} authorityStamp={principal?.securityStamp || ""}
                        sessionChecking={analyticsSessionChecking} sessionTimedOut={analyticsSessionTimedOut}
                        onSessionRetry={onAnalyticsSessionRetry}/>}
                      {entityAccessRoutes.includes(route) && !["banking", "payroll-admin"].includes(route) && <EntityAccessWorkspace route={route} person={person}/>}
                      {route === "payroll-admin" && has(person, "payroll.view") && <PayrollCommandCenter person={person} fixture/>}
                      {representativeGridRoutes.includes(route) && (
                        <ModuleDataGrid route={route} person={person}/>
                      )}
                      {constructionRoutes.includes(route as (typeof constructionRoutes)[number]) ? (
                        <ConstructionIntelligence {...props} />
                      ) : importRoutes.includes(route as (typeof importRoutes)[number]) ? (
                        <DataImportCenter {...props} />
                      ) : route === "completion-center" ? (
                        <ImplementationCompletionCenter />
                      ) : route === "banking" ? (
                        <TreasuryDesk person={person} />
                      ) : route === "market" ? (
                        <MarketIntelligence />
                      ) : route === "letterhead-studio" ? (
                        <LetterheadStudio person={person} />
                      ) : route === "table-studio" ? (
                        <TableStudio person={person} />
                      ) : route === "form-studio" ? (
                        <SmartForms person={person} />
                      ) : [
                          "pigs",
                          "goats",
                          "snails",
                          "manufacturing",
                          "organic",
                          "suppliers",
                          "sales",
                          "assets",
                          "infrastructure",
                          "logistics",
                          "fleet",
                          "biosecurity",
                          "files",
                          "field-admin",
                          "maker-checker",
                          "workflow",
                          "analytics",
                          "chart-library",
                          "ai-assistant",
                        ].includes(route) ? (
                        <>
                          {isSpecialistPulseRoute(route) && (
                            <SpecialistModulePulse route={route} allowed={allowed} go={go} />
                          )}
                          {isSystemPulseRoute(route) && (
                            <SpecialistModulePulse route={route} allowed={allowed} go={go} />
                          )}
                          {route === "files"
                            ? <FilesEvidenceCentre person={person} go={go} />
                            : <MasterWorkspaces key={route + person.id} {...props} />}
                        </>
                      ) : [
                          "clock-admin",
                          "weather-lab",
                          "widget-studio",
                        ].includes(route) ? (
                        <ExperienceLabs key={person.id + route} {...props} />
                      ) : [
                          "communication",
                          "customers",
                          "comm-templates",
                          "comm-automation",
                          "comm-campaigns",
                          "comm-feedback",
                          "comm-complaints",
                          "comm-analytics",
                          "comm-settings",
                        ].includes(route) ? (
                        route === "communication" ? <CommunicationsWorkspace {...props} /> : <CommunicationCenter {...props} />
                      ) : ["rbac", "permissions"].includes(route) ? (
                        <RoleManager {...props} />
                      ) : route === "dashboard" ? null : [
                          "approval-status",
                          "signup-admin",
                          "my-expenses",
                          "hatchery",
                          "procurement",
                          "themes",
                        ].includes(route) ? (
                        <GoldenPages {...props} />
                      ) : route === "daily-brief" ? (
                        <HomeCommandExperience {...props} />
                      ) : route === "owner-decisions" && isOwnerPrincipal(person) ? (
                        <OwnerHome {...props} />
                      ) : route === "executive-signals" && (isOwnerPrincipal(person) || has(person, "finance.view")) ? (
                        <ExecutiveCommandPulse person={person} go={go} />
                      ) : route === "personalized-widgets" && has(person, "widgets.manage") ? (
                        <PersonalizedWidgets person={person} go={go} />
                      ) : route === "cameras" ? (
                        <CameraEvidenceCentre person={person} go={go} />
                      ) : route === "security" ? (
                        <SecurityCentre person={person} go={go} />
                      ) : route === "breed-management" ? (
                        <BreedManagementDesk person={person} />
                      ) : route === "flock-transfers" ? (
                        <FlockTransferDesk person={person} />
                      ) : route === "production-analytics" ? (
                        <AnalyticsSessionGate
                          checking={analyticsSessionChecking}
                          timedOut={analyticsSessionTimedOut}
                          generation={analyticsSessionGeneration}
                          onTimeout={onAnalyticsSessionTimeout}
                          onRetry={onAnalyticsSessionRetry}
                        >
                          <ProductionAnalyticsDesk person={person} authorityStamp={principal?.securityStamp || ""} />
                        </AnalyticsSessionGate>
                      ) : purposeBuiltRoutes.includes(route) ? (
                        <PurposeBuiltWorkspace route={route} person={person} go={go} />
                      ) : route === "admin" && isOwnerPrincipal(person) ? (
                        <AdminCenter onExit={() => go("dashboard")} isOwner={isOwnerPrincipal(person)} />
                      ) : route === "meta-integrations" && has(person, "META_INTEGRATION_VIEW") ? (
                        <MetaProviderControlPlane />
                      ) : route === "platform-storage" && (isOwnerPrincipal(person) || has(person, "PLATFORM_STORAGE_VIEW")) ? (
                        <PlatformStorageDesk person={person} />
                      ) : route === "settings" ? (
                        <SignInPresentationControls person={person} readOnly />
                      ) : route === "after-signin-studio" ? (
                        <AfterSignInStudioFoundation go={go} />
                      ) : route === "profile" ? (
                        <Profile {...props} />
                      ) : route === "myday" ? (
                        <MyDay {...props} />
                      ) : (
                        <DomainPages {...props} />
                      )}
                      {["banking", "payroll-admin"].includes(route) && <EntityAccessWorkspace route={route} person={person}/>}
                    </Suspense>
                  </>
                )}
                <footer className="workspace-footer">
                  <span>
                    DAENEM FARMS · Technology That Transforms Tomorrow
                  </span>
                  {has(person, "release.view") && (
                    <button onClick={release}>
                      {deploymentMetadata.releaseLabel} · Pushed{" "}
                      {formatDeploymentTime(
                        deploymentMetadata.workerVersionCreatedAtUtc)}{" "}
                      · {shortReleaseCommit(deploymentMetadata.sourceCommit)}
                    </button>
                  )}
                </footer>
              </main>
            </div>
            <MobileNavigationDock person={person} route={route} go={go} />
          </div>
        </SidebarProvider>
      )}
      <Dialog
        open={command && has(person, "search.view")}
        onOpenChange={setCommand}
      >
        <DialogContent className={`command-surface ${shellStyles.workspaceDialog} ${shellStyles.commandDialog}`} data-chrome="protected" onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (commandFocusOwnerRef.current !== commandOwner) {
            commandTriggerRef.current?.focus();
            return;
          }
          const target = commandReturnFocus.current;
          if (target?.isConnected) target.focus();
          else commandTriggerRef.current?.focus();
        }}>
          <DialogTitle className="sr-only">
            Search Your Authorized Workspace
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search permitted workspaces, authenticated farm records, and review-only sample alerts.
            Use arrow keys and Enter to open a destination.
          </DialogDescription>
          <Command className={shellStyles.commandCanvas}>
            <CommandInput
              placeholder="Find a workspace, action, or guide…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No Results In Your Authorized Scope</CommandEmpty>
              <CommandGroup heading="Workspaces">
                {allowed.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.title} ${p.group}`}
                    onSelect={() => go(p.id)}
                  >
                    <PageIcon page={p} />
                    <span className="grow">{p.title}</span>
                    <small>{p.group}</small>
                  </CommandItem>
                ))}
              </CommandGroup>
              <AuthenticatedRecordCommandResults
                person={person}
                permittedPages={allowed}
                owner={commandOwner}
                roleRevision={roleRevision}
                open={command}
                query={query}
                onNavigate={go}
              />
              <CommandGroup heading="Available Actions">
                {allowed
                  .filter((p) => p.write && has(person, p.write) && p.action && livePrimaryActionPages.has(p.id))
                  .map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.action}
                      onSelect={() => {
                        setCommand(false);
                        action(p);
                      }}
                    >
                      <ArrowUpRight size={18} />
                      {p.action}
                    </CommandItem>
                  ))}
              </CommandGroup>
              {notices.length > 0 && (
                <CommandGroup heading="Authorized Sample Notifications">
                  {notices.map((n) => (
                    <CommandItem
                      key={n.id}
                      value={n.title}
                      onSelect={() => go(n.page)}
                    >
                      <Bell size={18} />
                      {n.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <p className={shellStyles.commandFootnote}>
              Permission-filtered search · AI predictions are not connected
            </p>
          </Command>
        </DialogContent>
      </Dialog>
      <Sheet open={!!panel} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent className={`sheet-content ${shellStyles.workspaceSheet}`}>
          <SheetHeader>
            <SheetTitle>{panel?.title || "Details"}</SheetTitle>
            <SheetDescription>
              {panel?.title === "Version & Release Details"
                ? "Live staging deployment information"
                : "Sample design information"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt">{panel?.body}</div>
        </SheetContent>
      </Sheet>
      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className={`modal-content ${shellStyles.workspaceDialog}`}>
          <DialogTitle>{modal?.action || "Sample Action"}</DialogTitle>
          <DialogDescription>
            Review this workflow with sample information. No production records
            will be written.
          </DialogDescription>
          {modal && (
            <ActionForm
              page={modal}
              onDone={() => {
                setModal(null);
                toast.success("Sample Draft Validated", {
                  description:
                    "No production record was created. This preview resets on refresh.",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={reviewMode && review && has(person, "review.manage")}
        onOpenChange={setReview}
      >
        <DialogContent className={`modal-content ${shellStyles.workspaceDialog} ${shellStyles.reviewDialog}`} style={{ maxWidth: 760 }}>
          <DialogTitle>Experience Review Controls</DialogTitle>
          <DialogDescription>
            Reviewer tools are outside the simulated employee experience. All
            personas and records are fictional.
          </DialogDescription>
          <div className="review-grid">
            <SelectField
              label="Validation Persona"
              value={personId}
              onChange={changePersona}
              options={personas.map((p) => ({ value: p.id, label: p.label }))}
            />
            <SelectField
              label="Workspace State"
              value={state}
              onChange={setState}
              options={stateOptions.map((s) => ({
                value: s,
                label: s.replaceAll("-", " "),
              }))}
            />
            <SelectField
              label="Authentication State"
              value={authState}
              onChange={(s) => {
                setAuthState(s);
                go("signin");
              }}
              options={authStates.map((s) => ({
                value: s,
                label: s.replaceAll("-", " "),
              }))}
            />
            <SelectField
              label="Provider Availability"
              value={provider}
              onChange={setProvider}
              options={[
                {
                  value: "available-sample",
                  label: "Available (Sample Configuration)",
                },
                { value: "unavailable", label: "Unavailable" },
              ]}
            />
            <SelectField
              label="Weather Visual"
              value={weather}
              onChange={setWeather}
              options={weatherConditions.map((s) => ({
                value: s,
                label: s.replaceAll("-", " "),
              }))}
            />
            <SelectField
              label="Weather Data State"
              value={weatherStatus}
              onChange={setWeatherStatus}
              options={[
                "live-visual-sample",
                "cached",
                "stale",
                "offline",
                "provider-unavailable",
                "permission-denied",
              ].map((s) => ({ value: s, label: s.replaceAll("-", " ") }))}
            />
            <SelectField
              label="Day / Night"
              value={dayPhase}
              onChange={setDayPhase}
              options={["day", "night"].map((s) => ({ value: s, label: s }))}
            />
            <SelectField
              label="Wind Intensity"
              value={wind}
              onChange={setWind}
              options={["calm", "breezy", "strong", "high", "severe"].map(
                (s) => ({ value: s, label: s }),
              )}
            />
          </div>
          <label className="row between">
            <span>Reduce Motion</span>
            <Switch checked={reduced} onCheckedChange={setReduced} />
          </label>
          <div className="review-note">
            This simulator tests UI composition. It does not certify server
            RBAC, live authentication, production data, weather observations, or
            unpublished development APIs. The 99% target remains subject to
            independent review and Owner acceptance.
          </div>
          <div className="row wrap">
            <Btn
              onClick={() => {
                go("signin");
                setReview(false);
              }}
            >
              Review Sign-In
            </Btn>
            <Btn
              primary
              onClick={() => {
                go(
                  personId === "no-role"
                    ? "profile"
                    : ["provisional", "expired"].includes(personId)
                      ? "approval-status"
                      : "dashboard",
                );
                setReview(false);
              }}
            >
              Review Workspace
            </Btn>
            <Btn
              onClick={() => {
                setReview(false);
                detail(
                  "Permission Evidence",
                  <PermissionEvidence person={person} />,
                );
              }}
            >
              View Persona Scope
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster richColors />
    </>
  );
}
function Appearance({
  theme,
  setTheme,
  reduced,
  setReduced,
}: {
  theme: string;
  setTheme: (s: string) => void;
  reduced: boolean;
  setReduced: (b: boolean) => void;
}) {
  return (
    <div className="stack">
      <h3>Appearance</h3>
      <p>
        Preview retained theme identities. Appearance changes only this review
        session; production assignments are not connected.
      </p>
      <div className="theme-grid">
        {themes.map(([id, title, color]) => (
          <button
            className={`theme-card ${theme === id ? "active" : ""}`}
            key={id}
            onClick={() => setTheme(id)}
            aria-pressed={theme === id}
          >
            <span className="theme-swatch" style={{ background: color }} />
            <small>{title}</small>
          </button>
        ))}
      </div>
      <label className="row between mt">
        <span>Reduce Motion</span>
        <Switch checked={reduced} onCheckedChange={setReduced} />
      </label>
      <p className="form-note">
        Appearance affects visual presentation only. No permission or record
        changes.
      </p>
    </div>
  );
}
function PermissionEvidence({ person }: { person: Persona }) {
  const visible = visiblePages(person);
  return (
    <div className="stack">
      <Chip>{person.label}</Chip>
      <p>Sample permissions and scope, not a production account.</p>
      <h3>Visible Navigation / Search</h3>
      <p>{visible.map((p) => p.title).join(", ")}</p>
      <h3>Hidden Navigation / Search</h3>
      <p>
        {pages
          .filter((p) => !canView(person, p))
          .map((p) => p.title)
          .join(", ") || "None in this sample Owner permission set"}
      </p>
      <h3>Available Actions</h3>
      <p>
        {visible
          .filter((p) => p.write && has(person, p.write))
          .map((p) => p.action)
          .filter(Boolean)
          .join(", ") || "No administrative actions"}
      </p>
      <h3>Notification Scope</h3>
      <p>
        {canPage(person, "notifications")
          ? sampleNotifications
              .filter((n) => canPage(person, n.page))
              .map((n) => n.title)
              .join(", ")
          : "No notifications permitted"}
      </p>
      <h3>Profile Scope</h3>
      <p>
        Own identity only; employee records require a separate authorized
        directory view. Provisional preview exposes own profile only; production
        policy resolution remains mandatory.
      </p>
    </div>
  );
}
function ActionForm({ page, onDone }: { page: Page; onDone: () => void }) {
  const [trays, setTrays] = useState(0),
    [loose, setLoose] = useState(0),
    [consumed, setConsumed] = useState(0);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onDone();
      }}
    >
      {page.id === "eggs" ? (
        <>
          <div className="form-grid">
            <label className="field">
              Collection Date
              <input type="date" required defaultValue="2026-09-11" />
            </label>
            <SelectField
              label="Flock"
              value="demo-flock-1"
              onChange={() => {}}
              options={[
                { value: "demo-flock-1", label: "Sample FL-001 · House A" },
              ]}
            />
            <label className="field">
              Trays
              <input
                type="number"
                min="0"
                step="1"
                value={trays}
                onChange={(e) => setTrays(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Loose Eggs
              <input
                type="number"
                min="0"
                max="29"
                step="1"
                value={loose}
                onChange={(e) => setLoose(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="auth-state success">
            Total = {trays} × 30 + {loose} ={" "}
            {(trays * 30 + loose).toLocaleString()} eggs
          </div>
          <p className="form-note">
            30 eggs per tray is a sample configuration. The production value
            must come from the existing configuration. This calculator is a
            development contract exploration; current V6 accepts total eggs.
          </p>
        </>
      ) : page.id === "feed" ? (
        <>
          <label className="field">
            Feed Consumed (kg)
            <input
              type="number"
              min="0"
              max="650"
              step=".1"
              value={consumed}
              onChange={(e) => setConsumed(Number(e.target.value))}
            />
          </label>
          <div className="auth-state success">
            Sample closing balance: 200 + 450 − {consumed} − 0 ={" "}
            {650 - consumed} kg
          </div>
        </>
      ) : page.id === "invitations" ? (
        <>
          <label className="field">
            Recipient Email
            <input type="email" placeholder="sample@example.invalid" required />
          </label>
          <label className="field">
            Nigerian Phone (Optional)
            <input type="tel" placeholder="+234…" />
          </label>
          <label className="field">
            Delivery Channel
            <select>
              <option>Email</option>
              <option>SMS</option>
              <option>Email + SMS</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="field">
            {page.id === "leave"
              ? "Reason For Leave"
              : page.id === "health"
                ? "Observation"
                : "Record Description"}
            <input required placeholder="Describe the sample record" />
          </label>
          <div className="form-grid">
            <label className="field">
              Date
              <input type="date" defaultValue="2026-09-11" required />
            </label>
            <label className="field">
              {["finance", "expenses", "construction", "loans"].includes(
                page.id,
              )
                ? "Amount (NGN)"
                : "Reference"}
              <input
                type={
                  ["finance", "expenses", "construction", "loans"].includes(
                    page.id,
                  )
                    ? "number"
                    : "text"
                }
                min="0"
                required
              />
            </label>
          </div>
        </>
      )}
      <label className="field">
        Notes / Evidence Reference
        <textarea placeholder="Sample notes only. No confidential information." />
      </label>
      <p className="form-note">
        Reviewable sample only. Backend validation, approval states,
        idempotency, audit and all calculations remain authoritative.
      </p>
      <Btn primary type="submit">
        Validate Sample Draft <Check size={17} />
      </Btn>
    </form>
  );
}
