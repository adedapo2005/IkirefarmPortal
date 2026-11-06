"use client";

import LoggedTimestamp from "../LoggedTimestamp";

import React, {useEffect, useId, useMemo, useState} from "react";
import {CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {chartScale, showPointMarkers} from "./chart-scale";
import ComparisonList from "./ComparisonList";
import DayInspector from "./DayInspector";
import {periodComparisonItems} from "./comparison-presentation";
import {
  canStepInspectedDay,
  formatInspectionDay,
  inspectDay,
  resolveInspectedDate,
  stepInspectedDay,
} from "./day-inspection";
import {windowRange} from "./day-range";
import {
  checkMetricComparison,
  daysInclusive,
  formatMetricValue,
  periodCoverage,
  resolveMetric,
  resolveTrendState,
  toggleSeries,
  trendRows,
  unitLabel,
  type MetricContract,
  type MetricUnit,
  type TrendRow,
} from "./metric-contract";
import styles from "./analytics-intelligence.module.css";

// "production" is the default and reports verification from the metric's source. "synthetic" marks illustrative demonstration data.
export type ChartProvenance = "production" | "synthetic";

export type ProductionTrendChartProps = {
  metric: MetricContract;
  now?: Date;
  defaultWindowDays?: number;
  defaultShowTable?: boolean;
  provenance?: ChartProvenance;
};

export type SeriesKey = "collected" | "previous";

export const TREND_WINDOWS = [
  {days: 7, label: "7 days"},
  {days: 30, label: "30 days"},
  {days: 90, label: "90 days"},
] as const;

// Series colours: teal is the current period, violet the previous period. The previous series is also dashed,
// so the two stay distinct without colour.
const CURRENT_COLOR = "#0d9488";
const PREVIOUS_COLOR = "#6554d9";
const CROSSHAIR_COLOR = "#98a2b3";
const GRID_COLOR = "#e4ece7";
const AXIS_COLOR = "#475467";

const SERIES_LABEL: Record<SeriesKey, string> = {
  collected: "Collected",
  previous: "Previous period",
};

const formatDay = formatInspectionDay;

// "21 Sep – 20 Oct 2026": the reporting period in one line, with the year taken from its end date.
function formatPeriodRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Reporting period not supplied";
  return `${formatInspectionDay(start)} – ${formatInspectionDay(end)} ${end.slice(0, 4)}`;
}

type TooltipProps = {
  active?: boolean;
  payload?: readonly {payload?: unknown}[];
  unit: MetricUnit;
  showCollected: boolean;
  showPrevious: boolean;
};

function TrendTooltip({active, payload, unit, showCollected, showPrevious}: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as TrendRow | undefined;
  if (!row) return null;
  return (
    <div className={styles.tooltip}>
      <strong className={styles.tooltipDate}>{formatDay(row.date)}</strong>
      {showCollected && (
        <span className={styles.tooltipRow}>
          <span className={styles.swatch} data-series="collected" aria-hidden="true" />
          Collected: {formatMetricValue(row.value, unit)}
        </span>
      )}
      {showPrevious && (
        <span className={styles.tooltipRow}>
          <span className={styles.swatch} data-series="previous" aria-hidden="true" />
          Previous period: {formatMetricValue(row.previous, unit)}
        </span>
      )}
    </div>
  );
}

export default function ProductionTrendChart({
  metric,
  now,
  defaultWindowDays = 30,
  defaultShowTable = false,
  provenance = "production",
}: ProductionTrendChartProps) {
  const id = useId();
  const tableId = `${id}-table`;
  const [windowDays, setWindowDays] = useState<number>(defaultWindowDays);
  const [hidden, setHidden] = useState<SeriesKey[]>([]);
  const [tableOpen, setTableOpen] = useState(defaultShowTable);
  const [reducedMotion, setReducedMotion] = useState(false);
  // The day chosen by clicking a point or by the day inspector. Unknown days fall back to the default day.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const trend = resolveTrendState(metric, now);
  const plotted = trend.status === "ready" || trend.status === "stale";
  const rows = useMemo(() => (plotted ? trendRows(metric, windowDays) : []), [metric, plotted, windowDays]);

  // A valid comparison is plotted day by day even when the period total is incomplete.
  const showPrevious = checkMetricComparison(metric)?.valid === true;
  const seriesKeys: SeriesKey[] = showPrevious ? ["collected", "previous"] : ["collected"];
  const hiddenKeys = hidden.filter((key) => seriesKeys.includes(key));
  const visibleKeys = seriesKeys.filter((key) => !hiddenKeys.includes(key));
  const unit = metric.unit;
  const unitName = unitLabel(unit);
  const suppliedDays = metric.period.start && metric.period.end
    ? daysInclusive(metric.period.start, metric.period.end)
    : 0;
  const availableWindows = TREND_WINDOWS.filter((option) => option.days <= suppliedDays);
  const toggle = (key: SeriesKey) => setHidden((current) => toggleSeries(current, key, seriesKeys));

  if (!plotted) {
    return (
      <section className={styles.chart} aria-labelledby={`${id}-title`} aria-busy={trend.status === "loading" || undefined} data-status={trend.status}>
        <h3 id={`${id}-title`} className={styles.kpiTitle}>{metric.label} trend</h3>
        <div className={styles.statePanel} role="status">
          <strong>{trend.status === "unavailable" ? "Data unavailable" : trend.status === "empty" ? "No records in this period" : trend.status === "loading" ? "Loading verified records" : "Records could not be shown"}</strong>
          {trend.reason && trend.status !== "loading" && <p>{trend.reason}</p>}
          <p>No chart is drawn without verified records.</p>
        </div>
        {trend.status === "loading" && (
          // A plot-sized placeholder keeps the layout still when the records arrive.
          <div className={styles.plot} aria-hidden="true">
            <span className={styles.plotSkeletonBar} />
          </div>
        )}
        <p className={styles.source}>
          Source: {metric.source.name}
          {metric.asOf ? <> · As of <LoggedTimestamp value={metric.asOf}/></> : ""}
        </p>
      </section>
    );
  }

  const shownDays = rows.length;
  const coverage = periodCoverage(metric.series, metric.period);
  const inspectedDate = resolveInspectedDate(rows, selectedDate);
  const inspection = inspectDay(rows, inspectedDate);
  // The selected-day marker is drawn only when its current-period value is visible and verified.
  const selectedPoint = inspection && inspection.value !== null && visibleKeys.includes("collected") ? inspection : null;
  const view = resolveMetric(metric, now);
  const comparisonItems = periodComparisonItems(view);
  const range = windowRange(rows);
  const plottedValues: number[] = [];
  for (const row of rows) {
    if (visibleKeys.includes("collected") && row.value !== null) plottedValues.push(row.value);
    if (visibleKeys.includes("previous") && row.previous !== null) plottedValues.push(row.previous);
  }
  const scale = chartScale(plottedValues);
  const markers = showPointMarkers(shownDays);
  const firstDay = rows.length > 0 ? formatInspectionDay(rows[0].date) : "";
  const lastDay = rows.length > 0 ? formatInspectionDay(rows[rows.length - 1].date) : "";
  const synthetic = provenance === "synthetic";
  const chipState = synthetic ? "synthetic" : metric.source.verified ? "verified" : "unverified";
  const chipText = synthetic ? "Synthetic demonstration, not live farm data" : metric.source.verified ? "Verified source" : "Source not verified";

  return (
    <section className={styles.chart} aria-labelledby={`${id}-title`} data-status={trend.status} data-provenance={provenance}>
      <header className={styles.chartHeader}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>{synthetic ? "Synthetic demonstration · " : ""}{metric.scope.label}</p>
          <h3 id={`${id}-title`} className={styles.chartTitle}>{metric.label}</h3>
          <p className={styles.subtitle}>
            <span>{formatPeriodRange(metric.period.start, metric.period.end)}</span>
            <span className={styles.freshChip} data-state={chipState}>{chipText}</span>
          </p>
        </div>
        <div className={styles.controls}>
          {availableWindows.length > 1 && (
            <div className={styles.segmented} role="group" aria-label="Chart period">
              {availableWindows.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  className={styles.segment}
                  aria-pressed={windowDays === option.days}
                  onClick={() => setWindowDays(option.days)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <div className={styles.seriesGroup} role="group" aria-label="Visible chart series">
            {seriesKeys.map((key) => {
              const isVisible = visibleKeys.includes(key);
              const isLastVisible = isVisible && visibleKeys.length === 1;
              return (
                <button
                  key={key}
                  type="button"
                  className={styles.seriesButton}
                  aria-pressed={isVisible}
                  disabled={isLastVisible}
                  title={isLastVisible ? "At least one series stays visible" : undefined}
                  onClick={() => toggle(key)}
                >
                  <span className={styles.swatch} data-series={key} aria-hidden="true" />
                  <span>{SERIES_LABEL[key]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {trend.status === "stale" && (
        <p className={styles.stale} role="status">
          <strong>Stale.</strong> {trend.reason}
        </p>
      )}

      {/* Hero: the reporting-period total and its change. These totals are fixed to the full period, whatever the chart window. */}
      <div className={styles.heroRow}>
        <ComparisonList
          label={`${metric.label} period comparison`}
          variant="hero"
          caption={`Reporting period ${metric.period.start} to ${metric.period.end}. These totals are fixed to the full period and do not change with the selected window.`}
          items={[comparisonItems[0], comparisonItems[2]]}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.plotColumn}>
          <p className={styles.caption}>
            Chart window: {shownDays} {shownDays === 1 ? "day" : "days"}, {firstDay} to {lastDay}.
          </p>

          <div role="group" aria-label={`${metric.label} trend chart`}>
            <div className={styles.plot}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rows}
                  onClick={(state: unknown) => {
                    const label = (state as {activeLabel?: unknown} | null)?.activeLabel;
                    if (typeof label === "string") setSelectedDate(label);
                  }}
                  margin={{top: 12, right: 16, left: 4, bottom: 4}}
                  accessibilityLayer
                  aria-label={`${metric.label} trend, ${unitName}, ${shownDays} days. Use arrow keys to move between days.`}
                >
                  <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 4" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={{stroke: GRID_COLOR}}
                    minTickGap={18}
                    tickMargin={8}
                    tick={{fontSize: 12, fill: AXIS_COLOR}}
                    tickFormatter={formatDay}
                  />
                  <YAxis
                    domain={[scale.domain[0], scale.domain[1]]}
                    ticks={[...scale.ticks]}
                    tickLine={false}
                    axisLine={false}
                    width={62}
                    tickMargin={6}
                    tick={{fontSize: 12, fill: AXIS_COLOR}}
                    tickFormatter={(value: number) => value.toLocaleString("en-US")}
                  />
                  {inspection && <ReferenceLine x={inspection.date} stroke={CURRENT_COLOR} strokeOpacity={0.45} strokeWidth={1} />}
                  {selectedPoint && (
                    <ReferenceDot x={selectedPoint.date} y={selectedPoint.value as number} r={10} fill={CURRENT_COLOR} fillOpacity={0.14} stroke="none" />
                  )}
                  {selectedPoint && (
                    <ReferenceDot x={selectedPoint.date} y={selectedPoint.value as number} r={5} fill="#ffffff" stroke={CURRENT_COLOR} strokeWidth={2} />
                  )}
                  <Tooltip
                    content={
                      <TrendTooltip
                        unit={unit}
                        showCollected={visibleKeys.includes("collected")}
                        showPrevious={visibleKeys.includes("previous")}
                      />
                    }
                    cursor={{stroke: CROSSHAIR_COLOR, strokeWidth: 1, strokeDasharray: "4 4"}}
                    offset={16}
                  />
                  {visibleKeys.includes("collected") && (
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={SERIES_LABEL.collected}
                      stroke={CURRENT_COLOR}
                      strokeWidth={2.5}
                      dot={markers ? {r: 3} : false}
                      activeDot={{r: 5, strokeWidth: 2}}
                      connectNulls={false}
                      isAnimationActive={!reducedMotion}
                      animationDuration={420}
                    />
                  )}
                  {visibleKeys.includes("previous") && (
                    <Line
                      type="monotone"
                      dataKey="previous"
                      name={SERIES_LABEL.previous}
                      stroke={PREVIOUS_COLOR}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={!reducedMotion}
                      animationDuration={420}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {scale.nonZeroOrigin && (
            <p className={styles.source}>
              Vertical scale starts at {formatMetricValue(scale.domain[0], unit)}, not zero, so day-to-day changes are easier to read. Exact values are in the day readout and the data table.
            </p>
          )}
        </div>

        <div className={styles.sideColumn} data-region="rail">
          <DayInspector
            label={metric.label}
            inspection={inspection}
            unit={unit}
            polarity={metric.polarity}
            showPrevious={showPrevious}
            canEarlier={canStepInspectedDay(rows, inspectedDate, -1)}
            canLater={canStepInspectedDay(rows, inspectedDate, 1)}
            onStep={(step) => setSelectedDate(stepInspectedDay(rows, inspectedDate, step))}
          />

          <section className={styles.rangeModule} aria-label={`${metric.label} observed range in this window`}>
            <p className={styles.rangeHead}>Observed range in this window</p>
            {range.highest && range.lowest ? (
              <div className={styles.rangeGrid}>
                <div className={styles.rangeCell} data-extreme="highest">
                  <span className={styles.rangeLabel}>Highest verified day</span>
                  <strong className={styles.rangeValue}>{formatMetricValue(range.highest.value, unit)}</strong>
                  <span className={styles.rangeDate}>{formatDay(range.highest.date)}</span>
                </div>
                <div className={styles.rangeCell} data-extreme="lowest">
                  <span className={styles.rangeLabel}>Lowest verified day</span>
                  <strong className={styles.rangeValue}>{formatMetricValue(range.lowest.value, unit)}</strong>
                  <span className={styles.rangeDate}>{formatDay(range.lowest.date)}</span>
                </div>
              </div>
            ) : (
              <p className={styles.rangeNote}>No verified days in this window, so no range is shown.</p>
            )}
            <p className={styles.rangeNote}>Based on {range.verifiedDays} verified of {shownDays} {shownDays === 1 ? "day" : "days"} in this window.</p>
          </section>
        </div>
      </div>

      <div className={styles.secondaryRow}>
        <ComparisonList
          label={`${metric.label} previous period and target`}
          variant="secondary"
          items={[comparisonItems[1], comparisonItems[3]]}
        />
        <div className={styles.coverageTile} data-accent="coverage">
          <span className={styles.coverageLabel}>Verified days</span>
          <strong className={styles.coverageValue}>{coverage.verifiedDays} of {coverage.expectedDays}</strong>
          <span className={styles.coverageBar} aria-hidden="true">
            <span style={{width: `${coverage.expectedDays > 0 ? Math.round((coverage.verifiedDays / coverage.expectedDays) * 100) : 0}%`}} />
          </span>
        </div>
      </div>

      <footer className={styles.footer}>
        {shownDays < windowDays && (
          <p className={styles.source}>Only {shownDays} days of records are supplied for this window; {windowDays} days were requested.</p>
        )}
        <p className={styles.source}>
          Source: {metric.source.name}
          {metric.asOf ? <> · As of <LoggedTimestamp value={metric.asOf}/></> : ""}
        </p>
        <details className={styles.notes}>
          <summary>How figures are calculated</summary>
          <p>Verified days in the reporting period: {coverage.verifiedDays} of {coverage.expectedDays}. Days without a verified value are gaps, not zero.</p>
          {showPrevious && metric.comparison && (
            <p>
              Previous-period values appear only for days within {metric.comparison.period.start} to {metric.comparison.period.end}, aligned to this window by day offset.
            </p>
          )}
          {metric.comparison && !showPrevious && <p>Previous period not shown: {checkMetricComparison(metric)?.reason}</p>}
          <p>Keep at least one series visible.</p>
        </details>
      </footer>

      <div className={styles.tableToggle}>
        <button
          type="button"
          className={styles.linkButton}
          aria-expanded={tableOpen}
          aria-controls={tableId}
          onClick={() => setTableOpen((open) => !open)}
        >
          {tableOpen ? "Hide data table" : "Show data table"}
        </button>
      </div>

      {tableOpen && (
        <div id={tableId} role="region" aria-label={`${metric.label} data table`} className={styles.tableRegion}>
          <table className={styles.table}>
            <caption>
              {metric.label} by day, {shownDays} days, {unitName}
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Collected</th>
                {showPrevious && <th scope="col">Previous period</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{formatDay(row.date)}</th>
                  <td>{formatMetricValue(row.value, unit)}</td>
                  {showPrevious && <td>{formatMetricValue(row.previous, unit)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
