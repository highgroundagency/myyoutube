import { describe, it, expect } from 'vitest';
import {
  mergeWatchRecord,
  mergeWatch,
  sumDailyStats,
  mergeMeta,
  mergeSnoozes,
  TOMBSTONE_TTL_MS,
} from './merge';
import type { WatchRecord, WatchRecords } from '../persistence/types';

const rec = (over: Partial<WatchRecord> & { videoId: string }): WatchRecord => ({
  status: 'seen',
  watchedSeconds: 0,
  firstWatchedAt: '2026-06-01T00:00:00.000Z',
  lastWatchedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const now = new Date('2026-06-27T12:00:00.000Z');

describe('mergeWatchRecord', () => {
  const phone = rec({
    videoId: 'v',
    watchedSeconds: 300,
    lastPositionSeconds: 250,
    lastWatchedAt: '2026-06-25T10:00:00.000Z',
    title: 'Podcast',
  });
  const laptop = rec({
    videoId: 'v',
    watchedSeconds: 900,
    lastPositionSeconds: 880,
    lastWatchedAt: '2026-06-26T10:00:00.000Z',
  });

  it('is symmetric: merge(a,b) === merge(b,a)', () => {
    expect(mergeWatchRecord(phone, laptop)).toEqual(mergeWatchRecord(laptop, phone));
  });

  it('takes max progress, the newest cursor, and fills metadata from either side', () => {
    const m = mergeWatchRecord(phone, laptop);
    expect(m.watchedSeconds).toBe(900);
    expect(m.lastPositionSeconds).toBe(880); // laptop was the latest activity
    expect(m.lastWatchedAt).toBe('2026-06-26T10:00:00.000Z');
    expect(m.title).toBe('Podcast'); // only the phone had it
  });

  it('rewinding on the newer device wins the cursor (it is the real position)', () => {
    const rewound = { ...laptop, lastPositionSeconds: 60 };
    expect(mergeWatchRecord(phone, rewound).lastPositionSeconds).toBe(60);
  });

  it('completed never downgrades, firstWatchedAt keeps the earliest', () => {
    const done = { ...phone, status: 'completed' as const, firstWatchedAt: '2026-05-01T00:00:00.000Z' };
    const m = mergeWatchRecord(done, laptop);
    expect(m.status).toBe('completed');
    expect(m.firstWatchedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('dismissed on the newest device hides it; watching again later un-hides', () => {
    const dismissed = { ...laptop, resumeDismissed: true };
    expect(mergeWatchRecord(phone, dismissed).resumeDismissed).toBe(true);
    const rewatched = {
      ...phone,
      resumeDismissed: false,
      lastPositionSeconds: 400,
      lastWatchedAt: '2026-06-27T09:00:00.000Z',
    };
    expect(mergeWatchRecord(rewatched, dismissed).resumeDismissed).toBe(false);
  });
});

describe('mergeWatch (maps + tombstones)', () => {
  it('unions records from all devices', () => {
    const a: WatchRecords = { x: rec({ videoId: 'x' }) };
    const b: WatchRecords = { y: rec({ videoId: 'y' }) };
    const { watch } = mergeWatch([a, b], [{}, {}], now);
    expect(Object.keys(watch).sort()).toEqual(['x', 'y']);
  });

  it('a deletion beats an older record on every device', () => {
    const a: WatchRecords = { x: rec({ videoId: 'x', lastWatchedAt: '2026-06-20T00:00:00.000Z' }) };
    const del = { x: '2026-06-21T00:00:00.000Z' };
    const { watch, deletions } = mergeWatch([a, {}], [{}, del], now);
    expect(watch.x).toBeUndefined();
    expect(deletions.x).toBe('2026-06-21T00:00:00.000Z');
  });

  it('watching again after the deletion resurrects and clears the tombstone', () => {
    const a: WatchRecords = { x: rec({ videoId: 'x', lastWatchedAt: '2026-06-22T00:00:00.000Z' }) };
    const del = { x: '2026-06-21T00:00:00.000Z' };
    const { watch, deletions } = mergeWatch([a], [del], now);
    expect(watch.x).toBeDefined();
    expect(deletions.x).toBeUndefined();
  });

  it('prunes tombstones older than the TTL', () => {
    const old = new Date(now.getTime() - TOMBSTONE_TTL_MS - 1000).toISOString();
    const { deletions } = mergeWatch([{}], [{ gone: old }], now);
    expect(deletions.gone).toBeUndefined();
  });
});

describe('sumDailyStats', () => {
  it('sums the same day across devices (phone 20min + laptop 10min = 30min)', () => {
    const phone = { '2026-06-25': { day: '2026-06-25', watchSeconds: 1200, videosCompleted: 1 } };
    const laptop = { '2026-06-25': { day: '2026-06-25', watchSeconds: 600, videosCompleted: 0 } };
    expect(sumDailyStats([phone, laptop])['2026-06-25']).toEqual({
      day: '2026-06-25',
      watchSeconds: 1800,
      videosCompleted: 1,
    });
  });

  it('keeps distinct days side by side', () => {
    const a = { '2026-06-24': { day: '2026-06-24', watchSeconds: 60, videosCompleted: 0 } };
    const b = { '2026-06-25': { day: '2026-06-25', watchSeconds: 120, videosCompleted: 2 } };
    const out = sumDailyStats([a, b]);
    expect(Object.keys(out).sort()).toEqual(['2026-06-24', '2026-06-25']);
  });
});

describe('mergeMeta', () => {
  it('latest explicit quit-date edit wins', () => {
    const a = { quitDate: '2026-01-01', quitDateSetAt: '2026-06-01T00:00:00.000Z' };
    const b = { quitDate: '2026-03-01', quitDateSetAt: '2026-06-20T00:00:00.000Z' };
    expect(mergeMeta([a, b]).quitDate).toBe('2026-03-01');
    expect(mergeMeta([b, a]).quitDate).toBe('2026-03-01');
  });

  it('an explicit value beats devices that never set one', () => {
    expect(mergeMeta([{}, { quitDate: '2026-02-02', quitDateSetAt: '2026-06-01T00:00:00.000Z' }]).quitDate).toBe(
      '2026-02-02',
    );
    expect(mergeMeta([{}, {}])).toEqual({});
  });
});

describe('mergeSnoozes', () => {
  it('most recent snooze per video wins', () => {
    const a = { v: '2026-06-20T00:00:00.000Z' };
    const b = { v: '2026-06-22T00:00:00.000Z', w: '2026-06-21T00:00:00.000Z' };
    expect(mergeSnoozes([a, b])).toEqual({
      v: '2026-06-22T00:00:00.000Z',
      w: '2026-06-21T00:00:00.000Z',
    });
  });
});
