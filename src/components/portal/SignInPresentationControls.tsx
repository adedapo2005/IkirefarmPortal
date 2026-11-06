"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Archive, ArrowDown, ArrowUp, Bot, Boxes, Check, ChevronLeft, ChevronRight, Clock3, CloudSun,
  Code2, Copy, Download, Eye, FileCode2, GripVertical, History, ImagePlus, LayoutGrid,
  Layers3, Monitor, MonitorCog, Move, Palette, Plus, RefreshCw, RotateCcw, Save, ShieldCheck,
  SlidersHorizontal, Smartphone, Sparkles, Tablet, Trash2, Upload, X,
} from "lucide-react";
import {
  AIDesignerPanel, ComponentLibraryPanel, PublishValidationPanel, RepositorySnapshotPanel,
  SignInStudioCanvas,
} from "@/components/portal/SignInStudioBuilder";
import { has, isOwnerPrincipal, type Persona } from "@/lib/portal-model";
import {
  PORTAL_BASELINE_BLOB, PORTAL_BASELINE_IDENTITY,
  createClonedSignInTheme, createCustomSignInTheme, importedPresentationDefaults,
  normalizePresentationSettings, presentationClockCatalog, presentationSettingsForTheme,
  presentationSnapshotId, presentationWidgetCatalog, publishPresentationPreview, readPresentation,
  readPresentationAudit, readPresentationVersions, recordPresentationVersion,
  restorePresentationVersion, restorePreviousPresentation, savePresentationDraft,
  stagePresentationDraft, validatePresentationForPublish,
  type PortalPresentationSettings, type PresentationBackground, type PresentationSize,
  type SignInAdvancedSource, type SignInBreakpoint, type SignInBreakpointSettings,
  type SignInCustomWidget, type SignInThemeBackgroundSettings, type SignInThemeProfile,
  type SignInVisualSettings, type SignInWidgetKind, type SignInWidgetPlacement,
} from "@/lib/portal-presentation-settings";

type Tab = "canvas" | "gallery" | "backgrounds" | "visual" | "responsive" | "weather-time" | "widgets" | "library" | "compare" | "versions" | "validation" | "ai" | "advanced" | "repository" | "audit";
type PreviewMode = SignInBreakpoint;
type PendingUpload = { file: File; url: string; width: number; height: number; native4k: boolean; replaceId?: string };
type SourceValidation = { state: "idle" | "valid" | "invalid"; messages: string[] };

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const previewModes: Array<{ id: PreviewMode; label: string; icon: typeof Monitor }> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];
const widgetKinds: SignInWidgetKind[] = ["insight", "metric", "media", "status"];

function Range({ label, value, min = 0, max = 100, step = 1, suffix = "%", onChange }: { label: string; value: number; min?: number; max?: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="signin-admin-range"><span><strong>{label}</strong><output>{value}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Toggle({ checked, label, detail, disabled = false, onChange }: { checked: boolean; label: string; detail?: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="signin-admin-toggle"><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function OrderButtons({ first, last, label, onUp, onDown }: { first: boolean; last: boolean; label: string; onUp: () => void; onDown: () => void }) {
  return <span className="signin-admin-order"><button type="button" disabled={first} aria-label={`Move ${label} earlier`} onClick={onUp}><ArrowUp /></button><button type="button" disabled={last} aria-label={`Move ${label} later`} onClick={onDown}><ArrowDown /></button></span>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="signin-admin-color"><span>{label}</span><span><input type="color" value={value} aria-label={`${label} color`} onChange={(event) => onChange(event.target.value)} /><input type="text" value={value} maxLength={7} onChange={(event) => onChange(event.target.value)} /></span></label>;
}

function reorder<T>(items: T[], index: number, movement: -1 | 1) {
  const next = [...items];
  const target = index + movement;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function replaceTheme(settings: PortalPresentationSettings, themeId: string, transform: (theme: SignInThemeProfile) => SignInThemeProfile) {
  return normalizePresentationSettings({
    ...settings,
    portal_signin_studio_theme_id: themeId,
    portal_signin_theme_profiles: settings.portal_signin_theme_profiles.map((theme) => theme.id === themeId ? transform(clone(theme)) : theme),
  });
}

function formatBytes(bytes = 0) {
  if (!bytes) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB"];
  const level = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** level).toFixed(level > 1 ? 1 : 0)} ${units[level]}`;
}

function widgetLabel(id: string, custom: SignInCustomWidget[]) {
  return presentationWidgetCatalog.find((item) => item.id === id)?.label || custom.find((item) => item.id === id)?.name || id;
}

function fingerprint(value: unknown) {
  const serialized = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < serialized.length; index += 1) hash = ((hash << 5) + hash) ^ serialized.charCodeAt(index);
  return `CFG-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function validateAdvancedSource(source: SignInAdvancedSource): SourceValidation {
  const messages: string[] = [];
  const combined = `${source.html}\n${source.css}\n${source.js}`;
  const forbidden: Array<[RegExp, string]> = [
    [/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b/i, "Network APIs are blocked."],
    [/\b(document\.cookie|localStorage|sessionStorage)\b/i, "Session and browser storage APIs are blocked."],
    [/\b(Authorization|Bearer|secret|password)\b/i, "Credential or secret-like source is blocked."],
    [/(?:\/api\/|https?:\/\/)/i, "Direct endpoint references are blocked in presentation source."],
  ];
  if (/<script\b/i.test(source.html)) messages.push("HTML must not contain script elements; use the isolated JS field.");
  if (/<(?:iframe|object|embed)\b/i.test(source.html)) messages.push("Embedded browsing contexts are blocked in presentation HTML.");
  forbidden.forEach(([pattern, message]) => pattern.test(combined) && messages.push(message));
  if (combined.length > 84000) messages.push("Source exceeds the 84 KB presentation-only limit.");
  return messages.length ? { state: "invalid", messages } : { state: "valid", messages: ["Presentation boundary valid: no network, credentials, auth, RBAC, or storage access detected."] };
}

function diffSettings(live: PortalPresentationSettings, selected: SignInThemeProfile) {
  const active = live.portal_signin_theme_profiles.find((theme) => theme.id === live.portal_signin_active_theme_id) || live.portal_signin_theme_profiles[0];
  const rows: Array<{ group: string; detail: string }> = [];
  if (active.id !== selected.id) rows.push({ group: "Theme", detail: `${active.name} → ${selected.name}` });
  if (JSON.stringify(active.background) !== JSON.stringify(selected.background)) rows.push({ group: "Backgrounds", detail: `Default, focal, asset, or rotation settings changed. Auto Rotate ${selected.background.autoRotate ? "ON" : "OFF"}.` });
  if (JSON.stringify(active.visual) !== JSON.stringify(selected.visual)) rows.push({ group: "Visual system", detail: "Copy, color, gradient, typography, glass, border, glow, shadow, spacing, radius, or motion changed." });
  const activeElements = new Map(active.canvas.elements.map((element) => [element.id, element]));
  const selectedElements = new Map(selected.canvas.elements.map((element) => [element.id, element]));
  const canvasAdded = selected.canvas.elements.filter((element) => !activeElements.has(element.id));
  const canvasDeleted = active.canvas.elements.filter((element) => !selectedElements.has(element.id));
  if (canvasAdded.length) rows.push({ group: "Widgets", detail: `Added: ${canvasAdded.map((element) => element.name).join(", ")}.` });
  if (canvasDeleted.length) rows.push({ group: "Widgets", detail: `Deleted: ${canvasDeleted.map((element) => element.name).join(", ")}.` });
  selected.canvas.elements.forEach((element) => {
    const before = activeElements.get(element.id); if (!before) return;
    (['desktop', 'tablet', 'mobile'] as const).forEach((mode) => {
      const a = before.styles[mode]; const b = element.styles[mode];
      if (a.x !== b.x || a.y !== b.y) rows.push({ group: "Layout", detail: `${element.name} moved on ${mode}: (${a.x}, ${a.y}) → (${b.x}, ${b.y}).` });
      if (a.width !== b.width || a.height !== b.height) rows.push({ group: "Responsive", detail: `${element.name} resized on ${mode}: ${a.width}×${a.height} → ${b.width}×${b.height}.` });
      const activeStyle = Object.fromEntries(Object.entries(a).filter(([key]) => !["x", "y", "width", "height"].includes(key)));
      const draftStyle = Object.fromEntries(Object.entries(b).filter(([key]) => !["x", "y", "width", "height"].includes(key)));
      if (JSON.stringify(activeStyle) !== JSON.stringify(draftStyle)) rows.push({ group: "Style", detail: `${element.name} presentation style changed on ${mode}.` });
    });
    if (before.visible !== element.visible) rows.push({ group: "Widgets", detail: `${element.name} ${element.visible ? "shown" : "hidden"}.` });
    if (before.variant !== element.variant) rows.push({ group: "Style", detail: `${element.name} variant: ${before.variant} → ${element.variant}; binding retained.` });
    if (JSON.stringify(before.motion) !== JSON.stringify(element.motion)) rows.push({ group: "Style", detail: `${element.name} motion/effect settings changed with reduced-motion fallback.` });
  });
  (["desktop", "tablet", "mobile"] as const).forEach((mode) => {
    if (JSON.stringify(active.responsive[mode]) !== JSON.stringify(selected.responsive[mode])) rows.push({ group: mode[0].toUpperCase() + mode.slice(1), detail: "Independent responsive arrangement changed." });
  });
  const activeIds = new Set(active.widgets.order);
  const draftIds = new Set(selected.widgets.order);
  const added = [...draftIds].filter((id) => !activeIds.has(id));
  const removed = [...activeIds].filter((id) => !draftIds.has(id));
  if (added.length) rows.push({ group: "Widgets added", detail: added.map((id) => widgetLabel(id, selected.widgets.custom)).join(", ") });
  if (removed.length) rows.push({ group: "Widgets removed", detail: removed.map((id) => widgetLabel(id, active.widgets.custom)).join(", ") });
  if (JSON.stringify(active.widgets) !== JSON.stringify(selected.widgets) && !added.length && !removed.length) rows.push({ group: "Widgets", detail: "Visibility, order, size, replacement, or configuration changed." });
  if (JSON.stringify(active.advancedSource) !== JSON.stringify(selected.advancedSource)) rows.push({ group: "Source", detail: `${active.advancedSource.baseIdentity} → isolated draft source` });
  return rows.length ? rows : [{ group: "No difference", detail: "The selected draft matches Sites Preview Active." }];
}

export default function SignInPresentationControls({
  person,
  readOnly = false,
}: {
  person: Persona;
  readOnly?: boolean;
}) {
  const authorized = isOwnerPrincipal(person) || has(person, "users.admin");
  const [settings, setSettings] = useState<PortalPresentationSettings>(() => readPresentation("draft"));
  const [liveSettings, setLiveSettings] = useState<PortalPresentationSettings>(() => readPresentation("preview"));
  const [tab, setTab] = useState<Tab>("canvas");
  const [notice, setNotice] = useState("Imported Portal Baseline loaded. No editable draft exists until a setting changes or Save Draft is selected.");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [selectedThemeId, setSelectedThemeId] = useState(() => settings.portal_signin_studio_theme_id || "reference-v3");
  const [assetReference, setAssetReference] = useState("");
  const [assetName, setAssetName] = useState("");
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<string[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState("weather");
  const [showCustomCreator, setShowCustomCreator] = useState(true);
  const [customDraft, setCustomDraft] = useState({ name: "Field Intelligence", kind: "insight" as SignInWidgetKind, title: "Farm Intelligence", content: "Owner-managed presentation content.", sourceLabel: "Design content", dataBinding: "No authoritative data binding" });
  const [sourceUnlocked, setSourceUnlocked] = useState(false);
  const [sourceValidation, setSourceValidation] = useState<SourceValidation>({ state: "idle", messages: ["Run validation before saving a source version."] });
  const [compareFilter, setCompareFilter] = useState("ALL");
  const uploadRef = useRef<HTMLInputElement>(null);
  const sourceImportRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | undefined>(undefined);

  const selectedTheme = settings.portal_signin_theme_profiles.find((theme) => theme.id === selectedThemeId)
    || settings.portal_signin_theme_profiles.find((theme) => theme.id === settings.portal_signin_active_theme_id)
    || settings.portal_signin_theme_profiles[0];
  const activeTheme = liveSettings.portal_signin_theme_profiles.find((theme) => theme.id === liveSettings.portal_signin_active_theme_id)
    || liveSettings.portal_signin_theme_profiles[0];
  const themeBackground = selectedTheme.background;
  const breakpoint = selectedTheme.responsive[previewMode];
  const versions = useMemo(() => readPresentationVersions(), [historyRevision]);
  const audits = useMemo(() => readPresentationAudit(), [historyRevision]);
  const changes = useMemo(() => diffSettings(liveSettings, selectedTheme), [liveSettings, selectedTheme]);

  if (!authorized) return <section className="signin-admin-denied" role="alert"><ShieldCheck /><div><h2>Sign-In Experience Is Restricted</h2><p>Owner or explicitly authorized presentation-administration permission is required.</p></div></section>;

  if (readOnly) {
    return (
      <section className="signin-admin-locked" aria-labelledby="signin-locked-title">
        <span className="signin-admin-locked-icon"><ShieldCheck aria-hidden="true" /></span>
        <div>
          <span className="signin-admin-locked-kicker">Protected production experience</span>
          <h2 id="signin-locked-title">Sign-In Presentation Is Locked</h2>
          <p>
            Stage 19 is limited to the post-login FarmPortal experience. The approved sign-in
            presentation remains visible in its current release and cannot be changed from this workspace.
          </p>
          <dl>
            <div><dt>Active theme</dt><dd>{activeTheme.name}</dd></div>
            <div><dt>Access mode</dt><dd>Inspection only</dd></div>
            <div><dt>Change control</dt><dd>Separate approval required</dd></div>
          </dl>
        </div>
      </section>
    );
  }

  const markDraft = (theme: SignInThemeProfile): SignInThemeProfile => ({ ...theme, status: "DRAFT", hasEditableDraft: true, lastModifiedAt: new Date().toISOString() });
  const update = <K extends keyof PortalPresentationSettings>(key: K, value: PortalPresentationSettings[K]) => setSettings((current) => normalizePresentationSettings({ ...current, [key]: value }));
  const mutateTheme = (transform: (theme: SignInThemeProfile) => SignInThemeProfile) => setSettings((current) => replaceTheme(current, selectedTheme.id, (theme) => markDraft(transform(theme))));
  const updateTheme = (patch: Partial<SignInThemeProfile>) => mutateTheme((theme) => ({ ...theme, ...patch }));
  const updateThemeBackground = (patch: Partial<SignInThemeBackgroundSettings>) => mutateTheme((theme) => ({ ...theme, background: { ...theme.background, ...patch } }));
  const updateBackground = (id: string, patch: Partial<PresentationBackground>) => mutateTheme((theme) => ({ ...theme, background: { ...theme.background, backgrounds: theme.background.backgrounds.map((item) => item.id === id ? { ...item, ...patch } : item) } }));
  const updateVisual = (patch: Partial<SignInVisualSettings>) => mutateTheme((theme) => ({ ...theme, visual: { ...theme.visual, ...patch } }));
  const updateBreakpoint = (patch: Partial<SignInBreakpointSettings>) => mutateTheme((theme) => ({ ...theme, responsive: { ...theme.responsive, [previewMode]: { ...theme.responsive[previewMode], ...patch } } }));
  const updatePlacement = (id: string, patch: Partial<SignInWidgetPlacement>) => updateBreakpoint({ widgets: { ...breakpoint.widgets, [id]: { ...breakpoint.widgets[id], ...patch } } });

  const selectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    setSettings((current) => normalizePresentationSettings({ ...current, portal_signin_studio_theme_id: themeId }));
    setSourceUnlocked(false);
    setNotice("Theme opened for inspection. Sites Preview Active and Portal Production Baseline are unchanged.");
  };

  const prepareDraft = (input = settings, themeId = selectedTheme.id, mark = false) => {
    const marked = mark ? replaceTheme(input, themeId, (theme) => markDraft(theme)) : input;
    return presentationSettingsForTheme({ ...marked, portal_signin_studio_theme_id: themeId }, themeId, false);
  };

  const saveDraft = (summary = "Owner saved an isolated presentation draft.") => {
    const prepared = prepareDraft(settings, selectedTheme.id, true);
    savePresentationDraft(prepared);
    const version = recordPresentationVersion(prepared, "DRAFT", summary);
    setSettings(prepared);
    setHistoryRevision((value) => value + 1);
    setNotice(`${version?.version || "Draft"} saved. Sites Preview Active and Portal Production Baseline are unchanged.`);
    return prepared;
  };

  const previewDraft = () => {
    const prepared = prepareDraft();
    stagePresentationDraft(prepared);
    setSettings(prepared);
    setPreviewRevision((value) => value + 1);
    setNotice("Isolated draft preview refreshed. Preview never changes the active Sign-In.");
  };

  const previewTheme = (themeId: string) => {
    const prepared = presentationSettingsForTheme(
      { ...settings, portal_signin_studio_theme_id: themeId },
      themeId,
      false,
    );
    stagePresentationDraft(prepared);
    setSelectedThemeId(themeId);
    setSettings(prepared);
    setSourceUnlocked(false);
    setPreviewRevision((value) => value + 1);
    setNotice("Selected theme opened in the isolated preview. Sites Preview Active is unchanged.");
  };

  const publishPreview = () => {
    const persistent = selectedTheme.background.backgrounds.filter((item) => !item.source.startsWith("blob:"));
    if (persistent.filter((item) => item.enabled).length < 5) return setNotice("Publish stopped: five enabled persistent background references are required. Register local upload previews first.");
    const approved = replaceTheme(settings, selectedTheme.id, (theme) => ({ ...theme, status: "APPROVED", hasEditableDraft: false, lastModifiedAt: new Date().toISOString(), background: { ...theme.background, backgrounds: persistent } }));
    const published = presentationSettingsForTheme(approved, selectedTheme.id, true);
    const validation = validatePresentationForPublish(published, selectedTheme.id);
    if (!validation.passed) { setTab("validation"); return setNotice(`Publish blocked: ${validation.errors} serious validation error${validation.errors === 1 ? "" : "s"}. Resolve them in Publish Validation.`); }
    publishPresentationPreview(published);
    recordPresentationVersion(published, "PUBLISHED TO SITES PREVIEW", `${selectedTheme.name} explicitly published to Sites Preview only.`);
    setSettings(published);
    setLiveSettings(published);
    setPreviewRevision((value) => value + 1);
    setHistoryRevision((value) => value + 1);
    setNotice(`${selectedTheme.name} published to Sites Preview Active. Portal production was not modified.`);
  };

  const restoreLastPublished = () => {
    const restored = restorePreviousPresentation();
    if (!restored) return setNotice("No previous Sites Preview publication is available in this browser.");
    setSettings(restored); setLiveSettings(restored); setSelectedThemeId(restored.portal_signin_active_theme_id);
    recordPresentationVersion(restored, "ROLLED BACK", "Previous Sites Preview publication restored explicitly.");
    setPreviewRevision((value) => value + 1); setHistoryRevision((value) => value + 1);
    setNotice("Previous Sites Preview publication restored. Portal production remains unchanged.");
  };

  const restoreVersionToDraft = (id: string) => {
    const restored = restorePresentationVersion(id);
    if (!restored) return setNotice("Selected version could not be restored.");
    setSettings(restored); setSelectedThemeId(restored.portal_signin_studio_theme_id);
    setHistoryRevision((value) => value + 1); setPreviewRevision((value) => value + 1);
    setNotice("Selected version restored to the isolated draft. Explicit Publish is still required.");
  };

  const resetDraft = () => {
    localPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setLocalPreviewUrls([]); setPendingUpload(null);
    const defaults = clone(importedPresentationDefaults);
    setSettings(defaults); setSelectedThemeId("reference-v3"); savePresentationDraft(defaults);
    setPreviewRevision((value) => value + 1);
    setNotice("Draft reset to Imported Portal Baseline. Sites Preview Active is unchanged.");
  };

  const cloneTheme = (theme: SignInThemeProfile, openAdvanced = false) => {
    const cloned = createClonedSignInTheme(theme, settings.portal_signin_theme_profiles.filter((item) => item.source === "Clone").length + 1);
    const next = normalizePresentationSettings({ ...settings, portal_signin_studio_theme_id: cloned.id, portal_signin_theme_profiles: [...settings.portal_signin_theme_profiles, cloned] });
    setSettings(next); setSelectedThemeId(cloned.id); setSourceUnlocked(openAdvanced);
    if (openAdvanced) setTab("advanced");
    setNotice("Protected clone created with Auto Rotate OFF. Imported source and Sites Preview Active are unchanged.");
  };

  const createCustomTheme = () => {
    const custom = createCustomSignInTheme(settings.portal_signin_theme_profiles.filter((item) => item.source === "Custom").length + 1);
    setSettings((current) => normalizePresentationSettings({ ...current, portal_signin_studio_theme_id: custom.id, portal_signin_theme_profiles: [...current.portal_signin_theme_profiles, custom] }));
    setSelectedThemeId(custom.id); setSourceUnlocked(true); setTab("visual");
    setNotice("Custom theme created as an isolated draft with Auto Rotate OFF.");
  };

  const addBackgroundReference = () => {
    const source = assetReference.trim();
    if (!source || (!source.startsWith("/") && !/^https:\/\//i.test(source))) return setNotice("Use an HTTPS URL or an existing /assets/ reference.");
    const item: PresentationBackground = { id: `owner-reference-${Date.now()}`, name: assetName.trim() || `Owner Background ${themeBackground.backgrounds.length + 1}`, enabled: true, native4k: false, source, width: 0, height: 0, desktopFocalX: 50, desktopFocalY: 50, tabletFocalX: 50, tabletFocalY: 38, mobileFocalX: 50, mobileFocalY: 30, brightness: 100, overlay: 16 };
    updateThemeBackground({ backgrounds: [...themeBackground.backgrounds, item] }); setAssetReference(""); setAssetName("");
    setNotice("Background reference added to this draft. Dimensions remain unverified until the asset loads.");
  };

  const inspectUpload = (file?: File, replaceId = replaceTargetRef.current) => {
    replaceTargetRef.current = undefined;
    if (!file || !file.type.startsWith("image/")) return setNotice("Select a supported AVIF, JPEG, PNG, or WebP image.");
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (pendingUpload) URL.revokeObjectURL(pendingUpload.url);
      setPendingUpload({ file, url: objectUrl, width: image.naturalWidth, height: image.naturalHeight, native4k: image.naturalWidth >= 3840 && image.naturalHeight >= 2160, replaceId });
      setDragActive(false); setNotice(`${file.name} staged: ${image.naturalWidth} × ${image.naturalHeight}, ${formatBytes(file.size)}. Review before adding.`);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); setNotice("Image metadata could not be read."); };
    image.src = objectUrl;
  };

  const commitUpload = () => {
    if (!pendingUpload) return;
    const replacement = pendingUpload.replaceId ? themeBackground.backgrounds.find((item) => item.id === pendingUpload.replaceId) : undefined;
    const item: PresentationBackground = {
      id: replacement?.id || `local-upload-${Date.now()}`, name: assetName.trim() || pendingUpload.file.name, enabled: true,
      native4k: pendingUpload.native4k, source: pendingUpload.url, width: pendingUpload.width, height: pendingUpload.height,
      fileSizeBytes: pendingUpload.file.size, mediaType: pendingUpload.file.type, localOnly: true,
      desktopFocalX: replacement?.desktopFocalX ?? 50, desktopFocalY: replacement?.desktopFocalY ?? 50,
      tabletFocalX: replacement?.tabletFocalX ?? 50, tabletFocalY: replacement?.tabletFocalY ?? 38,
      mobileFocalX: replacement?.mobileFocalX ?? 50, mobileFocalY: replacement?.mobileFocalY ?? 30,
      brightness: replacement?.brightness ?? 100, overlay: replacement?.overlay ?? 16,
    };
    const backgrounds = replacement ? themeBackground.backgrounds.map((background) => background.id === replacement.id ? item : background) : [...themeBackground.backgrounds, item];
    updateThemeBackground({ backgrounds }); setLocalPreviewUrls((current) => [...current, pendingUpload.url]); setPendingUpload(null); setAssetName("");
    setNotice("Upload added to this browser-local draft. Register/export the asset before publishing; production remains untouched.");
  };

  const cycleBackground = (movement: -1 | 1) => {
    const enabled = themeBackground.backgrounds.filter((item) => item.enabled);
    if (!enabled.length) return;
    const currentIndex = Math.max(0, enabled.findIndex((item) => item.id === themeBackground.defaultBackground));
    const next = enabled[(currentIndex + movement + enabled.length) % enabled.length];
    mutateTheme((theme) => ({ ...theme, thumbnail: next.source, background: { ...theme.background, defaultBackground: next.id } }));
    setPreviewRevision((value) => value + 1); setNotice(`${next.name} selected in the draft. Sites Preview Active is unchanged.`);
  };

  const removeBackground = (item: PresentationBackground) => {
    if (themeBackground.backgrounds.length <= 5) return setNotice("Five background slots are retained. Replace or disable this slot instead.");
    const remaining = themeBackground.backgrounds.filter((background) => background.id !== item.id);
    updateThemeBackground({ backgrounds: remaining, defaultBackground: themeBackground.defaultBackground === item.id ? remaining.find((background) => background.enabled)?.id || remaining[0].id : themeBackground.defaultBackground });
    setNotice("Background removed from the isolated draft only.");
  };

  const moveBreakpointWidget = (id: string, movement: -1 | 1) => {
    const ordered = selectedTheme.widgets.order.slice().sort((a, b) => (breakpoint.widgets[a]?.order ?? 99) - (breakpoint.widgets[b]?.order ?? 99));
    const index = ordered.indexOf(id); const target = index + movement;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const nextWidgets = clone(breakpoint.widgets); const currentOrder = nextWidgets[id].order;
    nextWidgets[id].order = nextWidgets[ordered[target]].order; nextWidgets[ordered[target]].order = currentOrder;
    updateBreakpoint({ widgets: nextWidgets });
  };

  const updateWidgetSettings = (transform: (theme: SignInThemeProfile) => SignInThemeProfile) => mutateTheme(transform);
  const toggleWidget = (id: string, visible: boolean) => updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, hidden: visible ? theme.widgets.hidden.filter((item) => item !== id) : [...new Set([...theme.widgets.hidden, id])] } }));
  const reorderWidget = (index: number, movement: -1 | 1) => updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, order: reorder(theme.widgets.order, index, movement) } }));
  const removeWidget = (id: string) => {
    if (["weather", "world-clock"].includes(id)) return setNotice("Weather and Global Time are required baseline widgets; hide them per breakpoint instead.");
    updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, order: theme.widgets.order.filter((item) => item !== id), hidden: theme.widgets.hidden.filter((item) => item !== id), custom: theme.widgets.custom.filter((item) => item.id !== id) } }));
    setNotice("Optional widget removed from this theme draft only.");
  };

  const addExistingWidget = (id: string) => updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, order: [...theme.widgets.order, id] } }));
  const duplicateWidget = (id: string) => {
    const sourceName = widgetLabel(id, selectedTheme.widgets.custom); const sourceCustom = selectedTheme.widgets.custom.find((item) => item.id === id);
    const duplicate: SignInCustomWidget = { id: `custom-widget-${Date.now()}`, name: `${sourceName} Copy`, kind: sourceCustom?.kind || "insight", title: sourceCustom?.title || sourceName, content: sourceCustom?.content || "Presentation duplicate. Authoritative live data is not copied.", sourceLabel: sourceCustom?.sourceLabel || "Presentation duplicate", dataBinding: sourceCustom?.dataBinding || "Read-only binding pending authorization", enabled: true, duplicatedFrom: id };
    updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, order: [...theme.widgets.order, duplicate.id], custom: [...theme.widgets.custom, duplicate] } }));
    setSelectedWidgetId(duplicate.id); setNotice("Widget duplicated as a presentation-only surface. No RBAC or data authority was copied.");
  };

  const createCustomWidget = () => {
    const widget: SignInCustomWidget = { id: `custom-widget-${Date.now()}`, ...customDraft, enabled: true };
    updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, order: [...theme.widgets.order, widget.id], custom: [...theme.widgets.custom, widget] } }));
    setSelectedWidgetId(widget.id); setNotice("Custom presentation widget added. It has no auth, RBAC, or authoritative write capability.");
  };
  const updateCustomWidget = (id: string, patch: Partial<SignInCustomWidget>) => updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, custom: theme.widgets.custom.map((item) => item.id === id ? { ...item, ...patch } : item) } }));

  const sourcePatch = (patch: Partial<SignInAdvancedSource>) => {
    if (!sourceUnlocked || !["Clone", "Custom"].includes(selectedTheme.source)) return setNotice("Clone this source before editing. Imported Portal and Sites sources remain immutable.");
    updateTheme({ advancedSource: { ...selectedTheme.advancedSource, ...patch, updatedAt: new Date().toISOString() } });
    setSourceValidation({ state: "idle", messages: ["Source changed. Run validation before saving a version."] });
  };
  const runSourceValidation = () => {
    const result = validateAdvancedSource(selectedTheme.advancedSource); setSourceValidation(result);
    setNotice(result.state === "valid" ? "Advanced source passed the isolated presentation boundary." : "Advanced source validation failed. Nothing was saved or published.");
    return result;
  };
  const saveSourceVersion = () => { if (runSourceValidation().state === "valid") saveDraft("Validated advanced presentation source saved as a new isolated version."); };
  const importSource = async (file?: File) => {
    if (!file) return;
    if (!sourceUnlocked || !["Clone", "Custom"].includes(selectedTheme.source)) return setNotice("Clone the imported source before importing a compatible file.");
    const content = (await file.text()).slice(0, 36000); const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "html" || extension === "htm") sourcePatch({ html: content });
    else if (extension === "css") sourcePatch({ css: content });
    else if (extension === "js") sourcePatch({ js: content });
    else if (extension === "json") {
      try { const parsed = JSON.parse(content) as Partial<SignInAdvancedSource>; sourcePatch({ html: String(parsed.html || selectedTheme.advancedSource.html), css: String(parsed.css || selectedTheme.advancedSource.css), js: String(parsed.js || selectedTheme.advancedSource.js) }); }
      catch { return setNotice("The imported JSON is not a compatible presentation source file."); }
    } else return setNotice("Import HTML, CSS, JS, or compatible JSON presentation source.");
    setNotice(`${file.name} imported into the isolated source draft. Validate before saving.`);
  };
  const exportFile = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const safeSource = selectedTheme.advancedSource;
  const sourcePreviewDoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:"><style>body{margin:0;padding:24px;background:#eef5ef;font-family:system-ui;color:#102719}${safeSource.css}</style></head><body>${safeSource.html}<script>${safeSource.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  const exportManifest = JSON.stringify({ schema: "daenem.signin.presentation/v2", generatedAt: selectedTheme.lastModifiedAt, repositoryTarget: "portal/public/presentation-themes", sourceSnapshotId: presentationSnapshotId(selectedTheme), productionWrite: false, theme: selectedTheme }, null, 2);
  const tabGroups: Array<{ label: string; tabs: Array<{ id: Tab; label: string; icon: typeof ImagePlus }> }> = [
    { label: "DESIGN", tabs: [{ id: "canvas", label: "Canvas", icon: Layers3 }, { id: "gallery", label: "Themes", icon: LayoutGrid }, { id: "visual", label: "Visual", icon: Palette }, { id: "responsive", label: "Responsive", icon: Move }, { id: "backgrounds", label: "Backgrounds", icon: ImagePlus }, { id: "widgets", label: "Widgets", icon: MonitorCog }] },
    { label: "SYSTEMS", tabs: [{ id: "weather-time", label: "Weather & Time", icon: CloudSun }, { id: "library", label: "Component Library", icon: Boxes }] },
    { label: "REVIEW", tabs: [{ id: "compare", label: "Compare", icon: Copy }, { id: "versions", label: "Versions", icon: History }, { id: "validation", label: "Validate", icon: ShieldCheck }] },
    { label: "AI", tabs: [{ id: "ai", label: "AI Designer", icon: Bot }] },
    { label: "ADVANCED", tabs: [{ id: "advanced", label: "Advanced Source", icon: Code2 }, { id: "repository", label: "Repository", icon: Archive }, { id: "audit", label: "Audit", icon: ShieldCheck }] },
  ];
  const previewUrl = (theme: SignInThemeProfile, kind: "draft" | "preview") => `/canonical-signin/index.html?presentation=${kind}&embedded=1&revision=${previewRevision}&theme=${encodeURIComponent(theme.portalThemeId)}`;
  const orderedBreakpointWidgets = selectedTheme.widgets.order.slice().sort((a, b) => (breakpoint.widgets[a]?.order ?? 99) - (breakpoint.widgets[b]?.order ?? 99));
  const availableWidgets = presentationWidgetCatalog.filter((widget) => !selectedTheme.widgets.order.includes(widget.id));
  const selectedCustomWidget = selectedTheme.widgets.custom.find((widget) => widget.id === selectedWidgetId);
  const filteredChanges = changes.filter((change) => compareFilter === "ALL" || (compareFilter === "LAYOUT" && ["Layout"].includes(change.group)) || (compareFilter === "STYLE" && ["Style", "Visual system"].includes(change.group)) || (compareFilter === "WIDGETS" && change.group.includes("Widget")) || (compareFilter === "RESPONSIVE" && ["Responsive", "Desktop", "Tablet", "Mobile"].includes(change.group)) || (compareFilter === "ASSETS" && change.group === "Backgrounds") || (compareFilter === "SOURCE" && change.group === "Source"));
  const applyStudioTheme = (nextTheme: SignInThemeProfile, summary: string) => {
    setSettings((current) => replaceTheme(current, selectedTheme.id, () => markDraft(nextTheme)));
    setNotice(summary);
  };

  return <section className="signin-admin" aria-labelledby="signin-admin-title">
    <header className="signin-admin-hero">
      <div><span className="eyebrow">OWNER CONTROL CENTER · SITES PREVIEW ONLY</span><h2 id="signin-admin-title">Sign-In Studio</h2><p>Manage the imported Portal baseline and Sites candidates while authentication, RBAC, backend policy, and production remain protected.</p></div>
      <div className="signin-admin-health"><span><Check /> Reference V3 default</span><span><ShieldCheck /> Owner protected</span><span><Eye /> Draft isolated</span></div>
    </header>

    <section className="signin-environment-map" aria-label="Environment boundaries">
      <article data-environment="production"><span>PORTAL PRODUCTION BASELINE</span><strong>Imported Portal Baseline</strong><small>{PORTAL_BASELINE_IDENTITY}</small><em>Source/reference only · not modified by Sites</em></article>
      <article data-environment="preview"><span>SITES PREVIEW ACTIVE</span><strong>{activeTheme.name}</strong><small>{liveSettings.portal_signin_active_theme_id} · {fingerprint(activeTheme)}</small><em>Changes only through explicit Preview publication</em></article>
      <article data-environment="draft"><span>{selectedTheme.hasEditableDraft ? "DRAFT" : selectedTheme.status}</span><strong>{selectedTheme.name}</strong><small>{selectedTheme.version}</small><em>{selectedTheme.hasEditableDraft ? "Unpublished working version" : "No editable draft created"}</em></article>
    </section>

    <div className="signin-admin-status" role="status" aria-live="polite"><span className="status-dot" /> {notice}</div>
    <nav className="signin-studio-navigation" aria-label="Sign-In Studio sections">{tabGroups.map((group) => <section key={group.label}><strong>{group.label}</strong><div>{group.tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" data-studio-tab={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon />{label}</button>)}</div></section>)}</nav>

    <div className={`signin-admin-layout${["canvas", "library", "ai", "validation", "repository"].includes(tab) ? " is-studio-wide" : ""}`}>
      <div className="signin-admin-workbench">
        {tab === "canvas" && <SignInStudioCanvas theme={selectedTheme} activeTheme={activeTheme} breakpoint={previewMode} onBreakpointChange={setPreviewMode} onChange={applyStudioTheme} onOpenLibrary={() => setTab("library")} onOpenCompare={() => setTab("compare")} />}

        {tab === "gallery" && <section aria-labelledby="gallery-heading">
          <div className="signin-admin-section-heading signin-admin-gallery-heading"><div><span>00</span><h3 id="gallery-heading">Sign-In Theme Gallery</h3><p>Imported Portal themes, retained Sites work, clones, and custom themes share one protected publication path.</p></div><button type="button" onClick={createCustomTheme}><ImagePlus />New Custom</button></div>
          <div className="signin-admin-baseline"><ShieldCheck /><div><strong>Reference V3 · imported default/live baseline</strong><p><code>portal/public/index.html</code> · {PORTAL_BASELINE_IDENTITY} · blob {PORTAL_BASELINE_BLOB.slice(0, 12)}… · Auto Rotate OFF</p></div></div>
          <div className="signin-theme-gallery">{settings.portal_signin_theme_profiles.map((theme) => {
            const isLive = theme.id === liveSettings.portal_signin_active_theme_id;
            const isDefault = theme.id === settings.portal_signin_default_theme_id;
            const isSelected = theme.id === selectedTheme.id;
            return <article key={theme.id} className={isSelected ? "is-selected" : ""} aria-current={isSelected ? "true" : undefined}>
              <div className="signin-theme-thumb"><img src={theme.thumbnail} alt="" /><span>{theme.source}</span></div>
              <div className="signin-theme-card-head"><div><strong>{theme.name}</strong><small>{theme.version}</small></div><div className="signin-theme-badges">{isLive && <span data-status="live">SITES PREVIEW ACTIVE</span>}{isDefault && <span data-status="default">DEFAULT</span>}<span data-status={theme.status.toLowerCase()}>{theme.hasEditableDraft ? "DRAFT" : theme.status}</span></div></div>
              <p>{theme.id === "reference-v3" ? "Imported Portal Baseline · source/reference remains untouched" : `${theme.source} composition · ${theme.portalThemeId.replaceAll("-", " ")}`}</p>
              <footer><button type="button" onClick={() => { selectTheme(theme.id); setTab("visual"); }}><Eye />Open</button><button type="button" onClick={() => previewTheme(theme.id)}><Monitor />Preview</button><button type="button" onClick={() => cloneTheme(theme)}><Copy />Clone</button></footer>
            </article>;
          })}</div>
        </section>}

        {tab === "backgrounds" && <section aria-labelledby="background-heading">
          <div className="signin-admin-section-heading"><div><span>01</span><h3 id="background-heading">Backgrounds · {selectedTheme.name}</h3><p>True no-code staging plus reference registration. Auto Rotate remains OFF by default.</p></div><strong>{themeBackground.backgrounds.filter((item) => item.enabled).length} enabled</strong></div>
          <div className="signin-admin-background-toolbar"><div><strong>{themeBackground.backgrounds.find((item) => item.id === themeBackground.defaultBackground)?.name}</strong><small>Current draft background</small></div><button type="button" onClick={() => cycleBackground(-1)}><ChevronLeft />Previous</button><button type="button" onClick={() => cycleBackground(1)}>Next<ChevronRight /></button></div>
          <div className="signin-admin-rotation-master" data-state={themeBackground.autoRotate ? "on" : "off"}><Toggle checked={themeBackground.autoRotate} label="Auto Rotate" detail={themeBackground.autoRotate ? "ON · Owner-enabled timer may advance backgrounds" : "OFF · no background advancement timer is started"} onChange={(checked) => updateThemeBackground({ autoRotate: checked, shuffle: checked ? themeBackground.shuffle : false })} /><strong>{themeBackground.autoRotate ? "ON" : "OFF"}</strong></div>
          <fieldset className="signin-admin-rotation-controls" disabled={!themeBackground.autoRotate}><legend>Automatic rotation controls</legend><div className="signin-admin-control-grid three"><Toggle checked={themeBackground.shuffle} disabled={!themeBackground.autoRotate} label="Shuffle" detail="Available only while Auto Rotate is ON." onChange={(checked) => updateThemeBackground({ shuffle: checked })} /><label>Transition<select value={themeBackground.transition} onChange={(event) => updateThemeBackground({ transition: event.target.value as SignInThemeBackgroundSettings["transition"] })}><option value="crossfade">Crossfade</option><option value="soft-fade">Soft fade</option><option value="none">None</option></select></label><Range label="Rotation interval" min={6} max={90} suffix="s" value={themeBackground.rotationIntervalSeconds} onChange={(value) => updateThemeBackground({ rotationIntervalSeconds: value })} /><Range label="Transition duration" min={200} max={2000} step={50} suffix="ms" value={themeBackground.transitionMs} onChange={(value) => updateThemeBackground({ transitionMs: value })} /></div></fieldset>

          <section className="signin-upload-studio" aria-label="Upload Background">
            <header><div><Upload /><span><strong>Upload Background</strong><small>Drag and drop or choose AVIF, WebP, JPEG, or PNG · 4K metadata verified before adding</small></span></div><span data-state="local">DRAFT STAGING</span></header>
            <div className={`signin-upload-dropzone${dragActive ? " is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); inspectUpload(event.dataTransfer.files?.[0]); }}>
              <ImagePlus /><strong>Drop a farm background here</strong><span>or</span><button type="button" onClick={() => uploadRef.current?.click()}>Choose Image</button><small>Preview before adding · dimensions and file size shown · production upload is never implied</small>
              <input ref={uploadRef} hidden type="file" accept="image/avif,image/jpeg,image/png,image/webp" onChange={(event) => { inspectUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            </div>
            {pendingUpload && <div className="signin-upload-review"><img src={pendingUpload.url} alt="Staged background preview" /><div><span>{pendingUpload.replaceId ? "REPLACE PREVIEW" : "NEW BACKGROUND PREVIEW"}</span><strong>{pendingUpload.file.name}</strong><p>{pendingUpload.width} × {pendingUpload.height} · {formatBytes(pendingUpload.file.size)} · {pendingUpload.file.type}</p><p className={pendingUpload.native4k ? "is-verified" : "is-warning"}>{pendingUpload.native4k ? "Native 4K dimensions verified" : "Not native 4K · Owner 4K asset still required"}</p><label>Display name<input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder={pendingUpload.file.name} /></label><div><button type="button" className="primary" onClick={commitUpload}><Check />Add To Draft</button><button type="button" onClick={() => { URL.revokeObjectURL(pendingUpload.url); setPendingUpload(null); }}><X />Cancel</button></div></div></div>}
          </section>

          <details className="signin-reference-add"><summary>Add existing asset reference</summary><div className="signin-admin-add"><label>Display name<input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="Owner farm aerial" /></label><label className="grow">HTTPS or /assets/ reference<input value={assetReference} onChange={(event) => setAssetReference(event.target.value)} placeholder="/assets/signin/owner-farm-01.webp" /></label><button type="button" onClick={addBackgroundReference}><ImagePlus />Add Reference</button></div></details>
          <div className="signin-admin-backgrounds">{themeBackground.backgrounds.map((item, index) => <article key={item.id} className={!item.enabled ? "is-disabled" : ""}>
            <div className="signin-admin-background-preview" style={{ backgroundImage: `url(${item.source})`, backgroundPosition: `${item.desktopFocalX}% ${item.desktopFocalY}%`, filter: `brightness(${item.brightness}%)` }}><span>{item.native4k ? "NATIVE 4K VERIFIED" : "OWNER 4K ASSET REQUIRED"}</span></div>
            <div className="signin-admin-background-title"><div><strong>{item.name}</strong><small>{item.width && item.height ? `${item.width} × ${item.height}` : "Dimensions verify on load"} · {formatBytes(item.fileSizeBytes)} · Slot {index + 1}{item.localOnly ? " · Local draft" : ""}</small></div><OrderButtons first={index === 0} last={index === themeBackground.backgrounds.length - 1} label={item.name} onUp={() => updateThemeBackground({ backgrounds: reorder(themeBackground.backgrounds, index, -1) })} onDown={() => updateThemeBackground({ backgrounds: reorder(themeBackground.backgrounds, index, 1) })} /></div>
            <div className="signin-admin-background-grid"><Toggle checked={item.enabled} label="Enabled" onChange={(checked) => updateBackground(item.id, { enabled: checked })} /><label className="signin-admin-radio"><input type="radio" name="default-background" checked={themeBackground.defaultBackground === item.id} onChange={() => { updateThemeBackground({ defaultBackground: item.id }); updateTheme({ thumbnail: item.source }); }} />Default</label><Range label="Desktop X" value={item.desktopFocalX} onChange={(value) => updateBackground(item.id, { desktopFocalX: value })} /><Range label="Desktop Y" value={item.desktopFocalY} onChange={(value) => updateBackground(item.id, { desktopFocalY: value })} /><Range label="Tablet X" value={item.tabletFocalX} onChange={(value) => updateBackground(item.id, { tabletFocalX: value })} /><Range label="Tablet Y" value={item.tabletFocalY} onChange={(value) => updateBackground(item.id, { tabletFocalY: value })} /><Range label="Mobile X" value={item.mobileFocalX} onChange={(value) => updateBackground(item.id, { mobileFocalX: value })} /><Range label="Mobile Y" value={item.mobileFocalY} onChange={(value) => updateBackground(item.id, { mobileFocalY: value })} /><Range label="Brightness" min={70} max={125} value={item.brightness} onChange={(value) => updateBackground(item.id, { brightness: value })} /><Range label="Overlay" max={55} value={item.overlay} onChange={(value) => updateBackground(item.id, { overlay: value })} /></div>
            <div className="signin-background-actions"><button type="button" onClick={() => { replaceTargetRef.current = item.id; uploadRef.current?.click(); }}><RefreshCw />Replace</button><button type="button" className="signin-admin-remove" onClick={() => removeBackground(item)}><Trash2 />Remove</button></div>
          </article>)}</div>
        </section>}

        {tab === "visual" && <section aria-labelledby="visual-heading">
          <div className="signin-admin-section-heading"><div><span>02</span><h3 id="visual-heading">Visual Theme Editor</h3><p>No-code controls generate an exportable presentation definition; auth DOM, form bindings, and security remain protected.</p></div><strong>DRAFT ONLY</strong></div>
          <div className="signin-editor-preview" style={{ "--editor-primary": selectedTheme.visual.primaryColor, "--editor-accent": selectedTheme.visual.accentColor, "--editor-surface": selectedTheme.visual.surfaceColor, "--editor-text": selectedTheme.visual.textColor, "--editor-radius": `${selectedTheme.visual.radius}px`, "--editor-opacity": selectedTheme.visual.glassOpacity / 100, "--editor-blur": `${selectedTheme.visual.glassBlur}px`, "--editor-shadow": `${selectedTheme.visual.shadowDepth}px` } as CSSProperties}><span>LIVE STYLE SAMPLE</span><h4>{selectedTheme.visual.headline}</h4><p>{selectedTheme.visual.subheadline}</p><button type="button">Protected Sign-In action</button></div>
          <div className="signin-editor-groups">
            <fieldset><legend>Copy & typography</legend><label>Headline<input type="text" value={selectedTheme.visual.headline} onChange={(event) => updateVisual({ headline: event.target.value })} /></label><label>Subheadline<textarea rows={3} value={selectedTheme.visual.subheadline} onChange={(event) => updateVisual({ subheadline: event.target.value })} /></label><div className="signin-admin-control-grid"><label>Font family<select value={selectedTheme.visual.fontFamily} onChange={(event) => updateVisual({ fontFamily: event.target.value as SignInVisualSettings["fontFamily"] })}><option>Portal Sans</option><option>Editorial Serif</option><option>System</option></select></label><Range label="Heading weight" min={500} max={900} step={20} suffix="" value={selectedTheme.visual.headingWeight} onChange={(value) => updateVisual({ headingWeight: value })} /></div></fieldset>
            <fieldset><legend>Color & gradient</legend><div className="signin-color-grid"><ColorControl label="Primary" value={selectedTheme.visual.primaryColor} onChange={(value) => updateVisual({ primaryColor: value })} /><ColorControl label="Accent" value={selectedTheme.visual.accentColor} onChange={(value) => updateVisual({ accentColor: value })} /><ColorControl label="Surface" value={selectedTheme.visual.surfaceColor} onChange={(value) => updateVisual({ surfaceColor: value })} /><ColorControl label="Text" value={selectedTheme.visual.textColor} onChange={(value) => updateVisual({ textColor: value })} /><ColorControl label="Gradient start" value={selectedTheme.visual.gradientStart} onChange={(value) => updateVisual({ gradientStart: value })} /><ColorControl label="Gradient end" value={selectedTheme.visual.gradientEnd} onChange={(value) => updateVisual({ gradientEnd: value })} /></div><Range label="Gradient angle" min={0} max={360} suffix="°" value={selectedTheme.visual.gradientAngle} onChange={(value) => updateVisual({ gradientAngle: value })} /></fieldset>
            <fieldset><legend>Glass, depth & geometry</legend><div className="signin-admin-control-grid three"><Range label="Glass opacity" min={35} max={100} value={selectedTheme.visual.glassOpacity} onChange={(value) => updateVisual({ glassOpacity: value })} /><Range label="Glass blur" min={0} max={36} suffix="px" value={selectedTheme.visual.glassBlur} onChange={(value) => updateVisual({ glassBlur: value })} /><Range label="Border opacity" value={selectedTheme.visual.borderOpacity} onChange={(value) => updateVisual({ borderOpacity: value })} /><Range label="Border width" min={0} max={4} suffix="px" value={selectedTheme.visual.borderWidth} onChange={(value) => updateVisual({ borderWidth: value })} /><Range label="Glow" value={selectedTheme.visual.glowIntensity} onChange={(value) => updateVisual({ glowIntensity: value })} /><Range label="Shadow depth" min={0} max={60} suffix="px" value={selectedTheme.visual.shadowDepth} onChange={(value) => updateVisual({ shadowDepth: value })} /><Range label="Spacing" min={75} max={130} value={selectedTheme.visual.spacingScale} onChange={(value) => updateVisual({ spacingScale: value })} /><Range label="Radii" min={4} max={36} suffix="px" value={selectedTheme.visual.radius} onChange={(value) => updateVisual({ radius: value })} /><Range label="Motion" value={selectedTheme.visual.motionIntensity} onChange={(value) => updateVisual({ motionIntensity: value })} /></div></fieldset>
          </div>
          <div className="signin-admin-safety"><ShieldCheck /><div><strong>Authentication boundary locked</strong><p>Visual editing cannot change password policy, providers, form submission, sessions, permissions, RBAC, or backend routes.</p></div></div>
        </section>}

        {tab === "responsive" && <section aria-labelledby="responsive-heading">
          <div className="signin-admin-section-heading"><div><span>03</span><h3 id="responsive-heading">Responsive Editing Mode</h3><p>Each breakpoint keeps an independent arrangement. Editing one mode does not overwrite the other two.</p></div><strong>{previewMode.toUpperCase()}</strong></div>
          <div className="signin-responsive-modes" role="group" aria-label="Responsive editing breakpoint">{previewModes.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={previewMode === id} onClick={() => setPreviewMode(id)}><Icon />{label}<small>{id === "desktop" ? "≥ 1025 px" : id === "tablet" ? "601–1024 px" : "≤ 600 px"}</small></button>)}</div>
          <div className="signin-breakpoint-summary"><div><MonitorCog /><span><strong>{previewMode[0].toUpperCase()}{previewMode.slice(1)} arrangement</strong><small>{orderedBreakpointWidgets.filter((id) => breakpoint.widgets[id]?.visible).length} visible widgets · independent positions and scale</small></span></div><span data-state="isolated">ISOLATED</span></div>
          <div className="signin-admin-control-grid three"><Range label="Text sizing" min={80} max={125} value={breakpoint.textScale} onChange={(value) => updateBreakpoint({ textScale: value })} /><Range label="Background focal X" value={breakpoint.backgroundFocalX} onChange={(value) => updateBreakpoint({ backgroundFocalX: value })} /><Range label="Background focal Y" value={breakpoint.backgroundFocalY} onChange={(value) => updateBreakpoint({ backgroundFocalY: value })} /></div>
          <div className="signin-responsive-list">{orderedBreakpointWidgets.map((id, index) => {
            const placement = breakpoint.widgets[id];
            if (!placement) return null;
            return <article key={id}><div className="signin-responsive-widget-head"><GripVertical /><span><strong>{widgetLabel(id, selectedTheme.widgets.custom)}</strong><small>Breakpoint order {index + 1} · {id}</small></span><Toggle checked={placement.visible} label="Visible" onChange={(visible) => updatePlacement(id, { visible })} /><OrderButtons first={index === 0} last={index === orderedBreakpointWidgets.length - 1} label={widgetLabel(id, selectedTheme.widgets.custom)} onUp={() => moveBreakpointWidget(id, -1)} onDown={() => moveBreakpointWidget(id, 1)} /></div><div className="signin-responsive-controls"><label>Size<select value={placement.size} onChange={(event) => updatePlacement(id, { size: event.target.value as PresentationSize })}><option value="compact">Compact</option><option value="standard">Standard</option><option value="wide">Wide</option><option value="tall">Tall</option></select></label><Range label="Width" min={2} max={12} suffix=" col" value={placement.width} onChange={(value) => updatePlacement(id, { width: value })} /><Range label="Height" min={1} max={6} suffix=" row" value={placement.height} onChange={(value) => updatePlacement(id, { height: value })} /><Range label="Position X" min={-6} max={6} suffix="" value={placement.x} onChange={(value) => updatePlacement(id, { x: value })} /><Range label="Position Y" min={-6} max={6} suffix="" value={placement.y} onChange={(value) => updatePlacement(id, { y: value })} /></div></article>;
          })}</div>
        </section>}

        {tab === "weather-time" && <section aria-labelledby="weather-time-heading"><div className="signin-admin-section-heading"><div><span>04</span><h3 id="weather-time-heading">Weather & Global Time</h3><p>Provider logic remains authoritative. Unavailable observations render —° and Unavailable; no plausible numeric sample is presented as live.</p></div></div><div className="signin-admin-control-grid three"><Toggle checked={settings.portal_weather_farm_visible} label="Farm Weather" detail="Daenem Farms · Balogun-Ikire" onChange={(checked) => update("portal_weather_farm_visible", checked)} /><Toggle checked={settings.portal_weather_hq_visible} label="HQ Weather" detail="Headquarters · Ibadan" onChange={(checked) => update("portal_weather_hq_visible", checked)} /><Toggle checked={settings.portal_weather_forecast_visible} label="Forecast strip" detail="Provider-backed values only" onChange={(checked) => update("portal_weather_forecast_visible", checked)} /><Toggle checked={settings.portal_weather_location_rotation} label="Location rotation" detail="Farm ↔ HQ · accessible manual pause" onChange={(checked) => update("portal_weather_location_rotation", checked)} /><label>Rotation interval<select value={settings.portal_weather_location_rotation_interval_seconds} disabled={!settings.portal_weather_location_rotation} onChange={(event) => update("portal_weather_location_rotation_interval_seconds", Number(event.target.value))}><option value={8}>8 seconds</option><option value={16}>16 seconds</option><option value={24}>24 seconds</option><option value={45}>45 seconds</option><option value={90}>90 seconds</option></select></label><label>Temperature unit<select value={settings.weather_temperature_unit} onChange={(event) => update("weather_temperature_unit", event.target.value as "c" | "f")}><option value="c">Celsius</option><option value="f">Fahrenheit</option></select></label><label>Clock mode<select value={settings.portal_clock_style} onChange={(event) => update("portal_clock_style", event.target.value as PortalPresentationSettings["portal_clock_style"])}><option value="hybrid">Analog + digital</option><option value="analog">Analog</option><option value="digital">Digital</option></select></label><label>Animation<select value={settings.portal_animation_level} onChange={(event) => update("portal_animation_level", event.target.value as PortalPresentationSettings["portal_animation_level"])}><option value="off">Off</option><option value="subtle">Subtle</option><option value="balanced">Balanced</option></select></label></div>
          <div className="signin-weather-truth"><CloudSun /><div><strong>Provider truthfulness guard</strong><span><b>—°</b> Unavailable</span><small>Numeric readings display only when the existing provider returns a valid observation. Sample/design data must be explicitly labelled.</small></div></div>
          <div className="signin-admin-clock-list">{presentationClockCatalog.map((clock) => { const index = settings.portal_clock_locations.indexOf(clock.zone); const visible = index >= 0; return <article key={clock.id}><span className="signin-admin-clock-icon"><Clock3 /></span><div><strong>{clock.label}</strong><small>{clock.zone}</small></div><Toggle checked={visible} label="Visible" onChange={(checked) => update("portal_clock_locations", checked ? [...settings.portal_clock_locations, clock.zone] : settings.portal_clock_locations.filter((zone) => zone !== clock.zone))} />{visible && <OrderButtons first={index === 0} last={index === settings.portal_clock_locations.length - 1} label={clock.label} onUp={() => update("portal_clock_locations", reorder(settings.portal_clock_locations, index, -1))} onDown={() => update("portal_clock_locations", reorder(settings.portal_clock_locations, index, 1))} />}</article>; })}</div><p className="signin-admin-note">Required display order: Daenem Farms Balogun-Ikire, Toronto, London, New York, Moscow, Tokyo, Beijing. Lagos is not a display location; <code>Africa/Lagos</code> is only the farm&apos;s IANA time zone.</p>
        </section>}

        {tab === "widgets" && <section aria-labelledby="widget-heading"><div className="signin-admin-section-heading"><div><span>05</span><h3 id="widget-heading">Widgets Workspace</h3><p>Add, remove optional, hide, move, resize, reorder, duplicate, replace, and configure presentation surfaces without granting data authority.</p></div><button type="button" onClick={() => setShowCustomCreator((value) => !value)}><Plus />Create Custom Widget</button></div>
          {availableWidgets.length > 0 && <div className="signin-widget-library"><strong>Add existing widget</strong>{availableWidgets.map((widget) => <button key={widget.id} type="button" onClick={() => addExistingWidget(widget.id)}><Plus />{widget.label}</button>)}</div>}
          {showCustomCreator && <section className="signin-custom-widget-builder" aria-label="Create Custom Widget"><header><div><Sparkles /><span><strong>Create Custom Widget</strong><small>Safe presentation/data-binding surface · no RBAC or backend write authority</small></span></div><button type="button" aria-label="Close custom widget builder" onClick={() => setShowCustomCreator(false)}><X /></button></header><div className="signin-custom-widget-fields"><label>Name<input value={customDraft.name} onChange={(event) => setCustomDraft({ ...customDraft, name: event.target.value })} /></label><label>Type<select value={customDraft.kind} onChange={(event) => setCustomDraft({ ...customDraft, kind: event.target.value as SignInWidgetKind })}>{widgetKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><label>Title<input value={customDraft.title} onChange={(event) => setCustomDraft({ ...customDraft, title: event.target.value })} /></label><label>Source label<input value={customDraft.sourceLabel} onChange={(event) => setCustomDraft({ ...customDraft, sourceLabel: event.target.value })} /></label><label className="wide">Content<textarea rows={3} value={customDraft.content} onChange={(event) => setCustomDraft({ ...customDraft, content: event.target.value })} /></label><label className="wide">Data binding<input value={customDraft.dataBinding} onChange={(event) => setCustomDraft({ ...customDraft, dataBinding: event.target.value })} /><small>Descriptive binding only. Server authorization remains required.</small></label></div><button className="primary" type="button" onClick={createCustomWidget}><Plus />Add Custom Widget To Draft</button></section>}
          <div className="signin-admin-widget-list">{selectedTheme.widgets.order.map((id, index) => { const hidden = selectedTheme.widgets.hidden.includes(id); const custom = selectedTheme.widgets.custom.find((item) => item.id === id); return <article key={id} className={selectedWidgetId === id ? "is-selected" : ""}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{widgetLabel(id, selectedTheme.widgets.custom)}</strong><small>{custom ? `Custom · ${custom.kind}` : `Existing · ${id}`}</small></div><Toggle checked={!hidden} label="Visible" onChange={(checked) => toggleWidget(id, checked)} /><label>Size<select value={selectedTheme.widgets.sizes[id] || "standard"} onChange={(event) => updateWidgetSettings((theme) => ({ ...theme, widgets: { ...theme.widgets, sizes: { ...theme.widgets.sizes, [id]: event.target.value as PresentationSize } } }))}><option value="compact">Compact</option><option value="standard">Standard</option><option value="wide">Wide</option><option value="tall">Tall</option></select></label><OrderButtons first={index === 0} last={index === selectedTheme.widgets.order.length - 1} label={widgetLabel(id, selectedTheme.widgets.custom)} onUp={() => reorderWidget(index, -1)} onDown={() => reorderWidget(index, 1)} /><div className="signin-widget-actions"><button type="button" onClick={() => setSelectedWidgetId(id)}><SlidersHorizontal />Configure</button><button type="button" onClick={() => duplicateWidget(id)}><Copy />Duplicate</button><button type="button" disabled={["weather", "world-clock"].includes(id)} onClick={() => removeWidget(id)}><Trash2 />{["weather", "world-clock"].includes(id) ? "Required" : "Remove"}</button></div></article>; })}</div>
          {selectedCustomWidget && <section className="signin-widget-config"><header><strong>Configure · {selectedCustomWidget.name}</strong><span>PRESENTATION ONLY</span></header><div className="signin-custom-widget-fields"><label>Title<input value={selectedCustomWidget.title} onChange={(event) => updateCustomWidget(selectedCustomWidget.id, { title: event.target.value })} /></label><label>Source label<input value={selectedCustomWidget.sourceLabel} onChange={(event) => updateCustomWidget(selectedCustomWidget.id, { sourceLabel: event.target.value })} /></label><label className="wide">Content<textarea rows={3} value={selectedCustomWidget.content} onChange={(event) => updateCustomWidget(selectedCustomWidget.id, { content: event.target.value })} /></label><label className="wide">Data binding<input value={selectedCustomWidget.dataBinding} onChange={(event) => updateCustomWidget(selectedCustomWidget.id, { dataBinding: event.target.value })} /></label></div></section>}
        </section>}

        {tab === "library" && <ComponentLibraryPanel theme={selectedTheme} onChange={applyStudioTheme} onOpenCanvas={() => setTab("canvas")} />}

        {tab === "compare" && <section aria-labelledby="compare-heading"><div className="signin-admin-section-heading"><div><span>06</span><h3 id="compare-heading">Current Active vs Draft</h3><p>Visual side-by-side comparison plus settings, widget, responsive, background, and source deltas.</p></div><strong>{changes.length} CHANGE GROUPS</strong></div>
          <div className="signin-compare-identities"><article><span>SITES PREVIEW ACTIVE</span><strong>{activeTheme.name}</strong><small>{activeTheme.version}</small><code>{fingerprint(activeTheme)}</code></article><div><ChevronRight /></div><article><span>DRAFT</span><strong>{selectedTheme.name}</strong><small>{selectedTheme.version}</small><code>{fingerprint(selectedTheme)}</code></article></div>
          <div className="signin-compare-filters" role="group" aria-label="Compare change filters">{["ALL", "LAYOUT", "STYLE", "WIDGETS", "RESPONSIVE", "ASSETS", "SOURCE"].map((filter) => <button key={filter} type="button" aria-pressed={compareFilter === filter} onClick={() => setCompareFilter(filter)}>{filter}</button>)}</div>
          <div className="signin-compare-changes" data-testid="compare-deltas">{filteredChanges.map((change, index) => <article key={`${change.group}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{change.group}</strong><p>{change.detail}</p></div></article>)}</div>
          <div className="signin-admin-safety"><Eye /><div><strong>Visual side-by-side is active in the preview rail</strong><p>Compare and Preview never change the current Sites Sign-In. Only explicit Publish To Sites Preview can activate an approved draft.</p></div></div>
        </section>}

        {tab === "versions" && <section aria-labelledby="versions-heading"><div className="signin-admin-section-heading"><div><span>07</span><h3 id="versions-heading">Version History</h3><p>Every saved version records theme, timestamp, author, status, and summary. Rollback restores a selected snapshot to draft first.</p></div><button type="button" onClick={restoreLastPublished}><RotateCcw />Restore Last Published</button></div>
          <div className="signin-version-persistence" role="status" data-testid="version-persistence"><ShieldCheck /><div><strong>PERSISTENT VERSION STORE · PLATFORM BLOCKED</strong><p>Sites does not currently expose a project-persistent version database to this frontend-only pass. Browser storage remains a recovery cache, never the final authority. Every version carries a deterministic exportable source snapshot.</p></div></div>
          <div className="signin-version-overview"><div><History /><span><strong>{versions.length} retained versions</strong><small>Browser recovery cache + deterministic snapshots</small></span></div><div><ShieldCheck /><span><strong>Portal baseline immutable</strong><small>Repository promotion remains deliberate</small></span></div></div>
          <div className="signin-version-list">{versions.map((version) => {
            const restorable = ["IMPORTED", "VALIDATED", "APPROVED", "PUBLISHED TO SITES PREVIEW", "ROLLED BACK"].includes(version.status);
            return <article key={version.id}><div className="signin-version-marker"><span>{version.version}</span><i /></div><div><header><strong>{version.theme}</strong><span data-status={version.status.toLowerCase().replaceAll(" ", "-")}>{version.status}</span></header><p>{version.changeSummary}</p><small>{new Date(version.createdAt).toLocaleString()} · {version.createdBy}</small><code>{version.studioVersionId} · {version.sourceConfigSnapshotId}</code><details><summary>Version metadata</summary><p>Source: {version.sourceTheme}</p><p>{version.componentChanges.join(" · ")}</p><p>{version.responsiveChanges.join(" · ")}</p><p>{version.assetChanges.join(" · ")}</p><p>Storage: browser recovery cache; repository-ready export available.</p></details></div><button type="button" disabled={!restorable} onClick={() => restoreVersionToDraft(version.id)}><RotateCcw />Restore To Draft</button></article>;
          })}</div>
        </section>}

        {tab === "validation" && <PublishValidationPanel settings={prepareDraft()} themeId={selectedTheme.id} revision={previewRevision} />}

        {tab === "ai" && <AIDesignerPanel theme={selectedTheme} />}

        {tab === "advanced" && <section aria-labelledby="advanced-heading"><div className="signin-admin-section-heading"><div><span>08</span><h3 id="advanced-heading">Owner-Only Advanced Source</h3><p>Inspect, clone, import, validate, preview in isolation, and save presentation source without exposing backend auth, RBAC, or secrets.</p></div><strong>{sourceUnlocked && ["Clone", "Custom"].includes(selectedTheme.source) ? "EDITABLE CLONE" : "SOURCE LOCKED"}</strong></div>
          <div className="signin-source-boundary"><ShieldCheck /><div><strong>Imported source is immutable by default</strong><p>{selectedTheme.advancedSource.baseIdentity}. Clone before editing; source actions never change Sites Preview Active and never write production/main.</p></div>{(!sourceUnlocked || !["Clone", "Custom"].includes(selectedTheme.source)) && <button type="button" onClick={() => cloneTheme(selectedTheme, true)}><Copy />Clone Source Before Editing</button>}</div>
          <div className="signin-source-toolbar"><input ref={sourceImportRef} hidden type="file" accept=".html,.htm,.css,.js,.json,text/html,text/css,text/javascript,application/json" onChange={(event) => { void importSource(event.target.files?.[0]); event.currentTarget.value = ""; }} /><button type="button" disabled={!sourceUnlocked} onClick={() => sourceImportRef.current?.click()}><Upload />Import Compatible Source</button><button type="button" onClick={runSourceValidation}><ShieldCheck />Validate</button><button type="button" disabled={sourceValidation.state !== "valid"} onClick={saveSourceVersion}><Save />Save As New Version</button></div>
          <div className="signin-source-grid"><div className="signin-source-editors"><label><span><FileCode2 />Presentation HTML</span><textarea spellCheck={false} readOnly={!sourceUnlocked} value={selectedTheme.advancedSource.html} onChange={(event) => sourcePatch({ html: event.target.value })} /></label><label><span><Palette />Presentation CSS</span><textarea spellCheck={false} readOnly={!sourceUnlocked} value={selectedTheme.advancedSource.css} onChange={(event) => sourcePatch({ css: event.target.value })} /></label><label><span><Code2 />Presentation JS</span><textarea spellCheck={false} readOnly={!sourceUnlocked} value={selectedTheme.advancedSource.js} onChange={(event) => sourcePatch({ js: event.target.value })} /></label></div><div className="signin-source-preview"><header><span>ISOLATED SANDBOX</span><code>{fingerprint(selectedTheme.advancedSource)}</code></header><iframe title="Isolated presentation source preview" sandbox="allow-scripts" srcDoc={sourcePreviewDoc} /><div className="signin-source-validation" data-state={sourceValidation.state}>{sourceValidation.messages.map((message) => <p key={message}><span>{sourceValidation.state === "invalid" ? "!" : sourceValidation.state === "valid" ? "✓" : "•"}</span>{message}</p>)}</div></div></div>
          <section className="signin-repository-export"><header><div><Archive /><span><strong>Repository-ready registration</strong><small>Visual Studio definition + generated/exportable source representation</small></span></div><code>{fingerprint(selectedTheme)}</code></header><p>Suggested target: <code>portal/public/presentation-themes/{selectedTheme.id}/</code>. Save Draft never writes Git; repository promotion requires a separate reviewed, versioned action.</p><div><button type="button" onClick={() => exportFile(`${selectedTheme.id}.presentation.json`, exportManifest, "application/json")}><Download />Download JSON</button><button type="button" onClick={() => exportFile(`${selectedTheme.id}.presentation.css`, selectedTheme.advancedSource.css, "text/css")}><Download />Download CSS</button><button type="button" onClick={() => navigator.clipboard?.writeText(exportManifest)}><Copy />Copy Manifest</button></div></section>
        </section>}

        {tab === "repository" && <RepositorySnapshotPanel theme={selectedTheme} />}

        {tab === "audit" && <section aria-labelledby="audit-heading"><div className="signin-admin-section-heading"><div><span>5</span><h3 id="audit-heading">Preview Audit Trail</h3><p>Browser-local Sites evidence. Authoritative server audit stays protected by the existing v7.2 contract.</p></div><button type="button" onClick={resetDraft}><RotateCcw />Reset Draft</button></div><div className="signin-admin-audit">{audits.length ? audits.map((entry) => <article key={entry.id}><span><ShieldCheck /></span><div><strong>{entry.action}</strong><p>{entry.note}</p><small>{new Date(entry.at).toLocaleString()} · {entry.scope}</small></div></article>) : <p>No preview configuration changes recorded in this browser.</p>}</div></section>}
      </div>

      <aside className={`signin-admin-preview is-${previewMode}${tab === "compare" ? " is-compare" : ""}${["canvas", "library", "ai", "validation", "repository"].includes(tab) ? " is-hidden" : ""}`}>
        <header><div><span>{tab === "compare" ? "ACTIVE / DRAFT COMPARE" : "ISOLATED DRAFT"}</span><strong>{selectedTheme.name}</strong></div><button type="button" onClick={previewDraft}><Eye />Refresh</button></header>
        <div className="signin-admin-preview-modes" role="group" aria-label="Preview viewport">{previewModes.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={previewMode === id} onClick={() => setPreviewMode(id)}><Icon />{label}</button>)}</div>
        <div className="signin-admin-preview-stage"><div className="signin-admin-preview-frame"><span>DRAFT · {previewMode.toUpperCase()}</span><iframe key={`draft-${previewRevision}-${selectedTheme.id}-${previewMode}`} title={`${previewMode} draft Sign-In preview`} src={previewUrl(selectedTheme, "draft")} /></div>{tab === "compare" && <div className="signin-admin-preview-frame"><span>SITES PREVIEW ACTIVE</span><iframe key={`live-${previewRevision}-${activeTheme.id}-${previewMode}`} title={`${previewMode} active Sign-In comparison`} src={previewUrl(activeTheme, "preview")} /></div>}</div>
        <p><span className="status-dot" /> Preview never publishes. Auto Rotate: <strong>{themeBackground.autoRotate ? "ON" : "OFF"}</strong> · Breakpoint: <strong>{previewMode}</strong></p>
      </aside>
    </div>

    <footer className="signin-admin-actions is-compact"><div><strong>Owner change control</strong><small>Draft actions never alter Sites Preview Active.</small></div><button type="button" onClick={() => saveDraft()}><Save />Save Draft</button><button type="button" onClick={previewDraft}><Eye />Preview</button><button type="button" aria-pressed={tab === "compare"} onClick={() => { previewDraft(); setTab("compare"); }}><Copy />Compare</button><button type="button" onClick={() => setTab("versions")}><RotateCcw />Roll Back</button><button type="button" onClick={() => setTab("validation")}><ShieldCheck />Validate</button><button type="button" className="primary" onClick={publishPreview}><Upload />Publish To Sites Preview</button></footer>
  </section>;
}
