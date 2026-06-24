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
    const finish = () => {
      if (window.YT && window.YT.Player) resolve(window.YT);
      else reject(new Error('YouTube IFrame API loaded but YT.Player is missing'));
    };

    // Preserve any pre-existing callback rather than clobbering it.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      finish();
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // Script tag is present. If the API is already ready, resolve now;
      // otherwise the global callback above will fire.
      if (window.YT && window.YT.Player) finish();
      return;
    }

    const tag = document.createElement('script');
    tag.id = SCRIPT_ID;
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => {
      readyPromise = null; // allow a later retry
      reject(new Error('Failed to load the YouTube IFrame API script'));
    };
    document.head.appendChild(tag);
  });

  return readyPromise;
}
