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

// id shape: v_<channelKey>_<kind>
function makeVideo(id: string): unknown {
  const parts = id.split('_');
  const key = parts[1] ?? 'x';
  const kind = parts[2] ?? 'long';
  if (kind === 'omit') return null; // videos.list deliberately omits this id

  // Caze TV is curated to "melhores momentos" only, so give its videos a
  // matching title. The date is after MrBeast's new-only cutoff so the pipeline
  // test is not filtered by curation (curation drop logic is unit tested).
  const title = key === 'cazetv' ? `Melhores Momentos: ${key} ${kind}` : `${key} ${kind}`;
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

    // All six channels resolve and each contributes one long form video. MrBeast
    // survives its new-only rule (recent date) and Caze TV survives its title
    // rule (the mock titles it "Melhores Momentos").
    expect(videos.some((v) => v.channelKey === 'mrbeast')).toBe(true);
    expect(videos.some((v) => v.channelKey === 'cazetv')).toBe(true);
    expect(videos.length).toBe(6);
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
  it('returns a live stream confirmed by videos.list cross check', async () => {
    cfg.liveSearchVideoId = 'v_cazetv_live';
    const live = await getLiveVideos(API_KEY);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe('v_cazetv_live');
    expect(live[0].liveState).toBe('live');
    expect(live[0].channelKey).toBe('cazetv');
  });

  it('returns nothing live when the search index is empty', async () => {
    cfg.liveSearchVideoId = null;
    const live = await getLiveVideos(API_KEY);
    expect(live).toHaveLength(0);
  });
});
