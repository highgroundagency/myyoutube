import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, domAnimation } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './providers/ThemeProvider';
import { AuthProvider } from './providers/AuthProvider';
import { SyncBridge } from './components/SyncBridge';
import { queryClient } from './lib/queryClient';
import { AppRoutes } from './routes';

/**
 * Provider order matters: the ErrorBoundary is outermost so it can catch errors
 * from every provider and page below it.
 */
export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SyncBridge />
            {/* LazyMotion (strict) loads only the dom animation features we use,
                keeping Framer Motion small. Components use the lightweight `m`. */}
            <LazyMotion features={domAnimation} strict>
              {/* Opt into v7 behavior now to keep the console free of future flag warnings. */}
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppRoutes />
              </BrowserRouter>
            </LazyMotion>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
