import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import { App } from './App';
import { persistence } from './lib/persistence/idbStore';
import { seedMockDataIfNeeded } from './lib/mockSeed';

const rootEl = document.getElementById('root');
if (!rootEl) {
  // Should never happen (index.html defines #root), but never crash silently.
  throw new Error('Root element #root not found');
}

// Hydrate persistence from IndexedDB, seed mock data in MOCK_MODE, then render.
// Rendering after hydration avoids a flash of empty watch state and stats.
persistence
  .init()
  .then(() => seedMockDataIfNeeded())
  .catch(() => {
    // Storage unavailable: the app still runs in-memory for this session.
  })
  .finally(() => {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
