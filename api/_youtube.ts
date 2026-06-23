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
import { normalizeVideo, isRemovedPlaylistTitle, type ChannelLookup } from '../src/lib/youtube/normalize';
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
    handle: config.handle,
    label: config.label,
    channelId: null,
    uploadsPlaylistId: null,
    title: null,
    thumbnailUrl: null,
    resolvedBy: 'failed',
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

/**
 * Resolve one channel handle to a channelId + uploads playlist, with fallbacks:
 * 1. channels.list forHandle=@handle
 * 2. retry without the leading @
 * 3. search.list type=channel q=label (logged, may be wrong)
 * 4. failed (skipped in the feed, reported)
 *
 * Quota and key errors propagate so the caller can surface them. Other failures
 * for a single channel resolve to "failed" rather than crashing the whole feed.
 */
export async function resolveChannel(config: ChannelConfig, apiKey: string): Promise<ResolvedChannel> {
  // Placeholder handle: do not spend quota, it cannot resolve.
  if (config.handle === UNRESOLVED_HANDLE) {
    return failedResolved(config);
  }

  const buildFrom = (item: ChannelRaw, resolvedBy: ResolvedChannel['resolvedBy']): ResolvedChannel => ({
    key: config.key,
    handle: config.handle,
    label: config.label,
    channelId: item.id,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    title: item.snippet?.title ?? null,
    thumbnailUrl: firstThumbUrl(item.snippet?.thumbnails),
    resolvedBy,
  });

  // 1. With the @ as configured.
  let items = await channelsListByHandle(config.handle, apiKey);
  if (items[0]) return buildFrom(items[0], 'handle');

  // 2. Without the leading @.
  const noAt = config.handle.replace(/^@/, '');
  if (noAt !== config.handle) {
    items = await channelsListByHandle(noAt, apiKey);
    if (items[0]) return buildFrom(items[0], 'handle-no-at');
  }

  // 3. Search fallback. Costs 100 units, and may pick the wrong channel.
  const searchData = await ytFetch(
    'search',
    { part: 'snippet', type: 'channel', q: config.label, maxResults: '1' },
    apiKey,
  );
  const searchList = listResponseSchema.safeParse(searchData);
  const searchItems = parseValidItems(searchItemSchema, searchList.success ? searchList.data.items : []);
  const foundChannelId = searchItems[0]?.id?.channelId ?? searchItems[0]?.snippet?.channelId;
  if (foundChannelId) {
    console.warn(
      `[resolve] channel "${config.key}" resolved by SEARCH (handle ${config.handle} did not match). Verify this is correct.`,
    );
    const byId = await getChannelById(foundChannelId, apiKey);
    if (byId) return buildFrom(byId, 'search');
  }

  // 4. Could not resolve.
  console.warn(`[resolve] channel "${config.key}" (${config.handle}) could not be resolved. Skipping.`);
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

/** Fetch full details for video ids, chunked to 50 per call, mapped by id. */
async function fetchVideoDetails(ids: string[], apiKey: string): Promise<Map<string, VideoRaw>> {
  const byId = new Map<string, VideoRaw>();
  for (const group of chunk(ids, VIDEOS_LIST_CHUNK)) {
    if (group.length === 0) continue;
    const data = await ytFetch(
      'videos',
      {
        part: 'contentDetails,snippet,liveStreamingDetails,status',
        id: group.join(','),
        maxResults: String(VIDEOS_LIST_CHUNK),
      },
      apiKey,
    );
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
