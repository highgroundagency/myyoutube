import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, domAnimation } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './providers/ThemeProvider';
import { PersistenceProvider } from './providers/PersistenceProvider';
import { queryClient } from './lib/queryClient';
import { AppRoutes } from './routes';

/**
 * Provider order: the ErrorBoundary is outermost so it catches errors from every
 * provider and page. Persistence is local first (IndexedDB), so there is no auth
 * or remote client to set up.
 */
export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <PersistenceProvider>
            {/* LazyMotion (strict) loads only the dom animation features we use,
                keeping Framer Motion small. Components use the lightweight `m`. */}
            <LazyMotion features={domAnimation} strict>
              {/* Opt into v7 behavior now to keep the console free of future flag warnings. */}
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppRoutes />
              </BrowserRouter>
            </LazyMotion>
          </PersistenceProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
