/**
 * Single source of truth for tunable config: thresholds, cache TTLs, app identity.
 *
 * DECISION: This file is intentionally PURE. It must not read import.meta.env or
 * process.env, because it is imported by BOTH the client (src) and the server
 * (/api) functions. Client only, env derived values (MOCK_MODE, embed host)
 * live in src/config/env.ts so the server can safely import this file.
 */

// ----- App identity ---------------------------------------------------------

/** Change this one constant to rebrand (for example to "MyTube"). */
export const APP_NAME = 'GabesVideos';

/**
 * Accent color hex, muted coral red.
 * Keep in sync with the `accent.500` value in tailwind.config.js.
 * The SVG logo reads this so there is one place to change the brand color.
 */
export const ACCENT_HEX = '#f2555a';

/** Default embed host if VITE_EMBED_HOST is not set. Premium friendly. */
export const DEFAULT_EMBED_HOST = 'https://www.youtube.com';

// ----- Filtering thresholds (section 9) -------------------------------------

/**
 * Videos at or under this duration are treated as Shorts and dropped.
 * 180s is the current YouTube Shorts maximum. Tune here if it changes.
 * Note: live and upcoming videos have durationSeconds === 0 and are NOT filtered
 * by this rule (0 is the "unknown duration" sentinel, not a 0 second Short).
 */
export const SHORTS_MAX_SECONDS = 180;

/** Videos newer than this many days get a NEW badge. */
export const NEW_VIDEO_DAYS = 7;

// ----- YouTube Data API layer (section 7) -----------------------------------

/** videos.list accepts at most 50 ids per call. */
export const VIDEOS_LIST_CHUNK = 50;

/** How many recent uploads to pull per channel. The newest page is enough. */
export const UPLOADS_PER_CHANNEL = 50;

/** Transient error retry budget for the YouTube client. */
export const YT_MAX_RETRIES = 3;

// ----- Player + watch tracking (section 12) ---------------------------------

/** Only mark a video "seen" after this many real seconds of playback. */
export const SEEN_THRESHOLD_SECONDS = 3;

/** Mark "completed" when furthest position reaches this ratio of duration. */
export const COMPLETION_RATIO = 0.9;

/** Heartbeat cadence while playing (accrue watch time, sample position). */
export const HEARTBEAT_MS = 5000;

/** Flush accumulated watch seconds to persistence on this cadence. */
export const FLUSH_INTERVAL_MS = 20000;

// ----- Region (section 9.5) -------------------------------------------------

/**
 * Viewer region for the region-restriction check. Gabe is in Brazil.
 * A video whose regionRestriction blocks this code shows a friendly
 * "not available in your region" state instead of a broken embed.
 */
export const VIEWER_REGION = 'BR';

// ----- Stats (section 14) ---------------------------------------------------

/** A day counts toward the streak if it has at least this many watch minutes. */
export const STREAK_MIN_MINUTES = 5;

// ----- Cache TTLs -----------------------------------------------------------

/** Client (TanStack Query) staleTime for the feed. */
export const FEED_STALE_MS = 30 * 60 * 1000;

/** Client staleTime for live status. */
export const LIVE_STALE_MS = 60 * 1000;

/** Server CDN cache for /api/feed: 30 min fresh, 10 min stale while revalidate. */
export const FEED_CACHE_CONTROL = 's-maxage=1800, stale-while-revalidate=600';

/** Server CDN cache for /api/live: short, live status changes fast. */
export const LIVE_CACHE_CONTROL = 's-maxage=60, stale-while-revalidate=60';

/** Cache window for the resolved channel map (handles rarely change). */
export const RESOLVE_CACHE_MS = 24 * 60 * 60 * 1000;

/** Cache window for the live check result inside the function. */
export const LIVE_CHECK_CACHE_MS = 5 * 60 * 1000;
