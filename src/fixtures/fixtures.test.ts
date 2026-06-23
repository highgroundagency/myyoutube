import { describe, it, expect } from 'vitest';
import { buildMockFeed, buildMockLive } from './index';
import { feedResponseSchema, liveResponseSchema } from '../lib/youtube/schemas';

describe('mock fixtures', () => {
  it('the feed fixture matches the canonical response schema', () => {
    const feed = buildMockFeed();
    const result = feedResponseSchema.safeParse(feed);
    expect(result.success).toBe(true);
    expect(feed.videos.length).toBeGreaterThan(5);
    expect(feed.mock).toBe(true);
  });

  it('contains a live and an upcoming item', () => {
    const feed = buildMockFeed();
    expect(feed.videos.some((v) => v.liveState === 'live')).toBe(true);
    expect(feed.videos.some((v) => v.liveState === 'upcoming')).toBe(true);
  });

  it('re-anchors timestamps so the newest upload is near now', () => {
    const feed = buildMockFeed();
    const newest = Math.max(...feed.videos.map((v) => Date.parse(v.publishedAt)));
    // Within a minute of now.
    expect(Math.abs(Date.now() - newest)).toBeLessThan(60_000);
  });

  it('keeps the upcoming scheduled time in the future', () => {
    const feed = buildMockFeed();
    const upcoming = feed.videos.find((v) => v.liveState === 'upcoming');
    expect(upcoming?.scheduledStartTime).toBeDefined();
    expect(Date.parse(upcoming!.scheduledStartTime!)).toBeGreaterThan(Date.now());
  });

  it('builds a live response that validates', () => {
    const live = buildMockLive();
    expect(liveResponseSchema.safeParse(live).success).toBe(true);
    expect(live.live.every((v) => v.liveState === 'live')).toBe(true);
  });
});
