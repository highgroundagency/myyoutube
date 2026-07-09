/**
 * Conflict-free merging for cross-device sync (single user, many devices).
 *
 * The cloud stores ONE SLICE PER DEVICE; nothing is ever merged in the cloud.
 * Each device only writes its own slice and merges everyone's slices locally:
 *
 *  - Watch records merge per field: progress only grows (max), the resume
 *    cursor and flags follow the most recent activity, completed never
 *    downgrades, firstWatchedAt keeps the earliest.
 *  - Deletions are tombstones: a record removed on one device stays removed
 *    everywhere unless it is watched again AFTER the removal.
 *  - Daily stats stay strictly per device and are SUMMED per day for display
 *    (20 min on the phone + 10 min on the laptop = 30 min that day). A device
 *    never absorbs another device's stats into its own slice, so re-syncing
 *    can never double count.
 *  - quitDate (time-saved anchor): the most recent explicit edit wins.
 *  - Marathon snoozes: per video, the most recent snooze wins.
 *
 * Everything here is pure and deterministic: merge(a, b) === merge(b, a).
 */
import type { AppMeta, DailyStats, Deletions, WatchRecord, WatchRecords } from '../persistence/types';

/** What one device contributes to the cloud. */
export type DeviceSlice = {
  updatedAt: string;
  watch: WatchRecords;
  deletions: Deletions;
  /** ONLY this device's own accrued stats. */
  stats: DailyStats;
  meta: AppMeta;
  /** Marathon "assistir depois" map (videoId -> ISO). */
  snoozes: Record<string, string>;
};

export type SyncDevices = Record<string, DeviceSlice>;

/** Keep tombstones for this long; after that a deletion is considered settled. */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const ts = (iso: string | undefined): number => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
};

/** Newer-activity-wins-per-field merge of the same video's two records. */
export function mergeWatchRecord(a: WatchRecord, b: WatchRecord): WatchRecord {
  const [older, newer] = ts(a.lastWatchedAt) <= ts(b.lastWatchedAt) ? [a, b] : [b, a];
  return {
    videoId: newer.videoId,
    status: a.status === 'completed' || b.status === 'completed' ? 'completed' : 'seen',
    watchedSeconds: Math.max(a.watchedSeconds ?? 0, b.watchedSeconds ?? 0),
    // The live cursor and the dismissed flag follow the latest activity.
    lastPositionSeconds: newer.lastPositionSeconds ?? older.lastPositionSeconds,
    resumeDismissed: newer.resumeDismissed ?? older.resumeDismissed,
    channelKey: newer.channelKey ?? older.channelKey,
    category: newer.category ?? older.category,
    durationSeconds: newer.durationSeconds ?? older.durationSeconds,
    title: newer.title ?? older.title,
    thumbnailUrl: newer.thumbnailUrl ?? older.thumbnailUrl,
    channelLabel: newer.channelLabel ?? older.channelLabel,
    firstWatchedAt:
      ts(a.firstWatchedAt) > 0 && ts(b.firstWatchedAt) > 0
        ? ts(a.firstWatchedAt) <= ts(b.firstWatchedAt)
          ? a.firstWatchedAt
          : b.firstWatchedAt
        : newer.firstWatchedAt || older.firstWatchedAt,
    lastWatchedAt: newer.lastWatchedAt,
  };
}

export type MergedWatch = { watch: WatchRecords; deletions: Deletions };

/**
 * Merge watch maps and tombstones across devices. A tombstone wins over a
 * record unless the record was watched again strictly after the deletion.
 * Expired tombstones are pruned.
 */
export function mergeWatch(
  watchMaps: WatchRecords[],
  deletionMaps: Deletions[],
  now: Date = new Date(),
): MergedWatch {
  // Latest tombstone per video across devices.
  const deletions: Deletions = {};
  for (const map of deletionMaps) {
    for (const [id, at] of Object.entries(map ?? {})) {
      if (ts(at) > ts(deletions[id])) deletions[id] = at;
    }
  }

  // Field-merge every record for the same video.
  const merged: WatchRecords = {};
  for (const map of watchMaps) {
    for (const [id, record] of Object.entries(map ?? {})) {
      if (!record || typeof record !== 'object') continue;
      merged[id] = merged[id] ? mergeWatchRecord(merged[id], record) : record;
    }
  }

  // Apply tombstones: the record survives only if watched AFTER the deletion.
  const watch: WatchRecords = {};
  for (const [id, record] of Object.entries(merged)) {
    const deletedAt = deletions[id];
    if (deletedAt && ts(record.lastWatchedAt) <= ts(deletedAt)) continue;
    if (deletedAt) delete deletions[id]; // re-watched: the tombstone is obsolete
    watch[id] = record;
  }

  // Prune old tombstones so the blob does not grow forever.
  for (const [id, at] of Object.entries(deletions)) {
    if (now.getTime() - ts(at) > TOMBSTONE_TTL_MS) delete deletions[id];
  }

  return { watch, deletions };
}

/** Per-day SUM across device slices (the display view of daily stats). */
export function sumDailyStats(slices: DailyStats[]): DailyStats {
  const out: DailyStats = {};
  for (const slice of slices) {
    for (const [day, stat] of Object.entries(slice ?? {})) {
      const existing = out[day] ?? { day, watchSeconds: 0, videosCompleted: 0 };
      out[day] = {
        day,
        watchSeconds: existing.watchSeconds + (stat?.watchSeconds ?? 0),
        videosCompleted: existing.videosCompleted + (stat?.videosCompleted ?? 0),
      };
    }
  }
  return out;
}

/** Latest explicit edit wins for the quit date. */
export function mergeMeta(metas: AppMeta[]): AppMeta {
  let best: AppMeta = {};
  let bestAt = -1;
  for (const meta of metas) {
    if (!meta?.quitDate) continue;
    const at = ts(meta.quitDateSetAt);
    if (at > bestAt) {
      best = { quitDate: meta.quitDate, quitDateSetAt: meta.quitDateSetAt };
      bestAt = at;
    }
  }
  return best;
}

/** Most recent snooze per video across devices. */
export function mergeSnoozes(maps: Record<string, string>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const map of maps) {
    for (const [id, at] of Object.entries(map ?? {})) {
      if (ts(at) > ts(out[id])) out[id] = at;
    }
  }
  return out;
}
