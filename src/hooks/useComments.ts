import { useQuery } from '@tanstack/react-query';
import { fetchComments } from '../lib/api/youtube';
import type { CommentsResult } from '../lib/youtube/types';

/**
 * Top comments for a video. Gated by `enabled` so cards can defer the fetch
 * until they scroll into view. Cached for an hour since comments change slowly.
 */
export function useComments(videoId: string, enabled: boolean) {
  return useQuery<CommentsResult>({
    queryKey: ['comments', videoId],
    queryFn: ({ signal }) => fetchComments(videoId, signal),
    enabled: enabled && Boolean(videoId),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
