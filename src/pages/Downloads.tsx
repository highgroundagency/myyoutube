import { useMemo, useState } from 'react';
import { useExtractorHealth, useDownloadJobs, queueDownloads, type DownloadJob } from '../hooks/useExtractor';
import { extractVideoIds } from '../lib/youtube/parseId';
import { EmptyState } from '../components/EmptyState';

/**
 * Paste a bunch of YouTube links, hit one button, and the laptop downloads them
 * all. Only useful when the app is opened through the laptop tunnel (the
 * extractor is reachable); otherwise it explains how to get there.
 */
export function Downloads() {
  const { online } = useExtractorHealth();
  const { jobs } = useDownloadJobs(online);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const ids = useMemo(() => extractVideoIds(text), [text]);

  const onSubmit = async () => {
    if (ids.length === 0 || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await queueDownloads(ids, 'video');
      setText('');
      const n = result.accepted.length;
      const bad = result.invalid.length;
      setNotice(
        `${n} ${n === 1 ? 'vídeo' : 'vídeos'} na fila${bad ? ` · ${bad} link(s) não reconhecidos` : ''}.`,
      );
    } catch {
      setNotice('Não consegui falar com o extrator do laptop. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!online) {
    return (
      <EmptyState
        title="Baixador indisponível"
        message="Abra o app pelo túnel do seu laptop (quando aparece o selo Modo download) para colar links e baixar. O extrator precisa estar rodando no notebook."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">Baixar por link</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Cole um ou vários links do YouTube (um por linha). Toque em baixar e eles vão direto pro
          seu laptop.
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={'https://youtu.be/...\nhttps://www.youtube.com/watch?v=...\n...'}
        className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted/60 focus:border-accent-500"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={ids.length === 0 || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {submitting
            ? 'Enviando...'
            : `Baixar tudo${ids.length > 0 ? ` (${ids.length})` : ''}`}
        </button>
        {text.trim().length > 0 && (
          <span className="text-xs text-fg-muted">
            {ids.length} {ids.length === 1 ? 'link válido' : 'links válidos'} detectado
            {ids.length === 1 ? '' : 's'}
          </span>
        )}
        {notice && <span className="text-xs text-accent-600">{notice}</span>}
      </div>

      {jobs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-fg-muted">Fila de download</h2>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        </section>
      )}
    </div>
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
        {job.status === 'error' && job.error && (
          <p className="truncate text-xs text-red-600" title={job.error}>
            {job.error}
          </p>
        )}
        {job.status !== 'error' && (
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
