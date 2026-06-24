import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from './config.js';
import { versions, getYtDlp, getFfmpeg, getCloudflared } from './tools.js';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';

function log(msg) {
  console.log(msg);
}

function ensureBinDir() {
  fs.mkdirSync(config.BIN_DIR, { recursive: true });
}

/** Stream a URL to a file, following redirects (GitHub release assets do this). */
async function downloadFile(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
  if (!isWin) {
    try {
      fs.chmodSync(dest, 0o755);
    } catch {
      /* ignore */
    }
  }
}

/** Extract an archive using the system `tar` (bsdtar handles zip on Windows). */
function extractArchive(archivePath, intoDir) {
  fs.mkdirSync(intoDir, { recursive: true });
  const r = spawnSync('tar', ['-xf', archivePath, '-C', intoDir], { stdio: 'ignore' });
  return r.status === 0;
}

/** Find a file by exact name anywhere under a directory tree. */
function findFile(rootDir, fileName) {
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === fileName) return full;
    }
  }
  return null;
}

async function installYtDlp() {
  if (getYtDlp()) return true;
  ensureBinDir();
  const asset = isWin
    ? 'yt-dlp.exe'
    : isMac
      ? 'yt-dlp_macos'
      : arch === 'arm64'
        ? 'yt-dlp_linux_aarch64'
        : 'yt-dlp_linux';
  const dest = path.join(config.BIN_DIR, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  log(`Installing yt-dlp (${asset})...`);
  await downloadFile(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`, dest);
  return !!getYtDlp();
}

async function installCloudflared() {
  if (getCloudflared()) return true;
  ensureBinDir();
  log('Installing cloudflared...');
  if (isMac) {
    const tgz = path.join(config.BIN_DIR, 'cloudflared.tgz');
    await downloadFile(
      `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${arch}.tgz`,
      tgz,
    );
    const tmpDir = path.join(config.BIN_DIR, 'cf-tmp');
    extractArchive(tgz, tmpDir);
    const found = findFile(tmpDir, 'cloudflared');
    if (found) {
      fs.copyFileSync(found, path.join(config.BIN_DIR, 'cloudflared'));
      fs.chmodSync(path.join(config.BIN_DIR, 'cloudflared'), 0o755);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tgz, { force: true });
  } else {
    const asset = isWin ? 'cloudflared-windows-amd64.exe' : `cloudflared-linux-${arch}`;
    const dest = path.join(config.BIN_DIR, isWin ? 'cloudflared.exe' : 'cloudflared');
    await downloadFile(
      `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`,
      dest,
    );
  }
  return !!getCloudflared();
}

async function installFfmpeg() {
  if (getFfmpeg()) return true;
  ensureBinDir();
  log('Installing ffmpeg (static build)...');
  try {
    if (isMac) {
      // BtbN has no macOS build; evermeet ships a static ffmpeg (Intel, runs
      // under Rosetta on Apple Silicon).
      const zip = path.join(config.BIN_DIR, 'ffmpeg.zip');
      await downloadFile('https://evermeet.cx/ffmpeg/getrelease/zip', zip);
      const tmpDir = path.join(config.BIN_DIR, 'ff-tmp');
      extractArchive(zip, tmpDir);
      const found = findFile(tmpDir, 'ffmpeg');
      if (found) {
        fs.copyFileSync(found, path.join(config.BIN_DIR, 'ffmpeg'));
        fs.chmodSync(path.join(config.BIN_DIR, 'ffmpeg'), 0o755);
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(zip, { force: true });
    } else {
      const file = isWin
        ? 'ffmpeg-master-latest-win64-gpl.zip'
        : arch === 'arm64'
          ? 'ffmpeg-master-latest-linuxarm64-gpl.tar.xz'
          : 'ffmpeg-master-latest-linux64-gpl.tar.xz';
      const archivePath = path.join(config.BIN_DIR, file);
      await downloadFile(
        `https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/${file}`,
        archivePath,
      );
      const tmpDir = path.join(config.BIN_DIR, 'ff-tmp');
      extractArchive(archivePath, tmpDir);
      const exe = isWin ? 'ffmpeg.exe' : 'ffmpeg';
      const found = findFile(tmpDir, exe);
      if (found) {
        const dest = path.join(config.BIN_DIR, exe);
        fs.copyFileSync(found, dest);
        if (!isWin) fs.chmodSync(dest, 0o755);
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(archivePath, { force: true });
    }
  } catch (err) {
    log(`  Could not auto-install ffmpeg: ${err?.message || err}`);
  }
  return !!getFfmpeg();
}

function manualHint(tool) {
  const hints = {
    'yt-dlp': isMac
      ? 'brew install yt-dlp'
      : isWin
        ? 'winget install yt-dlp.yt-dlp'
        : 'sudo apt install yt-dlp  (or: pipx install yt-dlp)',
    ffmpeg: isMac
      ? 'brew install ffmpeg'
      : isWin
        ? 'winget install Gyan.FFmpeg'
        : 'sudo apt install ffmpeg',
    cloudflared: isMac
      ? 'brew install cloudflared'
      : isWin
        ? 'winget install Cloudflare.cloudflared'
        : 'see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
  };
  return hints[tool];
}

/** Best-effort install of anything missing. Never throws. */
export async function ensureDependencies() {
  const results = {};
  for (const [name, fn] of [
    ['yt-dlp', installYtDlp],
    ['ffmpeg', installFfmpeg],
    ['cloudflared', installCloudflared],
  ]) {
    try {
      results[name] = await fn();
    } catch (err) {
      log(`  ${name}: ${err?.message || err}`);
      results[name] = false;
    }
  }
  return results;
}

export function printVersions() {
  const v = versions();
  log('');
  log('Tool versions:');
  log(`  yt-dlp:      ${v.ytdlp || 'NOT FOUND'}`);
  log(`  ffmpeg:      ${v.ffmpeg || 'NOT FOUND'}`);
  log(`  cloudflared: ${v.cloudflared || 'NOT FOUND'}`);
  const missing = Object.entries(v).filter(([, val]) => !val);
  if (missing.length) {
    log('');
    log('Some tools are missing. Install them manually, then re-run:');
    for (const [k] of missing) {
      const tool = k === 'ytdlp' ? 'yt-dlp' : k;
      log(`  ${tool}:  ${manualHint(tool)}`);
    }
  }
  return v;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMainModule) {
  log('Setting up the GabesVideos extractor...');
  await ensureDependencies();
  printVersions();
}
