import type { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  variant?: 'neutral' | 'accent' | 'live' | 'overlay';
  className?: string;
};

const VARIANTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-surface-2 text-fg-muted',
  accent: 'bg-accent-500 text-white',
  live: 'bg-red-600 text-white',
  overlay: 'bg-black/80 text-white',
};

/** Small pill used for NEW, LIVE, SCHEDULED, and duration labels. */
export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
