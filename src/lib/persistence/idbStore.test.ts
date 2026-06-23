import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'idb-keyval';
import { persistence } from './idbStore';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('persistence watch state', () => {
  beforeEach(() => {
    persistence.clearWatch();
  });

  it('takes the max watched position', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', watchedSeconds: 30 });
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', watchedSeconds: 10 });
    expect(persistence.getWatchSnapshot().v1.watchedSeconds).toBe(30);
  });

  it('never downgrades completed to seen', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'completed', watchedSeconds: 90 });
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', watchedSeconds: 95 });
    const rec = persistence.getWatchSnapshot().v1;
    expect(rec.status).toBe('completed');
    expect(rec.watchedSeconds).toBe(95);
  });

  it('upgrades seen to completed and preserves firstWatchedAt', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'seen' });
    const first = persistence.getWatchSnapshot().v1.firstWatchedAt;
    persistence.upsertWatch({ videoId: 'v1', status: 'completed' });
    expect(persistence.getWatchSnapshot().v1.status).toBe('completed');
    expect(persistence.getWatchSnapshot().v1.firstWatchedAt).toBe(first);
  });

  it('removes records', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'seen' });
    persistence.removeWatch('v1');
    expect(persistence.getWatchSnapshot().v1).toBeUndefined();
  });
});

describe('persistence daily stats', () => {
  beforeEach(() => {
    persistence.clearStats();
  });

  it('accumulates watch seconds and completions per day', () => {
    persistence.addStats(600, 1, '2026-06-20');
    persistence.addStats(300, 0, '2026-06-20');
    persistence.addStats(120, 2, '2026-06-21');
    const stats = persistence.getStatsSnapshot();
    expect(stats['2026-06-20']).toEqual({ day: '2026-06-20', watchSeconds: 900, videosCompleted: 1 });
    expect(stats['2026-06-21']).toEqual({ day: '2026-06-21', watchSeconds: 120, videosCompleted: 2 });
  });

  it('ignores empty deltas', () => {
    persistence.addStats(0, 0, '2026-06-20');
    expect(persistence.getStatsSnapshot()['2026-06-20']).toBeUndefined();
  });

  it('writes daily stats through to IndexedDB', async () => {
    persistence.addStats(600, 1, '2026-06-22');
    await tick(); // let the fire-and-forget IndexedDB write settle
    const stored = await get<Record<string, { watchSeconds: number }>>('gv-daily-stats');
    expect(stored?.['2026-06-22']?.watchSeconds).toBe(600);
  });
});
