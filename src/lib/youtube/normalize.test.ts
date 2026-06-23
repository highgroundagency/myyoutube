import { describe, it, expect } from 'vitest';
import { videoSchema, parseValidItems } from './schemas';
import { normalizeVideo, type ChannelLookup } from './normalize';
import { applyFilters, isShort, sortNewestFirst } from './filters';
import { PLACEHOLDER_THUMBNAIL } from './thumbnails';

const channels: ChannelLookup = new Map([
  ['UC_mrbeast', { key: 'mrbeast', label: 'MrBeast', category: 'entertainment' }],
  ['UC_caze', { key: 'cazetv', label: 'Caze TV', category: 'sports' }],
]);

function raw(overrides: Record<string, unknown>) {
  return {
    id: 'vid1',
    snippet: { channelId: 'UC_mrbeast', title: 'A Long Form Video', publishedAt: '2026-06-20T10:00:00Z' },
    contentDetails: { duration: 'PT12M30S' },
    status: { embeddable: true, privacyStatus: 'public' },
    ...overrides,
  };
}

describe('normalizeVideo', () => {
  it('normalizes a standard long form video', () => {
    const v = normalizeVideo(raw({}), channels);
    expect(v).not.toBeNull();
    expect(v!.channelKey).toBe('mrbeast');
    expect(v!.durationSeconds).toBe(750);
    expect(v!.liveState).toBe('none');
    expect(v!.isEmbeddable).toBe(true);
  });

  it('drops videos from channels outside the pool', () => {
    const v = normalizeVideo(raw({ snippet: { channelId: 'UC_unknown', title: 'x', publishedAt: '2026-06-20T10:00:00Z' } }), channels);
    expect(v).toBeNull();
  });

  it('treats live as duration 0 and liveState live', () => {
    const v = normalizeVideo(
      raw({
        snippet: { channelId: 'UC_caze', title: 'AO VIVO', liveBroadcastContent: 'live', publishedAt: '2026-06-23T10:00:00Z' },
        contentDetails: { duration: 'P0D' },
      }),
      channels,
    );
    expect(v!.liveState).toBe('live');
    expect(v!.durationSeconds).toBe(0);
  });

  it('marks upcoming with a scheduled start time', () => {
    const v = normalizeVideo(
      raw({
        snippet: { channelId: 'UC_caze', title: 'Premiere', liveBroadcastContent: 'upcoming', publishedAt: '2026-06-23T10:00:00Z' },
        contentDetails: {},
        liveStreamingDetails: { scheduledStartTime: '2026-06-24T22:00:00Z' },
      }),
      channels,
    );
    expect(v!.liveState).toBe('upcoming');
    expect(v!.scheduledStartTime).toBe('2026-06-24T22:00:00Z');
  });

  it('passes through region restrictions and falls back the thumbnail', () => {
    const v = normalizeVideo(
      raw({ contentDetails: { duration: 'PT20M', regionRestriction: { blocked: ['BR'] } } }),
      channels,
    );
    expect(v!.regionRestriction?.blocked).toContain('BR');
    expect(v!.thumbnailUrl).toBe(PLACEHOLDER_THUMBNAIL);
  });
});

describe('applyFilters', () => {
  it('drops shorts, non-embeddable, and non-public, keeps long form and live', () => {
    const items = [
      raw({ id: 'long', contentDetails: { duration: 'PT12M' } }),
      raw({ id: 'short', contentDetails: { duration: 'PT45S' } }),
      raw({ id: 'noembed', status: { embeddable: false, privacyStatus: 'public' } }),
      raw({ id: 'private', status: { embeddable: true, privacyStatus: 'unlisted' } }),
      raw({ id: 'live', snippet: { channelId: 'UC_caze', title: 'Live', liveBroadcastContent: 'live', publishedAt: '2026-06-23T10:00:00Z' }, contentDetails: { duration: 'P0D' } }),
    ];
    const parsed = parseValidItems(videoSchema, items);
    const normalized = parsed.map((r) => normalizeVideo(r, channels)).filter((v): v is NonNullable<typeof v> => v !== null);
    const { videos, stats } = applyFilters(normalized);
    const ids = videos.map((v) => v.id).sort();
    expect(ids).toEqual(['live', 'long']);
    expect(stats.shorts).toBe(1);
    expect(stats.nonEmbeddable).toBe(1);
    expect(stats.nonPublic).toBe(1);
  });

  it('does not treat a live video (duration 0) as a short', () => {
    const live = normalizeVideo(
      raw({ snippet: { channelId: 'UC_caze', title: 'Live', liveBroadcastContent: 'live', publishedAt: '2026-06-23T10:00:00Z' }, contentDetails: { duration: 'P0D' } }),
      channels,
    );
    expect(isShort(live!)).toBe(false);
  });
});

describe('sortNewestFirst', () => {
  it('orders by publishedAt descending', () => {
    const a = normalizeVideo(raw({ id: 'a', snippet: { channelId: 'UC_mrbeast', title: 'A', publishedAt: '2026-06-01T00:00:00Z' } }), channels)!;
    const b = normalizeVideo(raw({ id: 'b', snippet: { channelId: 'UC_mrbeast', title: 'B', publishedAt: '2026-06-10T00:00:00Z' } }), channels)!;
    expect(sortNewestFirst([a, b]).map((v) => v.id)).toEqual(['b', 'a']);
  });
});
