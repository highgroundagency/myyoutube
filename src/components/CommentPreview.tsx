import type { VideoComment } from '../lib/youtube/types';

type CommentPreviewProps = {
  comments: VideoComment[];
  disabled?: boolean;
  loading?: boolean;
  variant?: 'card' | 'full';
  max?: number;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-surface-2 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 select-none items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-fg-muted"
      style={{ width: size, height: size }}
    >
      {letter}
    </span>
  );
}

function LikeBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 10v10M2 12v6a2 2 0 0 0 2 2h13a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 19.3 9H14V5a2 2 0 0 0-2-2l-3 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {formatCount(count)}
    </span>
  );
}

/** A small, lively strip of top comments. Renders nothing when there are none. */
export function CommentPreview({
  comments,
  disabled = false,
  loading = false,
  variant = 'card',
  max,
}: CommentPreviewProps) {
  if (loading) {
    return (
      <div className="mt-2 space-y-1.5" aria-hidden="true">
        <div className="h-3 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    );
  }

  if (disabled || comments.length === 0) return null;

  const shown = comments.slice(0, max ?? (variant === 'full' ? 5 : 2));

  if (variant === 'full') {
    return (
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-fg-muted">Comentarios</h2>
        <ul className="space-y-4">
          {shown.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar src={c.authorImage} name={c.author} size={32} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-fg">{c.author}</p>
                <p className="mt-0.5 whitespace-pre-line break-words text-sm text-fg-muted">{c.text}</p>
                <div className="mt-1">
                  <LikeBadge count={c.likeCount} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // Compact card strip.
  return (
    <ul className="mt-2 space-y-1.5 border-l-2 border-line pl-2.5">
      {shown.map((c) => (
        <li key={c.id} className="flex items-start gap-1.5">
          <Avatar src={c.authorImage} name={c.author} size={16} />
          <p className="clamp-2 min-w-0 text-xs leading-snug text-fg-muted">
            <span className="font-medium text-fg">{c.author}</span> {c.text}
          </p>
        </li>
      ))}
    </ul>
  );
}
