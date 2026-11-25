import type { Lanes, UpdateOptions } from './abstractions.js';

export const enum Lane {
  NoLanes /*          */ = 0b0000000000000000000000000000000,
  SyncLane /*         */ = 0b0000000000000000000000000000001,
  UserHandlerLane /*  */ = 0b0000000000000000000000000000010,
  UserBlockingLane /* */ = 0b0000000000000000000000000000100,
  UserVisibleLane /*  */ = 0b0000000000000000000000000001000,
  BackgroundLane /*   */ = 0b0000000000000000000000000010000,
  TransitionLane1 /*  */ = 0b0000000000000000000000000100000,
  TransitionLanes /*  */ = 0b0011111111111111111111111100000,
  ShortDelayLane /*   */ = 0b0100000000000000000000000000000,
  LongDelayLane /*    */ = 0b1000000000000000000000000000000,
  DelayLanes /*       */ = 0b1100000000000000000000000000000,
  AllLanes /*         */ = -1,
}

export const TransitionLaneLength: number = 24;

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function getLaneFromPriority(priority: TaskPriority): Lanes {
  switch (priority) {
    case 'user-blocking':
      return Lane.UserBlockingLane;
    case 'user-visible':
      return Lane.UserVisibleLane;
    case 'background':
      return Lane.BackgroundLane;
  }
}

export function getPriorityFromLanes(lanes: Lanes): TaskPriority {
  return lanes & (Lane.SyncLane | Lane.UserHandlerLane | Lane.UserBlockingLane)
    ? 'user-blocking'
    : lanes & Lane.UserVisibleLane
      ? 'user-visible'
      : lanes & (Lane.BackgroundLane | Lane.TransitionLanes | Lane.DelayLanes)
        ? 'background'
        : 'user-visible';
}

export function getRenderLanes(options: UpdateOptions): Lanes {
  let lanes = Lane.NoLanes;
  if (options.flushSync) {
    lanes |= Lane.SyncLane;
  }
  if (options.handler !== undefined) {
    lanes |= Lane.UserHandlerLane;
  }
  if (options.priority !== undefined) {
    lanes |= getLaneFromPriority(options.priority);
  }
  if (options.transition !== undefined) {
    lanes |=
      Lane.TransitionLane1 << (options.transition % TransitionLaneLength);
  }
  if (options.delay !== undefined) {
    lanes |= options.delay <= 100 ? Lane.ShortDelayLane : Lane.LongDelayLane;
  }
  return lanes;
}

export function getTransitionIndex(lanes: Lanes): number {
  return (
    TransitionLaneLength -
    Math.min(
      Math.clz32(lanes << Math.clz32(Lane.TransitionLanes)),
      TransitionLaneLength,
    ) -
    1
  );
}

export function inspectLanes(lanes: Lanes): string[] {
  const tags = [];
  if (lanes & Lane.SyncLane) {
    tags.push('SyncLane');
  }
  if (lanes & Lane.UserHandlerLane) {
    tags.push('UserHandlerLane');
  }
  if (lanes & Lane.UserBlockingLane) {
    tags.push('UserBlockingLane');
  }
  if (lanes & Lane.UserVisibleLane) {
    tags.push('UserVisibleLane');
  }
  if (lanes & Lane.BackgroundLane) {
    tags.push('BackgroundLane');
  }
  if (lanes & Lane.TransitionLanes) {
    tags.push('TransitionLane');
  }
  if (lanes & Lane.ShortDelayLane) {
    tags.push('ShortDelayLane');
  }
  if (lanes & Lane.LongDelayLane) {
    tags.push('LongDelayLane');
  }
  return tags;
}
