/**
 * "Time saved from YouTube": a motivational running total. Gabe used to lose a
 * baseline number of hours a day to the YouTube feed; every day off it adds that
 * baseline to the total. The total is expressed in hours always, and also in
 * days and months, but a unit only shows once the total reaches at least one of
 * it (no "0 days saved").
 */
import { parseISO } from 'date-fns';
import type { AppMeta, DailyStats } from '../persistence/types';
import { localDayKey } from '../persistence/types';
import {
  DEFAULT_DAILY_YOUTUBE_HOURS,
  HOURS_PER_SAVED_DAY,
  DAYS_PER_SAVED_MONTH,
} from '../../config/constants';

const MIN_PER_HOUR = 60;
const MIN_PER_DAY = HOURS_PER_SAVED_DAY * MIN_PER_HOUR;
const MIN_PER_MONTH = DAYS_PER_SAVED_MONTH * MIN_PER_DAY;

/** The earliest local day present in the stats, or null when there is none. */
export function earliestStatDay(stats: DailyStats): string | null {
  const days = Object.keys(stats);
  if (days.length === 0) return null;
  return days.reduce((min, d) => (d < min ? d : min));
}

/**
 * The day the counter starts from: an explicit override, else the first day the
 * viewer ever watched anything here, else today (first run).
 */
export function effectiveQuitDay(meta: AppMeta, stats: DailyStats, today: Date = new Date()): string {
  return meta.quitDate ?? earliestStatDay(stats) ?? localDayKey(today);
}

/**
 * Saved minutes since the quit day: baseline hours/day times the elapsed time.
 * Continuous (fractional days) so it ticks up through the day rather than only
 * at midnight. A future or invalid quit day yields 0, never a negative total.
 */
export function savedMinutes(
  quitDay: string,
  baselineHours: number = DEFAULT_DAILY_YOUTUBE_HOURS,
  now: Date = new Date(),
): number {
  const start = parseISO(quitDay).getTime();
  if (!Number.isFinite(start)) return 0;
  const elapsedDays = (now.getTime() - start) / 86_400_000;
  if (elapsedDays <= 0) return 0;
  return elapsedDays * baselineHours * MIN_PER_HOUR;
}

export type SavedReadout = {
  totalMinutes: number;
  /** Total expressed in whole hours (the headline). */
  hours: number;
  /** Total expressed in whole days; only meaningful when >= 1. */
  days: number;
  /** Total expressed in whole months; only meaningful when >= 1. */
  months: number;
};

/** The same saved total expressed independently in hours, days, and months. */
export function describeSavedTime(totalMinutes: number): SavedReadout {
  const safe = Math.max(0, totalMinutes);
  return {
    totalMinutes: safe,
    hours: Math.floor(safe / MIN_PER_HOUR),
    days: Math.floor(safe / MIN_PER_DAY),
    months: Math.floor(safe / MIN_PER_MONTH),
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Headline label: whole hours, or minutes while still under an hour. */
export function formatSavedHeadline(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  if (safe < MIN_PER_HOUR) return plural(safe, 'minuto', 'minutos');
  return plural(Math.floor(safe / MIN_PER_HOUR), 'hora', 'horas');
}

/** Secondary equivalents (days, months), already filtered to >= 1 unit. */
export function savedEquivalents(readout: SavedReadout): string[] {
  const out: string[] = [];
  if (readout.days >= 1) out.push(plural(readout.days, 'dia', 'dias'));
  if (readout.months >= 1) out.push(plural(readout.months, 'mês', 'meses'));
  return out;
}
