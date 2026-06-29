/**
 * "Continue watching" list, derived purely from local watch state. An item
 * qualifies when it was watched past the resume threshold, is not completed,
 * is not near the end, and was not dismissed. Newest activity first.
 */
import type { WatchRecords } from '../persistence/types';
import { RESUME_MIN_SECONDS } from '../../config/constants';

/**
 * Only drop a video from "continue watching" once it is essentially over (98%).
 * The "completed" status already removes finished videos; this is just a guard
 * so a resume point a hair from the end does not linger.
 */
const NEAR_END_RATIO = 0.98;

export type ResumeItem = {
  videoId: string;
  title: string;
  channelKey: string;
  channelLabel: string;
  thumbnailUrl: string;
  /** Where to pick playback back up, in seconds. */
  positionSeconds: number;
  /** 0 when the duration is unknown (live/upcoming were never resumable). */
  durationSeconds: number;
  /** 0..1 for the progress bar; 0 when the duration is unknown. */
  fraction: number;
  lastWatchedAt: string;
};

export function buildResumeList(records: WatchRecords, limit = 24): ResumeItem[] {
  const items: ResumeItem[] = [];
  for (const r of Object.values(records)) {
    if (r.status === 'completed' || r.resumeDismissed) continue;
    const position = r.lastPositionSeconds ?? r.watchedSeconds ?? 0;
    if (position < RESUME_MIN_SECONDS) continue;
    const duration = r.durationSeconds ?? 0;
    // Already essentially at the end: treat as finished, do not nag to resume.
    if (duration > 0 && position >= duration * NEAR_END_RATIO) continue;
    items.push({
      videoId: r.videoId,
      title: r.title ?? r.videoId,
      channelKey: r.channelKey ?? '',
      channelLabel: r.channelLabel ?? '',
      thumbnailUrl: r.thumbnailUrl ?? '',
      positionSeconds: position,
      durationSeconds: duration,
      fraction: duration > 0 ? Math.min(1, position / duration) : 0,
      lastWatchedAt: r.lastWatchedAt,
    });
  }
  return items
    .sort((a, b) => Date.parse(b.lastWatchedAt) - Date.parse(a.lastWatchedAt))
    .slice(0, limit);
}
