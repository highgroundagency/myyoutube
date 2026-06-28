/**
 * Remembered download folders, kept in localStorage on this device. The script
 * generator saves every folder it creates so the viewer can later add videos to
 * an existing one. Device-local on purpose: these are Windows paths, useless on
 * the phone, so they are NOT part of the cross-device sync.
 */

export type DownloadFolder = {
  name: string;
  path: string;
  createdAt: string;
  lastUsedAt: string;
};

const FOLDERS_KEY = 'gv-download-folders';
const BASE_KEY = 'gv-download-base';

export const DEFAULT_BASE = '$HOME\\Videos\\GabesVideos';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode / quota: stay in-memory for this session
  }
}

/** Strip characters that are invalid in a Windows folder name (and quoting). */
export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[$`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Join a base path and a folder name into a single Windows path. */
export function joinPath(base: string, name: string): string {
  return `${base.replace(/\\+$/, '')}\\${name}`;
}

export function loadFolders(): DownloadFolder[] {
  const list = read<DownloadFolder[]>(FOLDERS_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((f) => f && typeof f.path === 'string' && typeof f.name === 'string')
    .sort((a, b) => String(b.lastUsedAt).localeCompare(String(a.lastUsedAt)));
}

/** Add a folder, or bump its lastUsedAt if the path already exists. */
export function rememberFolder(name: string, path: string, now: string): DownloadFolder[] {
  const list = loadFolders();
  const existing = list.find((f) => f.path === path);
  if (existing) {
    existing.lastUsedAt = now;
    existing.name = name || existing.name;
  } else {
    list.push({ name, path, createdAt: now, lastUsedAt: now });
  }
  write(FOLDERS_KEY, list);
  return loadFolders();
}

export function removeFolder(path: string): DownloadFolder[] {
  const list = loadFolders().filter((f) => f.path !== path);
  write(FOLDERS_KEY, list);
  return list;
}

export function loadBase(): string {
  const base = read<string>(BASE_KEY, DEFAULT_BASE);
  return typeof base === 'string' && base.trim() ? base : DEFAULT_BASE;
}

export function saveBase(base: string): void {
  write(BASE_KEY, base.trim() || DEFAULT_BASE);
}
