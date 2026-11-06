"use client";

/**
 * Stage21 NAV-08: read-only live record discovery through the existing
 * authenticated master-data selector. Never show records from review fixtures,
 * a missing company/site scope, or a previous principal/permission revision.
 */
import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import type { Page, Persona } from "@/lib/portal-model";
import { has } from "@/lib/portal-model";
import type { CommandPaletteOwner } from "@/lib/farm-command-palette-state";
import {
  projectAuthorizedMasterRecords,
  type AuthorizedGlobalRecord,
} from "@/lib/farm-global-search-records";

type SearchState = Readonly<{
  owner: CommandPaletteOwner | null;
  scope: string;
  query: string;
  status: "loading" | "ready" | "unavailable";
  items: readonly AuthorizedGlobalRecord[];
  hasMore: boolean;
}>;

const noResult: SearchState = {
  owner: null, scope: "", query: "", status: "ready", items: [], hasMore: false,
};

export default function AuthenticatedRecordCommandResults({
  person, permittedPages, owner, roleRevision, open, query, onNavigate,
}: {
  person: Persona;
  permittedPages: readonly Page[];
  owner: CommandPaletteOwner;
  roleRevision: number;
  open: boolean;
  query: string;
  onNavigate: (route: string) => void;
}) {
  const [resultState, setResultState] = useState<SearchState>(noResult);
  const q = query.trim().replace(/\s+/g, " ");
  const company = person.organizationScope?.companyKey?.trim() || "";
  const site = person.organizationScope?.locationKey?.trim() || "";
  const canSearch = open && person.principalSource === "authenticated" &&
    person.restriction === "none" && person.farm &&
    ["owner", "assigned"].includes(person.accessState || "") &&
    has(person, "search.view") && Boolean(company && site) &&
    q.length >= 2 && q.length <= 100;

  // The command owner can be an object when verified email is missing.
  // Compare the live farm and permission fingerprint too, so in-place changes
  // cannot repaint another company's records for even one React render.
  const scope = JSON.stringify([
    person.id, person.principalSource, person.accessState, person.restriction,
    company, site, person.farm, roleRevision,
    [...new Set(person.permissions)].sort(),
    Object.entries(person.permissionScopes ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    permittedPages.map((page) => page.id).sort(),
  ]);
  const displayed = canSearch && resultState.owner === owner &&
    resultState.scope === scope && resultState.query === q
    ? resultState
    : null;

  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResultState({ owner, scope, query: q, status: "loading", items: [], hasMore: false });
      const params = new URLSearchParams({ q, limit: "16" });
      fetch("/api/portal/v7/master-data/select?" + params.toString(), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("AUTHENTICATED_SEARCH_UNAVAILABLE");
        return response.json() as Promise<unknown>;
      }).then((payload) => {
        if (controller.signal.aborted) return;
        const results = projectAuthorizedMasterRecords(payload, person, permittedPages);
        setResultState({
          owner, scope, query: q, status: "ready",
          items: results.items, hasMore: results.hasMore,
        });
      }).catch(() => {
        if (!controller.signal.aborted) {
          setResultState({
            owner, scope, query: q, status: "unavailable", items: [], hasMore: false,
          });
        }
      });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // The scope captures active account, farm, role and authorized page changes.
    // Do not depend on the freshly allocated permittedPages array itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSearch, q, owner, scope]);

  if (!canSearch) return null;
  return (
    <>
      {displayed?.items.length ? (
        <CommandGroup heading="Authenticated Farm Records">
          {displayed.items.map((result) => (
            <CommandItem
              key={result.type + ":" + result.id}
              value={result.name + " " + (result.code ?? "") + " " + result.type + " " + result.routeLabel}
              onSelect={() => onNavigate(result.route)}
            >
              <Database size={17} aria-hidden="true" />
              <span className="grow">{result.name}</span>
              <small>{result.code || result.type} · Open {result.routeLabel}</small>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
      <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
        {displayed?.status === "unavailable"
          ? "Live record search is temporarily unavailable."
          : displayed?.status === "loading" || !displayed
            ? "Searching authorized live records…"
            : displayed.hasMore
              ? "Additional authorized matches exist. Refine your search."
              : displayed.items.length
                ? "Matches open their authorized register, not an unverified record detail."
                : "No matching live records in your authorized farm scope."}
      </p>
    </>
  );
}
