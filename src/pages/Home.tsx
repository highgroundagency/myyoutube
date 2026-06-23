import { useMemo, useState } from 'react';
import { useFeed } from '../hooks/useFeed';
import { useLive } from '../hooks/useLive';
import { useWatchState } from '../hooks/useWatchState';
import { useAppSearch } from '../components/appOutletContext';
import { VideoGrid } from '../components/VideoGrid';
import { VideoGridSkeleton } from '../components/Skeletons';
import { ChannelChips } from '../components/ChannelChips';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Banner } from '../components/Banner';
import { LiveBanner } from '../components/LiveBanner';
import { interleaveByChannel } from '../lib/feed/interleave';
import { sortNewestFirst } from '../lib/youtube/filters';
import { CHANNELS } from '../config/channels';
import type { Video } from '../lib/youtube/types';

const PAGE_SIZE = 24;
const CHANNEL_ORDER = new Map(CHANNELS.map((c, i) => [c.key, i]));

export function Home() {
  const feedQuery = useFeed();
  const liveQuery = useLive();
  const { isSeen, markSeen, unmark } = useWatchState();
  const query = useAppSearch().toLowerCase();

  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [showWatched, setShowWatched] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const feedVideos = feedQuery.data?.videos;
  const liveVideos = liveQuery.data?.live;

  // Merge the feed with live status. Live items may not be in the feed yet.
  const merged = useMemo(() => {
    const byId = new Map<string, Video>();
    for (const v of feedVideos ?? []) byId.set(v.id, v);
    for (const v of liveVideos ?? []) {
      const existing = byId.get(v.id);
      byId.set(v.id, { ...(existing ?? v), ...v, liveState: 'live' });
    }
    return [...byId.values()];
  }, [feedVideos, liveVideos]);

  const channelChips = useMemo(() => {
    const labels = new Map<string, string>();
    for (const v of merged) if (!labels.has(v.channelKey)) labels.set(v.channelKey, v.channelLabel);
    return [...labels.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => (CHANNEL_ORDER.get(a.key) ?? 99) - (CHANNEL_ORDER.get(b.key) ?? 99));
  }, [merged]);

  const display = useMemo(() => {
    const filtered = merged.filter((v) => {
      if (activeChannel && v.channelKey !== activeChannel) return false;
      if (query && !`${v.title} ${v.channelLabel}`.toLowerCase().includes(query)) return false;
      if (!showWatched && isSeen(v.id)) return false;
      return true;
    });

    const live = sortNewestFirst(filtered.filter((v) => v.liveState === 'live'));
    const rest = filtered.filter((v) => v.liveState !== 'live');
    // Interleave channels for the full feed; a single channel filter or a search
    // just wants newest first.
    const restOrdered = activeChannel || query ? sortNewestFirst(rest) : interleaveByChannel(sortNewestFirst(rest));
    return [...live, ...restOrdered];
  }, [merged, activeChannel, query, showWatched, isSeen]);

  const onToggleSeen = (video: Video) => {
    if (isSeen(video.id)) unmark(video.id);
    else markSeen(video);
  };

  // Loading: first load with no data yet.
  if (feedQuery.isLoading) {
    return (
      <div>
        <div className="mb-5 h-9" />
        <VideoGridSkeleton count={12} />
      </div>
    );
  }

  // Error: failed and we have nothing to show.
  if (feedQuery.isError && !feedQuery.data) {
    return (
      <ErrorState
        title="Could not load your feed"
        message="There was a problem reaching the feed. Check your connection and try again."
        onRetry={() => feedQuery.refetch()}
      />
    );
  }

  const data = feedQuery.data;
  const visibleVideos = display.slice(0, visible);

  return (
    <div>
      {data?.mock && <Banner tone="info">{data.notice ?? 'Showing mock data (no API key needed).'}</Banner>}
      {data?.stale && !data.mock && (
        <Banner tone="warning">{data.notice ?? 'Showing cached content.'}</Banner>
      )}

      <LiveBanner live={sortNewestFirst(merged.filter((v) => v.liveState === 'live'))} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChannelChips channels={channelChips} active={activeChannel} onSelect={setActiveChannel} />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWatched((s) => !s)}
            aria-pressed={showWatched}
            className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            {showWatched ? 'Hide watched' : 'Show watched'}
          </button>
          <button
            type="button"
            onClick={() => {
              feedQuery.refetch();
              liveQuery.refetch();
            }}
            aria-label="Refresh feed"
            title="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={feedQuery.isFetching ? 'animate-spin' : ''}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {display.length === 0 ? (
        merged.length === 0 ? (
          <EmptyState
            title="You are all caught up"
            message="There are no new videos from your channels right now. Check back later."
          />
        ) : (
          <EmptyState
            title="No videos match"
            message="Nothing here matches your search or filters."
            action={
              <button
                type="button"
                onClick={() => {
                  setActiveChannel(null);
                  setShowWatched(true);
                }}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
              >
                Clear filters
              </button>
            }
          />
        )
      ) : (
        <>
          <VideoGrid videos={visibleVideos} isSeen={isSeen} onToggleSeen={onToggleSeen} />
          {visible < display.length && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-fg hover:bg-surface-2"
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
