import { createContext, useContext } from 'react';

export type AuthUser = { id: string; email: string | null };

/** disabled means Supabase is not configured (the app still works locally). */
export type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
