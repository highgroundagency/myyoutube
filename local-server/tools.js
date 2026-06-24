import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const isWin = process.platform === 'win32';

function firstLine(s) {
  return (s || '').toString().trim().split('\n')[0].trim();
}

/** Run a command and return its first line of output, or null on failure. */
export function tryVersion(cmd, args = ['--version']) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return firstLine(out) || 'ok';
  } catch {
    return null;
  }
}

/** yt-dlp: prefer the auto-installed local binary, then PATH. */
export function getYtDlp() {
  const local = path.join(config.BIN_DIR, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(local)) return local;
  if (tryVersion('yt-dlp')) return 'yt-dlp';
  return null;
}

/**
 * ffmpeg: returns { cmd, location }. `location` is the path to pass to yt-dlp
 * via --ffmpeg-location when ffmpeg is NOT on PATH (a local binary). When ffmpeg
 * is on PATH, location is null (yt-dlp finds it automatically).
 */
export function getFfmpeg() {
  if (tryVersion('ffmpeg', ['-version'])) return { cmd: 'ffmpeg', location: null };
  const localDir = config.BIN_DIR;
  const local = path.join(localDir, isWin ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(local)) return { cmd: local, location: localDir };
  return null;
}

/** cloudflared: PATH first (brew/winget), then a local binary. */
export function getCloudflared() {
  if (tryVersion('cloudflared')) return 'cloudflared';
  const local = path.join(config.BIN_DIR, isWin ? 'cloudflared.exe' : 'cloudflared');
  if (fs.existsSync(local)) return local;
  return null;
}

export function versions() {
  const ydl = getYtDlp();
  const ff = getFfmpeg();
  const cf = getCloudflared();
  return {
    ytdlp: ydl ? tryVersion(ydl) : null,
    ffmpeg: ff ? firstLine(tryVersion(ff.cmd, ['-version'])) : null,
    cloudflared: cf ? tryVersion(cf) : null,
  };
}
