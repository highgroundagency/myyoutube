import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../lib/youtube/types';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { formatDuration } from '../lib/youtube/duration';
import { relativeAge } from '../lib/format';
import { sortNewestFirst } from '../lib/youtube/filters';

type RecommendedRailProps = {
  videos: Video[];
  currentId: string;
  channelKey: string;
  isSeen: (id: string) => boolean;
};

/**
 * Recommendations from my channels only (section 11). Unseen, watchable videos,
 * same channel first then the rest, newest first, excluding the current video.
 */
export function RecommendedRail({ videos, currentId, channelKey, isSeen }: RecommendedRailProps) {
  const list = useMemo(() => {
    const candidates = videos.filter(
      (v) => v.id !== currentId && v.liveState !== 'upcoming' && !isSeen(v.id),
    );
    const sameChannel = sortNewestFirst(candidates.filter((v) => v.channelKey === channelKey));
    const others = sortNewestFirst(candidates.filter((v) => v.channelKey !== channelKey));
    return [...sameChannel, ...others].slice(0, 20);
  }, [videos, currentId, channelKey, isSeen]);

  if (list.length === 0) {
    return <p className="text-sm text-fg-muted">No more videos to recommend right now.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {list.map((video) => (
        <RecommendedCard key={video.id} video={video} />
      ))}
    </div>
  );
}

function RecommendedCard({ video }: { video: Video }) {
  const [errored, setErrored] = useState(false);
  const duration = formatDuration(video.durationSeconds);
  const isLive = video.liveState === 'live';

  return (
    <Link to={`/watch/${video.id}`} className="group flex gap-3">
      <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        <img
          src={errored ? PLACEHOLDER_THUMBNAIL : video.thumbnailUrl}
          alt={video.title}
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
        {isLive ? (
          <span className="absolute bottom-1 right-1 rounded bg-red-600 px-1 py-0.5 text-[10px] font-semibold text-white">
            LIVE
          </span>
        ) : (
          duration && (
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white">
              {duration}
            </span>
          )
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="clamp-2 text-sm font-medium leading-snug text-fg group-hover:text-accent-600">
          {video.title}
        </h4>
        <p className="mt-1 truncate text-xs text-fg-muted">{video.channelLabel}</p>
        <p className="text-xs text-fg-muted">
          {isLive ? 'Live now' : relativeAge(video.publishedAt)}
        </p>
      </div>
    </Link>
  );
}
