import { supabase } from './client';
import type { WatchRecord, WatchRecords, WatchStatus } from '../watch/types';

/**
 * Watch state persistence (section 13). Writes go through the upsert_watch_state
 * RPC, which takes the max position and never downgrades completed to seen,
 * server side, so two devices never clobber each other.
 */
export async function pushWatchRecord(record: WatchRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('upsert_watch_state', {
    p_video_id: record.videoId,
    p_status: record.status,
    p_watched_seconds: Math.round(record.watchedSeconds),
    p_channel_key: record.channelKey ?? null,
    p_category: record.category ?? null,
    p_duration_seconds: record.durationSeconds ?? null,
  });
  if (error) throw error;
}

type WatchRow = {
  video_id: string;
  status: string;
  watched_seconds: number | null;
  channel_key: string | null;
  category: string | null;
  duration_seconds: number | null;
  first_watched_at: string;
  last_watched_at: string;
};

/** Pull all watch_state rows for the signed in user (RLS scopes to them). */
export async function pullWatchState(): Promise<WatchRecords> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('watch_state')
    .select('video_id,status,watched_seconds,channel_key,category,duration_seconds,first_watched_at,last_watched_at');
  if (error) throw error;

  const out: WatchRecords = {};
  for (const row of (data ?? []) as WatchRow[]) {
    out[row.video_id] = {
      videoId: row.video_id,
      status: (row.status === 'completed' ? 'completed' : 'seen') as WatchStatus,
      watchedSeconds: row.watched_seconds ?? 0,
      channelKey: row.channel_key ?? undefined,
      category: row.category ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      firstWatchedAt: row.first_watched_at,
      lastWatchedAt: row.last_watched_at,
    };
  }
  return out;
}
