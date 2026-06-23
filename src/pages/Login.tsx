import { Logo } from '../components/Logo';

// Phase 1 placeholder. The magic link auth flow is built in the persistence phase.
export function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <p className="text-sm text-fg-muted">Sign in to sync your watch state across devices.</p>
      </div>
    </div>
  );
}
