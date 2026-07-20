import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { loadYouTubeIframeAPI } from '../lib/player/iframeLoader';
import { MOCK_MODE } from '../config/env';
import type { AppOutletContext } from './appOutletContext';

/** App shell: the top bar plus the routed page. Owns the search query state. */
export function AppLayout() {
  const [query, setQuery] = useState('');

  // Idle warm-up so the FIRST video starts fast: load the YouTube player API
  // script and the Watch route chunk before they are needed, instead of paying
  // for both at the moment of the first tap. Skipped in mock/test mode.
  useEffect(() => {
    if (MOCK_MODE) return;
    const warm = () => {
      loadYouTubeIframeAPI().catch(() => {});
      void import('../pages/Watch');
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) {
      idle(warm);
      return;
    }
    const t = setTimeout(warm, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopBar onQueryChange={setQuery} />
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6">
        <Outlet context={{ query } satisfies AppOutletContext} />
      </main>
    </div>
  );
}
