/**
 * Pull YouTube video ids out of pasted text. Handles full watch URLs,
 * youtu.be short links, shorts/live/embed paths, and bare 11-char ids, with any
 * surrounding junk. Mirrors the parser in local-server/server.js (the server is
 * the source of truth; this gives the paste box an instant count and preview).
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const LOOSE_RE = /(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([A-Za-z0-9_-]{11})/;

/** A single id from one link/token, or null when nothing valid is found. */
export function extractVideoId(input: string): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  if (VIDEO_ID_RE.test(s)) return s;
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1, 12);
      return VIDEO_ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && VIDEO_ID_RE.test(v)) return v;
      const m = u.pathname.match(/\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL; fall through to a loose scan
  }
  const loose = s.match(LOOSE_RE);
  return loose ? loose[1] : null;
}

/**
 * All distinct video ids from a blob of pasted text (links separated by
 * newlines, spaces, or commas), preserving the order they were pasted in.
 */
export function extractVideoIds(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of (text ?? '').split(/[\s,]+/)) {
    const id = extractVideoId(token);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
