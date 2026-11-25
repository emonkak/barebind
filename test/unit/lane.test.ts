import { describe, expect, it } from 'vitest';
import {
  getHighestPriorityLane,
  getLaneFromPriority,
  getPriorityFromLanes,
  getRenderLanes,
  getTransitionIndex,
  inspectLanes,
  Lane,
  TransitionLaneLength,
} from '@/lane.js';

describe('getHighestPriorityLane()', () => {
  it('returns NoLanes when given NoLanes', () => {
    expect(getHighestPriorityLane(Lane.NoLanes)).toBe(Lane.NoLanes);
  });

  it('returns the highest priority lane when given AllLanes', () => {
    expect(getHighestPriorityLane(Lane.AllLanes)).toBe(Lane.SyncLane);
  });

  it('isolates the lowest set bit for a single lane', () => {
    expect(getHighestPriorityLane(Lane.SyncLane)).toBe(Lane.SyncLane);
    expect(getHighestPriorityLane(Lane.UserBlockingLane)).toBe(
      Lane.UserBlockingLane,
    );
    expect(getHighestPriorityLane(Lane.BackgroundLane)).toBe(
      Lane.BackgroundLane,
    );
  });

  it('isolates the lowest set bit when multiple lanes are set', () => {
    expect(
      getHighestPriorityLane(Lane.UserBlockingLane | Lane.BackgroundLane),
    ).toBe(Lane.UserBlockingLane);
    expect(getHighestPriorityLane(Lane.SyncLane | Lane.UserBlockingLane)).toBe(
      Lane.SyncLane,
    );
    expect(
      getHighestPriorityLane(
        Lane.TransitionLane1 | Lane.UserBlockingLane | Lane.BackgroundLane,
      ),
    ).toBe(Lane.UserBlockingLane);
  });
});

describe('getLaneFromPriority()', () => {
  it('maps user-blocking to UserBlockingLane', () => {
    expect(getLaneFromPriority('user-blocking')).toBe(Lane.UserBlockingLane);
  });

  it('maps user-visible to UserVisibleLane', () => {
    expect(getLaneFromPriority('user-visible')).toBe(Lane.UserVisibleLane);
  });

  it('maps background to BackgroundLane', () => {
    expect(getLaneFromPriority('background')).toBe(Lane.BackgroundLane);
  });
});

describe('getPriorityFromLanes()', () => {
  it('returns user-blocking for SyncLane', () => {
    expect(getPriorityFromLanes(Lane.SyncLane)).toBe('user-blocking');
  });

  it('returns user-blocking for UserHandlerLane', () => {
    expect(getPriorityFromLanes(Lane.UserHandlerLane)).toBe('user-blocking');
  });

  it('returns user-blocking for UserBlockingLane', () => {
    expect(getPriorityFromLanes(Lane.UserBlockingLane)).toBe('user-blocking');
  });

  it('returns user-visible for UserVisibleLane', () => {
    expect(getPriorityFromLanes(Lane.UserVisibleLane)).toBe('user-visible');
  });

  it('returns background for BackgroundLane', () => {
    expect(getPriorityFromLanes(Lane.BackgroundLane)).toBe('background');
  });

  it('returns background for a transition lane', () => {
    expect(getPriorityFromLanes(Lane.TransitionLane1)).toBe('background');
  });

  it('returns background for ShortDelayLane', () => {
    expect(getPriorityFromLanes(Lane.ShortDelayLane)).toBe('background');
  });

  it('returns background for LongDelayLane', () => {
    expect(getPriorityFromLanes(Lane.LongDelayLane)).toBe('background');
  });

  it('returns user-visible for NoLanes (fallback)', () => {
    expect(getPriorityFromLanes(Lane.NoLanes)).toBe('user-visible');
  });

  it('returns user-blocking when multiple lanes include a blocking lane', () => {
    expect(getPriorityFromLanes(Lane.UserVisibleLane | Lane.SyncLane)).toBe(
      'user-blocking',
    );
  });

  it('returns user-visible when UserVisibleLane is combined with a transition lane', () => {
    expect(
      getPriorityFromLanes(Lane.UserVisibleLane | Lane.TransitionLane1),
    ).toBe('user-visible');
  });

  it('prefers user-blocking over background when both categories present', () => {
    expect(getPriorityFromLanes(Lane.SyncLane | Lane.TransitionLane1)).toBe(
      'user-blocking',
    );
  });
});

describe('getRenderLanes()', () => {
  it('returns NoLanes for empty options', () => {
    expect(getRenderLanes({})).toBe(Lane.NoLanes);
  });

  it('includes SyncLane when flushSync is true', () => {
    expect(getRenderLanes({ flushSync: true })).toBe(Lane.SyncLane);
  });

  it('includes UserHandlerLane when handler is function', () => {
    expect(
      getRenderLanes({
        handler(commit) {
          commit();
        },
      }),
    ).toBe(Lane.UserHandlerLane);
  });

  it('maps priority to the corresponding lane', () => {
    expect(getRenderLanes({ priority: 'user-blocking' })).toBe(
      Lane.UserBlockingLane,
    );
    expect(getRenderLanes({ priority: 'user-visible' })).toBe(
      Lane.UserVisibleLane,
    );
    expect(getRenderLanes({ priority: 'background' })).toBe(
      Lane.BackgroundLane,
    );
  });

  it('includes transition lane for transition 0', () => {
    expect(getRenderLanes({ transition: 0 })).toBe(Lane.TransitionLane1);
  });

  it('includes transition lane for a larger transition index', () => {
    const lanes = getRenderLanes({ transition: 5 });
    expect(lanes).toBe(Lane.TransitionLane1 << 5);
  });

  it('wraps transition index within TransitionLaneLength', () => {
    const lanes = getRenderLanes({ transition: TransitionLaneLength });
    expect(lanes).toBe(Lane.TransitionLane1);
  });

  it('includes ShortDelayLane for a short delay', () => {
    expect(getRenderLanes({ delay: 50 })).toBe(Lane.ShortDelayLane);
  });

  it('includes delayed lane for delay exactly 100', () => {
    expect(getRenderLanes({ delay: 100 })).toBe(Lane.ShortDelayLane);
  });

  it('includes LongDelayLane for a long delay', () => {
    expect(getRenderLanes({ delay: 200 })).toBe(Lane.LongDelayLane);
  });

  it('combines all options', () => {
    const lanes = getRenderLanes({
      delay: 200,
      flushSync: true,
      handler: () => {},
      transition: 3,
    });
    expect(lanes & Lane.SyncLane).toBe(Lane.SyncLane);
    expect(lanes & Lane.UserHandlerLane).toBe(Lane.UserHandlerLane);
    expect(lanes & (Lane.TransitionLane1 << 3)).toBe(Lane.TransitionLane1 << 3);
    expect(lanes & Lane.LongDelayLane).toBe(Lane.LongDelayLane);
  });
});

describe('getTransitionIndex()', () => {
  it('returns 0 for TransitionLane1', () => {
    expect(getTransitionIndex(Lane.TransitionLane1)).toBe(0);
  });

  it('returns 1 for the second transition lane', () => {
    expect(getTransitionIndex(Lane.TransitionLane1 << 1)).toBe(1);
  });

  it('returns 23 for the last transition lane', () => {
    expect(getTransitionIndex(Lane.TransitionLane1 << 23)).toBe(23);
  });

  it('returns the highest transition index in a set', () => {
    expect(
      getTransitionIndex(
        Lane.TransitionLane1 |
          (Lane.TransitionLane1 << 3) |
          (Lane.TransitionLane1 << 7),
      ),
    ).toBe(7);
  });
});

describe('inspectLanes()', () => {
  it('returns an empty array for NoLanes', () => {
    expect(inspectLanes(Lane.NoLanes)).toStrictEqual([]);
  });

  it('identifies SyncLane', () => {
    expect(inspectLanes(Lane.SyncLane)).toStrictEqual(['SyncLane']);
  });

  it('identifies UserHandlerLane', () => {
    expect(inspectLanes(Lane.UserHandlerLane)).toStrictEqual([
      'UserHandlerLane',
    ]);
  });

  it('identifies UserBlockingLane', () => {
    expect(inspectLanes(Lane.UserBlockingLane)).toStrictEqual([
      'UserBlockingLane',
    ]);
  });

  it('identifies UserVisibleLane', () => {
    expect(inspectLanes(Lane.UserVisibleLane)).toStrictEqual([
      'UserVisibleLane',
    ]);
  });

  it('identifies BackgroundLane', () => {
    expect(inspectLanes(Lane.BackgroundLane)).toStrictEqual(['BackgroundLane']);
  });

  it('identifies any lane within TransitionLanes', () => {
    for (let i = 0; i < TransitionLaneLength; i++) {
      expect(inspectLanes(Lane.TransitionLane1 << i)).toStrictEqual([
        'TransitionLane',
      ]);
    }
  });

  it('identifies ShortDelayLane', () => {
    expect(inspectLanes(Lane.ShortDelayLane)).toStrictEqual(['ShortDelayLane']);
  });

  it('identifies LongDelayLane', () => {
    expect(inspectLanes(Lane.LongDelayLane)).toStrictEqual(['LongDelayLane']);
  });

  it('returns tags for all lane groups in AllLanes', () => {
    expect(inspectLanes(Lane.AllLanes)).toStrictEqual([
      'SyncLane',
      'UserHandlerLane',
      'UserBlockingLane',
      'UserVisibleLane',
      'BackgroundLane',
      'TransitionLane',
      'ShortDelayLane',
      'LongDelayLane',
    ]);
  });
});
