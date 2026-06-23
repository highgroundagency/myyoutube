import { format } from 'date-fns';

export type WatchStatus = 'seen' | 'completed';

/**
 * One record per watched video. watchedSeconds is the furthest position reached
 * (for completion), NOT total time watched (that lives in daily stats). This is
 * the same shape from the original spec, minus the user_id field, since storage
 * is now local to this device.
 */
export type WatchRecord = {
  videoId: string;
  status: WatchStatus;
  watchedSeconds: number;
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

/** Local date key (yyyy-MM-dd) in the viewer's timezone, NOT UTC (section 14). */
export function localDayKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}
