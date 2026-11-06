/**
 * Align Home's read-only calendar to the current Lagos month when it is
 * following Today, while preserving an operator's deliberately browsed month.
 */
export function calendarCursorForToday(cursor: Date, todayKey: string, followToday: boolean): Date {
  if (!followToday) return cursor;
  const parsed = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(todayKey);
  if (!parsed) return cursor;
  const year = Number(parsed[1]), monthIndex = Number(parsed[2]) - 1;
  if (cursor.getUTCFullYear() === year && cursor.getUTCMonth() === monthIndex) return cursor;
  return new Date(Date.UTC(year, monthIndex, 1));
}
