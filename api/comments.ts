import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVideoComments, requireApiKey } from './_youtube.js';
import { YouTubeError } from '../src/lib/youtube/errors.js';

export const config = { maxDuration: 15 };

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function firstQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * GET /api/comments?v=VIDEO_ID&max=5. A few top comments to liven up the cards.
 * Comments are non-essential, so anything short of a key problem degrades to an
 * empty list rather than an error.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const videoId = firstQuery(req.query.v);
  const max = Math.min(10, Math.max(1, Number(firstQuery(req.query.max)) || 5));

  if (!VIDEO_ID_RE.test(videoId)) {
    res.status(400).json({ error: 'bad_request', message: 'Missing or invalid video id.' });
    return;
  }

  try {
    const apiKey = requireApiKey();
    const result = await getVideoComments(apiKey, videoId, max);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof YouTubeError && (error.reason === 'missingKey' || error.isKeyProblem)) {
      res.status(503).json({ error: 'key_problem', comments: [], disabled: false });
      return;
    }
    // Quota or anything else: comments are optional, so do not error the UI.
    console.error('[api/comments] error:', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ comments: [], disabled: false });
  }
}
