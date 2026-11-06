"use client";

import { Info, Monitor, RefreshCw, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { has, type Persona } from "@/lib/portal-model";
import styles from "./WorkspaceShell.module.css";

export default function WorkspaceSystemMenu({ person, releaseLabel, onRelease, onSync, onWeather }: {
  person: Persona;
  releaseLabel: string;
  onRelease: () => void;
  onSync: () => void;
  onWeather: () => void;
}) {
  const release = has(person, "release.view");
  const sync = has(person, "auth.settings.view");
  const weather = has(person, "weather.view");
  if (!release && !sync && !weather) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`btn ghost ${styles.statusTrigger}`} aria-label="System Status">
          <Monitor size={18} aria-hidden="true" />
          <span>System Status</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.statusMenu}>
        {release && <>
          <DropdownMenuItem onSelect={onRelease}>
            <Info aria-hidden="true" />
            <span className={styles.menuCopy}>Version &amp; Release<small>{releaseLabel}</small></span>
          </DropdownMenuItem>
          {(sync || weather) && <DropdownMenuSeparator />}
        </>}
        {sync && <DropdownMenuItem onSelect={onSync}><RefreshCw aria-hidden="true" />Sync &amp; Connectivity</DropdownMenuItem>}
        {weather && <DropdownMenuItem onSelect={onWeather}><Sun aria-hidden="true" />Weather</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
