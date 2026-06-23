export type WatchStatus = 'seen' | 'completed';

/**
 * One record per watched video. watchedSeconds is the furthest position reached
 * (for completion), NOT total time watched (that lives in daily stats).
 */
export type WatchRecord = {
  videoId: string;
  status: WatchStatus;
  watchedSeconds: number;
  channelKey?: string;
  category?: string;
  durationSeconds?: number;
  // Local only display fields (not part of the Supabase schema), so the History
  // page can render even after a video scrolls out of the feed pool.
  title?: string;
  thumbnailUrl?: string;
  channelLabel?: string;
  firstWatchedAt: string;
  lastWatchedAt: string;
};

export type WatchUpsert = {
  videoId: string;
  status: WatchStatus;
  watchedSeconds?: number;
  channelKey?: string;
  category?: string;
  durationSeconds?: number;
  title?: string;
  thumbnailUrl?: string;
  channelLabel?: string;
};

export type WatchRecords = Record<string, WatchRecord>;
