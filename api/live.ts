import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLiveVideos, requireApiKey } from './_youtube';
import { LIVE_CACHE_CONTROL } from '../src/config/constants';
import { YouTubeError } from '../src/lib/youtube/errors';
import type { LiveResponse } from '../src/lib/youtube/types';

export const config = { maxDuration: 30 };

/**
 * GET /api/live (section 10). Caze TV (and any channel with liveCheck) live
 * status only. Short cache. On quota or key trouble it returns an empty live
 * list rather than an error, so a flaky live check never breaks the home feed.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const emptyPayload = (): LiveResponse => ({
    live: [],
    stale: false,
    mock: false,
    checkedAt: new Date().toISOString(),
  });

  try {
    const apiKey = requireApiKey();
    const live = await getLiveVideos(apiKey);
    res.setHeader('Cache-Control', LIVE_CACHE_CONTROL);
    res.status(200).json({ ...emptyPayload(), live });
  } catch (error) {
    if (error instanceof YouTubeError && error.reason === 'missingKey') {
      res.status(503).json({ error: 'missing_api_key', message: 'Missing YOUTUBE_API_KEY.' });
      return;
    }
    // Live is non-essential: degrade to "nothing live" with a stale flag.
    console.error('[api/live] error, returning empty live list:', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ...emptyPayload(), stale: true });
  }
}
