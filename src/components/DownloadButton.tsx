import { useEffect, useRef, useState } from 'react';
import type { Video } from '../lib/youtube/types';

type DownloadButtonProps = {
  video: Video;
  /** Is the laptop extractor reachable (tunnel open). */
  online: boolean;
  /** Already downloaded on the laptop. */
  downloaded: boolean;
  variant?: 'card' | 'full';
};

/** Same-origin URL that triggers the server-side download and streams the file. */
function buildDownloadUrl(video: Video): string {
  const params = new URLSearchParams({
    v: video.id,
    format: 'video',
    title: video.title,
    channel: video.channelLabel,
    duration: String(video.durationSeconds || 0),
  });
  return `/download?${params.toString()}`;
}

/** A filename hint for the browser; the server's Content-Disposition wins. */
function suggestedName(video: Video): string {
  const base =
    video.title
      .replace(/[/\\:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'video';
  return `${base}.mp4`;
}

/**
 * iOS quirk: in a standalone (home-screen) PWA the Save-to-Files sheet does not
 * appear for downloads. Opening the same URL in real Safari does work, so in
 * standalone mode we point the button at a new tab instead of an in-place
 * download.
 */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m20 6-11 11-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadButton({ video, online, downloaded, variant = 'card' }: DownloadButtonProps) {
  const [preparing, setPreparing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // No extractor: keep the deployed site clean (no button, no nag).
  if (!online) return null;

  if (downloaded) {
    return (
      <span
        className={
          variant === 'full'
            ? 'inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg-muted'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg-muted'
        }
      >
        <CheckIcon />
        Baixado
      </span>
    );
  }

  const url = buildDownloadUrl(video);
  const name = suggestedName(video);
  const standalone = isStandalone();

  const onTap = () => {
    setPreparing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // The OS owns the real download UI; this is just a hint that it started.
    timerRef.current = setTimeout(() => setPreparing(false), 12_000);
  };

  if (variant === 'full') {
    return (
      <div className="flex flex-col gap-1.5">
        <a
          href={url}
          download={name}
          {...(standalone ? { target: '_blank', rel: 'noopener' } : {})}
          onClick={onTap}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          <DownloadIcon />
          {preparing ? 'Preparando...' : 'Baixar (1080p)'}
        </a>
        {preparing && (
          <span className="text-xs text-fg-muted">
            Preparando o download, pode levar alguns segundos. Depois toque em
            &ldquo;Salvar em Arquivos&rdquo;.
          </span>
        )}
        {!standalone && (
          <a
            href={url}
            target="_blank"
            rel="noopener"
            onClick={onTap}
            className="w-fit text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Abrir no Safari para salvar
          </a>
        )}
      </div>
    );
  }

  // Compact card button.
  return (
    <a
      href={url}
      download={name}
      {...(standalone ? { target: '_blank', rel: 'noopener' } : {})}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <DownloadIcon />
      {preparing ? 'Preparando...' : 'Baixar'}
    </a>
  );
}
