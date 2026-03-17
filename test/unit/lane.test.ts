import { describe, expect, it } from 'vitest';

import type { Lanes, UpdateOptions } from '@/core.js';
import {
  BackgroundLane,
  getPriorityFromLanes,
  getSchedulingLanes,
  NoLanes,
  SyncLane,
  TransitionLane,
  UserBlockingLane,
  UserVisibleLane,
  ViewTransitionLane,
} from '@/lane.js';

describe('getSchedulingLanes()', () => {
  it.each<[UpdateOptions, Lanes]>([
    [{}, NoLanes],
    [{ flushSync: true }, SyncLane],
    [{ priority: 'user-blocking' }, UserBlockingLane],
    [{ priority: 'user-visible' }, UserVisibleLane],
    [{ priority: 'background' }, BackgroundLane],
    [
      {
        transition: {
          resumes: [],
          suspends: [],
          signal: new AbortController().signal,
        },
      },
      TransitionLane,
    ],
    [{ viewTransition: true }, ViewTransitionLane],
  ])('returns lanes for options', (options, lanes) => {
    expect(getSchedulingLanes(options)).toBe(lanes);
    expect(getPriorityFromLanes(lanes)).toBe(options.priority ?? null);
  });
});
