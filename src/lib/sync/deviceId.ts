/**
 * A stable, anonymous id for this device/browser, so sync can keep one slice
 * per device. Created once and kept in localStorage.
 */

const DEVICE_KEY = 'gv-device-id';

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    // Private mode: a per-session id still works (slices just rotate).
    return randomId();
  }
}
