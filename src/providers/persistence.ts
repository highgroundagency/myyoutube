import { createContext, useContext } from 'react';
import type { DailyStats, WatchRecord, WatchRecords } from '../lib/persistence/types';
import type { Video } from '../lib/youtube/types';

/**
 * The single clean persistence interface the whole app uses. The current
 * implementation stores everything locally in IndexedDB, but a remote sync
 * backend can be plugged in here later without touching any UI.
 */
export type PersistenceContextValue = {
  /** True once the initial hydrate from storage has completed. */
  ready: boolean;
  watchState: WatchRecords;
  dailyStats: DailyStats;

  isSeen: (id: string) => boolean;
  isCompleted: (id: string) => boolean;
  getRecord: (id: string) => WatchRecord | undefined;

  markSeen: (video: Video) => void;
  markCompleted: (video: Video, watchedSeconds?: number) => void;
  recordProgress: (video: Video, watchedSeconds: number) => void;
  unmark: (id: string) => void;
  clearWatchState: () => void;

  addWatchSeconds: (deltaSeconds: number, deltaCompleted?: number) => void;

  getWatchState: () => WatchRecords;
  getDailyStats: () => DailyStats;
};

export const PersistenceContext = createContext<PersistenceContextValue | null>(null);

export function usePersistence(): PersistenceContextValue {
  const ctx = useContext(PersistenceContext);
  if (!ctx) throw new Error('usePersistence must be used within a PersistenceProvider');
  return ctx;
}
