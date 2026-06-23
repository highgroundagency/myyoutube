import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from './Banner';
import { useAuth } from '../providers/auth';
import { isSupabaseEnabled } from '../lib/supabase/client';

const DISMISS_KEY = 'gv-sync-notice';

/** One-time notice about sync state (off, or not signed in). Dismissible. */
export function SyncNotice() {
  const { status } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'dismissed';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'dismissed');
    } catch {
      // ignore
    }
  };

  if (!isSupabaseEnabled) {
    return (
      <Banner tone="warning" onDismiss={dismiss}>
        Sync is off. Your watch state and stats are saved on this device only.
      </Banner>
    );
  }

  if (status === 'signedOut') {
    return (
      <Banner onDismiss={dismiss}>
        You are not signed in.{' '}
        <Link to="/login" className="font-medium underline">
          Sign in
        </Link>{' '}
        to sync across devices.
      </Banner>
    );
  }

  return null;
}
