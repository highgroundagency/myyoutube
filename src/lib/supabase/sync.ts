import { watchStore } from '../watch/watchStore';
import { dailyStatsStore } from '../stats/dailyStatsStore';
import { pushWatchRecord, pullWatchState } from './watchState';
import { incrementDailyStats, pullDailyStats } from './stats';
import { enqueue, flushQueue, type FlushHandlers } from './offlineQueue';
import type { WatchRecords } from '../watch/types';

const flushHandlers: FlushHandlers = {
  sendWatch: pushWatchRecord,
  sendStats: incrementDailyStats,
};

function later(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}
function earlier(a: string, b: string): string {
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

/** Merge remote watch records into local: max position, never downgrade. */
function mergeWatch(local: WatchRecords, remote: WatchRecords): WatchRecords {
  const out: WatchRecords = { ...local };
  for (const [id, r] of Object.entries(remote)) {
    const l = out[id];
    if (!l) {
      out[id] = r;
      continue;
    }
    out[id] = {
      ...l,
      status: l.status === 'completed' || r.status === 'completed' ? 'completed' : 'seen',
      watchedSeconds: Math.max(l.watchedSeconds, r.watchedSeconds),
      channelKey: l.channelKey ?? r.channelKey,
      category: l.category ?? r.category,
      durationSeconds: l.durationSeconds ?? r.durationSeconds,
      firstWatchedAt: earlier(l.firstWatchedAt, r.firstWatchedAt),
      lastWatchedAt: later(l.lastWatchedAt, r.lastWatchedAt),
    };
  }
  return out;
}

/** On login, reconcile local and remote, then flush any queued offline writes. */
export async function syncOnLogin(): Promise<void> {
  const [remoteWatch, remoteStats] = await Promise.all([pullWatchState(), pullDailyStats()]);

  // Watch state: merge and push anything where local is ahead of remote.
  const local = watchStore.getSnapshot();
  const merged = mergeWatch(local, remoteWatch);
  watchStore.replaceAll(merged);
  for (const [id, rec] of Object.entries(merged)) {
    const r = remoteWatch[id];
    if (!r || rec.watchedSeconds > r.watchedSeconds || rec.status !== r.status) {
      try {
        await pushWatchRecord(rec);
      } catch {
        await enqueue({ kind: 'watch', record: rec });
      }
    }
  }

  // Daily stats: remote is authoritative for committed deltas, the offline queue
  // holds any local deltas not yet sent. Apply remote, flush queue, re-pull.
  dailyStatsStore.replaceAll(remoteStats);
  await flushQueue(flushHandlers);
  try {
    dailyStatsStore.replaceAll(await pullDailyStats());
  } catch {
    // Keep what we have if the re-pull fails.
  }
}

/**
 * Install handlers so future local writes mirror to Supabase (offline safe).
 *
 * DECISION: on a write failure we queue and retry rather than roll back the
 * optimistic local update. The local store is the source of truth on the client,
 * and rolling back would discard the user's explicit action (and watch progress).
 * Queue-and-retry honors the "watch progress must never be lost" requirement.
 */
export function installSyncHandlers(): void {
  watchStore.setSyncHandler((record) => {
    pushWatchRecord(record).catch(() => enqueue({ kind: 'watch', record }));
  });
  dailyStatsStore.setSyncHandler((day, seconds, completed) => {
    incrementDailyStats(day, seconds, completed).catch(() =>
      enqueue({ kind: 'stats', day, seconds, completed }),
    );
  });
}

export function removeSyncHandlers(): void {
  watchStore.setSyncHandler(null);
  dailyStatsStore.setSyncHandler(null);
}

export async function flushOffline(): Promise<void> {
  await flushQueue(flushHandlers);
}
