import { useParams } from 'react-router-dom';

// Phase 1 placeholder. A single channel view is built in the UI phase.
export function Channel() {
  const { channelKey } = useParams();
  return (
    <section aria-labelledby="channel-title">
      <h1 id="channel-title" className="text-xl font-semibold">
        Channel
      </h1>
      <p className="mt-2 text-sm text-fg-muted">Channel: {channelKey}</p>
    </section>
  );
}
