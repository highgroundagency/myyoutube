/**
 * Which embed host should the player use on THIS device?
 *
 * Screen-time blockers (Opal, ClearSpace, iOS web restrictions) often block
 * youtube.com pages, which kills the embed iframe while the API script still
 * loads. YouTube's official alternate domain www.youtube-nocookie.com is
 * usually not on those lists, so:
 *
 *  - the player starts from the host that last WORKED here (localStorage),
 *  - if onReady never arrives it retries once on the other host,
 *  - whichever host succeeds is remembered for next time.
 *
 * An explicit VITE_EMBED_HOST override pins the host and disables all of this.
 */
import { EMBED_HOST_OVERRIDE } from '../../config/env';
import { DEFAULT_EMBED_HOST, FALLBACK_EMBED_HOST } from '../../config/constants';

const KEY = 'gv-embed-host';

export function getPreferredEmbedHost(): string {
  if (EMBED_HOST_OVERRIDE) return EMBED_HOST_OVERRIDE;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === DEFAULT_EMBED_HOST || stored === FALLBACK_EMBED_HOST) return stored;
  } catch {
    // private mode: default is fine
  }
  return DEFAULT_EMBED_HOST;
}

export function rememberWorkingEmbedHost(host: string): void {
  if (EMBED_HOST_OVERRIDE) return;
  try {
    localStorage.setItem(KEY, host);
  } catch {
    // private mode: the failover will just run again next session
  }
}

/** The other host to try, or null when pinned by an explicit override. */
export function alternateEmbedHost(host: string): string | null {
  if (EMBED_HOST_OVERRIDE) return null;
  return host === FALLBACK_EMBED_HOST ? DEFAULT_EMBED_HOST : FALLBACK_EMBED_HOST;
}
