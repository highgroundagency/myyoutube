import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { loadYouTubeIframeAPI, type YTPlayer } from './iframeLoader';
import { EMBED_HOST } from '../../config/env';
import {
  SEEN_THRESHOLD_SECONDS,
  COMPLETION_RATIO,
  HEARTBEAT_MS,
  FLUSH_INTERVAL_MS,
} from '../../config/constants';

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

type UseYouTubePlayerArgs = {
  videoId: string;
  durationSeconds: number;
  /** When false (upcoming, region blocked), no player is created. */
  enabled?: boolean;
  /** Fired once after ~3s of real watching. */
  onSeen?: () => void;
  /** Furthest position reached, for watch_state.watched_seconds and completion. */
  onFurthest?: (seconds: number) => void;
  /** Fired once on ended or at 90 percent. */
  onCompleted?: () => void;
  /** Real watched seconds delta since the last flush, for daily stats. */
  onWatchTime?: (deltaSeconds: number) => void;
  /** Player error code (2, 5, 100, 101, 150). */
  onError?: (code: number) => void;
  /** Metadata for the lock screen / notification (Media Session API). */
  media?: { title: string; channelLabel: string; thumbnailUrl: string };
};

export type UseYouTubePlayerResult = {
  containerRef: RefObject<HTMLDivElement>;
  status: PlayerStatus;
  errorCode: number | null;
  reload: () => void;
};

/**
 * Wraps the IFrame Player API with safe lifecycle and watch-time tracking
 * (section 12). Tracks real playing wall-clock time (immune to scrubbing) for
 * daily stats, and the furthest position for completion. Idempotent create and
 * destroy make it safe under React StrictMode double mounting.
 */
export function useYouTubePlayer(args: UseYouTubePlayerArgs): UseYouTubePlayerResult {
  const { videoId, enabled = true } = args;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Latest callbacks + duration, read by the event handlers without forcing the
  // create effect to re-run (which would tear down and rebuild the player).
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  });

  // Tracking state (refs so they survive re-renders without recreating the player).
  const playStartRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const lastFlushedRef = useRef(0);
  const maxPositionRef = useRef(0);
  const seenFiredRef = useRef(false);
  const completedFiredRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    // Reset tracking for this video.
    playStartRef.current = null;
    accumulatedRef.current = 0;
    lastFlushedRef.current = 0;
    maxPositionRef.current = 0;
    seenFiredRef.current = false;
    completedFiredRef.current = false;

    setStatus('loading');
    setErrorCode(null);

    // Real playing seconds so far (accumulated plus the in-progress segment).
    const currentAccumulated = (): number =>
      accumulatedRef.current +
      (playStartRef.current != null ? (Date.now() - playStartRef.current) / 1000 : 0);

    const safeDuration = (): number => {
      const fromArgs = argsRef.current.durationSeconds;
      if (fromArgs > 0) return fromArgs;
      try {
        return playerRef.current?.getDuration() ?? 0;
      } catch {
        return 0;
      }
    };

    const maybeSeen = (): void => {
      if (!seenFiredRef.current && currentAccumulated() >= SEEN_THRESHOLD_SECONDS) {
        seenFiredRef.current = true;
        argsRef.current.onSeen?.();
      }
    };

    const maybeCompleted = (): void => {
      const dur = safeDuration();
      if (!completedFiredRef.current && dur > 0 && maxPositionRef.current >= dur * COMPLETION_RATIO) {
        completedFiredRef.current = true;
        argsRef.current.onCompleted?.();
      }
    };

    const flush = (): void => {
      const acc = currentAccumulated();
      const delta = acc - lastFlushedRef.current;
      // Only flush a meaningful delta of real watch time.
      if (delta > 0.5) {
        lastFlushedRef.current = acc;
        argsRef.current.onWatchTime?.(delta);
      }
      if (maxPositionRef.current > 0) argsRef.current.onFurthest?.(maxPositionRef.current);
    };

    const startTimers = (): void => {
      if (heartbeatRef.current == null) {
        heartbeatRef.current = setInterval(() => {
          try {
            const t = playerRef.current?.getCurrentTime?.() ?? 0;
            if (t > maxPositionRef.current) maxPositionRef.current = t;
          } catch {
            // getCurrentTime can throw if the player is mid-teardown. Ignore.
          }
          maybeSeen();
          maybeCompleted();
        }, HEARTBEAT_MS);
      }
      if (flushRef.current == null) {
        flushRef.current = setInterval(flush, FLUSH_INTERVAL_MS);
      }
    };

    const stopTimers = (): void => {
      if (heartbeatRef.current != null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (flushRef.current != null) {
        clearInterval(flushRef.current);
        flushRef.current = null;
      }
    };

    // Media Session API: shows the title, channel, and thumbnail on the lock
    // screen / notification, with play/pause/seek controls. Best effort. It does
    // NOT make a YouTube embed play with the screen off (YouTube blocks that for
    // embeds), but it improves controls and helps on some Android setups.
    const updatePlaybackState = (state: MediaSessionPlaybackState): void => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = state;
        } catch {
          // ignore
        }
      }
    };

    const setupMediaSession = (): void => {
      if (!('mediaSession' in navigator)) return;
      try {
        const m = argsRef.current.media;
        if (m) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: m.title,
            artist: m.channelLabel,
            artwork: m.thumbnailUrl
              ? [{ src: m.thumbnailUrl, sizes: '480x360', type: 'image/jpeg' }]
              : [],
          });
        }
        const guard = (fn: () => void) => () => {
          try {
            fn();
          } catch {
            // ignore player teardown races
          }
        };
        navigator.mediaSession.setActionHandler('play', guard(() => playerRef.current?.playVideo()));
        navigator.mediaSession.setActionHandler('pause', guard(() => playerRef.current?.pauseVideo()));
        navigator.mediaSession.setActionHandler('seekbackward', (d) =>
          guard(() => {
            const t = playerRef.current?.getCurrentTime?.() ?? 0;
            playerRef.current?.seekTo(Math.max(0, t - (d.seekOffset ?? 10)), true);
          })(),
        );
        navigator.mediaSession.setActionHandler('seekforward', (d) =>
          guard(() => {
            const t = playerRef.current?.getCurrentTime?.() ?? 0;
            playerRef.current?.seekTo(t + (d.seekOffset ?? 10), true);
          })(),
        );
        navigator.mediaSession.setActionHandler('seekto', (d) =>
          guard(() => {
            if (d.seekTime != null) playerRef.current?.seekTo(d.seekTime, true);
          })(),
        );
      } catch {
        // Media Session not fully supported here; ignore.
      }
    };

    const clearMediaSession = (): void => {
      if (!('mediaSession' in navigator)) return;
      try {
        for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'] as const) {
          navigator.mediaSession.setActionHandler(action, null);
        }
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // ignore
      }
    };

    // Only accrue while actually playing. This makes watch time immune to
    // scrubbing forward or backward.
    const onPlaying = (): void => {
      if (playStartRef.current == null) playStartRef.current = Date.now();
      startTimers();
      maybeSeen();
      updatePlaybackState('playing');
    };
    const onStop = (): void => {
      if (playStartRef.current != null) {
        accumulatedRef.current += (Date.now() - playStartRef.current) / 1000;
        playStartRef.current = null;
      }
      maybeSeen();
      flush();
      stopTimers();
      updatePlaybackState('paused');
    };
    const onEnded = (): void => {
      onStop();
      if (!completedFiredRef.current) {
        completedFiredRef.current = true;
        argsRef.current.onCompleted?.();
      }
    };

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (cancelled) return;
        // Fresh child element so destroy always leaves a clean slate.
        container.innerHTML = '';
        const target = document.createElement('div');
        container.appendChild(target);

        playerRef.current = new YT.Player(target, {
          videoId,
          host: EMBED_HOST,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setStatus('ready');
              setupMediaSession();
            },
            onStateChange: (e) => {
              switch (e.data) {
                case 1: // playing
                  onPlaying();
                  break;
                case 2: // paused
                case 3: // buffering
                  onStop();
                  break;
                case 0: // ended
                  onEnded();
                  break;
                default:
                  break; // -1 unstarted, 5 cued
              }
            },
            onError: (e) => {
              if (cancelled) return;
              setErrorCode(e.data);
              setStatus('error');
              argsRef.current.onError?.(e.data);
            },
          },
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[player] failed to load the IFrame API:', err);
        setErrorCode(-1);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      // Finalize and flush any remaining watch time before tearing down.
      onStop();
      stopTimers();
      clearMediaSession();
      const player = playerRef.current;
      playerRef.current = null;
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy();
        } catch {
          // Ignore teardown races.
        }
      }
      // `container` is captured from this effect run, so it is the correct node.
      container.innerHTML = '';
    };
  }, [videoId, enabled, reloadKey]);

  return { containerRef, status, errorCode, reload };
}
