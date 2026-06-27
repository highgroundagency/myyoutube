import { format } from 'date-fns';

export type WatchStatus = 'seen' | 'completed';

/**
 * One record per watched video. watchedSeconds is the furthest position reached
 * (for completion), NOT total time watched (that lives in daily stats). This is
 * the same shape from the original spec, minus the user_id field, since storage
 * is now local to this device.
 *
 * lastPositionSeconds is where playback was last left off (the resume point for
 * "continue watching"). It differs from watchedSeconds when the viewer scrubs
 * back: watchedSeconds only grows, lastPositionSeconds follows the real cursor.
 */
export type WatchRecord = {
  videoId: string;
  status: WatchStatus;
  watchedSeconds: number;
  /** Where playback was last, in seconds, for the resume point. Latest wins. */
  lastPositionSeconds?: number;
  /** Set when the viewer dismissed this from the "continue watching" rail. */
  resumeDismissed?: boolean;
  channelKey?: string;
  category?: string;
  durationSeconds?: number;
  title?: string;
  thumbnailUrl?: string;
  channelLabel?: string;
  firstWatchedAt: string;
  lastWatchedAt: string;
};

export type WatchRecords = Record<string, WatchRecord>;

export type WatchUpsert = {
  videoId: string;
  status: WatchStatus;
  watchedSeconds?: number;
  /** Latest playback position. When set, it also clears resumeDismissed. */
  lastPositionSeconds?: number;
  /** Explicitly set the dismissed flag (wins over the auto-clear above). */
  resumeDismissed?: boolean;
  channelKey?: string;
  category?: string;
  durationSeconds?: number;
  title?: string;
  thumbnailUrl?: string;
  channelLabel?: string;
};

/** One row per local day. watchSeconds is real time watched that day. */
export type DailyStat = { day: string; watchSeconds: number; videosCompleted: number };
export type DailyStats = Record<string, DailyStat>;

/**
 * Small device-local settings bag. quitDate anchors the "time saved from
 * YouTube" counter: the local day (yyyy-MM-dd) the viewer switched away from the
 * YouTube feed. Optional, so the UI can fall back to the earliest stats day.
 */
export type AppMeta = { quitDate?: string };

/** Local date key (yyyy-MM-dd) in the viewer's timezone, NOT UTC (section 14). */
export function localDayKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}
