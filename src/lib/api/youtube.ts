/**
 * Client side data source for the feed and live status (section 5, 15).
 *
 * Branches on MOCK_MODE: when on, reads fixtures with no network and no key.
 * When off, calls the serverless API and validates the response defensively
 * (drop bad items, never throw to the user). If the server reports a missing
 * key (503), it falls back to MOCK_MODE automatically with a visible notice.
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

const MOCK_FALLBACK_NOTICE = 'No API key set on the server. Showing mock data.';

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

async function getJson(path: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(path, { signal, headers: { accept: 'application/json' } });
  } catch (cause) {
    // Network failure is transient and retryable.
    throw new YouTubeError('network', `Could not reach ${path}.`, { retryable: true, cause });
  }
}

export async function fetchFeed(signal?: AbortSignal): Promise<FeedResponse> {
  if (MOCK_MODE) return buildMockFeed();

  const res = await getJson('/api/feed', signal);

  // Missing or broken key on the server: fall back to mock with a banner.
  if (res.status === 503) {
    return { ...buildMockFeed(), notice: MOCK_FALLBACK_NOTICE };
  }
  if (!res.ok) {
    const retryable = res.status >= 500;
    throw new YouTubeError(retryable ? 'transient' : 'unknown', `Feed request failed (${res.status}).`, {
      status: res.status,
      retryable,
    });
  }

  const json = (await res.json().catch(() => null)) as unknown;
  return coerceFeed(json);
}

export async function fetchLive(signal?: AbortSignal): Promise<LiveResponse> {
  if (MOCK_MODE) return buildMockLive();

  const res = await getJson('/api/live', signal);
  if (res.status === 503) {
    // Live is non-essential. Degrade to "nothing live" rather than erroring.
    return { live: [], stale: true, mock: false, checkedAt: new Date().toISOString() };
  }
  if (!res.ok) {
    const retryable = res.status >= 500;
    throw new YouTubeError(retryable ? 'transient' : 'unknown', `Live request failed (${res.status}).`, {
      status: res.status,
      retryable,
    });
  }

  const json = (await res.json().catch(() => null)) as unknown;
  return coerceLive(json);
}

/** Fetch one video on demand for a direct watch link (section 11). */
export async function fetchVideo(id: string, signal?: AbortSignal): Promise<Video | null> {
  if (MOCK_MODE) {
    return buildMockFeed().videos.find((v) => v.id === id) ?? null;
  }

  const res = await getJson(`/api/video?id=${encodeURIComponent(id)}`, signal);
  if (res.status === 404 || res.status === 503) return null;
  if (!res.ok) {
    const retryable = res.status >= 500;
    throw new YouTubeError(retryable ? 'transient' : 'unknown', `Video request failed (${res.status}).`, {
      status: res.status,
      retryable,
    });
  }

  const json = (await res.json().catch(() => null)) as { video?: unknown } | null;
  const parsed = canonicalVideoSchema.safeParse(json?.video);
  return parsed.success ? parsed.data : null;
}
