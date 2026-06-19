import { describe, expect, it } from 'vitest';
import {
  AllLanes,
  BackgroundLane,
  DelayedLane1,
  DelayedLane2,
  getHighestPriorityLane,
  getLaneFromPriority,
  getPriorityFromLanes,
  getRenderLanes,
  getTransitionIndex,
  NoLanes,
  SyncLane,
  TransitionLane1,
  TransitionLaneLength,
  UserBlockingLane,
  UserVisibleLane,
  ViewTransitionLane,
} from '@/lane.js';

describe('getHighestPriorityLane()', () => {
  it('returns NoLanes when given NoLanes', () => {
    expect(getHighestPriorityLane(NoLanes)).toBe(NoLanes);
  });

  it('returns the highest priority lane when given AllLanes', () => {
    expect(getHighestPriorityLane(AllLanes)).toBe(SyncLane);
  });

  it('isolates the lowest set bit for a single lane', () => {
    expect(getHighestPriorityLane(SyncLane)).toBe(SyncLane);
    expect(getHighestPriorityLane(UserBlockingLane)).toBe(UserBlockingLane);
    expect(getHighestPriorityLane(BackgroundLane)).toBe(BackgroundLane);
  });

  it('isolates the lowest set bit when multiple lanes are set', () => {
    expect(getHighestPriorityLane(UserBlockingLane | BackgroundLane)).toBe(
      UserBlockingLane,
    );
    expect(getHighestPriorityLane(SyncLane | UserBlockingLane)).toBe(SyncLane);
    expect(
      getHighestPriorityLane(
        TransitionLane1 | UserBlockingLane | BackgroundLane,
      ),
    ).toBe(UserBlockingLane);
  });
});

describe('getLaneFromPriority()', () => {
  it('maps user-blocking to UserBlockingLane', () => {
    expect(getLaneFromPriority('user-blocking')).toBe(UserBlockingLane);
  });

  it('maps user-visible to UserVisibleLane', () => {
    expect(getLaneFromPriority('user-visible')).toBe(UserVisibleLane);
  });

  it('maps background to BackgroundLane', () => {
    expect(getLaneFromPriority('background')).toBe(BackgroundLane);
  });
});

describe('getPriorityFromLanes()', () => {
  it('returns user-blocking for SyncLane', () => {
    expect(getPriorityFromLanes(SyncLane)).toBe('user-blocking');
  });

  it('returns user-blocking for ViewTransitionLane', () => {
    expect(getPriorityFromLanes(ViewTransitionLane)).toBe('user-blocking');
  });

  it('returns user-blocking for UserBlockingLane', () => {
    expect(getPriorityFromLanes(UserBlockingLane)).toBe('user-blocking');
  });

  it('returns user-visible for UserVisibleLane', () => {
    expect(getPriorityFromLanes(UserVisibleLane)).toBe('user-visible');
  });

  it('returns background for BackgroundLane', () => {
    expect(getPriorityFromLanes(BackgroundLane)).toBe('background');
  });

  it('returns background for a transition lane', () => {
    expect(getPriorityFromLanes(TransitionLane1)).toBe('background');
  });

  it('returns background for DelayedLane1', () => {
    expect(getPriorityFromLanes(DelayedLane1)).toBe('background');
  });

  it('returns background for DelayedLane2', () => {
    expect(getPriorityFromLanes(DelayedLane2)).toBe('background');
  });

  it('returns user-visible for NoLanes (fallback)', () => {
    expect(getPriorityFromLanes(NoLanes)).toBe('user-visible');
  });

  it('returns user-blocking when multiple lanes include a blocking lane', () => {
    expect(getPriorityFromLanes(UserVisibleLane | SyncLane)).toBe(
      'user-blocking',
    );
  });

  it('returns user-visible when UserVisibleLane is combined with a transition lane', () => {
    expect(getPriorityFromLanes(UserVisibleLane | TransitionLane1)).toBe(
      'user-visible',
    );
  });

  it('prefers user-blocking over background when both categories present', () => {
    expect(getPriorityFromLanes(SyncLane | TransitionLane1)).toBe(
      'user-blocking',
    );
  });
});

describe('getRenderLanes()', () => {
  it('returns NoLanes for empty options', () => {
    expect(getRenderLanes({})).toBe(NoLanes);
  });

  it('includes SyncLane when flushSync is true', () => {
    expect(getRenderLanes({ flushSync: true })).toBe(SyncLane);
  });

  it('includes ViewTransitionLane when viewTransition is true', () => {
    expect(getRenderLanes({ viewTransition: true })).toBe(ViewTransitionLane);
  });

  it('combines SyncLane and ViewTransitionLane', () => {
    expect(getRenderLanes({ flushSync: true, viewTransition: true })).toBe(
      SyncLane | ViewTransitionLane,
    );
  });

  it('maps priority to the corresponding lane', () => {
    expect(getRenderLanes({ priority: 'user-blocking' })).toBe(
      UserBlockingLane,
    );
    expect(getRenderLanes({ priority: 'user-visible' })).toBe(UserVisibleLane);
    expect(getRenderLanes({ priority: 'background' })).toBe(BackgroundLane);
  });

  it('priority combines with flushSync', () => {
    const lanes = getRenderLanes({
      flushSync: true,
      priority: 'background',
    });
    expect(lanes & SyncLane).toBe(SyncLane);
    expect(lanes & BackgroundLane).toBe(BackgroundLane);
  });

  it('includes transition lane for transition 0', () => {
    expect(getRenderLanes({ transition: 0 })).toBe(TransitionLane1);
  });

  it('includes transition lane for a larger transition index', () => {
    const lanes = getRenderLanes({ transition: 5 });
    expect(lanes).toBe(TransitionLane1 << 5);
  });

  it('wraps transition index within TransitionLaneLength', () => {
    const lanes = getRenderLanes({ transition: TransitionLaneLength });
    expect(lanes).toBe(TransitionLane1);
  });

  it('includes DelayedLane1 for a short delay', () => {
    expect(getRenderLanes({ delay: 50 })).toBe(DelayedLane1);
  });

  it('includes DelayedLane2 for a long delay', () => {
    expect(getRenderLanes({ delay: 200 })).toBe(DelayedLane2);
  });

  it('includes delayed lane for delay exactly 100', () => {
    expect(getRenderLanes({ delay: 100 })).toBe(DelayedLane1);
  });

  it('combines all option categories', () => {
    const lanes = getRenderLanes({
      flushSync: true,
      viewTransition: true,
      transition: 3,
      delay: 200,
    });
    expect(lanes & SyncLane).toBe(SyncLane);
    expect(lanes & ViewTransitionLane).toBe(ViewTransitionLane);
    expect(lanes & (TransitionLane1 << 3)).toBe(TransitionLane1 << 3);
    expect(lanes & DelayedLane2).toBe(DelayedLane2);
  });
});

describe('getTransitionIndex()', () => {
  it('returns 0 for TransitionLane1', () => {
    expect(getTransitionIndex(TransitionLane1)).toBe(0);
  });

  it('returns 1 for the second transition lane', () => {
    expect(getTransitionIndex(TransitionLane1 << 1)).toBe(1);
  });

  it('returns 23 for the last transition lane', () => {
    expect(getTransitionIndex(TransitionLane1 << 23)).toBe(23);
  });

  it('returns the highest transition index in a set', () => {
    expect(
      getTransitionIndex(
        TransitionLane1 | (TransitionLane1 << 3) | (TransitionLane1 << 7),
      ),
    ).toBe(7);
  });
});
