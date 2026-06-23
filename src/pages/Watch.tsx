import { useParams } from 'react-router-dom';

// Phase 1 placeholder. The player, tracking, recommendations, and error handling
// are built in the UI and player phases.
export function Watch() {
  const { videoId } = useParams();
  return (
    <section aria-labelledby="watch-title">
      <h1 id="watch-title" className="text-xl font-semibold">
        Watch
      </h1>
      <p className="mt-2 text-sm text-fg-muted">Video id: {videoId}</p>
    </section>
  );
}
