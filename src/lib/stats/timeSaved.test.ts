import { describe, it, expect } from 'vitest';
import {
  savedMinutes,
  describeSavedTime,
  formatSavedHeadline,
  savedEquivalents,
  effectiveQuitDay,
  earliestStatDay,
} from './timeSaved';
import type { DailyStats } from '../persistence/types';

describe('savedMinutes', () => {
  it('accrues baseline hours per elapsed day, continuously', () => {
    // 10 full days at 1.5h/day = 15h = 900 min.
    const now = new Date('2026-06-11T00:00:00');
    expect(savedMinutes('2026-06-01', 1.5, now)).toBeCloseTo(900);
  });

  it('is fractional within a day', () => {
    // Half a day at 1.5h/day = 0.75h = 45 min.
    const now = new Date('2026-06-01T12:00:00');
    expect(savedMinutes('2026-06-01', 1.5, now)).toBeCloseTo(45);
  });

  it('never goes negative for a future quit day', () => {
    const now = new Date('2026-06-01T00:00:00');
    expect(savedMinutes('2026-07-01', 1.5, now)).toBe(0);
  });
});

describe('describeSavedTime + thresholds', () => {
  it('shows only hours below one day of saved time', () => {
    const r = describeSavedTime(18 * 60); // 18h
    expect(r.hours).toBe(18);
    expect(r.days).toBe(0);
    expect(r.months).toBe(0);
    expect(savedEquivalents(r)).toEqual([]);
  });

  it('adds days once at least one full day is saved', () => {
    const r = describeSavedTime(50 * 60); // 50h -> 2 days
    expect(r.hours).toBe(50);
    expect(r.days).toBe(2);
    expect(r.months).toBe(0);
    expect(savedEquivalents(r)).toEqual(['2 dias']);
  });

  it('adds months once at least one full month is saved', () => {
    const r = describeSavedTime(800 * 60); // 800h -> 33 days -> 1 month
    expect(r.days).toBe(33);
    expect(r.months).toBe(1);
    expect(savedEquivalents(r)).toEqual(['33 dias', '1 mês']);
  });
});

describe('formatSavedHeadline', () => {
  it('uses minutes under an hour, then hours', () => {
    expect(formatSavedHeadline(45)).toBe('45 minutos');
    expect(formatSavedHeadline(60)).toBe('1 hora');
    expect(formatSavedHeadline(125)).toBe('2 horas');
  });
});

describe('effectiveQuitDay', () => {
  const stats: DailyStats = {
    '2026-06-05': { day: '2026-06-05', watchSeconds: 100, videosCompleted: 0 },
    '2026-06-02': { day: '2026-06-02', watchSeconds: 100, videosCompleted: 0 },
  };

  it('prefers an explicit override', () => {
    expect(effectiveQuitDay({ quitDate: '2026-01-01' }, stats)).toBe('2026-01-01');
  });

  it('falls back to the earliest stats day', () => {
    expect(earliestStatDay(stats)).toBe('2026-06-02');
    expect(effectiveQuitDay({}, stats)).toBe('2026-06-02');
  });

  it('falls back to today when there is nothing', () => {
    expect(effectiveQuitDay({}, {}, new Date('2026-06-27T09:00:00'))).toBe('2026-06-27');
  });
});
