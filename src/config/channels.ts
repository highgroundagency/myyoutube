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

/**
 * Per-channel curation. Lets a channel show its full history, only new uploads,
 * or only videos whose title matches a keyword. Live and upcoming videos are
 * always exempt from these filters.
 */
export type ChannelCuration = {
  /** Fetch the full upload history (paginated, capped), not just the latest page. */
  fetchAll?: boolean;
  /** Explicit cap on uploads to fetch for this channel. */
  maxVideos?: number;
  /** Only keep videos published on or after this ISO date. */
  publishedAfter?: string;
  /** Only keep videos whose title contains one of these (accent/case insensitive). */
  titleIncludesAny?: string[];
};

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
  /** Optional curation rules for what this channel contributes to the feed. */
  curation?: ChannelCuration;
  /**
   * Give this channel's fresh uploads the "epic" golden frame in the feed, like
   * a rare gold sticker. Used for channels whose every new drop is an event.
   */
  epicNew?: boolean;
  category?: ChannelCategory;
};

export const CHANNELS: ChannelConfig[] = [
  // MrBeast posts every Saturday. Gabe is caught up, so both channels only show
  // uploads from this Saturday on; the back catalog stays hidden. Every fresh
  // drop gets the epic golden frame.
  {
    key: 'mrbeast',
    handle: '@MrBeast',
    label: 'MrBeast',
    category: 'entertainment',
    curation: { publishedAfter: '2026-06-27T00:00:00.000Z' },
    epicNew: true,
  },
  {
    key: 'mrbeastgaming',
    handle: '@MrBeastGaming',
    label: 'MrBeast Gaming',
    category: 'entertainment',
    curation: { publishedAfter: '2026-06-27T00:00:00.000Z' },
    epicNew: true,
  },
  // Pull Bryan Johnson's full catalog, not just the latest page.
  { key: 'bryanjohnson', handle: '@bryanjohnson', label: 'Bryan Johnson', category: 'health', curation: { fetchAll: true } },
  // Caze TV: only "melhores momentos" highlights in the feed; live arrives via the live check.
  {
    key: 'cazetv',
    handle: '@CazeTV',
    label: 'Caze TV',
    category: 'sports',
    liveCheck: true,
    curation: { titleIncludesAny: ['melhores momentos'] },
  },
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
