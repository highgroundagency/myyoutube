/**
 * Per-channel curation rules (section 9, extended). These run server-side after
 * normalization so the feed only shows what each channel is configured to show.
 * Live and upcoming videos are always exempt (a live stream is current by nature
 * and is also surfaced by the live check).
 */
import type { Video } from './types.js';
import type { ChannelCuration } from '../../config/channels.js';

/** Lowercase and strip accents so "Melhores Momentos" matches "melhores momentos". */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Default cap when a channel asks for its full upload history. */
export const FETCH_ALL_CAP = 300;

/** Keep a video only if it satisfies the channel's curation rules. */
export function passesCuration(video: Video, curation?: ChannelCuration): boolean {
  if (!curation) return true;
  const isLiveish = video.liveState === 'live' || video.liveState === 'upcoming';
  if (isLiveish) return true;

  if (curation.publishedAfter) {
    const cutoff = Date.parse(curation.publishedAfter);
    if (Number.isFinite(cutoff) && Date.parse(video.publishedAt) < cutoff) return false;
  }

  if (curation.titleIncludesAny && curation.titleIncludesAny.length > 0) {
    const title = normalizeForMatch(video.title);
    const matches = curation.titleIncludesAny.some((kw) => title.includes(normalizeForMatch(kw)));
    if (!matches) return false;
  }

  return true;
}

/** How many uploads to fetch for a channel, honoring fetchAll / maxVideos. */
export function uploadFetchLimit(curation: ChannelCuration | undefined, defaultLimit: number): number {
  if (!curation) return defaultLimit;
  if (curation.maxVideos && curation.maxVideos > 0) return curation.maxVideos;
  if (curation.fetchAll) return FETCH_ALL_CAP;
  return defaultLimit;
}
