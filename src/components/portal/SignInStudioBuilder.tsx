"use client";
/* eslint-disable react-hooks/refs -- pointer-operation state lives in event/effect handlers only; synchronous ref handoff prevents dropped first drag frames. */

import { Component, useEffect, useRef, useState, type CSSProperties, type ErrorInfo, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  AlignCenter, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, Archive,
  Bot, Box, BringToFront, Check, ChevronRight, Clock3,
  CloudSun, Code2, Copy, Eye, EyeOff, Gauge, Grid3X3, Group, Image as ImageIcon,
  Layers3, LayoutDashboard, Library, Lock, LockOpen, MousePointer2, Move, Newspaper,
  PanelLeft, ClipboardPaste, Plus, Redo2, RotateCcw, Save, Search, SendToBack, ShieldAlert,
  ShieldCheck, Sparkles, SquareDashedMousePointer, Trash2, Type, Undo2, Ungroup,
  WandSparkles, Zap,
} from "lucide-react";
import {
  createSignInCanvasElement, presentationSnapshotId, validatePresentationForPublish,
  type PortalPresentationSettings, type PresentationValidationResult,
  type SignInBreakpoint, type SignInCanvasElement, type SignInCanvasSettings,
  type SignInCanvasStyle, type SignInComponentState, type SignInCustomWidget,
  type SignInGlassStyle, type SignInLogoPlacement, type SignInMotionPreset,
  type SignInThemeProfile,
} from "@/lib/portal-presentation-settings";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const rowsByBreakpoint: Record<SignInBreakpoint, number> = { desktop: 18, tablet: 24, mobile: 36 };
const breakpoints: SignInBreakpoint[] = ["desktop", "tablet", "mobile"];
const glassStyles: SignInGlassStyle[] = ["CLEAR GLASS", "CRYSTAL GLASS", "FROSTED", "DEEP GLASS", "MATTE", "SOLID", "OUTLINE", "FLOATING", "COMMAND / HUD"];
const componentStates: SignInComponentState[] = ["DEFAULT", "HOVER", "FOCUS", "ACTIVE", "LOADING", "EMPTY", "NO DATA", "ERROR", "DISABLED", "SUCCESS", "OFFLINE", "PROVIDER UNAVAILABLE"];
const motionPresets: SignInMotionPreset[] = ["None", "Fade In", "Reveal", "Gentle Float", "Settle", "Glow Pulse", "Breathing Halo", "Light Sweep", "Shimmer", "Hover Lift", "Hover Glow", "Subtle Tilt", "Parallax"];
const logoPlacements: SignInLogoPlacement[] = ["hero", "auth", "header", "footer", "watermark", "mobile-header", "widget", "decorative"];

type BuilderProps = {
  theme: SignInThemeProfile;
  activeTheme: SignInThemeProfile;
  breakpoint: SignInBreakpoint;
  onBreakpointChange: (breakpoint: SignInBreakpoint) => void;
  onChange: (theme: SignInThemeProfile, summary: string) => void;
  onOpenLibrary: () => void;
  onOpenCompare: () => void;
};

type PointerOperation = {
  mode: "move" | "resize";
  direction?: string;
  pointerId: number;
  startX: number;
  startY: number;
  canvasRect: DOMRect;
  selectedIds: string[];
  starts: Record<string, SignInCanvasStyle>;
};

class WidgetBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { void error; void info; /* presentation fallback intentionally isolated */ }
  render() {
    if (this.state.failed) return <div className="studio-widget-fallback"><ShieldAlert /><span><strong>Widget unavailable</strong><small>{this.props.name} failed safely. Authentication remains usable.</small></span></div>;
    return this.props.children;
  }
}

function ToolButton({ label, children, disabled, pressed, onClick, testId }: { label: string; children: ReactNode; disabled?: boolean; pressed?: boolean; onClick: () => void; testId?: string }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} data-testid={testId}>{children}<span>{label}</span></button>;
}

function InspectorRange({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="studio-inspector-range"><span><strong>{label}</strong><output>{value}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Switch({ checked, label, disabled, onChange }: { checked: boolean; label: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="studio-switch"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function elementIcon(element: SignInCanvasElement) {
  if (element.kind === "logo") return Sparkles;
  if (element.kind === "auth") return ShieldCheck;
  if (element.kind === "weather") return CloudSun;
  if (element.kind === "clock" || element.kind === "global-time") return Clock3;
  if (element.kind === "news") return Newspaper;
  if (element.kind === "background" || element.kind === "drone") return ImageIcon;
  if (element.kind === "headline" || element.kind === "subheadline" || element.kind === "brand") return Type;
  if (element.kind === "group") return Group;
  return Box;
}

function renderElement(element: SignInCanvasElement, theme: SignInThemeProfile) {
  switch (element.kind) {
    case "logo":
      return <div className="studio-canvas-logo"><img src="/canonical-signin/assets/premium/daenem-logo.png" alt="Daenem Farms" /><span>Technology That Transforms Tomorrow</span></div>;
    case "headline": return <strong className="studio-canvas-headline">{theme.visual.headline}</strong>;
    case "subheadline": return <span className="studio-canvas-copy">{theme.visual.subheadline}</span>;
    case "brand": return <span className="studio-canvas-brand">DAENEM FARMS <small>Modern Agriculture. Naturally Better.</small></span>;
    case "badge": return <span className="studio-canvas-badge"><Zap /> EMPLOYEE PORTAL</span>;
    case "weather": return <div className="studio-weather-card"><span><CloudSun /></span><div><small>DAENEM FARMS · BALOGUN-IKIRE</small><strong>—°</strong><b>Unavailable</b><em>Provider observation unavailable</em></div></div>;
    case "spotlight": return <div className="studio-spotlight"><small>DAILY SPOTLIGHT</small><strong>Make quality visible.</strong><span>Owner-managed design content</span></div>;
    case "news": return <div className="studio-news"><small>NIGERIAN NEWS</small><strong>Provider pending</strong><span>No fabricated publisher stories</span></div>;
    case "global-time": return <div className="studio-global-time"><Clock3 /><span><small>GLOBAL TIME</small><strong>7 approved locations</strong></span></div>;
    case "clock": return <div className="studio-clock"><i><span /></i><span><strong>{element.name}</strong><small>{element.dataBinding}</small></span></div>;
    case "auth": return <div className="studio-auth-card"><header><small>SECURE EMPLOYEE PORTAL</small><strong>Welcome Back</strong><span>Protected canonical authentication</span></header><div className="studio-auth-tabs"><b>Sign In</b><span>Create Account</span></div><label>Email or username<input readOnly value="owner@daenem.com" aria-label="Email or username preview" /></label><label>Password<input readOnly value="••••••••••" aria-label="Password preview" /></label><button type="button">Sign In</button><small>Google · Microsoft · Forgot Password</small></div>;
    case "button": return <span className="studio-protected-action"><ShieldCheck /> Protected submit action</span>;
    case "drone": return <div className="studio-drone"><img src="/canonical-signin/assets/premium/daenem-drone-overlay-v1.webp" alt="Agricultural monitoring drone" /><span>FIELD SCAN</span></div>;
    case "footer": return <div className="studio-footer">Terms · Privacy · Install App</div>;
    case "sustainability": return <div className="studio-sustainability">SUSTAINABILITY · RESPONSIBLE GROWTH</div>;
    case "custom": return <div className="studio-custom-component"><Sparkles /><span><small>{element.dataBinding}</small><strong>{element.name}</strong><em>{element.variant}</em></span></div>;
    default: return <span className="studio-generic-component">{element.name}</span>;
  }
}

function styleForElement(element: SignInCanvasElement, breakpoint: SignInBreakpoint): CSSProperties {
  const style = element.styles[breakpoint];
  const rows = rowsByBreakpoint[breakpoint];
  return {
    left: `${(style.x / 24) * 100}%`, top: `${(style.y / rows) * 100}%`,
    width: `${(style.width / 24) * 100}%`, height: `${(style.height / rows) * 100}%`,
    zIndex: element.zIndex, opacity: style.opacity / 100,
    padding: `${Math.min(style.padding, 24)}px`, borderRadius: `${style.radius}px`,
    color: style.textColor,
    fontSize: `${Math.max(10, style.fontSize * (breakpoint === "mobile" ? .72 : breakpoint === "tablet" ? .85 : 1))}px`,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight / 100,
    letterSpacing: `${style.letterSpacing / 10}px`,
    textAlign: style.textAlign,
    background: style.backgroundOpacity > 0 ? `linear-gradient(${style.gradientAngle}deg, ${style.gradientStart}${Math.round(style.backgroundOpacity * 2.55).toString(16).padStart(2, "0")}, ${style.gradientEnd}${Math.round(style.backgroundOpacity * 2.1).toString(16).padStart(2, "0")})` : "transparent",
    border: `${style.borderWidth}px solid ${style.borderColor}${Math.round(style.borderOpacity * 2.55).toString(16).padStart(2, "0")}`,
    boxShadow: style.shadow || style.glow ? `0 ${Math.round(style.shadow / 3)}px ${Math.max(8, style.shadow)}px rgba(6,36,24,.${Math.max(8, Math.round(style.shadow / 2))}), 0 0 ${style.glow}px rgba(42,210,136,.${Math.max(5, Math.round(style.glow / 2))})` : "none",
    backdropFilter: style.backdropBlur ? `blur(${style.backdropBlur}px) saturate(${style.saturation}%)` : undefined,
    filter: style.blur ? `blur(${style.blur}px)` : undefined,
  };
}

export function SignInStudioCanvas({ theme, activeTheme, breakpoint, onBreakpointChange, onChange, onOpenLibrary, onOpenCompare }: BuilderProps) {
  const [canvas, setCanvas] = useState<SignInCanvasSettings>(() => clone(theme.canvas));
  const [selection, setSelection] = useState<string[]>(["weather"]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [clipboard, setClipboard] = useState<SignInCanvasElement[]>([]);
  const [guides, setGuides] = useState<string[]>([]);
  const [overlapWarning, setOverlapWarning] = useState("");
  const [inspectorSection, setInspectorSection] = useState<"style" | "motion" | "states" | "logo">("style");
  const [layerQuery, setLayerQuery] = useState("");
  const [undoStack, setUndoStack] = useState<SignInCanvasSettings[]>([]);
  const [redoStack, setRedoStack] = useState<SignInCanvasSettings[]>([]);
  const [operation, setOperation] = useState<PointerOperation | null>(null);
  const operationRef = useRef<PointerOperation | null>(null);

  useEffect(() => { setCanvas(clone(theme.canvas)); setSelection((current) => current.filter((id) => theme.canvas.elements.some((element) => element.id === id)).slice(0, 12)); }, [theme.id, theme.canvas]);

  const selected = canvas.elements.filter((element) => selection.includes(element.id));
  const primary = selected[0];
  const activeFingerprint = presentationSnapshotId(activeTheme);
  const draftFingerprint = presentationSnapshotId({ ...theme, canvas });

  const publishCanvas = (next: SignInCanvasSettings, summary: string, pushHistory = true) => {
    if (pushHistory) {
      setUndoStack((current) => [...current.slice(-39), clone(canvas)]);
      setRedoStack([]);
    }
    setCanvas(next);
    onChange({ ...theme, canvas: next }, summary);
  };

  const updateElements = (transform: (element: SignInCanvasElement) => SignInCanvasElement, summary: string, pushHistory = true) => {
    publishCanvas({ ...canvas, elements: canvas.elements.map((element) => selection.includes(element.id) ? transform(clone(element)) : element) }, summary, pushHistory);
  };

  const updatePrimary = (transform: (element: SignInCanvasElement) => SignInCanvasElement, summary: string) => {
    if (!primary) return;
    publishCanvas({ ...canvas, elements: canvas.elements.map((element) => element.id === primary.id ? transform(clone(element)) : element) }, summary);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, clone(canvas)]);
    setCanvas(previous); onChange({ ...theme, canvas: previous }, "Undo applied to isolated draft.");
  };
  const redo = () => {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, clone(canvas)]);
    setCanvas(next); onChange({ ...theme, canvas: next }, "Redo applied to isolated draft.");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && selected.length) setClipboard(clone(selected));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v" && clipboard.length) pasteSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selectElement = (id: string, additive = false) => setSelection((current) => additive ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id]);

  const beginOperation = (event: ReactPointerEvent, mode: "move" | "resize", direction?: string, targetId?: string) => {
    const operationIds = targetId && !selection.includes(targetId) ? [targetId] : selection;
    const operationElements = canvas.elements.filter((element) => operationIds.includes(element.id));
    if (!operationElements.length || operationElements.some((element) => element.locked)) return;
    event.preventDefault(); event.stopPropagation();
    const rect = (event.currentTarget.closest(".studio-canvas-stage") as HTMLElement | null)?.getBoundingClientRect();
    if (!rect) return;
    setUndoStack((current) => [...current.slice(-39), clone(canvas)]); setRedoStack([]);
    const nextOperation = { mode, direction, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, canvasRect: rect, selectedIds: operationIds, starts: Object.fromEntries(operationElements.map((element) => [element.id, clone(element.styles[breakpoint])])) };
    operationRef.current = nextOperation;
    setOperation(nextOperation);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    const resolveOperation = (event: PointerEvent, current: PointerOperation) => {
      const dx = Math.round(((event.clientX - current.startX) / current.canvasRect.width) * 24);
      const dy = Math.round(((event.clientY - current.startY) / current.canvasRect.height) * rowsByBreakpoint[breakpoint]);
      const nextElements = canvas.elements.map((element) => {
        if (!current.selectedIds.includes(element.id)) return element;
        const start = current.starts[element.id];
        if (!start) return element;
        const style = { ...start };
        if (current.mode === "move") {
          style.x = Math.max(0, Math.min(24 - start.width, start.x + dx));
          style.y = Math.max(0, Math.min(rowsByBreakpoint[breakpoint] - start.height, start.y + dy));
        } else {
          const direction = current.direction || "se";
          if (direction.includes("e")) style.width = Math.max(start.minWidth, Math.min(start.maxWidth, 24 - start.x, start.width + dx));
          if (direction.includes("s")) style.height = Math.max(start.minHeight, Math.min(start.maxHeight, rowsByBreakpoint[breakpoint] - start.y, start.height + dy));
          if (direction.includes("w")) { const nextX = Math.max(0, Math.min(start.x + start.width - start.minWidth, start.x + dx)); style.width = start.width + (start.x - nextX); style.x = nextX; }
          if (direction.includes("n")) { const nextY = Math.max(0, Math.min(start.y + start.height - start.minHeight, start.y + dy)); style.height = start.height + (start.y - nextY); style.y = nextY; }
          if (start.aspectRatioLocked && (direction === "se" || direction === "nw")) style.height = Math.max(start.minHeight, Math.round(style.width * start.height / start.width));
          style.gridSpan = style.width;
        }
        return { ...element, styles: { ...element.styles, [breakpoint]: style } };
      });
      return nextElements;
    };
    const move = (event: PointerEvent) => {
      const current = operationRef.current;
      if (!current) return;
      const nextElements = resolveOperation(event, current);
      setCanvas({ ...canvas, elements: nextElements });
      const primaryId = current.selectedIds[0];
      const movedElement = nextElements.find((element) => element.id === primaryId);
      const moved = movedElement?.styles[breakpoint];
      const centerX = moved ? moved.x + moved.width / 2 : -1;
      const centerY = moved ? moved.y + moved.height / 2 : -1;
      const nextGuides = [];
      if (Math.abs(centerX - 12) <= .5) nextGuides.push("center-x");
      if (Math.abs(centerY - rowsByBreakpoint[breakpoint] / 2) <= .5) nextGuides.push("center-y");
      setGuides(nextGuides);
      const auth = nextElements.find((element) => element.id === "auth-pavilion");
      if (auth && moved && primaryId !== auth.id) {
        const a = auth.styles[breakpoint];
        const overlaps = moved.x < a.x + a.width && moved.x + moved.width > a.x && moved.y < a.y + a.height && moved.y + moved.height > a.y;
        setOverlapWarning(overlaps ? `${movedElement?.name || "Selected element"} overlaps the protected Authentication Pavilion.` : "");
      }
    };
    const up = (event: PointerEvent) => {
      const current = operationRef.current;
      if (!current) return;
      const completed = current.mode;
      const nextElements = resolveOperation(event, current);
      const finalCanvas = { ...canvas, elements: nextElements };
      setCanvas(finalCanvas);
      operationRef.current = null; setOperation(null); setGuides([]);
      const names = nextElements.filter((item) => current.selectedIds.includes(item.id)).map((item) => item.name).join(", ");
      onChange({ ...theme, canvas: finalCanvas }, `${completed === "move" ? "Moved" : "Resized"} ${names} on ${breakpoint}. Sites Preview Active unchanged.`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [canvas, breakpoint, primary?.id, primary?.name, selected, theme, onChange, operation]);

  const alignSelection = (mode: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (!selected.length) return;
    const styles = selected.map((element) => element.styles[breakpoint]);
    const minX = Math.min(...styles.map((style) => style.x)); const maxX = Math.max(...styles.map((style) => style.x + style.width));
    const minY = Math.min(...styles.map((style) => style.y)); const maxY = Math.max(...styles.map((style) => style.y + style.height));
    updateElements((element) => {
      const style = { ...element.styles[breakpoint] };
      if (mode === "left") style.x = minX;
      if (mode === "center") style.x = Math.round((minX + maxX - style.width) / 2);
      if (mode === "right") style.x = maxX - style.width;
      if (mode === "top") style.y = minY;
      if (mode === "middle") style.y = Math.round((minY + maxY - style.height) / 2);
      if (mode === "bottom") style.y = maxY - style.height;
      return { ...element, styles: { ...element.styles, [breakpoint]: style } };
    }, `Aligned ${selection.length} elements ${mode} on ${breakpoint}.`);
  };

  const distributeSelection = (axis: "horizontal" | "vertical") => {
    if (selected.length < 3) return;
    const ordered = [...selected].sort((a, b) => axis === "horizontal" ? a.styles[breakpoint].x - b.styles[breakpoint].x : a.styles[breakpoint].y - b.styles[breakpoint].y);
    const first = ordered[0].styles[breakpoint]; const last = ordered[ordered.length - 1].styles[breakpoint];
    const start = axis === "horizontal" ? first.x : first.y; const end = axis === "horizontal" ? last.x : last.y;
    const step = (end - start) / (ordered.length - 1);
    const positions = new Map(ordered.map((element, index) => [element.id, Math.round(start + step * index)]));
    updateElements((element) => { const style = { ...element.styles[breakpoint] }; if (axis === "horizontal") style.x = positions.get(element.id) ?? style.x; else style.y = positions.get(element.id) ?? style.y; return { ...element, styles: { ...element.styles, [breakpoint]: style } }; }, `Distributed ${selection.length} elements ${axis}.`);
  };

  const duplicateSelection = () => {
    const duplicates = selected.filter((element) => !element.protected).map((element, index) => {
      const copyElement = clone(element); copyElement.id = `${element.id}-copy-${Date.now()}-${index}`; copyElement.name = `${element.name} Copy`; copyElement.parentId = null; copyElement.protected = false;
      breakpoints.forEach((mode) => { copyElement.styles[mode].x = Math.min(23, copyElement.styles[mode].x + 1); copyElement.styles[mode].y = Math.min(rowsByBreakpoint[mode] - 1, copyElement.styles[mode].y + 1); });
      return copyElement;
    });
    if (!duplicates.length) return;
    publishCanvas({ ...canvas, elements: [...canvas.elements, ...duplicates] }, `Duplicated ${duplicates.length} presentation layer${duplicates.length === 1 ? "" : "s"}.`); setSelection(duplicates.map((element) => element.id));
  };
  const pasteSelection = () => {
    const pasted = clipboard.filter((element) => !element.protected).map((element, index) => ({ ...clone(element), id: `${element.id}-paste-${Date.now()}-${index}`, name: `${element.name} Paste` }));
    if (!pasted.length) return;
    publishCanvas({ ...canvas, elements: [...canvas.elements, ...pasted] }, `Pasted ${pasted.length} presentation layer${pasted.length === 1 ? "" : "s"}.`); setSelection(pasted.map((element) => element.id));
  };
  const deleteSelection = () => { const deletable = selected.filter((element) => !element.protected).map((element) => element.id); if (!deletable.length) return; publishCanvas({ ...canvas, elements: canvas.elements.filter((element) => !deletable.includes(element.id)) }, `Deleted ${deletable.length} optional layer${deletable.length === 1 ? "" : "s"}.`); setSelection([]); };
  const zChange = (mode: "forward" | "backward" | "front" | "back") => updateElements((element) => ({ ...element, zIndex: mode === "front" ? 200 : mode === "back" ? Math.max(1, element.protected ? element.zIndex : 1) : Math.max(1, element.zIndex + (mode === "forward" ? 1 : -1)) }), `Layer order changed: ${mode}.`);
  const groupSelection = () => { if (selected.length < 2) return; const group = createSignInCanvasElement(`group-${Date.now()}`, "Owner Group", "GROUP"); group.kind = "group"; group.parentId = null; publishCanvas({ ...canvas, elements: [...canvas.elements.map((element) => selection.includes(element.id) ? { ...element, parentId: group.id } : element), group] }, `Grouped ${selection.length} presentation layers.`); setSelection([group.id]); };
  const ungroupSelection = () => updateElements((element) => ({ ...element, parentId: null }), "Selected layers ungrouped.");

  const updateStyle = (patch: Partial<SignInCanvasStyle>, label: string) => updateElements((element) => ({ ...element, styles: { ...element.styles, [breakpoint]: { ...element.styles[breakpoint], ...patch } } }), `${label} updated on ${breakpoint}.`);
  const copyBreakpoint = (from: SignInBreakpoint, to: SignInBreakpoint) => {
    publishCanvas({ ...canvas, elements: canvas.elements.map((element) => ({ ...element, styles: { ...element.styles, [to]: clone(element.styles[from]) } })) }, `Copied ${from} arrangement to ${to}; all breakpoints remain independently editable.`);
    onBreakpointChange(to);
  };

  const visibleLayers = canvas.elements.filter((element) => element.name.toLowerCase().includes(layerQuery.toLowerCase()));
  const background = theme.background.backgrounds.find((item) => item.id === theme.background.defaultBackground) || theme.background.backgrounds[0];
  const dirty = activeFingerprint !== draftFingerprint;

  return <section className="studio-builder" data-testid="visual-canvas-builder">
    <header className="studio-builder-header">
      <div><span><SquareDashedMousePointer /> TRUE VISUAL CANVAS</span><h3>{theme.name}</h3><p>Direct selection, drag, resize, layers, responsive arrangements, state design, and guarded auth presentation.</p></div>
      <div className="studio-builder-status"><span data-state={dirty ? "draft" : "synced"}>{dirty ? "DRAFT CHANGES" : "MATCHES ACTIVE"}</span><code>{draftFingerprint}</code></div>
    </header>

    <div className="studio-canvas-toolbar" role="toolbar" aria-label="Canvas editing tools">
      <div><ToolButton label="Undo" disabled={!undoStack.length} onClick={undo} testId="canvas-undo"><Undo2 /></ToolButton><ToolButton label="Redo" disabled={!redoStack.length} onClick={redo} testId="canvas-redo"><Redo2 /></ToolButton></div>
      <div><ToolButton label="Multi-select" pressed={multiSelectMode} onClick={() => { setMultiSelectMode((current) => !current); if (multiSelectMode && selection.length > 1) setSelection(selection.slice(0, 1)); }}><MousePointer2 /></ToolButton><ToolButton label="Duplicate" disabled={!selected.some((element) => !element.protected)} onClick={duplicateSelection}><Copy /></ToolButton><ToolButton label="Copy" disabled={!selected.length} onClick={() => setClipboard(clone(selected))}><Copy /></ToolButton><ToolButton label="Paste" disabled={!clipboard.length} onClick={pasteSelection}><ClipboardPaste /></ToolButton><ToolButton label="Delete" disabled={!selected.some((element) => !element.protected)} onClick={deleteSelection}><Trash2 /></ToolButton></div>
      <div><ToolButton label="Align left" disabled={selected.length < 2} onClick={() => alignSelection("left")}><AlignStartVertical /></ToolButton><ToolButton label="Align center" disabled={selected.length < 2} onClick={() => alignSelection("center")}><AlignCenter /></ToolButton><ToolButton label="Align right" disabled={selected.length < 2} onClick={() => alignSelection("right")}><AlignEndVertical /></ToolButton><ToolButton label="Align top" disabled={selected.length < 2} onClick={() => alignSelection("top")}><AlignStartHorizontal /></ToolButton><ToolButton label="Align middle" disabled={selected.length < 2} onClick={() => alignSelection("middle")}><AlignCenter /></ToolButton><ToolButton label="Align bottom" disabled={selected.length < 2} onClick={() => alignSelection("bottom")}><AlignEndHorizontal /></ToolButton><ToolButton label="Distribute horizontal" disabled={selected.length < 3} onClick={() => distributeSelection("horizontal")}><AlignHorizontalDistributeCenter /></ToolButton><ToolButton label="Distribute vertical" disabled={selected.length < 3} onClick={() => distributeSelection("vertical")}><AlignVerticalDistributeCenter /></ToolButton></div>
      <div><ToolButton label="Group" disabled={selected.length < 2} onClick={groupSelection}><Group /></ToolButton><ToolButton label="Ungroup" disabled={!selected.some((element) => element.parentId)} onClick={ungroupSelection}><Ungroup /></ToolButton><ToolButton label="Bring forward" disabled={!selected.length} onClick={() => zChange("forward")}><BringToFront /></ToolButton><ToolButton label="Send backward" disabled={!selected.length} onClick={() => zChange("backward")}><SendToBack /></ToolButton><ToolButton label="Bring to front" disabled={!selected.length} onClick={() => zChange("front")}><BringToFront /></ToolButton><ToolButton label="Send to back" disabled={!selected.length} onClick={() => zChange("back")}><SendToBack /></ToolButton></div>
      <button className="studio-library-shortcut" type="button" onClick={onOpenLibrary}><Library /> Component Library</button>
    </div>

    <div className="studio-responsive-toolbar">
      <div role="group" aria-label="Independent responsive layout">{breakpoints.map((mode) => <button key={mode} type="button" aria-pressed={breakpoint === mode} onClick={() => onBreakpointChange(mode)}>{mode === "desktop" ? "Desktop" : mode === "tablet" ? "Tablet" : "Mobile"}<small>{mode === "desktop" ? "1440+" : mode === "tablet" ? "768–1199" : "320–767"}</small></button>)}</div>
      <div><button type="button" onClick={() => copyBreakpoint("desktop", "tablet")}>Copy Desktop → Tablet</button><button type="button" onClick={() => copyBreakpoint("tablet", "mobile")}>Copy Tablet → Mobile</button></div>
      <span><Grid3X3 /> 24-column grid · {rowsByBreakpoint[breakpoint]} rows</span>
    </div>

    <div className="studio-builder-workspace">
      <aside className="studio-layers" aria-label="Layers panel" data-testid="layers-panel">
        <header><div><Layers3 /><span><strong>Layers</strong><small>{canvas.elements.length} presentation layers</small></span></div><button type="button" title="Collapse layers"><PanelLeft /></button></header>
        <label className="studio-layer-search"><Search /><input value={layerQuery} onChange={(event) => setLayerQuery(event.target.value)} placeholder="Search layers" aria-label="Search layers" /></label>
        <div className="studio-layer-tree">{visibleLayers.map((element, index) => { const Icon = elementIcon(element); const depth = element.parentId ? canvas.elements.find((item) => item.id === element.parentId)?.parentId ? 2 : 1 : 0; return <div key={element.id} className={`studio-layer-row${selection.includes(element.id) ? " is-selected" : ""}`} style={{ "--layer-depth": depth } as CSSProperties}>
          <button type="button" className="studio-layer-select" onClick={(event) => selectElement(element.id, multiSelectMode || event.shiftKey || event.ctrlKey || event.metaKey)}><ChevronRight /><Icon /><span><strong>{element.name}</strong><small>{element.kind}{element.protected ? " · protected" : ""}</small></span></button>
          <button type="button" title={element.visible ? "Hide" : "Show"} disabled={element.protected} onClick={() => { setSelection([element.id]); publishCanvas({ ...canvas, elements: canvas.elements.map((item) => item.id === element.id ? { ...item, visible: !item.visible } : item) }, `${element.name} visibility changed.`); }}>{element.visible ? <Eye /> : <EyeOff />}</button>
          <button type="button" title={element.locked ? "Unlock" : "Lock"} disabled={element.kind === "background"} onClick={() => { setSelection([element.id]); publishCanvas({ ...canvas, elements: canvas.elements.map((item) => item.id === element.id ? { ...item, locked: !item.locked } : item) }, `${element.name} ${element.locked ? "unlocked" : "locked"}.`); }}>{element.locked ? <Lock /> : <LockOpen />}</button>
          <div className="studio-layer-order"><button type="button" disabled={index === 0} onClick={() => { const next = [...canvas.elements]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; publishCanvas({ ...canvas, elements: next }, `${element.name} moved earlier in Layers.`); }}>↑</button><button type="button" disabled={index === visibleLayers.length - 1} onClick={() => { const actual = canvas.elements.findIndex((item) => item.id === element.id); const next = [...canvas.elements]; if (actual < next.length - 1) [next[actual], next[actual + 1]] = [next[actual + 1], next[actual]]; publishCanvas({ ...canvas, elements: next }, `${element.name} moved later in Layers.`); }}>↓</button></div>
        </div>; })}</div>
        <footer><span><Eye /> visible</span><span><Lock /> locked</span><span><ShieldCheck /> protected</span></footer>
      </aside>

      <main className={`studio-canvas-shell is-${breakpoint}`}>
        <header><div><span>{breakpoint.toUpperCase()} ARRANGEMENT</span><strong>{selection.length ? `${selection.length} selected` : "Select an element"}</strong></div><div><Switch label="Snap" checked={canvas.snapToGrid} onChange={(checked) => publishCanvas({ ...canvas, snapToGrid: checked }, `Snap-to-grid ${checked ? "enabled" : "disabled"}.`)} /><Switch label="Guides" checked={canvas.smartGuides} onChange={(checked) => publishCanvas({ ...canvas, smartGuides: checked }, `Smart guides ${checked ? "enabled" : "disabled"}.`)} /></div></header>
        <div className="studio-canvas-viewport">
          <div className="studio-canvas-stage" data-breakpoint={breakpoint} data-testid="studio-canvas-stage" onPointerDown={() => setSelection([])} style={{ backgroundImage: `linear-gradient(rgba(3,28,18,.08),rgba(3,28,18,.16)), url(${background.source})`, backgroundPosition: `${breakpoint === "desktop" ? background.desktopFocalX : breakpoint === "tablet" ? background.tabletFocalX : background.mobileFocalX}% ${breakpoint === "desktop" ? background.desktopFocalY : breakpoint === "tablet" ? background.tabletFocalY : background.mobileFocalY}%` }}>
            <div className="studio-grid-overlay" aria-hidden="true" />
            {guides.includes("center-x") && <i className="studio-guide vertical" />}{guides.includes("center-y") && <i className="studio-guide horizontal" />}
            {canvas.elements.filter((element) => element.visible && !["background", "group"].includes(element.kind)).map((element) => <div key={element.id} className={`studio-canvas-element kind-${element.kind}${selection.includes(element.id) ? " is-selected" : ""}${element.locked ? " is-locked" : ""}`} data-element-id={element.id} data-variant={element.variant} data-state={element.state} data-motion={element.motion.entrance.toLowerCase().replaceAll(" ", "-")} style={{ ...styleForElement(element, breakpoint), "--studio-motion-duration": `${element.motion.durationMs}ms`, "--studio-motion-intensity": element.motion.intensity / 100 } as CSSProperties} onPointerDown={(event) => { const additive = multiSelectMode || event.shiftKey || event.ctrlKey || event.metaKey; selectElement(element.id, additive); if (!additive) beginOperation(event, "move", undefined, element.id); }}>
              <WidgetBoundary name={element.name}>{renderElement(element, theme)}</WidgetBoundary>
              {selection.includes(element.id) && <><span className="studio-selection-label"><Move /> {element.name} · {element.styles[breakpoint].width}×{element.styles[breakpoint].height}</span>{!element.locked && ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((direction) => <button key={direction} type="button" aria-label={`Resize ${element.name} ${direction}`} className={`studio-resize-handle handle-${direction}`} data-resize-handle={direction} data-testid={direction === "se" ? "resize-handle-se" : undefined} onPointerDown={(event) => beginOperation(event, "resize", direction, element.id)} />)}</>}
            </div>)}
          </div>
        </div>
        {overlapWarning && <div className="studio-overlap-warning" role="status"><ShieldAlert /><span><strong>Safe overlap warning</strong>{overlapWarning} Reposition before publishing.</span></div>}
        <footer><span>Active: <code>{activeFingerprint}</code></span><span>Draft: <code>{draftFingerprint}</code></span><button type="button" onClick={onOpenCompare}>Compare changes</button></footer>
      </main>

      <aside className="studio-inspector" data-testid="style-inspector">
        <header><div><MousePointer2 /><span><strong>{primary?.name || "Inspector"}</strong><small>{primary ? `${primary.kind} · ${breakpoint}` : "Select a canvas layer"}</small></span></div>{primary?.protected && <em><ShieldCheck /> PROTECTED</em>}</header>
        {!primary ? <div className="studio-inspector-empty"><MousePointer2 /><p>Select an element on the canvas or in Layers to edit its presentation.</p></div> : <>
          <nav>{(["style", "motion", "states", ...(primary.kind === "logo" ? ["logo"] : [])] as Array<typeof inspectorSection>).map((section) => <button key={section} type="button" aria-current={inspectorSection === section ? "page" : undefined} onClick={() => setInspectorSection(section)}>{section}</button>)}</nav>
          {inspectorSection === "style" && <div className="studio-inspector-body">
            <section><h4>Geometry <span>direct grid units</span></h4><div className="studio-geometry-grid">{(["x", "y", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight"] as const).map((key) => <label key={key}><span>{key}</span><input type="number" value={primary.styles[breakpoint][key]} min={key === "x" || key === "y" ? 0 : 1} max={key === "y" || key.includes("Height") ? rowsByBreakpoint[breakpoint] : 24} onChange={(event) => updateStyle({ [key]: Number(event.target.value) }, `${primary.name} ${key}`)} /></label>)}</div><Switch checked={primary.styles[breakpoint].aspectRatioLocked} label="Lock aspect ratio" onChange={(checked) => updateStyle({ aspectRatioLocked: checked }, "Aspect ratio lock")} /><div className="studio-size-presets"><button type="button" onClick={() => updateStyle({ width: primary.styles[breakpoint].minWidth, height: primary.styles[breakpoint].minHeight }, "Compact size")}>Compact</button><button type="button" onClick={() => updateStyle({ width: Math.min(12, primary.styles[breakpoint].maxWidth), height: Math.min(6, primary.styles[breakpoint].maxHeight) }, "Feature size")}>Feature</button><button type="button" onClick={() => updateStyle({ x: 0, width: 24 }, "Full width")}>Full width</button></div></section>
            <section><h4>Surface</h4><label>Glass preset<select value={primary.styles[breakpoint].glassStyle} onChange={(event) => updateStyle({ glassStyle: event.target.value as SignInGlassStyle }, "Glass preset")}>{glassStyles.map((style) => <option key={style}>{style}</option>)}</select></label><div className="studio-color-grid">{(["background", "gradientStart", "gradientEnd", "borderColor", "textColor"] as const).map((key) => <label key={key}><span>{key}</span><input type="color" value={primary.styles[breakpoint][key]} onChange={(event) => updateStyle({ [key]: event.target.value }, `${key} color`)} /></label>)}</div><InspectorRange label="Background opacity" value={primary.styles[breakpoint].backgroundOpacity} min={0} max={100} suffix="%" onChange={(value) => updateStyle({ backgroundOpacity: value }, "Background opacity")} /><InspectorRange label="Backdrop blur" value={primary.styles[breakpoint].backdropBlur} min={0} max={48} suffix="px" onChange={(value) => updateStyle({ backdropBlur: value }, "Backdrop blur")} /><InspectorRange label="Border" value={primary.styles[breakpoint].borderWidth} min={0} max={8} suffix="px" onChange={(value) => updateStyle({ borderWidth: value }, "Border width")} /><InspectorRange label="Corner radius" value={primary.styles[breakpoint].radius} min={0} max={64} suffix="px" onChange={(value) => updateStyle({ radius: value }, "Corner radius")} /><InspectorRange label="Shadow" value={primary.styles[breakpoint].shadow} min={0} max={100} suffix="%" onChange={(value) => updateStyle({ shadow: value }, "Shadow")} /><InspectorRange label="Glow" value={primary.styles[breakpoint].glow} min={0} max={100} suffix="%" onChange={(value) => updateStyle({ glow: value }, "Glow")} /><InspectorRange label="Reflection" value={primary.styles[breakpoint].reflection} min={0} max={100} suffix="%" onChange={(value) => updateStyle({ reflection: value }, "Reflection")} /><InspectorRange label="Texture / noise" value={primary.styles[breakpoint].texture} min={0} max={100} suffix="%" onChange={(value) => updateStyle({ texture: value }, "Texture")} /></section>
            <section><h4>Spacing & typography</h4><InspectorRange label="Padding" value={primary.styles[breakpoint].padding} min={0} max={64} suffix="px" onChange={(value) => updateStyle({ padding: value }, "Padding")} /><InspectorRange label="Margin" value={primary.styles[breakpoint].margin} min={0} max={64} suffix="px" onChange={(value) => updateStyle({ margin: value }, "Margin")} /><InspectorRange label="Gap" value={primary.styles[breakpoint].gap} min={0} max={48} suffix="px" onChange={(value) => updateStyle({ gap: value }, "Gap")} /><InspectorRange label="Font size" value={primary.styles[breakpoint].fontSize} min={10} max={96} suffix="px" onChange={(value) => updateStyle({ fontSize: value }, "Font size")} /><InspectorRange label="Font weight" value={primary.styles[breakpoint].fontWeight} min={300} max={900} step={50} suffix="" onChange={(value) => updateStyle({ fontWeight: value }, "Font weight")} /><InspectorRange label="Line height" value={primary.styles[breakpoint].lineHeight} min={80} max={220} suffix="%" onChange={(value) => updateStyle({ lineHeight: value }, "Line height")} /><InspectorRange label="Letter spacing" value={primary.styles[breakpoint].letterSpacing} min={-5} max={24} suffix="/10" onChange={(value) => updateStyle({ letterSpacing: value }, "Letter spacing")} /></section>
          </div>}
          {inspectorSection === "motion" && <div className="studio-inspector-body"><section><h4>Motion inspector <span>safe presets</span></h4>{(["entrance", "hover", "focus", "active", "dataUpdate", "loading", "idle"] as const).map((key) => <label key={key}>{key}<select value={primary.motion[key]} onChange={(event) => updateElements((element) => ({ ...element, motion: { ...element.motion, [key]: event.target.value as SignInMotionPreset } }), `${key} motion updated.`)}>{motionPresets.map((preset) => <option key={preset}>{preset}</option>)}</select></label>)}<InspectorRange label="Duration" value={primary.motion.durationMs} min={80} max={4000} step={20} suffix="ms" onChange={(value) => updateElements((element) => ({ ...element, motion: { ...element.motion, durationMs: value } }), "Motion duration updated.")} /><InspectorRange label="Delay" value={primary.motion.delayMs} min={0} max={3000} step={20} suffix="ms" onChange={(value) => updateElements((element) => ({ ...element, motion: { ...element.motion, delayMs: value } }), "Motion delay updated.")} /><InspectorRange label="Intensity" value={primary.motion.intensity} min={0} max={100} suffix="%" onChange={(value) => updateElements((element) => ({ ...element, motion: { ...element.motion, intensity: value } }), "Motion intensity updated.")} /><label>Reduced-motion equivalent<select value={primary.motion.reducedMotion} onChange={(event) => updateElements((element) => ({ ...element, motion: { ...element.motion, reducedMotion: event.target.value as "none" | "fade" } }), "Reduced-motion fallback updated.")}><option value="fade">Fade only</option><option value="none">No motion</option></select></label><p className="studio-safe-note"><ShieldCheck /> Endless spinning, bouncing, strobing, flashing, and extreme bloom are not offered.</p></section></div>}
          {inspectorSection === "states" && <div className="studio-inspector-body"><section><h4>Component states</h4><div className="studio-state-grid">{componentStates.map((state) => <button key={state} type="button" aria-pressed={primary.state === state} onClick={() => updatePrimary((element) => ({ ...element, state }), `${primary.name} preview state set to ${state}.`)}>{state}</button>)}</div><label>Design variant<select data-testid="variant-selector" value={primary.variant} onChange={(event) => updatePrimary((element) => ({ ...element, variant: event.target.value }), `${primary.name} variant changed; data binding and identity preserved.`)}>{primary.variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label><div className="studio-binding-lock"><Lock /><span><strong>Binding preserved</strong><small>{primary.dataBinding}</small></span></div></section></div>}
          {inspectorSection === "logo" && primary.kind === "logo" && <div className="studio-inspector-body" data-testid="logo-controls"><section><h4>Official logo presentation</h4><p className="studio-safe-note"><ShieldCheck /> Intrinsic proportions are locked; presentation instances never distort the official geometry.</p><InspectorRange label="Scale" value={canvas.logoInstances.hero.scale} min={20} max={220} suffix="%" onChange={(value) => { const next = { ...canvas, logoInstances: { ...canvas.logoInstances, hero: { ...canvas.logoInstances.hero, scale: value } } }; publishCanvas(next, "Hero logo scale updated."); }} /><InspectorRange label="Opacity" value={canvas.logoInstances.hero.opacity} min={0} max={100} suffix="%" onChange={(value) => { const next = { ...canvas, logoInstances: { ...canvas.logoInstances, hero: { ...canvas.logoInstances.hero, opacity: value } } }; publishCanvas(next, "Hero logo opacity updated."); }} /><label>Alignment<select value={canvas.logoInstances.hero.alignment} onChange={(event) => { const next = { ...canvas, logoInstances: { ...canvas.logoInstances, hero: { ...canvas.logoInstances.hero, alignment: event.target.value as "left" | "center" | "right" } } }; publishCanvas(next, "Hero logo alignment updated."); }}><option>left</option><option>center</option><option>right</option></select></label></section><section><h4>Optional logo instances</h4>{logoPlacements.map((placement) => <Switch key={placement} checked={canvas.logoInstances[placement].enabled} label={placement.replace("-", " ")} onChange={(enabled) => publishCanvas({ ...canvas, logoInstances: { ...canvas.logoInstances, [placement]: { ...canvas.logoInstances[placement], enabled } } }, `${placement} logo instance ${enabled ? "enabled" : "disabled"}.`)} />)}</section></div>}
        </>}
      </aside>
    </div>
  </section>;
}

export type LibraryDefinition = { category: string; name: string; icon: string; variants: string[]; description: string };

export const componentLibrary: LibraryDefinition[] = [
  ...["Text", "Heading", "Rich Text", "Image", "Logo", "Icon", "Button", "Divider", "Badge", "Status", "Spacer", "Container"].map((name) => ({ category: "BASIC", name, icon: name === "Heading" ? "Type" : "Box", variants: ["Minimal", "Glass", "Floating", "Outline"], description: "Composable presentation primitive" })),
  ...["Metric", "Stat Card", "Counter", "Comparison", "Trend", "Sparkline", "Progress", "Radial Progress", "Gauge", "Score"].map((name) => ({ category: "KPI / INTELLIGENCE", name, icon: "Gauge", variants: ["Executive", "Minimal Number", "Sparkline", "Trend", "Comparison", "Radial", "Glass", "Gradient", "Outline", "Technical HUD"], description: "Read-only intelligence presentation" })),
  ...["Line", "Area", "Bar", "Column", "Stacked", "Donut", "Radar", "Scatter", "Bubble", "Heatmap", "Treemap", "Waterfall", "Funnel", "Timeline", "Mixed Chart"].map((name) => ({ category: "CHARTS", name: `${name} Chart`, icon: "Chart", variants: ["Executive", "Technical", "Minimal", "Glass", "Daylight", "Dark"], description: "Lazy-loaded chart surface" })),
  ...["Weather", "Weather Forecast", "Environmental Conditions", "Farm Status", "Operational Alert", "Crop / Farm Insight", "Farm Location", "Site Status", "Daily Briefing", "Farm Safety", "Recognition", "Production Insight", "Sustainability Message"].map((name) => ({ category: "FARM / OPERATIONS", name, icon: "CloudSun", variants: name.includes("Weather") ? ["Transparent Glass", "Crystal Glass", "Frosted", "Minimal", "Compact", "Detailed", "Command", "Hero", "Floating", "Outline", "Daylight", "Dark"] : ["Executive", "Glass", "Command", "Minimal", "Alert"], description: "Farm presentation component with truthful data states" })),
  ...["Analog Clock", "Digital Clock", "World Clock", "Timezone Card", "Date / Time Card"].map((name) => ({ category: "TIME", name, icon: "Clock", variants: ["Premium Analog", "Minimal Analog", "Digital", "Hybrid", "Glass", "Floating", "Compact", "Command"], description: "IANA-timezone presentation" })),
  ...["Daily Spotlight", "News", "Announcement", "Notice", "Quote", "Insight", "Tip", "Carousel", "Gallery", "Media Card"].map((name) => ({ category: "CONTENT", name, icon: "Newspaper", variants: name === "News" ? ["Editorial", "Compact Feed", "Hero Story", "Glass", "Cards", "Accessible Headlines"] : ["Editorial", "Glass", "Minimal", "Cards"], description: "Editorial and Owner-managed content" })),
  ...["Quick Action", "Link Group", "Segmented Navigation", "Action Menu", "Command Shortcut"].map((name) => ({ category: "NAVIGATION / ACTION", name, icon: "Zap", variants: ["Pill", "Command", "Minimal", "Glass"], description: "Presentation-safe navigation surface" })),
  ...["Compact Table", "List", "Timeline", "Activity Feed", "Status Feed", "Key / Value Panel"].map((name) => ({ category: "DATA / PRESENTATION", name, icon: "Layout", variants: ["Compact", "Executive", "Glass", "Technical"], description: "Read-only data presentation" })),
  ...["Image", "Background Image", "Illustration", "Video Placeholder", "Carousel"].map((name) => ({ category: "MEDIA", name, icon: "Image", variants: ["Contained", "Cover", "Floating", "Glass", "Editorial"], description: "Responsive media presentation" })),
  { category: "CUSTOM", name: "Reusable Custom Widget", icon: "Sparkles", variants: ["Crystal Glass", "Minimal", "Command"], description: "Owner-designed reusable component" },
  { category: "CUSTOM", name: "Presentation HTML Component", icon: "Code", variants: ["Isolated"], description: "Advanced Mode only; network and auth APIs blocked" },
];

type LibraryProps = { theme: SignInThemeProfile; onChange: (theme: SignInThemeProfile, summary: string) => void; onOpenCanvas: () => void };

export function ComponentLibraryPanel({ theme, onChange, onOpenCanvas }: LibraryProps) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("ALL"); const [creatorOpen, setCreatorOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "Farm Intelligence", category: "FARM / OPERATIONS", icon: "Sparkles", title: "Farm Intelligence", subtitle: "Owner-managed insight", layout: "stacked", visualStyle: "Crystal Glass", fields: "Label, Value, Freshness", content: "Design content · provider pending", dataBinding: "Future read-only provider binding", loadingState: "Loading insight…", emptyState: "No insight available", errorState: "Widget unavailable", responsiveSize: "Desktop 6×3 · Tablet 8×3 · Mobile 22×3", interactions: "Open detail", permissionsMetadata: "Presentation only · no backend write authority", description: "Reusable farm-intelligence presentation surface" });
  const categories = ["ALL", ...new Set(componentLibrary.map((item) => item.category))];
  const filtered = componentLibrary.filter((item) => (category === "ALL" || item.category === category) && `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  const addDefinition = (definition: LibraryDefinition) => {
    const id = `library-${definition.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const widget: SignInCustomWidget = { id, name: definition.name, kind: definition.category === "MEDIA" ? "media" : definition.category.includes("KPI") ? "metric" : "insight", category: definition.category, icon: definition.icon, title: definition.name, subtitle: definition.description, content: "Design content · configure source before publishing.", sourceLabel: "Studio component library", dataBinding: "No authoritative data binding", layout: "stacked", visualStyle: definition.variants[0], fields: ["Label", "Value", "Freshness"], loadingState: "Loading presentation…", emptyState: "No data available", errorState: "Widget unavailable", responsiveSize: "Desktop 6×3 · Tablet 8×3 · Mobile 22×3", variants: definition.variants, interactions: [], permissionsMetadata: "Presentation only · no backend write authority", description: definition.description, version: 1, savedToLibrary: false, archived: false, enabled: true };
    const element = createSignInCanvasElement(id, definition.name, definition.category);
    element.variants = definition.variants; element.variant = definition.variants[0]; element.dataBinding = widget.dataBinding;
    onChange({ ...theme, widgets: { ...theme.widgets, order: [...theme.widgets.order, id], custom: [...theme.widgets.custom, widget] }, canvas: { ...theme.canvas, elements: [...theme.canvas.elements, element] } }, `${definition.name} added to Draft from the lazy Component Library. Active Sign-In unchanged.`);
    onOpenCanvas();
  };
  const createCustom = () => {
    const name = draft.name.trim(); if (!name) return;
    const id = `my-component-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const widget: SignInCustomWidget = { id, name, kind: "insight", category: draft.category, icon: draft.icon, title: draft.title, subtitle: draft.subtitle, content: draft.content, sourceLabel: "Owner-designed component", dataBinding: draft.dataBinding, layout: draft.layout, visualStyle: draft.visualStyle, fields: draft.fields.split(",").map((item) => item.trim()).filter(Boolean), loadingState: draft.loadingState, emptyState: draft.emptyState, errorState: draft.errorState, responsiveSize: draft.responsiveSize, variants: [draft.visualStyle, "Minimal", "Command"], interactions: draft.interactions.split(",").map((item) => item.trim()).filter(Boolean), permissionsMetadata: draft.permissionsMetadata, description: draft.description, version: 1, savedToLibrary: true, archived: false, enabled: true };
    const element = createSignInCanvasElement(id, name, draft.category); element.variants = widget.variants || []; element.variant = widget.visualStyle || "Crystal Glass"; element.dataBinding = widget.dataBinding;
    onChange({ ...theme, widgets: { ...theme.widgets, order: [...theme.widgets.order, id], custom: [...theme.widgets.custom, widget] }, canvas: { ...theme.canvas, elements: [...theme.canvas.elements, element] } }, `${name} saved to My Components and added to the isolated Draft.`); setCreatorOpen(false); onOpenCanvas();
  };
  const myComponents = theme.widgets.custom.filter((widget) => widget.savedToLibrary);
  return <section className="studio-library-panel" data-testid="component-library"><header><div><Library /><span><strong>Component & Widget Library</strong><small>{componentLibrary.length}+ presentation components · only used components publish</small></span></div><button className="primary" type="button" onClick={() => setCreatorOpen(true)}><Plus /> Create Custom Widget</button></header>
    <div className="studio-library-controls"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components, charts, farm widgets…" /></label><div>{categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    <div className="studio-library-grid">{filtered.map((definition, index) => <article key={`${definition.category}-${definition.name}-${index}`}><div><span>{definition.icon === "Clock" ? <Clock3 /> : definition.icon === "CloudSun" ? <CloudSun /> : definition.icon === "Gauge" ? <Gauge /> : definition.icon === "Newspaper" ? <Newspaper /> : definition.icon === "Code" ? <Code2 /> : <LayoutDashboard />}</span><em>{definition.category}</em></div><strong>{definition.name}</strong><p>{definition.description}</p><small>{definition.variants.length} design variants</small><button type="button" onClick={() => addDefinition(definition)}><Plus /> Add to Draft</button></article>)}</div>
    <section className="studio-my-components"><header><div><Box /><span><strong>My Components</strong><small>Saved widgets, clones, and reusable sections</small></span></div><b>{myComponents.length}</b></header>{myComponents.length ? <div>{myComponents.map((widget) => <article key={widget.id} data-archived={widget.archived}><span><Sparkles /></span><div><strong>{widget.name}</strong><small>v{widget.version || 1} · {widget.category} · {widget.archived ? "ARCHIVED" : "READY"}</small></div><button type="button" onClick={() => onChange({ ...theme, widgets: { ...theme.widgets, custom: theme.widgets.custom.map((item) => item.id === widget.id ? { ...item, name: `${item.name} Copy`, id: `${item.id}-copy-${Date.now()}`, duplicatedFrom: item.id, version: 1 } : item) } }, `${widget.name} duplicated in My Components.`)}><Copy /> Duplicate</button><button type="button" onClick={() => onChange({ ...theme, widgets: { ...theme.widgets, custom: theme.widgets.custom.map((item) => item.id === widget.id ? { ...item, archived: !item.archived, version: (item.version || 1) + 1 } : item) } }, `${widget.name} ${widget.archived ? "restored" : "archived"}.`)}>{widget.archived ? <RotateCcw /> : <Archive />}{widget.archived ? "Restore" : "Archive"}</button><button type="button" onClick={() => { const blob = new Blob([JSON.stringify(widget, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${widget.id}.component.json`; anchor.click(); URL.revokeObjectURL(url); }}>Export</button></article>)}</div> : <p>No saved components yet. Create one to make it reusable across Studio drafts.</p>}</section>
    {creatorOpen && <div className="studio-custom-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-widget-title"><section><header><div><WandSparkles /><span><strong id="custom-widget-title">Create Custom Widget</strong><small>Presentation-only · no backend write authority</small></span></div><button type="button" onClick={() => setCreatorOpen(false)}><Trash2 /></button></header><div className="studio-custom-fields">{Object.entries(draft).map(([key, value]) => key === "content" || key === "description" ? <label key={key} className="wide"><span>{key}</span><textarea value={value} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label> : <label key={key} className={key === "permissionsMetadata" || key === "dataBinding" ? "wide" : ""}><span>{key}</span><input value={value} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</div><footer><button type="button" onClick={() => setCreatorOpen(false)}>Cancel</button><button type="button" className="primary" onClick={createCustom}><Save /> Save To My Components + Add</button></footer></section></div>}
  </section>;
}

export function AIDesignerPanel({ theme }: { theme: SignInThemeProfile }) {
  const [scope, setScope] = useState("Selected widget"); const [prompt, setPrompt] = useState("Make this weather widget more transparent without changing its data."); const [submitted, setSubmitted] = useState(false);
  const examples = ["Give me three premium clock designs.", "Improve spacing on the left side.", "Rearrange this section for mobile.", "Make the logo glow subtly when the page opens.", "Create a farm-intelligence widget."];
  return <section className="studio-ai-panel" data-testid="ai-designer"><header><div><Bot /><span><strong>Daenem AI Designer</strong><small>Draft-only design proposals · never publishes or changes auth/RBAC</small></span></div><b>AI PROVIDER NOT CONNECTED</b></header><div className="studio-ai-layout"><section><label>Design scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option>Entire page</option><option>Selected section</option><option>Selected widget</option><option>Official logo</option><option>Selected group</option></select></label><label>Describe the design change<textarea rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><div className="studio-ai-examples">{examples.map((example) => <button key={example} type="button" onClick={() => setPrompt(example)}>{example}</button>)}</div><button type="button" className="primary" onClick={() => setSubmitted(true)}><WandSparkles /> Request Draft Proposal</button></section><aside><div className="studio-ai-orb"><Bot /></div><span>DAENEM DESIGN INTELLIGENCE</span><h4>{submitted ? "Proposal could not run" : "Design safely, review deliberately"}</h4><p>{submitted ? "No AI execution provider is connected in Sites. The prompt was not presented as completed and no draft was fabricated." : "AI proposals are isolated drafts with Accept, Reject, Try Another, Undo, and Compare controls."}</p>{submitted && <div className="studio-ai-dependency"><ShieldAlert /><span><strong>Provider/runtime work remaining</strong><small>Connect an approved design-execution provider, authorize a presentation-only tool boundary, add structured diff output, and persist proposal provenance.</small></span></div>}<div className="studio-ai-actions"><button disabled type="button">Accept</button><button disabled type="button">Reject</button><button disabled type="button">Try Another</button><button disabled type="button">Undo</button><button disabled type="button">Compare</button></div><code>{presentationSnapshotId(theme)}</code></aside></div></section>;
}

export function PublishValidationPanel({ settings, themeId, revision = 0 }: { settings: PortalPresentationSettings; themeId: string; revision?: number }) {
  const [result, setResult] = useState<PresentationValidationResult>(() => validatePresentationForPublish(settings, themeId));
  useEffect(() => { setResult(validatePresentationForPublish(settings, themeId)); }, [settings, themeId, revision]);
  return <section className="studio-validation-panel" data-testid="publish-validation"><header><div>{result.passed ? <ShieldCheck /> : <ShieldAlert />}<span><strong>Publish Validation</strong><small>Authentication safety, responsive overflow, assets, source, motion, truth labels, and component fallbacks</small></span></div><b data-state={result.passed ? "ready" : "blocked"}>{result.passed ? "READY WITH WARNINGS" : "PUBLISH BLOCKED"}</b></header><div className="studio-validation-summary"><article><strong>{result.errors}</strong><span>Blocking errors</span></article><article><strong>{result.warnings}</strong><span>Warnings</span></article><article><strong>{result.issues.filter((item) => item.severity === "INFO").length}</strong><span>Information</span></article><article><code>{result.snapshotId}</code><span>Validated snapshot</span></article></div><div className="studio-validation-list">{result.issues.length ? result.issues.map((issue) => <article key={issue.id} data-severity={issue.severity.toLowerCase()}><span>{issue.severity === "ERROR" ? "!" : issue.severity === "WARNING" ? "△" : "i"}</span><div><strong>{issue.category} · {issue.id}</strong><p>{issue.message}</p></div></article>) : <article data-severity="success"><Check /><div><strong>All validation checks passed</strong><p>No blocking or advisory issues were found.</p></div></article>}</div><div className="studio-validation-checks">{["Layout overflow", "Critical auth visible", "Required widgets", "Missing assets", "Duplicate IDs", "Responsive breakpoints", "Mobile overflow", "Accessibility basics", "Invalid source", "Custom widget fallback", "Animation risk", "Image-size warning", "Reduced motion", "Data truth labels", "Runtime boundary"].map((check) => <span key={check}><Check />{check}</span>)}</div></section>;
}

export function RepositorySnapshotPanel({ theme }: { theme: SignInThemeProfile }) {
  const snapshotId = presentationSnapshotId(theme); const manifest = JSON.stringify({ schema: "daenem.signin.studio/v2", studioVersion: theme.version, sourceGenerated: true, sourceSnapshotId: snapshotId, repositoryProposedPath: `portal/public/presentation-themes/${theme.id}/`, repositoryStatus: "READY FOR REGISTRATION", productionWrite: false, theme }, null, 2);
  const download = (name: string, source: string, type: string) => { const blob = new Blob([source], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); };
  return <section className="studio-repository-panel" data-testid="repository-snapshot"><header><div><Code2 /><span><strong>Generated Source / Repository Snapshot</strong><small>Deterministic, exportable presentation state · no Git write or production mutation</small></span></div><b>READY FOR REGISTRATION</b></header><div className="studio-repository-grid"><article><span>STUDIO VERSION</span><strong>{theme.version}</strong></article><article><span>SOURCE GENERATED</span><strong>YES</strong></article><article><span>SOURCE SNAPSHOT ID</span><code>{snapshotId}</code></article><article><span>REPOSITORY STATUS</span><strong>NOT REGISTERED</strong></article><article className="wide"><span>PROPOSED PATH</span><code>portal/public/presentation-themes/{theme.id}/</code></article><article className="wide"><span>REGISTRATION DEPENDENCY</span><strong>BACKEND OR CONNECTOR REQUIRED</strong></article></div><section><h4>Snapshot contents</h4><div>{["Studio Visual Definition", "Presentation Configuration", "Generated HTML/CSS/JS references", "Asset References", "Responsive Layout Definition", "Version Metadata"].map((item) => <span key={item}><Check />{item}</span>)}</div></section><footer><button type="button" onClick={() => download(`${theme.id}.${snapshotId}.json`, manifest, "application/json")}><Save /> Download source snapshot</button><button type="button" onClick={() => download(`${theme.id}.${snapshotId}.css`, theme.advancedSource.css, "text/css")}><Code2 /> Download generated CSS</button><button type="button" onClick={() => navigator.clipboard?.writeText(manifest)}><Copy /> Copy registration manifest</button></footer><p><ShieldAlert /> GitHub main was not modified. Registration and repository promotion remain a deliberate reviewed action.</p></section>;
}
