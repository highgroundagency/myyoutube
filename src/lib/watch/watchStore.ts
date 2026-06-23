import type { WatchRecord, WatchRecords, WatchStatus, WatchUpsert } from './types';

const STORAGE_KEY = 'gv-watch-state';

type Listener = () => void;
type SyncHandler = (record: WatchRecord) => void;

/** completed always wins, and we never downgrade completed back to seen. */
function mergeStatus(prev: WatchStatus | undefined, next: WatchStatus): WatchStatus {
  return prev === 'completed' || next === 'completed' ? 'completed' : 'seen';
}

/**
 * Local first watch state store. The whole app reads and writes here for instant,
 * optimistic updates that work with no Supabase and offline (section 11, 13).
 * A sync handler (installed in the persistence phase) mirrors each change to
 * Supabase and the offline queue. The store is the single source of truth on the
 * client; Supabase reconciles it on login.
 */
class WatchStore {
  private records: WatchRecords = {};
  private listeners = new Set<Listener>();
  private syncHandler: SyncHandler | null = null;
  private loaded = false;

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') this.records = parsed as WatchRecords;
      }
    } catch {
      // Corrupt or unavailable storage: start empty rather than crash.
      this.records = {};
    }
  }

  subscribe = (listener: Listener): (() => void) => {
    this.ensureLoaded();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): WatchRecords => {
    this.ensureLoaded();
    return this.records;
  };

  /** Install the Supabase + offline sync handler (persistence phase). */
  setSyncHandler(handler: SyncHandler | null): void {
    this.syncHandler = handler;
  }

  private commit(next: WatchRecords): void {
    this.records = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence failures, the in-memory state is still correct.
    }
    for (const listener of this.listeners) listener();
  }

  /**
   * Merge in a watch event. Takes the max watchedSeconds, never downgrades
   * completed to seen, preserves firstWatchedAt, and bumps lastWatchedAt.
   */
  upsert(input: WatchUpsert): WatchRecord {
    this.ensureLoaded();
    const now = new Date().toISOString();
    const existing = this.records[input.videoId];

    const record: WatchRecord = {
      videoId: input.videoId,
      status: mergeStatus(existing?.status, input.status),
      watchedSeconds: Math.max(existing?.watchedSeconds ?? 0, input.watchedSeconds ?? 0),
      channelKey: input.channelKey ?? existing?.channelKey,
      category: input.category ?? existing?.category,
      durationSeconds: input.durationSeconds ?? existing?.durationSeconds,
      title: input.title ?? existing?.title,
      thumbnailUrl: input.thumbnailUrl ?? existing?.thumbnailUrl,
      channelLabel: input.channelLabel ?? existing?.channelLabel,
      firstWatchedAt: existing?.firstWatchedAt ?? now,
      lastWatchedAt: now,
    };

    this.commit({ ...this.records, [input.videoId]: record });
    if (this.syncHandler) this.syncHandler(record);
    return record;
  }

  /** Remove a record (undo "mark as seen"). */
  remove(videoId: string): void {
    this.ensureLoaded();
    if (!this.records[videoId]) return;
    const next = { ...this.records };
    delete next[videoId];
    this.commit(next);
  }

  /** Replace all records (used when Supabase pulls authoritative state on login). */
  replaceAll(records: WatchRecords): void {
    this.loaded = true;
    this.commit(records);
  }

  clearAll(): void {
    this.commit({});
  }
}

export const watchStore = new WatchStore();
