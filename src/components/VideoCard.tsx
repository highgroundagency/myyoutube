import { useState } from 'react';
import { Link } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import type { Video } from '../lib/youtube/types';
import { Badge } from './Badge';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { formatDuration } from '../lib/youtube/duration';
import { relativeAge, isNew, scheduledLabel } from '../lib/format';

type VideoCardProps = {
  video: Video;
  seen?: boolean;
  onToggleSeen?: (video: Video) => void;
};

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  return (
    <img
      src={errored ? PLACEHOLDER_THUMBNAIL : src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      // Fixed 16:9 box with object-cover so the grid never shifts as images load.
      className="h-full w-full object-cover"
    />
  );
}

function Monogram({ label }: { label: string }) {
  const letter = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-fg-muted"
    >
      {letter}
    </div>
  );
}

export function VideoCard({ video, seen = false, onToggleSeen }: VideoCardProps) {
  const isLive = video.liveState === 'live';
  const isUpcoming = video.liveState === 'upcoming';
  const duration = formatDuration(video.durationSeconds);
  const reduceMotion = useReducedMotion();

  const handleToggle = () => onToggleSeen?.(video);

  return (
    <m.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group flex flex-col gap-3 ${seen ? 'opacity-60' : ''}`}
    >
      <div className="relative">
        <Link
          to={`/watch/${video.id}`}
          className="block aspect-video overflow-hidden rounded-xl bg-surface-2"
          aria-label={video.title}
        >
          <Thumbnail src={video.thumbnailUrl} alt={video.title} />
        </Link>

        {/* Top left status badges */}
        <div className="pointer-events-none absolute left-2 top-2 flex gap-1.5">
          {isLive && <Badge variant="live">LIVE</Badge>}
          {isUpcoming && <Badge variant="overlay">SCHEDULED</Badge>}
          {!isLive && !isUpcoming && isNew(video.publishedAt) && <Badge variant="accent">NEW</Badge>}
        </div>

        {/* Duration badge (hidden for live and upcoming) */}
        {!isLive && !isUpcoming && duration && (
          <div className="pointer-events-none absolute bottom-2 right-2">
            <Badge variant="overlay">{duration}</Badge>
          </div>
        )}

        {/* Mark as seen / unseen quick action */}
        {onToggleSeen && (
          <button
            type="button"
            onClick={handleToggle}
            aria-label={seen ? 'Mark as not seen' : 'Mark as already seen'}
            title={seen ? 'Mark as not seen' : 'Mark as already seen'}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity hover:bg-black/90 focus-visible:opacity-100 group-hover:opacity-100"
          >
            {seen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m2 2 20 20M6.7 6.7A10.5 10.5 0 0 0 1 12s4 7 11 7a10.5 10.5 0 0 0 5.3-1.4M9.9 5.2A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a18.4 18.4 0 0 1-2.2 3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <Link to={`/channel/${video.channelKey}`} aria-label={video.channelLabel}>
          <Monogram label={video.channelLabel} />
        </Link>
        <div className="min-w-0">
          <Link to={`/watch/${video.id}`} className="block">
            <h3 className="clamp-2 text-sm font-medium leading-snug text-fg">{video.title}</h3>
          </Link>
          <Link
            to={`/channel/${video.channelKey}`}
            className="mt-1 block truncate text-xs text-fg-muted hover:text-fg"
          >
            {video.channelLabel}
          </Link>
          <p className="mt-0.5 text-xs text-fg-muted">
            {isUpcoming ? (
              scheduledLabel(video.scheduledStartTime)
            ) : isLive ? (
              'Live now'
            ) : (
              <>
                {relativeAge(video.publishedAt)}
                {seen && <span className="ml-1 text-accent-600">watched</span>}
              </>
            )}
          </p>
        </div>
      </div>
    </m.article>
  );
}
