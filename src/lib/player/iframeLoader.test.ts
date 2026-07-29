import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SCRIPT_ID = 'youtube-iframe-api';

/** Fresh module state per test: the loader memoizes its promise at module level. */
async function freshLoader() {
  vi.resetModules();
  return (await import('./iframeLoader')).loadYouTubeIframeAPI;
}

function scriptTag(): HTMLElement | null {
  return document.getElementById(SCRIPT_ID);
}

function failScript(): void {
  scriptTag()?.dispatchEvent(new Event('error'));
}

/** Simulate the real API arriving: it defines window.YT then calls the global. */
function apiBecomesReady(): void {
  (window as unknown as { YT: unknown }).YT = { Player: function Player() {}, PlayerState: {} };
  window.onYouTubeIframeAPIReady?.();
}

beforeEach(() => {
  scriptTag()?.remove();
  delete (window as unknown as { YT?: unknown }).YT;
  window.onYouTubeIframeAPIReady = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadYouTubeIframeAPI', () => {
  it('resolves once the API reports itself ready', async () => {
    const load = await freshLoader();
    const promise = load();
    apiBecomesReady();
    await expect(promise).resolves.toMatchObject({ Player: expect.any(Function) });
  });

  it('rejects AND removes the dead tag when the script fails to load', async () => {
    const load = await freshLoader();
    const promise = load();
    expect(scriptTag()).not.toBeNull();
    failScript();
    await expect(promise).rejects.toThrow(/Failed to load/);
    // The tag must go, otherwise the next attempt finds it and stalls.
    expect(scriptTag()).toBeNull();
  });

  it('REGRESSION: a retry after a failure still settles instead of hanging forever', async () => {
    const load = await freshLoader();

    const first = load();
    failScript();
    await expect(first).rejects.toThrow();

    // The old bug: this call found the leftover tag, took the "already loading"
    // branch and returned without resolving or rejecting, so the player span
    // forever with no error and no way out.
    const second = load();
    expect(scriptTag()).not.toBeNull(); // a FRESH tag was injected
    failScript();
    await expect(second).rejects.toThrow();
  });

  it('REGRESSION: a retry after a failure can still succeed', async () => {
    const load = await freshLoader();
    const first = load();
    failScript();
    await expect(first).rejects.toThrow();

    const second = load();
    apiBecomesReady();
    await expect(second).resolves.toMatchObject({ Player: expect.any(Function) });
  });

  it('times out instead of hanging when the request is silently blocked', async () => {
    vi.useFakeTimers();
    const load = await freshLoader();
    // No load event, no error event: exactly what a content blocker can do.
    const promise = load();
    const assertion = expect(promise).rejects.toThrow(/Timed out/);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
