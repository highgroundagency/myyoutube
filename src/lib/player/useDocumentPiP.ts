import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Float the player in an always-on-top window using the Document
 * Picture-in-Picture API (desktop Chrome/Edge). We move the YouTube <iframe>
 * itself into the PiP window so playback keeps going, then move it back when the
 * window closes. The iframe is created imperatively by the player (not by React),
 * so relocating it does not fight React's reconciliation.
 *
 * Not supported on iOS/Safari, where `documentPictureInPicture` is absent and
 * the button simply does not show; there PiP is an OS gesture on the video.
 */

type DocumentPiP = {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
};

function getApi(): DocumentPiP | null {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { documentPictureInPicture?: DocumentPiP })
    .documentPictureInPicture;
  return api ?? null;
}

export function useDocumentPiP(hostRef: RefObject<HTMLElement>) {
  const supported = getApi() != null;
  const [active, setActive] = useState(false);
  const pipRef = useRef<Window | null>(null);
  const savedStyle = useRef<string>('');

  const restore = useCallback(() => {
    const pip = pipRef.current;
    pipRef.current = null;
    if (pip) {
      const iframe = pip.document.querySelector('iframe');
      if (iframe && hostRef.current) {
        iframe.setAttribute('style', savedStyle.current);
        hostRef.current.appendChild(iframe);
      }
      try {
        pip.close();
      } catch {
        // already closing
      }
    }
    setActive(false);
  }, [hostRef]);

  const open = useCallback(async () => {
    const api = getApi();
    if (!api || pipRef.current) return;
    const iframe = hostRef.current?.querySelector('iframe');
    if (!iframe) return;
    try {
      const pip = await api.requestWindow({ width: 480, height: 270 });
      pipRef.current = pip;
      pip.document.body.style.margin = '0';
      pip.document.body.style.background = '#000';
      savedStyle.current = iframe.getAttribute('style') ?? '';
      iframe.setAttribute('style', 'position:fixed;inset:0;width:100%;height:100%;border:0;');
      pip.document.body.appendChild(iframe);
      pip.addEventListener('pagehide', () => restore(), { once: true });
      setActive(true);
    } catch {
      restore();
    }
  }, [hostRef, restore]);

  const toggle = useCallback(() => {
    if (pipRef.current) restore();
    else void open();
  }, [open, restore]);

  // Always put the iframe back if the watch page unmounts mid-PiP.
  useEffect(() => () => restore(), [restore]);

  return { supported, active, toggle };
}
