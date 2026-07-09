import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

type SearchBarProps = {
  onQueryChange: (query: string) => void;
};

/**
 * Search input with two behaviors:
 *  - Typing filters the current pool (Home / channel pages), as before.
 *  - Enter runs a REAL YouTube search on the /buscar page, like YouTube.
 * On /buscar the input reflects the current ?q= so the state never feels lost.
 */
export function SearchBar({ onQueryChange }: SearchBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const urlQuery = location.pathname === '/buscar' ? (params.get('q') ?? '') : '';

  const [text, setText] = useState(urlQuery);
  const debounced = useDebouncedValue(text, 200);

  useEffect(() => {
    onQueryChange(debounced.trim());
  }, [debounced, onQueryChange]);

  // Arriving on /buscar (back button, shared link): show that query in the box.
  useEffect(() => {
    if (urlQuery) setText(urlQuery);
  }, [urlQuery]);

  const submit = () => {
    const q = text.trim();
    if (q) navigate(`/buscar?q=${encodeURIComponent(q)}`);
  };

  return (
    <form
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pesquisar (Enter busca no YouTube)"
        aria-label="Search videos"
        enterKeyHint="search"
        className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-4 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent-400"
      />
    </form>
  );
}
