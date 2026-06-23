/**
 * Best available thumbnail picker. `maxres` and `standard` are often missing,
 * so we fall through to smaller sizes. Never returns an empty string: if every
 * size is missing it falls back to a local placeholder so cards never break
 * (section 8).
 */

export const PLACEHOLDER_THUMBNAIL = '/placeholder.svg';

type ThumbEntry = { url?: string } | undefined;
type ThumbMap = Record<string, ThumbEntry> | undefined | null;

const PREFERENCE = ['maxres', 'standard', 'high', 'medium', 'default'] as const;

export function pickThumbnail(thumbnails: ThumbMap): string {
  if (thumbnails) {
    for (const size of PREFERENCE) {
      const url = thumbnails[size]?.url;
      if (typeof url === 'string' && url.length > 0) return url;
    }
    // Some payloads use non-standard keys. Take any url present as a last resort.
    for (const entry of Object.values(thumbnails)) {
      if (entry && typeof entry.url === 'string' && entry.url.length > 0) return entry.url;
    }
  }
  return PLACEHOLDER_THUMBNAIL;
}
