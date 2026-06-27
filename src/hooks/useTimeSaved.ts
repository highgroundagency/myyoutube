import { useEffect, useMemo, useState } from 'react';
import { usePersistence } from '../providers/persistence';
import { effectiveQuitDay, savedMinutes, describeSavedTime } from '../lib/stats/timeSaved';
import { DEFAULT_DAILY_YOUTUBE_HOURS } from '../config/constants';

/**
 * Reactive "time saved from YouTube" readout. Recomputes once a minute so the
 * total visibly ticks up, and exposes the effective anchor day plus a setter to
 * re-anchor it.
 */
export function useTimeSaved(baselineHours: number = DEFAULT_DAILY_YOUTUBE_HOURS) {
  const p = usePersistence();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const quitDay = useMemo(
    () => effectiveQuitDay(p.appMeta, p.dailyStats, now),
    [p.appMeta, p.dailyStats, now],
  );
  const readout = useMemo(
    () => describeSavedTime(savedMinutes(quitDay, baselineHours, now)),
    [quitDay, baselineHours, now],
  );

  return {
    readout,
    quitDay,
    baselineHours,
    /** True once the viewer has set an explicit anchor (vs. the inferred one). */
    isAnchored: Boolean(p.appMeta.quitDate),
    setQuitDay: p.setQuitDate,
  };
}
