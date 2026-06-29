import { lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Home } from './pages/Home';

const RETRY_KEY = 'gv-chunk-reloaded';

/**
 * Like React.lazy, but resilient to a stale-service-worker chunk load failure
 * after a deploy: if the dynamic import rejects (a 404 on an old hashed chunk),
 * reload the page once to pick up the fresh service worker, instead of throwing
 * a scary error screen on the first visit to Watch / Stats. A sessionStorage
 * guard prevents a reload loop; a clean load clears it.
 */
function lazyRetry<T extends ComponentType>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory()
      .then((mod) => {
        try {
          sessionStorage.removeItem(RETRY_KEY);
        } catch {
          // ignore
        }
        return mod;
      })
      .catch((err: unknown) => {
        let firstFailure = true;
        try {
          firstFailure = !sessionStorage.getItem(RETRY_KEY);
          if (firstFailure) sessionStorage.setItem(RETRY_KEY, '1');
        } catch {
          firstFailure = false;
        }
        if (firstFailure && typeof window !== 'undefined') {
          window.location.reload();
          // Keep Suspense in its fallback while the page reloads.
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      }),
  );
}

// Route based code splitting keeps the initial bundle lean (the player and the
// Recharts powered stats page are only loaded when visited). Home stays eager
// because it is the landing route.
const Watch = lazyRetry(() => import('./pages/Watch').then((m) => ({ default: m.Watch })));
const Stats = lazyRetry(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));
const Channel = lazyRetry(() => import('./pages/Channel').then((m) => ({ default: m.Channel })));
const History = lazyRetry(() => import('./pages/History').then((m) => ({ default: m.History })));
const Learn = lazyRetry(() => import('./pages/Learn').then((m) => ({ default: m.Learn })));
const Downloads = lazyRetry(() => import('./pages/Downloads').then((m) => ({ default: m.Downloads })));
const NotFound = lazyRetry(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const AudioTest = lazyRetry(() => import('./pages/AudioTest').then((m) => ({ default: m.AudioTest })));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-label="Loading" role="status">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent-500" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Standalone full screen capability probe (no app chrome). */}
        <Route path="/audio-test" element={<AudioTest />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/watch/:videoId" element={<Watch />} />
          <Route path="/channel/:channelKey" element={<Channel />} />
          <Route path="/learn/:courseKey" element={<Learn />} />
          <Route path="/baixar" element={<Downloads />} />
          <Route path="/history" element={<History />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
