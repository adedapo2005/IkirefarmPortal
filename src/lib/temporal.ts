// Dual-Time Temporal Engine strictly adhering to:
// Primary: Lagos WAT (UTC+1)
// Executive: New York EST/EDT (America/New_York)
// Canonical input: ISO-8601 UTC string or Date object

export interface FormattedDualTime {
  watTime: string;      // e.g. "07:42 AM WAT"
  estTime: string;      // e.g. "01:42 AM EST"
  watDate: string;      // e.g. "Thursday, 5 November 2026"
  shortWatDate: string; // e.g. "05 Nov 2026"
  dualHeader: string;   // e.g. "Lagos: 07:42 AM WAT | New York: 01:42 AM EST"
  activityStamp: string;// e.g. "Thursday, 5 November 2026 • 07:42 AM WAT (01:42 AM EST)"
  auditStamp: string;   // e.g. "05 Nov 2026, 07:42:18 AM WAT (01:42:18 AM EST)"
}

export function formatDualTime(date: Date = new Date()): FormattedDualTime {
  const watTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const watSecFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const estTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  const estSecFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  const watDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const shortWatDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const watTime = `${watTimeFormatter.format(date)} WAT`;
  const estTime = estTimeFormatter.format(date);
  const watDate = watDateFormatter.format(date);
  const shortWatDate = shortWatDateFormatter.format(date);

  const watSecTime = `${watSecFormatter.format(date)} WAT`;
  const estSecTime = estSecFormatter.format(date);

  return {
    watTime,
    estTime,
    watDate,
    shortWatDate,
    dualHeader: `Lagos: ${watTime} | New York: ${estTime}`,
    activityStamp: `${watDate} • ${watTime} (${estTime})`,
    auditStamp: `${shortWatDate}, ${watSecTime} (${estSecTime})`,
  };
}

// Format currency as Nigerian Naira (₦) with 2 decimals
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('NGN', '₦');
}

// Format integer bird and egg counts with tabular comma separation
export function formatCount(count: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(count));
}
