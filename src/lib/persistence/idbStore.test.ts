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

  it('keeps the latest resume position (it can move backward)', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', lastPositionSeconds: 120 });
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', lastPositionSeconds: 40 });
    expect(persistence.getWatchSnapshot().v1.lastPositionSeconds).toBe(40);
  });

  it('dismisses from continue-watching, and a new position un-dismisses', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', lastPositionSeconds: 60 });
    persistence.dismissResume('v1');
    expect(persistence.getWatchSnapshot().v1.resumeDismissed).toBe(true);
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', lastPositionSeconds: 90 });
    expect(persistence.getWatchSnapshot().v1.resumeDismissed).toBe(false);
  });

  it('tombstones a removed video, and re-watching clears the tombstone', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', watchedSeconds: 50 });
    persistence.removeWatch('v1');
    expect(persistence.getWatchSnapshot().v1).toBeUndefined();
    expect(persistence.getDeletionsSnapshot().v1).toBeTruthy();
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', watchedSeconds: 10 });
    expect(persistence.getDeletionsSnapshot().v1).toBeUndefined();
  });

  it('marks many as seen without downgrading completed', () => {
    persistence.upsertWatch({ videoId: 'done', status: 'completed', watchedSeconds: 100 });
    persistence.markManySeen([
      { videoId: 'done', status: 'seen' },
      { videoId: 'fresh', status: 'seen', title: 'Fresh' },
    ]);
    const snap = persistence.getWatchSnapshot();
    expect(snap.done.status).toBe('completed');
    expect(snap.done.watchedSeconds).toBe(100);
    expect(snap.fresh.status).toBe('seen');
    expect(snap.fresh.title).toBe('Fresh');
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

describe('applyRemote (cross-device sync)', () => {
  beforeEach(() => {
    persistence.clearWatch();
    persistence.clearStats();
  });

  it('merges a remote record, sums remote stats into the display view only', () => {
    persistence.upsertWatch({ videoId: 'v1', status: 'seen', watchedSeconds: 100, lastPositionSeconds: 90 });
    persistence.addStats(600, 0, '2026-06-25');

    persistence.applyRemote(
      {
        phone: {
          updatedAt: '2026-06-26T10:00:00.000Z',
          watch: {
            v1: {
              videoId: 'v1',
              status: 'seen',
              watchedSeconds: 400,
              lastPositionSeconds: 380,
              firstWatchedAt: '2026-06-20T00:00:00.000Z',
              lastWatchedAt: '2100-01-01T00:00:00.000Z',
            },
            v2: {
              videoId: 'v2',
              status: 'completed',
              watchedSeconds: 900,
              firstWatchedAt: '2026-06-21T00:00:00.000Z',
              lastWatchedAt: '2026-06-21T01:00:00.000Z',
            },
          },
          deletions: {},
          stats: { '2026-06-25': { day: '2026-06-25', watchSeconds: 1200, videosCompleted: 1 } },
          meta: {},
          snoozes: {},
        },
      },
      'laptop',
    );

    const watch = persistence.getWatchSnapshot();
    expect(watch.v1.watchedSeconds).toBe(400); // remote was further
    expect(watch.v1.lastPositionSeconds).toBe(380); // remote was the latest activity
    expect(watch.v2.status).toBe('completed'); // arrived whole from the phone

    // Own slice untouched; display sums both devices.
    expect(persistence.getStatsSnapshot()['2026-06-25'].watchSeconds).toBe(600);
    expect(persistence.getDisplayStatsSnapshot()['2026-06-25'].watchSeconds).toBe(1800);
  });

  it('applying the same remote twice never double counts (idempotent)', () => {
    persistence.addStats(300, 0, '2026-06-25');
    const devices = {
      phone: {
        updatedAt: '2026-06-26T10:00:00.000Z',
        watch: {},
        deletions: {},
        stats: { '2026-06-25': { day: '2026-06-25', watchSeconds: 1000, videosCompleted: 0 } },
        meta: {},
        snoozes: {},
      },
    };
    persistence.applyRemote(devices, 'laptop');
    persistence.applyRemote(devices, 'laptop');
    expect(persistence.getDisplayStatsSnapshot()['2026-06-25'].watchSeconds).toBe(1300);
  });

  it('bumps writeSeq on local mutations but NOT when merging a pull', () => {
    const before = persistence.getWriteSeq();
    persistence.upsertWatch({ videoId: 'v1', status: 'seen' });
    expect(persistence.getWriteSeq()).toBe(before + 1);
    const afterLocal = persistence.getWriteSeq();
    persistence.applyRemote(
      {
        phone: {
          updatedAt: '2026-06-26T10:00:00.000Z',
          watch: {},
          deletions: {},
          stats: {},
          meta: {},
          snoozes: {},
        },
      },
      'laptop',
    );
    expect(persistence.getWriteSeq()).toBe(afterLocal); // pulls never look like local edits
  });

  it('a remote tombstone removes the local record', () => {
    persistence.upsertWatch({ videoId: 'gone', status: 'seen' });
    // The tombstone must be newer than the local record's lastWatchedAt.
    const future = new Date(Date.now() + 60_000).toISOString();
    persistence.applyRemote(
      {
        phone: {
          updatedAt: future,
          watch: {},
          deletions: { gone: future },
          stats: {},
          meta: {},
          snoozes: {},
        },
      },
      'laptop',
    );
    expect(persistence.getWatchSnapshot().gone).toBeUndefined();
  });
});
