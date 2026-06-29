import { useMemo, useState } from 'react';
import {
  useExtractorHealth,
  useDownloadJobs,
  queueDownloads,
  type DownloadJob,
  type DownloadFormat,
} from '../hooks/useExtractor';
import { useDownloadFolders } from '../hooks/useDownloadFolders';
import { extractVideoIds } from '../lib/youtube/parseId';
import { generatePowerShell } from '../lib/downloads/script';
import { sanitizeFolderName, joinPath, DEFAULT_BASE } from '../lib/downloads/folders';

/**
 * Paste links, pick a folder, copy ONE self-contained PowerShell script, run it.
 * That is the main path (no server to start, downloads on paste). A collapsed
 * section keeps the in-app extractor flow for grabbing onto the iPhone.
 */
export function Downloads() {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<DownloadFormat>('video');
  const ids = useMemo(() => extractVideoIds(text), [text]);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Baixar vídeos</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Cole os links (um por linha), escolha a pasta e copie o código. Cole no PowerShell e o
          download começa sozinho. Não precisa instalar nem ligar nada antes.
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        spellCheck={false}
        placeholder={'https://youtu.be/...\nhttps://www.youtube.com/watch?v=...'}
        className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted/60 focus:border-accent-500"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
        <span>
          {ids.length} {ids.length === 1 ? 'link válido' : 'links válidos'}
        </span>
        <FormatToggle format={format} onChange={setFormat} />
      </div>

      <ScriptSection ids={ids} format={format} />
      <PhoneSection ids={ids} format={format} />
    </div>
  );
}

function FormatToggle({
  format,
  onChange,
}: {
  format: DownloadFormat;
  onChange: (f: DownloadFormat) => void;
}) {
  return (
    <span className="inline-flex overflow-hidden rounded-full border border-line">
      {(['video', 'audio'] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          aria-pressed={format === f}
          className={[
            'px-3 py-1 font-medium transition-colors',
            format === f ? 'bg-accent-500 text-white' : 'text-fg-muted hover:bg-surface-2',
          ].join(' ')}
        >
          {f === 'video' ? 'Vídeo' : 'Áudio'}
        </button>
      ))}
    </span>
  );
}

// ----- Primary: the self-contained PowerShell script ------------------------

function ScriptSection({ ids, format }: { ids: string[]; format: DownloadFormat }) {
  const { folders, remember, remove, base, setBase } = useDownloadFolders();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [highQuality, setHighQuality] = useState(true);
  const [useCookies, setUseCookies] = useState(false);
  const [copied, setCopied] = useState(false);

  const effectiveBase = base.trim() || DEFAULT_BASE;
  const safeName = sanitizeFolderName(name);
  const newPath = joinPath(effectiveBase, safeName || 'Sem nome');
  const usingExisting = mode === 'existing' && folders.length > 0;
  const folderPath = usingExisting ? selectedPath : newPath;
  const ready = ids.length > 0 && (usingExisting ? Boolean(selectedPath) : Boolean(safeName));

  const script = useMemo(
    () => (ready ? generatePowerShell({ ids, folderPath, format, highQuality, useCookies }) : ''),
    [ready, ids, folderPath, format, highQuality, useCookies],
  );

  const onCopy = async () => {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is selectable in the box below.
    }
    if (usingExisting) {
      const f = folders.find((x) => x.path === selectedPath);
      if (f) remember(f.name, f.path);
    } else if (safeName) {
      remember(safeName, newPath);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">1. Escolha a pasta</h2>

      {folders.length > 0 && (
        <div className="mt-3 inline-flex overflow-hidden rounded-full border border-line text-xs">
          {(['new', 'existing'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={[
                'px-3 py-1 font-medium transition-colors',
                mode === m ? 'bg-accent-500 text-white' : 'text-fg-muted hover:bg-surface-2',
              ].join(' ')}
            >
              {m === 'new' ? 'Pasta nova' : 'Pasta existente'}
            </button>
          ))}
        </div>
      )}

      {usingExisting ? (
        <select
          value={selectedPath}
          onChange={(e) => setSelectedPath(e.target.value)}
          className="mt-3 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-fg outline-none focus:border-accent-500"
        >
          <option value="">Escolha uma pasta...</option>
          {folders.map((f) => (
            <option key={f.path} value={f.path}>
              {f.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-fg-muted">
            Onde criar as pastas
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent-500"
            />
          </label>
          <label className="text-xs text-fg-muted">
            Nome da pasta
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Podcasts Bryan Johnson"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg outline-none placeholder:text-fg-muted/60 focus:border-accent-500"
            />
          </label>
          {safeName && (
            <p className="truncate text-xs text-fg-muted">
              Vai criar em: <code className="text-fg">{newPath}</code>
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={highQuality}
            onChange={(e) => setHighQuality(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          1080p (baixa o ffmpeg na 1ª vez, ~80MB). Desmarque pra ser mais leve/rápido.
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={useCookies}
            onChange={(e) => setUseCookies(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          Usar meus cookies do Chrome (se der erro de &ldquo;not a bot&rdquo;)
        </label>
      </div>

      <h2 className="mt-5 text-sm font-semibold">2. Copie e cole no PowerShell</h2>
      {ready ? (
        <div className="mt-2">
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={onCopy}
              className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
            >
              {copied ? 'Copiado!' : 'Copiar código'}
            </button>
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg border border-line bg-bg p-3 text-[11px] leading-relaxed text-fg">
            <code>{script}</code>
          </pre>
        </div>
      ) : (
        <p className="mt-2 text-xs text-fg-muted">
          {ids.length === 0 ? 'Cole pelo menos um link acima.' : 'Dê um nome pra pasta acima.'}
        </p>
      )}

      {folders.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-medium text-fg-muted">Pastas salvas</p>
          <ul className="flex flex-col gap-1">
            {folders.map((f) => (
              <li key={f.path} className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('existing');
                    setSelectedPath(f.path);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-fg-muted hover:text-fg"
                  title={f.path}
                >
                  <span className="font-medium text-fg">{f.name}</span>{' '}
                  <span className="text-fg-muted/70">{f.path}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.path)}
                  aria-label={`Esquecer ${f.name}`}
                  className="shrink-0 rounded p-1 text-fg-muted hover:bg-surface-2 hover:text-fg"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ----- Secondary (collapsed): download onto the iPhone via the extractor -----

function PhoneSection({ ids, format }: { ids: string[]; format: DownloadFormat }) {
  const { online } = useExtractorHealth();
  const { jobs } = useDownloadJobs(online);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async () => {
    if (ids.length === 0 || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await queueDownloads(ids, format);
      setNotice(`${result.accepted.length} na fila.`);
    } catch {
      setNotice('Não consegui falar com o extrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <details className="mt-4 rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-fg-muted">
        Baixar direto no iPhone (sem PowerShell)
      </summary>
      <p className="mt-2 text-xs text-fg-muted">
        Pro iPhone, o laptop baixa e te deixa salvar em Arquivos. Precisa do extrator ligado no
        laptop uma vez (<code className="rounded bg-surface-2 px-1 py-0.5 text-fg">npm run go</code>{' '}
        na pasta <code className="rounded bg-surface-2 px-1 py-0.5 text-fg">local-server</code>) e
        abrir o app pelo QR que ele mostra.
      </p>

      {online ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={ids.length === 0 || submitting}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Enviando...' : `Baixar tudo${ids.length > 0 ? ` (${ids.length})` : ''}`}
        </button>
      ) : (
        <p className="mt-3 text-xs text-fg-muted">Extrator desligado no momento.</p>
      )}
      {notice && <p className="mt-2 text-xs text-accent-600">{notice}</p>}

      {jobs.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-lg border border-line">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ul>
      )}
    </details>
  );
}

function JobRow({ job }: { job: DownloadJob }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <StatusIcon status={job.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg" title={job.title}>
          {job.title}
        </p>
        {job.status === 'error' && job.error ? (
          <p className="truncate text-xs text-red-600" title={job.error}>
            {job.error}
          </p>
        ) : (
          <p className="text-xs text-fg-muted">{STATUS_LABEL[job.status]}</p>
        )}
      </div>
      {job.status === 'done' && (
        <a
          href={`/download?v=${job.id}&format=${job.format}`}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          Salvar no aparelho
        </a>
      )}
    </li>
  );
}

const STATUS_LABEL: Record<DownloadJob['status'], string> = {
  queued: 'Na fila...',
  downloading: 'Baixando no laptop...',
  done: 'Pronto no laptop',
  error: 'Falhou',
};

function StatusIcon({ status }: { status: DownloadJob['status'] }) {
  if (status === 'downloading') {
    return <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent-500" />;
  }
  if (status === 'done') {
    return (
      <svg className="shrink-0 text-emerald-500" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m20 6-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg className="shrink-0 text-red-600" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8v5M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="shrink-0 text-fg-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
