import { useMemo } from 'react';
import { usePersistence } from '../providers/persistence';

/**
 * Watch state access for the UI. Thin adapter over the persistence interface,
 * kept as its own hook so pages do not depend on the storage implementation.
 */
export function useWatchState() {
  const p = usePersistence();
  return useMemo(
    () => ({
      records: p.watchState,
      seenCount: Object.keys(p.watchState).length,
      isSeen: p.isSeen,
      isCompleted: p.isCompleted,
      getRecord: p.getRecord,
      markSeen: p.markSeen,
      markManySeen: p.markManySeen,
      markCompleted: p.markCompleted,
      recordProgress: p.recordProgress,
      dismissResume: p.dismissResume,
      unmark: p.unmark,
      clearAll: p.clearWatchState,
    }),
    [p],
  );
}
