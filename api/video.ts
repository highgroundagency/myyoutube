import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVideoById, requireApiKey } from './_youtube.js';
import { YouTubeError } from '../src/lib/youtube/errors.js';

export const config = { maxDuration: 30 };

/**
 * GET /api/video?id=VIDEO_ID (section 11). Single video details for a watch link
 * when the video is not already in the loaded feed pool. Returns 404 if the
 * video does not exist or is not available.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = typeof req.query.id === 'string' ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : '';
  if (!id) {
    res.status(400).json({ error: 'missing_id', message: 'A video id is required.' });
    return;
  }

  try {
    const apiKey = requireApiKey();
    const video = await getVideoById(apiKey, id);
    if (!video) {
      res.status(404).json({ error: 'not_found', message: 'That video was not found.' });
      return;
    }
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    res.status(200).json({ video });
  } catch (error) {
    if (error instanceof YouTubeError && error.reason === 'missingKey') {
      res.status(503).json({ error: 'missing_api_key', message: 'Missing YOUTUBE_API_KEY.' });
      return;
    }
    console.error('[api/video] error:', error);
    res.status(502).json({ error: 'video_failed', message: 'Could not load that video.' });
  }
}
