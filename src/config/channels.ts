/**
 * The closed pool of channels. This is the whole world of content the app shows.
 * Plain data, imported by both the client and the /api functions.
 *
 * Every handle below is UNVERIFIED until the resolution script confirms it
 * (npm run resolve-channels, section 6). A handle that does not resolve is
 * skipped in the feed and reported, never a crash.
 */

export type ChannelCategory = 'entertainment' | 'health' | 'language' | 'faith' | 'sports';

export type ChannelConfig = {
  /** Internal stable id, used for joins and stats. Never changes. */
  key: string;
  /** YouTube @handle used to resolve the channelId. */
  handle: string;
  /** Display name. */
  label: string;
  /** Run the eventType=live check for this channel (costs 100 units, cache it). */
  liveCheck?: boolean;
  category?: ChannelCategory;
};

export const CHANNELS: ChannelConfig[] = [
  { key: 'mrbeast', handle: '@MrBeast', label: 'MrBeast', category: 'entertainment' },
  { key: 'mrbeastgaming', handle: '@MrBeastGaming', label: 'MrBeast Gaming', category: 'entertainment' },
  { key: 'bryanjohnson', handle: '@bryanjohnson', label: 'Bryan Johnson', category: 'health' },
  { key: 'cazetv', handle: '@CazeTV', label: 'Caze TV', category: 'sports', liveCheck: true },
  // TODO: Gabe will replace @CHANGE_ME with the real Mandarin lessons handle.
  // Until then this channel is skipped in the feed (it will not resolve).
  { key: 'mandarin', handle: '@CHANGE_ME', label: 'Mandarin lessons', category: 'language' },
  { key: 'josephprince', handle: '@JosephPrince', label: 'Joseph Prince', category: 'faith' },
  { key: 'andrewfarley', handle: '@AndrewFarley', label: 'Andrew Farley', category: 'faith' },
];

/** Quick lookup by internal key. */
export const CHANNELS_BY_KEY: Record<string, ChannelConfig> = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c]),
);

/** The placeholder handle that means "not chosen yet". */
export const UNRESOLVED_HANDLE = '@CHANGE_ME';
