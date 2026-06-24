import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Background audio capability probe (NOT YouTube).
 *
 * Goal: prove that a native HTML5 <audio> element we control can keep playing
 * with the screen locked on iOS, inside the installed PWA. The YouTube iframe
 * cannot do this (cross-origin), but a same-origin <audio> element with the
 * Media Session API can on iOS. This page is a throwaway test. No backend, no
 * extraction.
 */

const AUDIO_SRC = '/test-audio.m4a';

type LogEntry = { id: number; time: string; msg: string };

function nowLabel(): string {
  const d = new Date();
  return `${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function mediaErrorText(code: number | undefined): string {
  switch (code) {
    case 1:
      return 'ABORTED';
    case 2:
      return 'NETWORK';
    case 3:
      return 'DECODE';
    case 4:
      return 'SRC_NOT_SUPPORTED';
    default:
      return 'unknown';
  }
}

/** Draw a 512x512 artwork and return it as a blob URL (for the lock screen). */
async function makeArtworkBlobUrl(): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#f2555a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(205, 165);
    ctx.lineTo(365, 256);
    ctx.lineTo(205, 347);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Audio Test', 256, 430);
    return await new Promise<string | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/png');
    });
  } catch {
    return null;
  }
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
  );
}

export function AudioTest() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const artworkUrlRef = useRef<string | null>(null);
  const lastTickLogRef = useRef(0);
  const logIdRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = useCallback((msg: string) => {
    logIdRef.current += 1;
    setLogs((prev) => [{ id: logIdRef.current, time: nowLabel(), msg }, ...prev].slice(0, 80));
  }, []);

  // Attach <audio> event listeners.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const setPlaybackState = (state: MediaSessionPlaybackState) => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = state;
        } catch {
          // ignore
        }
      }
    };

    const onLoaded = () => {
      setDuration(el.duration || 0);
      log(`loadedmetadata: duration=${(el.duration || 0).toFixed(1)}s`);
    };
    const onPlay = () => {
      setPlaying(true);
      setStalled(false);
      setPlaybackState('playing');
      log('event: play');
    };
    const onPause = () => {
      setPlaying(false);
      setPlaybackState('paused');
      log('event: pause');
    };
    const onEnded = () => {
      setPlaying(false);
      log('event: ended');
    };
    const onStalled = () => {
      setStalled(true);
      log('event: STALLED');
    };
    const onWaiting = () => log('event: waiting (buffering)');
    const onPlaying = () => {
      setStalled(false);
      log('event: playing (resumed)');
    };
    const onSuspend = () => log('event: suspend');
    const onError = () => {
      const code = el.error?.code;
      const msg = `error: code=${code} (${mediaErrorText(code)})`;
      setError(msg);
      log(msg);
    };
    const onTimeUpdate = () => {
      setPosition(el.currentTime || 0);
      if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
        try {
          navigator.mediaSession.setPositionState({
            duration: el.duration || 0,
            position: el.currentTime || 0,
            playbackRate: el.playbackRate || 1,
          });
        } catch {
          // ignore (some browsers throw if duration is not finite)
        }
      }
      const t = Date.now();
      if (t - lastTickLogRef.current > 5000) {
        lastTickLogRef.current = t;
        log(`timeupdate: ${(el.currentTime || 0).toFixed(0)}s`);
      }
    };

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('stalled', onStalled);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('suspend', onSuspend);
    el.addEventListener('error', onError);
    el.addEventListener('timeupdate', onTimeUpdate);
    log(`listeners attached. standalone=${isStandalone()}`);

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('stalled', onStalled);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('suspend', onSuspend);
      el.removeEventListener('error', onError);
      el.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [log]);

  // Configure Media Session: metadata + action handlers.
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      log('mediaSession: NOT supported');
      return;
    }
    const a = () => audioRef.current;
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        log('mediaSession action: play');
        a()
          ?.play()
          .catch(() => {});
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        log('mediaSession action: pause');
        a()?.pause();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        log('mediaSession action: stop');
        const el = a();
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        const el = a();
        if (el && typeof d.seekTime === 'number') el.currentTime = d.seekTime;
      });
      log('mediaSession: handlers set');
    } catch {
      log('mediaSession: some handlers unsupported');
    }

    let cancelled = false;
    void makeArtworkBlobUrl().then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      artworkUrlRef.current = url;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Background Audio Test',
          artist: 'GabesVideos capability probe',
          album: 'Audio Test',
          artwork: url ? [{ src: url, sizes: '512x512', type: 'image/png' }] : [],
        });
        log(`mediaSession: metadata set (artwork=${url ? 'yes' : 'no'})`);
      } catch {
        log('mediaSession: metadata failed');
      }
    });

    return () => {
      cancelled = true;
      for (const action of ['play', 'pause', 'stop', 'seekto'] as const) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
      if (artworkUrlRef.current) URL.revokeObjectURL(artworkUrlRef.current);
    };
  }, [log]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    setError(null);
    if (el.paused) {
      try {
        // play() MUST be called inside this tap handler so iOS unlocks audio.
        await el.play();
        log('play() resolved');
      } catch (e) {
        const msg = `play() rejected: ${(e as Error)?.message ?? e}`;
        setError(msg);
        log(msg);
      }
    } else {
      el.pause();
    }
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-bg px-5 py-6 text-fg">
      {/* The always-mounted audio element (invisible). Never conditionally rendered. */}
      <audio ref={audioRef} src={AUDIO_SRC} preload="auto" />

      <Link to="/" className="text-sm text-fg-muted hover:text-fg">
        &larr; Back to app
      </Link>

      <h1 className="mt-3 text-xl font-semibold">Background audio test</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Tap play, then lock your screen. If the audio keeps playing and shows on the lock screen,
        background audio works in this PWA. This uses a local audio file, no YouTube.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-500 text-white shadow-lg active:scale-95"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5l11 7-11 7V5z" />
            </svg>
          )}
        </button>
        <div className="text-sm tabular-nums text-fg-muted">
          {fmt(position)} / {fmt(duration)} {playing ? '(playing)' : '(paused)'}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </div>
      )}
      {stalled && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Playback stalled (buffering). If this persists after lock, background audio is being
          suspended.
        </div>
      )}

      <div className="mt-6 rounded-xl border border-line bg-surface p-3 text-xs">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-fg-muted">
          <span>standalone (installed): {String(isStandalone())}</span>
          <span>mediaSession: {String('mediaSession' in navigator)}</span>
        </div>
        <p className="mb-2 font-medium text-fg">Event log (newest first)</p>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto font-mono leading-relaxed text-fg-muted">
          {logs.map((entry) => (
            <li key={entry.id}>
              <span className="text-fg-muted/70">{entry.time}</span> {entry.msg}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-fg-muted">
        How to test: install to the home screen first (Share, Add to Home Screen), open it, tap play,
        lock the screen for a minute, then reopen and read the log. If it kept playing through the
        lock, the capability is proven.
      </p>
    </div>
  );
}
