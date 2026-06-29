import { describe, it, expect } from 'vitest';
import { buildResumeList } from './resume';
import type { WatchRecord, WatchRecords } from '../persistence/types';

const rec = (over: Partial<WatchRecord> & { videoId: string }): WatchRecord => ({
  status: 'seen',
  watchedSeconds: 0,
  durationSeconds: 600,
  title: `title-${over.videoId}`,
  firstWatchedAt: '2026-06-20T00:00:00.000Z',
  lastWatchedAt: '2026-06-20T00:00:00.000Z',
  ...over,
});

describe('buildResumeList', () => {
  it('includes in-progress videos with the resume position and fraction', () => {
    const records: WatchRecords = {
      a: rec({ videoId: 'a', lastPositionSeconds: 120, durationSeconds: 600 }),
    };
    const list = buildResumeList(records);
    expect(list).toHaveLength(1);
    expect(list[0].positionSeconds).toBe(120);
    expect(list[0].fraction).toBeCloseTo(0.2);
  });

  it('falls back to watchedSeconds when no cursor was recorded', () => {
    const records: WatchRecords = {
      a: rec({ videoId: 'a', watchedSeconds: 90, lastPositionSeconds: undefined }),
    };
    expect(buildResumeList(records)[0].positionSeconds).toBe(90);
  });

  it('excludes completed, dismissed, too-short, and near-the-end videos', () => {
    const records: WatchRecords = {
      done: rec({ videoId: 'done', status: 'completed', lastPositionSeconds: 100 }),
      dismissed: rec({ videoId: 'dismissed', lastPositionSeconds: 100, resumeDismissed: true }),
      glance: rec({ videoId: 'glance', lastPositionSeconds: 5 }),
      ending: rec({ videoId: 'ending', lastPositionSeconds: 596, durationSeconds: 600 }),
      good: rec({ videoId: 'good', lastPositionSeconds: 100 }),
    };
    expect(buildResumeList(records).map((i) => i.videoId)).toEqual(['good']);
  });

  it('keeps a video that is watched most of the way but not at the very end', () => {
    const records: WatchRecords = {
      mid: rec({ videoId: 'mid', lastPositionSeconds: 540, durationSeconds: 600 }), // 90%
    };
    expect(buildResumeList(records).map((i) => i.videoId)).toEqual(['mid']);
  });

  it('orders by most recent activity and respects the limit', () => {
    const records: WatchRecords = {
      old: rec({ videoId: 'old', lastPositionSeconds: 100, lastWatchedAt: '2026-06-19T00:00:00.000Z' }),
      new: rec({ videoId: 'new', lastPositionSeconds: 100, lastWatchedAt: '2026-06-21T00:00:00.000Z' }),
    };
    expect(buildResumeList(records).map((i) => i.videoId)).toEqual(['new', 'old']);
    expect(buildResumeList(records, 1).map((i) => i.videoId)).toEqual(['new']);
  });

  it('keeps unknown-duration videos with a zero fraction', () => {
    const records: WatchRecords = {
      a: rec({ videoId: 'a', lastPositionSeconds: 100, durationSeconds: 0 }),
    };
    const list = buildResumeList(records);
    expect(list[0].fraction).toBe(0);
    expect(list[0].positionSeconds).toBe(100);
  });
});
