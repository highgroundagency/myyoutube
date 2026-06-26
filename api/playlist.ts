import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPlaylistVideos, requireApiKey } from './_youtube.js';
import { LEARNING_PLAYLIST_IDS } from '../src/config/playlists.js';
import { FEED_CACHE_CONTROL } from '../src/config/constants.js';
import { YouTubeError } from '../src/lib/youtube/errors.js';

export const config = { maxDuration: 30 };

function firstQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * GET /api/playlist?id=PLAYLIST_ID. Returns the playlist videos in lesson order.
 * Only ids configured in LEARNING_PLAYLISTS are allowed, so this is not an open
 * proxy for arbitrary playlists.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = firstQuery(req.query.id);
  if (!id || !LEARNING_PLAYLIST_IDS.has(id)) {
    res.status(400).json({ error: 'bad_request', message: 'Unknown playlist id.' });
    return;
  }

  try {
    const apiKey = requireApiKey();
    const videos = await getPlaylistVideos(apiKey, id);
    res.setHeader('Cache-Control', FEED_CACHE_CONTROL);
    res.status(200).json({ playlistId: id, videos, mock: false });
  } catch (error) {
    if (error instanceof YouTubeError && error.reason === 'missingKey') {
      res.status(503).json({ error: 'missing_api_key', message: 'The server is missing YOUTUBE_API_KEY.' });
      return;
    }
    if (error instanceof YouTubeError && error.isKeyProblem) {
      res.status(503).json({ error: 'key_problem', message: error.message });
      return;
    }
    console.error('[api/playlist] error:', error);
    res.status(502).json({ error: 'playlist_failed', message: 'Could not load the playlist right now.' });
  }
}
