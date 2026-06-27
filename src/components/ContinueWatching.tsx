import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWatchState } from '../hooks/useWatchState';
import { buildResumeList, type ResumeItem } from '../lib/feed/resume';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { formatDuration } from '../lib/youtube/duration';

/**
 * Netflix-style "continue watching" rail. Surfaces in-progress videos with a
 * resume point so a half-finished podcast is easy to come back to. Dismissing an
 * item removes it (until the viewer watches that video again). Renders nothing
 * when there is nothing to resume, so it never adds empty chrome to the feed.
 */
export function ContinueWatching() {
  const { records, dismissResume } = useWatchState();
  const items = useMemo(() => buildResumeList(records), [records]);

  if (items.length === 0) return null;

  return (
    <section className="mb-6" aria-label="Continuar assistindo">
      <h2 className="mb-3 text-sm font-semibold text-fg-muted">Continuar assistindo</h2>
      <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        {items.map((item) => (
          <ResumeCard
            key={item.videoId}
            item={item}
            onDismiss={() => dismissResume(item.videoId)}
          />
        ))}
      </div>
    </section>
  );
}

function ResumeCard({ item, onDismiss }: { item: ResumeItem; onDismiss: () => void }) {
  const [errored, setErrored] = useState(false);
  const remaining =
    item.durationSeconds > 0 ? Math.max(0, item.durationSeconds - item.positionSeconds) : 0;

  return (
    <div className="group relative w-60 shrink-0 snap-start sm:w-64">
      <Link
        to={`/watch/${item.videoId}`}
        className="block aspect-video overflow-hidden rounded-xl bg-surface-2"
        aria-label={`Continuar ${item.title}`}
      >
        <div className="relative h-full w-full">
          <img
            src={errored || !item.thumbnailUrl ? PLACEHOLDER_THUMBNAIL : item.thumbnailUrl}
            alt={item.title}
            loading="lazy"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
          {/* Play affordance on hover/focus. */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            </span>
          </div>
          {/* Progress bar pinned to the bottom edge of the thumbnail. */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div
              className="h-full bg-accent-500"
              style={{ width: `${Math.max(3, item.fraction * 100)}%` }}
            />
          </div>
        </div>
      </Link>

      {/* Dismiss ("não, obrigado"): drops the item from the rail. Always visible
          on touch where there is no hover. */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Remover de continuar assistindo"
        title="Já terminei / não quero continuar"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition-opacity hover:bg-black/90 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="mt-2">
        <Link to={`/watch/${item.videoId}`} className="block">
          <h3 className="clamp-2 text-sm font-medium leading-snug text-fg">{item.title}</h3>
        </Link>
        {item.channelLabel && (
          <Link
            to={`/channel/${item.channelKey}`}
            className="mt-0.5 block truncate text-xs text-fg-muted hover:text-fg"
          >
            {item.channelLabel}
          </Link>
        )}
        <p className="mt-0.5 text-xs font-medium text-accent-600">
          Continuar de {formatDuration(item.positionSeconds)}
          {remaining > 0 && (
            <span className="font-normal text-fg-muted"> · faltam {formatDuration(remaining)}</span>
          )}
        </p>
      </div>
    </div>
  );
}
