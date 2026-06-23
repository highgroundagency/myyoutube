import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildFeed, requireApiKey } from './_youtube';
import { cacheGet, cacheSet } from './_cache';
import { FEED_CACHE_CONTROL } from '../src/config/constants';
import { YouTubeError } from '../src/lib/youtube/errors';
import type { FeedResponse, ResolvedChannel, Video } from '../src/lib/youtube/types';

type CachedFeed = { videos: Video[]; resolvedChannels: ResolvedChannel[] };

/**
 * GET /api/feed (section 7). Returns the curated, filtered, sorted feed.
 * Never surfaces a raw 500 to the user:
 *  - missing or invalid key -> 503 (client falls back to MOCK_MODE)
 *  - quota exhausted -> serve last cached feed with a quiet notice if we have one
 *  - other errors -> serve stale if available, else a clean 502 JSON error
 */
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const apiKey = requireApiKey();
    const { videos, resolvedChannels } = await buildFeed(apiKey);

    // Keep a warm-instance copy for the quota fallback path.
    cacheSet('feed:last', { videos, resolvedChannels } satisfies CachedFeed, 6 * 60 * 60 * 1000);

    res.setHeader('Cache-Control', FEED_CACHE_CONTROL);
    const payload: FeedResponse = {
      videos,
      stale: false,
      mock: false,
      notice: null,
      resolvedChannels,
    };
    res.status(200).json(payload);
  } catch (error) {
    if (error instanceof YouTubeError && error.reason === 'missingKey') {
      res.status(503).json({
        error: 'missing_api_key',
        message: 'The server is missing YOUTUBE_API_KEY. Falling back to mock data.',
      });
      return;
    }

    if (error instanceof YouTubeError && error.isKeyProblem) {
      res.status(503).json({ error: 'key_problem', message: error.message });
      return;
    }

    // Quota exhausted: serve the last good feed if a warm instance has one.
    const cached = cacheGet<CachedFeed>('feed:last');
    if (error instanceof YouTubeError && error.isQuota && cached) {
      res.setHeader('Cache-Control', 'no-store');
      const payload: FeedResponse = {
        ...cached,
        stale: true,
        mock: false,
        notice: 'Showing cached content. The daily quota was reached.',
      };
      res.status(200).json(payload);
      return;
    }

    // Any other failure: serve stale if we can, otherwise a clean error.
    if (cached) {
      res.setHeader('Cache-Control', 'no-store');
      const payload: FeedResponse = {
        ...cached,
        stale: true,
        mock: false,
        notice: 'Showing cached content.',
      };
      res.status(200).json(payload);
      return;
    }

    console.error('[api/feed] unrecoverable error:', error);
    res.status(502).json({ error: 'feed_failed', message: 'Could not load the feed right now.' });
  }
}
