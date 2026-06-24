/**
 * Feed filters (section 9), applied during normalization before anything reaches
 * the UI. Returns the kept videos plus drop counts for logging.
 */
import type { Video } from './types.js';
import { SHORTS_MAX_SECONDS } from '../../config/constants.js';

export type FilterStats = {
  shorts: number;
  nonEmbeddable: number;
  nonPublic: number;
  kept: number;
};

export function isShort(video: Video): boolean {
  // Live and upcoming have durationSeconds 0 and must NOT be treated as Shorts.
  return video.durationSeconds > 0 && video.durationSeconds <= SHORTS_MAX_SECONDS;
}

export function applyFilters(videos: Video[]): { videos: Video[]; stats: FilterStats } {
  const stats: FilterStats = { shorts: 0, nonEmbeddable: 0, nonPublic: 0, kept: 0 };
  const kept: Video[] = [];

  for (const video of videos) {
    if (!video.isPublic) {
      stats.nonPublic += 1;
      continue;
    }
    if (!video.isEmbeddable) {
      // These would throw player error 101 or 150, so filter up front.
      stats.nonEmbeddable += 1;
      continue;
    }
    if (isShort(video)) {
      stats.shorts += 1;
      continue;
    }
    kept.push(video);
  }

  stats.kept = kept.length;
  return { videos: kept, stats };
}

/** Sort newest first by publishedAt, stable on id for deterministic output. */
export function sortNewestFirst(videos: Video[]): Video[] {
  return [...videos].sort((a, b) => {
    const ta = Date.parse(a.publishedAt) || 0;
    const tb = Date.parse(b.publishedAt) || 0;
    if (tb !== ta) return tb - ta;
    return a.id.localeCompare(b.id);
  });
}

/** Dedupe by video id, keeping the first occurrence. */
export function dedupeById(videos: Video[]): Video[] {
  const seen = new Set<string>();
  const out: Video[] = [];
  for (const v of videos) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}
