"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Columns3, Download, Filter, FilterX, GripVertical, Search, Star } from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { getRoleRevision, has, subscribeRoles } from "@/lib/portal-model";
import { authenticatedPreferenceScope } from "@/lib/farm-storage-scope";
import type { CommandPaletteOwner } from "@/lib/farm-command-palette-state";
import { enterpriseGridRenderOwner, scopedGridPreviewRow } from "@/lib/farm-grid-view-scope";
import { titleCase } from "@/lib/ui-language";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Btn, Chip } from "./Common";

export type EnterpriseColumn = {
  id: string;
  label: string;
  permission?: string;
  pinned?: boolean;
  editable?: boolean;
};

export type EnterpriseGridState = "ready" | "loading" | "empty" | "error" | "stale" | "offline";

export type EnterpriseGridProps = {
  id: string;
  title: string;
  description: string;
  person: Persona;
  columns: EnterpriseColumn[];
  rows: Record<string, React.ReactNode>[];
  state?: EnterpriseGridState;
  exportPermission?: string;
  importPermission?: string;
  bulkPermission?: string;
  sourceLabel?: string;
  freshnessLabel?: string;
  pageSize?: number;
};

const textOf = (value: React.ReactNode) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

type EnterpriseSavedView = {
  query: string;
  filters: Record<string, string>;
  sort: { id: string; direction: "asc" | "desc" } | null;
  hidden: string[];
  density: "comfortable" | "compact";
  order: string[];
  widths: Record<string, number>;
};

function gridPreferenceKey(person: Persona, gridId: string): string | null {
  if (person.principalSource === "authenticated") {
    const scope = authenticatedPreferenceScope(person);
    if (!scope) return null;
    return "farmportal.grid.v21:auth:" + scope + ":" + encodeURIComponent(gridId);
  }
  return "farmportal.grid.v21:review:" + encodeURIComponent(person.id) + ":"
    + encodeURIComponent(gridId);
}

export default function EnterpriseDataGrid({
  id,
  title,
  description,
  person,
  columns: sourceColumns,
  rows,
  state = "ready",
  exportPermission,
  importPermission,
  bulkPermission,
  sourceLabel,
  freshnessLabel,
  pageSize = 5,
}: EnterpriseGridProps) {
  const roleRevision = useSyncExternalStore(subscribeRoles, getRoleRevision, () => 0);
  // The active company can change on a stable persona object. Browser storage
  // must resolve from current authority, not a stale identity-only memo.
  const preferenceKey = gridPreferenceKey(person, id);
  const currentOwner = enterpriseGridRenderOwner(person, preferenceKey, roleRevision);
  const allowedColumns = useMemo(() => {
    // The same persona object can gain or lose scoped permissions in place.
    // Follow both policy revision and the render-time authority fingerprint.
    void roleRevision;
    void currentOwner;
    return sourceColumns.filter((column) => !column.permission || has(person, column.permission));
  }, [sourceColumns, person, roleRevision, currentOwner]);
  const [loadedOwner, setLoadedOwner] = useState<CommandPaletteOwner>(() => currentOwner);
  const [order, setOrder] = useState(() => allowedColumns.map((column) => column.id));
  const [hidden, setHidden] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [page, setPage] = useState(1);
  const [savedView, setSavedView] = useState<EnterpriseSavedView | null>(null);
  const [loadedPreferenceKey, setLoadedPreferenceKey] = useState<string | null>("");
  const [favorite, setFavorite] = useState(false);
  const [previewRow, setPreviewRow] = useState<Record<string, React.ReactNode> | null>(null);
  const [notice, setNotice] = useState("");
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const allowedIds = allowedColumns.map((column) => column.id);
    const allowed = new Set(allowedIds);
    setOrder(allowedIds);
    setHidden([]);
    setQuery("");
    setFilters({});
    setSort(null);
    setSelected([]);
    setDensity("comfortable");
    setPage(1);
    setFavorite(false);
    setPreviewRow(null);
    setNotice("");
    setWidths({});

    let next: EnterpriseSavedView | null = null;
    if (preferenceKey) {
      try {
        const raw = window.localStorage.getItem(preferenceKey);
        const parsed = raw ? JSON.parse(raw) as Partial<EnterpriseSavedView> : null;
        if (parsed) {
          const safeFilters = Object.fromEntries(
            Object.entries(parsed.filters || {}).filter(([key, value]) =>
              allowed.has(key) && typeof value === "string"),
          );
          const safeOrder = Array.isArray(parsed.order)
            ? [...new Set(parsed.order.filter((key): key is string => typeof key === "string" && allowed.has(key)))]
            : [];
          const completeOrder = [...safeOrder, ...allowedIds.filter((key) => !safeOrder.includes(key))];
          const safeHidden = Array.isArray(parsed.hidden)
            ? parsed.hidden.filter((key): key is string => typeof key === "string" && allowed.has(key))
            : [];
          const safeWidths = Object.fromEntries(
            Object.entries(parsed.widths || {}).filter(([key, value]) =>
              allowed.has(key) && typeof value === "number" && Number.isFinite(value) && value >= 120 && value <= 320),
          );
          const safeSort = parsed.sort && allowed.has(parsed.sort.id)
            && (parsed.sort.direction === "asc" || parsed.sort.direction === "desc")
            ? parsed.sort
            : null;
          next = {
            query: typeof parsed.query === "string" ? parsed.query : "",
            filters: safeFilters,
            sort: safeSort,
            hidden: safeHidden.length < allowedIds.length ? safeHidden : safeHidden.slice(0, Math.max(0, allowedIds.length - 1)),
            density: parsed.density === "compact" ? "compact" : "comfortable",
            order: completeOrder,
            widths: safeWidths,
          };
        }
      } catch {
        // Invalid or unavailable browser storage never blocks the authorized table.
      }
    }
    setSavedView(next);
    setLoadedPreferenceKey(preferenceKey);
    setLoadedOwner(currentOwner);
  }, [preferenceKey, allowedColumns, currentOwner]);

  const columns = order
    .map((columnId) => allowedColumns.find((column) => column.id === columnId))
    .filter((column): column is EnterpriseColumn => Boolean(column) && !hidden.includes(column!.id));

  const filtered = useMemo(() => {
    const next = rows.filter((row) => {
      const globalMatch = !query || allowedColumns.some((column) => textOf(row[column.id]).toLowerCase().includes(query.toLowerCase()));
      const columnMatch = allowedColumns.every((column) => !filters[column.id] || textOf(row[column.id]).toLowerCase().includes(filters[column.id].toLowerCase()));
      return globalMatch && columnMatch;
    });
    if (!sort) return next;
    return [...next].sort((a, b) => textOf(a[sort.id]).localeCompare(textOf(b[sort.id]), undefined, { numeric: true }) * (sort.direction === "asc" ? 1 : -1));
  }, [rows, query, filters, sort, allowedColumns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  const moveColumn = (columnId: string, delta: number) => setOrder((current) => {
    const next = [...current];
    const from = next.indexOf(columnId);
    const to = from + delta;
    if (from >= 0 && to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]];
    return next;
  });
  const toggleAll = () => setSelected(selected.length === visibleRows.length ? [] : visibleRows.map((_, index) => index));
  const canExport = Boolean(exportPermission && has(person, exportPermission));
  const canImport = Boolean(importPermission && has(person, importPermission));
  const canBulk = Boolean(bulkPermission && has(person, bulkPermission));
  const provenanceSource = sourceLabel?.trim() || "Sample / design fixture";
  const provenanceFreshness = freshnessLabel?.trim() || (state === "stale" ? "Stale - verify before acting" : "Not live");
  const activeColumnFilters = Object.entries(filters).filter(([, value]) => value.trim());
  const activeRefinements = (query.trim() ? 1 : 0) + activeColumnFilters.length;
  const clearColumnFilter = (columnId: string) => {
    setFilters((current) => ({ ...current, [columnId]: "" }));
    setSelected([]);
    setPreviewRow(null);
    setPage(1);
  };
  const resetRefinements = () => {
    setQuery("");
    setFilters({});
    setSelected([]);
    setPreviewRow(null);
    setPage(1);
    setNotice("Search and column filters cleared.");
  };
  const saveCurrentView = () => {
    const view: EnterpriseSavedView = {
      query,
      filters: { ...filters },
      sort,
      hidden: [...hidden],
      density,
      order: [...order],
      widths: { ...widths },
    };
    setSavedView(view);
    if (preferenceKey && loadedPreferenceKey === preferenceKey) {
      try {
        window.localStorage.setItem(preferenceKey, JSON.stringify(view));
        setNotice("Saved view updated for this account and company. No table rows were stored.");
        return;
      } catch {
        // Browser storage is optional; keep the saved view in this mounted session.
      }
    }
    setNotice("Saved view is available for this session only. No table rows were stored.");
  };
  const restoreSavedView = () => {
    if (!savedView) return;
    setQuery(savedView.query);
    setFilters({ ...savedView.filters });
    setSort(savedView.sort);
    setHidden([...savedView.hidden]);
    setDensity(savedView.density);
    setOrder([...savedView.order]);
    setWidths({ ...savedView.widths });
    setSelected([]);
    setPage(1);
    setNotice("Saved view restored for the current authorized table.");
  };

  const exportSample = () => {
    const content = [columns.map((column) => column.label), ...filtered.map((row) => columns.map((column) => textOf(row[column.id])))]
      .map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    anchor.download = `${id}-sample-design-data.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setNotice("Authorized sample view exported. No production data was used.");
  };

  const currentScope = loadedOwner === currentOwner;
  const currentPreviewRow = scopedGridPreviewRow(previewRow, rows, loadedOwner, currentOwner);
  if (!currentScope) {
    // Effects have not reset the previous account/farm state yet: reveal no
    // old search, selection, saved-view text, or record preview at this render.
    return <section className="enterprise-grid" data-enterprise-grid={id} aria-busy="true" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <div className="enterprise-grid-message" role="status">Refreshing Authorized Table</div>
    </section>;
  }

  return (
    <section className={`enterprise-grid density-${density}`} data-enterprise-grid={id} aria-labelledby={`${id}-title`}>
      <header className="enterprise-grid-head">
        <div><span className="eyebrow">DAENEM ENTERPRISE DATA GRID · SAMPLE / DESIGN DATA</span><h2 id={`${id}-title`}>{title}</h2><p>{description}</p><small className="enterprise-grid-provenance">Source: {provenanceSource} · Freshness: {provenanceFreshness}</small></div>
        <div className="enterprise-grid-state"><Chip tone={state === "ready" ? "blue" : state === "stale" ? "amber" : "gray"}>{state.toUpperCase()}</Chip><small>{filtered.length} authorized rows</small></div>
      </header>

      <div className="enterprise-grid-toolbar" role="toolbar" aria-label={`${title} table controls`}>
        <label className="enterprise-grid-search"><Search size={16}/><span className="sr-only">Search authorized rows</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected([]); setPreviewRow(null); setPage(1); }} placeholder="Search authorized rows"/></label>
        <span className="enterprise-filter-summary" aria-live="polite">{activeRefinements ? `${activeRefinements} active ${activeRefinements === 1 ? "filter" : "filters"}` : "All authorized rows"}</span>
        <Btn small disabled={!activeRefinements} onClick={resetRefinements}><FilterX size={15}/> Clear Filters</Btn>
        <Btn small onClick={() => setDensity((value) => value === "comfortable" ? "compact" : "comfortable")}>Density: {titleCase(density)}</Btn>
        <Btn small onClick={saveCurrentView}>{savedView ? "Update Saved View" : "Save View"}</Btn>
        {savedView && <Btn small onClick={restoreSavedView}>Restore Saved View</Btn>}
        <Btn small aria-pressed={favorite} onClick={() => setFavorite((value) => !value)}><Star size={15}/> Favorite</Btn>
        {canExport && <Btn small onClick={exportSample}><Download size={15}/> Export Sample</Btn>}
        {canImport && <label className="btn small" tabIndex={0}>Controlled Import<input className="sr-only" type="file" accept=".csv" onChange={() => setNotice("Import inspected only; no rows were written in this review Site.")}/></label>}
        <details className="enterprise-column-menu"><summary className="btn small"><Columns3 size={15}/> Columns</summary><div>{allowedColumns.map((column) => <section key={column.id}><label><input type="checkbox" checked={!hidden.includes(column.id)} disabled={!hidden.includes(column.id) && columns.length <= 1} onChange={() => setHidden((current) => current.includes(column.id) ? current.filter((value) => value !== column.id) : [...current, column.id])}/>{titleCase(column.label)}</label><div><button aria-label={`Move ${column.label} earlier`} onClick={() => moveColumn(column.id, -1)}><ArrowUp size={14}/></button><button aria-label={`Move ${column.label} later`} onClick={() => moveColumn(column.id, 1)}><ArrowDown size={14}/></button><label><span className="sr-only">Width for {column.label}</span><input type="range" min="120" max="320" value={widths[column.id] || 170} onChange={(event) => setWidths((current) => ({ ...current, [column.id]: Number(event.target.value) }))}/></label></div></section>)}</div></details>
      </div>
      {activeRefinements > 0 && <div className="enterprise-active-filters" aria-label="Active table filters">
        {query.trim() && <button type="button" onClick={() => { setQuery(""); setSelected([]); setPreviewRow(null); setPage(1); }}><Search size={13}/>Search: <strong>{query.trim()}</strong><span aria-hidden="true">×</span><span className="sr-only">Clear search filter</span></button>}
        {activeColumnFilters.map(([columnId, value]) => {
          const label = allowedColumns.find((column) => column.id === columnId)?.label || columnId;
          return <button type="button" key={columnId} onClick={() => clearColumnFilter(columnId)}><Filter size={13}/>{titleCase(label)}: <strong>{value.trim()}</strong><span aria-hidden="true">×</span><span className="sr-only">Clear {label} filter</span></button>;
        })}
      </div>}
      {notice && <p className="enterprise-grid-notice" role="status">{notice}</p>}

      {state === "loading" ? <div className="enterprise-grid-skeleton" role="status"><span className="sr-only">Loading {title}</span>{Array.from({ length: 6 }, (_, row) => <div key={row}>{columns.map((column) => <i key={column.id}/>)}</div>)}</div> : state === "error" || state === "offline" ? <div className="enterprise-grid-message" role="alert"><strong>{state === "offline" ? "Offline — cached rows unavailable" : "Rows could not be loaded"}</strong><p>The table structure remains stable. Retry requires the authoritative data service.</p></div> : state === "empty" || !filtered.length ? <div className="enterprise-grid-message"><strong>{rows.length ? "No results" : "No authorized records"}</strong><p>{rows.length ? "Adjust the current search or column filters." : "No record is available in the current permission and scope."}</p></div> : <>
        <div className="enterprise-grid-scroll" tabIndex={0} aria-label={`${title}; scroll horizontally only when columns exceed the available width`}>
          <table>
            <caption>{description}. Virtual window: page {Math.min(page, pages)} of {pages}.</caption>
            <thead><tr>{canBulk && <th className="grid-pinned"><input type="checkbox" aria-label="Select all visible rows" checked={selected.length === visibleRows.length && visibleRows.length > 0} onChange={toggleAll}/></th>}{columns.map((column, columnIndex) => <th key={column.id} className={column.pinned || columnIndex === 0 ? "grid-pinned" : ""} style={{ minWidth: widths[column.id] || 150 }} aria-sort={sort?.id === column.id ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><button onClick={() => { setSelected([]); setPreviewRow(null); setSort((current) => current?.id === column.id ? { id: column.id, direction: current.direction === "asc" ? "desc" : "asc" } : { id: column.id, direction: "asc" }); }}>{column.pinned || columnIndex === 0 ? <GripVertical size={13}/> : null}{titleCase(column.label)}{sort?.id === column.id ? sort.direction === "asc" ? <ArrowUp size={13}/> : <ArrowDown size={13}/> : null}</button><label><Filter size={12}/><span className="sr-only">Filter {column.label}</span><input value={filters[column.id] || ""} onChange={(event) => { setFilters((current) => ({ ...current, [column.id]: event.target.value })); setSelected([]); setPreviewRow(null); setPage(1); }}/></label></th>)}<th className="enterprise-grid-action-head"><span className="sr-only">Record actions</span></th></tr></thead>
            <tbody>{visibleRows.map((row, rowIndex) => <tr key={rowIndex} tabIndex={0}>{canBulk && <td className="grid-pinned"><input type="checkbox" aria-label={`Select row ${rowIndex + 1}`} checked={selected.includes(rowIndex)} onChange={() => setSelected((current) => current.includes(rowIndex) ? current.filter((value) => value !== rowIndex) : [...current, rowIndex])}/></td>}{columns.map((column, columnIndex) => <td key={column.id} className={column.pinned || columnIndex === 0 ? "grid-pinned" : ""}>{row[column.id] ?? "—"}</td>)}<td className="enterprise-grid-action-cell"><Btn small onClick={() => setPreviewRow(row)}>Preview</Btn></td></tr>)}</tbody>
          </table>
        </div>
        <div className="enterprise-mobile-records">{visibleRows.map((row, rowIndex) => <article key={rowIndex}>{canBulk && <input type="checkbox" aria-label={`Select mobile record ${rowIndex + 1}`} checked={selected.includes(rowIndex)} onChange={() => setSelected((current) => current.includes(rowIndex) ? current.filter((value) => value !== rowIndex) : [...current, rowIndex])}/>}<dl>{columns.map((column) => <div key={column.id}><dt>{titleCase(column.label)}</dt><dd>{row[column.id] ?? "—"}</dd></div>)}</dl><Btn small onClick={() => setPreviewRow(row)}>Inspect Record</Btn></article>)}</div>
        <footer className="enterprise-grid-footer"><span>{canBulk && selected.length ? `${selected.length} selected · authorized bulk actions only` : "No bulk operation selected"}</span><div><Btn small disabled={page <= 1} onClick={() => { setSelected([]); setPreviewRow(null); setPage((value) => Math.max(1, value - 1)); }}>Previous</Btn><span>Page {Math.min(page, pages)} / {pages}</span><Btn small disabled={page >= pages} onClick={() => { setSelected([]); setPreviewRow(null); setPage((value) => Math.min(pages, value + 1)); }}>Next</Btn></div></footer>
      </>}
      {state === "stale" && <p className="enterprise-grid-notice" role="status">Stale design state · verify freshness before acting.</p>}
      <Sheet open={Boolean(currentPreviewRow)} onOpenChange={(open) => { if (!open) setPreviewRow(null); }}>
        <SheetContent side="right" className="enterprise-record-preview">
          <SheetHeader>
            <SheetTitle>{title} - Quick Preview</SheetTitle>
            <SheetDescription>Only fields currently visible to this authorized employee are shown. SAMPLE / DESIGN DATA remains clearly labelled.</SheetDescription>
          </SheetHeader>
          {currentPreviewRow && <dl className="enterprise-record-preview-list">
            {columns.map((column) => <div key={column.id}><dt>{titleCase(column.label)}</dt><dd>{currentPreviewRow[column.id] ?? "Not available"}</dd></div>)}
          </dl>}
        </SheetContent>
      </Sheet>
    </section>
  );
}
