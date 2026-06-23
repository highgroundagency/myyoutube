import type { Video } from '../youtube/types';

/**
 * Round robin interleave by channel so one prolific channel (MrBeast, Caze TV)
 * does not flood the feed (section 11). Input is assumed newest first; order is
 * preserved within each channel. Channels lead in order of their freshest video,
 * so the most recently active channel appears first.
 */
export function interleaveByChannel(videos: Video[]): Video[] {
  const groups = new Map<string, Video[]>();
  for (const v of videos) {
    const list = groups.get(v.channelKey);
    if (list) list.push(v);
    else groups.set(v.channelKey, [v]);
  }

  const ordered = [...groups.values()].sort((a, b) => {
    const ta = Date.parse(a[0]?.publishedAt ?? '') || 0;
    const tb = Date.parse(b[0]?.publishedAt ?? '') || 0;
    return tb - ta;
  });

  const out: Video[] = [];
  let depth = 0;
  let addedThisRound = true;
  while (addedThisRound) {
    addedThisRound = false;
    for (const group of ordered) {
      const item = group[depth];
      if (item) {
        out.push(item);
        addedThisRound = true;
      }
    }
    depth += 1;
  }
  return out;
}
