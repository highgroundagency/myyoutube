import { vi } from 'vitest';

/**
 * Messages we deliberately ignore: external resource failures (thumbnails are
 * not available in the test/offline environment) and dev tooling notices.
 * App level React warnings are NOT in this list, so they will fail the guard.
 */
const IGNORE = [
  'Failed to load resource',
  'i.ytimg.com',
  'ytimg',
  'favicon',
  'Download the React DevTools',
];

export function shouldIgnore(text: string): boolean {
  return IGNORE.some((needle) => text.includes(needle));
}

/**
 * Captures console.error and console.warn during a test. Use to assert that
 * rendering a component or route produces a clean console (section 0, gate 2).
 */
export function installConsoleGuard() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(' ');
    if (!shouldIgnore(text)) errors.push(text);
  });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(' ');
    if (!shouldIgnore(text)) warnings.push(text);
  });

  return {
    errors,
    warnings,
    restore() {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    },
  };
}
