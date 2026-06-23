/**
 * ISO 8601 duration parsing for YouTube `contentDetails.duration`.
 *
 * YouTube returns values like PT15S, PT1M, PT12M30S, PT1H2M3S, and for long
 * multi-day archives P1DT2H3M4S. Live and upcoming videos return P0D or omit
 * the field, which must parse to 0 (the "unknown duration" sentinel), NOT be
 * treated as a real zero length video.
 *
 * One regex captures optional weeks, days, hours, minutes, seconds. Each missing
 * group defaults to 0. Anything that does not match returns 0 rather than throwing.
 */

// P(nW)(nD)T(nH)(nM)(nS), every part optional. The T section only appears when
// there is a time component.
const ISO_8601_DURATION = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

export function parseIsoDuration(iso: string | null | undefined): number {
  if (typeof iso !== 'string') return 0;
  const match = ISO_8601_DURATION.exec(iso.trim());
  if (!match) return 0;

  const [, weeks, days, hours, minutes, seconds] = match;
  const toInt = (v: string | undefined): number => (v ? Number.parseInt(v, 10) : 0);

  const totalDays = toInt(weeks) * 7 + toInt(days);
  const total = ((totalDays * 24 + toInt(hours)) * 60 + toInt(minutes)) * 60 + toInt(seconds);
  return Number.isFinite(total) ? total : 0;
}

/**
 * Format seconds as a duration badge: 12:30, or 1:02:03 with hours.
 * Returns an empty string for 0 or unknown, so live and upcoming hide the badge.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';
  const secs = Math.floor(totalSeconds);
  const s = secs % 60;
  const m = Math.floor(secs / 60) % 60;
  const h = Math.floor(secs / 3600);
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    const mm = String(m).padStart(2, '0');
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${ss}`;
}
