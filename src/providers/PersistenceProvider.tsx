import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { persistence } from '../lib/persistence/idbStore';
import { PersistenceContext, type PersistenceContextValue } from './persistence';
import { COMPLETION_RATIO } from '../config/constants';
import type { Video } from '../lib/youtube/types';

/**
 * Provides the persistence interface to the app and hydrates from IndexedDB on
 * mount. Reads are reactive via useSyncExternalStore; writes are optimistic.
 */
export function PersistenceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  const watchState = useSyncExternalStore(
    persistence.subscribe,
    persistence.getWatchSnapshot,
    persistence.getWatchSnapshot,
  );
  const dailyStats = useSyncExternalStore(
    persistence.subscribe,
    persistence.getStatsSnapshot,
    persistence.getStatsSnapshot,
  );
  const appMeta = useSyncExternalStore(
    persistence.subscribe,
    persistence.getMetaSnapshot,
    persistence.getMetaSnapshot,
  );

  useEffect(() => {
    let active = true;
    // init is idempotent: main.tsx may have already hydrated before first render.
    persistence.init().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<PersistenceContextValue>(() => {
    const meta = (video: Video) => ({
      channelKey: video.channelKey,
      category: video.category,
      durationSeconds: video.durationSeconds,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      channelLabel: video.channelLabel,
    });
    return {
      ready,
      watchState,
      dailyStats,
      appMeta,
      isSeen: (id) => Boolean(watchState[id]),
      isCompleted: (id) => watchState[id]?.status === 'completed',
      getRecord: (id) => watchState[id],
      markSeen: (video) => persistence.upsertWatch({ videoId: video.id, status: 'seen', ...meta(video) }),
      markManySeen: (videos) =>
        persistence.markManySeen(
          videos.map((video) => ({ videoId: video.id, status: 'seen' as const, ...meta(video) })),
        ),
      markCompleted: (video, watchedSeconds) =>
        persistence.upsertWatch({ videoId: video.id, status: 'completed', watchedSeconds, ...meta(video) }),
      recordProgress: (video, watchedSeconds) => {
        const completed =
          video.durationSeconds > 0 && watchedSeconds >= video.durationSeconds * COMPLETION_RATIO;
        persistence.upsertWatch({
          videoId: video.id,
          status: completed ? 'completed' : 'seen',
          watchedSeconds,
          ...meta(video),
        });
      },
      recordPosition: (video, positionSeconds) =>
        persistence.upsertWatch({
          videoId: video.id,
          status: 'seen',
          lastPositionSeconds: positionSeconds,
          ...meta(video),
        }),
      dismissResume: (id) => persistence.dismissResume(id),
      unmark: (id) => persistence.removeWatch(id),
      clearWatchState: () => persistence.clearWatch(),
      addWatchSeconds: (deltaSeconds, deltaCompleted = 0) =>
        persistence.addStats(deltaSeconds, deltaCompleted),
      setQuitDate: (day) => persistence.setQuitDate(day),
      getWatchState: () => persistence.getWatchSnapshot(),
      getDailyStats: () => persistence.getStatsSnapshot(),
    };
  }, [ready, watchState, dailyStats, appMeta]);

  return <PersistenceContext.Provider value={value}>{children}</PersistenceContext.Provider>;
}
