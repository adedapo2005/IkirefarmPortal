// Observed range of the chart window: the highest and lowest verified day among rows that are already authorized and plotted.
// Pure: it only reads the rows it is given. Null (unverified) days are never a highest or lowest day, and ties keep the earliest date.

export type RangeRow = Readonly<{date: string; value: number | null}>;

export type WindowExtreme = Readonly<{date: string; value: number}>;

export type WindowRange = Readonly<{
  verifiedDays: number;
  highest: WindowExtreme | null;
  lowest: WindowExtreme | null;
}>;

export function windowRange(rows: readonly RangeRow[]): WindowRange {
  let verifiedDays = 0;
  let highest: WindowExtreme | null = null;
  let lowest: WindowExtreme | null = null;
  for (const row of rows) {
    if (row.value === null || !Number.isFinite(row.value)) continue;
    verifiedDays += 1;
    if (highest === null || row.value > highest.value) highest = {date: row.date, value: row.value};
    if (lowest === null || row.value < lowest.value) lowest = {date: row.date, value: row.value};
  }
  return {verifiedDays, highest, lowest};
}
