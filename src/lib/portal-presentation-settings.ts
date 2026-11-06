export type PresentationClockStyle = "hybrid" | "analog" | "digital";
export type PresentationSize = "compact" | "standard" | "wide" | "tall";
export type PresentationGlow = "off" | "subtle" | "balanced" | "high";
export type PresentationAnimation = "off" | "subtle" | "balanced";
export type PresentationTransition = "crossfade" | "soft-fade" | "none";
export type SignInThemeSource = "Portal" | "Sites" | "Clone" | "Custom";
export type SignInThemeStatus = "IMPORTED" | "AVAILABLE" | "DRAFT" | "APPROVED" | "ARCHIVED";
export type SignInBreakpoint = "desktop" | "tablet" | "mobile";
export type SignInWidgetKind = "insight" | "metric" | "media" | "status";
export type SignInCanvasElementKind = "background" | "group" | "logo" | "brand" | "badge" | "headline" | "subheadline" | "auth" | "weather" | "spotlight" | "news" | "global-time" | "clock" | "drone" | "footer" | "sustainability" | "button" | "custom" | "widget";
export type SignInComponentState = "DEFAULT" | "HOVER" | "FOCUS" | "ACTIVE" | "LOADING" | "EMPTY" | "NO DATA" | "ERROR" | "DISABLED" | "SUCCESS" | "OFFLINE" | "PROVIDER UNAVAILABLE";
export type SignInGlassStyle = "CLEAR GLASS" | "CRYSTAL GLASS" | "FROSTED" | "DEEP GLASS" | "MATTE" | "SOLID" | "OUTLINE" | "FLOATING" | "COMMAND / HUD";
export type SignInMotionPreset = "None" | "Fade In" | "Reveal" | "Gentle Float" | "Settle" | "Glow Pulse" | "Breathing Halo" | "Light Sweep" | "Shimmer" | "Hover Lift" | "Hover Glow" | "Subtle Tilt" | "Parallax";
export type SignInLogoPlacement = "hero" | "auth" | "header" | "footer" | "watermark" | "mobile-header" | "widget" | "decorative";

export type SignInCanvasStyle = {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  gridSpan: number;
  aspectRatioLocked: boolean;
  alignment: "left" | "center" | "right" | "stretch";
  padding: number;
  margin: number;
  gap: number;
  opacity: number;
  background: string;
  backgroundOpacity: number;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  borderColor: string;
  borderOpacity: number;
  borderWidth: number;
  radius: number;
  shadow: number;
  glow: number;
  blur: number;
  backdropBlur: number;
  saturation: number;
  tint: number;
  reflection: number;
  texture: number;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right";
  textColor: string;
  glassStyle: SignInGlassStyle;
};

export type SignInElementMotion = {
  entrance: SignInMotionPreset;
  hover: SignInMotionPreset;
  focus: SignInMotionPreset;
  active: SignInMotionPreset;
  dataUpdate: SignInMotionPreset;
  loading: SignInMotionPreset;
  idle: SignInMotionPreset;
  durationMs: number;
  delayMs: number;
  easing: "ease" | "ease-out" | "ease-in-out" | "linear";
  intensity: number;
  repeat: "once" | "interaction" | "bounded";
  reducedMotion: "none" | "fade";
};

export type SignInCanvasElement = {
  id: string;
  name: string;
  kind: SignInCanvasElementKind;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  protected: boolean;
  zIndex: number;
  variant: string;
  variants: string[];
  state: SignInComponentState;
  dataBinding: string;
  description: string;
  styles: Record<SignInBreakpoint, SignInCanvasStyle>;
  motion: SignInElementMotion;
};

export type SignInLogoInstance = {
  enabled: boolean;
  scale: number;
  alignment: "left" | "center" | "right";
  opacity: number;
};

export type SignInCanvasSettings = {
  columns: number;
  rows: number;
  snapToGrid: boolean;
  smartGuides: boolean;
  safeOverlapWarnings: boolean;
  elements: SignInCanvasElement[];
  logoInstances: Record<SignInLogoPlacement, SignInLogoInstance>;
};

export type SignInWidgetPlacement = {
  visible: boolean;
  order: number;
  size: PresentationSize;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SignInBreakpointSettings = {
  textScale: number;
  backgroundFocalX: number;
  backgroundFocalY: number;
  widgets: Record<string, SignInWidgetPlacement>;
};

export type SignInResponsiveSettings = Record<SignInBreakpoint, SignInBreakpointSettings>;

export type SignInVisualSettings = {
  headline: string;
  subheadline: string;
  fontFamily: "Portal Sans" | "Editorial Serif" | "System";
  headingWeight: number;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  glassOpacity: number;
  glassBlur: number;
  borderOpacity: number;
  borderWidth: number;
  glowIntensity: number;
  shadowDepth: number;
  spacingScale: number;
  radius: number;
  motionIntensity: number;
};

export type SignInCustomWidget = {
  id: string;
  name: string;
  kind: SignInWidgetKind;
  category?: string;
  icon?: string;
  title: string;
  subtitle?: string;
  content: string;
  sourceLabel: string;
  dataBinding: string;
  layout?: string;
  visualStyle?: string;
  fields?: string[];
  loadingState?: string;
  emptyState?: string;
  errorState?: string;
  responsiveSize?: string;
  variants?: string[];
  interactions?: string[];
  permissionsMetadata?: string;
  description?: string;
  version?: number;
  savedToLibrary?: boolean;
  archived?: boolean;
  enabled: boolean;
  duplicatedFrom?: string;
};

export type SignInWidgetSettings = {
  order: string[];
  hidden: string[];
  sizes: Record<string, PresentationSize>;
  replacements: Record<string, string>;
  custom: SignInCustomWidget[];
};

export type SignInAdvancedSource = {
  html: string;
  css: string;
  js: string;
  baseIdentity: string;
  updatedAt: string;
};

export type PresentationBackground = {
  id: string;
  name: string;
  enabled: boolean;
  native4k: boolean;
  source: string;
  srcSet?: string;
  width: number;
  height: number;
  desktopFocalX: number;
  desktopFocalY: number;
  tabletFocalX: number;
  tabletFocalY: number;
  mobileFocalX: number;
  mobileFocalY: number;
  brightness: number;
  overlay: number;
  fileSizeBytes?: number;
  mediaType?: string;
  localOnly?: boolean;
};

export type SignInThemeBackgroundSettings = {
  backgrounds: PresentationBackground[];
  defaultBackground: string;
  autoRotate: boolean;
  shuffle: boolean;
  rotationIntervalSeconds: number;
  transition: PresentationTransition;
  transitionMs: number;
};

export type SignInThemeProfile = {
  id: string;
  name: string;
  source: SignInThemeSource;
  version: string;
  status: SignInThemeStatus;
  portalThemeId: string;
  thumbnail: string;
  background: SignInThemeBackgroundSettings;
  visual: SignInVisualSettings;
  responsive: SignInResponsiveSettings;
  widgets: SignInWidgetSettings;
  canvas: SignInCanvasSettings;
  advancedSource: SignInAdvancedSource;
  hasEditableDraft: boolean;
  lastModifiedAt: string;
};

export type PortalPresentationSettings = {
  portal_widget_order: string[];
  portal_hidden_widgets: string[];
  portal_clock_locations: string[];
  portal_clock_style: PresentationClockStyle;
  portal_logo_position: "top-left" | "top-right" | "bottom-left";
  portal_logo_scale: "compact" | "standard" | "large";
  portal_glow_intensity: PresentationGlow;
  portal_animation_level: PresentationAnimation;
  weather_temperature_unit: "c" | "f";
  portal_widget_sizes: Record<string, PresentationSize>;
  portal_widget_replacements: Record<string, string>;
  portal_signin_backgrounds: PresentationBackground[];
  portal_signin_background_default: string;
  portal_signin_background_rotation: boolean;
  portal_signin_background_rotation_owner_enabled: boolean;
  portal_signin_background_shuffle: boolean;
  portal_signin_background_interval_seconds: number;
  portal_signin_background_transition: PresentationTransition;
  portal_signin_background_transition_ms: number;
  portal_signin_background_overlay: number;
  portal_weather_farm_visible: boolean;
  portal_weather_hq_visible: boolean;
  portal_weather_forecast_visible: boolean;
  portal_weather_location_rotation: boolean;
  portal_weather_location_rotation_interval_seconds: number;
  portal_signin_headline_visible: boolean;
  portal_signin_tagline_visible: boolean;
  portal_signin_glass_intensity: number;
  portal_signin_theme_profiles: SignInThemeProfile[];
  portal_signin_active_theme_id: string;
  portal_signin_default_theme_id: string;
  portal_signin_studio_theme_id: string;
  portal_signin_active_portal_theme_id: string;
  portal_signin_visual: SignInVisualSettings;
  portal_signin_responsive: SignInResponsiveSettings;
  portal_signin_custom_widgets: SignInCustomWidget[];
  portal_signin_canvas: SignInCanvasSettings;
};

export const PRESENTATION_PREVIEW_KEY = "daenem-portal-presentation-settings-preview-v721";
export const PRESENTATION_DRAFT_KEY = "daenem-portal-presentation-settings-draft-v721";
export const PRESENTATION_PREVIOUS_KEY = "daenem-portal-presentation-settings-previous-v721";
export const PRESENTATION_AUDIT_KEY = "daenem-portal-presentation-settings-audit-v721";
export const PRESENTATION_VERSIONS_KEY = "daenem-portal-presentation-settings-versions-v728";

export const PORTAL_BASELINE_IDENTITY = "Portal UI 7.2.0 · GitHub main · build 20260908a";
export const PORTAL_BASELINE_BLOB = "0993ae274f3210425f3bd523043ef0e7452bd30a";

export const presentationClockCatalog = [
  { id: "farm", label: "Daenem Farms Balogun-Ikire", zone: "Africa/Lagos" },
  { id: "toronto", label: "Toronto", zone: "America/Toronto" },
  { id: "london", label: "London", zone: "Europe/London" },
  { id: "new-york", label: "New York", zone: "America/New_York" },
  { id: "moscow", label: "Moscow", zone: "Europe/Moscow" },
  { id: "tokyo", label: "Tokyo", zone: "Asia/Tokyo" },
  { id: "beijing", label: "Beijing", zone: "Asia/Shanghai" },
] as const;

export const presentationWidgetCatalog = [
  { id: "weather", label: "Weather" },
  { id: "world-clock", label: "Global Time" },
  { id: "farm-news", label: "Nigerian News" },
  { id: "motivation", label: "Daily Spotlight / Motivation" },
  { id: "ai-inspiration", label: "AI Inspiration Slot" },
  { id: "version", label: "Capability Rail" },
] as const;

const defaultPlacement = (order: number): SignInWidgetPlacement => ({
  visible: true,
  order,
  size: "standard",
  x: 0,
  y: 0,
  width: 6,
  height: 2,
});

const makeBreakpoint = (kind: SignInBreakpoint): SignInBreakpointSettings => ({
  textScale: kind === "mobile" ? 96 : 100,
  backgroundFocalX: kind === "mobile" ? 50 : 52,
  backgroundFocalY: kind === "desktop" ? 50 : kind === "tablet" ? 38 : 30,
  widgets: Object.fromEntries(presentationWidgetCatalog.map((item, index) => [
    item.id,
    { ...defaultPlacement(index), width: kind === "mobile" ? 12 : item.id === "world-clock" ? 12 : 6 },
  ])),
});

const makeResponsive = (): SignInResponsiveSettings => ({
  desktop: makeBreakpoint("desktop"),
  tablet: makeBreakpoint("tablet"),
  mobile: makeBreakpoint("mobile"),
});

const defaultVisual = (): SignInVisualSettings => ({
  headline: "The Farm’s Work, Clearly Connected.",
  subheadline: "Secure access to assigned farm operations, people, finance, inventory, and communications.",
  fontFamily: "Portal Sans",
  headingWeight: 760,
  primaryColor: "#17663d",
  accentColor: "#37b66a",
  surfaceColor: "#f8fcf8",
  textColor: "#102719",
  gradientStart: "#17663d",
  gradientEnd: "#2d8a55",
  gradientAngle: 135,
  glassOpacity: 82,
  glassBlur: 18,
  borderOpacity: 22,
  borderWidth: 1,
  glowIntensity: 34,
  shadowDepth: 28,
  spacingScale: 100,
  radius: 18,
  motionIntensity: 45,
});

const defaultWidgets = (): SignInWidgetSettings => ({
  order: presentationWidgetCatalog.map((item) => item.id),
  hidden: [],
  sizes: {},
  replacements: {},
  custom: [],
});

const defaultAdvancedSource = (): SignInAdvancedSource => ({
  html: '<section class="daenem-signin-presentation" aria-label="Daenem Farms Sign-In presentation"></section>',
  css: ".daenem-signin-presentation { --daenem-accent: #37b66a; }",
  js: "// Presentation-only enhancement. Network, auth and storage APIs are blocked in isolation.\n",
  baseIdentity: PORTAL_BASELINE_IDENTITY,
  updatedAt: "2026-09-13T00:00:00.000Z",
});

type CanvasLayout = [x: number, y: number, width: number, height: number];

const defaultElementMotion = (): SignInElementMotion => ({
  entrance: "Fade In",
  hover: "Hover Lift",
  focus: "Hover Glow",
  active: "None",
  dataUpdate: "Fade In",
  loading: "Glow Pulse",
  idle: "None",
  durationMs: 480,
  delayMs: 0,
  easing: "ease-out",
  intensity: 34,
  repeat: "interaction",
  reducedMotion: "fade",
});

const canvasStyle = (layout: CanvasLayout, kind: SignInCanvasElementKind): SignInCanvasStyle => ({
  x: layout[0],
  y: layout[1],
  width: layout[2],
  height: layout[3],
  minWidth: kind === "auth" ? 5 : kind === "logo" ? 3 : 2,
  minHeight: kind === "auth" ? 8 : kind === "logo" ? 2 : 1,
  maxWidth: 24,
  maxHeight: kind === "background" ? 36 : kind === "auth" ? 18 : 12,
  gridSpan: layout[2],
  aspectRatioLocked: kind === "logo" || kind === "drone",
  alignment: "left",
  padding: kind === "headline" || kind === "subheadline" ? 4 : 12,
  margin: 0,
  gap: 8,
  opacity: 100,
  background: kind === "auth" ? "#edf7f1" : "#ffffff",
  backgroundOpacity: kind === "headline" || kind === "subheadline" || kind === "logo" || kind === "drone" ? 0 : 78,
  gradientStart: "#ffffff",
  gradientEnd: kind === "auth" ? "#dcefe4" : "#eef8f2",
  gradientAngle: 135,
  borderColor: "#7fc39b",
  borderOpacity: 28,
  borderWidth: 1,
  radius: kind === "auth" ? 22 : 16,
  shadow: kind === "auth" ? 28 : 16,
  glow: kind === "logo" ? 24 : 12,
  blur: 0,
  backdropBlur: kind === "auth" || ["weather", "spotlight", "news", "global-time"].includes(kind) ? 18 : 0,
  saturation: 100,
  tint: 0,
  reflection: kind === "logo" ? 18 : 8,
  texture: 0,
  fontSize: kind === "headline" ? 36 : kind === "subheadline" ? 16 : 14,
  fontWeight: kind === "headline" ? 800 : 650,
  lineHeight: kind === "headline" ? 105 : 140,
  letterSpacing: kind === "badge" ? 8 : 0,
  textAlign: "left",
  textColor: "#102719",
  glassStyle: kind === "auth" ? "CRYSTAL GLASS" : ["weather", "spotlight", "news", "global-time"].includes(kind) ? "CLEAR GLASS" : "MATTE",
});

const variantsFor = (kind: SignInCanvasElementKind) => {
  if (kind === "weather") return ["Environmental Intelligence", "Crystal Command", "Minimal Technical", "Operational Compact", "Transparent Glass", "Frosted", "Detailed", "Hero", "Floating", "Outline", "Daylight", "Dark"];
  if (kind === "clock" || kind === "global-time") return ["Operations Array", "Precision Glass", "Compact Command", "Executive Clock Strip", "Premium Analog", "Minimal Analog", "Digital", "Hybrid", "Floating"];
  if (kind === "spotlight") return ["Intelligence Brief", "Editorial Glass", "Safety / Quality Brief", "Minimal Insight"];
  if (kind === "news") return ["Intelligence Feed", "Editorial", "Compact Stream", "Hero Story", "Glass", "Cards", "Accessible Headlines"];
  if (kind === "logo") return ["Official Full Color", "Monochrome Light", "Glass Mark"];
  if (kind === "auth") return ["Reference Pavilion", "Crystal Pavilion", "Compact Glass", "Command"];
  if (kind === "widget" || kind === "custom") return ["Executive", "Minimal Number", "Sparkline", "Trend", "Comparison", "Radial", "Glass", "Gradient", "Outline", "Technical HUD"];
  return ["Reference", "Minimal", "Glass", "Floating", "Outline", "Command"];
};

const canvasElement = (
  id: string,
  name: string,
  kind: SignInCanvasElementKind,
  parentId: string | null,
  desktop: CanvasLayout,
  tablet: CanvasLayout,
  mobile: CanvasLayout,
  options: Partial<Pick<SignInCanvasElement, "visible" | "locked" | "protected" | "zIndex" | "variant" | "dataBinding" | "description">> = {},
): SignInCanvasElement => {
  const variants = variantsFor(kind);
  return {
    id,
    name,
    kind,
    parentId,
    visible: options.visible ?? true,
    locked: options.locked ?? false,
    protected: options.protected ?? false,
    zIndex: options.zIndex ?? 10,
    variant: options.variant || variants[0],
    variants,
    state: "DEFAULT",
    dataBinding: options.dataBinding || "Presentation only",
    description: options.description || `${name} presentation layer`,
    styles: {
      desktop: canvasStyle(desktop, kind),
      tablet: canvasStyle(tablet, kind),
      mobile: canvasStyle(mobile, kind),
    },
    motion: defaultElementMotion(),
  };
};

const defaultCanvas = (): SignInCanvasSettings => ({
  columns: 24,
  rows: 36,
  snapToGrid: true,
  smartGuides: true,
  safeOverlapWarnings: true,
  logoInstances: {
    hero: { enabled: true, scale: 100, alignment: "left", opacity: 100 },
    auth: { enabled: false, scale: 72, alignment: "center", opacity: 100 },
    header: { enabled: false, scale: 70, alignment: "left", opacity: 100 },
    footer: { enabled: false, scale: 58, alignment: "left", opacity: 84 },
    watermark: { enabled: false, scale: 140, alignment: "center", opacity: 12 },
    "mobile-header": { enabled: true, scale: 82, alignment: "left", opacity: 100 },
    widget: { enabled: false, scale: 60, alignment: "left", opacity: 100 },
    decorative: { enabled: false, scale: 95, alignment: "right", opacity: 30 },
  },
  elements: [
    canvasElement("background", "Background", "background", null, [0, 0, 24, 18], [0, 0, 24, 24], [0, 0, 24, 36], { locked: true, protected: true, zIndex: 0 }),
    canvasElement("hero", "Hero", "group", null, [1, 1, 16, 8], [1, 1, 15, 9], [1, 1, 22, 7], { zIndex: 1 }),
    canvasElement("logo", "Official Daenem Farms Logo", "logo", "hero", [1, 1, 4, 2], [1, 1, 5, 2], [1, 1, 8, 2], { protected: true, zIndex: 20, dataBinding: "Approved brand asset" }),
    canvasElement("brand-tagline", "Brand / Tagline", "brand", "hero", [5, 1, 8, 2], [6, 1, 9, 2], [9, 1, 14, 2], { zIndex: 18 }),
    canvasElement("portal-badge", "Employee Portal Badge", "badge", "hero", [1, 3, 6, 1], [1, 3, 7, 1], [1, 3, 11, 1], { zIndex: 18 }),
    canvasElement("headline", "Hero Headline", "headline", "hero", [1, 4, 14, 3], [1, 4, 14, 3], [1, 4, 22, 2], { zIndex: 16 }),
    canvasElement("subheadline", "Hero Subheadline", "subheadline", "hero", [1, 7, 13, 2], [1, 7, 14, 2], [1, 6, 22, 1], { zIndex: 16 }),
    canvasElement("drone", "Agricultural Monitoring Drone", "drone", "hero", [13, 2, 3, 2], [12, 2, 4, 2], [18, 3, 5, 2], { zIndex: 22, dataBinding: "Decorative telemetry layer" }),
    canvasElement("intelligence", "Intelligence", "group", null, [1, 10, 16, 4], [1, 11, 22, 5], [1, 19, 22, 9], { zIndex: 1 }),
    canvasElement("weather", "Weather", "weather", "intelligence", [1, 10, 6, 3], [1, 11, 8, 4], [1, 19, 22, 3], { zIndex: 12, variant: "Environmental Intelligence", dataBinding: "Weather provider hook · unavailable-safe" }),
    canvasElement("spotlight", "Daily Spotlight", "spotlight", "intelligence", [7, 10, 5, 3], [9, 11, 7, 4], [1, 22, 22, 3], { zIndex: 12, variant: "Intelligence Brief", dataBinding: "Owner-managed design content" }),
    canvasElement("news", "Nigerian News", "news", "intelligence", [12, 10, 5, 3], [16, 11, 7, 4], [1, 25, 22, 3], { zIndex: 12, variant: "Intelligence Feed", dataBinding: "Provider pending · no fabricated headlines" }),
    canvasElement("sustainability", "Sustainability Message", "sustainability", "intelligence", [1, 14, 8, 1], [1, 16, 10, 1], [1, 32, 16, 1], { zIndex: 12 }),
    canvasElement("global-time", "Global Time", "global-time", null, [1, 13, 16, 3], [1, 17, 22, 3], [1, 28, 22, 3], { protected: true, zIndex: 13, variant: "Operations Array", dataBinding: "Seven approved IANA time zones" }),
    canvasElement("clock-farm", "Daenem Farms — Balogun-Ikire", "clock", "global-time", [1, 13, 2, 2], [1, 17, 3, 2], [1, 28, 3, 2], { protected: true, zIndex: 14, dataBinding: "Africa/Lagos time zone" }),
    canvasElement("clock-toronto", "Toronto", "clock", "global-time", [3, 13, 2, 2], [4, 17, 3, 2], [4, 28, 3, 2], { protected: true, zIndex: 14, dataBinding: "America/Toronto" }),
    canvasElement("clock-london", "London", "clock", "global-time", [5, 13, 2, 2], [7, 17, 3, 2], [7, 28, 3, 2], { protected: true, zIndex: 14, dataBinding: "Europe/London" }),
    canvasElement("clock-new-york", "New York", "clock", "global-time", [7, 13, 2, 2], [10, 17, 3, 2], [10, 28, 3, 2], { protected: true, zIndex: 14, dataBinding: "America/New_York" }),
    canvasElement("clock-moscow", "Moscow", "clock", "global-time", [9, 13, 2, 2], [13, 17, 3, 2], [13, 28, 3, 2], { protected: true, zIndex: 14, dataBinding: "Europe/Moscow" }),
    canvasElement("clock-tokyo", "Tokyo", "clock", "global-time", [11, 13, 2, 2], [16, 17, 3, 2], [16, 28, 3, 2], { protected: true, zIndex: 14, dataBinding: "Asia/Tokyo" }),
    canvasElement("clock-beijing", "Beijing", "clock", "global-time", [13, 13, 2, 2], [19, 17, 3, 2], [19, 28, 3, 2], { protected: true, zIndex: 14, dataBinding: "Asia/Shanghai" }),
    canvasElement("auth-pavilion", "Authentication Pavilion", "auth", null, [18, 1, 5, 12], [16, 1, 7, 9], [1, 8, 22, 10], { protected: true, zIndex: 30, dataBinding: "Protected canonical authentication DOM" }),
    canvasElement("signin-action", "Sign-In Action", "button", "auth-pavilion", [19, 9, 3, 1], [17, 7, 5, 1], [3, 15, 18, 1], { protected: true, zIndex: 31, dataBinding: "Protected submit binding" }),
    canvasElement("footer", "Footer", "footer", null, [18, 14, 5, 1], [16, 21, 7, 1], [1, 34, 22, 1], { zIndex: 8 }),
  ],
});

const background = (index: number, production = false): PresentationBackground => ({
  id: production ? "imported-portal-baseline" : `owner-slot-0${index}`,
  name: production ? "Imported Portal Baseline" : `Owner 4K Slot 0${index} · Preview Placeholder`,
  enabled: true,
  native4k: false,
  source: production
    ? "/canonical-signin/assets/premium/daenem-hero-v7-1672.webp"
    : `/assets/auth-v24/hero-0${index}-1672.webp`,
  srcSet: production
    ? "/canonical-signin/assets/premium/daenem-hero-v7-640.webp 640w, /canonical-signin/assets/premium/daenem-hero-v7-1024.webp 1024w, /canonical-signin/assets/premium/daenem-hero-v7-1672.webp 1672w"
    : `/assets/auth-v24/hero-0${index}-640.webp 640w, /assets/auth-v24/hero-0${index}-1024.webp 1024w, /assets/auth-v24/hero-0${index}-1672.webp 1672w`,
  width: 1672,
  height: 941,
  desktopFocalX: production ? 50 : 78,
  desktopFocalY: 50,
  tabletFocalX: production ? 52 : 68,
  tabletFocalY: production ? 38 : 36,
  mobileFocalX: production ? 50 : 54,
  mobileFocalY: production ? 30 : 28,
  brightness: production ? 100 : 104,
  overlay: production ? 16 : 14,
});

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const baseBackgrounds = () => [background(1, true), background(2), background(3), background(4), background(5)];

const portalThemeSeeds = [
  ["reference-v3", "Reference V3", PORTAL_BASELINE_IDENTITY, 0],
  ["canopy-split", "Canopy Split", "Portal Theme 02", 1],
  ["orchard-mosaic", "Orchard Mosaic", "Portal Theme 03", 2],
  ["horizon-command", "Horizon Command", "Portal Theme 04", 3],
  ["field-atlas", "Field Atlas", "Portal Theme 05", 4],
  ["harvest-magazine", "Harvest Magazine", "Portal Theme 06", 0],
  ["agro-glass-tower", "Agro Glass Tower", "Portal Theme 07", 1],
  ["sunrise-canvas", "Sunrise Canvas", "Portal Theme 08", 2],
  ["command-dock", "Command Dock", "Portal Theme 09", 3],
  ["greenhouse-panorama", "Greenhouse Panorama", "Portal Theme 10", 4],
] as const;

const sitesThemeSeeds = [
  ["sites-v21", "V1.7-E Sign-In", "Site v21", "command-dock", 1],
  ["sites-v22", "V1.7-F1 Sign-In", "Site v22", "command-dock", 2],
  ["sites-v23", "V1.7-F2 Gate Closure", "Site v23", "command-dock", 3],
  ["sites-v24", "Reference Fusion", "Site v24", "reference-v3", 4],
] as const;

const makeThemeBackground = (seed: number): SignInThemeBackgroundSettings => {
  const backgrounds = baseBackgrounds();
  return {
    backgrounds,
    defaultBackground: backgrounds[seed % backgrounds.length].id,
    autoRotate: false,
    shuffle: false,
    rotationIntervalSeconds: 14,
    transition: "crossfade",
    transitionMs: 950,
  };
};

export const importedSignInThemeProfiles: SignInThemeProfile[] = [
  ...portalThemeSeeds.map(([id, name, version, seed], index) => {
    const themeBackground = makeThemeBackground(seed);
    return {
      id,
      name,
      source: "Portal" as const,
      version,
      status: (index === 0 ? "IMPORTED" : "AVAILABLE") as SignInThemeStatus,
      portalThemeId: id,
      thumbnail: themeBackground.backgrounds.find((item) => item.id === themeBackground.defaultBackground)?.source || themeBackground.backgrounds[0].source,
      background: themeBackground,
      visual: defaultVisual(),
      responsive: makeResponsive(),
      widgets: defaultWidgets(),
      canvas: defaultCanvas(),
      advancedSource: defaultAdvancedSource(),
      hasEditableDraft: false,
      lastModifiedAt: "2026-09-13T00:00:00.000Z",
    };
  }),
  ...sitesThemeSeeds.map(([id, name, version, portalThemeId, seed]) => {
    const themeBackground = makeThemeBackground(seed);
    return {
      id,
      name,
      source: "Sites" as const,
      version,
      status: "AVAILABLE" as const,
      portalThemeId,
      thumbnail: themeBackground.backgrounds.find((item) => item.id === themeBackground.defaultBackground)?.source || themeBackground.backgrounds[0].source,
      background: themeBackground,
      visual: defaultVisual(),
      responsive: makeResponsive(),
      widgets: defaultWidgets(),
      canvas: defaultCanvas(),
      advancedSource: { ...defaultAdvancedSource(), baseIdentity: `${version} · retained Sites candidate` },
      hasEditableDraft: false,
      lastModifiedAt: "2026-09-13T00:00:00.000Z",
    };
  }),
];

export const importedPresentationDefaults: PortalPresentationSettings = {
  portal_widget_order: presentationWidgetCatalog.map((item) => item.id),
  portal_hidden_widgets: [],
  portal_clock_locations: presentationClockCatalog.map((item) => item.zone),
  portal_clock_style: "hybrid",
  portal_logo_position: "top-left",
  portal_logo_scale: "standard",
  portal_glow_intensity: "balanced",
  portal_animation_level: "balanced",
  // Sign-In and authenticated Home use Fahrenheit as the preview default;
  // the authoritative provider contract can still override this at runtime.
  weather_temperature_unit: "f",
  portal_widget_sizes: {},
  portal_widget_replacements: {},
  portal_signin_backgrounds: baseBackgrounds(),
  portal_signin_background_default: "imported-portal-baseline",
  portal_signin_background_rotation: false,
  portal_signin_background_rotation_owner_enabled: false,
  portal_signin_background_shuffle: false,
  portal_signin_background_interval_seconds: 14,
  portal_signin_background_transition: "crossfade",
  portal_signin_background_transition_ms: 950,
  portal_signin_background_overlay: 16,
  portal_weather_farm_visible: true,
  portal_weather_hq_visible: true,
  portal_weather_forecast_visible: true,
  portal_weather_location_rotation: true,
  portal_weather_location_rotation_interval_seconds: 24,
  portal_signin_headline_visible: true,
  portal_signin_tagline_visible: true,
  portal_signin_glass_intensity: 82,
  portal_signin_theme_profiles: copy(importedSignInThemeProfiles),
  portal_signin_active_theme_id: "reference-v3",
  portal_signin_default_theme_id: "reference-v3",
  portal_signin_studio_theme_id: "reference-v3",
  portal_signin_active_portal_theme_id: "reference-v3",
  portal_signin_visual: defaultVisual(),
  portal_signin_responsive: makeResponsive(),
  portal_signin_custom_widgets: [],
  portal_signin_canvas: defaultCanvas(),
};
const number = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const canonicalThemeIds = new Set<string>(portalThemeSeeds.map(([id]) => id));
const themeSources = new Set<SignInThemeSource>(["Portal", "Sites", "Clone", "Custom"]);
const themeStatuses = new Set<SignInThemeStatus>(["IMPORTED", "AVAILABLE", "DRAFT", "APPROVED", "ARCHIVED"]);
const transitions = new Set<PresentationTransition>(["crossfade", "soft-fade", "none"]);

function normalizeBackgrounds(value: unknown, fallback: PresentationBackground[]) {
  const supplied = Array.isArray(value) && value.length >= 5 ? value : fallback;
  return supplied.map((raw, index) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Partial<PresentationBackground> : {};
    const base = fallback[index % fallback.length];
    return {
      ...base,
      ...item,
      id: String(item.id || base.id || `owner-slot-${index + 1}`),
      name: String(String(item.name || "").startsWith("Current Production") && String(item.name || "").endsWith("Reference") ? "Imported Portal Baseline" : item.name || base.name || `Owner Background ${index + 1}`),
      source: String(item.source || base.source),
      enabled: item.enabled !== false,
      native4k: item.native4k === true,
      width: number(item.width, 0, 12000, base.width),
      height: number(item.height, 0, 12000, base.height),
      brightness: number(item.brightness, 70, 125, base.brightness),
      overlay: number(item.overlay, 0, 55, base.overlay),
      desktopFocalX: number(item.desktopFocalX, 0, 100, base.desktopFocalX),
      desktopFocalY: number(item.desktopFocalY, 0, 100, base.desktopFocalY),
      tabletFocalX: number(item.tabletFocalX, 0, 100, base.tabletFocalX),
      tabletFocalY: number(item.tabletFocalY, 0, 100, base.tabletFocalY),
      mobileFocalX: number(item.mobileFocalX, 0, 100, base.mobileFocalX),
      mobileFocalY: number(item.mobileFocalY, 0, 100, base.mobileFocalY),
      ...(Number.isFinite(Number(item.fileSizeBytes)) ? { fileSizeBytes: number(item.fileSizeBytes, 0, 100000000, 0) } : {}),
      ...(item.mediaType ? { mediaType: String(item.mediaType).slice(0, 80) } : {}),
      ...(item.localOnly === true ? { localOnly: true } : {}),
    };
  });
}

function normalizeThemeBackground(value: unknown, fallback: SignInThemeBackgroundSettings) {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInThemeBackgroundSettings> : {};
  const backgrounds = normalizeBackgrounds(item.backgrounds, fallback.backgrounds);
  const enabled = backgrounds.filter((backgroundItem) => backgroundItem.enabled);
  const requestedDefault = String(item.defaultBackground || fallback.defaultBackground);
  return {
    backgrounds,
    defaultBackground: enabled.some((backgroundItem) => backgroundItem.id === requestedDefault)
      ? requestedDefault
      : enabled[0]?.id || backgrounds[0].id,
    autoRotate: item.autoRotate === true,
    shuffle: item.autoRotate === true && item.shuffle === true,
    rotationIntervalSeconds: number(item.rotationIntervalSeconds, 6, 90, fallback.rotationIntervalSeconds),
    transition: transitions.has(item.transition as PresentationTransition) ? item.transition as PresentationTransition : fallback.transition,
    transitionMs: number(item.transitionMs, 200, 2000, fallback.transitionMs),
  };
}

const hex = (value: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
const sizes = new Set<PresentationSize>(["compact", "standard", "wide", "tall"]);
const widgetKinds = new Set<SignInWidgetKind>(["insight", "metric", "media", "status"]);
const canvasElementKinds = new Set<SignInCanvasElementKind>(["background", "group", "logo", "brand", "badge", "headline", "subheadline", "auth", "weather", "spotlight", "news", "global-time", "clock", "drone", "footer", "sustainability", "button", "custom", "widget"]);
const componentStates = new Set<SignInComponentState>(["DEFAULT", "HOVER", "FOCUS", "ACTIVE", "LOADING", "EMPTY", "NO DATA", "ERROR", "DISABLED", "SUCCESS", "OFFLINE", "PROVIDER UNAVAILABLE"]);
const glassStyles = new Set<SignInGlassStyle>(["CLEAR GLASS", "CRYSTAL GLASS", "FROSTED", "DEEP GLASS", "MATTE", "SOLID", "OUTLINE", "FLOATING", "COMMAND / HUD"]);
const motionPresets = new Set<SignInMotionPreset>(["None", "Fade In", "Reveal", "Gentle Float", "Settle", "Glow Pulse", "Breathing Halo", "Light Sweep", "Shimmer", "Hover Lift", "Hover Glow", "Subtle Tilt", "Parallax"]);
const canvasBreakpoints: SignInBreakpoint[] = ["desktop", "tablet", "mobile"];

function normalizeVisual(value: unknown, fallback: SignInVisualSettings): SignInVisualSettings {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInVisualSettings> : {};
  const fontFamilies = new Set<SignInVisualSettings["fontFamily"]>(["Portal Sans", "Editorial Serif", "System"]);
  return {
    headline: String(item.headline || fallback.headline).slice(0, 120),
    subheadline: String(item.subheadline || fallback.subheadline).slice(0, 240),
    fontFamily: fontFamilies.has(item.fontFamily as SignInVisualSettings["fontFamily"]) ? item.fontFamily as SignInVisualSettings["fontFamily"] : fallback.fontFamily,
    headingWeight: number(item.headingWeight, 500, 900, fallback.headingWeight),
    primaryColor: hex(item.primaryColor, fallback.primaryColor),
    accentColor: hex(item.accentColor, fallback.accentColor),
    surfaceColor: hex(item.surfaceColor, fallback.surfaceColor),
    textColor: hex(item.textColor, fallback.textColor),
    gradientStart: hex(item.gradientStart, fallback.gradientStart),
    gradientEnd: hex(item.gradientEnd, fallback.gradientEnd),
    gradientAngle: number(item.gradientAngle, 0, 360, fallback.gradientAngle),
    glassOpacity: number(item.glassOpacity, 35, 100, fallback.glassOpacity),
    glassBlur: number(item.glassBlur, 0, 36, fallback.glassBlur),
    borderOpacity: number(item.borderOpacity, 0, 100, fallback.borderOpacity),
    borderWidth: number(item.borderWidth, 0, 4, fallback.borderWidth),
    glowIntensity: number(item.glowIntensity, 0, 100, fallback.glowIntensity),
    shadowDepth: number(item.shadowDepth, 0, 60, fallback.shadowDepth),
    spacingScale: number(item.spacingScale, 75, 130, fallback.spacingScale),
    radius: number(item.radius, 4, 36, fallback.radius),
    motionIntensity: number(item.motionIntensity, 0, 100, fallback.motionIntensity),
  };
}

function normalizePlacement(value: unknown, fallback: SignInWidgetPlacement): SignInWidgetPlacement {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInWidgetPlacement> : {};
  return {
    visible: item.visible !== false,
    order: number(item.order, 0, 99, fallback.order),
    size: sizes.has(item.size as PresentationSize) ? item.size as PresentationSize : fallback.size,
    x: number(item.x, -6, 6, fallback.x),
    y: number(item.y, -6, 6, fallback.y),
    width: number(item.width, 2, 12, fallback.width),
    height: number(item.height, 1, 6, fallback.height),
  };
}

function normalizeBreakpoint(value: unknown, fallback: SignInBreakpointSettings, widgetIds: string[]): SignInBreakpointSettings {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInBreakpointSettings> : {};
  const suppliedWidgets = item.widgets && typeof item.widgets === "object" && !Array.isArray(item.widgets) ? item.widgets : {};
  return {
    textScale: number(item.textScale, 80, 125, fallback.textScale),
    backgroundFocalX: number(item.backgroundFocalX, 0, 100, fallback.backgroundFocalX),
    backgroundFocalY: number(item.backgroundFocalY, 0, 100, fallback.backgroundFocalY),
    widgets: Object.fromEntries(widgetIds.map((id, index) => [id, normalizePlacement((suppliedWidgets as Record<string, unknown>)[id], fallback.widgets[id] || defaultPlacement(index))])),
  };
}

function normalizeCustomWidgets(value: unknown): SignInCustomWidget[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).map((raw, index) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Partial<SignInCustomWidget> : {};
    return {
      id: String(item.id || `custom-widget-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80),
      name: String(item.name || `Custom Widget ${index + 1}`).slice(0, 80),
      kind: widgetKinds.has(item.kind as SignInWidgetKind) ? item.kind as SignInWidgetKind : "insight",
      category: String(item.category || "CUSTOM").slice(0, 80),
      icon: String(item.icon || "Sparkles").slice(0, 40),
      title: String(item.title || item.name || `Custom Widget ${index + 1}`).slice(0, 100),
      subtitle: String(item.subtitle || "").slice(0, 160),
      content: String(item.content || "Presentation content pending Owner configuration.").slice(0, 500),
      sourceLabel: String(item.sourceLabel || "Owner-managed presentation").slice(0, 100),
      dataBinding: String(item.dataBinding || "No authoritative data binding").slice(0, 160),
      layout: String(item.layout || "stacked").slice(0, 40),
      visualStyle: String(item.visualStyle || "Crystal Glass").slice(0, 80),
      fields: Array.isArray(item.fields) ? item.fields.map(String).slice(0, 20) : [],
      loadingState: String(item.loadingState || "Loading presentation…").slice(0, 160),
      emptyState: String(item.emptyState || "No data available").slice(0, 160),
      errorState: String(item.errorState || "Widget unavailable").slice(0, 160),
      responsiveSize: String(item.responsiveSize || "Desktop 6×3 · Tablet 8×3 · Mobile 22×3").slice(0, 120),
      variants: Array.isArray(item.variants) ? item.variants.map(String).slice(0, 16) : ["Crystal Glass", "Minimal", "Command"],
      interactions: Array.isArray(item.interactions) ? item.interactions.map(String).slice(0, 16) : [],
      permissionsMetadata: String(item.permissionsMetadata || "Presentation only · no backend write authority").slice(0, 180),
      description: String(item.description || "Owner-designed presentation component").slice(0, 280),
      version: number(item.version, 1, 999, 1),
      savedToLibrary: item.savedToLibrary === true,
      archived: item.archived === true,
      enabled: item.enabled !== false,
      ...(item.duplicatedFrom ? { duplicatedFrom: String(item.duplicatedFrom).slice(0, 80) } : {}),
    };
  });
}

function normalizeCanvasStyle(value: unknown, fallback: SignInCanvasStyle): SignInCanvasStyle {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInCanvasStyle> : {};
  const alignments = new Set<SignInCanvasStyle["alignment"]>(["left", "center", "right", "stretch"]);
  const textAlignments = new Set<SignInCanvasStyle["textAlign"]>(["left", "center", "right"]);
  return {
    x: number(item.x, 0, 23, fallback.x),
    y: number(item.y, 0, 35, fallback.y),
    width: number(item.width, 1, 24, fallback.width),
    height: number(item.height, 1, 36, fallback.height),
    minWidth: number(item.minWidth, 1, 24, fallback.minWidth),
    minHeight: number(item.minHeight, 1, 36, fallback.minHeight),
    maxWidth: number(item.maxWidth, 1, 24, fallback.maxWidth),
    maxHeight: number(item.maxHeight, 1, 36, fallback.maxHeight),
    gridSpan: number(item.gridSpan, 1, 24, fallback.gridSpan),
    aspectRatioLocked: item.aspectRatioLocked === true,
    alignment: alignments.has(item.alignment as SignInCanvasStyle["alignment"]) ? item.alignment as SignInCanvasStyle["alignment"] : fallback.alignment,
    padding: number(item.padding, 0, 64, fallback.padding),
    margin: number(item.margin, 0, 64, fallback.margin),
    gap: number(item.gap, 0, 48, fallback.gap),
    opacity: number(item.opacity, 0, 100, fallback.opacity),
    background: hex(item.background, fallback.background),
    backgroundOpacity: number(item.backgroundOpacity, 0, 100, fallback.backgroundOpacity),
    gradientStart: hex(item.gradientStart, fallback.gradientStart),
    gradientEnd: hex(item.gradientEnd, fallback.gradientEnd),
    gradientAngle: number(item.gradientAngle, 0, 360, fallback.gradientAngle),
    borderColor: hex(item.borderColor, fallback.borderColor),
    borderOpacity: number(item.borderOpacity, 0, 100, fallback.borderOpacity),
    borderWidth: number(item.borderWidth, 0, 8, fallback.borderWidth),
    radius: number(item.radius, 0, 64, fallback.radius),
    shadow: number(item.shadow, 0, 100, fallback.shadow),
    glow: number(item.glow, 0, 100, fallback.glow),
    blur: number(item.blur, 0, 32, fallback.blur),
    backdropBlur: number(item.backdropBlur, 0, 48, fallback.backdropBlur),
    saturation: number(item.saturation, 0, 200, fallback.saturation),
    tint: number(item.tint, 0, 100, fallback.tint),
    reflection: number(item.reflection, 0, 100, fallback.reflection),
    texture: number(item.texture, 0, 100, fallback.texture),
    fontSize: number(item.fontSize, 10, 96, fallback.fontSize),
    fontWeight: number(item.fontWeight, 300, 900, fallback.fontWeight),
    lineHeight: number(item.lineHeight, 80, 220, fallback.lineHeight),
    letterSpacing: number(item.letterSpacing, -5, 24, fallback.letterSpacing),
    textAlign: textAlignments.has(item.textAlign as SignInCanvasStyle["textAlign"]) ? item.textAlign as SignInCanvasStyle["textAlign"] : fallback.textAlign,
    textColor: hex(item.textColor, fallback.textColor),
    glassStyle: glassStyles.has(item.glassStyle as SignInGlassStyle) ? item.glassStyle as SignInGlassStyle : fallback.glassStyle,
  };
}

function normalizeElementMotion(value: unknown, fallback: SignInElementMotion): SignInElementMotion {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInElementMotion> : {};
  const preset = (candidate: unknown, base: SignInMotionPreset) => motionPresets.has(candidate as SignInMotionPreset) ? candidate as SignInMotionPreset : base;
  const easings = new Set<SignInElementMotion["easing"]>(["ease", "ease-out", "ease-in-out", "linear"]);
  const repeats = new Set<SignInElementMotion["repeat"]>(["once", "interaction", "bounded"]);
  return {
    entrance: preset(item.entrance, fallback.entrance),
    hover: preset(item.hover, fallback.hover),
    focus: preset(item.focus, fallback.focus),
    active: preset(item.active, fallback.active),
    dataUpdate: preset(item.dataUpdate, fallback.dataUpdate),
    loading: preset(item.loading, fallback.loading),
    idle: preset(item.idle, fallback.idle),
    durationMs: number(item.durationMs, 80, 4000, fallback.durationMs),
    delayMs: number(item.delayMs, 0, 3000, fallback.delayMs),
    easing: easings.has(item.easing as SignInElementMotion["easing"]) ? item.easing as SignInElementMotion["easing"] : fallback.easing,
    intensity: number(item.intensity, 0, 100, fallback.intensity),
    repeat: repeats.has(item.repeat as SignInElementMotion["repeat"]) ? item.repeat as SignInElementMotion["repeat"] : fallback.repeat,
    reducedMotion: item.reducedMotion === "none" ? "none" : "fade",
  };
}

function normalizeCanvasElement(value: unknown, fallback: SignInCanvasElement): SignInCanvasElement {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInCanvasElement> : {};
  const kind = canvasElementKinds.has(item.kind as SignInCanvasElementKind) ? item.kind as SignInCanvasElementKind : fallback.kind;
  const rawStyles = item.styles && typeof item.styles === "object" && !Array.isArray(item.styles) ? item.styles : {};
  const variants = Array.isArray(item.variants) && item.variants.length ? item.variants.map(String).slice(0, 24) : fallback.variants;
  return {
    id: String(item.id || fallback.id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80),
    name: String(item.name || fallback.name).slice(0, 100),
    kind,
    parentId: item.parentId === null ? null : String(item.parentId || fallback.parentId || "").slice(0, 80) || null,
    visible: fallback.protected ? true : item.visible !== false,
    locked: item.locked === true || fallback.kind === "background",
    protected: fallback.protected || item.protected === true,
    zIndex: number(item.zIndex, 0, 999, fallback.zIndex),
    variant: variants.includes(String(item.variant)) ? String(item.variant) : variants[0],
    variants,
    state: componentStates.has(item.state as SignInComponentState) ? item.state as SignInComponentState : fallback.state,
    dataBinding: String(item.dataBinding || fallback.dataBinding).slice(0, 180),
    description: String(item.description || fallback.description).slice(0, 280),
    styles: Object.fromEntries(canvasBreakpoints.map((breakpoint) => [breakpoint, normalizeCanvasStyle((rawStyles as Record<string, unknown>)[breakpoint], fallback.styles[breakpoint])])) as Record<SignInBreakpoint, SignInCanvasStyle>,
    motion: normalizeElementMotion(item.motion, fallback.motion),
  };
}

function normalizeCanvas(value: unknown, fallback: SignInCanvasSettings): SignInCanvasSettings {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInCanvasSettings> : {};
  const supplied = Array.isArray(item.elements) ? item.elements : [];
  const suppliedById = new Map(supplied.filter((entry): entry is SignInCanvasElement => Boolean(entry && typeof entry === "object" && !Array.isArray(entry) && "id" in entry)).map((entry) => [String(entry.id), entry]));
  const required = fallback.elements.map((base) => normalizeCanvasElement(suppliedById.get(base.id), base));
  const requiredIds = new Set(required.map((entry) => entry.id));
  const extras = supplied
    .filter((entry): entry is SignInCanvasElement => Boolean(entry && typeof entry === "object" && !Array.isArray(entry) && "id" in entry && !requiredIds.has(String(entry.id))))
    .slice(0, 100)
    .map((entry, index) => normalizeCanvasElement(entry, canvasElement(`custom-${index + 1}`, `Custom Component ${index + 1}`, "custom", null, [1, 1, 5, 3], [1, 1, 7, 3], [1, 1, 22, 3])));
  const rawLogo = item.logoInstances && typeof item.logoInstances === "object" && !Array.isArray(item.logoInstances) ? item.logoInstances : {};
  const placements = Object.keys(fallback.logoInstances) as SignInLogoPlacement[];
  const logoInstances = Object.fromEntries(placements.map((placement) => {
    const base = fallback.logoInstances[placement];
    const candidate = (rawLogo as Partial<Record<SignInLogoPlacement, SignInLogoInstance>>)[placement];
    const alignment = candidate && ["left", "center", "right"].includes(candidate.alignment) ? candidate.alignment : base.alignment;
    return [placement, {
      enabled: candidate?.enabled === true || (candidate?.enabled === undefined && base.enabled),
      scale: number(candidate?.scale, 20, 220, base.scale),
      alignment,
      opacity: number(candidate?.opacity, 0, 100, base.opacity),
    }];
  })) as Record<SignInLogoPlacement, SignInLogoInstance>;
  return {
    columns: 24,
    rows: 36,
    snapToGrid: item.snapToGrid !== false,
    smartGuides: item.smartGuides !== false,
    safeOverlapWarnings: item.safeOverlapWarnings !== false,
    elements: [...required, ...extras],
    logoInstances,
  };
}

export function createSignInCanvasElement(id: string, name: string, category = "CUSTOM", layouts?: Partial<Record<SignInBreakpoint, CanvasLayout>>) {
  return canvasElement(
    id,
    name,
    "custom",
    null,
    layouts?.desktop || [2, 5, 6, 3],
    layouts?.tablet || [2, 8, 8, 3],
    layouts?.mobile || [1, 20, 22, 3],
    { dataBinding: `${category} · presentation-only binding`, description: `${name} component from the Studio library` },
  );
}

function normalizeWidgets(value: unknown, fallback: SignInWidgetSettings): SignInWidgetSettings {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInWidgetSettings> : {};
  const custom = normalizeCustomWidgets(item.custom);
  const allowedIds = new Set([...presentationWidgetCatalog.map((widget) => widget.id), ...custom.map((widget) => widget.id)]);
  const suppliedOrder = Array.isArray(item.order) ? item.order.map(String).filter((id) => allowedIds.has(id)) : fallback.order;
  const order = [...new Set(suppliedOrder)];
  const hidden = Array.isArray(item.hidden) ? [...new Set(item.hidden.map(String).filter((id) => allowedIds.has(id)))] : fallback.hidden;
  const rawSizes = item.sizes && typeof item.sizes === "object" && !Array.isArray(item.sizes) ? item.sizes : fallback.sizes;
  const normalizedSizes = Object.fromEntries(Object.entries(rawSizes).filter(([id, value]) => allowedIds.has(id) && sizes.has(value as PresentationSize)));
  const replacements = item.replacements && typeof item.replacements === "object" && !Array.isArray(item.replacements)
    ? Object.fromEntries(Object.entries(item.replacements).filter(([id, value]) => allowedIds.has(id) && allowedIds.has(String(value))))
    : fallback.replacements;
  return { order, hidden, sizes: normalizedSizes, replacements, custom };
}

function normalizeResponsive(value: unknown, fallback: SignInResponsiveSettings, widgetIds: string[]): SignInResponsiveSettings {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInResponsiveSettings> : {};
  return {
    desktop: normalizeBreakpoint(item.desktop, fallback.desktop, widgetIds),
    tablet: normalizeBreakpoint(item.tablet, fallback.tablet, widgetIds),
    mobile: normalizeBreakpoint(item.mobile, fallback.mobile, widgetIds),
  };
}

function normalizeAdvancedSource(value: unknown, fallback: SignInAdvancedSource): SignInAdvancedSource {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInAdvancedSource> : {};
  return {
    html: String(item.html ?? fallback.html).slice(0, 24000),
    css: String(item.css ?? fallback.css).slice(0, 36000),
    js: String(item.js ?? fallback.js).slice(0, 24000),
    baseIdentity: String(item.baseIdentity || fallback.baseIdentity).slice(0, 180),
    updatedAt: String(item.updatedAt || fallback.updatedAt).slice(0, 40),
  };
}

function normalizeThemeProfile(value: unknown, fallback: SignInThemeProfile): SignInThemeProfile {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SignInThemeProfile> : {};
  const source = themeSources.has(item.source as SignInThemeSource) ? item.source as SignInThemeSource : fallback.source;
  let status = themeStatuses.has(item.status as SignInThemeStatus) ? item.status as SignInThemeStatus : fallback.status;
  const hasEditableDraft = item.hasEditableDraft === true || source === "Clone" || source === "Custom";
  if (!hasEditableDraft && source === "Portal" && status === "DRAFT") status = fallback.status;
  const portalThemeId = canonicalThemeIds.has(String(item.portalThemeId)) ? String(item.portalThemeId) : fallback.portalThemeId;
  const themeBackground = normalizeThemeBackground(item.background, fallback.background);
  const widgets = normalizeWidgets(item.widgets, fallback.widgets);
  const widgetIds = [...widgets.order, ...presentationWidgetCatalog.map((widget) => widget.id), ...widgets.custom.map((widget) => widget.id)];
  return {
    id: String(item.id || fallback.id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80),
    name: String(item.name || fallback.name).slice(0, 80),
    source,
    version: fallback.id === "reference-v3" && source === "Portal" ? PORTAL_BASELINE_IDENTITY : String(item.version || fallback.version).slice(0, 80),
    status,
    portalThemeId,
    thumbnail: String(item.thumbnail || themeBackground.backgrounds.find((backgroundItem) => backgroundItem.id === themeBackground.defaultBackground)?.source || fallback.thumbnail),
    background: themeBackground,
    visual: normalizeVisual(item.visual, fallback.visual),
    responsive: normalizeResponsive(item.responsive, fallback.responsive, [...new Set(widgetIds)]),
    widgets,
    canvas: normalizeCanvas(item.canvas, fallback.canvas),
    advancedSource: normalizeAdvancedSource(item.advancedSource, fallback.advancedSource),
    hasEditableDraft,
    lastModifiedAt: String(item.lastModifiedAt || fallback.lastModifiedAt).slice(0, 40),
  };
}

function normalizeThemeProfiles(value: unknown, legacyReference?: SignInThemeBackgroundSettings) {
  const supplied = Array.isArray(value) ? value : [];
  const byId = new Map(supplied.filter((item): item is SignInThemeProfile => Boolean(item && typeof item === "object" && !Array.isArray(item) && "id" in item)).map((item) => [String(item.id), item]));
  const required = importedSignInThemeProfiles.map((fallback) => {
    const seeded = fallback.id === "reference-v3" && supplied.length === 0 && legacyReference
      ? { ...fallback, background: legacyReference }
      : fallback;
    return normalizeThemeProfile(byId.get(fallback.id), seeded);
  });
  const requiredIds = new Set(required.map((profile) => profile.id));
  const extras = supplied
    .filter((item): item is SignInThemeProfile => Boolean(item && typeof item === "object" && !Array.isArray(item) && "id" in item && !requiredIds.has(String(item.id))))
    .map((item, index) => normalizeThemeProfile(item, {
      id: `custom-${index + 1}`,
      name: `Custom Sign-In ${index + 1}`,
      source: "Custom",
      version: "Draft 1",
      status: "DRAFT",
      portalThemeId: "reference-v3",
      thumbnail: baseBackgrounds()[0].source,
      background: makeThemeBackground(0),
      visual: defaultVisual(),
      responsive: makeResponsive(),
      widgets: defaultWidgets(),
      canvas: defaultCanvas(),
      advancedSource: defaultAdvancedSource(),
      hasEditableDraft: true,
      lastModifiedAt: new Date().toISOString(),
    }));
  return [...required, ...extras];
}

export function normalizePresentationSettings(value: unknown): PortalPresentationSettings {
  const defaults = copy(importedPresentationDefaults);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const candidate = value as Partial<PortalPresentationSettings>;
  const legacyBackground = normalizeThemeBackground({
    backgrounds: candidate.portal_signin_backgrounds,
    defaultBackground: candidate.portal_signin_background_default,
    autoRotate: false,
    shuffle: false,
    rotationIntervalSeconds: candidate.portal_signin_background_interval_seconds,
    transition: candidate.portal_signin_background_transition,
    transitionMs: candidate.portal_signin_background_transition_ms,
  }, makeThemeBackground(0));
  const profiles = normalizeThemeProfiles(candidate.portal_signin_theme_profiles, legacyBackground);
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const activeThemeId = profileIds.has(String(candidate.portal_signin_active_theme_id)) ? String(candidate.portal_signin_active_theme_id) : defaults.portal_signin_active_theme_id;
  const defaultThemeId = profileIds.has(String(candidate.portal_signin_default_theme_id)) ? String(candidate.portal_signin_default_theme_id) : defaults.portal_signin_default_theme_id;
  const studioThemeId = profileIds.has(String(candidate.portal_signin_studio_theme_id)) ? String(candidate.portal_signin_studio_theme_id) : activeThemeId;
  const activeProfile = profiles.find((profile) => profile.id === activeThemeId) || profiles[0];
  const backgrounds = normalizeBackgrounds(candidate.portal_signin_backgrounds, activeProfile.background.backgrounds);
  const enabledBackgrounds = backgrounds.filter((item) => item.enabled);
  const requestedBackgroundDefault = String(candidate.portal_signin_background_default || activeProfile.background.defaultBackground);
  const backgroundDefault = enabledBackgrounds.some((item) => item.id === requestedBackgroundDefault)
    ? requestedBackgroundDefault
    : enabledBackgrounds[0]?.id || backgrounds[0].id;
  const clocks = Array.isArray(candidate.portal_clock_locations) && candidate.portal_clock_locations.length
    ? candidate.portal_clock_locations.filter((zone) => presentationClockCatalog.some((clock) => clock.zone === zone))
    : defaults.portal_clock_locations;
  const ownerEnabledRotation = candidate.portal_signin_background_rotation_owner_enabled === true;
  const autoRotate = ownerEnabledRotation && candidate.portal_signin_background_rotation === true;
  const activeWidgetIds = [...new Set([...activeProfile.widgets.order, ...activeProfile.widgets.custom.map((widget) => widget.id)])];
  return {
    ...defaults,
    ...candidate,
    portal_signin_backgrounds: backgrounds,
    portal_signin_background_default: backgroundDefault,
    portal_signin_background_rotation: autoRotate,
    portal_signin_background_rotation_owner_enabled: ownerEnabledRotation,
    portal_signin_background_shuffle: autoRotate && candidate.portal_signin_background_shuffle === true,
    portal_clock_locations: clocks.length ? [...new Set(clocks)] : defaults.portal_clock_locations,
    portal_widget_order: Array.isArray(candidate.portal_widget_order) ? candidate.portal_widget_order : defaults.portal_widget_order,
    portal_hidden_widgets: Array.isArray(candidate.portal_hidden_widgets) ? candidate.portal_hidden_widgets : [],
    portal_widget_sizes: candidate.portal_widget_sizes && typeof candidate.portal_widget_sizes === "object" ? candidate.portal_widget_sizes : {},
    portal_widget_replacements: candidate.portal_widget_replacements && typeof candidate.portal_widget_replacements === "object" ? candidate.portal_widget_replacements : {},
    portal_signin_background_interval_seconds: number(candidate.portal_signin_background_interval_seconds, 6, 90, 14),
    portal_signin_background_transition: transitions.has(candidate.portal_signin_background_transition as PresentationTransition)
      ? candidate.portal_signin_background_transition as PresentationTransition
      : defaults.portal_signin_background_transition,
    portal_signin_background_transition_ms: number(candidate.portal_signin_background_transition_ms, 200, 2000, 950),
    portal_signin_background_overlay: number(candidate.portal_signin_background_overlay, 0, 55, 16),
    portal_weather_location_rotation: candidate.portal_weather_location_rotation !== false,
    portal_weather_location_rotation_interval_seconds: number(candidate.portal_weather_location_rotation_interval_seconds, 8, 90, 24),
    portal_signin_glass_intensity: number(candidate.portal_signin_glass_intensity, 55, 100, 82),
    portal_signin_theme_profiles: profiles,
    portal_signin_active_theme_id: activeThemeId,
    portal_signin_default_theme_id: defaultThemeId,
    portal_signin_studio_theme_id: studioThemeId,
    portal_signin_active_portal_theme_id: activeProfile.portalThemeId,
    portal_signin_visual: normalizeVisual(candidate.portal_signin_visual, activeProfile.visual),
    portal_signin_responsive: normalizeResponsive(candidate.portal_signin_responsive, activeProfile.responsive, activeWidgetIds),
    portal_signin_custom_widgets: normalizeCustomWidgets(candidate.portal_signin_custom_widgets ?? activeProfile.widgets.custom),
    portal_signin_canvas: normalizeCanvas(candidate.portal_signin_canvas, activeProfile.canvas),
  };
}

export function presentationSettingsForTheme(settings: PortalPresentationSettings, themeId: string, activate = false) {
  const normalized = normalizePresentationSettings(settings);
  const profile = normalized.portal_signin_theme_profiles.find((item) => item.id === themeId)
    || normalized.portal_signin_theme_profiles.find((item) => item.id === normalized.portal_signin_active_theme_id)
    || normalized.portal_signin_theme_profiles[0];
  const themeBackground = profile.background;
  return normalizePresentationSettings({
    ...normalized,
    portal_signin_studio_theme_id: profile.id,
    portal_signin_active_theme_id: activate ? profile.id : normalized.portal_signin_active_theme_id,
    portal_signin_active_portal_theme_id: activate ? profile.portalThemeId : normalized.portal_signin_active_portal_theme_id,
    portal_signin_backgrounds: copy(themeBackground.backgrounds),
    portal_signin_background_default: themeBackground.defaultBackground,
    portal_signin_background_rotation: themeBackground.autoRotate,
    portal_signin_background_rotation_owner_enabled: themeBackground.autoRotate,
    portal_signin_background_shuffle: themeBackground.autoRotate && themeBackground.shuffle,
    portal_signin_background_interval_seconds: themeBackground.rotationIntervalSeconds,
    portal_signin_background_transition: themeBackground.transition,
    portal_signin_background_transition_ms: themeBackground.transitionMs,
    portal_widget_order: copy(profile.widgets.order),
    portal_hidden_widgets: copy(profile.widgets.hidden),
    portal_widget_sizes: copy(profile.widgets.sizes),
    portal_widget_replacements: copy(profile.widgets.replacements),
    portal_signin_visual: copy(profile.visual),
    portal_signin_responsive: copy(profile.responsive),
    portal_signin_custom_widgets: copy(profile.widgets.custom),
    portal_signin_canvas: copy(profile.canvas),
  });
}

export function createClonedSignInTheme(source: SignInThemeProfile, sequence: number): SignInThemeProfile {
  const cloned = copy(source);
  cloned.id = `clone-${source.id}-${Date.now()}`;
  cloned.name = `${source.name} Copy ${sequence}`;
  cloned.source = "Clone";
  cloned.version = "Draft 1";
  cloned.status = "DRAFT";
  cloned.hasEditableDraft = true;
  cloned.lastModifiedAt = new Date().toISOString();
  cloned.background.autoRotate = false;
  cloned.background.shuffle = false;
  return cloned;
}

export function createCustomSignInTheme(sequence: number): SignInThemeProfile {
  const themeBackground = makeThemeBackground(0);
  return {
    id: `custom-signin-${Date.now()}`,
    name: `Custom Sign-In ${sequence}`,
    source: "Custom",
    version: "Draft 1",
    status: "DRAFT",
    portalThemeId: "reference-v3",
    thumbnail: themeBackground.backgrounds[0].source,
    background: themeBackground,
    visual: defaultVisual(),
    responsive: makeResponsive(),
    widgets: defaultWidgets(),
    canvas: defaultCanvas(),
    advancedSource: defaultAdvancedSource(),
    hasEditableDraft: true,
    lastModifiedAt: new Date().toISOString(),
  };
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
};

export function presentationSnapshotId(value: unknown) {
  const source = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `SNP-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export type PresentationValidationIssue = {
  id: string;
  severity: "ERROR" | "WARNING" | "INFO";
  category: "LAYOUT" | "AUTH" | "ACCESSIBILITY" | "ASSETS" | "MOTION" | "DATA" | "SOURCE" | "CONFIG";
  message: string;
  elementId?: string;
};

export type PresentationValidationResult = {
  passed: boolean;
  errors: number;
  warnings: number;
  snapshotId: string;
  issues: PresentationValidationIssue[];
};

export function validatePresentationForPublish(settings: PortalPresentationSettings, themeId?: string): PresentationValidationResult {
  const normalized = normalizePresentationSettings(settings);
  const profile = normalized.portal_signin_theme_profiles.find((item) => item.id === (themeId || normalized.portal_signin_studio_theme_id)) || normalized.portal_signin_theme_profiles[0];
  const issues: PresentationValidationIssue[] = [];
  const add = (severity: PresentationValidationIssue["severity"], category: PresentationValidationIssue["category"], id: string, message: string, elementId?: string) => issues.push({ severity, category, id, message, ...(elementId ? { elementId } : {}) });
  const counts = new Map<string, number>();
  profile.canvas.elements.forEach((element) => counts.set(element.id, (counts.get(element.id) || 0) + 1));
  counts.forEach((count, id) => { if (count > 1) add("ERROR", "CONFIG", `duplicate-${id}`, `Duplicate component ID “${id}” must be resolved before publishing.`, id); });
  const rows: Record<SignInBreakpoint, number> = { desktop: 18, tablet: 24, mobile: 36 };
  profile.canvas.elements.forEach((element) => {
    canvasBreakpoints.forEach((breakpoint) => {
      const style = element.styles[breakpoint];
      if (style.x + style.width > profile.canvas.columns || style.y + style.height > rows[breakpoint]) {
        add("ERROR", "LAYOUT", `${element.id}-${breakpoint}-overflow`, `${element.name} overflows the ${breakpoint} canvas.`, element.id);
      }
      if (style.width < style.minWidth || style.height < style.minHeight || style.width > style.maxWidth || style.height > style.maxHeight) {
        add("ERROR", "LAYOUT", `${element.id}-${breakpoint}-bounds`, `${element.name} violates its safe size limits on ${breakpoint}.`, element.id);
      }
    });
    if (!element.motion.reducedMotion) add("ERROR", "MOTION", `${element.id}-reduced-motion`, `${element.name} needs a reduced-motion equivalent.`, element.id);
  });
  const auth = profile.canvas.elements.find((element) => element.id === "auth-pavilion");
  const action = profile.canvas.elements.find((element) => element.id === "signin-action");
  if (!auth || !auth.visible) add("ERROR", "AUTH", "auth-missing", "The protected authentication pavilion must remain visible.", "auth-pavilion");
  if (!action || !action.visible) add("ERROR", "AUTH", "signin-action-missing", "The protected Sign-In action must remain visible.", "signin-action");
  if (auth) canvasBreakpoints.forEach((breakpoint) => {
    const style = auth.styles[breakpoint];
    if (style.width < 5 || style.height < 8) add("ERROR", "ACCESSIBILITY", `auth-${breakpoint}-minimum`, `Authentication controls are below the usable minimum on ${breakpoint}.`, auth.id);
  });
  if (profile.background.backgrounds.length < 5) add("ERROR", "ASSETS", "background-count", "At least five managed background slots are required.");
  if (!profile.background.backgrounds.some((item) => item.enabled && item.id === profile.background.defaultBackground)) add("ERROR", "ASSETS", "background-default", "The configured default background is not enabled.");
  const non4k = profile.background.backgrounds.filter((item) => item.enabled && !item.native4k).length;
  if (non4k) add("WARNING", "ASSETS", "native-4k-owner-assets", `${non4k} enabled background slot${non4k === 1 ? "" : "s"} still require Owner-supplied native 4K assets.`);
  if (profile.background.autoRotate) add("INFO", "CONFIG", "background-rotation-owner-enabled", "Automatic background rotation is explicitly enabled for this draft; the system default remains OFF.");
  const unsafeSource = /(fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|eval\s*\(|new\s+Function)/i;
  if (unsafeSource.test(profile.advancedSource.js)) add("ERROR", "SOURCE", "unsafe-source-api", "Advanced presentation source contains a blocked network, storage, cookie, or dynamic-code API.");
  profile.widgets.custom.forEach((widget) => {
    if (!widget.id || !widget.title) add("ERROR", "CONFIG", `custom-widget-${widget.id || "unnamed"}`, "Custom widgets require a stable ID and visible title.", widget.id);
    if (!widget.errorState) add("ERROR", "CONFIG", `${widget.id}-fallback`, `${widget.title} requires a safe error fallback.`, widget.id);
    if (!/presentation|no authoritative|read-only/i.test(widget.permissionsMetadata || "")) add("WARNING", "DATA", `${widget.id}-permissions`, `${widget.title} should explicitly declare presentation-only authority.`, widget.id);
  });
  const weather = profile.canvas.elements.find((element) => element.id === "weather");
  if (weather && !/unavailable|provider|sample|design/i.test(weather.dataBinding)) add("WARNING", "DATA", "weather-truth-label", "Weather must retain a truthful unavailable, provider, sample, or design-data state.", weather.id);
  const errors = issues.filter((issue) => issue.severity === "ERROR").length;
  const warnings = issues.filter((issue) => issue.severity === "WARNING").length;
  return { passed: errors === 0, errors, warnings, snapshotId: presentationSnapshotId(profile), issues };
}

export type PresentationAudit = { id: string; at: string; action: string; note: string; scope: "ChatGPT Sites preview" };
export type PresentationVersionStatus = "IMPORTED" | "DRAFT" | "VALIDATED" | "APPROVED" | "PUBLISHED TO SITES PREVIEW" | "ARCHIVED" | "ROLLED BACK";
export type PresentationVersion = {
  id: string;
  studioVersionId: string;
  version: string;
  versionNumber: number;
  themeId: string;
  theme: string;
  at: string;
  createdAt: string;
  author: string;
  createdBy: string;
  sourceTheme: string;
  status: PresentationVersionStatus;
  summary: string;
  changeSummary: string;
  responsiveChanges: string[];
  componentChanges: string[];
  styleChanges: string[];
  assetChanges: string[];
  sourceConfigSnapshotId: string;
  storage: "browser-recovery-cache";
  snapshot: PortalPresentationSettings;
};

const importedVersion = (): PresentationVersion => ({
  id: "portal-ui-7-2-0-import",
  studioVersionId: "STUDIO-IMPORT-PV-001",
  version: "PV-001",
  versionNumber: 1,
  themeId: "reference-v3",
  theme: "Reference V3",
  at: "2026-09-13T00:00:00.000Z",
  createdAt: "2026-09-13T00:00:00.000Z",
  author: "Portal source import",
  createdBy: "Portal source import",
  sourceTheme: "Reference V3 · Imported Portal Baseline",
  status: "IMPORTED",
  summary: `${PORTAL_BASELINE_IDENTITY}; source-only production baseline retained unchanged.`,
  changeSummary: `${PORTAL_BASELINE_IDENTITY}; source-only production baseline retained unchanged.`,
  responsiveChanges: [],
  componentChanges: [],
  styleChanges: [],
  assetChanges: [],
  sourceConfigSnapshotId: presentationSnapshotId(importedPresentationDefaults),
  storage: "browser-recovery-cache",
  snapshot: copy(importedPresentationDefaults),
});

export function readPresentation(kind: "preview" | "draft" = "preview") {
  if (typeof window === "undefined") return copy(importedPresentationDefaults);
  const key = kind === "draft" ? PRESENTATION_DRAFT_KEY : PRESENTATION_PREVIEW_KEY;
  try { return normalizePresentationSettings(JSON.parse(localStorage.getItem(key) || "null")); }
  catch { return copy(importedPresentationDefaults); }
}

export function readPresentationAudit(): PresentationAudit[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESENTATION_AUDIT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch { return []; }
}

export function readPresentationVersions(): PresentationVersion[] {
  if (typeof window === "undefined") return [importedVersion()];
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESENTATION_VERSIONS_KEY) || "[]");
    const supplied = Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object" && item.snapshot) : [];
    const normalized = supplied.slice(0, 24).map((item, index) => {
      const snapshot = normalizePresentationSettings(item.snapshot);
      const versionNumber = number(item.versionNumber, 1, 9999, Number(String(item.version || "").replace(/\D/g, "")) || index + 2);
      const statusCandidate = item.status === "PUBLISHED" ? "PUBLISHED TO SITES PREVIEW" : item.status;
      const status = (["IMPORTED", "DRAFT", "VALIDATED", "APPROVED", "PUBLISHED TO SITES PREVIEW", "ARCHIVED", "ROLLED BACK"].includes(statusCandidate) ? statusCandidate : "DRAFT") as PresentationVersionStatus;
      const at = String(item.createdAt || item.at || new Date().toISOString());
      const author = String(item.createdBy || item.author || "Owner preview");
      const summary = String(item.changeSummary || item.summary || "Presentation settings changed.");
      return {
        id: String(item.id || `presentation-version-${index + 1}`),
        studioVersionId: String(item.studioVersionId || `STUDIO-${String(versionNumber).padStart(4, "0")}`),
        version: String(item.version || `SV-${String(versionNumber).padStart(3, "0")}`),
        versionNumber,
        themeId: String(item.themeId || "reference-v3"),
        theme: String(item.theme || "Reference V3"),
        at,
        createdAt: at,
        author,
        createdBy: author,
        sourceTheme: String(item.sourceTheme || item.theme || "Reference V3"),
        status,
        summary,
        changeSummary: summary,
        responsiveChanges: Array.isArray(item.responsiveChanges) ? item.responsiveChanges.map(String).slice(0, 40) : [],
        componentChanges: Array.isArray(item.componentChanges) ? item.componentChanges.map(String).slice(0, 40) : [],
        styleChanges: Array.isArray(item.styleChanges) ? item.styleChanges.map(String).slice(0, 40) : [],
        assetChanges: Array.isArray(item.assetChanges) ? item.assetChanges.map(String).slice(0, 40) : [],
        sourceConfigSnapshotId: String(item.sourceConfigSnapshotId || presentationSnapshotId(snapshot)),
        storage: "browser-recovery-cache" as const,
        snapshot,
      };
    });
    return normalized.some((item) => item.id === "portal-ui-7-2-0-import") ? normalized : [...normalized, importedVersion()];
  } catch { return [importedVersion()]; }
}

export function recordPresentationVersion(settings: PortalPresentationSettings, status: PresentationVersionStatus, summary: string, author = "Owner preview") {
  if (typeof window === "undefined") return null;
  const theme = settings.portal_signin_theme_profiles.find((item) => item.id === settings.portal_signin_studio_theme_id)
    || settings.portal_signin_theme_profiles[0];
  const existing = readPresentationVersions();
  const sequence = Math.max(1, ...existing.map((item) => Number(item.version.replace(/\D/g, "")) || 1)) + 1;
  const snapshot = normalizePresentationSettings(settings);
  const createdAt = new Date().toISOString();
  const snapshotId = presentationSnapshotId(snapshot);
  const canvas = theme?.canvas;
  const customCount = theme?.widgets.custom.length || 0;
  const entry: PresentationVersion = {
    id: `sites-presentation-${Date.now()}`,
    studioVersionId: `STUDIO-${String(sequence).padStart(4, "0")}-${snapshotId.slice(-4)}`,
    version: `SV-${String(sequence).padStart(3, "0")}`,
    versionNumber: sequence,
    themeId: theme?.id || settings.portal_signin_studio_theme_id,
    theme: theme?.name || "Sign-In presentation",
    at: createdAt,
    createdAt,
    author,
    createdBy: author,
    sourceTheme: `${theme?.name || "Sign-In presentation"} · ${theme?.source || "Custom"}`,
    status,
    summary: summary.slice(0, 280),
    changeSummary: summary.slice(0, 280),
    responsiveChanges: canvas ? ["Desktop, tablet and mobile layout snapshots included"] : [],
    componentChanges: [`${canvas?.elements.length || 0} canvas layers`, `${customCount} saved or draft custom components`],
    styleChanges: ["Visual tokens and per-element inspector styles included"],
    assetChanges: [`${theme?.background.backgrounds.length || 0} managed background references`],
    sourceConfigSnapshotId: snapshotId,
    storage: "browser-recovery-cache",
    snapshot,
  };
  localStorage.setItem(PRESENTATION_VERSIONS_KEY, JSON.stringify([entry, ...existing].slice(0, 24)));
  return entry;
}

export function restorePresentationVersion(versionId: string) {
  if (typeof window === "undefined") return null;
  const version = readPresentationVersions().find((item) => item.id === versionId);
  if (!version) return null;
  const restored = normalizePresentationSettings(version.snapshot);
  localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify(restored));
  recordPresentationAudit("Version selected for rollback", `${version.version} · ${version.theme} restored to the isolated draft. Active Sites preview unchanged.`);
  recordPresentationVersion(restored, "ROLLED BACK", `Draft restored from ${version.version}; explicit Publish is still required.`);
  return restored;
}

export function recordPresentationAudit(action: string, note: string) {
  if (typeof window === "undefined") return;
  const entry: PresentationAudit = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), action, note, scope: "ChatGPT Sites preview" };
  localStorage.setItem(PRESENTATION_AUDIT_KEY, JSON.stringify([entry, ...readPresentationAudit()].slice(0, 30)));
}

export function savePresentationDraft(settings: PortalPresentationSettings) {
  const normalized = normalizePresentationSettings(settings);
  localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify(normalized));
  recordPresentationAudit("Draft saved", "Existing presentation-settings contract retained; active preview unchanged.");
  return normalized;
}

export function stagePresentationDraft(settings: PortalPresentationSettings) {
  const normalized = normalizePresentationSettings(settings);
  localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify(normalized));
  return normalized;
}

export function publishPresentationPreview(settings: PortalPresentationSettings) {
  const current = readPresentation("preview");
  const normalized = normalizePresentationSettings(settings);
  localStorage.setItem(PRESENTATION_PREVIOUS_KEY, JSON.stringify(current));
  localStorage.setItem(PRESENTATION_PREVIEW_KEY, JSON.stringify(normalized));
  localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify(normalized));
  recordPresentationAudit("Published to Sites preview", "Presentation-only values applied to this browser. Production and security policy were not changed.");
  return normalized;
}

export function restorePreviousPresentation() {
  const raw = localStorage.getItem(PRESENTATION_PREVIOUS_KEY);
  if (!raw) return null;
  const current = readPresentation("preview");
  const previous = normalizePresentationSettings(JSON.parse(raw));
  localStorage.setItem(PRESENTATION_PREVIOUS_KEY, JSON.stringify(current));
  localStorage.setItem(PRESENTATION_PREVIEW_KEY, JSON.stringify(previous));
  localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify(previous));
  recordPresentationAudit("Previous preview restored", "Browser-local preview configuration restored; production unchanged.");
  return previous;
}
