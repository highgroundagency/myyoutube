import { createContext, useContext } from 'react';
import type { AppMeta, DailyStats, WatchRecord, WatchRecords } from '../lib/persistence/types';
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
  appMeta: AppMeta;

  isSeen: (id: string) => boolean;
  isCompleted: (id: string) => boolean;
  getRecord: (id: string) => WatchRecord | undefined;

  markSeen: (video: Video) => void;
  /** Mark a batch of videos as seen in one update (e.g. a whole channel). */
  markManySeen: (videos: Video[]) => void;
  markCompleted: (video: Video, watchedSeconds?: number) => void;
  recordProgress: (video: Video, watchedSeconds: number) => void;
  /** Save the latest playback position (resume point) for a video. */
  recordPosition: (video: Video, positionSeconds: number) => void;
  /** Hide a video from the "continue watching" rail. */
  dismissResume: (id: string) => void;
  unmark: (id: string) => void;
  clearWatchState: () => void;

  addWatchSeconds: (deltaSeconds: number, deltaCompleted?: number) => void;

  /** Anchor the "time saved" counter to a local day key (yyyy-MM-dd). */
  setQuitDate: (day: string) => void;

  getWatchState: () => WatchRecords;
  getDailyStats: () => DailyStats;
};

export const PersistenceContext = createContext<PersistenceContextValue | null>(null);

export function usePersistence(): PersistenceContextValue {
  const ctx = useContext(PersistenceContext);
  if (!ctx) throw new Error('usePersistence must be used within a PersistenceProvider');
  return ctx;
}
