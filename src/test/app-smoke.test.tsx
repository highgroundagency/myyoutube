import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { installConsoleGuard } from './consoleGuard';

// jsdom render smoke test. Stands in for the "clean browser console" gate when
// a real browser is not available. It catches render crashes, React warnings,
// and effect errors across the app shell.
describe('App shell', () => {
  it('boots to the home route with a clean console', () => {
    const guard = installConsoleGuard();

    render(<App />);

    // The logo wordmark is present in the top bar.
    expect(screen.getAllByLabelText('GabesVideos').length).toBeGreaterThan(0);
    // Home is the default route.
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();

    guard.restore();
    expect(guard.errors).toEqual([]);
    expect(guard.warnings).toEqual([]);
  });
});
