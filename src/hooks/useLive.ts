import { useQuery } from '@tanstack/react-query';
import { fetchLive } from '../lib/api/youtube';
import { LIVE_STALE_MS } from '../config/constants';

/**
 * Live status query. Short stale time and a periodic refetch while the app is
 * open so a Caze TV stream going live appears without a manual refresh. The
 * serverless live check is cached server side, so this stays cheap on quota.
 */
export function useLive() {
  return useQuery({
    queryKey: ['live'],
    queryFn: ({ signal }) => fetchLive(signal),
    staleTime: LIVE_STALE_MS,
    refetchInterval: 2 * 60 * 1000,
    refetchIntervalInBackground: false,
  });
}
