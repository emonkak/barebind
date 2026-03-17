import { describe, expect, it } from 'vitest';
import {
  BackgroundLane,
  getPriorityFromLanes,
  getSchedulingLanes,
  getTranstionIndex,
  NoLanes,
  SyncLane,
  TransitionLane1,
  TransitionLength,
  UserBlockingLane,
  UserVisibleLane,
  ViewTransitionLane,
} from '@/lane.js';

describe('getPriorityFromLanes()', () => {
  it('returns null for NoLanes', () => {
    expect(getPriorityFromLanes(NoLanes)).toBe(null);
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
});

describe('getSchedulingLanes()', () => {
  it('returns NoLanes for empty options', () => {
    expect(getSchedulingLanes({})).toBe(NoLanes);
  });

  it('includes SyncLane when flushSync is true', () => {
    expect(getSchedulingLanes({ flushSync: true }) & SyncLane).toBeTruthy();
  });

  it('does not include SyncLane when flushSync is false', () => {
    expect(getSchedulingLanes({ flushSync: false }) & SyncLane).toBe(0);
  });

  it('includes ViewTransitionLane when viewTransition is true', () => {
    expect(
      getSchedulingLanes({ viewTransition: true }) & ViewTransitionLane,
    ).toBeTruthy();
  });

  it('does not include ViewTransitionLane when viewTransition is false', () => {
    expect(
      getSchedulingLanes({ viewTransition: false }) & ViewTransitionLane,
    ).toBe(0);
  });

  it('includes UserBlockingLane for user-blocking priority', () => {
    expect(
      getSchedulingLanes({ priority: 'user-blocking' }) & UserBlockingLane,
    ).toBeTruthy();
  });

  it('includes UserVisibleLane for user-visible priority', () => {
    expect(
      getSchedulingLanes({ priority: 'user-visible' }) & UserVisibleLane,
    ).toBeTruthy();
  });

  it('includes BackgroundLane for background priority', () => {
    expect(
      getSchedulingLanes({ priority: 'background' }) & BackgroundLane,
    ).toBeTruthy();
  });

  it('includes the correct TransitionLane for transition indexes', () => {
    for (let i = 0; i < TransitionLength; i++) {
      const lanes = getSchedulingLanes({ transition: i });
      expect(lanes & (TransitionLane1 << i)).toBeTruthy();
    }
  });

  it('wraps transition index via modulo TransitionLength', () => {
    const lanes = getSchedulingLanes({ transition: TransitionLength });
    expect(lanes & (TransitionLane1 << 0)).toBeTruthy();
  });
});

describe('getTranstionIndex()', () => {
  it('returns correct indexes for transition lanes', () => {
    expect(getTranstionIndex(TransitionLane1)).toBe(0);
    for (let i = 0; i < TransitionLength; i++) {
      expect(getTranstionIndex(TransitionLane1 << i)).toBe(i);
    }
  });
});
