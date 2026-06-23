import { describe, it, expect, beforeEach } from 'vitest';
import { watchStore } from './watchStore';

describe('watchStore', () => {
  beforeEach(() => {
    watchStore.clearAll();
  });

  it('takes the max watched position', () => {
    watchStore.upsert({ videoId: 'v1', status: 'seen', watchedSeconds: 30 });
    watchStore.upsert({ videoId: 'v1', status: 'seen', watchedSeconds: 10 });
    expect(watchStore.getSnapshot().v1.watchedSeconds).toBe(30);
  });

  it('never downgrades completed to seen', () => {
    watchStore.upsert({ videoId: 'v1', status: 'completed', watchedSeconds: 90 });
    watchStore.upsert({ videoId: 'v1', status: 'seen', watchedSeconds: 95 });
    const rec = watchStore.getSnapshot().v1;
    expect(rec.status).toBe('completed');
    expect(rec.watchedSeconds).toBe(95);
  });

  it('upgrades seen to completed', () => {
    watchStore.upsert({ videoId: 'v1', status: 'seen', watchedSeconds: 10 });
    watchStore.upsert({ videoId: 'v1', status: 'completed', watchedSeconds: 100 });
    expect(watchStore.getSnapshot().v1.status).toBe('completed');
  });

  it('preserves first_watched_at and removes records', () => {
    watchStore.upsert({ videoId: 'v1', status: 'seen' });
    const first = watchStore.getSnapshot().v1.firstWatchedAt;
    watchStore.upsert({ videoId: 'v1', status: 'completed' });
    expect(watchStore.getSnapshot().v1.firstWatchedAt).toBe(first);
    watchStore.remove('v1');
    expect(watchStore.getSnapshot().v1).toBeUndefined();
  });
});
