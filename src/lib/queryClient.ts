import { QueryClient } from '@tanstack/react-query';

/**
 * The shared TanStack Query client. Per section 7 we want retries with backoff
 * for transient failures, but we must NOT retry deterministic errors (quota,
 * bad key). Fetchers throw a typed error (see src/lib/youtube/errors.ts) whose
 * `retryable` flag drives this decision.
 */
function isRetryable(error: unknown): boolean {
  if (error && typeof error === 'object' && 'retryable' in error) {
    return Boolean((error as { retryable?: boolean }).retryable);
  }
  // Unknown errors (network blips) are retried a couple of times.
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => isRetryable(error) && failureCount < 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      gcTime: 60 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
});
