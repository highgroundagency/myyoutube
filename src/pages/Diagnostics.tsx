import { useCallback, useEffect, useRef, useState } from 'react';
import { loadYouTubeIframeAPI, type YTPlayer } from '../lib/player/iframeLoader';

/**
 * On-device playback diagnostics (/diagnostico). The owner cannot open a
 * console on the iPhone, so this page runs the real checks right on the device
 * and renders a verdict a screenshot can carry: which layer fails (our server,
 * the YouTube API script, YouTube images, or the embed itself), plus the build
 * stamp so we know WHICH deploy the device is actually running. Also offers a
 * full reset (service worker + caches) for a stuck old version.
 */

// YouTube's own IFrame API demo video: public, embeddable, never regional.
const TEST_VIDEO_ID = 'M7lc1UVf-VE';
const STEP_TIMEOUT_MS = 15_000;

type StepKey = 'server' | 'script' | 'image' | 'embed';
type StepStatus = 'pending' | 'running' | 'pass' | 'fail';
type StepResult = { status: StepStatus; detail?: string };
type Results = Record<StepKey, StepResult>;

const STEP_LABEL: Record<StepKey, string> = {
  server: 'Servidor do app (Vercel)',
  script: 'Script do player (www.youtube.com)',
  image: 'Imagens do YouTube (i.ytimg.com)',
  embed: 'Player de verdade (embed)',
};

const initialResults = (): Results => ({
  server: { status: 'pending' },
  script: { status: 'pending' },
  image: { status: 'pending' },
  embed: { status: 'pending' },
});

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: sem resposta em ${ms / 1000}s`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function testImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('a imagem não carregou'));
    img.src = src;
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function Diagnostics() {
  const [results, setResults] = useState<Results>(initialResults);
  const [running, setRunning] = useState(false);
  const [swInfo, setSwInfo] = useState('verificando...');
  const [resetting, setResetting] = useState(false);
  const embedHostRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);

  const setStep = useCallback((key: StepKey, result: StepResult) => {
    setResults((prev) => ({ ...prev, [key]: result }));
  }, []);

  const run = useCallback(async () => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;
    setResults(initialResults());
    setRunning(true);

    // 1. Our own server.
    setStep('server', { status: 'running' });
    try {
      const started = Date.now();
      const res = await withTimeout(
        fetch('/api/sync', { cache: 'no-store', headers: { accept: 'application/json' } }),
        STEP_TIMEOUT_MS,
        'servidor',
      );
      if (!isCurrent()) return;
      setStep('server', {
        status: res.ok ? 'pass' : 'fail',
        detail: res.ok ? `respondeu em ${Date.now() - started}ms` : `HTTP ${res.status}`,
      });
    } catch (e) {
      if (!isCurrent()) return;
      setStep('server', { status: 'fail', detail: (e as Error).message });
    }

    // 2. YouTube images (a different YouTube domain than the script).
    setStep('image', { status: 'running' });
    try {
      await withTimeout(
        testImage(`https://i.ytimg.com/vi/${TEST_VIDEO_ID}/default.jpg`),
        STEP_TIMEOUT_MS,
        'imagens',
      );
      if (!isCurrent()) return;
      setStep('image', { status: 'pass', detail: 'thumbnails carregam' });
    } catch (e) {
      if (!isCurrent()) return;
      setStep('image', { status: 'fail', detail: (e as Error).message });
    }

    // 3. The IFrame API script from www.youtube.com (its own 15s timeout).
    setStep('script', { status: 'running' });
    let scriptOk = false;
    try {
      await loadYouTubeIframeAPI();
      if (!isCurrent()) return;
      scriptOk = true;
      setStep('script', { status: 'pass', detail: 'API do player carregou' });
    } catch (e) {
      if (!isCurrent()) return;
      setStep('script', { status: 'fail', detail: (e as Error).message });
    }

    // 4. A real (hidden, muted, no-autoplay) embed reaching onReady.
    if (!scriptOk) {
      setStep('embed', { status: 'fail', detail: 'pulado: o script não carregou' });
    } else {
      setStep('embed', { status: 'running' });
      let player: YTPlayer | null = null;
      try {
        const YT = await loadYouTubeIframeAPI();
        const host = embedHostRef.current;
        if (!host) throw new Error('container do teste não existe');
        host.innerHTML = '';
        const target = document.createElement('div');
        host.appendChild(target);
        await withTimeout(
          new Promise<void>((resolve, reject) => {
            player = new YT.Player(target, {
              videoId: TEST_VIDEO_ID,
              width: 32,
              height: 18,
              playerVars: { playsinline: 1, autoplay: 0, origin: window.location.origin },
              events: {
                onReady: () => resolve(),
                onError: (e) => reject(new Error(`o player respondeu com erro ${e.data}`)),
              },
            });
          }),
          STEP_TIMEOUT_MS,
          'embed',
        );
        if (!isCurrent()) return;
        setStep('embed', { status: 'pass', detail: 'o player inicializa neste aparelho' });
      } catch (e) {
        if (!isCurrent()) return;
        setStep('embed', { status: 'fail', detail: (e as Error).message });
      } finally {
        try {
          // TS cannot see the assignment inside the Promise executor.
          (player as YTPlayer | null)?.destroy();
        } catch {
          // teardown race: ignore
        }
        if (embedHostRef.current) embedHostRef.current.innerHTML = '';
      }
    }

    if (isCurrent()) setRunning(false);
  }, [setStep]);

  useEffect(() => {
    void run();
    return () => {
      runIdRef.current += 1; // cancel in-flight run on unmount
    };
  }, [run]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
        const controlled = Boolean(navigator.serviceWorker?.controller);
        if (active) {
          setSwInfo(
            regs.length === 0
              ? 'nenhum service worker'
              : `${regs.length} registrado(s), ${controlled ? 'controlando a página' : 'não controlando'}`,
          );
        }
      } catch {
        if (active) setSwInfo('indisponível');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const resetApp = useCallback(async () => {
    setResetting(true);
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      // keep going: caches next
    }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // ignore
    }
    // Full reload without the old worker: the next load fetches the live build.
    window.location.href = '/';
  }, []);

  const failed = (Object.keys(results) as StepKey[]).filter((k) => results[k].status === 'fail');
  const done = !running && (Object.keys(results) as StepKey[]).every((k) => results[k].status === 'pass' || results[k].status === 'fail');

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">Diagnóstico de reprodução</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Roda os testes neste aparelho e mostra onde o vídeo trava. Manda um print desta tela.
      </p>

      <ul className="mt-5 flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
        {(Object.keys(STEP_LABEL) as StepKey[]).map((key) => (
          <li key={key} className="flex items-center gap-3 px-4 py-3">
            <StatusDot status={results[key].status} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{STEP_LABEL[key]}</p>
              {results[key].detail && (
                <p className="truncate text-xs text-fg-muted" title={results[key].detail}>
                  {results[key].detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {done && <Verdict failed={failed} />}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {running ? 'Testando...' : 'Rodar de novo'}
        </button>
        <button
          type="button"
          onClick={() => void resetApp()}
          disabled={resetting}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          {resetting ? 'Limpando...' : 'Resetar o app (limpa versão velha)'}
        </button>
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        O reset não apaga seu histórico nem suas estatísticas; só troca a versão do app em cache.
      </p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-xs text-fg-muted">
        <p>
          Versão do app: <code className="text-fg">{__BUILD_COMMIT__}</code> ·{' '}
          {new Date(__BUILD_STAMP__).toLocaleString()}
        </p>
        <p className="mt-1">Modo: {isStandalone() ? 'instalado na tela de início' : 'navegador'}</p>
        <p className="mt-1">Service worker: {swInfo}</p>
        <p className="mt-1 break-all">Navegador: {navigator.userAgent}</p>
      </div>

      {/* The hidden real-embed test lives here: tiny but rendered (a display:none
          iframe would never initialize). */}
      <div
        ref={embedHostRef}
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 right-0 h-[18px] w-8 overflow-hidden opacity-[0.01]"
      />
    </div>
  );
}

function StatusDot({ status }: { status: StepStatus }) {
  if (status === 'running') {
    return <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent-500" />;
  }
  if (status === 'pass') {
    return (
      <svg className="shrink-0 text-emerald-500" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-label="ok">
        <path d="m20 6-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg className="shrink-0 text-red-600" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-label="falhou">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return <span className="h-2 w-2 shrink-0 rounded-full bg-fg-muted/40" />;
}

function Verdict({ failed }: { failed: StepKey[] }) {
  let title: string;
  let body: string;
  if (failed.length === 0) {
    title = 'Tudo passou neste aparelho ✅';
    body =
      'O YouTube funciona aqui. Se os vídeos ainda não tocam nas páginas do app, quase certamente este aparelho está rodando uma versão velha em cache: toque em "Resetar o app" abaixo e tente um vídeo de novo.';
  } else if (failed.includes('script') || failed.includes('embed')) {
    title = 'O YouTube está sendo bloqueado neste aparelho 🚫';
    body =
      'O app está de pé, mas este aparelho não consegue falar com o player do YouTube. É exatamente o que um bloqueador faz quando bloqueia o SITE youtube.com (não só o app do YouTube). Confira no Opal e no ClearSpace se "youtube.com" está na lista de sites bloqueados de alguma sessão ativa, e em Ajustes > Tempo de Uso > Restrições de Conteúdo e Privacidade > Conteúdo Web. Bloquear o app do YouTube pode continuar; o site precisa ficar livre pro nosso player funcionar.';
  } else if (failed.includes('server')) {
    title = 'Este aparelho não alcançou o servidor do app 📡';
    body = 'Parece problema de conexão (ou VPN/filtro barrando o domínio do app). Testa em outra rede (Wi-Fi vs 4G) e roda de novo.';
  } else {
    title = 'Só as imagens do YouTube falharam 🖼️';
    body =
      'O player deve funcionar, mas os thumbnails não carregam (i.ytimg.com bloqueado). Vale liberar esse domínio no bloqueador também.';
  }
  return (
    <div className="mt-4 rounded-xl border border-accent-500/40 bg-accent-500/5 p-4">
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-1 text-sm text-fg-muted">{body}</p>
    </div>
  );
}
