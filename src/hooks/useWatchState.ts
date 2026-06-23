import { useSyncExternalStore, useMemo } from 'react';
import { watchStore } from '../lib/watch/watchStore';
import type { Video } from '../lib/youtube/types';
import type { WatchRecord } from '../lib/watch/types';
import { COMPLETION_RATIO } from '../config/constants';

/**
 * React access to the watch state store. Subscribes via useSyncExternalStore so
 * every card and page stays in sync, and updates are optimistic and instant.
 * The actual "mark seen at 3s, completed at 90 percent" decisions are made by
 * the player hook (section 12); this hook just exposes the writes.
 */
export function useWatchState() {
  const records = useSyncExternalStore(
    watchStore.subscribe,
    watchStore.getSnapshot,
    watchStore.getSnapshot,
  );

  return useMemo(() => {
    const getRecord = (id: string): WatchRecord | undefined => records[id];
    const meta = (video: Video) => ({
      channelKey: video.channelKey,
      category: video.category,
      durationSeconds: video.durationSeconds,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      channelLabel: video.channelLabel,
    });
    return {
      records,
      seenCount: Object.keys(records).length,
      isSeen: (id: string): boolean => Boolean(records[id]),
      isCompleted: (id: string): boolean => records[id]?.status === 'completed',
      getRecord,
      markSeen: (video: Video): void => {
        watchStore.upsert({ videoId: video.id, status: 'seen', ...meta(video) });
      },
      markCompleted: (video: Video, watchedSeconds?: number): void => {
        watchStore.upsert({ videoId: video.id, status: 'completed', watchedSeconds, ...meta(video) });
      },
      recordProgress: (video: Video, watchedSeconds: number): void => {
        const completed =
          video.durationSeconds > 0 && watchedSeconds >= video.durationSeconds * COMPLETION_RATIO;
        watchStore.upsert({
          videoId: video.id,
          status: completed ? 'completed' : 'seen',
          watchedSeconds,
          ...meta(video),
        });
      },
      unmark: (id: string): void => watchStore.remove(id),
      clearAll: (): void => watchStore.clearAll(),
    };
  }, [records]);
}
