/**
 * Raw YouTube video -> canonical Video. The UI only ever sees the canonical
 * shape (section 8). Returns null when essential fields are missing or the video
 * is from a channel outside our closed pool, so callers can drop it.
 */
import type { Video, LiveState } from './types';
import type { VideoRaw } from './schemas';
import { parseIsoDuration } from './duration';
import { pickThumbnail } from './thumbnails';

export type ChannelLookup = Map<string, { key: string; label: string; category?: string }>;

/** Playlist item titles YouTube uses for removed videos. */
const REMOVED_TITLES = new Set(['Deleted video', 'Private video', 'This video is private']);

export function isRemovedPlaylistTitle(title: string | undefined): boolean {
  return title != null && REMOVED_TITLES.has(title);
}

function resolveLiveState(raw: VideoRaw): LiveState {
  const lbc = raw.snippet?.liveBroadcastContent;
  if (lbc === 'live') return 'live';
  if (lbc === 'upcoming') return 'upcoming';
  // A finished stream reports liveBroadcastContent 'none' and has actualEndTime:
  // it is a normal VOD from here on, so 'none' is correct.
  return 'none';
}

export function normalizeVideo(raw: VideoRaw, channelsById: ChannelLookup): Video | null {
  const channelId = raw.snippet?.channelId;
  if (!channelId) return null;

  const channel = channelsById.get(channelId);
  // Closed pool: a video from a channel we do not track is dropped.
  if (!channel) return null;

  const title = raw.snippet?.title?.trim();
  if (!title) return null;

  const liveState = resolveLiveState(raw);

  // Duration is 0 for live and upcoming (P0D or missing). That is intentional
  // and must not be confused with a real zero length video.
  const durationSeconds = liveState === 'none' ? parseIsoDuration(raw.contentDetails?.duration) : 0;

  const publishedAt =
    raw.snippet?.publishedAt ??
    raw.liveStreamingDetails?.actualStartTime ??
    raw.liveStreamingDetails?.scheduledStartTime ??
    new Date(0).toISOString();

  const region = raw.contentDetails?.regionRestriction;
  const hasRegion = Boolean(region && (region.allowed?.length || region.blocked?.length));

  return {
    id: raw.id,
    channelKey: channel.key,
    channelLabel: channel.label,
    category: channel.category,
    title,
    thumbnailUrl: pickThumbnail(raw.snippet?.thumbnails),
    publishedAt,
    durationSeconds,
    liveState,
    scheduledStartTime:
      liveState === 'upcoming' ? raw.liveStreamingDetails?.scheduledStartTime : undefined,
    // Default to embeddable/public when the field is absent: we request the
    // status part, so absence is rare, and we prefer not to hide good content.
    // Non-embeddable videos that slip through are still handled on the watch page.
    isEmbeddable: raw.status?.embeddable !== false,
    isPublic: raw.status?.privacyStatus ? raw.status.privacyStatus === 'public' : true,
    regionRestriction: hasRegion
      ? { allowed: region?.allowed, blocked: region?.blocked }
      : undefined,
  };
}
