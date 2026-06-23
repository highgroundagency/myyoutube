import { useQuery } from '@tanstack/react-query';
import { fetchVideo } from '../lib/api/youtube';
import { FEED_STALE_MS } from '../config/constants';

/**
 * On demand single video fetch for the watch page, used only when the video is
 * not already in the loaded feed pool. Disabled (no request) otherwise.
 */
export function useVideo(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['video', id],
    queryFn: ({ signal }) => fetchVideo(id as string, signal),
    enabled: enabled && Boolean(id),
    staleTime: FEED_STALE_MS,
  });
}
