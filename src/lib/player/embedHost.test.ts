import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPreferredEmbedHost,
  rememberWorkingEmbedHost,
  alternateEmbedHost,
} from './embedHost';
import { DEFAULT_EMBED_HOST, FALLBACK_EMBED_HOST } from '../../config/constants';

beforeEach(() => localStorage.clear());

describe('embed host failover', () => {
  it('defaults to youtube.com on a fresh device', () => {
    expect(getPreferredEmbedHost()).toBe(DEFAULT_EMBED_HOST);
  });

  it('remembers the host that worked and starts from it next time', () => {
    rememberWorkingEmbedHost(FALLBACK_EMBED_HOST);
    expect(getPreferredEmbedHost()).toBe(FALLBACK_EMBED_HOST);
    rememberWorkingEmbedHost(DEFAULT_EMBED_HOST);
    expect(getPreferredEmbedHost()).toBe(DEFAULT_EMBED_HOST);
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem('gv-embed-host', 'https://evil.example.com');
    expect(getPreferredEmbedHost()).toBe(DEFAULT_EMBED_HOST);
  });

  it('alternates between the two official hosts', () => {
    expect(alternateEmbedHost(DEFAULT_EMBED_HOST)).toBe(FALLBACK_EMBED_HOST);
    expect(alternateEmbedHost(FALLBACK_EMBED_HOST)).toBe(DEFAULT_EMBED_HOST);
  });
});
