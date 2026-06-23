import { usePersistence } from '../providers/persistence';
import type { DailyStats } from '../lib/persistence/types';

/** Reactive access to the local daily stats. */
export function useDailyStats(): DailyStats {
  return usePersistence().dailyStats;
}
