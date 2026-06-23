/**
 * Client side environment. This is the ONLY module under src/ that reads
 * import.meta.env. The server (/api) must never import this file.
 *
 * Only VITE_ prefixed variables exist here. The YouTube API key is deliberately
 * absent: it is server side only and must never reach the client bundle.
 */
import { DEFAULT_EMBED_HOST } from './constants';

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

/** When true, hooks read fixtures instead of calling /api. Set via VITE_MOCK_MODE. */
export const MOCK_MODE = readBool(import.meta.env.VITE_MOCK_MODE, false);

/**
 * Embed host for the IFrame player. Defaults to the Premium friendly youtube.com.
 * Switchable per device via VITE_EMBED_HOST (section 17).
 */
export const EMBED_HOST = (import.meta.env.VITE_EMBED_HOST ?? DEFAULT_EMBED_HOST).replace(/\/+$/, '');
