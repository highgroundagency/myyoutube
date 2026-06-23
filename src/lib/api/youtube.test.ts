import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Force the non-mock code path so we exercise the API fallbacks (the app's
// default test env runs in MOCK_MODE).
vi.mock('../../config/env', () => ({ MOCK_MODE: false, EMBED_HOST: 'https://www.youtube.com' }));

import { fetchFeed, fetchLive } from './youtube';

function makeResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

const validFeedJson = JSON.stringify({
  videos: [
    {
      id: 'real1',
      channelKey: 'mrbeast',
      channelLabel: 'MrBeast',
      title: 'A real video',
      thumbnailUrl: 'https://i.ytimg.com/vi/real1/hq.jpg',
      publishedAt: '2026-06-20T10:00:00.000Z',
      durationSeconds: 600,
      liveState: 'none',
      isEmbeddable: true,
      isPublic: true,
    },
  ],
  resolvedChannels: [],
  stale: false,
  mock: false,
  notice: null,
});

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchFeed graceful fallback (dev, no /api)', () => {
  it('falls back to sample data when /api returns the module source (plain vite, 200 non-JSON)', async () => {
    globalThis.fetch = vi.fn(async () => makeResponse('import { buildFeed } from "/api/_youtube.ts";')) as unknown as typeof fetch;
    const feed = await fetchFeed();
    expect(feed.mock).toBe(true);
    expect(feed.videos.length).toBeGreaterThan(0);
    expect(feed.notice).toMatch(/dev:api/);
  });

  it('falls back to sample data on 404', async () => {
    globalThis.fetch = vi.fn(async () => makeResponse('not found', 404)) as unknown as typeof fetch;
    const feed = await fetchFeed();
    expect(feed.mock).toBe(true);
    expect(feed.videos.length).toBeGreaterThan(0);
  });

  it('falls back to sample data on a network failure', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    const feed = await fetchFeed();
    expect(feed.mock).toBe(true);
    expect(feed.videos.length).toBeGreaterThan(0);
  });

  it('uses the no-key notice on 503', async () => {
    globalThis.fetch = vi.fn(async () => makeResponse('{"error":"missing_api_key"}', 503)) as unknown as typeof fetch;
    const feed = await fetchFeed();
    expect(feed.mock).toBe(true);
    expect(feed.notice).toMatch(/API key/i);
  });

  it('returns real data when /api responds with a valid feed', async () => {
    globalThis.fetch = vi.fn(async () => makeResponse(validFeedJson)) as unknown as typeof fetch;
    const feed = await fetchFeed();
    expect(feed.mock).toBe(false);
    expect(feed.videos).toHaveLength(1);
    expect(feed.videos[0].id).toBe('real1');
  });
});

describe('fetchLive never errors', () => {
  it('degrades to mock live in dev on failure', async () => {
    globalThis.fetch = vi.fn(async () => makeResponse('nope', 500)) as unknown as typeof fetch;
    const live = await fetchLive();
    // dev fallback returns mock live (which has a live item in the fixtures)
    expect(Array.isArray(live.live)).toBe(true);
  });
});
