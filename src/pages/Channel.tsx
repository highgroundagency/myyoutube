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
  const { isSeen, markSeen, markManySeen, unmark, records } = useWatchState();
  const query = useAppSearch().toLowerCase();
  const [showWatched, setShowWatched] = useState(false);

  const all = feedQuery.data?.videos ?? [];
  // Scheduled premieres/streams can't be watched yet, so keep them out.
  const channelVideos = all.filter(
    (v) => v.channelKey === channelKey && v.liveState !== 'upcoming',
  );
  const label = channelVideos[0]?.channelLabel ?? CHANNELS_BY_KEY[channelKey]?.label ?? 'Channel';

  const display = sortNewestFirst(
    channelVideos.filter((v) => {
      if (query && !v.title.toLowerCase().includes(query)) return false;
      if (!showWatched && isSeen(v.id)) return false;
      return true;
    }),
  );

  // Watchable, not-yet-seen videos this "mark all as seen" action would clear.
  const markable = channelVideos.filter((v) => v.liveState === 'none' && !isSeen(v.id));

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
        <div className="flex items-center gap-2">
          <MarkAllSeenButton count={markable.length} onConfirm={() => markManySeen(markable)} />
          <button
            type="button"
            onClick={() => setShowWatched((s) => !s)}
            aria-pressed={showWatched}
            className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            {showWatched ? 'Hide watched' : 'Show watched'}
          </button>
        </div>
      </div>

      {display.length === 0 ? (
        channelVideos.length === 0 ? (
          <EmptyState title="Nothing here yet" message="No recent videos from this channel." />
        ) : (
          <EmptyState title="All caught up" message="You have watched everything recent here." />
        )
      ) : (
        <VideoGrid videos={display} isSeen={isSeen} onToggleSeen={onToggleSeen} records={records} />
      )}
    </div>
  );
}

/**
 * "Mark all as seen" for the whole channel, with a quick confirm so a stray tap
 * does not wipe the channel out of the feed. Hidden when nothing is left to mark.
 */
function MarkAllSeenButton({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (count === 0) return null;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        Marcar tudo como assistido
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-fg-muted">Marcar {count}?</span>
      <button
        type="button"
        onClick={() => {
          onConfirm();
          setConfirming(false);
        }}
        className="rounded-full bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600"
      >
        Sim
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2"
      >
        Cancelar
      </button>
    </div>
  );
}
