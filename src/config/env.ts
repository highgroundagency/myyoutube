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
 * Explicit embed-host override via VITE_EMBED_HOST (section 17). When set it
 * pins the player host and disables the automatic failover; when null the
 * player picks between the default and fallback hosts (embedHost.ts).
 */
export const EMBED_HOST_OVERRIDE: string | null =
  (import.meta.env.VITE_EMBED_HOST ?? '').replace(/\/+$/, '') || null;

/** Embed host for the IFrame player when no failover logic is involved. */
export const EMBED_HOST = EMBED_HOST_OVERRIDE ?? DEFAULT_EMBED_HOST;
