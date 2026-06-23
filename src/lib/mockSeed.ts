import { subDays } from 'date-fns';
import { MOCK_MODE } from '../config/env';
import { buildMockFeed } from '../fixtures';
import { persistence } from './persistence/idbStore';
import { localDayKey } from './persistence/types';

const SEED_FLAG = 'gv-mock-seeded';

/**
 * Seeds a little watch history and ~2 weeks of daily stats the first time the app
 * runs in MOCK_MODE, so the Stats and History pages are populated for the demo.
 * Runs once (guarded by a flag), so clearing history does not re-seed. Called
 * after persistence has hydrated (see main.tsx).
 */
export function seedMockDataIfNeeded(): void {
  if (!MOCK_MODE) return;
  try {
    if (localStorage.getItem(SEED_FLAG) === '1') return;
  } catch {
    return;
  }

  const feed = buildMockFeed();

  // Mark a few long form videos watched (mix of completed and seen).
  feed.videos
    .filter((v) => v.liveState === 'none')
    .slice(0, 5)
    .forEach((v, i) => {
      const completed = i % 2 === 0;
      persistence.upsertWatch({
        videoId: v.id,
        status: completed ? 'completed' : 'seen',
        watchedSeconds: completed ? v.durationSeconds : Math.round(v.durationSeconds * 0.4),
        channelKey: v.channelKey,
        category: v.category,
        durationSeconds: v.durationSeconds,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        channelLabel: v.channelLabel,
      });
    });

  // Minutes per day, oldest first, with one gap so the streak and chart look real.
  const minutesByDay = [25, 40, 0, 15, 30, 45, 20, 10, 0, 35, 50, 25, 18, 22];
  const days = minutesByDay.length;
  minutesByDay.forEach((mins, idx) => {
    if (mins <= 0) return;
    const day = localDayKey(subDays(new Date(), days - 1 - idx));
    persistence.addStats(mins * 60, idx % 4 === 0 ? 1 : 0, day);
  });

  try {
    localStorage.setItem(SEED_FLAG, '1');
  } catch {
    // ignore
  }
}
