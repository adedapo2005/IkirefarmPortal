"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, History, LayoutDashboard, Search, Star, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import shellStyles from "./WorkspaceShell.module.css";
import type { Page, Persona } from "@/lib/portal-model";
import { buildFarmNavigation } from "@/lib/farm-navigation";
import { getRoleNavigationFocus, navigationPreferenceKey, retainAuthorizedNavigation } from "@/lib/farm-navigation-focus";
import { commandPaletteScopeOwner, type CommandPaletteOwner } from "@/lib/farm-command-palette-state";

type NavigationShortcutsProps = {
  person: Persona;
  route: string;
  pages: Page[];
  go: (route: string) => void;
  collapsed: boolean;
  roleRevision: number;
};

type SavedNavigation = { favorites: string[]; recent: string[] };
const emptyNavigation: SavedNavigation = { favorites: [], recent: [] };
const MAX_FAVORITES = 12;
const MAX_RECENT = 8;
const COMPACT_NAV_QUERY = "(max-height: 980px)";

function subscribeToCompactNavigation(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia(COMPACT_NAV_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getCompactNavigationSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(COMPACT_NAV_QUERY).matches;
}

function getCompactNavigationServerSnapshot() {
  return false;
}

export default function NavigationShortcuts({
  person, route, pages, go, collapsed, roleRevision,
}: NavigationShortcutsProps) {
  const userKey = navigationPreferenceKey(person, "shortcuts");
  // Typed search is transient, but still account-private. Scope it at render
  // time so an account switch never briefly paints the previous query.
  // When storage is disabled (missing verified email), use the principal object
  // identity rather than sharing an anonymous search buffer.
  const transientOwner = commandPaletteScopeOwner(person, userKey, roleRevision);
  const [searchState, setSearchState] = useState<{ owner: CommandPaletteOwner; query: string }>(
    { owner: transientOwner, query: "" },
  );
  const search = searchState.owner === transientOwner ? searchState.query : "";
  const setSearch = (query: string) => setSearchState({ owner: transientOwner, query });
  const isCompactViewport = useSyncExternalStore(
    subscribeToCompactNavigation,
    getCompactNavigationSnapshot,
    getCompactNavigationServerSnapshot,
  );
  const [quickAccessState, setQuickAccessState] = useState<{ owner: CommandPaletteOwner; open: boolean | null }>(
    { owner: transientOwner, open: null },
  );
  const quickAccessOverride = quickAccessState.owner === transientOwner ? quickAccessState.open : null;
  const setQuickAccessOverride = (open: boolean | null) =>
    setQuickAccessState({ owner: transientOwner, open });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<SavedNavigation>(emptyNavigation);
  const [loadedKey, setLoadedKey] = useState<string | null>("");
  const permitted = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const focus = useMemo(() => getRoleNavigationFocus(person, pages), [person, pages]);
  const sections = useMemo(() => buildFarmNavigation(pages), [pages]);
  const labels = useMemo(() => {
    const byId = new Map<string, string>();
    for (const section of sections) for (const navModule of section.modules)
      for (const page of navModule.pages) byId.set(page.id, `${section.label} · ${navModule.label}`);
    return byId;
  }, [sections]);

  useEffect(() => {
    // Reset transient UI preferences as soon as an account change commits.
    // The render-time owner guard also prevents even a one-frame text leak.
    setSearchState((previous) => previous.owner === transientOwner
      ? previous : { owner: transientOwner, query: "" });
    setQuickAccessState((previous) => previous.owner === transientOwner
      ? previous : { owner: transientOwner, open: null });
  }, [transientOwner]);

  useEffect(() => {
    if (!search) return;
    // The Sheet listens to Escape outside React's synthetic event boundary.
    // Consume a search-clear Escape at native window capture, before Radix
    // begins closing the mobile drawer behind a still-visible animation.
    const clearSearchBeforeDrawerEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      const insideSearch = target === searchInputRef.current ||
        (target instanceof Node && Boolean(resultsRef.current?.contains(target)));
      if (!insideSearch) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSearchState({ owner: transientOwner, query: "" });
      searchInputRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", clearSearchBeforeDrawerEscape, true);
    return () => window.removeEventListener("keydown", clearSearchBeforeDrawerEscape, true);
  }, [search, transientOwner]);

  useEffect(() => {
    let next = emptyNavigation;
    try {
      const raw = userKey ? window.localStorage.getItem(userKey) : null;
      if (raw) {
        const value = JSON.parse(raw) as Partial<SavedNavigation>;
        next = {
          favorites: Array.isArray(value.favorites)
            ? value.favorites.filter((id): id is string => typeof id === "string").slice(0, MAX_FAVORITES) : [],
          recent: Array.isArray(value.recent)
            ? value.recent.filter((id): id is string => typeof id === "string").slice(0, MAX_RECENT) : [],
        };
      }
    } catch {
      // Storage is optional and cannot affect access to the navigation.
    }
    setSaved(next);
    setLoadedKey(userKey);
  }, [userKey]);

  useEffect(() => {
    if (loadedKey !== userKey || !permitted.has(route)) return;
    setSaved((previous) => {
      if (previous.recent[0] === route) return previous;
      return { ...previous, recent: [route, ...previous.recent.filter((id) => id !== route)].slice(0, MAX_RECENT) };
    });
  }, [loadedKey, userKey, route, permitted]);

  useEffect(() => {
    if (!userKey || loadedKey !== userKey) return;
    // A mid-session role or company-scope reduction must remove stale
    // shortcuts from both memory and browser storage, not just hide them.
    setSaved((previous) => retainAuthorizedNavigation(previous, permitted));
  }, [loadedKey, userKey, permitted]);

  useEffect(() => {
    if (!userKey || loadedKey !== userKey) return;
    try {
      window.localStorage.setItem(userKey, JSON.stringify(retainAuthorizedNavigation(saved, permitted)));
    } catch {
      // No persistence is needed to navigate.
    }
  }, [saved, loadedKey, userKey, permitted]);

  // Do not render the previous account's preferences during the first
  // paint of an authenticated account switch, before its own key has loaded.
  const currentSaved = loadedKey === userKey && userKey ? saved : emptyNavigation;
  const favorites = currentSaved.favorites.filter((id) => id !== "dashboard" && permitted.has(id));
  // Home is always in the main tree; reserve the expanded shortcut space for
  // useful destinations instead of repeating Home across multiple headings.
  const focusedPages = focus.pages.filter((page) => page.id !== "dashboard" && !favorites.includes(page.id)).slice(0, 4);
  const focusedRouteIds = new Set(focusedPages.map((page) => page.id));
  const recent = currentSaved.recent.filter((id) =>
    permitted.has(id) && id !== "dashboard" && !favorites.includes(id) && !focusedRouteIds.has(id),
  );
  const quickAccessOpen = quickAccessOverride ?? !isCompactViewport;
  const quickAccessCount = favorites.length + focusedPages.length + Math.min(recent.length, 4);
  const currentPage = permitted.get(route);
  const results = search.trim().length >= 2
    ? pages.filter((page) => `${page.title} ${page.description} ${labels.get(page.id) || ""}`
        .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0, 24)
    : [];

  const toggleFavorite = (id: string) => {
    if (!userKey || loadedKey !== userKey || id === "dashboard" || !permitted.has(id)) return;
    setSaved((previous) => ({
      ...previous,
      favorites: previous.favorites.includes(id)
        ? previous.favorites.filter((item) => item !== id)
        : [...previous.favorites, id].slice(0, MAX_FAVORITES),
    }));
  };

  if (collapsed) {
    return (
      <nav aria-label="Quick navigation" className="nav-shortcuts-collapsed">
        {permitted.has("dashboard") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-current={route === "dashboard" ? "page" : undefined}
                aria-label="Open Home" onClick={() => go("dashboard")}
              >
                <LayoutDashboard size={19} aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10} className={shellStyles.navTooltip}>
              <span className={shellStyles.navTooltipCopy}>
                <strong>Home</strong><small>Workspace Overview</small>
              </span>
            </TooltipContent>
          </Tooltip>
        )}
        {favorites.slice(0, 4).map((id) => {
          const page = permitted.get(id);
          if (!page) return null;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={"Open favourite " + page.title}
                  aria-current={route === id ? "page" : undefined}
                  onClick={() => go(id)}
                >
                  <Star size={18} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className={shellStyles.navTooltip}>
                <span className={shellStyles.navTooltipCopy}>
                  <strong>{page.title}</strong>
                  <small>{labels.get(id) || page.group}</small>
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="nav-shortcuts" aria-label="Navigation shortcuts">
      <label className="nav-shortcuts-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search authorized pages</span>
        <input
          ref={searchInputRef}
          type="search" role="combobox" placeholder="Find a module or page..." autoComplete="off"
          value={search} onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              resultsRef.current?.querySelector<HTMLButtonElement>(".nav-shortcuts-link")?.focus();
            } else if (event.key === "Escape" && search) {
              event.preventDefault();
              event.stopPropagation();
              setSearch("");
            }
          }}
          aria-label="Search authorized pages"
          aria-haspopup="dialog"
          aria-autocomplete="list"
          aria-controls={search.trim().length >= 2 ? "farmportal-nav-shortcuts-results" : undefined}
          aria-expanded={search.trim().length >= 2}
        />
        {search && <button type="button" aria-label="Clear navigation search" onClick={() => setSearch("")}><X size={16} /></button>}
      </label>
      {search.trim().length >= 2 ? (
        <div
          ref={resultsRef}
          id="farmportal-nav-shortcuts-results"
          className="nav-shortcuts-results"
          role="dialog"
          aria-modal={false}
          aria-label="Navigation search results"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setSearch("");
              searchInputRef.current?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              const links = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".nav-shortcuts-link"));
              const index = links.indexOf(document.activeElement as HTMLButtonElement);
              if (event.key === "ArrowUp" && index <= 0) {
                event.preventDefault();
                searchInputRef.current?.focus();
              } else if (links.length && index >= 0) {
                event.preventDefault();
                links[Math.min(links.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
              }
            }
          }}
        >
          <span className="nav-shortcuts-heading" role="status" aria-live="polite">
            {results.length ? `${results.length} matching pages` : "No authorized pages match"}
          </span>
          {results.map((page) => <div className="nav-shortcuts-entry" key={page.id}>
            <button type="button" className="nav-shortcuts-link" onClick={() => { go(page.id); setSearch(""); }}>
              <strong>{page.title}</strong><small>{labels.get(page.id) || page.group}</small>
            </button>
            {page.id !== "dashboard" && <button className="nav-shortcuts-star" type="button" aria-label={currentSaved.favorites.includes(page.id) ? `Remove ${page.title} from favourites` : `Add ${page.title} to favourites`}
              aria-pressed={currentSaved.favorites.includes(page.id)} onClick={() => toggleFavorite(page.id)}>
              <Star size={16} fill={currentSaved.favorites.includes(page.id) ? "currentColor" : "none"} />
            </button>}
          </div>)}
        </div>
      ) : (
        <>
          {quickAccessCount > 0 && (
            <button
              className="nav-shortcuts-disclosure"
              type="button"
              aria-controls="farmportal-nav-quick-access"
              aria-expanded={quickAccessOpen}
              aria-label={`Quick Access, ${quickAccessCount} shortcuts${currentPage ? `. Current page: ${currentPage.title}` : ""}`}
              onClick={() => setQuickAccessOverride(!quickAccessOpen)}
            >
              <span className="nav-shortcuts-disclosure-copy">
                <span className="nav-shortcuts-disclosure-label"><Star size={15} aria-hidden="true" />Quick Access</span>
                {currentPage && <span className="nav-shortcuts-current">{currentPage.title}</span>}
              </span>
              <span className="nav-shortcuts-count" aria-hidden="true">{quickAccessCount}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          <div id="farmportal-nav-quick-access" className="nav-shortcuts-links" hidden={!quickAccessOpen}>
            {favorites.length > 0 && <>
              <div className="nav-shortcuts-heading"><Star size={13} aria-hidden="true" /> Favourites</div>
              {favorites.slice(0, 6).map((id) => <div className="nav-shortcuts-entry" key={id}>
                <button type="button" className="nav-shortcuts-link" onClick={() => go(id)}>{permitted.get(id)?.title}</button>
                <button type="button" className="nav-shortcuts-star" aria-label={`Remove ${permitted.get(id)?.title} from favourites`} onClick={() => toggleFavorite(id)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>)}
            </>}
            {!favorites.length && !focusedPages.length && !recent.length && <p className="nav-shortcuts-hint">Search and star the pages you use often.</p>}
            {focusedPages.length > 0 && <>
              <div className="nav-shortcuts-heading" data-role-focus={focus.title}>
                <Star size={13} aria-hidden="true" /> {focus.title}
              </div>
              {focusedPages.map((page) => (
                <button
                  key={page.id}
                  className="nav-shortcuts-recent"
                  type="button"
                  onClick={() => go(page.id)}
                  title={page.description}
                >
                  {page.title}
                </button>
              ))}
            </>}
            {recent.length > 0 && <>
              <div className="nav-shortcuts-heading"><History size={13} aria-hidden="true" /> Recent</div>
              {recent.slice(0, 4).map((id) => <button type="button" className="nav-shortcuts-recent" key={id} onClick={() => go(id)}>{permitted.get(id)?.title}</button>)}
            </>}
          </div>
        </>
      )}
    </div>
  );
}
