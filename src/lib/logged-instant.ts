// Presentation only: accept an explicit offset, never infer a legacy wall time.
const instantPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;
const options: Intl.DateTimeFormatOptions = {
  year: "numeric", month: "short", day: "numeric", hour: "numeric",
  minute: "2-digit", second: "2-digit", hour12: true,
};
const lagos = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "Africa/Lagos" });
const newYork = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "America/New_York", timeZoneName: "short" });

export function recordedDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? value : null;
}

export function recordedWallTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m || !recordedDateOnly(m[1]) || Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4] || 0) > 59) return null;
  return value.replace("T", " ");
}

export function loggedInstant(value: unknown): { iso: string; nigeria: string; newYork: string } | null {
  if (typeof value !== "string") return null;
  const match = instantPattern.exec(value);
  if (!match || match[8] === "-00:00") return null;
  const [, y, m, d, h, minute, sec = "0", , zone] = match;
  const year = Number(y), month = Number(m), day = Number(d), hour = Number(h), minutes = Number(minute), seconds = Number(sec);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minutes > 59 || seconds > 59) return null;
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = newYork.formatToParts(instant);
  const suffix = parts.find((part) => part.type === "timeZoneName")?.value;
  // Historical local-mean-time offsets must not be mislabeled as EST or EDT.
  if (suffix !== "EST" && suffix !== "EDT") return null;
  return { iso: instant.toISOString(), nigeria: lagos.format(instant) + " WAT", newYork: newYork.format(instant) };
}
