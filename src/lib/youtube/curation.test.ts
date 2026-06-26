import { describe, it, expect } from 'vitest';
import { passesCuration, uploadFetchLimit, FETCH_ALL_CAP } from './curation';
import type { Video } from './types';

function v(partial: Partial<Video>): Video {
  return {
    id: 'x',
    channelKey: 'c',
    channelLabel: 'C',
    title: 'a title',
    thumbnailUrl: 'u',
    publishedAt: '2026-01-01T00:00:00.000Z',
    durationSeconds: 600,
    liveState: 'none',
    isEmbeddable: true,
    isPublic: true,
    ...partial,
  };
}

describe('passesCuration', () => {
  it('keeps everything when there is no curation', () => {
    expect(passesCuration(v({}), undefined)).toBe(true);
  });

  it('publishedAfter drops older videos and keeps newer ones', () => {
    const c = { publishedAfter: '2026-06-26T00:00:00.000Z' };
    expect(passesCuration(v({ publishedAt: '2026-06-20T00:00:00Z' }), c)).toBe(false);
    expect(passesCuration(v({ publishedAt: '2026-06-27T00:00:00Z' }), c)).toBe(true);
  });

  it('titleIncludesAny keeps only matching titles, accent and case insensitive', () => {
    const c = { titleIncludesAny: ['melhores momentos'] };
    expect(passesCuration(v({ title: 'MELHORES MOMENTOS | Flamengo x Vasco' }), c)).toBe(true);
    expect(passesCuration(v({ title: 'Os melhóres moméntos do jogo' }), c)).toBe(true);
    expect(passesCuration(v({ title: 'Entrevista pos jogo' }), c)).toBe(false);
  });

  it('always keeps live and upcoming, regardless of the rules', () => {
    const c = { titleIncludesAny: ['melhores momentos'], publishedAfter: '2030-01-01T00:00:00Z' };
    expect(passesCuration(v({ liveState: 'live', title: 'Ao vivo agora' }), c)).toBe(true);
    expect(passesCuration(v({ liveState: 'upcoming', title: 'Em breve' }), c)).toBe(true);
  });
});

describe('uploadFetchLimit', () => {
  it('uses the default when there is no curation', () => {
    expect(uploadFetchLimit(undefined, 50)).toBe(50);
  });

  it('honors maxVideos and fetchAll', () => {
    expect(uploadFetchLimit({ maxVideos: 12 }, 50)).toBe(12);
    expect(uploadFetchLimit({ fetchAll: true }, 50)).toBe(FETCH_ALL_CAP);
  });
});
