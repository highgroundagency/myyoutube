import { describe, it, expect } from 'vitest';
import { pickNextUp, pruneSnoozes, SNOOZE_TTL_MS } from './nextUp';
import type { Video } from '../youtube/types';

const vid = (id: string, publishedAt: string, over: Partial<Video> = {}): Video => ({
  id,
  channelKey: 'bryanjohnson',
  channelLabel: 'Bryan Johnson',
  title: `title-${id}`,
  thumbnailUrl: 't.jpg',
  publishedAt,
  durationSeconds: 600,
  liveState: 'none',
  isEmbeddable: true,
  isPublic: true,
  ...over,
});

const pool = [
  vid('c', '2026-03-01T00:00:00Z'),
  vid('a', '2024-01-01T00:00:00Z'),
  vid('b', '2025-06-01T00:00:00Z'),
  vid('other', '2020-01-01T00:00:00Z', { channelKey: 'mrbeast' }),
  vid('up', '2026-04-01T00:00:00Z', { liveState: 'upcoming' }),
];

const now = new Date('2026-06-27T12:00:00Z');
const never = () => false;

describe('pickNextUp', () => {
  it('recommends the oldest unwatched video of the channel, with progress', () => {
    const next = pickNextUp(pool, 'bryanjohnson', never, {}, now);
    expect(next?.video.id).toBe('a');
    expect(next?.position).toBe(1);
    expect(next?.total).toBe(3); // other-channel and upcoming excluded
    expect(next?.watched).toBe(0);
  });

  it('skips seen videos and counts them as progress', () => {
    const seen = (id: string) => id === 'a';
    const next = pickNextUp(pool, 'bryanjohnson', seen, {}, now);
    expect(next?.video.id).toBe('b');
    expect(next?.watched).toBe(1);
    expect(next?.progress).toBeCloseTo(1 / 3);
  });

  it('skips actively snoozed videos ("assistir depois")', () => {
    const snoozes = { a: now.toISOString() };
    expect(pickNextUp(pool, 'bryanjohnson', never, snoozes, now)?.video.id).toBe('b');
  });

  it('offers a snoozed video again after the snooze expires', () => {
    const old = new Date(now.getTime() - SNOOZE_TTL_MS - 1000).toISOString();
    expect(pickNextUp(pool, 'bryanjohnson', never, { a: old }, now)?.video.id).toBe('a');
  });

  it('when everything unseen is snoozed, returns the oldest snooze (never dead-ends)', () => {
    const snoozes = {
      a: new Date(now.getTime() - 1000).toISOString(),
      b: new Date(now.getTime() - 5000).toISOString(),
      c: new Date(now.getTime() - 3000).toISOString(),
    };
    expect(pickNextUp(pool, 'bryanjohnson', never, snoozes, now)?.video.id).toBe('b');
  });

  it('returns null when the journey is complete or the channel is empty', () => {
    expect(pickNextUp(pool, 'bryanjohnson', () => true, {}, now)).toBeNull();
    expect(pickNextUp(pool, 'nochannel', never, {}, now)).toBeNull();
  });
});

describe('pruneSnoozes', () => {
  it('keeps active snoozes and drops expired ones', () => {
    const fresh = now.toISOString();
    const stale = new Date(now.getTime() - SNOOZE_TTL_MS - 1).toISOString();
    expect(pruneSnoozes({ a: fresh, b: stale, c: 'garbage' }, now)).toEqual({ a: fresh });
  });
});
