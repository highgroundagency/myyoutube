import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const MANIFEST_PATH = path.join(config.DOWNLOADS_DIR, 'manifest.json');

export function ensureDownloadsDir() {
  fs.mkdirSync(config.DOWNLOADS_DIR, { recursive: true });
}

export function loadManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveManifest(manifest) {
  ensureDownloadsDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function fileFor(entry) {
  return path.isAbsolute(entry.file) ? entry.file : path.join(config.DOWNLOADS_DIR, entry.file);
}

/** Drop manifest entries whose file is gone. The disk is the source of truth. */
export function reconcile() {
  ensureDownloadsDir();
  const manifest = loadManifest();
  let changed = false;
  for (const [id, entry] of Object.entries(manifest)) {
    if (!entry?.file || !fs.existsSync(fileFor(entry))) {
      delete manifest[id];
      changed = true;
    }
  }
  if (changed) saveManifest(manifest);
  return manifest;
}

export function addEntry(entry) {
  const manifest = loadManifest();
  manifest[entry.id] = entry;
  saveManifest(manifest);
  return entry;
}

export function getEntry(id) {
  const entry = loadManifest()[id];
  if (!entry) return null;
  if (!fs.existsSync(fileFor(entry))) return null;
  return { ...entry, absolutePath: fileFor(entry) };
}

export function listEntries() {
  return Object.values(loadManifest())
    .map((e) => ({
      id: e.id,
      title: e.title,
      channel: e.channel,
      format: e.format,
      durationSeconds: e.durationSeconds ?? 0,
      sizeBytes: e.sizeBytes ?? 0,
      downloadedAt: e.downloadedAt ?? null,
    }))
    .sort((a, b) => String(b.downloadedAt).localeCompare(String(a.downloadedAt)));
}
