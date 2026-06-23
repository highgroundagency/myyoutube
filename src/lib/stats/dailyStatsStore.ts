import { format } from 'date-fns';

export type DailyStat = { day: string; watchSeconds: number; videosCompleted: number };
export type DailyStats = Record<string, DailyStat>;

const STORAGE_KEY = 'gv-daily-stats';

type Listener = () => void;
type SyncHandler = (day: string, deltaSeconds: number, deltaCompleted: number) => void;

/** Local date key (yyyy-MM-dd) in the viewer's timezone, NOT UTC (section 14). */
export function localDayKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Local first daily stats store. The player writes real watch-time deltas and
 * completion counts here for instant, offline-safe stats. A sync handler
 * (persistence phase) mirrors each delta to the Supabase atomic increment RPC so
 * two devices never clobber each other.
 */
class DailyStatsStore {
  private stats: DailyStats = {};
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
        if (parsed && typeof parsed === 'object') this.stats = parsed as DailyStats;
      }
    } catch {
      this.stats = {};
    }
  }

  subscribe = (listener: Listener): (() => void) => {
    this.ensureLoaded();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): DailyStats => {
    this.ensureLoaded();
    return this.stats;
  };

  setSyncHandler(handler: SyncHandler | null): void {
    this.syncHandler = handler;
  }

  replaceAll(stats: DailyStats): void {
    this.loaded = true;
    this.commit(stats);
  }

  private commit(next: DailyStats): void {
    this.stats = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence failures.
    }
    for (const listener of this.listeners) listener();
  }

  /** Add a delta of real watch seconds (and optional completion) to a day. */
  add(deltaSeconds: number, deltaCompleted = 0, day: string = localDayKey()): void {
    this.ensureLoaded();
    if (deltaSeconds <= 0 && deltaCompleted <= 0) return;
    const existing = this.stats[day] ?? { day, watchSeconds: 0, videosCompleted: 0 };
    const next: DailyStat = {
      day,
      watchSeconds: existing.watchSeconds + Math.max(0, deltaSeconds),
      videosCompleted: existing.videosCompleted + Math.max(0, deltaCompleted),
    };
    this.commit({ ...this.stats, [day]: next });
    if (this.syncHandler) this.syncHandler(day, Math.max(0, deltaSeconds), Math.max(0, deltaCompleted));
  }

  clearAll(): void {
    this.commit({});
  }
}

export const dailyStatsStore = new DailyStatsStore();
