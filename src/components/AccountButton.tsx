import { Link } from 'react-router-dom';
import { useAuth } from '../providers/auth';

/** Account entry point in the top bar. Hidden when Supabase is not configured. */
export function AccountButton() {
  const { status, user } = useAuth();
  if (status === 'disabled') return null;

  const signedIn = status === 'signedIn';
  const initial = user?.email?.trim().charAt(0).toUpperCase();

  return (
    <Link
      to="/login"
      aria-label={signedIn ? 'Account' : 'Sign in'}
      title={signedIn ? 'Account' : 'Sign in'}
      className="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {signedIn && initial ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500 text-xs font-semibold text-white">
          {initial}
        </span>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </Link>
  );
}
