import { useOutletContext } from 'react-router-dom';

/** Context shared from AppLayout to routed pages (currently the search query). */
export type AppOutletContext = { query: string };

export function useAppSearch(): string {
  return useOutletContext<AppOutletContext>().query;
}
