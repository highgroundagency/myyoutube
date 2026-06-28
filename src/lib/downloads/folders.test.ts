import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadFolders,
  rememberFolder,
  removeFolder,
  sanitizeFolderName,
  joinPath,
  loadBase,
  saveBase,
  DEFAULT_BASE,
} from './folders';

beforeEach(() => localStorage.clear());

describe('sanitizeFolderName', () => {
  it('drops invalid path and quoting characters', () => {
    expect(sanitizeFolderName('Curso: Mandarim/2024 *?')).toBe('Curso Mandarim2024');
    expect(sanitizeFolderName('  $pasta`  ')).toBe('pasta');
  });
});

describe('joinPath', () => {
  it('joins base and name with a single backslash', () => {
    expect(joinPath('$HOME\\Videos\\GV', 'Curso')).toBe('$HOME\\Videos\\GV\\Curso');
    expect(joinPath('$HOME\\Videos\\GV\\', 'Curso')).toBe('$HOME\\Videos\\GV\\Curso');
  });
});

describe('remembered folders', () => {
  it('adds a folder and bumps lastUsedAt instead of duplicating', () => {
    rememberFolder('Curso', '$HOME\\GV\\Curso', '2026-06-01T00:00:00.000Z');
    rememberFolder('Curso', '$HOME\\GV\\Curso', '2026-06-02T00:00:00.000Z');
    const list = loadFolders();
    expect(list).toHaveLength(1);
    expect(list[0].lastUsedAt).toBe('2026-06-02T00:00:00.000Z');
    expect(list[0].createdAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('orders by most recently used and removes by path', () => {
    rememberFolder('A', '$HOME\\GV\\A', '2026-06-01T00:00:00.000Z');
    rememberFolder('B', '$HOME\\GV\\B', '2026-06-03T00:00:00.000Z');
    expect(loadFolders().map((f) => f.name)).toEqual(['B', 'A']);
    const after = removeFolder('$HOME\\GV\\B');
    expect(after.map((f) => f.name)).toEqual(['A']);
  });
});

describe('base path', () => {
  it('defaults, persists, and falls back on blank', () => {
    expect(loadBase()).toBe(DEFAULT_BASE);
    saveBase('D:\\Media\\GV');
    expect(loadBase()).toBe('D:\\Media\\GV');
    saveBase('   ');
    expect(loadBase()).toBe(DEFAULT_BASE);
  });
});
