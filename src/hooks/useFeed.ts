import { useQuery } from '@tanstack/react-query';
import { fetchFeed } from '../lib/api/youtube';
import { readFeedCache, writeFeedCache } from '../lib/api/feedCache';
import { FEED_STALE_MS } from '../config/constants';

/**
 * The feed query. Caching, retries with backoff, request dedup, and the four
 * loading states all come from TanStack Query (section 3, 15). The fetcher
 * already handles MOCK_MODE and the missing-key fallback.
 *
 * The last real feed is kept on the device: the app opens straight onto it
 * (no skeletons) and refetches in the background when it is older than the
 * staleTime. Mock data is never cached.
 */
export function useFeed() {
  return useQuery({
    queryKey: ['feed'],
    queryFn: async ({ signal }) => {
      const data = await fetchFeed(signal);
      writeFeedCache(data);
      return data;
    },
    staleTime: FEED_STALE_MS,
    initialData: () => readFeedCache()?.data,
    initialDataUpdatedAt: () => readFeedCache()?.at,
  });
}
