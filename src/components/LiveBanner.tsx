import { Link } from 'react-router-dom';
import type { Video } from '../lib/youtube/types';

/** Prominent banner when one or more channels are live (section 10). */
export function LiveBanner({ live }: { live: Video[] }) {
  if (live.length === 0) return null;
  const first = live[0];
  const extra = live.length - 1;

  return (
    <Link
      to={`/watch/${first.id}`}
      className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:hover:bg-red-950/60"
    >
      <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{first.title}</span>
        <span className="block text-xs text-fg-muted">
          {first.channelLabel}
          {extra > 0 ? ` and ${extra} more live now` : ' is live now'}
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-red-700 dark:text-red-300">Watch</span>
    </Link>
  );
}
