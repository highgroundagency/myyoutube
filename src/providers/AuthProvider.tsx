import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
import { AuthContext, type AuthStatus, type AuthUser, type AuthContextValue } from './auth';

/**
 * Supabase magic link auth (section 13). PKCE and detectSessionInUrl (configured
 * on the client) handle the redirect automatically. When Supabase is not
 * configured the status is "disabled" and the app runs fully local.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'disabled');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!supabase) {
      setStatus('disabled');
      return;
    }
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? null });
          setStatus('signedIn');
        } else {
          setStatus('signedOut');
        }
      })
      .catch(() => {
        if (mounted) setStatus('signedOut');
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null });
        setStatus('signedIn');
      } else {
        setUser(null);
        setStatus('signedOut');
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithEmail: async (email: string) => {
        if (!supabase) return { error: 'Sync is not configured.' };
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
