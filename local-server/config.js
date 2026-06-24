import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Configuration for the local extractor. Override any value with an environment
 * variable, or edit the defaults here.
 */
export const config = {
  /**
   * Your deployed app URL. The local server proxies /api/* here so the feed
   * still loads while you download. Defaults to the known deployment; override
   * with VERCEL_BASE_URL if it changes.
   */
  VERCEL_BASE_URL: (process.env.VERCEL_BASE_URL || 'https://myyoutube-mu.vercel.app').replace(/\/+$/, ''),

  /** Local port for the extractor + app. The Cloudflare tunnel points here. */
  PORT: Number(process.env.PORT) || 8787,

  /** Where downloaded files and the manifest live. */
  DOWNLOADS_DIR: path.resolve(here, 'downloads'),

  /** Folder where auto-installed binaries (yt-dlp) are placed. */
  BIN_DIR: path.resolve(here, 'bin'),

  /** The built PWA to serve locally (the main app's vite build output). */
  DIST_DIR: path.resolve(here, '..', 'dist'),

  /**
   * When true, retry with browser cookies if YouTube shows the bot check.
   * You are logged into YouTube (Premium), so your cookies usually pass it and
   * unlock better formats. See the README for OS quirks.
   */
  USE_BROWSER_COOKIES: process.env.USE_BROWSER_COOKIES === 'true',

  /** Which browser to read cookies from (chrome, brave, edge, firefox, safari). */
  COOKIES_BROWSER: process.env.COOKIES_BROWSER || 'chrome',

  root: here,
};
