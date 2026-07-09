/**
 * The "marathon" recommender: watch a channel's whole catalog, one video at a
 * time, oldest first (a coherent journey through the content). Pure logic;
 * storage for snoozes lives with the caller.
 *
 * Rules:
 *  - Candidates: the channel's normal videos (no live/upcoming), oldest first.
 *  - Seen videos ("ja assisti" or actually watched) never come back.
 *  - "Assistir depois" snoozes a video: it stops being recommended until the
 *    snooze expires, or until everything else unseen is also snoozed (then the
 *    oldest snooze returns, so the queue never dead-ends).
 */
import type { Video } from '../youtube/types';

/** A snooze lasts this long before the video is offered again. */
export const SNOOZE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** videoId -> ISO timestamp of when it was snoozed. */
export type SnoozeMap = Record<string, string>;

export type NextUp = {
  video: Video;
  /** 1-based position of this video in the chronological journey. */
  position: number;
  total: number;
  watched: number;
  /** 0..1 share of the journey already watched. */
  progress: number;
};

function isActive(snoozedAt: string | undefined, now: Date): boolean {
  if (!snoozedAt) return false;
  const t = Date.parse(snoozedAt);
  return Number.isFinite(t) && now.getTime() - t < SNOOZE_TTL_MS;
}

/** Oldest-first watchable videos of the channel. */
export function marathonCandidates(videos: Video[], channelKey: string): Video[] {
  return videos
    .filter((v) => v.channelKey === channelKey && v.liveState === 'none')
    .sort((a, b) => (Date.parse(a.publishedAt) || 0) - (Date.parse(b.publishedAt) || 0));
}

export function pickNextUp(
  videos: Video[],
  channelKey: string,
  isSeen: (id: string) => boolean,
  snoozes: SnoozeMap = {},
  now: Date = new Date(),
): NextUp | null {
  const candidates = marathonCandidates(videos, channelKey);
  if (candidates.length === 0) return null;

  const watched = candidates.filter((v) => isSeen(v.id)).length;
  const unseen = candidates.filter((v) => !isSeen(v.id));
  if (unseen.length === 0) return null; // journey complete

  const fresh = unseen.filter((v) => !isActive(snoozes[v.id], now));
  // Everything unseen is snoozed: bring back the one snoozed longest ago.
  const next =
    fresh[0] ??
    [...unseen].sort(
      (a, b) => (Date.parse(snoozes[a.id] ?? '') || 0) - (Date.parse(snoozes[b.id] ?? '') || 0),
    )[0];

  return {
    video: next,
    position: candidates.findIndex((v) => v.id === next.id) + 1,
    total: candidates.length,
    watched,
    progress: candidates.length > 0 ? watched / candidates.length : 0,
  };
}

/** Drop expired entries so the map does not grow forever. */
export function pruneSnoozes(snoozes: SnoozeMap, now: Date = new Date()): SnoozeMap {
  const out: SnoozeMap = {};
  for (const [id, at] of Object.entries(snoozes)) {
    if (isActive(at, now)) out[id] = at;
  }
  return out;
}
