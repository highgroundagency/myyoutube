import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { installConsoleGuard } from './consoleGuard';

// jsdom render smoke test. Stands in for the "clean browser console" gate when a
// real browser is not available. Catches render crashes, React warnings, and
// effect errors. Runs in MOCK_MODE (see vite.config test env) so the feed loads
// from fixtures with no network.
describe('App shell', () => {
  it('renders the home feed from fixtures with a clean console', async () => {
    const guard = installConsoleGuard();

    render(<App />);

    // Logo wordmark in the top bar.
    expect(screen.getAllByLabelText('GabesVideos').length).toBeGreaterThan(0);

    // The feed loads from fixtures and renders real cards.
    expect(await screen.findByText('I Survived 100 Hours in the Desert')).toBeInTheDocument();

    guard.restore();
    expect(guard.errors).toEqual([]);
    expect(guard.warnings).toEqual([]);
  });
});
