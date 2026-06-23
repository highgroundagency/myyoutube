import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Top level React error boundary. A render error shows a calm, recoverable
 * screen with a way out, never a white page (section 4, section 20).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Loud in dev, still logged in prod for diagnostics. We never rethrow.
    console.error('[ErrorBoundary] render error:', error, info.componentStack);
  }

  private handleTryAgain = () => {
    // Clear the error so the subtree can re-render. If the cause persists the
    // boundary will simply catch again, which is fine.
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.assign('/');
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-fg">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-600 dark:bg-accent-950">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 8v5m0 3h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-fg-muted">
            The app hit an unexpected error. Your watch progress is saved. You can try again or go
            back to the home feed.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-surface-2 p-3 text-left text-xs text-fg-muted">
              {error.message}
            </pre>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleTryAgain}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
