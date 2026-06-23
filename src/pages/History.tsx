import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWatchState } from '../hooks/useWatchState';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { relativeAge } from '../lib/format';
import type { WatchRecord } from '../lib/persistence/types';

export function History() {
  const { records, unmark, clearAll } = useWatchState();

  const items = useMemo(
    () =>
      Object.values(records).sort(
        (a, b) => Date.parse(b.lastWatchedAt) - Date.parse(a.lastWatchedAt),
      ),
    [records],
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title="No history yet"
        message="Videos you watch (or mark as already seen) will appear here. This app is the source of truth for what you have watched going forward."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">History</h1>
          <p className="text-sm text-fg-muted">
            {items.length} {items.length === 1 ? 'video' : 'videos'}
          </p>
        </div>
        <ClearButton onClear={clearAll} />
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {items.map((record) => (
          <HistoryRow key={record.videoId} record={record} onRemove={() => unmark(record.videoId)} />
        ))}
      </ul>
    </div>
  );
}

function HistoryRow({ record, onRemove }: { record: WatchRecord; onRemove: () => void }) {
  const [errored, setErrored] = useState(false);
  const title = record.title ?? record.videoId;

  return (
    <li className="flex items-center gap-3 py-3">
      <Link to={`/watch/${record.videoId}`} className="shrink-0">
        <div className="aspect-video w-28 overflow-hidden rounded-lg bg-surface-2">
          <img
            src={errored || !record.thumbnailUrl ? PLACEHOLDER_THUMBNAIL : record.thumbnailUrl}
            alt={title}
            loading="lazy"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/watch/${record.videoId}`} className="block">
          <h3 className="clamp-2 text-sm font-medium leading-snug text-fg">{title}</h3>
        </Link>
        {record.channelLabel && <p className="truncate text-xs text-fg-muted">{record.channelLabel}</p>}
        <p className="mt-0.5 flex items-center gap-2 text-xs text-fg-muted">
          <Badge variant={record.status === 'completed' ? 'accent' : 'neutral'}>
            {record.status === 'completed' ? 'Completed' : 'Seen'}
          </Badge>
          <span>{relativeAge(record.lastWatchedAt)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from history"
        title="Remove from history"
        className="shrink-0 rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        Clear history
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-fg-muted">Sure?</span>
      <button
        type="button"
        onClick={() => {
          onClear();
          setConfirming(false);
        }}
        className="rounded-full bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600"
      >
        Clear all
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2"
      >
        Cancel
      </button>
    </div>
  );
}
