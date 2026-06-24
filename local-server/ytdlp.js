import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { getYtDlp, getFfmpeg } from './tools.js';
import { ensureDownloadsDir } from './manifest.js';

/**
 * Format selectors. The goal is the best iPhone-compatible file:
 * H.264 (avc1) video up to 1080p plus AAC (mp4a) audio in an mp4 container.
 * We deliberately avoid VP9 / AV1 / webm / 1440p / 4K, which the iOS Files
 * player and Save-to-Files flow handle poorly or not at all.
 */
const VIDEO_FORMAT = [
  // ideal: 1080p H.264 video + AAC audio
  'bv*[height<=1080][vcodec^=avc1]+ba[acodec^=mp4a]',
  // H.264 video + any best audio (ffmpeg re-muxes audio into the mp4)
  'bv*[height<=1080][vcodec^=avc1]+ba',
  // a single progressive H.264 mp4 (already merged)
  'b[height<=1080][vcodec^=avc1]',
  // last resort: best single stream up to 1080p
  'b[height<=1080]',
].join('/');

const AUDIO_FORMAT = [
  // AAC audio in an mp4 container (itag 140 etc.) - plays natively on iOS
  'ba[acodec^=mp4a]',
  'ba[ext=m4a]',
  'ba',
].join('/');

/** Temp / partial extensions yt-dlp leaves behind mid-download. */
const TEMP_EXTS = new Set(['.part', '.ytdl', '.temp', '.tmp']);

function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/** A loose match for YouTube's "prove you're not a bot" interstitial. */
export function isBotCheck(text) {
  return /confirm\s+you.?re\s+not\s+a\s+bot|sign in to confirm|not a bot|cookies to a file/i.test(
    text || '',
  );
}

function lastMeaningfulLine(stderr) {
  const lines = (stderr || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^\[/.test(l) || /error/i.test(l));
  return lines[lines.length - 1] || (stderr || '').trim().split('\n').pop() || 'unknown error';
}

function describeFailure(stderr, triedCookies) {
  if (isBotCheck(stderr)) {
    if (triedCookies) {
      return (
        'YouTube asked this machine to confirm it is not a bot, even with browser cookies. ' +
        'Your IP is likely rate-limited. Wait a few minutes and try again, or sign in to ' +
        'YouTube in your browser first. (Advanced: some videos now require a PO token.)'
      );
    }
    return (
      'YouTube asked this machine to confirm it is not a bot. ' +
      'Set USE_BROWSER_COOKIES=true (and COOKIES_BROWSER to the browser you use for YouTube) ' +
      'so the extractor can reuse your logged-in session, then try again.'
    );
  }
  return lastMeaningfulLine(stderr);
}

/** Shared yt-dlp flags. */
function baseArgs() {
  const args = ['--no-playlist', '--no-warnings', '--retries', '3', '--fragment-retries', '3'];
  const ff = getFfmpeg();
  // Only pass --ffmpeg-location for a local (off-PATH) binary.
  if (ff?.location) args.push('--ffmpeg-location', ff.location);
  return args;
}

/**
 * Run a child process. Captures stdout fully (for --print / --dump-json) and
 * captures stderr while also streaming it to our console so the laptop shows
 * live download progress.
 */
function run(cmd, args, { streamStderr = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      if (streamStderr) process.stderr.write(s);
    });
    child.on('error', (err) => {
      resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message });
    });
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/**
 * Run yt-dlp, escalating to browser cookies on a bot check when the user has
 * opted in. `buildArgs(cookieArgs)` returns the full argument list so the same
 * command can be retried with the cookie flags appended.
 */
async function runYtDlp(buildArgs, runOpts) {
  const ydl = getYtDlp();
  if (!ydl) {
    const err = new Error('yt-dlp was not found. Run "npm run setup" in local-server first.');
    err.code = 'NO_YTDLP';
    throw err;
  }

  let res = await run(ydl, buildArgs([]), runOpts);
  if (res.code === 0) return res;

  let triedCookies = false;
  if (isBotCheck(res.stderr) && config.USE_BROWSER_COOKIES) {
    triedCookies = true;
    const cookieArgs = ['--cookies-from-browser', config.COOKIES_BROWSER];
    res = await run(ydl, buildArgs(cookieArgs), runOpts);
    if (res.code === 0) return res;
  }

  const err = new Error(describeFailure(res.stderr, triedCookies));
  err.botCheck = isBotCheck(res.stderr);
  err.stderr = res.stderr;
  throw err;
}

/** Fetch lightweight metadata for a video (no download). */
export async function getVideoInfo(videoId) {
  const res = await runYtDlp((cookieArgs) => [
    ...baseArgs(),
    ...cookieArgs,
    '--dump-single-json',
    '--skip-download',
    watchUrl(videoId),
  ]);
  let json;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    throw new Error('Could not parse video metadata from yt-dlp.');
  }
  return {
    id: json.id || videoId,
    title: json.title || videoId,
    channel: json.uploader || json.channel || json.uploader_id || '',
    durationSeconds: Number.isFinite(json.duration) ? Math.round(json.duration) : 0,
  };
}

function removeExistingFiles(videoId) {
  ensureDownloadsDir();
  let entries;
  try {
    entries = fs.readdirSync(config.DOWNLOADS_DIR);
  } catch {
    return;
  }
  const prefix = `${videoId}.`;
  for (const name of entries) {
    if (name.startsWith(prefix)) {
      try {
        fs.unlinkSync(path.join(config.DOWNLOADS_DIR, name));
      } catch {
        /* ignore */
      }
    }
  }
}

/** Find the finished output file for a video id (ignores temp/partial files). */
function findOutputFile(videoId) {
  let entries;
  try {
    entries = fs.readdirSync(config.DOWNLOADS_DIR);
  } catch {
    return null;
  }
  const prefix = `${videoId}.`;
  const matches = entries
    .filter((name) => name.startsWith(prefix))
    .filter((name) => !TEMP_EXTS.has(path.extname(name).toLowerCase()))
    .filter((name) => path.extname(name).toLowerCase() !== '.json');
  if (matches.length === 0) return null;
  // Prefer mp4 / m4a if several somehow exist.
  matches.sort((a, b) => {
    const rank = (n) => (/\.(mp4|m4a)$/i.test(n) ? 0 : 1);
    return rank(a) - rank(b);
  });
  return path.join(config.DOWNLOADS_DIR, matches[0]);
}

/**
 * Download a single video as the requested format ('video' or 'audio').
 * Returns { absolutePath, file, ext, sizeBytes, format }.
 */
export async function downloadVideo(videoId, format = 'video') {
  ensureDownloadsDir();
  const isAudio = format === 'audio';

  if (!isAudio && !getFfmpeg()) {
    const err = new Error(
      'ffmpeg was not found, which is required to merge video + audio. Run "npm run setup".',
    );
    err.code = 'NO_FFMPEG';
    throw err;
  }

  removeExistingFiles(videoId);

  const outTemplate = path.join(config.DOWNLOADS_DIR, `${videoId}.%(ext)s`);
  const buildArgs = (cookieArgs) => {
    const args = [...baseArgs(), ...cookieArgs, '-o', outTemplate, '--no-mtime'];
    if (isAudio) {
      args.push('-f', AUDIO_FORMAT);
    } else {
      // Move the moov atom to the front so iOS can start playback and seek
      // without the whole file (matters for Range serving before the save).
      args.push(
        '-f',
        VIDEO_FORMAT,
        '--merge-output-format',
        'mp4',
        '--postprocessor-args',
        'Merger:-movflags +faststart',
      );
    }
    args.push(watchUrl(videoId));
    return args;
  };

  await runYtDlp(buildArgs, { streamStderr: true });

  const absolutePath = findOutputFile(videoId);
  if (!absolutePath) {
    throw new Error('Download finished but no output file was found on disk.');
  }
  const stat = fs.statSync(absolutePath);
  return {
    absolutePath,
    file: path.basename(absolutePath),
    ext: path.extname(absolutePath).replace(/^\./, '').toLowerCase(),
    sizeBytes: stat.size,
    format: isAudio ? 'audio' : 'video',
  };
}

export const FORMAT_SELECTORS = { VIDEO_FORMAT, AUDIO_FORMAT };
