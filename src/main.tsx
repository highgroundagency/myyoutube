import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import { App } from './App';

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
