import { useSyncExternalStore } from 'react';
import { dailyStatsStore } from '../lib/stats/dailyStatsStore';

/** Reactive access to the local daily stats store. */
export function useDailyStats() {
  return useSyncExternalStore(
    dailyStatsStore.subscribe,
    dailyStatsStore.getSnapshot,
    dailyStatsStore.getSnapshot,
  );
}
