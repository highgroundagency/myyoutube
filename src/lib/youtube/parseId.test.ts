import { describe, it, expect } from 'vitest';
import { extractVideoId, extractVideoIds } from './parseId';

describe('extractVideoId', () => {
  it('reads a bare 11-char id', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('reads the common URL shapes', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=abc')).toBe('dQw4w9WgXcQ');
  });

  it('rejects junk and non-youtube urls', () => {
    expect(extractVideoId('')).toBeNull();
    expect(extractVideoId('hello world')).toBeNull();
    expect(extractVideoId('https://vimeo.com/12345')).toBeNull();
  });
});

describe('extractVideoIds', () => {
  it('splits on newlines/spaces/commas and de-dupes, keeping order', () => {
    const text = `https://youtu.be/aaaaaaaaaaa
      https://www.youtube.com/watch?v=bbbbbbbbbbb, ccccccccccc
      https://youtu.be/aaaaaaaaaaa`;
    expect(extractVideoIds(text)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
  });

  it('returns an empty list when nothing parses', () => {
    expect(extractVideoIds('just some words, not links')).toEqual([]);
  });
});
