import { Link, NavLink } from 'react-router-dom';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { SearchBar } from './SearchBar';

type TopBarProps = {
  onQueryChange: (query: string) => void;
};

/** Sticky top bar: logo, search, navigation, theme toggle. No YouTube branding. */
export function TopBar({ onQueryChange }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link to="/" className="shrink-0 rounded-lg" aria-label="Go to home feed">
          <Logo />
        </Link>

        <div className="mx-auto hidden w-full max-w-md sm:block">
          <SearchBar onQueryChange={onQueryChange} />
        </div>

        <nav className="ml-auto flex items-center gap-1 sm:ml-0">
          <HeaderLink to="/" label="Home" />
          <HeaderLink to="/history" label="History" />
          <StatsLink />
          <AudioTestLink />
          <ThemeToggle />
        </nav>
      </div>

      {/* On small screens the search drops below the bar. */}
      <div className="px-4 pb-3 sm:hidden">
        <SearchBar onQueryChange={onQueryChange} />
      </div>
    </header>
  );
}

function HeaderLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block',
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  );
}

function StatsLink() {
  return (
    <NavLink
      to="/stats"
      aria-label="Stats"
      title="Stats"
      className={({ isActive }) =>
        [
          'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        ].join(' ')
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </NavLink>
  );
}

// Temporary: reach the /audio-test capability probe from the installed PWA
// (which has no address bar). Always visible, including on mobile.
function AudioTestLink() {
  return (
    <NavLink
      to="/audio-test"
      aria-label="Audio test"
      title="Audio test"
      className={({ isActive }) =>
        [
          'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        ].join(' ')
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </NavLink>
  );
}
