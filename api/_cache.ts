/**
 * Tiny in-memory response cache for the serverless functions.
 *
 * IMPORTANT: in-memory cache does NOT survive cold starts. A new function
 * instance starts empty. So this is only a best effort warm-instance cache.
 * The real cross-request caching comes from the Vercel CDN (Cache-Control
 * s-maxage + stale-while-revalidate) and the client (TanStack Query). We keep
 * a "last good feed" here mainly so a warm instance can serve stale data if the
 * quota is exhausted mid-session.
 */

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

/** Clear all cached entries. Used by tests to isolate cases. */
export function cacheClear(): void {
  store.clear();
}
