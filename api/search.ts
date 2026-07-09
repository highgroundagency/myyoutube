import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchVideos, requireApiKey } from './_youtube.js';
import { YouTubeError } from '../src/lib/youtube/errors.js';

export const config = { maxDuration: 30 };

/**
 * GET /api/search?q=TERM. Real YouTube search, fired only on explicit submit
 * (search.list costs 100 quota units). Results are canonical Videos, so the
 * client renders them exactly like feed items and they play in the app.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'missing_query', message: 'A search term is required.' });
    return;
  }

  try {
    const apiKey = requireApiKey();
    const videos = await searchVideos(apiKey, q, 20);
    // Searches repeat rarely; a short CDN cache still absorbs double submits.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    res.status(200).json({ videos, query: q });
  } catch (error) {
    if (error instanceof YouTubeError && error.reason === 'missingKey') {
      res.status(503).json({ error: 'missing_api_key', message: 'Missing YOUTUBE_API_KEY.' });
      return;
    }
    console.error('[api/search] error:', error);
    res.status(502).json({ error: 'search_failed', message: 'Could not search right now.' });
  }
}
