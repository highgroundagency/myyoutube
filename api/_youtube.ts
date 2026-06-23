/**
 * Shared, server side YouTube Data API client (section 6, 7, 10).
 *
 * This module holds all the defensive logic: handle resolution with fallbacks,
 * quota and key detection, transient retry with backoff, chunked videos.list,
 * and mapping results by id (never by index). It imports only pure modules from
 * src (no import.meta.env), so it is safe to run in Node on Vercel.
 *
 * The YouTube API key is passed in explicitly by the callers (which read it from
 * process.env). It never appears in the client bundle.
 */
import { CHANNELS, CHANNELS_BY_KEY, UNRESOLVED_HANDLE, type ChannelConfig } from '../src/config/channels';
import {
  RESOLVE_CACHE_MS,
  UPLOADS_PER_CHANNEL,
  VIDEOS_LIST_CHUNK,
  YT_MAX_RETRIES,
  LIVE_CHECK_CACHE_MS,
} from '../src/config/constants';
import type { ResolvedChannel, Video } from '../src/lib/youtube/types';
import {
  apiErrorSchema,
  channelSchema,
  listResponseSchema,
  parseValidItems,
  playlistItemSchema,
  searchItemSchema,
  videoSchema,
  type ChannelRaw,
  type VideoRaw,
} from '../src/lib/youtube/schemas';
import {
  normalizeVideo,
  normalizeVideoLoose,
  isRemovedPlaylistTitle,
  type ChannelLookup,
} from '../src/lib/youtube/normalize';
import { applyFilters, dedupeById, sortNewestFirst } from '../src/lib/youtube/filters';
import { YouTubeError, classifyYouTubeReason } from '../src/lib/youtube/errors';
import { cacheGet, cacheSet } from './_cache';

const BASE = 'https://www.googleapis.com/youtube/v3';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function firstThumbUrl(thumbnails: Record<string, { url?: string } | undefined> | undefined): string | null {
  if (!thumbnails) return null;
  return thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
}

/** Reads and requires the API key. Throw a typed 503 error if missing. */
export function requireApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !key.trim()) {
    throw new YouTubeError('missingKey', 'YOUTUBE_API_KEY is not set on the server', {
      status: 503,
      retryable: false,
    });
  }
  return key.trim();
}

/**
 * Low level fetch against the YouTube Data API. Retries transient errors (5xx,
 * network) with exponential backoff up to YT_MAX_RETRIES. Never retries 400 or
 * 403 (deterministic: bad request, quota, bad key). Throws a typed YouTubeError.
 */
async function ytFetch(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown> {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey);

  let lastError: YouTubeError | null = null;

  for (let attempt = 0; attempt <= YT_MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        return (await res.json()) as unknown;
      }

      // Non-2xx: read the error body to classify the reason.
      const body = (await res.json().catch(() => null)) as unknown;
      const parsed = apiErrorSchema.safeParse(body);
      const apiReason = parsed.success ? parsed.data.error?.errors?.[0]?.reason : undefined;
      const apiMessage = parsed.success ? parsed.data.error?.message : undefined;
      const { reason, retryable } = classifyYouTubeReason(res.status, apiReason);
      const err = new YouTubeError(
        reason,
        apiMessage ?? `YouTube ${endpoint} failed with status ${res.status}`,
        { status: res.status, retryable },
      );
      if (!retryable) throw err;
      lastError = err;
    } catch (e) {
      if (e instanceof YouTubeError) {
        if (!e.retryable) throw e;
        lastError = e;
      } else {
        // Network or parse error. Treat as transient.
        lastError = new YouTubeError('network', (e as Error)?.message ?? 'network error', {
          retryable: true,
          cause: e,
        });
      }
    }

    if (attempt < YT_MAX_RETRIES) {
      await sleep(Math.min(500 * 2 ** attempt, 4000));
    }
  }

  throw lastError ?? new YouTubeError('unknown', `YouTube ${endpoint} failed`);
}

// ---------------------------------------------------------------------------
// Channel resolution (section 6)
// ---------------------------------------------------------------------------

function failedResolved(config: ChannelConfig): ResolvedChannel {
  return {
    key: config.key,
    handle: config.handle ?? '',
    label: config.label,
    channelId: null,
    uploadsPlaylistId: null,
    title: null,
    thumbnailUrl: null,
    resolvedBy: 'failed',
  };
}

function buildResolved(
  config: ChannelConfig,
  item: ChannelRaw,
  resolvedBy: ResolvedChannel['resolvedBy'],
): ResolvedChannel {
  return {
    key: config.key,
    handle: config.handle ?? '',
    label: config.label,
    channelId: item.id,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    title: item.snippet?.title ?? null,
    thumbnailUrl: firstThumbUrl(item.snippet?.thumbnails),
    resolvedBy,
  };
}

async function channelsListByHandle(handle: string, apiKey: string): Promise<ChannelRaw[]> {
  const data = await ytFetch(
    'channels',
    { part: 'contentDetails,snippet', forHandle: handle },
    apiKey,
  );
  const list = listResponseSchema.safeParse(data);
  return parseValidItems(channelSchema, list.success ? list.data.items : []);
}

async function getChannelById(channelId: string, apiKey: string) {
  const data = await ytFetch('channels', { part: 'contentDetails,snippet', id: channelId }, apiKey);
  const list = listResponseSchema.safeParse(data);
  const items = parseValidItems(channelSchema, list.success ? list.data.items : []);
  return items[0] ?? null;
}

/** Search.list for a channel by name, then load it by id to get the uploads playlist. */
async function resolveBySearch(
  config: ChannelConfig,
  apiKey: string,
): Promise<ResolvedChannel | null> {
  const query = config.searchName ?? config.label;
  const searchData = await ytFetch(
    'search',
    { part: 'snippet', type: 'channel', q: query, maxResults: '1' },
    apiKey,
  );
  const searchList = listResponseSchema.safeParse(searchData);
  const searchItems = parseValidItems(searchItemSchema, searchList.success ? searchList.data.items : []);
  const foundChannelId = searchItems[0]?.id?.channelId ?? searchItems[0]?.snippet?.channelId;
  if (!foundChannelId) return null;

  const byId = await getChannelById(foundChannelId, apiKey);
  if (!byId) return null;
  console.warn(
    `[resolve] channel "${config.key}" resolved by SEARCH ("${query}") to "${byId.snippet?.title ?? '?'}". Verify the title.`,
  );
  return buildResolved(config, byId, 'search');
}

/**
 * Resolve one channel to a channelId + uploads playlist, in priority order:
 * 1. channelId: channels.list?id, optionally verified against expectedTitleIncludes
 *    (falls back to search if the title does not match).
 * 2. handle: channels.list?forHandle, then a no-@ retry.
 * 3. search.list by searchName or label.
 * 4. failed (skipped in the feed, reported).
 *
 * Quota and key errors propagate so the caller can surface them. Other failures
 * for a single channel resolve to "failed" rather than crashing the whole feed.
 */
export async function resolveChannel(config: ChannelConfig, apiKey: string): Promise<ResolvedChannel> {
  // 1. Direct by channelId (most reliable).
  if (config.channelId) {
    const byId = await getChannelById(config.channelId, apiKey);
    if (byId) {
      const title = byId.snippet?.title ?? '';
      const ok =
        !config.expectedTitleIncludes ||
        title.toLowerCase().includes(config.expectedTitleIncludes.toLowerCase());
      if (ok) return buildResolved(config, byId, 'id');
      console.warn(
        `[resolve] channel "${config.key}" id ${config.channelId} returned "${title}", expected "${config.expectedTitleIncludes}". Falling back to search.`,
      );
    } else {
      console.warn(`[resolve] channel "${config.key}" id ${config.channelId} did not resolve. Falling back.`);
    }
    // Title mismatch or missing: fall back to search by the configured name.
    const bySearch = await resolveBySearch(config, apiKey);
    return bySearch ?? failedResolved(config);
  }

  // 2. Handle resolution (skip the placeholder).
  if (config.handle && config.handle !== UNRESOLVED_HANDLE) {
    let items = await channelsListByHandle(config.handle, apiKey);
    if (items[0]) return buildResolved(config, items[0], 'handle');

    const noAt = config.handle.replace(/^@/, '');
    if (noAt !== config.handle) {
      items = await channelsListByHandle(noAt, apiKey);
      if (items[0]) return buildResolved(config, items[0], 'handle-no-at');
    }
  }

  // 3. Search fallback by name (also the path for channels with no handle).
  const bySearch = await resolveBySearch(config, apiKey);
  if (bySearch) return bySearch;

  // 4. Could not resolve.
  console.warn(`[resolve] channel "${config.key}" could not be resolved. Skipping.`);
  return failedResolved(config);
}

/** Resolve every configured channel, cached for a warm instance. */
export async function resolveAllChannels(apiKey: string): Promise<ResolvedChannel[]> {
  const cached = cacheGet<ResolvedChannel[]>('resolved');
  if (cached) return cached;

  const settled = await Promise.allSettled(CHANNELS.map((c) => resolveChannel(c, apiKey)));
  const resolved: ResolvedChannel[] = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const config = CHANNELS[i];
    if (result.status === 'fulfilled') {
      resolved.push(result.value);
    } else {
      const err = result.reason;
      // A quota or key problem is global: surface it so the feed can react.
      if (err instanceof YouTubeError && (err.isQuota || err.isKeyProblem)) throw err;
      console.error(`[resolve] unexpected failure for ${config.key}:`, err);
      resolved.push(failedResolved(config));
    }
  }

  cacheSet('resolved', resolved, RESOLVE_CACHE_MS);
  return resolved;
}

// ---------------------------------------------------------------------------
// Uploads and details (section 7)
// ---------------------------------------------------------------------------

/** Newest uploads for a channel. Skips deleted and private placeholder items. */
async function fetchRecentUploadIds(uploadsPlaylistId: string, apiKey: string): Promise<string[]> {
  const data = await ytFetch(
    'playlistItems',
    { part: 'contentDetails,snippet', playlistId: uploadsPlaylistId, maxResults: String(UPLOADS_PER_CHANNEL) },
    apiKey,
  );
  const list = listResponseSchema.safeParse(data);
  const items = parseValidItems(playlistItemSchema, list.success ? list.data.items : []);

  const ids: string[] = [];
  for (const item of items) {
    if (isRemovedPlaylistTitle(item.snippet?.title)) continue;
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
    if (videoId) ids.push(videoId);
  }
  return ids;
}

/**
 * Fetch full details for video ids, chunked to 50 per call, mapped by id.
 * Chunks run in parallel: with ~200 videos that is 1 round trip instead of 5,
 * which keeps the function well under the serverless time limit.
 */
async function fetchVideoDetails(ids: string[], apiKey: string): Promise<Map<string, VideoRaw>> {
  const byId = new Map<string, VideoRaw>();
  const groups = chunk(ids, VIDEOS_LIST_CHUNK).filter((g) => g.length > 0);

  const responses = await Promise.all(
    groups.map((group) =>
      ytFetch(
        'videos',
        {
          part: 'contentDetails,snippet,liveStreamingDetails,status',
          id: group.join(','),
          maxResults: String(VIDEOS_LIST_CHUNK),
        },
        apiKey,
      ),
    ),
  );

  for (const data of responses) {
    const list = listResponseSchema.safeParse(data);
    const items = parseValidItems(videoSchema, list.success ? list.data.items : []);
    // Map by id. videos.list may omit ids (deleted, private, region blocked) and
    // may reorder them, so never trust array position.
    for (const item of items) byId.set(item.id, item);
  }
  return byId;
}

function channelLookupFrom(resolved: ResolvedChannel[]): ChannelLookup {
  const map: ChannelLookup = new Map();
  for (const rc of resolved) {
    if (!rc.channelId) continue;
    map.set(rc.channelId, {
      key: rc.key,
      label: rc.label,
      category: CHANNELS_BY_KEY[rc.key]?.category,
    });
  }
  return map;
}

/** Run the full feed pipeline and return canonical, filtered, sorted videos. */
export async function buildFeed(apiKey: string): Promise<{ videos: Video[]; resolvedChannels: ResolvedChannel[] }> {
  const resolved = await resolveAllChannels(apiKey);
  const lookup = channelLookupFrom(resolved);

  const withUploads = resolved.filter((r) => r.uploadsPlaylistId);
  const idGroups = await Promise.all(
    withUploads.map((r) =>
      fetchRecentUploadIds(r.uploadsPlaylistId as string, apiKey).catch((e) => {
        // One channel failing must not kill the whole feed.
        if (e instanceof YouTubeError && (e.isQuota || e.isKeyProblem)) throw e;
        console.error(`[feed] uploads failed for ${r.key}:`, e);
        return [] as string[];
      }),
    ),
  );

  const allIds = Array.from(new Set(idGroups.flat()));
  const details = await fetchVideoDetails(allIds, apiKey);

  const normalized: Video[] = [];
  for (const id of allIds) {
    const rawVideo = details.get(id);
    if (!rawVideo) continue; // videos.list omitted it: deleted, private, or region blocked.
    const video = normalizeVideo(rawVideo, lookup);
    if (video) normalized.push(video);
  }

  const { videos: filtered } = applyFilters(normalized);
  const videos = sortNewestFirst(dedupeById(filtered));

  return { videos, resolvedChannels: resolved };
}

/** Fetch a single video by id (on demand watch links, section 11). */
export async function getVideoById(apiKey: string, id: string): Promise<Video | null> {
  const details = await fetchVideoDetails([id], apiKey);
  const raw = details.get(id);
  if (!raw) return null;

  const resolved = await resolveAllChannels(apiKey);
  const lookup = channelLookupFrom(resolved);
  // Prefer the pool-scoped normalize; fall back to loose so a valid direct link
  // (an older upload, or a guest video) still plays.
  return normalizeVideo(raw, lookup) ?? normalizeVideoLoose(raw);
}

// ---------------------------------------------------------------------------
// Live detection (section 10)
// ---------------------------------------------------------------------------

/** Live video ids for a channel, cross checked with videos.list. Cached short. */
async function checkLiveForChannel(channelId: string, apiKey: string): Promise<VideoRaw[]> {
  const cacheKey = `live:${channelId}`;
  const cached = cacheGet<VideoRaw[]>(cacheKey);
  if (cached) return cached;

  // search.list eventType=live costs 100 units, hence the short cache.
  const data = await ytFetch(
    'search',
    { part: 'snippet', channelId, eventType: 'live', type: 'video', maxResults: '5' },
    apiKey,
  );
  const list = listResponseSchema.safeParse(data);
  const items = parseValidItems(searchItemSchema, list.success ? list.data.items : []);
  const candidateIds = items.map((i) => i.id?.videoId).filter((v): v is string => Boolean(v));

  let confirmed: VideoRaw[] = [];
  if (candidateIds.length > 0) {
    // Cross check: the search index can lag, so confirm via videos.list.
    const details = await fetchVideoDetails(candidateIds, apiKey);
    confirmed = candidateIds
      .map((id) => details.get(id))
      .filter((v): v is VideoRaw => Boolean(v) && v!.snippet?.liveBroadcastContent === 'live');
  }

  cacheSet(cacheKey, confirmed, LIVE_CHECK_CACHE_MS);
  return confirmed;
}

/** Live videos across all channels marked liveCheck. */
export async function getLiveVideos(apiKey: string): Promise<Video[]> {
  const resolved = await resolveAllChannels(apiKey);
  const lookup = channelLookupFrom(resolved);
  const liveChannels = resolved.filter(
    (r) => r.channelId && CHANNELS_BY_KEY[r.key]?.liveCheck,
  );

  const live: Video[] = [];
  for (const rc of liveChannels) {
    try {
      const raws = await checkLiveForChannel(rc.channelId as string, apiKey);
      for (const raw of raws) {
        const v = normalizeVideo(raw, lookup);
        if (v) live.push({ ...v, liveState: 'live' });
      }
    } catch (e) {
      if (e instanceof YouTubeError && (e.isQuota || e.isKeyProblem)) throw e;
      console.error(`[live] check failed for ${rc.key}:`, e);
    }
  }
  return sortNewestFirst(dedupeById(live));
}
