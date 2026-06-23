import { describe, it, expect } from 'vitest';
import { format, subDays } from 'date-fns';
import { buildSeries, computeStreak, categoryMinutes, formatMinutes } from './compute';
import type { DailyStats, WatchRecords } from '../persistence/types';

const today = new Date('2026-06-23T12:00:00');
const key = (offset: number) => format(subDays(today, offset), 'yyyy-MM-dd');

describe('buildSeries', () => {
  it('zero fills missing days and converts seconds to minutes', () => {
    const stats: DailyStats = {
      [key(0)]: { day: key(0), watchSeconds: 600, videosCompleted: 1 },
      [key(2)]: { day: key(2), watchSeconds: 1200, videosCompleted: 2 },
    };
    const series = buildSeries(stats, 4, today);
    expect(series).toHaveLength(4);
    // Oldest first; the two empty days are zeros, not gaps.
    expect(series.map((p) => p.minutes)).toEqual([0, 20, 0, 10]);
    expect(series[3].completed).toBe(1);
  });
});

describe('computeStreak', () => {
  it('counts consecutive days above the threshold', () => {
    const stats: DailyStats = {
      [key(0)]: { day: key(0), watchSeconds: 600, videosCompleted: 0 }, // 10 min today
      [key(1)]: { day: key(1), watchSeconds: 600, videosCompleted: 0 },
      [key(2)]: { day: key(2), watchSeconds: 60, videosCompleted: 0 }, // 1 min, breaks
      [key(3)]: { day: key(3), watchSeconds: 600, videosCompleted: 0 },
    };
    expect(computeStreak(stats, today, 5)).toBe(2);
  });

  it('does not break the streak when today is still empty', () => {
    const stats: DailyStats = {
      [key(1)]: { day: key(1), watchSeconds: 600, videosCompleted: 0 },
      [key(2)]: { day: key(2), watchSeconds: 600, videosCompleted: 0 },
    };
    expect(computeStreak(stats, today, 5)).toBe(2);
  });

  it('returns zero when nothing meets the threshold', () => {
    expect(computeStreak({}, today, 5)).toBe(0);
  });
});

describe('categoryMinutes', () => {
  it('sums watched seconds per category, descending', () => {
    const records: WatchRecords = {
      a: { videoId: 'a', status: 'completed', watchedSeconds: 600, category: 'health', firstWatchedAt: '', lastWatchedAt: '' },
      b: { videoId: 'b', status: 'seen', watchedSeconds: 1200, category: 'language', firstWatchedAt: '', lastWatchedAt: '' },
      c: { videoId: 'c', status: 'seen', watchedSeconds: 300, category: 'health', firstWatchedAt: '', lastWatchedAt: '' },
    };
    const result = categoryMinutes(records);
    expect(result[0]).toEqual({ category: 'language', minutes: 20 });
    expect(result[1]).toEqual({ category: 'health', minutes: 15 });
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(200)).toBe('3h 20m');
    expect(formatMinutes(0)).toBe('0m');
  });
});
