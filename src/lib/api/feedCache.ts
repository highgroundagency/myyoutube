/**
 * Device copy of the last real feed, so the app paints videos INSTANTLY on
 * open (TanStack Query initialData) and refreshes in the background, instead
 * of showing skeletons while the serverless feed pipeline runs. Mock feeds are
 * never stored, so sample data cannot leak into a real session.
 */
import type { FeedResponse } from '../youtube/types';

const KEY = 'gv-feed-cache';

type StoredFeed = { at: number; data: FeedResponse };

export function readFeedCache(): StoredFeed | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFeed;
    if (!parsed || typeof parsed.at !== 'number' || !Array.isArray(parsed.data?.videos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFeedCache(data: FeedResponse): void {
  if (data.mock || data.videos.length === 0) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data } satisfies StoredFeed));
  } catch {
    // Quota/private mode: skipping the cache only costs the instant paint.
  }
}
