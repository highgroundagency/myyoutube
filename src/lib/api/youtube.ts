/**
 * Client side data source for the feed and live status (section 5, 15).
 *
 * Branches on MOCK_MODE: when on, reads fixtures with no network and no key.
 * When off, calls the serverless API and validates the response defensively
 * (drop bad items, never throw to the user).
 *
 * Graceful degradation so the app is never a dead end:
 *  - 503 (missing or broken key) -> sample data with a banner.
 *  - 404 (the /api route is not deployed or not running) -> sample data.
 *  - In dev, any unreachable /api (plain `vite` serves the module source, not the
 *    functions) -> sample data with a "run npm run dev:api" banner.
 *  - In production, genuine 5xx errors still surface (retry, cached, error state),
 *    so a broken deploy is visible rather than silently showing sample content.
 */
import { MOCK_MODE } from '../../config/env';
import { buildMockFeed, buildMockLive } from '../../fixtures';
import {
  canonicalVideoSchema,
  parseValidItems,
  resolvedChannelSchema,
} from '../youtube/schemas';
import { YouTubeError } from '../youtube/errors';
import type { FeedResponse, LiveResponse, Video } from '../youtube/types';

const NOTICE_NO_KEY = 'No API key set on the server. Showing sample videos.';
const NOTICE_API_UNAVAILABLE = 'The video service is not available right now. Showing sample videos.';
const NOTICE_DEV_NO_API =
  'The /api backend is not running. Showing sample videos. Run "npm run dev:api" for live data.';

const IS_DEV = import.meta.env.DEV;

function coerceFeed(json: unknown): FeedResponse {
  const obj = (json ?? {}) as Record<string, unknown>;
  return {
    videos: parseValidItems(canonicalVideoSchema, obj.videos),
    resolvedChannels: parseValidItems(resolvedChannelSchema, obj.resolvedChannels),
    stale: Boolean(obj.stale),
    mock: Boolean(obj.mock),
    notice: typeof obj.notice === 'string' ? obj.notice : null,
  };
}

function coerceLive(json: unknown): LiveResponse {
  const obj = (json ?? {}) as Record<string, unknown>;
  return {
    live: parseValidItems(canonicalVideoSchema, obj.live),
    stale: Boolean(obj.stale),
    mock: Boolean(obj.mock),
    checkedAt: typeof obj.checkedAt === 'string' ? obj.checkedAt : new Date().toISOString(),
  };
}

function mockFeedWith(notice: string): FeedResponse {
  return { ...buildMockFeed(), notice };
}

function emptyLive(): LiveResponse {
  return { live: [], stale: true, mock: false, checkedAt: new Date().toISOString() };
}

async function getResponse(path: string, signal?: AbortSignal): Promise<Response> {
  return fetch(path, { signal, headers: { accept: 'application/json' } });
}

/** Read a response body as JSON, or undefined if it is not valid JSON. */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

export async function fetchFeed(signal?: AbortSignal): Promise<FeedResponse> {
  if (MOCK_MODE) return buildMockFeed();

  try {
    const res = await getResponse('/api/feed', signal);

    if (res.status === 503) return mockFeedWith(NOTICE_NO_KEY);
    if (res.status === 404) return mockFeedWith(IS_DEV ? NOTICE_DEV_NO_API : NOTICE_API_UNAVAILABLE);

    if (!res.ok) {
      // In dev there is no /api unless you run vercel dev, so fall back to mock.
      if (IS_DEV) return mockFeedWith(NOTICE_DEV_NO_API);
      const retryable = res.status >= 500;
      throw new YouTubeError(retryable ? 'transient' : 'unknown', `Feed request failed (${res.status}).`, {
        status: res.status,
        retryable,
      });
    }

    const json = await readJson(res);
    if (!isJsonObject(json)) {
      // Plain `vite` serves the module source (not JSON). Fall back to mock.
      if (IS_DEV) return mockFeedWith(NOTICE_DEV_NO_API);
      return coerceFeed(null);
    }
    return coerceFeed(json);
  } catch (err) {
    // Network failure: in dev, fall back to mock; in prod, surface it (retry, cached, error).
    if (IS_DEV) return mockFeedWith(NOTICE_DEV_NO_API);
    throw err;
  }
}

export async function fetchLive(signal?: AbortSignal): Promise<LiveResponse> {
  if (MOCK_MODE) return buildMockLive();

  // Live is non-essential, so it never throws: it degrades to nothing live (or
  // mock live in dev) rather than producing an error state.
  try {
    const res = await getResponse('/api/live', signal);
    if (!res.ok) return IS_DEV ? buildMockLive() : emptyLive();

    const json = await readJson(res);
    if (!isJsonObject(json)) return IS_DEV ? buildMockLive() : emptyLive();
    return coerceLive(json);
  } catch {
    return IS_DEV ? buildMockLive() : emptyLive();
  }
}

/** Fetch one video on demand for a direct watch link (section 11). */
export async function fetchVideo(id: string, signal?: AbortSignal): Promise<Video | null> {
  const fromMock = () => buildMockFeed().videos.find((v) => v.id === id) ?? null;
  if (MOCK_MODE) return fromMock();

  try {
    const res = await getResponse(`/api/video?id=${encodeURIComponent(id)}`, signal);
    if (res.status === 404 || res.status === 503) return IS_DEV ? fromMock() : null;
    if (!res.ok) {
      if (IS_DEV) return fromMock();
      const retryable = res.status >= 500;
      throw new YouTubeError(retryable ? 'transient' : 'unknown', `Video request failed (${res.status}).`, {
        status: res.status,
        retryable,
      });
    }

    const json = (await readJson(res)) as { video?: unknown } | undefined;
    const parsed = canonicalVideoSchema.safeParse(json?.video);
    if (parsed.success) return parsed.data;
    return IS_DEV ? fromMock() : null;
  } catch (err) {
    if (IS_DEV) return fromMock();
    throw err;
  }
}
