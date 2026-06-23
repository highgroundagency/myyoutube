import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../providers/auth';

export function Login() {
  const { status, user, signInWithEmail, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signInWithEmail(email.trim());
    setBusy(false);
    if (result.error) setError(result.error);
    else setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {status === 'disabled' ? (
          <div className="text-center">
            <p className="text-sm text-fg-muted">
              Sync is not configured, so there is no sign in. The app still works on this device,
              and your watch state is saved locally.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
            >
              Go to the app
            </Link>
          </div>
        ) : status === 'signedIn' && user ? (
          <div className="text-center">
            <p className="text-sm text-fg">Signed in as</p>
            <p className="mt-1 font-medium">{user.email ?? 'your account'}</p>
            <p className="mt-2 text-xs text-fg-muted">Your watch state and stats sync across devices.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
              >
                Go to the app
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : sent ? (
          <div className="text-center">
            <p className="text-sm text-fg">Check your email</p>
            <p className="mt-2 text-sm text-fg-muted">
              We sent a magic link to <span className="font-medium text-fg">{email}</span>. Open it on
              this device to finish signing in.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <p className="text-center text-sm text-fg-muted">
              Sign in to sync your watch state and stats across devices.
            </p>
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent-400"
            />
            {error && <p className="text-sm text-accent-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
            >
              {busy ? 'Sending...' : 'Send magic link'}
            </button>
            <Link to="/" className="text-center text-xs text-fg-muted hover:text-fg">
              Continue without signing in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
