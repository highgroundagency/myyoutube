import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import type { AppOutletContext } from './appOutletContext';

/** App shell: the top bar plus the routed page. Owns the search query state. */
export function AppLayout() {
  const [query, setQuery] = useState('');

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopBar onQueryChange={setQuery} />
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6">
        <Outlet context={{ query } satisfies AppOutletContext} />
      </main>
    </div>
  );
}
