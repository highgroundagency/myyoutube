import { Link, NavLink, Outlet } from 'react-router-dom';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * App shell: a sticky top bar with the logo and navigation, and the routed
 * page below. The search box is added in the UI phase. The top bar deliberately
 * carries no YouTube branding (section 16).
 */
export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-lg" aria-label="Go to home feed">
            <Logo />
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            <HeaderLink to="/" label="Home" />
            <HeaderLink to="/history" label="History" />
            <HeaderLink to="/stats" label="Stats" />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function HeaderLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  );
}
