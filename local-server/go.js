import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { startServer } from './server.js';
import { ensureDependencies, printVersions } from './setup.js';
import { getCloudflared } from './tools.js';

const TUNNEL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const projectRoot = path.resolve(config.root, '..');

let cloudflaredChild = null;
let httpServer = null;
let shuttingDown = false;
let currentUrl = null;
let tunnelTail = '';

function line() {
  console.log('='.repeat(62));
}

/** Build the PWA into ../dist unless an existing build is reused. */
function ensureBuild() {
  const indexHtml = path.join(config.DIST_DIR, 'index.html');
  if (process.env.SKIP_BUILD === 'true' && fs.existsSync(indexHtml)) {
    console.log('Skipping build (SKIP_BUILD=true); using existing ../dist.');
    return;
  }
  console.log('Building the app (npm run build)...');
  const r = spawnSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    if (fs.existsSync(indexHtml)) {
      console.log('Build failed, but an existing ../dist was found; using it.');
    } else {
      throw new Error('App build failed and no existing build exists. Fix the build, then retry.');
    }
  }
}

function printPublicUrl(url) {
  line();
  console.log('  GabesVideos download mode is LIVE');
  line();
  console.log(`  Public URL:  ${url}`);
  console.log(`  Local URL:   http://localhost:${config.PORT}`);
  console.log('');
  console.log('  Scan this QR code with your iPhone camera:');
  console.log('');
  qrcode.generate(url, { small: true });
  console.log('');
  console.log('  On the phone: open the link, tap "Baixar" on a video, then');
  console.log('  choose "Salvar em Arquivos" (Save to Files).');
  console.log('  Press Ctrl+C here to stop.');
  line();
}

function handleTunnelOutput(buf) {
  tunnelTail = (tunnelTail + buf.toString()).slice(-4096);
  const m = TUNNEL_RE.exec(tunnelTail);
  if (m && m[0] !== currentUrl) {
    currentUrl = m[0];
    printPublicUrl(currentUrl);
  }
}

function startTunnel(cloudflaredCmd) {
  const child = spawn(cloudflaredCmd, ['tunnel', '--url', `http://localhost:${config.PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', handleTunnelOutput);
  child.stderr.on('data', handleTunnelOutput);
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`\ncloudflared exited (code ${code}). Reconnecting in 2s...`);
    currentUrl = null;
    tunnelTail = '';
    setTimeout(() => {
      if (!shuttingDown) cloudflaredChild = startTunnel(cloudflaredCmd);
    }, 2000);
  });
  child.on('error', (err) => {
    console.error(`cloudflared failed to start: ${err?.message || err}`);
  });
  return child;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down...');
  try {
    cloudflaredChild?.kill();
  } catch {
    /* ignore */
  }
  if (process.platform === 'win32' && cloudflaredChild?.pid) {
    try {
      spawnSync('taskkill', ['/pid', String(cloudflaredChild.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  }
  try {
    httpServer?.close();
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(0), 300);
}

async function main() {
  console.log('Starting GabesVideos download mode...\n');

  // 1. Dependencies
  await ensureDependencies();
  const v = printVersions();
  if (!v.ytdlp) {
    throw new Error('yt-dlp is required. Install it (see the hint above), then retry.');
  }
  if (!v.ffmpeg) {
    console.log('\nWARNING: ffmpeg not found. Video merges will fail until it is installed.');
  }
  const cloudflaredCmd = getCloudflared();
  if (!cloudflaredCmd) {
    throw new Error('cloudflared is required for the public tunnel. Install it, then retry.');
  }

  // 2. Build the app
  ensureBuild();

  // 3. Start the local server
  const started = await startServer();
  httpServer = started.server;
  if (!started.hasBuild) {
    console.log('WARNING: app build not found; the page will not load until you build.');
  }
  console.log(`\nExtractor running on http://localhost:${config.PORT}`);

  // 4. Open the public tunnel
  console.log('Opening Cloudflare tunnel (this can take a few seconds)...\n');
  cloudflaredChild = startTunnel(cloudflaredCmd);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('\nError:', err?.message || err);
  shutdown();
});
