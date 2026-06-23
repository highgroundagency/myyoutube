import type { FeedResponse, LiveResponse, Video } from '../lib/youtube/types';
import rawFeed from './feed.json';

/**
 * Mock data source for MOCK_MODE (section 15). Reads the static fixture and
 * re-anchors its timestamps so the demo stays evergreen: the newest upload maps
 * to "now", which keeps relative ages, NEW badges, and the live item realistic
 * no matter when the app is opened.
 *
 * DECISION: fixtures are cast here without zod. They are checked by the schema
 * tests in src/lib/youtube (phase 4) so a malformed fixture fails CI, not users.
 */
const FEED = rawFeed as unknown as FeedResponse;

function shiftIso(iso: string, deltaMs: number): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + deltaMs).toISOString() : iso;
}

function reAnchor(videos: Video[]): Video[] {
  const published = videos
    .map((v) => Date.parse(v.publishedAt))
    .filter((n) => Number.isFinite(n));
  if (published.length === 0) return videos.map((v) => ({ ...v }));

  // Anchor on the newest upload (not scheduled times) so any upcoming stream
  // stays in the future relative to now.
  const delta = Date.now() - Math.max(...published);

  return videos.map((v) => ({
    ...v,
    publishedAt: shiftIso(v.publishedAt, delta),
    scheduledStartTime: v.scheduledStartTime
      ? shiftIso(v.scheduledStartTime, delta)
      : undefined,
  }));
}

/** A fresh, re-anchored copy of the mock feed. */
export function buildMockFeed(): FeedResponse {
  return {
    ...FEED,
    mock: true,
    stale: false,
    notice: FEED.notice ?? null,
    videos: reAnchor(FEED.videos),
  };
}

/** Mock live response derived from the feed (videos currently live). */
export function buildMockLive(): LiveResponse {
  const live = reAnchor(FEED.videos).filter((v) => v.liveState === 'live');
  return {
    live,
    stale: false,
    mock: true,
    checkedAt: new Date().toISOString(),
  };
}
