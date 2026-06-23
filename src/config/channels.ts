/**
 * The closed pool of channels. This is the whole world of content the app shows.
 * Plain data, imported by both the client and the /api functions.
 *
 * A channel can be resolved three ways, in priority order:
 *  1. channelId: resolve directly via channels.list?id (most reliable). Optionally
 *     verified against expectedTitleIncludes, and falls back to search if it does
 *     not match (guards against a wrong same-named or "- Topic" channel).
 *  2. handle: resolve via channels.list?forHandle (with a no-@ retry).
 *  3. searchName (or label): resolve via search.list as a last resort.
 * Anything that does not resolve is skipped in the feed and reported, never a crash.
 */

export type ChannelCategory = 'entertainment' | 'health' | 'language' | 'faith' | 'sports';

export type ChannelConfig = {
  /** Internal stable id, used for joins and stats. Never changes. */
  key: string;
  /** Display name shown in the app. */
  label: string;
  /** YouTube @handle, when known. Optional. */
  handle?: string;
  /** Resolve this channel directly by id, skipping handle resolution. */
  channelId?: string;
  /** Exact name to use for the search fallback (defaults to label). */
  searchName?: string;
  /**
   * When resolving by channelId, the resolved title must contain this string
   * (case insensitive). If it does not, the id is ignored and we fall back to
   * searching searchName, so a wrong same-named or "- Topic" channel is rejected.
   */
  expectedTitleIncludes?: string;
  /** Run the eventType=live check for this channel (costs 100 units, cache it). */
  liveCheck?: boolean;
  category?: ChannelCategory;
};

export const CHANNELS: ChannelConfig[] = [
  { key: 'mrbeast', handle: '@MrBeast', label: 'MrBeast', category: 'entertainment' },
  { key: 'mrbeastgaming', handle: '@MrBeastGaming', label: 'MrBeast Gaming', category: 'entertainment' },
  { key: 'bryanjohnson', handle: '@bryanjohnson', label: 'Bryan Johnson', category: 'health' },
  { key: 'cazetv', handle: '@CazeTV', label: 'Caze TV', category: 'sports', liveCheck: true },
  // Resolved by search (no handle needed).
  { key: 'mandarin', label: 'Mandarin Corner', searchName: 'Mandarin Corner', category: 'language' },
  { key: 'josephprince', handle: '@JosephPrince', label: 'Joseph Prince', category: 'faith' },
  // Resolved directly by id, verified against the expected teaching channel title.
  // If the id ever returns a different channel, it falls back to searching the name.
  {
    key: 'andrewfarley',
    channelId: 'UCngAqvQikHu7RF9kVs8M29g',
    label: 'Andrew Farley (The Grace Message)',
    expectedTitleIncludes: 'The Grace Message with Dr. Andrew Farley',
    searchName: 'The Grace Message with Dr. Andrew Farley',
    category: 'faith',
  },
];

/** Quick lookup by internal key. */
export const CHANNELS_BY_KEY: Record<string, ChannelConfig> = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c]),
);

/** The placeholder handle that means "not chosen yet". */
export const UNRESOLVED_HANDLE = '@CHANGE_ME';
