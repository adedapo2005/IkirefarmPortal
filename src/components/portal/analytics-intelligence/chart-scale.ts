// Scale rules for the trend chart. Pure: the same numbers drive the Recharts axis, the disclosure text and the tests.

export type ChartScale = Readonly<{
  domain: readonly [number, number];
  ticks: readonly number[];
  step: number;
  // True when the axis does not start at zero. The chart must then say so, so the scale is not read as zero-based.
  nonZeroOrigin: boolean;
}>;

// Days shown with a passive marker at every point. Denser windows rely on hover, focus and the selected-day marker.
export const MAX_MARKER_DAYS = 14;

const TARGET_INTERVALS = 4;
const PAD_RATIO = 0.08;
const NICE_MULTIPLES = [1, 2, 2.5, 5, 10];

function niceStep(rawStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const multiple = NICE_MULTIPLES.find((candidate) => normalized <= candidate) ?? 10;
  return multiple * magnitude;
}

// Padded domain that always contains every finite value (never clips an extremum), with evenly spaced round ticks.
// Zero is included only when the padded minimum would otherwise cross below zero from a non-negative series.
export function chartScale(values: readonly number[]): ChartScale {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return {domain: [0, 1], ticks: [0, 1], step: 1, nonZeroOrigin: false};

  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    min -= pad;
    max += pad;
  }

  const span = max - min;
  const pad = span * PAD_RATIO;
  let low = min - pad;
  const high = max + pad;
  if (min >= 0 && low < 0) low = 0;

  const step = niceStep((high - low) / TARGET_INTERVALS);
  const niceLow = Math.floor(low / step) * step;
  const niceHigh = Math.ceil(high / step) * step;
  const intervals = Math.round((niceHigh - niceLow) / step);
  const ticks = Array.from({length: intervals + 1}, (_, index) => Number((niceLow + index * step).toFixed(10)));

  return {
    domain: [niceLow, niceHigh],
    ticks,
    step,
    nonZeroOrigin: niceLow > 0,
  };
}

export function showPointMarkers(dayCount: number): boolean {
  return dayCount <= MAX_MARKER_DAYS;
}
