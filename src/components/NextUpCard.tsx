import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useWatchState } from '../hooks/useWatchState';
import { pickNextUp, pruneSnoozes, type SnoozeMap } from '../lib/feed/nextUp';
import { loadSnoozes, saveSnoozes } from '../lib/feed/snoozeStore';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { formatDuration } from '../lib/youtube/duration';
import type { Video } from '../lib/youtube/types';

type NextUpCardProps = {
  videos: Video[];
  channelKey: string;
  /** Eyebrow title, e.g. "Maratona Bryan Johnson". */
  title: string;
};

/**
 * The marathon card: one recommended video (oldest unwatched) from a channel
 * whose full catalog the viewer wants to get through, with journey progress.
 * "Assistir depois" snoozes it (comes back later); "Ja assisti" marks it seen
 * and advances to the next one on the spot.
 */
export function NextUpCard({ videos, channelKey, title }: NextUpCardProps) {
  const { isSeen, markSeen } = useWatchState();
  const [snoozes, setSnoozes] = useState<SnoozeMap>(() => loadSnoozes());
  const [thumbErrored, setThumbErrored] = useState(false);

  const next = useMemo(
    () => pickNextUp(videos, channelKey, isSeen, snoozes),
    [videos, channelKey, isSeen, snoozes],
  );

  const snooze = useCallback(() => {
    if (!next) return;
    const map = pruneSnoozes({ ...snoozes, [next.video.id]: new Date().toISOString() });
    setSnoozes(map);
    saveSnoozes(map);
  }, [next, snoozes]);

  const markWatched = useCallback(() => {
    if (next) markSeen(next.video);
  }, [next, markSeen]);

  if (!next) return null;
  const { video, watched, total, progress } = next;
  const publishedYear = format(parseISO(video.publishedAt), 'yyyy');

  return (
    <section
      aria-label={title}
      className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="flex flex-col sm:flex-row">
        <Link
          to={`/watch/${video.id}`}
          className="relative block aspect-video w-full shrink-0 bg-surface-2 sm:w-72"
          aria-label={video.title}
        >
          <img
            src={thumbErrored ? PLACEHOLDER_THUMBNAIL : video.thumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setThumbErrored(true)}
            className="h-full w-full object-cover"
          />
          {video.durationSeconds > 0 && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {formatDuration(video.durationSeconds)}
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{title}</p>
            <Link to={`/watch/${video.id}`} className="mt-1 block">
              <h3 className="clamp-2 text-base font-semibold leading-snug text-fg">{video.title}</h3>
            </Link>
            <p className="mt-1 text-xs text-fg-muted">
              #{next.position} da jornada · {publishedYear}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-fg-muted">
              <span>
                {watched} de {total} assistidos
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent-500"
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                to={`/watch/${video.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7L8 5Z" />
                </svg>
                Assistir
              </Link>
              <button
                type="button"
                onClick={snooze}
                className="rounded-lg border border-line px-3.5 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                Assistir depois
              </button>
              <button
                type="button"
                onClick={markWatched}
                className="rounded-lg border border-line px-3.5 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                Já assisti
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
