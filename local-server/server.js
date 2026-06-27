import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { config } from './config.js';
import { versions } from './tools.js';
import { reconcile, listEntries, getEntry, addEntry } from './manifest.js';
import { downloadVideo, getVideoInfo } from './ytdlp.js';
import { serveFileAsDownload, sanitizeFilename } from './httpRange.js';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isValidVideoId(id) {
  return VIDEO_ID_RE.test(id);
}

/**
 * Pull an 11-char YouTube video id out of a pasted link or bare id. Handles
 * watch?v=, youtu.be/, shorts/, live/, embed/, and surrounding junk. Returns
 * null when nothing valid is found.
 */
function parseVideoId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (VIDEO_ID_RE.test(s)) return s;
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1, 12);
      return VIDEO_ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && VIDEO_ID_RE.test(v)) return v;
      const m = u.pathname.match(/\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL; fall through to a loose scan
  }
  const loose = s.match(/(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([A-Za-z0-9_-]{11})/);
  return loose ? loose[1] : null;
}

/** De-duplicate concurrent downloads of the same video+format. */
const inFlight = new Map();

// ----- Batch download queue (paste many links, download to the laptop) -------

const MAX_CONCURRENT = 2;
/** videoId -> { id, title, format, status, error, queuedAt, startedAt, finishedAt } */
const jobs = new Map();
const queue = [];
let active = 0;

function jobView() {
  return [...jobs.values()].sort((a, b) => String(b.queuedAt).localeCompare(String(a.queuedAt)));
}

/** Keep the job list from growing without bound. */
function pruneJobs() {
  const finished = jobView().filter((j) => j.status === 'done' || j.status === 'error');
  for (const j of finished.slice(40)) jobs.delete(j.id);
}

async function runJob(job, format) {
  job.status = 'downloading';
  job.startedAt = new Date().toISOString();
  try {
    // Best effort metadata for a nicer label and duration; ignore if it fails.
    let meta = { title: job.title, channel: '', durationSeconds: 0 };
    try {
      const info = await getVideoInfo(job.id);
      meta = { title: info.title, channel: info.channel, durationSeconds: info.durationSeconds };
      job.title = info.title;
    } catch {
      // metadata probe failed; the download itself may still work
    }
    await ensureDownloaded(job.id, format, meta);
    job.status = 'done';
  } catch (err) {
    job.status = 'error';
    job.error = String(err?.message || err);
  } finally {
    job.finishedAt = new Date().toISOString();
  }
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const { job, format } = queue.shift();
    active += 1;
    runJob(job, format).finally(() => {
      active -= 1;
      pruneJobs();
      pump();
    });
  }
}

/** Queue a video id for download. Returns the (new or existing) job. */
function enqueue(videoId, format) {
  const existing = jobs.get(videoId);
  if (existing && (existing.status === 'queued' || existing.status === 'downloading')) {
    return existing;
  }
  if (getEntry(videoId)) {
    const done = {
      id: videoId,
      title: getEntry(videoId)?.title || videoId,
      format,
      status: 'done',
      queuedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
    jobs.set(videoId, done);
    return done;
  }
  const job = { id: videoId, title: videoId, format, status: 'queued', queuedAt: new Date().toISOString() };
  jobs.set(videoId, job);
  queue.push({ job, format });
  pump();
  return job;
}

async function ensureDownloaded(videoId, format, meta) {
  const existing = getEntry(videoId);
  if (existing && existing.format === format) return existing;

  const key = `${videoId}:${format}`;
  if (inFlight.has(key)) return inFlight.get(key);

  const work = (async () => {
    const result = await downloadVideo(videoId, format);
    const entry = addEntry({
      id: videoId,
      title: meta.title || videoId,
      channel: meta.channel || '',
      format: result.format,
      durationSeconds: meta.durationSeconds || 0,
      sizeBytes: result.sizeBytes,
      file: result.file,
      downloadedAt: new Date().toISOString(),
    });
    return { ...entry, absolutePath: result.absolutePath };
  })();

  inFlight.set(key, work);
  try {
    return await work;
  } finally {
    inFlight.delete(key);
  }
}

function downloadNameFor(entry, format) {
  const ext = path.extname(entry.file) || (format === 'audio' ? '.m4a' : '.mp4');
  const base = sanitizeFilename(entry.title || entry.id);
  return `${base}${ext}`;
}

function errorPage(res, err) {
  const status = err?.botCheck ? 429 : err?.code === 'NO_YTDLP' || err?.code === 'NO_FFMPEG' ? 500 : 502;
  const message = String(err?.message || 'Erro desconhecido.');
  res.status(status).type('html').send(
    `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>Falha ao baixar</title>` +
      `<style>body{font-family:-apple-system,system-ui,sans-serif;background:#0b0b0c;color:#eaeaea;` +
      `margin:0;padding:2rem;line-height:1.5}.card{max-width:32rem;margin:2rem auto;background:#171719;` +
      `border:1px solid #2a2a2e;border-radius:1rem;padding:1.5rem}h1{font-size:1.25rem;margin:0 0 .75rem}` +
      `p{margin:.5rem 0;color:#bdbdc2}code{color:#eaeaea}</style></head><body><div class="card">` +
      `<h1>Falha ao baixar</h1><p>${escapeHtml(message)}</p>` +
      `<p>Volte para o app e tente novamente.</p></div></body></html>`,
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function createApp() {
  reconcile();
  const toolVersions = versions();

  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.use(express.json({ limit: '256kb' }));

  // Health: the app checks for `extractor: true` so the Vercel SPA fallback
  // (which returns 200 HTML for unknown paths) cannot be mistaken for us.
  app.get('/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      extractor: true,
      name: 'gabesvideos-local-extractor',
      version: '0.1.0',
      tools: toolVersions,
      cookies: config.USE_BROWSER_COOKIES ? config.COOKIES_BROWSER : false,
      downloads: listEntries().length,
    });
  });

  // Which videos are already downloaded (so the feed can hide them).
  app.get('/downloaded', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const items = listEntries();
    res.json({ ids: items.map((e) => e.id), items });
  });

  // Queue a batch of pasted links/ids to download to the laptop. Returns what
  // was accepted, skipped (already downloaded/queued), and not understood.
  app.post('/downloads', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = req.body ?? {};
    const format = body.format === 'audio' ? 'audio' : 'video';
    const raw = Array.isArray(body.urls)
      ? body.urls
      : typeof body.text === 'string'
        ? body.text.split(/[\s,]+/)
        : [];
    const accepted = [];
    const invalid = [];
    const seen = new Set();
    for (const item of raw) {
      const trimmed = String(item || '').trim();
      if (!trimmed) continue;
      const id = parseVideoId(trimmed);
      if (!id) {
        invalid.push(trimmed);
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      const job = enqueue(id, format);
      accepted.push({ id: job.id, status: job.status });
    }
    res.json({ accepted, invalid, jobs: jobView() });
  });

  // Live status of the batch queue (the page polls this).
  app.get('/jobs', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ jobs: jobView(), active, queued: queue.length });
  });

  // Lightweight metadata probe for a single video.
  app.get('/info', async (req, res) => {
    const videoId = String(req.query.v || '').trim();
    if (!isValidVideoId(videoId)) {
      res.status(400).json({ error: 'bad_request', message: 'Missing or invalid video id.' });
      return;
    }
    try {
      const info = await getVideoInfo(videoId);
      const entry = getEntry(videoId);
      res.json({ ...info, downloaded: !!entry, format: entry?.format ?? null });
    } catch (err) {
      res
        .status(err?.botCheck ? 429 : 502)
        .json({ error: 'info_failed', botCheck: !!err?.botCheck, message: String(err?.message || err) });
    }
  });

  // Download (or serve an already-downloaded) video as a file attachment.
  // This is a navigation target on iOS: Safari shows the Save-to-Files sheet.
  app.get('/download', async (req, res) => {
    const videoId = String(req.query.v || '').trim();
    const format = req.query.format === 'audio' ? 'audio' : 'video';
    if (!isValidVideoId(videoId)) {
      res.status(400).type('text').send('Missing or invalid video id.');
      return;
    }
    const meta = {
      title: req.query.title ? String(req.query.title) : '',
      channel: req.query.channel ? String(req.query.channel) : '',
      durationSeconds: Number(req.query.duration) || 0,
    };
    try {
      const entry = await ensureDownloaded(videoId, format, meta);
      const mime = format === 'audio' ? 'audio/mp4' : 'video/mp4';
      serveFileAsDownload(req, res, entry.absolutePath, downloadNameFor(entry, format), mime);
    } catch (err) {
      console.error(`[download] ${videoId} failed: ${err?.message || err}`);
      errorPage(res, err);
    }
  });

  // Proxy the app's data API to the deployed site so the feed still loads
  // through the tunnel (the deployment holds the YouTube API key).
  app.use('/api', async (req, res) => {
    const target = config.VERCEL_BASE_URL + req.originalUrl;
    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers: { accept: req.headers.accept || 'application/json' },
      });
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'no-store');
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (err) {
      res.status(502).json({ error: 'proxy_failed', message: String(err?.message || err) });
    }
  });

  // Serve the built PWA and fall back to index.html for client-side routes.
  const indexHtml = path.join(config.DIST_DIR, 'index.html');
  const hasBuild = fs.existsSync(indexHtml);
  if (hasBuild) {
    app.use(express.static(config.DIST_DIR, { index: false }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(indexHtml);
    });
  } else {
    app.get('*', (req, res) => {
      res
        .status(503)
        .type('text')
        .send('App build not found. Run "npm run build" in the project root, then restart.');
    });
  }

  return { app, hasBuild, toolVersions };
}

export async function startServer() {
  const { app, hasBuild, toolVersions } = await createApp();
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, () => resolve());
  });
  return { server, hasBuild, toolVersions };
}

// Allow running the server directly: `node server.js`.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  startServer()
    .then(({ hasBuild }) => {
      console.log(`Extractor listening on http://localhost:${config.PORT}`);
      if (!hasBuild) console.log('Note: app build not found; run "npm run build" in the project root.');
    })
    .catch((err) => {
      console.error('Failed to start server:', err?.message || err);
      process.exit(1);
    });
}
