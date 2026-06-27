import { useState } from 'react';
import { Link } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import type { Video } from '../lib/youtube/types';
import { Badge } from './Badge';
import { DownloadButton } from './DownloadButton';
import { CommentPreview } from './CommentPreview';
import { useInView } from '../hooks/useInView';
import { useComments } from '../hooks/useComments';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { formatDuration } from '../lib/youtube/duration';
import { relativeAge, isNew, scheduledLabel } from '../lib/format';
import { CHANNELS_BY_KEY } from '../config/channels';

type VideoCardProps = {
  video: Video;
  seen?: boolean;
  onToggleSeen?: (video: Video) => void;
  /** When the laptop extractor is reachable, show a "Baixar" action. */
  extractorOnline?: boolean;
  downloaded?: boolean;
  /** Show a couple of top comments (lazy, once the card scrolls into view). */
  showComments?: boolean;
  /** 0..1 watch progress; draws a YouTube-style bar across the thumbnail. */
  progress?: number;
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

/** Gold "rare sticker" badge for a fresh epic upload. */
function EpicBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-950 shadow-sm ring-1 ring-amber-200/70">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.7 6.4 6.9.5-5.3 4.5 1.7 6.7L12 17.6 6 21.1l1.7-6.7L2.4 9.9l6.9-.5L12 2.5z" />
      </svg>
      Epic
    </span>
  );
}

export function VideoCard({
  video,
  seen = false,
  onToggleSeen,
  extractorOnline = false,
  downloaded = false,
  showComments = false,
  progress = 0,
}: VideoCardProps) {
  const isLive = video.liveState === 'live';
  const isUpcoming = video.liveState === 'upcoming';
  const duration = formatDuration(video.durationSeconds);
  const reduceMotion = useReducedMotion();
  const showProgress = progress > 0 && !isLive && !isUpcoming;
  // Fresh upload from an "epic" channel (MrBeast): gold rare-sticker treatment.
  const isFresh = !isLive && !isUpcoming && isNew(video.publishedAt);
  const epic = isFresh && Boolean(CHANNELS_BY_KEY[video.channelKey]?.epicNew);

  // Lazily load a couple of comments once the card scrolls into view, to keep
  // the feed lively without spending quota on cards nobody reaches.
  const { ref: inViewRef, inView } = useInView<HTMLElement>();
  const commentsEnabled = showComments && inView && !isUpcoming;
  const commentsQuery = useComments(video.id, commentsEnabled);

  const handleToggle = () => onToggleSeen?.(video);

  return (
    <m.article
      ref={inViewRef}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group flex flex-col gap-3 ${seen ? 'opacity-60' : ''}`}
    >
      <div
        className={
          epic
            ? 'animate-goldglow rounded-2xl bg-[linear-gradient(135deg,#fde68a_0%,#f59e0b_22%,#fff7cc_42%,#d97706_60%,#fbbf24_80%,#b45309_100%)] p-[3px]'
            : ''
        }
      >
        <div className={`relative ${epic ? 'overflow-hidden rounded-xl' : ''}`}>
          <Link
            to={`/watch/${video.id}`}
            className="block aspect-video overflow-hidden rounded-xl bg-surface-2"
            aria-label={video.title}
          >
            <Thumbnail src={video.thumbnailUrl} alt={video.title} />
          </Link>

          {/* Epic: a gold light streak that sweeps across the thumbnail. */}
          {epic && !reduceMotion && (
            <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
              <div className="animate-goldshine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
            </div>
          )}

          {/* Top left status badges */}
          <div className="pointer-events-none absolute left-2 top-2 z-[2] flex gap-1.5">
            {isLive && <Badge variant="live">LIVE</Badge>}
            {isUpcoming && <Badge variant="overlay">SCHEDULED</Badge>}
            {!isLive &&
              !isUpcoming &&
              (epic ? <EpicBadge /> : isNew(video.publishedAt) && <Badge variant="accent">NEW</Badge>)}
          </div>

          {/* Duration badge (hidden for live and upcoming) */}
          {!isLive && !isUpcoming && duration && (
            <div className="pointer-events-none absolute bottom-2 right-2 z-[2]">
              <Badge variant="overlay">{duration}</Badge>
            </div>
          )}

          {/* Watch progress bar, pinned to the bottom edge of the thumbnail. */}
          {showProgress && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1 overflow-hidden rounded-b-xl bg-black/40">
              <div
                className="h-full bg-accent-500"
                style={{ width: `${Math.min(100, Math.max(4, progress * 100))}%` }}
              />
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
          {extractorOnline && (
            <div className="mt-2">
              <DownloadButton video={video} online={extractorOnline} downloaded={downloaded} variant="card" />
            </div>
          )}
        </div>
      </div>

      {showComments && (
        <CommentPreview
          comments={commentsQuery.data?.comments ?? []}
          disabled={commentsQuery.data?.disabled}
          loading={commentsEnabled && commentsQuery.isLoading}
          variant="card"
        />
      )}
    </m.article>
  );
}
