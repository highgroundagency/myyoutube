import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFeed } from '../hooks/useFeed';
import { useWatchState } from '../hooks/useWatchState';
import { useAppSearch } from '../components/appOutletContext';
import { VideoGrid } from '../components/VideoGrid';
import { VideoGridSkeleton } from '../components/Skeletons';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { sortNewestFirst } from '../lib/youtube/filters';
import { CHANNELS_BY_KEY } from '../config/channels';
import type { Video } from '../lib/youtube/types';

export function Channel() {
  const { channelKey = '' } = useParams();
  const feedQuery = useFeed();
  const { isSeen, markSeen, unmark } = useWatchState();
  const query = useAppSearch().toLowerCase();
  const [showWatched, setShowWatched] = useState(false);

  const all = feedQuery.data?.videos ?? [];
  const channelVideos = all.filter((v) => v.channelKey === channelKey);
  const label = channelVideos[0]?.channelLabel ?? CHANNELS_BY_KEY[channelKey]?.label ?? 'Channel';

  const display = sortNewestFirst(
    channelVideos.filter((v) => {
      if (query && !v.title.toLowerCase().includes(query)) return false;
      if (!showWatched && isSeen(v.id)) return false;
      return true;
    }),
  );

  const onToggleSeen = (video: Video) => {
    if (isSeen(video.id)) unmark(video.id);
    else markSeen(video);
  };

  if (feedQuery.isLoading) {
    return <VideoGridSkeleton count={8} />;
  }
  if (feedQuery.isError && !feedQuery.data) {
    return <ErrorState onRetry={() => feedQuery.refetch()} />;
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{label}</h1>
          <p className="text-sm text-fg-muted">
            {channelVideos.length} recent {channelVideos.length === 1 ? 'video' : 'videos'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWatched((s) => !s)}
          aria-pressed={showWatched}
          className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          {showWatched ? 'Hide watched' : 'Show watched'}
        </button>
      </div>

      {display.length === 0 ? (
        channelVideos.length === 0 ? (
          <EmptyState title="Nothing here yet" message="No recent videos from this channel." />
        ) : (
          <EmptyState title="All caught up" message="You have watched everything recent here." />
        )
      ) : (
        <VideoGrid videos={display} isSeen={isSeen} onToggleSeen={onToggleSeen} />
      )}
    </div>
  );
}
