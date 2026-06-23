import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';

// A fake IFrame API whose player events and current time we control.
const h = vi.hoisted(() => {
  type Events = {
    onReady?: (e: unknown) => void;
    onStateChange?: (e: { data: number }) => void;
    onError?: (e: { data: number }) => void;
  };
  const captured: { events: Events; time: number; destroyed: boolean } = {
    events: {},
    time: 0,
    destroyed: false,
  };
  class FakePlayer {
    constructor(_el: HTMLElement, opts: { events?: Events }) {
      captured.events = opts.events ?? {};
      captured.destroyed = false;
    }
    getCurrentTime() {
      return captured.time;
    }
    getDuration() {
      return 100;
    }
    getPlayerState() {
      return 1;
    }
    playVideo() {}
    pauseVideo() {}
    mute() {}
    unMute() {}
    destroy() {
      captured.destroyed = true;
    }
  }
  const fakeYT = {
    Player: FakePlayer,
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  };
  return { captured, fakeYT };
});

vi.mock('./iframeLoader', () => ({
  loadYouTubeIframeAPI: () => Promise.resolve(h.fakeYT),
}));

import { useYouTubePlayer } from './useYouTubePlayer';

type Callbacks = {
  onSeen: ReturnType<typeof vi.fn>;
  onWatchTime: ReturnType<typeof vi.fn>;
  onCompleted: ReturnType<typeof vi.fn>;
};

function Harness({ cbs }: { cbs: Callbacks }) {
  const { containerRef } = useYouTubePlayer({
    videoId: 'abc',
    durationSeconds: 100,
    enabled: true,
    onSeen: cbs.onSeen,
    onWatchTime: cbs.onWatchTime,
    onCompleted: cbs.onCompleted,
  });
  // useYouTubePlayer returns a RefObject; attach it to a real node.
  const localRef = useRef<HTMLDivElement>(null);
  return <div ref={containerRef ?? localRef} data-testid="player" />;
}

async function setup() {
  const cbs: Callbacks = { onSeen: vi.fn(), onWatchTime: vi.fn(), onCompleted: vi.fn() };
  render(<Harness cbs={cbs} />);
  // Flush the loadYouTubeIframeAPI microtask so the player is created.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  act(() => h.captured.events.onReady?.({}));
  return cbs;
}

describe('useYouTubePlayer watch tracking', () => {
  beforeEach(() => {
    h.captured.time = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('marks seen after the threshold of real playing time', async () => {
    const cbs = await setup();
    act(() => h.captured.events.onStateChange?.({ data: 1 })); // playing
    act(() => {
      vi.advanceTimersByTime(5000); // heartbeat fires, ~5s watched
    });
    expect(cbs.onSeen).toHaveBeenCalledTimes(1);
  });

  it('accrues watch time by wall clock, immune to scrubbing the position', async () => {
    const cbs = await setup();
    act(() => h.captured.events.onStateChange?.({ data: 1 }));
    // Scrub the position around; watch time should track wall clock, not position.
    act(() => {
      h.captured.time = 80;
      vi.advanceTimersByTime(20000); // flush fires at 20s
    });
    expect(cbs.onWatchTime).toHaveBeenCalled();
    const delta = cbs.onWatchTime.mock.calls[0][0] as number;
    expect(delta).toBeGreaterThan(15);
    expect(delta).toBeLessThan(25);
  });

  it('completes when the furthest position passes 90 percent', async () => {
    const cbs = await setup();
    act(() => h.captured.events.onStateChange?.({ data: 1 }));
    act(() => {
      h.captured.time = 95; // past 90 percent of the 100s duration
      vi.advanceTimersByTime(5000);
    });
    expect(cbs.onCompleted).toHaveBeenCalledTimes(1);
  });

  it('stops accruing watch time while paused', async () => {
    const cbs = await setup();
    act(() => h.captured.events.onStateChange?.({ data: 1 }));
    act(() => vi.advanceTimersByTime(20000));
    act(() => h.captured.events.onStateChange?.({ data: 2 })); // paused
    const callsAfterPause = cbs.onWatchTime.mock.calls.length;
    act(() => vi.advanceTimersByTime(60000)); // long pause
    expect(cbs.onWatchTime.mock.calls.length).toBe(callsAfterPause);
  });
});
