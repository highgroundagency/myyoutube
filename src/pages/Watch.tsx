import { useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFeed } from '../hooks/useFeed';
import { useVideo } from '../hooks/useVideo';
import { useExtractorHealth, useDownloaded } from '../hooks/useExtractor';
import { useComments } from '../hooks/useComments';
import { usePersistence } from '../providers/persistence';
import { useYouTubePlayer } from '../lib/player/useYouTubePlayer';
import { useDocumentPiP } from '../lib/player/useDocumentPiP';
import { DownloadButton } from '../components/DownloadButton';
import { CommentPreview } from '../components/CommentPreview';
import { RecommendedRail } from '../components/RecommendedRail';
import { ErrorState } from '../components/ErrorState';
import { VideoCardSkeleton } from '../components/Skeletons';
import { VIEWER_REGION, RESUME_MIN_SECONDS, COMPLETION_RATIO } from '../config/constants';
import { relativeAge, scheduledLabel } from '../lib/format';
import { formatDuration } from '../lib/youtube/duration';
import type { Video } from '../lib/youtube/types';
import type { WatchRecord } from '../lib/persistence/types';

/**
 * Where to resume this video, or 0 to start fresh. Uses the last cursor (or the
 * furthest position as a fallback for older records), but only for in-progress
 * videos with enough watched and not already near the end.
 */
function resumePoint(record: WatchRecord | undefined, durationSeconds: number): number {
  if (!record || record.status === 'completed') return 0;
  const point = record.lastPositionSeconds ?? record.watchedSeconds ?? 0;
  if (point < RESUME_MIN_SECONDS) return 0;
  if (durationSeconds > 0 && point >= durationSeconds * COMPLETION_RATIO) return 0;
  return point;
}

function isRegionBlocked(video: Video): boolean {
  const r = video.regionRestriction;
  if (!r) return false;
  if (r.blocked?.includes(VIEWER_REGION)) return true;
  if (r.allowed && r.allowed.length > 0 && !r.allowed.includes(VIEWER_REGION)) return true;
  return false;
}

function playerErrorMessage(code: number | null): string {
  switch (code) {
    case 2:
      return 'This video link looks invalid.';
    case 5:
      return 'The player ran into a playback error.';
    case 100:
      return 'This video was removed or made private.';
    case 101:
    case 150:
      return 'This channel disabled playback outside YouTube. It cannot be embedded here.';
    default:
      return 'This video could not be played right now.';
  }
}

export function Watch() {
  const { videoId = '' } = useParams();
  const navigate = useNavigate();
  const feedQuery = useFeed();
  const { online: extractorOnline } = useExtractorHealth();
  const { isDownloaded } = useDownloaded(extractorOnline);
  const commentsQuery = useComments(videoId, Boolean(videoId));
  const { recordProgress, recordPosition, getRecord, markSeen, markCompleted, isSeen, addWatchSeconds } =
    usePersistence();

  // Jump to the top so the player is in view the moment a video opens, instead
  // of keeping the feed's scroll position from where the card was tapped.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [videoId]);

  const pool = feedQuery.data?.videos ?? [];
  const poolVideo = pool.find((v) => v.id === videoId);
  const needFetch = !poolVideo && Boolean(videoId);
  const videoQuery = useVideo(videoId, needFetch && !feedQuery.isLoading);
  const video = poolVideo ?? videoQuery.data ?? null;

  const isUpcoming = video?.liveState === 'upcoming';
  const regionBlocked = video ? isRegionBlocked(video) : false;
  const playable = Boolean(video) && !isUpcoming && !regionBlocked;

  // Watch tracking callbacks (section 12). Stable per video.
  const onSeen = useCallback(() => {
    if (video) markSeen(video);
  }, [video, markSeen]);
  const onFurthest = useCallback(
    (seconds: number) => {
      if (video) recordProgress(video, seconds);
    },
    [video, recordProgress],
  );
  const onCompleted = useCallback(() => {
    if (video) {
      markCompleted(video);
      addWatchSeconds(0, 1);
    }
  }, [video, markCompleted, addWatchSeconds]);
  const onWatchTime = useCallback(
    (delta: number) => {
      addWatchSeconds(delta, 0);
    },
    [addWatchSeconds],
  );
  const onPosition = useCallback(
    (seconds: number) => {
      if (video) recordPosition(video, seconds);
    },
    [video, recordPosition],
  );

  // Capture the resume point once, the first time this video resolves, so the
  // hint and the player's initial seek stay stable while the cursor moves.
  const resumeRef = useRef<{ id: string; seconds: number } | null>(null);
  if (video && resumeRef.current?.id !== video.id) {
    resumeRef.current = {
      id: video.id,
      seconds: resumePoint(getRecord(video.id), video.durationSeconds),
    };
  }
  const resumeFrom =
    video && resumeRef.current && resumeRef.current.id === video.id
      ? resumeRef.current.seconds
      : 0;

  const { containerRef, status, errorCode, reload } = useYouTubePlayer({
    videoId,
    durationSeconds: video?.durationSeconds ?? 0,
    enabled: playable,
    autoplay: true,
    startSeconds: resumeFrom,
    onSeen,
    onFurthest,
    onPosition,
    onCompleted,
    onWatchTime,
    media: video
      ? { title: video.title, channelLabel: video.channelLabel, thumbnailUrl: video.thumbnailUrl }
      : undefined,
  });

  const pip = useDocumentPiP(containerRef);

  const markSeenAndBack = () => {
    if (video) markSeen(video);
    navigate('/');
  };

  const loading = !video && (feedQuery.isLoading || (needFetch && videoQuery.isLoading));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to feed
        </Link>

        {loading ? (
          <div>
            <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-2" />
            <div className="mt-4">
              <VideoCardSkeleton />
            </div>
          </div>
        ) : !video ? (
          <ErrorState
            title="Video not available"
            message="We could not find that video. It may have been removed or made private."
            onRetry={() => navigate('/')}
          />
        ) : (
          <>
            <PlayerArea
              video={video}
              isUpcoming={isUpcoming}
              regionBlocked={regionBlocked}
              status={status}
              errorCode={errorCode}
              containerRef={containerRef}
              onReload={reload}
              onMarkSeenAndBack={markSeenAndBack}
            />

            <div className="mt-4">
              <h1 className="text-lg font-semibold leading-snug">{video.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                <Link to={`/channel/${video.channelKey}`} className="font-medium text-fg hover:text-accent-600">
                  {video.channelLabel}
                </Link>
                {video.liveState === 'live' ? (
                  <span className="text-red-600">Live now</span>
                ) : isUpcoming ? (
                  <span>{scheduledLabel(video.scheduledStartTime)}</span>
                ) : (
                  <span>{relativeAge(video.publishedAt)}</span>
                )}
                {video.durationSeconds > 0 && <span>{formatDuration(video.durationSeconds)}</span>}
                {isSeen(video.id) && <span className="text-accent-600">Watched</span>}
              </div>
              {resumeFrom > 0 && status !== 'error' && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Continuando de {formatDuration(resumeFrom)}
                </p>
              )}
              {pip.supported && status === 'ready' && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={pip.toggle}
                    className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor" />
                    </svg>
                    {pip.active ? 'Fechar janelinha' : 'Janelinha flutuante'}
                  </button>
                </div>
              )}
              {extractorOnline && (
                <div className="mt-3">
                  <DownloadButton
                    video={video}
                    online={extractorOnline}
                    downloaded={isDownloaded(video.id)}
                    variant="full"
                  />
                </div>
              )}
              <CommentPreview
                comments={commentsQuery.data?.comments ?? []}
                disabled={commentsQuery.data?.disabled}
                loading={commentsQuery.isLoading}
                variant="full"
              />
            </div>
          </>
        )}
      </div>

      <aside className="min-w-0">
        <h2 className="mb-3 text-sm font-semibold text-fg-muted">Recommended</h2>
        <RecommendedRail
          videos={pool}
          currentId={videoId}
          channelKey={video?.channelKey ?? ''}
          isSeen={isSeen}
        />
      </aside>
    </div>
  );
}

type PlayerAreaProps = {
  video: Video;
  isUpcoming: boolean;
  regionBlocked: boolean;
  status: ReturnType<typeof useYouTubePlayer>['status'];
  errorCode: number | null;
  containerRef: ReturnType<typeof useYouTubePlayer>['containerRef'];
  onReload: () => void;
  onMarkSeenAndBack: () => void;
};

function PlayerArea({
  video,
  isUpcoming,
  regionBlocked,
  status,
  errorCode,
  containerRef,
  onReload,
  onMarkSeenAndBack,
}: PlayerAreaProps) {
  if (isUpcoming) {
    return (
      <Overlay title="This stream has not started yet" message={scheduledLabel(video.scheduledStartTime)}>
        <button
          type="button"
          onClick={onMarkSeenAndBack}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
        >
          Back to feed
        </button>
      </Overlay>
    );
  }

  if (regionBlocked) {
    return (
      <Overlay
        title="Not available in your region"
        message="The owner has restricted this video so it cannot play where you are."
      >
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
          >
            Open on YouTube
          </a>
          <button
            type="button"
            onClick={onMarkSeenAndBack}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Mark as seen and go back
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center text-white">
          <p className="max-w-sm text-sm">{playerErrorMessage(errorCode)}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Open on YouTube
            </a>
            <button
              type="button"
              onClick={onReload}
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onMarkSeenAndBack}
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Mark seen, go back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Overlay({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface px-6 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-fg-muted">{message}</p>
      {children}
    </div>
  );
}
