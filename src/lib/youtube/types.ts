/**
 * Canonical, trusted types used by the entire UI. The UI never touches raw
 * YouTube API shapes: everything is normalized into these first (section 8).
 */

export type LiveState = 'none' | 'live' | 'upcoming';

export type RegionRestriction = {
  /** If present, the video is allowed ONLY in these region codes. */
  allowed?: string[];
  /** If present, the video is blocked in these region codes. */
  blocked?: string[];
};

export type Video = {
  id: string;
  /** Internal channel key from our config (mapped from channelId). */
  channelKey: string;
  channelLabel: string;
  category?: string;
  title: string;
  /** Best available thumbnail. Never empty (falls back to a local placeholder). */
  thumbnailUrl: string;
  /** ISO 8601 timestamp. */
  publishedAt: string;
  /** Seconds. 0 means unknown (live or upcoming), not a zero length video. */
  durationSeconds: number;
  liveState: LiveState;
  /** ISO 8601 start time for upcoming streams. */
  scheduledStartTime?: string;
  /** From status.embeddable. Non-embeddable videos are filtered out of the feed. */
  isEmbeddable: boolean;
  /** privacyStatus === 'public'. */
  isPublic: boolean;
  /** Passed through so the watch page can show a region friendly message. */
  regionRestriction?: RegionRestriction;
};

/** How a channel handle was resolved (for the resolution report and feed payload). */
export type ResolveMethod = 'handle' | 'handle-no-at' | 'search' | 'failed';

export type ResolvedChannel = {
  key: string;
  handle: string;
  label: string;
  channelId: string | null;
  uploadsPlaylistId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  resolvedBy: ResolveMethod;
};

/** Response shape of GET /api/feed. */
export type FeedResponse = {
  videos: Video[];
  /** True when serving cached or fallback data (for example on quota exhaustion). */
  stale: boolean;
  /** True when the data came from fixtures (MOCK_MODE). */
  mock: boolean;
  /** Optional quiet notice, for example "showing cached content". */
  notice: string | null;
  resolvedChannels: ResolvedChannel[];
};

/** Response shape of GET /api/live. */
export type LiveResponse = {
  live: Video[];
  stale: boolean;
  mock: boolean;
  /** ISO timestamp of when the check ran. */
  checkedAt: string;
};
