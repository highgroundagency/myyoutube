import { describe, it, expect } from 'vitest';
import { parseIsoDuration, formatDuration } from './duration';

describe('parseIsoDuration', () => {
  it('parses the spec required cases', () => {
    expect(parseIsoDuration('PT15S')).toBe(15);
    expect(parseIsoDuration('PT1M')).toBe(60);
    expect(parseIsoDuration('PT12M30S')).toBe(750);
    expect(parseIsoDuration('PT1H')).toBe(3600);
    expect(parseIsoDuration('PT1H2M')).toBe(3720);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    // Multi-day archive: 1 day, 2 hours, 3 minutes, 4 seconds.
    expect(parseIsoDuration('P1DT2H3M4S')).toBe(93784);
  });

  it('treats live or unknown durations as 0', () => {
    expect(parseIsoDuration('P0D')).toBe(0);
    expect(parseIsoDuration('PT0S')).toBe(0);
    expect(parseIsoDuration('')).toBe(0);
    expect(parseIsoDuration(undefined)).toBe(0);
    expect(parseIsoDuration(null)).toBe(0);
  });

  it('returns 0 for malformed input rather than throwing', () => {
    expect(parseIsoDuration('garbage')).toBe(0);
    expect(parseIsoDuration('12:30')).toBe(0);
    expect(parseIsoDuration('PTS')).toBe(0);
  });

  it('handles weeks for completeness', () => {
    expect(parseIsoDuration('P1W')).toBe(604800);
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(65)).toBe('1:05');
  });

  it('formats hours with zero padded minutes', () => {
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(93784)).toBe('26:03:04');
  });

  it('returns empty for unknown or zero', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(-5)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});
