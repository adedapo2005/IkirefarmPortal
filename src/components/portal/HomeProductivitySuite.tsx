"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Calculator, ChevronLeft, ChevronRight, Clock3, Delete } from "lucide-react";
import { Panel, Chip } from "./Common";
import { initialClockLocations } from "@/lib/experience-model";
import styles from "./HomeProductivitySuite.module.css";
import { applyCalculatorAction, initialCalculatorState, type CalculatorOperator } from "./homeCalculatorModel";
import { calendarCursorForToday } from "./homeCalendarMonthModel";

const calendarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

function zonedDateKey(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function zonedParts(now: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { hour: n("hour"), minute: n("minute"), second: n("second") };
}

function NativeWorldClock({ now, zone, label }: { now: Date; zone: string; label: string }) {
  const { hour, minute, second } = zonedParts(now, zone);
  const isDay = hour >= 6 && hour < 18;
  const timeText = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  const dateText = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);

  return (
    <article className="intel-clock" data-phase={isDay ? "day" : "night"}>
      <div
        className="analog-clock"
        aria-hidden="true"
        style={{ "--second-start": `${second * 6}deg` } as React.CSSProperties}
      >
        <span className="clock-orbit" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((tick) => (
          <i key={tick} style={{ transform: `rotate(${tick * 30}deg)` }} />
        ))}
        <b className="hour-hand" style={{ transform: `rotate(${hour * 30 + minute / 2}deg)` }} />
        <b className="minute-hand" style={{ transform: `rotate(${minute * 6 + second / 10}deg)` }} />
        <b className="second-hand" />
        <span className="clock-pin" />
      </div>
      <div className="clock-copy">
        <span className="clock-label">{label}</span>
        <strong>{timeText}</strong>
        <small>{dateText}</small>
        <em>{zone.replaceAll("_", " ")}</em>
      </div>
    </article>
  );
}

function WorldClockGallery({ showNewYork }: { showNewYork: boolean }) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const locations = showNewYork
    ? initialClockLocations
    : initialClockLocations.filter((loc) => loc.id === "farm" || loc.id === "london");

  return (
    <Panel
      className={`${styles.panel} ${styles.worldClockPanel}`}
      title="Global Operations World Clock"
      description="Synchronized analog and digital time across Balogun-Ikire Farm HQ and international partner hubs"
      actions={<Chip tone="blue">{locations.length} Operating Locations · Live Device Time</Chip>}
    >
      <div className={styles.worldClockGrid}>
        {locations.map((loc) => (
          <NativeWorldClock
            key={loc.id}
            now={now}
            zone={loc.zone}
            label={loc.id === "farm" ? "Balogun-Ikire HQ" : loc.name}
          />
        ))}
      </div>
    </Panel>
  );
}

function TimeCard({ city, zone }: { city: string; zone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now)
    : "—";
  const date = now
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(now)
    : "Loading local date";

  return (
    <article className={styles.timeCard} aria-label={`${city} local time`}>
      <span>
        <Clock3 aria-hidden="true" />
        {city}
      </span>
      <time dateTime={now?.toISOString()}>{time}</time>
      <small>{date}</small>
    </article>
  );
}

function OperationsTime({ showNewYork }: { showNewYork: boolean }) {
  return (
    <Panel className={styles.panel} title="Operations Time" description="Local working time for your permitted locations">
      <div className={styles.timeGrid}>
        <TimeCard city="Balogun-Ikire (WAT)" zone="Africa/Lagos" />
        {showNewYork && <TimeCard city="New York (EST/EDT)" zone="America/New_York" />}
      </div>
      {!showNewYork && (
        <p className={styles.permissionNote}>Additional locations appear only when assigned by the Owner.</p>
      )}
    </Panel>
  );
}

function MonthCalendar() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const todayKey = zonedDateKey(today, "Africa/Lagos");
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const [cursor, setCursor] = useState(() => new Date(Date.UTC(todayYear, todayMonth - 1, 1)));
  const [followingToday, setFollowingToday] = useState(true);
  useEffect(() => {
    setCursor((current) => calendarCursorForToday(current, todayKey, followingToday));
  }, [todayKey, followingToday]);
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= days ? day : null;
  });

  return (
    <Panel className={styles.panel} title="Calendar" description="A clear view of the working month in Balogun-Ikire">
      <div className={styles.calendarHead}>
        <button
          type="button"
          onClick={() => {
            setFollowingToday(false);
            setCursor(new Date(Date.UTC(year, month - 1, 1)));
          }}
          aria-label="Previous month"
        >
          <ChevronLeft />
        </button>
        <strong aria-live="polite">
          <CalendarDays aria-hidden="true" />
          {calendarFormatter.format(cursor)}
        </strong>
        <button
          type="button"
          onClick={() => {
            setFollowingToday(false);
            setCursor(new Date(Date.UTC(year, month + 1, 1)));
          }}
          aria-label="Next month"
        >
          <ChevronRight />
        </button>
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.calendarGrid} role="grid" aria-label={calendarFormatter.format(cursor)}>
        {cells.map((day, index) => {
          const key = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
          return (
            <span
              key={`${index}-${day || "blank"}`}
              role="gridcell"
              aria-current={key === todayKey ? "date" : undefined}
              data-today={key === todayKey || undefined}
            >
              {day}
            </span>
          );
        })}
      </div>
      <button
        className={styles.todayButton}
        type="button"
        onClick={() => {
          setFollowingToday(true);
          setCursor(new Date(Date.UTC(todayYear, todayMonth - 1, 1)));
        }}
      >
        Return To Today
      </button>
    </Panel>
  );
}

function QuickCalculator() {
  const [calculator, setCalculator] = useState(initialCalculatorState);
  const { display, stored, operator } = calculator;
  const input = (value: string) => setCalculator((state) => applyCalculatorAction(state, { type: "digit", value }));
  const choose = (value: CalculatorOperator) =>
    setCalculator((state) => applyCalculatorAction(state, { type: "operator", value }));
  const equals = () => setCalculator((state) => applyCalculatorAction(state, { type: "equals" }));
  const clear = () => setCalculator((state) => applyCalculatorAction(state, { type: "clear" }));

  return (
    <Panel className={styles.panel} title="Quick Calculator" description="Fast operational checks without leaving Home">
      <div className={styles.calculator}>
        <div className={styles.calculatorDisplay} aria-live="polite">
          <small>{stored !== null && operator ? `${stored} ${operator}` : "Ready"}</small>
          <output>{display}</output>
        </div>
        <div className={styles.keys}>
          <button type="button" className={styles.clearKey} onClick={clear}>
            <Delete aria-hidden="true" />
            Clear
          </button>
          <button
            type="button"
            className={styles.operatorKey}
            aria-pressed={operator === "÷"}
            onClick={() => choose("÷")}
          >
            ÷
          </button>
          {["7", "8", "9"].map((value) => (
            <button type="button" key={value} onClick={() => input(value)}>
              {value}
            </button>
          ))}
          <button
            type="button"
            className={styles.operatorKey}
            aria-pressed={operator === "×"}
            onClick={() => choose("×")}
          >
            ×
          </button>
          {["4", "5", "6"].map((value) => (
            <button type="button" key={value} onClick={() => input(value)}>
              {value}
            </button>
          ))}
          <button
            type="button"
            className={styles.operatorKey}
            aria-pressed={operator === "−"}
            onClick={() => choose("−")}
          >
            −
          </button>
          {["1", "2", "3"].map((value) => (
            <button type="button" key={value} onClick={() => input(value)}>
              {value}
            </button>
          ))}
          <button
            type="button"
            className={styles.operatorKey}
            aria-pressed={operator === "+"}
            onClick={() => choose("+")}
          >
            +
          </button>
          <button type="button" className={styles.zeroKey} onClick={() => input("0")}>
            0
          </button>
          <button type="button" onClick={() => input(".")}>
            .
          </button>
          <button type="button" className={styles.equalsKey} onClick={equals}>
            <Calculator aria-hidden="true" />
            Equals
          </button>
        </div>
      </div>
    </Panel>
  );
}

export default function HomeProductivitySuite({ showNewYork }: { showNewYork: boolean }) {
  return (
    <section className={styles.suite} aria-label="Home productivity tools">
      <WorldClockGallery showNewYork={showNewYork} />
      <OperationsTime showNewYork={showNewYork} />
      <MonthCalendar />
      <QuickCalculator />
    </section>
  );
}
