import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePlaylist } from '../hooks/usePlaylist';
import { usePersistence } from '../providers/persistence';
import { computeStreak } from '../lib/stats/compute';
import { LEARNING_PLAYLISTS_BY_KEY } from '../config/playlists';
import { formatDuration } from '../lib/youtube/duration';
import { PLACEHOLDER_THUMBNAIL } from '../lib/youtube/thumbnails';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import type { Video } from '../lib/youtube/types';

type LessonStatus = 'done' | 'next' | 'started' | 'todo';

function ProgressRing({ percent, size = 96, stroke = 9 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-accent-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-fg">{percent}%</span>
      </div>
    </div>
  );
}

function FlameChip({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c.5 3-1.5 4.5-3 6.5C7.6 10.4 7 12 7 13.5a5 5 0 0 0 10 0c0-1.7-.8-3.3-2-4.5-.3 1-1 1.7-2 2 .8-2.3-.2-4.7-1-9Z" />
      </svg>
      {days} {days === 1 ? 'dia' : 'dias'}
    </span>
  );
}

function StatusNode({ status, n }: { status: LessonStatus; n: number }) {
  if (status === 'done') {
    return (
      <span className="z-10 flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m20 6-11 11-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === 'next') {
    return (
      <span className="z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-accent-500 bg-bg text-sm font-bold text-accent-600 ring-4 ring-accent-500/15 dark:text-accent-400">
        {n}
      </span>
    );
  }
  if (status === 'started') {
    return (
      <span className="z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-accent-400/70 bg-bg text-sm font-semibold text-accent-600 dark:text-accent-400">
        {n}
      </span>
    );
  }
  return (
    <span className="z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-fg-muted">
      {n}
    </span>
  );
}

function LessonRow({ video, index, status, isLast }: { video: Video; index: number; status: LessonStatus; isLast: boolean }) {
  return (
    <li className="relative flex gap-4">
      {/* The connecting path line. */}
      {!isLast && <span aria-hidden="true" className="absolute left-[18px] top-9 h-full w-0.5 bg-line" />}
      <div className="flex flex-col items-center">
        <StatusNode status={status} n={index + 1} />
      </div>
      <Link
        to={`/watch/${video.id}`}
        className={`group mb-4 flex flex-1 gap-3 rounded-xl border p-2.5 transition-colors ${
          status === 'next'
            ? 'border-accent-500/40 bg-accent-500/5 hover:bg-accent-500/10'
            : 'border-line hover:bg-surface-2'
        }`}
      >
        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-36">
          <Thumb src={video.thumbnailUrl} alt={video.title} />
          {video.durationSeconds > 0 && (
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white">
              {formatDuration(video.durationSeconds)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Licao {index + 1}
            {status === 'next' && <span className="ml-2 text-accent-600 dark:text-accent-400">Continue aqui</span>}
            {status === 'done' && <span className="ml-2 text-accent-600 dark:text-accent-400">Concluida</span>}
          </p>
          <h3 className="clamp-2 mt-1 text-sm font-medium leading-snug text-fg group-hover:text-accent-600">
            {video.title}
          </h3>
        </div>
      </Link>
    </li>
  );
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src || PLACEHOLDER_THUMBNAIL}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_THUMBNAIL;
      }}
      className="h-full w-full object-cover"
    />
  );
}

export function Learn() {
  const { courseKey = '' } = useParams();
  const course = LEARNING_PLAYLISTS_BY_KEY[courseKey];
  const playlistQuery = usePlaylist(course?.playlistId ?? '');
  const { watchState, dailyStats } = usePersistence();

  const lessons = useMemo(() => playlistQuery.data ?? [], [playlistQuery.data]);
  const streak = useMemo(() => computeStreak(dailyStats), [dailyStats]);

  const { completedCount, startedCount, percent, nextLesson } = useMemo(() => {
    let completed = 0;
    let started = 0;
    let next: Video | null = null;
    for (const v of lessons) {
      const status = watchState[v.id]?.status;
      if (status === 'completed') completed += 1;
      else {
        if (status === 'seen') started += 1;
        if (!next) next = v;
      }
    }
    return {
      completedCount: completed,
      startedCount: started,
      percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
      nextLesson: next,
    };
  }, [lessons, watchState]);

  const statusFor = (video: Video): LessonStatus => {
    const s = watchState[video.id]?.status;
    if (s === 'completed') return 'done';
    if (nextLesson && video.id === nextLesson.id) return 'next';
    if (s === 'seen') return 'started';
    return 'todo';
  };

  if (!course) {
    return (
      <ErrorState title="Curso nao encontrado" message="Esse curso nao existe." />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Voltar ao feed
      </Link>

      {/* Course header with progress + streak. */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-5">
          <ProgressRing percent={percent} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-fg">{course.label}</h1>
            {course.description && <p className="mt-0.5 text-sm text-fg-muted">{course.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-fg">
                {completedCount} de {lessons.length} licoes
              </span>
              <FlameChip days={streak} />
            </div>
          </div>
        </div>

        {nextLesson ? (
          <Link
            to={`/watch/${nextLesson.id}`}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-600 sm:w-auto"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            {completedCount > 0 || startedCount > 0 ? 'Continuar' : 'Comecar curso'}
          </Link>
        ) : lessons.length > 0 ? (
          <p className="mt-5 rounded-xl bg-accent-500/10 px-4 py-3 text-sm font-medium text-accent-700 dark:text-accent-300">
            Voce concluiu todas as licoes. Parabens!
          </p>
        ) : null}
      </section>

      {/* Lesson path. */}
      <div className="mt-6">
        {playlistQuery.isLoading ? (
          <LessonSkeleton />
        ) : lessons.length === 0 ? (
          <EmptyState
            title="Curso indisponivel agora"
            message="Nao foi possivel carregar as licoes. Tente novamente em instantes."
          />
        ) : (
          <ol className="list-none">
            {lessons.map((video, i) => (
              <LessonRow
                key={video.id}
                video={video}
                index={i}
                status={statusFor(video)}
                isLast={i === lessons.length - 1}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function LessonSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-2" />
          <div className="flex flex-1 gap-3 rounded-xl border border-line p-2.5">
            <div className="aspect-video w-28 shrink-0 animate-pulse rounded-lg bg-surface-2 sm:w-36" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
