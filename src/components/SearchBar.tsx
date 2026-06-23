import { useEffect, useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

type SearchBarProps = {
  onQueryChange: (query: string) => void;
};

/**
 * Search input that filters the current pool of my channels' videos by title and
 * channel label (section 11). Debounced so typing stays snappy. No external
 * YouTube search ever happens here.
 */
export function SearchBar({ onQueryChange }: SearchBarProps) {
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text, 200);

  useEffect(() => {
    onQueryChange(debounced.trim());
  }, [debounced, onQueryChange]);

  return (
    <div className="relative flex-1">
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
        placeholder="Search my videos"
        aria-label="Search videos"
        className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-4 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent-400"
      />
    </div>
  );
}
