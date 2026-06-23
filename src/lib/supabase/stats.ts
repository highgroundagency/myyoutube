import { supabase } from './client';
import type { DailyStats } from '../stats/dailyStatsStore';

/**
 * Daily stats persistence (section 13, 14). Watch seconds are applied with the
 * atomic increment RPC so concurrent device writes never clobber each other.
 * We never read-modify-write from the client.
 */
export async function incrementDailyStats(
  day: string,
  seconds: number,
  completed: number,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('increment_daily_stats', {
    p_day: day,
    p_seconds: Math.round(seconds),
    p_completed: Math.round(completed),
  });
  if (error) throw error;
}

type StatRow = { day: string; watch_seconds: number | null; videos_completed: number | null };

/** Pull all daily_stats rows for the signed in user. */
export async function pullDailyStats(): Promise<DailyStats> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('daily_stats')
    .select('day,watch_seconds,videos_completed');
  if (error) throw error;

  const out: DailyStats = {};
  for (const row of (data ?? []) as StatRow[]) {
    out[row.day] = {
      day: row.day,
      watchSeconds: row.watch_seconds ?? 0,
      videosCompleted: row.videos_completed ?? 0,
    };
  }
  return out;
}
