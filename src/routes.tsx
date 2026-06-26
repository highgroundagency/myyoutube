import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Home } from './pages/Home';

// Route based code splitting keeps the initial bundle lean (the player and the
// Recharts powered stats page are only loaded when visited). Home stays eager
// because it is the landing route.
const Watch = lazy(() => import('./pages/Watch').then((m) => ({ default: m.Watch })));
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));
const Channel = lazy(() => import('./pages/Channel').then((m) => ({ default: m.Channel })));
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const Learn = lazy(() => import('./pages/Learn').then((m) => ({ default: m.Learn })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const AudioTest = lazy(() => import('./pages/AudioTest').then((m) => ({ default: m.AudioTest })));

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
          <Route path="/history" element={<History />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
