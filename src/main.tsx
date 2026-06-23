import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import { App } from './App';
import { seedMockDataIfNeeded } from './lib/mockSeed';

// In MOCK_MODE, populate a little history and stats so every page is demoable.
seedMockDataIfNeeded();

const rootEl = document.getElementById('root');
if (!rootEl) {
  // Should never happen (index.html defines #root), but never crash silently.
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
