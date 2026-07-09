import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchSearch } from '../lib/api/youtube';

/**
 * Real YouTube search results for a submitted term. Only runs when a term is
 * present (search costs real quota), and caches per term so re-visiting a query
 * is instant. Previous results stay while a new term loads.
 */
export function useSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['search', q.toLowerCase()],
    queryFn: ({ signal }) => fetchSearch(q, signal),
    enabled: q.length > 0,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
