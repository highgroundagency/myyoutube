import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="py-16 text-center" aria-labelledby="notfound-title">
      <h1 id="notfound-title" className="text-2xl font-semibold">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-fg-muted">That page does not exist in this app.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
      >
        Back to home
      </Link>
    </section>
  );
}
