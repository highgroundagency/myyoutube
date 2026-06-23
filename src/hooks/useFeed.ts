import { useQuery } from '@tanstack/react-query';
import { fetchFeed } from '../lib/api/youtube';
import { FEED_STALE_MS } from '../config/constants';

/**
 * The feed query. Caching, retries with backoff, request dedup, and the four
 * loading states all come from TanStack Query (section 3, 15). The fetcher
 * already handles MOCK_MODE and the missing-key fallback.
 */
export function useFeed() {
  return useQuery({
    queryKey: ['feed'],
    queryFn: ({ signal }) => fetchFeed(signal),
    staleTime: FEED_STALE_MS,
  });
}
