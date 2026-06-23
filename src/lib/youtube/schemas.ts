/**
 * zod schemas for the YouTube API responses we consume. Everything is parsed
 * with safeParse so a malformed item is dropped, never thrown to the user
 * (section 4, section 8). Schemas are intentionally lenient: only the fields we
 * actually use are validated, and unknown fields pass through.
 */
import { z } from 'zod';

const thumbnailSchema = z.object({ url: z.string().optional() }).passthrough();
const thumbnailsSchema = z.record(thumbnailSchema);

// ----- playlistItems.list ---------------------------------------------------

export const playlistItemSchema = z.object({
  contentDetails: z
    .object({
      videoId: z.string().optional(),
      videoPublishedAt: z.string().optional(),
    })
    .optional(),
  snippet: z
    .object({
      title: z.string().optional(),
      publishedAt: z.string().optional(),
      channelId: z.string().optional(),
      resourceId: z.object({ videoId: z.string().optional() }).optional(),
    })
    .optional(),
});
export type PlaylistItemRaw = z.infer<typeof playlistItemSchema>;

// ----- videos.list ----------------------------------------------------------

export const videoSchema = z.object({
  id: z.string(),
  snippet: z
    .object({
      title: z.string().optional(),
      publishedAt: z.string().optional(),
      channelId: z.string().optional(),
      liveBroadcastContent: z.string().optional(),
      thumbnails: thumbnailsSchema.optional(),
    })
    .optional(),
  contentDetails: z
    .object({
      duration: z.string().optional(),
      regionRestriction: z
        .object({
          allowed: z.array(z.string()).optional(),
          blocked: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  status: z
    .object({
      uploadStatus: z.string().optional(),
      privacyStatus: z.string().optional(),
      embeddable: z.boolean().optional(),
    })
    .optional(),
  liveStreamingDetails: z
    .object({
      scheduledStartTime: z.string().optional(),
      actualStartTime: z.string().optional(),
      actualEndTime: z.string().optional(),
      concurrentViewers: z.string().optional(),
    })
    .optional(),
});
export type VideoRaw = z.infer<typeof videoSchema>;

// ----- channels.list (resolution) -------------------------------------------

export const channelSchema = z.object({
  id: z.string(),
  snippet: z
    .object({
      title: z.string().optional(),
      thumbnails: thumbnailsSchema.optional(),
    })
    .optional(),
  contentDetails: z
    .object({
      relatedPlaylists: z.object({ uploads: z.string().optional() }).optional(),
    })
    .optional(),
});
export type ChannelRaw = z.infer<typeof channelSchema>;

// ----- search.list (resolution fallback, live check) ------------------------

export const searchItemSchema = z.object({
  id: z
    .object({
      kind: z.string().optional(),
      videoId: z.string().optional(),
      channelId: z.string().optional(),
    })
    .optional(),
  snippet: z
    .object({
      title: z.string().optional(),
      channelId: z.string().optional(),
      liveBroadcastContent: z.string().optional(),
      thumbnails: thumbnailsSchema.optional(),
    })
    .optional(),
});
export type SearchItemRaw = z.infer<typeof searchItemSchema>;

// ----- Generic top level shapes ---------------------------------------------

/** A response may legitimately have items: [] or omit items entirely. */
export const listResponseSchema = z.object({
  items: z.array(z.unknown()).optional(),
  nextPageToken: z.string().optional(),
  pageInfo: z.object({ totalResults: z.number().optional() }).optional(),
});

export const apiErrorSchema = z.object({
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      errors: z
        .array(
          z.object({
            reason: z.string().optional(),
            domain: z.string().optional(),
            message: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

// ----- Canonical (our own) response shapes ----------------------------------
// Used by the client to validate /api/feed and /api/live (an external response
// from the client's point of view) and by tests to validate the fixtures.

export const canonicalVideoSchema = z.object({
  id: z.string(),
  channelKey: z.string(),
  channelLabel: z.string(),
  category: z.string().optional(),
  title: z.string(),
  thumbnailUrl: z.string().min(1),
  publishedAt: z.string(),
  durationSeconds: z.number(),
  liveState: z.enum(['none', 'live', 'upcoming']),
  scheduledStartTime: z.string().optional(),
  isEmbeddable: z.boolean(),
  isPublic: z.boolean(),
  regionRestriction: z
    .object({
      allowed: z.array(z.string()).optional(),
      blocked: z.array(z.string()).optional(),
    })
    .optional(),
});

export const resolvedChannelSchema = z.object({
  key: z.string(),
  handle: z.string(),
  label: z.string(),
  channelId: z.string().nullable(),
  uploadsPlaylistId: z.string().nullable(),
  title: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  resolvedBy: z.enum(['handle', 'handle-no-at', 'search', 'failed']),
});

export const feedResponseSchema = z.object({
  videos: z.array(canonicalVideoSchema),
  stale: z.boolean(),
  mock: z.boolean(),
  notice: z.string().nullable(),
  resolvedChannels: z.array(resolvedChannelSchema),
});

export const liveResponseSchema = z.object({
  live: z.array(canonicalVideoSchema),
  stale: z.boolean(),
  mock: z.boolean(),
  checkedAt: z.string(),
});

/**
 * Parse an array of raw items against an item schema, dropping any that fail.
 * Logs a concise warning so bad data is visible in server logs and dev, while
 * production keeps going with the good items (never throws).
 */
export function parseValidItems<T>(schema: z.ZodType<T>, items: unknown): T[] {
  if (!Array.isArray(items)) return [];
  const out: T[] = [];
  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) {
      out.push(result.data);
    } else {
      console.warn('[youtube/schemas] dropped malformed item:', result.error.issues.slice(0, 3));
    }
  }
  return out;
}
