import { get, set } from 'idb-keyval';
import type {
  AppMeta,
  DailyStats,
  WatchRecord,
  WatchRecords,
  WatchStatus,
  WatchUpsert,
} from './types';
import { localDayKey } from './types';

/**
 * Local first persistence backed by IndexedDB (idb-keyval). This is the single
 * source of truth for watch state and daily stats on the device. Writes update
 * the in-memory copy synchronously (optimistic), then persist to IndexedDB with
 * try/catch so a storage failure never breaks the UI. There is no remote backend
 * and no offline queue: every write is local.
 *
 * A remote sync backend can be added later behind the PersistenceProvider
 * interface without touching this store's callers.
 */

const WATCH_KEY = 'gv-watch-state';
const STATS_KEY = 'gv-daily-stats';
const META_KEY = 'gv-meta';

type Listener = () => void;

/** completed always wins, and we never downgrade completed back to seen. */
function mergeStatus(prev: WatchStatus | undefined, next: WatchStatus): WatchStatus {
  return prev === 'completed' || next === 'completed' ? 'completed' : 'seen';
}

class PersistenceStore {
  private watch: WatchRecords = {};
  private stats: DailyStats = {};
  private meta: AppMeta = {};
  private listeners = new Set<Listener>();
  private initPromise: Promise<void> | null = null;

  /**
   * Hydrate from IndexedDB. Idempotent: returns the same promise on repeat
   * calls. init runs before any writes (see main.tsx), so loaded data is the
   * authoritative starting point.
   */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const [w, s, m] = await Promise.all([
          get<WatchRecords>(WATCH_KEY),
          get<DailyStats>(STATS_KEY),
          get<AppMeta>(META_KEY),
        ]);
        if (w && typeof w === 'object') this.watch = w;
        if (s && typeof s === 'object') this.stats = s;
        if (m && typeof m === 'object') this.meta = m;
      } catch {
        // IndexedDB unavailable (private mode, sandbox): stay in-memory only.
      }
      this.emit();
    })();
    return this.initPromise;
  }

  // ----- reactive (useSyncExternalStore) -----

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getWatchSnapshot = (): WatchRecords => this.watch;
  getStatsSnapshot = (): DailyStats => this.stats;
  getMetaSnapshot = (): AppMeta => this.meta;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private persistWatch(): void {
    void set(WATCH_KEY, this.watch).catch(() => {
      // Best effort: the in-memory state is still correct for this session.
    });
  }

  private persistStats(): void {
    void set(STATS_KEY, this.stats).catch(() => {});
  }

  private persistMeta(): void {
    void set(META_KEY, this.meta).catch(() => {});
  }

  // ----- watch state mutations -----

  /**
   * Merge in a watch event: max watchedSeconds, never downgrade completed to
   * seen, preserve firstWatchedAt, bump lastWatchedAt.
   */
  upsertWatch(input: WatchUpsert): WatchRecord {
    const now = new Date().toISOString();
    const existing = this.watch[input.videoId];
    // resumeDismissed: an explicit flag always wins; otherwise recording a fresh
    // position means the viewer is actively watching again, so un-dismiss it.
    const resumeDismissed =
      input.resumeDismissed ??
      (input.lastPositionSeconds != null ? false : existing?.resumeDismissed);
    const record: WatchRecord = {
      videoId: input.videoId,
      status: mergeStatus(existing?.status, input.status),
      watchedSeconds: Math.max(existing?.watchedSeconds ?? 0, input.watchedSeconds ?? 0),
      // Latest position wins (it can move backward when scrubbing), unlike the
      // monotonic watchedSeconds above.
      lastPositionSeconds: input.lastPositionSeconds ?? existing?.lastPositionSeconds,
      resumeDismissed,
      channelKey: input.channelKey ?? existing?.channelKey,
      category: input.category ?? existing?.category,
      durationSeconds: input.durationSeconds ?? existing?.durationSeconds,
      title: input.title ?? existing?.title,
      thumbnailUrl: input.thumbnailUrl ?? existing?.thumbnailUrl,
      channelLabel: input.channelLabel ?? existing?.channelLabel,
      firstWatchedAt: existing?.firstWatchedAt ?? now,
      lastWatchedAt: now,
    };
    this.watch = { ...this.watch, [input.videoId]: record };
    this.persistWatch();
    this.emit();
    return record;
  }

  /**
   * Mark many videos as seen in a single update (one persist, one re-render).
   * Never downgrades an existing completed/seen record, and does not bump
   * lastWatchedAt for videos already in history.
   */
  markManySeen(items: WatchUpsert[]): void {
    if (items.length === 0) return;
    const now = new Date().toISOString();
    const next = { ...this.watch };
    for (const item of items) {
      const existing = next[item.videoId];
      next[item.videoId] = {
        videoId: item.videoId,
        status: existing?.status ?? 'seen',
        watchedSeconds: existing?.watchedSeconds ?? 0,
        lastPositionSeconds: existing?.lastPositionSeconds,
        resumeDismissed: existing?.resumeDismissed,
        channelKey: item.channelKey ?? existing?.channelKey,
        category: item.category ?? existing?.category,
        durationSeconds: item.durationSeconds ?? existing?.durationSeconds,
        title: item.title ?? existing?.title,
        thumbnailUrl: item.thumbnailUrl ?? existing?.thumbnailUrl,
        channelLabel: item.channelLabel ?? existing?.channelLabel,
        firstWatchedAt: existing?.firstWatchedAt ?? now,
        lastWatchedAt: existing?.lastWatchedAt ?? now,
      };
    }
    this.watch = next;
    this.persistWatch();
    this.emit();
  }

  /** Hide a video from the "continue watching" rail without losing its history. */
  dismissResume(videoId: string): void {
    const existing = this.watch[videoId];
    if (!existing || existing.resumeDismissed) return;
    this.watch = {
      ...this.watch,
      [videoId]: { ...existing, resumeDismissed: true },
    };
    this.persistWatch();
    this.emit();
  }

  removeWatch(videoId: string): void {
    if (!this.watch[videoId]) return;
    const next = { ...this.watch };
    delete next[videoId];
    this.watch = next;
    this.persistWatch();
    this.emit();
  }

  clearWatch(): void {
    this.watch = {};
    this.persistWatch();
    this.emit();
  }

  // ----- daily stats mutations -----

  /** Add a delta of real watch seconds (and optional completions) to a day. */
  addStats(deltaSeconds: number, deltaCompleted = 0, day: string = localDayKey()): void {
    if (deltaSeconds <= 0 && deltaCompleted <= 0) return;
    const existing = this.stats[day] ?? { day, watchSeconds: 0, videosCompleted: 0 };
    this.stats = {
      ...this.stats,
      [day]: {
        day,
        watchSeconds: existing.watchSeconds + Math.max(0, deltaSeconds),
        videosCompleted: existing.videosCompleted + Math.max(0, deltaCompleted),
      },
    };
    this.persistStats();
    this.emit();
  }

  clearStats(): void {
    this.stats = {};
    this.persistStats();
    this.emit();
  }

  // ----- app meta -----

  /** Anchor (or re-anchor) the "time saved" counter to a local day key. */
  setQuitDate(day: string): void {
    this.meta = { ...this.meta, quitDate: day };
    this.persistMeta();
    this.emit();
  }
}

export const persistence = new PersistenceStore();
