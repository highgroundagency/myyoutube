/**
 * Singleton loader for the YouTube IFrame Player API (section 12).
 *
 * The IFrame API uses ONE global callback, window.onYouTubeIframeAPIReady. If
 * multiple components define it they clobber each other (a classic bug), so we
 * inject the script once and resolve a single shared promise. Every player
 * creation awaits this promise. Guarded against the script already existing
 * (hot reload, re-mounts).
 */

export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export type YTPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
};

type YTEvent = { target: YTPlayer; data: number };

export type YTPlayerOptions = {
  videoId: string;
  host?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: YTEvent) => void;
    onError?: (event: YTEvent) => void;
  };
};

export type YTNamespace = {
  Player: new (el: HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_ID = 'youtube-iframe-api';
/**
 * A request blocked by a content blocker (very common on iOS Safari) can fire
 * neither `load` nor `error`, so every attempt also races a hard timeout. The
 * promise MUST always settle: a pending one leaves the player spinning forever.
 */
const LOAD_TIMEOUT_MS = 15_000;
let readyPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeAPI(): Promise<YTNamespace> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame API requires a browser environment'));
  }
  // Already loaded.
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  // Already loading.
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<YTNamespace>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const succeed = (): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(window.YT as YTNamespace);
    };

    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      // Clear BOTH the memo and the dead tag. Leaving the tag behind used to
      // make every later attempt find it, take the "already loading" branch,
      // and return without settling: a permanent silent hang.
      readyPromise = null;
      document.getElementById(SCRIPT_ID)?.remove();
      reject(new Error(message));
    };

    const finish = (): void => {
      if (window.YT && window.YT.Player) succeed();
      else fail('YouTube IFrame API loaded but YT.Player is missing');
    };

    // Preserve any pre-existing callback rather than clobbering it.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      finish();
    };

    timer = setTimeout(
      () => fail('Timed out loading the YouTube IFrame API (blocked, offline, or very slow)'),
      LOAD_TIMEOUT_MS,
    );

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // A previous attempt injected it. Resolve now if the API is somehow
      // ready; otherwise wait on this tag's error plus the timeout above, so
      // this path can never hang.
      if (window.YT && window.YT.Player) finish();
      else {
        existing.addEventListener(
          'error',
          () => fail('Failed to load the YouTube IFrame API script'),
          { once: true },
        );
      }
      return;
    }

    const tag = document.createElement('script');
    tag.id = SCRIPT_ID;
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.addEventListener(
      'error',
      () => fail('Failed to load the YouTube IFrame API script'),
      { once: true },
    );
    document.head.appendChild(tag);
  });

  return readyPromise;
}
