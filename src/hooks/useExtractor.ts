import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Talks to the laptop extractor (local-server) when the app is opened through
 * the Cloudflare tunnel. The extractor and the app share one origin there, so
 * these are plain relative requests.
 *
 * The deployed Vercel site has no extractor: any unknown path falls through to
 * the SPA rewrite and returns 200 with index.html. So we never trust the status
 * code alone. The extractor is "online" only when /health returns JSON whose
 * `extractor` field is exactly true.
 */

export type ExtractorTools = {
  ytdlp: string | null;
  ffmpeg: string | null;
  cloudflared: string | null;
};

export type ExtractorHealth = {
  extractor: true;
  name: string;
  version: string;
  tools: ExtractorTools;
  cookies: string | false;
  downloads: number;
};

async function fetchJson(path: string, signal?: AbortSignal): Promise<unknown | null> {
  try {
    const res = await fetch(path, {
      signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    // The Vercel SPA fallback serves text/html; reject anything non-JSON before
    // trying to parse it.
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function probeHealth(signal?: AbortSignal): Promise<ExtractorHealth | null> {
  const json = await fetchJson('/health', signal);
  if (json && typeof json === 'object' && (json as { extractor?: unknown }).extractor === true) {
    return json as ExtractorHealth;
  }
  return null;
}

/** Is the laptop extractor reachable right now, and what tools does it have. */
export function useExtractorHealth() {
  const query = useQuery({
    queryKey: ['extractor', 'health'],
    queryFn: ({ signal }) => probeHealth(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return {
    online: query.data != null,
    health: query.data ?? null,
    refetch: query.refetch,
  };
}

/** The set of video ids already downloaded on the laptop (to hide from the feed). */
export function useDownloaded(enabled: boolean) {
  const query = useQuery({
    queryKey: ['extractor', 'downloaded'],
    queryFn: async ({ signal }) => {
      const json = await fetchJson('/downloaded', signal);
      const ids = (json as { ids?: unknown })?.ids;
      return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
    },
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 15_000 : false,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const downloadedIds = useMemo(() => new Set(query.data ?? []), [query.data]);
  return {
    downloadedIds,
    isDownloaded: (id: string) => downloadedIds.has(id),
    refetch: query.refetch,
  };
}

// ----- Batch downloads (paste many links, download to the laptop) -----------

export type DownloadFormat = 'video' | 'audio';
export type DownloadJobStatus = 'queued' | 'downloading' | 'done' | 'error';

export type DownloadJob = {
  id: string;
  title: string;
  format: DownloadFormat;
  status: DownloadJobStatus;
  error?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type QueueResult = {
  accepted: { id: string; status: DownloadJobStatus }[];
  invalid: string[];
};

/** Queue a batch of video ids on the laptop extractor. */
export async function queueDownloads(
  ids: string[],
  format: DownloadFormat = 'video',
): Promise<QueueResult> {
  const res = await fetch('/downloads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ urls: ids, format }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`A fila recusou o pedido (${res.status}).`);
  const json = (await res.json()) as Partial<QueueResult>;
  return {
    accepted: Array.isArray(json.accepted) ? json.accepted : [],
    invalid: Array.isArray(json.invalid) ? json.invalid : [],
  };
}

/** Live status of the batch download queue (polled while the page is open). */
export function useDownloadJobs(enabled: boolean) {
  const query = useQuery({
    queryKey: ['extractor', 'jobs'],
    queryFn: async ({ signal }) => {
      const json = await fetchJson('/jobs', signal);
      const jobs = (json as { jobs?: unknown })?.jobs;
      return Array.isArray(jobs) ? (jobs as DownloadJob[]) : [];
    },
    enabled,
    staleTime: 1000,
    refetchInterval: enabled ? 2000 : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return { jobs: query.data ?? [], refetch: query.refetch };
}
