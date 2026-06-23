/**
 * Date and label formatting. All date math goes through date-fns (section 3),
 * never hand rolled.
 */
import { formatDistanceToNowStrict, differenceInCalendarDays, format } from 'date-fns';
import { NEW_VIDEO_DAYS } from '../config/constants';

/** "2 days ago", "5 hours ago". Empty for an unparseable date. */
export function relativeAge(iso: string | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return formatDistanceToNowStrict(new Date(t), { addSuffix: true });
}

/** True for videos published within NEW_VIDEO_DAYS and not in the future. */
export function isNew(iso: string | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  if (t > Date.now()) return false;
  return differenceInCalendarDays(new Date(), new Date(t)) < NEW_VIDEO_DAYS;
}

/** "Scheduled for Jun 24, 7:00 PM" for upcoming streams. */
export function scheduledLabel(iso: string | undefined): string {
  if (!iso) return 'Scheduled';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Scheduled';
  return `Scheduled for ${format(new Date(t), 'MMM d, h:mm a')}`;
}
