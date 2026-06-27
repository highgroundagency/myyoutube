import type { Video } from '../lib/youtube/types';
import type { WatchRecords } from '../lib/persistence/types';
import { VideoCard } from './VideoCard';

type VideoGridProps = {
  videos: Video[];
  isSeen?: (id: string) => boolean;
  onToggleSeen?: (video: Video) => void;
  extractorOnline?: boolean;
  isDownloaded?: (id: string) => boolean;
  showComments?: boolean;
  /** Watch records, used to draw a progress bar on each card. */
  records?: WatchRecords;
};

/** 0..1 share of a video watched, from the furthest recorded position. */
function progressFor(records: WatchRecords | undefined, video: Video): number {
  const r = records?.[video.id];
  if (!r) return 0;
  const duration = video.durationSeconds || r.durationSeconds || 0;
  if (duration <= 0) return 0;
  return Math.min(1, (r.watchedSeconds ?? 0) / duration);
}

/** Responsive grid of video cards. Keyed by id, never index (section 4). */
export function VideoGrid({
  videos,
  isSeen,
  onToggleSeen,
  extractorOnline,
  isDownloaded,
  showComments = true,
  records,
}: VideoGridProps) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          seen={isSeen?.(video.id) ?? false}
          onToggleSeen={onToggleSeen}
          extractorOnline={extractorOnline}
          downloaded={isDownloaded?.(video.id) ?? false}
          showComments={showComments}
          progress={progressFor(records, video)}
        />
      ))}
    </div>
  );
}
