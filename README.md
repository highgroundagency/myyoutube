# GabesVideos

A private, single user web app that looks and feels like YouTube but only shows long form videos
from a small fixed list of channels you choose. No Shorts, no comments, no recommendation rabbit
hole. Just a calm, curated feed, a clean watch page, recommendations limited to your channels, and a
personal stats dashboard that frames your watch time as learning time.

It installs as its own PWA on its own domain, so app and site blockers that target `youtube.com`
and the YouTube app do not catch it.

## Highlights

- Long form only. Shorts (180 seconds or under) are filtered out.
- Closed pool. The feed and every recommendation come only from your configured channels.
- Watching a video removes it from the feed, plus a quick "mark as already seen" action.
- Cross device sync of watch state and stats through Supabase, with an offline write queue.
- Caze TV live detection with a pinned live banner.
- Stats dashboard: watch time per day, streak, videos completed, time by category.
- Resilient by design: zod validated API responses, an error boundary, and explicit loading,
  empty, error, and loaded states everywhere.
- Works fully in MOCK_MODE with no API key, no Supabase, and no network.

## Quick start (no secrets needed)

```bash
npm install
npm run dev
```

By default `npm run dev` runs Vite. To use the bundled mock data (so the whole UI works with no API
key and no network), set the flag:

```bash
VITE_MOCK_MODE=true npm run dev
```

Open http://localhost:5173. You will see a "Showing mock data" banner and a populated feed, watch
page, history, and stats.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (use `VITE_MOCK_MODE=true` for offline UI work). |
| `npm run dev:api` | `vercel dev`: runs the app and the `/api` serverless functions locally. |
| `npm run build` | Type check then production build (also generates the PWA service worker). |
| `npm run preview` | Serve the production build locally. |
| `npm run typecheck` | `tsc --noEmit`, zero type errors expected. |
| `npm run lint` | ESLint, zero errors expected. |
| `npm run test` | Vitest unit and component tests. |
| `npm run resolve-channels` | Resolve every `@handle` and print a report (needs the API key). |
| `npm run icons` | Regenerate the PWA icons from the logo. |
| `npm run check:emdash` | Fails if any em-dash sneaks into the codebase. |

## Local development with the API

The plain Vite dev server does NOT run the `/api` functions. There are two ways to develop:

1. UI only, no secrets: `VITE_MOCK_MODE=true npm run dev`. Reads `src/fixtures/feed.json`.
2. Full stack including the API: install the Vercel CLI and run `vercel dev`.

```bash
npm i -g vercel
vercel link        # link this folder to a Vercel project (one time)
npm run dev:api    # runs vercel dev: app + /api functions
```

`vercel dev` reads your local `.env`, so set `YOUTUBE_API_KEY` there first.

## Environment variables

Copy `.env.example` to `.env` and fill it in. Never commit `.env`. In production, set the same
variables in the Vercel project settings.

```
# Server side only. NO VITE_ prefix. Never imported anywhere under src/.
YOUTUBE_API_KEY=

# Client side (safe to expose, protected by Supabase row level security).
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Client flags
VITE_MOCK_MODE=false
VITE_EMBED_HOST=https://www.youtube.com
```

Rules that the code enforces:

- `YOUTUBE_API_KEY` is used only inside `/api`. It has no `VITE_` prefix and is never imported into
  `src`, so it cannot leak into the client bundle.
- If `YOUTUBE_API_KEY` is missing at the serverless layer, `/api/feed` returns a clear 503 and the
  client automatically falls back to MOCK_MODE with a banner.
- If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, the app still runs. Sync is disabled
  and a banner explains that your data is saved on this device only.

## Channels

Channels live in one config file: `src/config/channels.ts`. Each entry has a stable `key`, a
YouTube `@handle`, a display `label`, an optional `category`, and an optional `liveCheck` flag.

Treat every handle as unverified until the resolution script confirms it:

```bash
# with YOUTUBE_API_KEY set in .env or your shell
npm run resolve-channels
```

This prints a table of handle to resolved channel id, uploads playlist id, and the resolution method
(handle, handle-no-at, search, or failed). Channels resolved by search or marked failed are
highlighted so you can fix the handle. The Mandarin entry ships as a `@CHANGE_ME` placeholder: replace
it with the real handle, then re-run the script.

## Google Cloud API key restriction

In the Google Cloud console, restrict the key by API: allow only "YouTube Data API v3".

Do NOT restrict the key by HTTP referrer or by IP. Vercel serverless IPs are dynamic, and referrer
restrictions do not apply to server side calls, so those restrictions would break the API in
production. API restriction by service is the right control here.

The default daily quota is 10000 units. This app budgets far under it: about 2 cheap calls per
channel per feed refresh (around 14 units), cached at the CDN for 30 minutes, plus the Caze TV live
check (100 units) cached for about 5 minutes and only while the app is open.

## Supabase setup

1. Create a Supabase project. Copy the project URL and the anon key into `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
2. Open the SQL editor and paste the entire contents of `supabase/schema.sql`, then run it. This
   creates the `watch_state` and `daily_stats` tables, row level security policies that scope every
   row to its owner, and two atomic RPCs (`increment_daily_stats` and `upsert_watch_state`) so two
   devices never clobber each other.
3. Auth uses email magic links (PKCE). In Supabase Auth settings, add your deployed site URL and
   `http://localhost:5173` to the allowed redirect URLs, otherwise the magic link will not return to
   the app.

Row level security note: a misconfigured policy silently returns empty results rather than an error.
The provided policies scope reads and writes to `auth.uid()`.

## YouTube Premium and app blockers (the embed host tradeoff)

The one unavoidable YouTube dependency is the embedded player. The host is configurable with
`VITE_EMBED_HOST`:

- `https://www.youtube.com` (default): the official player carries your signed in YouTube session in
  that browser, so Premium benefits apply on a best effort basis. Friendlier to staying signed in.
- `https://www.youtube-nocookie.com`: no session, so no Premium benefit, but it can be friendlier to
  some blockers.

To test which your blockers allow, switch `VITE_EMBED_HOST`, rebuild or restart, and try playing a
video. The rest of the app (shell, feed, stats) never touches a YouTube domain, so only the player
frame depends on YouTube.

## App blocker strategy (honest version)

- The app lives on its own custom domain that you do not add to your blocklist.
- It installs as its own PWA (GabesVideos) with its own icon and name, separate from Safari or the
  YouTube app, so app level blockers that target the YouTube app do not catch it.
- The word "youtube" appears nowhere in the domain, title, manifest, or visible branding.
- If a blocker blocks `youtube.com` at the network level, embeds break. If it only blocks navigation
  to `youtube.com` as a destination, the embedded sub-resource often still loads. This varies by
  blocker, which is why the embed host is configurable.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (or run `vercel`).
2. Vercel detects Vite automatically: build command `npm run build`, output directory `dist`. The
   `/api/*.ts` files are deployed as serverless functions with no extra config.
3. In the Vercel project settings, add the environment variables: `YOUTUBE_API_KEY`,
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_EMBED_HOST`. Leave
   `VITE_MOCK_MODE` unset or `false` in production.
4. Add your deployed URL to the Supabase allowed redirect URLs (see above).
5. PWA needs HTTPS in production, which Vercel provides. Localhost works for dev.

## Project structure

```
/api/        Vercel serverless functions (server side, holds the YouTube key)
  feed.ts    GET /api/feed     full pipeline, CDN cached, graceful on quota
  live.ts    GET /api/live     Caze TV live status, short cache
  video.ts   GET /api/video    single video for a direct watch link
  _youtube.ts  resolve, fetch uploads, chunked videos.list, retries, quota detection
  _cache.ts    warm instance cache for the quota fallback
/src/
  config/      channels, pure constants, client env (the only reader of import.meta.env)
  lib/youtube/ duration parser, thumbnails, zod schemas, normalize, filters, errors
  lib/player/  singleton IFrame loader and the tracking hook
  lib/watch/   local first watch state store
  lib/stats/   local first daily stats store and computations
  lib/supabase/ client, auth sync, watch and stats persistence, offline queue
  hooks/       useFeed, useLive, useVideo, useWatchState, useDailyStats
  components/  TopBar, VideoCard, VideoGrid, ChannelChips, RecommendedRail, states
  pages/       Home, Watch, Stats, Channel, History, Login
  fixtures/    mock data for MOCK_MODE
/scripts/      resolve-channels, generate-icons, check-emdash
/supabase/     schema.sql (paste into the Supabase SQL editor)
```

## Testing

```bash
npm run test
```

Covers the ISO 8601 duration parser (the full spec matrix), the normalize and filter pipeline, a
fetch mocked `buildFeed` and live check (Shorts filtering, deleted and private skips, omitted ids,
the Mandarin placeholder, quota detection), the player watch-time tracking (seen at 3 seconds, wall
clock accrual immune to scrubbing, 90 percent completion, pause stops accrual), the watch store merge
semantics, the stats computations, the fixtures, and a home render smoke that asserts a clean console.

A real browser console check is recommended before deploy (this environment cannot run a headless
browser). The jsdom smoke test stands in for it in CI.

## Notes on resilience

- Every external response is validated with zod; bad items are dropped, never thrown to the user.
- API arrays are mapped by id, never by array index.
- Quota exhaustion serves cached content with a quiet notice instead of an error.
- The player loader is a singleton (one global ready callback), and create and destroy are idempotent
  so React StrictMode double mounting does not create two players or double count time.
- Watch progress is never lost: optimistic local writes are queued and retried on failure rather than
  rolled back.
- Day boundaries for stats use your local timezone, not UTC.
