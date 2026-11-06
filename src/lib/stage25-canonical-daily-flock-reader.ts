/** Projection availability is separate from the authority to read report history. */
import { readCanonicalDailyFlockHistory, readDailyFlockProjection, readEligibleDailyFlocks } from "./stage25-canonical-daily-flock-workspace.ts";
import type { DailyFlockProjection, EligibleDailyFlock } from "./stage25-canonical-daily-flock-workspace.ts";
import type { CanonicalDailyFlockRecord } from "./stage25-canonical-daily-flock-feedback.ts";

export type CanonicalDailyFlockReadResponse = Readonly<{
  status: number;
  json: () => Promise<unknown>;
}>;
export type CanonicalDailyFlockProjectionContextInput = Readonly<{
  flockId: string;
  localDate: string;
  read: (path: string) => Promise<CanonicalDailyFlockReadResponse>;
  isCurrent: () => boolean;
}>;
export type CanonicalDailyFlockProjectionContext =
  | Readonly<{ kind: "ready"; projection: DailyFlockProjection }>
  | Readonly<{ kind: "projection-unavailable"; history: readonly CanonicalDailyFlockRecord[] }>
  | Readonly<{ kind: "denied"; requiresSignIn: boolean }>
  | Readonly<{ kind: "unavailable"; clearHistory: boolean }>
  | Readonly<{ kind: "stale" }>;
export type CanonicalDailyFlockWorkspaceInput = Readonly<{
  read: (path: string) => Promise<CanonicalDailyFlockReadResponse>;
  isCurrent: () => boolean;
}>;
export type CanonicalDailyFlockWorkspaceResult =
  | Readonly<{ kind: "ready"; history: readonly CanonicalDailyFlockRecord[];
      eligible: readonly EligibleDailyFlock[]; writeCapability: "available" | "readonly" | "unavailable" }>
  | Readonly<{ kind: "denied"; requiresSignIn: boolean }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "stale" }>;
type HistoryReadResult =
  | Readonly<{ kind: "ready"; history: readonly CanonicalDailyFlockRecord[] }>
  | Readonly<{ kind: "denied"; requiresSignIn: boolean }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "stale" }>;

const root = "/api/portal/v7/farm-operations/daily-flock-report";
const stale = (): CanonicalDailyFlockProjectionContext => ({ kind: "stale" });
const unavailable = (clearHistory: boolean): CanonicalDailyFlockProjectionContext => ({ kind: "unavailable", clearHistory });

/** A reusable fresh history read; caller decides whether any earlier result may survive failure. */
async function readCurrentHistory(
  read: CanonicalDailyFlockWorkspaceInput["read"], current: () => boolean,
): Promise<HistoryReadResult> {
  try {
    if (!current()) return { kind: "stale" };
    const response = await read(root);
    if (!current()) return { kind: "stale" };
    if (!response) return { kind: "unavailable" };
    const status = response.status;
    if (!current()) return { kind: "stale" };
    if (status === 401 || status === 403 || status === 404)
      return { kind: "denied", requiresSignIn: status === 401 };
    if (status !== 200) return { kind: "unavailable" };
    const json = response.json;
    if (typeof json !== "function") return { kind: "unavailable" };
    if (!current()) return { kind: "stale" };
    const body = await json.call(response);
    if (!current()) return { kind: "stale" };
    const history = readCanonicalDailyFlockHistory(body);
    if (!current()) return { kind: "stale" };
    return history ? { kind: "ready", history } : { kind: "unavailable" };
  } catch {
    return current() ? { kind: "unavailable" } : { kind: "stale" };
  }
}

/**
 * Load history and entry eligibility as separate capabilities. A masked eligibility
 * denial may follow authority revocation, so earlier history is revalidated before display.
 */
export async function readCanonicalDailyFlockWorkspace(
  input: CanonicalDailyFlockWorkspaceInput,
): Promise<CanonicalDailyFlockWorkspaceResult> {
  const { read, isCurrent } = input;
  const current = () => {
    try { return isCurrent() === true; } catch { return false; }
  };
  if (!current()) return { kind: "stale" };
  const first = await readCurrentHistory(read, current);
  if (!current()) return { kind: "stale" };
  if (first.kind !== "ready") return first;
  const entryUnavailable = (): CanonicalDailyFlockWorkspaceResult => ({ kind: "ready", history: first.history,
    eligible: Object.freeze([]), writeCapability: "unavailable" });
  let revalidatingHistory = false;
  try {
    if (!current()) return { kind: "stale" };
    const response = await read(`${root}/eligible-flocks`);
    if (!current()) return { kind: "stale" };
    if (!response) return entryUnavailable();
    const status = response.status;
    if (!current()) return { kind: "stale" };
    if (status === 401) return { kind: "denied", requiresSignIn: true };
    if (status === 403 || status === 404) {
      revalidatingHistory = true;
      if (!current()) return { kind: "stale" };
      const refreshed = await readCurrentHistory(read, current);
      if (!current()) return { kind: "stale" };
      return refreshed.kind === "ready" ? { kind: "ready", history: refreshed.history,
        eligible: Object.freeze([]), writeCapability: "readonly" } : refreshed;
    }
    if (status !== 200) return entryUnavailable();
    const json = response.json;
    if (typeof json !== "function") return entryUnavailable();
    if (!current()) return { kind: "stale" };
    const body = await json.call(response);
    if (!current()) return { kind: "stale" };
    const eligible = readEligibleDailyFlocks(body);
    if (!current()) return { kind: "stale" };
    return eligible ? { kind: "ready", history: first.history, eligible, writeCapability: "available" } : entryUnavailable();
  } catch {
    if (!current()) return { kind: "stale" };
    return revalidatingHistory ? { kind: "unavailable" } : entryUnavailable();
  }
}

/**
 * A projection404 can mean a closed/pre-placement Flock or revoked authority.
 * Fresh history200 proves only current history visibility; it never grants writes.
 * No retry or write operation is owned by this reader.
 */
export async function readCanonicalDailyFlockProjectionContext(
  input: CanonicalDailyFlockProjectionContextInput,
): Promise<CanonicalDailyFlockProjectionContext> {
  const { flockId, localDate, read, isCurrent } = input;
  const current = () => {
    try { return isCurrent() === true; } catch { return false; }
  };
  if (!current()) return stale();
  let revalidatingHistory = false;
  try {
    const path = `${root}/projection?${new URLSearchParams({ flockId, localDate })}`;
    if (!current()) return stale();
    const response = await read(path);
    if (!current()) return stale();
    if (!response) return unavailable(false);
    const status = response.status;
    if (!current()) return stale();
    if (!Number.isInteger(status)) return unavailable(false);
    if (status === 401 || status === 403) return { kind: "denied", requiresSignIn: status === 401 };

    if (status === 404) {
      // The projection error body is never read. Earlier history is now unverified.
      revalidatingHistory = true;
      if (!current()) return stale();
      const refreshed = await readCurrentHistory(read, current);
      if (!current()) return stale();
      if (refreshed.kind === "ready") return { kind: "projection-unavailable", history: refreshed.history };
      return refreshed.kind === "unavailable" ? unavailable(true) : refreshed;
    }

    if (status !== 200) return unavailable(false);
    const json = response.json;
    if (typeof json !== "function") return unavailable(false);
    if (!current()) return stale();
    const body = await json.call(response);
    if (!current()) return stale();
    const projection = readDailyFlockProjection(body, localDate);
    if (!current()) return stale();
    return projection ? { kind: "ready", projection } : unavailable(false);
  } catch {
    if (!current()) return stale();
    return unavailable(revalidatingHistory);
  }
}
