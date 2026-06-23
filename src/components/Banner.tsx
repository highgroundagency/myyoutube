import type { ReactNode } from 'react';

type BannerProps = {
  children: ReactNode;
  tone?: 'info' | 'warning';
  onDismiss?: () => void;
};

/** Quiet top of page notice (mock mode, cached content, sync disabled). */
export function Banner({ children, tone = 'info', onDismiss }: BannerProps) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
      : 'border-line bg-surface-2 text-fg-muted';
  return (
    <div
      className={`mb-4 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${toneClass}`}
      role="status"
    >
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded p-1 text-current/70 hover:text-current"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
