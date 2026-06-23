// Phase 1 placeholder. The real feed (grid, channel chips, live pin, four states)
// is built in the UI phase. Kept minimal here so the shell boots cleanly.
export function Home() {
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title" className="text-xl font-semibold">
        Home
      </h1>
      <p className="mt-2 text-sm text-fg-muted">Your curated feed will appear here.</p>
    </section>
  );
}
