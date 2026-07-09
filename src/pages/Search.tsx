import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import { useWatchState } from '../hooks/useWatchState';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Badge } from '../components/Badge';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { formatDuration } from '../lib/youtube/duration';
import { relativeAge } from '../lib/format';
import { CHANNELS_BY_KEY } from '../config/channels';
import type { Video } from '../lib/youtube/types';

/**
 * Real YouTube search results (section: search), laid out like YouTube's result
 * list: thumbnail on the left, title/channel/age on the right, stacked on
 * mobile. Results are canonical Videos, so tapping one plays it in the app and
 * everything (history, stats, resume) tracks normally.
 */
export function Search() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const searchQuery = useSearch(query);
  const { isSeen, records } = useWatchState();

  if (!query) {
    return (
      <EmptyState
        title="O que você quer assistir?"
        message="Digite na barra de cima e aperte Enter pra buscar no YouTube de verdade."
      />
    );
  }

  if (searchQuery.isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex animate-pulse gap-4">
            <div className="aspect-video w-40 shrink-0 rounded-xl bg-surface-2 sm:w-64" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/4 rounded bg-surface-2" />
              <div className="h-3 w-1/3 rounded bg-surface-2" />
              <div className="h-3 w-1/4 rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (searchQuery.isError) {
    return (
      <ErrorState
        title="A busca falhou"
        message="Não consegui buscar agora. Tente de novo em instantes."
        onRetry={() => searchQuery.refetch()}
      />
    );
  }

  const videos = searchQuery.data ?? [];
  if (videos.length === 0) {
    return (
      <EmptyState
        title="Nada encontrado"
        message={`Nenhum vídeo pra "${query}". Tente outros termos.`}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm text-fg-muted">
        Resultados pra <span className="font-medium text-fg">&ldquo;{query}&rdquo;</span>
      </p>
      <div className="flex flex-col gap-5">
        {videos.map((v) => (
          <ResultRow
            key={v.id}
            video={v}
            seen={isSeen(v.id)}
            progress={progressFor(records[v.id]?.watchedSeconds, v.durationSeconds)}
          />
        ))}
      </div>
    </div>
  );
}

function progressFor(watchedSeconds: number | undefined, durationSeconds: number): number {
  if (!watchedSeconds || durationSeconds <= 0) return 0;
  return Math.min(1, watchedSeconds / durationSeconds);
}

function ResultRow({ video, seen, progress }: { video: Video; seen: boolean; progress: number }) {
  const [errored, setErrored] = useState(false);
  const duration = formatDuration(video.durationSeconds);
  const isLive = video.liveState === 'live';
  const isMine = Boolean(CHANNELS_BY_KEY[video.channelKey]);

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:gap-4 ${seen ? 'opacity-70' : ''}`}>
      <Link
        to={`/watch/${video.id}`}
        className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-64"
        aria-label={video.title}
      >
        <img
          src={errored ? PLACEHOLDER_THUMBNAIL : video.thumbnailUrl}
          alt=""
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
        {isLive ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            LIVE
          </span>
        ) : (
          duration && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {duration}
            </span>
          )
        )}
        {progress > 0 && !isLive && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <span
              className="block h-full bg-accent-500"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={`/watch/${video.id}`} className="block">
          <h3 className="clamp-2 text-base font-medium leading-snug text-fg">{video.title}</h3>
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          {isMine ? (
            <Link to={`/channel/${video.channelKey}`} className="font-medium text-fg hover:text-accent-600">
              {video.channelLabel}
            </Link>
          ) : (
            <span>{video.channelLabel}</span>
          )}
          {isMine && <Badge variant="accent">Meu canal</Badge>}
          <span>{isLive ? 'Ao vivo agora' : relativeAge(video.publishedAt)}</span>
          {seen && <span className="text-accent-600">Assistido</span>}
        </div>
      </div>
    </div>
  );
}
