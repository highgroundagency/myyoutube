import type { Video } from '../lib/youtube/types';
import { VideoCard } from './VideoCard';

type VideoGridProps = {
  videos: Video[];
  isSeen?: (id: string) => boolean;
  onToggleSeen?: (video: Video) => void;
};

/** Responsive grid of video cards. Keyed by id, never index (section 4). */
export function VideoGrid({ videos, isSeen, onToggleSeen }: VideoGridProps) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          seen={isSeen?.(video.id) ?? false}
          onToggleSeen={onToggleSeen}
        />
      ))}
    </div>
  );
}
