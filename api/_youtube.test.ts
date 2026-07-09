import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildFeed, getLiveVideos } from './_youtube';
import { cacheClear } from './_cache';
import { YouTubeError } from '../src/lib/youtube/errors';

const API_KEY = 'test-key';

type MockConfig = { videosStatus: number; liveSearchVideoId: string | null };
let cfg: MockConfig;

function jsonRes(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

// id shape: v_<channelKey>_<kind>. The kind is the LAST segment so channel keys
// containing underscores (e.g. the oscar_patel handle) keep working.
function makeVideo(id: string): unknown {
  const parts = id.split('_');
  const kind = parts.length > 2 ? parts[parts.length - 1] : 'long';
  const key = parts.length > 2 ? parts.slice(1, -1).join('_') : (parts[1] ?? 'x');
  if (kind === 'omit') return null; // videos.list deliberately omits this id

  // The date is after MrBeast's new-only cutoff so the pipeline test is not
  // filtered by curation (curation drop logic is unit tested separately).
  const title = `${key} ${kind}`;
  const snippet: Record<string, unknown> = {
    channelId: `UC_${key}`,
    title,
    publishedAt: '2026-06-28T10:00:00.000Z',
    liveBroadcastContent: kind === 'live' ? 'live' : 'none',
    thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
  };
  return {
    id,
    snippet,
    contentDetails: { duration: kind === 'short' ? 'PT30S' : kind === 'live' ? 'P0D' : 'PT12M' },
    status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' },
  };
}

function installFetchMock() {
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const ep = url.pathname.split('/').pop();
    const sp = url.searchParams;

    if (ep === 'channels') {
      const forHandle = sp.get('forHandle');
      const id = sp.get('id');
      const raw = forHandle ?? id ?? '';
      const key = raw.replace(/^@/, '').toLowerCase();
      // The Andrew Farley id must report the expected teaching channel title so
      // the id-with-title-verification path succeeds.
      const title =
        id === 'UCngAqvQikHu7RF9kVs8M29g' ? 'The Grace Message with Dr. Andrew Farley' : raw;
      return jsonRes({
        items: [
          {
            id: `UC_${key}`,
            snippet: { title, thumbnails: { default: { url: 't' } } },
            contentDetails: { relatedPlaylists: { uploads: `UU_${key}` } },
          },
        ],
      });
    }

    if (ep === 'playlistItems') {
      const key = (sp.get('playlistId') ?? '').replace(/^UU_/, '');
      return jsonRes({
        items: [
          { contentDetails: { videoId: `v_${key}_long` }, snippet: { title: 'Long', publishedAt: '2026-06-20T10:00:00Z' } },
          { snippet: { title: 'Deleted video' } }, // skipped, no id
          { snippet: { title: 'Private video' } }, // skipped, no id
          { contentDetails: { videoId: `v_${key}_short` }, snippet: { title: 'Short' } },
          { contentDetails: { videoId: `v_${key}_omit` }, snippet: { title: 'Omitted' } },
        ],
      });
    }

    if (ep === 'videos') {
      if (cfg.videosStatus !== 200) {
        return jsonRes(
          { error: { code: cfg.videosStatus, message: 'quota', errors: [{ reason: 'quotaExceeded' }] } },
          cfg.videosStatus,
        );
      }
      const ids = (sp.get('id') ?? '').split(',').filter(Boolean);
      const items = ids.map(makeVideo).filter((v) => v !== null);
      return jsonRes({ items });
    }

    if (ep === 'search') {
      // Channel resolution search (type=channel).
      if (sp.get('type') === 'channel') {
        const q = sp.get('q') ?? '';
        const key = q.toLowerCase().replace(/[^a-z0-9]/g, '');
        return jsonRes({ items: [{ id: { channelId: `UCs${key}` }, snippet: { title: q, channelId: `UCs${key}` } }] });
      }
      // Live check search (type=video, eventType=live).
      if (cfg.liveSearchVideoId) {
        return jsonRes({ items: [{ id: { videoId: cfg.liveSearchVideoId }, snippet: { channelId: 'UC_cazetv' } }] });
      }
      return jsonRes({ items: [] });
    }

    return jsonRes({}, 404);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  cfg = { videosStatus: 200, liveSearchVideoId: null };
  cacheClear();
  installFetchMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildFeed', () => {
  it('resolves channels, filters Shorts, skips deleted/private and omitted ids', async () => {
    const { videos, resolvedChannels } = await buildFeed(API_KEY);

    // Only long form survives (Shorts dropped, omitted ids skipped).
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.every((v) => v.durationSeconds === 720)).toBe(true);
    expect(videos.some((v) => v.id.endsWith('_short'))).toBe(false);
    expect(videos.some((v) => v.id.endsWith('_omit'))).toBe(false);

    // Andrew Farley resolves by id (title verified).
    const andrew = resolvedChannels.find((c) => c.key === 'andrewfarley');
    expect(andrew?.resolvedBy).toBe('id');
    expect(andrew?.title).toBe('The Grace Message with Dr. Andrew Farley');

    // All seven channels resolve and each contributes one long form video.
    // Both MrBeast channels survive their new-only rule (recent mock date), and
    // the two health channels resolve (handle with underscore; id + search).
    expect(videos.some((v) => v.channelKey === 'mrbeast')).toBe(true);
    expect(videos.some((v) => v.channelKey === 'oscarpatel')).toBe(true);
    expect(videos.some((v) => v.channelKey === 'mikemew')).toBe(true);
    expect(videos.length).toBe(7);
  });

  it('throws a quota error (not a raw 500) when videos.list is rate limited', async () => {
    cfg.videosStatus = 403;
    await expect(buildFeed(API_KEY)).rejects.toMatchObject({ name: 'YouTubeError' });
    try {
      await buildFeed(API_KEY);
    } catch (e) {
      expect(e).toBeInstanceOf(YouTubeError);
      expect((e as YouTubeError).isQuota).toBe(true);
    }
  });
});

describe('getLiveVideos', () => {
  it('returns nothing when no channel opts into the live check (current config)', async () => {
    // Caze TV (the only liveCheck channel) was removed from the pool. Even with
    // a live result sitting in the search index, no channel is checked.
    cfg.liveSearchVideoId = 'v_josephprince_live';
    const live = await getLiveVideos(API_KEY);
    expect(live).toHaveLength(0);
  });
});
