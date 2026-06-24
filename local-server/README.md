# GabesVideos local extractor (laptop only)

This little server runs **on your laptop** so you can download videos from the
GabesVideos feed straight to your iPhone's **Files** app, in the best
iPhone-friendly quality (1080p H.264 + AAC, in an `.mp4`). Once a file is in
Files it plays with the screen locked, just like a normal download.

It is **never deployed**. The Vercel site stays exactly as it is for online
browsing. This folder is ignored by the app build and by Vercel.

## One command

From this folder:

```bash
npm install      # first time only
npm run go
```

`npm run go` will:

1. Install `yt-dlp`, `ffmpeg`, and `cloudflared` if they are missing (into `./bin`).
2. Build the app (`../dist`).
3. Start the local server on `http://localhost:8787`.
4. Open a free Cloudflare tunnel and print a **public URL + QR code**.

Scan the QR code with your iPhone camera. Safari opens the app from the tunnel,
so the page and the download API share one origin (no CORS, nothing to paste).

On the phone: tap **Baixar** on a video, wait for it to prepare, then choose
**Salvar em Arquivos** (Save to Files). That's it.

Press `Ctrl+C` in the terminal to stop. The public URL changes every run; just
re-scan the new QR code.

## Configuration

Everything has a sensible default. Override with environment variables:

| Variable             | Default                          | Purpose                                                        |
| -------------------- | -------------------------------- | -------------------------------------------------------------- |
| `VERCEL_BASE_URL`    | `https://myyoutube-mu.vercel.app`| Where `/api/*` is proxied so the feed loads through the tunnel.|
| `PORT`               | `8787`                           | Local port the tunnel points at.                               |
| `USE_BROWSER_COOKIES`| `false`                          | Reuse your logged-in YouTube session if a bot check appears.   |
| `COOKIES_BROWSER`    | `chrome`                         | Which browser's cookies to read (chrome, brave, edge, firefox, safari). |
| `SKIP_BUILD`         | `false`                          | Skip the rebuild and reuse `../dist` (faster restarts).        |

Example (macOS/Linux):

```bash
USE_BROWSER_COOKIES=true COOKIES_BROWSER=chrome npm run go
```

Example (Windows PowerShell):

```powershell
$env:USE_BROWSER_COOKIES="true"; $env:COOKIES_BROWSER="chrome"; npm run go
```

## Other scripts

- `npm run setup` - just install/verify the tools and print versions.
- `npm run server` - run the server without the tunnel (local testing).

## Endpoints

- `GET /health` - returns `{ extractor: true, ... }`. The app uses this exact
  signature so the Vercel SPA fallback (which returns 200 HTML for any path)
  can't be mistaken for the extractor.
- `GET /downloaded` - `{ ids: [...], items: [...] }` of everything downloaded.
- `GET /info?v=VIDEO_ID` - title/channel/duration + downloaded status.
- `GET /download?v=VIDEO_ID&format=video&title=...&channel=...&duration=...`:
  downloads (or serves) the file with full HTTP Range support so iOS can save
  it and play it locked.
- `GET /api/*` - proxied to `VERCEL_BASE_URL` so the feed still loads.

## Downloads and tracking

Files and a `manifest.json` live in `./downloads` (git-ignored). The manifest is
the server-side record of what's downloaded; the app reads `/downloaded` to hide
those videos from the feed. Delete a file (or the whole folder) and it
reconciles on next start: missing files drop out of the manifest, so the video
reappears in the feed.

## "Sign in to confirm you're not a bot"

YouTube sometimes challenges datacenter/residential IPs. If a download fails
with a bot-check message:

1. Set `USE_BROWSER_COOKIES=true` (and `COOKIES_BROWSER` to the browser you use
   for YouTube). The extractor will retry using your logged-in cookies, which
   usually passes the check and unlocks better formats.
2. If it still fails, your IP is likely rate-limited. Wait a few minutes and try
   again, or open YouTube in your browser first.
3. A few videos now require a "PO token". That is intentionally not handled here
   to keep this tool simple.

## Notes

- macOS may need to allow the downloaded `cloudflared`/`ffmpeg` binaries on first
  run (System Settings > Privacy & Security), or install them with
  `brew install cloudflared ffmpeg yt-dlp`.
- This folder is git-ignored from the main app and listed in `.vercelignore`, so
  it never ships to production.
