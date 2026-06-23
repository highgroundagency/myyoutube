import { useEffect } from 'react';
import { useAuth } from '../providers/auth';
import { installSyncHandlers, removeSyncHandlers, syncOnLogin, flushOffline } from '../lib/supabase/sync';

/**
 * Connects the local stores to Supabase while signed in: installs sync handlers,
 * runs the initial reconcile, and flushes the offline queue on reconnect.
 * Renders nothing.
 */
export function SyncBridge() {
  const { status, user } = useAuth();

  useEffect(() => {
    if (status !== 'signedIn' || !user) {
      removeSyncHandlers();
      return;
    }

    installSyncHandlers();
    void syncOnLogin().catch((e) => console.error('[sync] initial sync failed:', e));

    const onOnline = () => {
      void flushOffline().catch(() => {});
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('online', onOnline);
      removeSyncHandlers();
    };
  }, [status, user]);

  return null;
}
