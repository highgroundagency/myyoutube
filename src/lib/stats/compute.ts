/**
 * Pure stats computations (section 14). All day boundaries use the viewer's
 * local timezone via date-fns, never UTC, so the chart is not shifted by hours.
 * Empty days render as zero so charts never break on gaps.
 */
import { format, subDays, parseISO } from 'date-fns';
import type { DailyStats } from './dailyStatsStore';
import type { WatchRecords } from '../watch/types';
import { STREAK_MIN_MINUTES } from '../../config/constants';

/** Local day keys (yyyy-MM-dd) for the last `days` days, oldest first. */
export function buildDayKeys(days: number, today: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(format(subDays(today, i), 'yyyy-MM-dd'));
  return out;
}

export type DayPoint = { day: string; label: string; minutes: number; completed: number };

/** A zero-filled series of the last `days` days. */
export function buildSeries(stats: DailyStats, days: number, today: Date = new Date()): DayPoint[] {
  return buildDayKeys(days, today).map((day) => {
    const s = stats[day];
    return {
      day,
      label: format(parseISO(day), 'MMM d'),
      minutes: Math.round((s?.watchSeconds ?? 0) / 60),
      completed: s?.videosCompleted ?? 0,
    };
  });
}

export function totalWatchSeconds(stats: DailyStats): number {
  return Object.values(stats).reduce((acc, s) => acc + s.watchSeconds, 0);
}

export function totalCompleted(stats: DailyStats): number {
  return Object.values(stats).reduce((acc, s) => acc + s.videosCompleted, 0);
}

/**
 * Consecutive days (counting back from today) with at least the threshold of
 * watch minutes. Today below the threshold does not break the streak (it may
 * still be in progress); a prior gap does.
 */
export function computeStreak(
  stats: DailyStats,
  today: Date = new Date(),
  minMinutes: number = STREAK_MIN_MINUTES,
): number {
  let streak = 0;
  for (let i = 0; i < 3650; i += 1) {
    const day = format(subDays(today, i), 'yyyy-MM-dd');
    const minutes = (stats[day]?.watchSeconds ?? 0) / 60;
    if (minutes >= minMinutes) {
      streak += 1;
    } else if (i === 0) {
      continue; // today may be incomplete, keep looking back
    } else {
      break;
    }
  }
  return streak;
}

export type CategoryMinutes = { category: string; minutes: number };

/**
 * Minutes per category, derived from watch_state by summing the furthest
 * position reached per video (section 14). This is an honest proxy for how much
 * of each category was actually watched.
 */
export function categoryMinutes(records: WatchRecords): CategoryMinutes[] {
  const map = new Map<string, number>();
  for (const r of Object.values(records)) {
    const category = r.category ?? 'other';
    map.set(category, (map.get(category) ?? 0) + (r.watchedSeconds ?? 0));
  }
  return [...map.entries()]
    .map(([category, seconds]) => ({ category, minutes: Math.round(seconds / 60) }))
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/** "3h 20m", "45m", "0m". */
export function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}
