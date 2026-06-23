/** Loading skeletons that match the final card layout to prevent layout jump. */

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/5 to-transparent animate-shimmer dark:via-white/5" />
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Shimmer className="aspect-video w-full rounded-xl" />
      <div className="flex gap-3">
        <Shimmer className="h-9 w-9 shrink-0 rounded-full" />
        <div className="flex w-full flex-col gap-2">
          <Shimmer className="h-4 w-11/12 rounded" />
          <Shimmer className="h-3 w-2/3 rounded" />
          <Shimmer className="h-3 w-1/3 rounded" />
        </div>
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading videos"
    >
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}
