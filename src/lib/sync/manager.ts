/**
 * The client sync loop. Pulls every device's slice from /api/sync, merges into
 * the local store, and pushes this device's slice back:
 *
 *  - on startup (after hydrate), on window focus, and every 90s while open;
 *  - a debounced push shortly after any local write (min gap so a playing
 *    video's 20s progress flushes do not spam the network);
 *  - a keepalive push on pagehide so closing the tab does not lose the tail.
 *
 * When the backend reports { configured: false } (no KV set up) the loop parks
 * itself: the app stays local-only with zero network chatter, exactly as before.
 */
import { persistence } from '../persistence/idbStore';
import { getDeviceId } from './deviceId';
import { mergeSnoozes, type DeviceSlice, type SyncDevices } from './merge';
import { loadSnoozes, saveSnoozes, SNOOZE_EVENT } from '../feed/snoozeStore';
import { pruneSnoozes } from '../feed/nextUp';
import { MOCK_MODE } from '../../config/env';

const PULL_INTERVAL_MS = 90_000;
const FOCUS_PULL_MIN_GAP_MS = 15_000;
const PUSH_DEBOUNCE_MS = 5_000;
const PUSH_MIN_GAP_MS = 25_000;

export type SyncStatus = 'off' | 'starting' | 'syncing' | 'ok' | 'error';
export type SyncState = { status: SyncStatus; lastSyncAt: string | null };

type Listener = () => void;

class SyncManager {
  private state: SyncState = { status: 'off', lastSyncAt: null };
  private listeners = new Set<Listener>();
  private deviceId = '';
  private configured: boolean | null = null;

  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPullAt = 0;
  private lastPushAt = 0;
  private pushQueued = false;
  private unsubscribeStore: (() => void) | null = null;
  private running = false;
  /** The store writeSeq already uploaded; push only when it moved. */
  private lastPushedSeq = -1;
  /** Set by a snooze change (lives outside the store), cleared on upload. */
  private snoozeDirty = false;

  // ----- reactive status (useSyncExternalStore) -----

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SyncState => this.state;

  private setState(next: Partial<SyncState>): void {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  // ----- lifecycle -----

  start(): () => void {
    if (this.running || MOCK_MODE || typeof window === 'undefined') return () => this.stop();
    this.running = true;
    this.deviceId = getDeviceId();
    this.setState({ status: 'starting' });

    void this.pull().then(() => this.push());

    this.pullTimer = setInterval(() => void this.pull(), PULL_INTERVAL_MS);

    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener(SNOOZE_EVENT, this.onSnoozeChange);
    this.unsubscribeStore = persistence.subscribe(this.onLocalChange);

    return () => this.stop();
  }

  stop(): void {
    this.running = false;
    if (this.pullTimer) clearInterval(this.pullTimer);
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pullTimer = null;
    this.pushTimer = null;
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener(SNOOZE_EVENT, this.onSnoozeChange);
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
  }

  private onFocus = (): void => {
    if (Date.now() - this.lastPullAt > FOCUS_PULL_MIN_GAP_MS) void this.pull();
  };

  private onVisibility = (): void => {
    if (document.visibilityState === 'visible') this.onFocus();
  };

  private onPageHide = (): void => {
    // Last chance flush; keepalive lets it outlive the page.
    void this.push(true);
  };

  /** Something local to upload? (Pull merges bump neither of these.) */
  private hasPendingChanges(): boolean {
    return this.snoozeDirty || persistence.getWriteSeq() !== this.lastPushedSeq;
  }

  private onSnoozeChange = (): void => {
    this.snoozeDirty = true;
    this.onLocalChange();
  };

  private onLocalChange = (): void => {
    if (this.configured === false) return;
    // Emits caused by merging a pull carry nothing new: do not re-upload them.
    if (!this.hasPendingChanges()) return;
    if (this.pushQueued) return;
    this.pushQueued = true;
    const wait = Math.max(PUSH_DEBOUNCE_MS, this.lastPushAt + PUSH_MIN_GAP_MS - Date.now());
    this.pushTimer = setTimeout(() => {
      this.pushQueued = false;
      void this.push();
    }, wait);
  };

  // ----- transport -----

  private ownSlice(): DeviceSlice {
    return {
      updatedAt: new Date().toISOString(),
      watch: persistence.getWatchSnapshot(),
      deletions: persistence.getDeletionsSnapshot(),
      stats: persistence.getStatsSnapshot(),
      meta: persistence.getMetaSnapshot(),
      snoozes: loadSnoozes(),
    };
  }

  private async pull(): Promise<void> {
    if (!this.running || this.configured === false) return;
    this.lastPullAt = Date.now();
    if (this.state.status !== 'starting') this.setState({ status: 'syncing' });
    try {
      const res = await fetch('/api/sync', {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok || !ct.includes('application/json')) throw new Error(`pull failed (${res.status})`);
      const json = (await res.json()) as { configured?: boolean; devices?: SyncDevices };

      if (json.configured === false) {
        // No KV on the server: park the loop, stay local-only, stop polling.
        this.configured = false;
        this.setState({ status: 'off' });
        if (this.pullTimer) clearInterval(this.pullTimer);
        this.pullTimer = null;
        return;
      }

      this.configured = true;
      const devices = json.devices ?? {};
      persistence.applyRemote(devices, this.deviceId);

      // Snoozes ride along outside the persistence store.
      const remoteSnoozes = Object.entries(devices)
        .filter(([id]) => id !== this.deviceId)
        .map(([, s]) => s.snoozes ?? {});
      const mergedSnoozes = pruneSnoozes(mergeSnoozes([loadSnoozes(), ...remoteSnoozes]));
      saveSnoozes(mergedSnoozes, true);

      this.setState({ status: 'ok', lastSyncAt: new Date().toISOString() });
    } catch {
      if (this.running) this.setState({ status: 'error' });
    }
  }

  private async push(keepalive = false): Promise<void> {
    if (!this.running || this.configured === false) return;
    if (!this.hasPendingChanges()) return; // nothing new to say
    this.lastPushAt = Date.now();
    // Capture what this upload covers; changes landing mid-flight re-dirty it.
    const seq = persistence.getWriteSeq();
    this.snoozeDirty = false;
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId, slice: this.ownSlice() }),
        cache: 'no-store',
        keepalive,
      });
      if (!res.ok) throw new Error(`push failed (${res.status})`);
      this.lastPushedSeq = seq;
      this.setState({ status: 'ok', lastSyncAt: new Date().toISOString() });
    } catch {
      // Never user-facing: re-dirty and retry shortly (or on the next write).
      this.snoozeDirty = true;
      if (this.running && !keepalive) setTimeout(() => this.onLocalChange(), 30_000);
    }
  }
}

export const syncManager = new SyncManager();
