/**
 * Device storage for the marathon "assistir depois" snoozes, shared by the
 * NextUp card and the sync manager (snoozes ride along in the device's sync
 * slice, so snoozing on the phone also snoozes on the laptop).
 */
import { pruneSnoozes, type SnoozeMap } from './nextUp';

const SNOOZE_KEY = 'gv-nextup-snooze';
/** Fired on window whenever the snooze map changes (sync manager listens). */
export const SNOOZE_EVENT = 'gv-snooze-changed';

export function loadSnoozes(): SnoozeMap {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SnoozeMap) : {};
    return pruneSnoozes(parsed && typeof parsed === 'object' ? parsed : {});
  } catch {
    return {};
  }
}

export function saveSnoozes(map: SnoozeMap, silent = false): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
  } catch {
    // private mode: session-only
  }
  if (!silent && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(SNOOZE_EVENT));
    } catch {
      // very old browsers: sync just picks it up on the next interval
    }
  }
}
