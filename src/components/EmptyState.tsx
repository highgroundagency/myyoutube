import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/** Calm empty state used when a list has no items (for example "all caught up"). */
export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
        {icon ?? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      {message && <p className="mt-1 max-w-sm text-sm text-fg-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
