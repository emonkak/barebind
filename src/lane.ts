import type { Lane, Lanes, UpdateOptions } from './core.js';

export const AllLanes: Lanes /*          */ = -1;
export const NoLanes: Lanes /*           */ = 0b0000000000000000000000000000000;
export const SyncLane: Lane /*           */ = 0b0000000000000000000000000000001;
export const ViewTransitionLane: Lane /* */ = 0b0000000000000000000000000000010;
export const UserBlockingLane: Lane /*   */ = 0b0000000000000000000000000000100;
export const UserVisibleLane: Lane /*    */ = 0b0000000000000000000000000001000;
export const BackgroundLane: Lane /*     */ = 0b0000000000000000000000000010000;
export const TransitionLane1: Lane /*    */ = 0b0000000000000000000000000100000;
export const TransitionLanes: Lanes /*   */ = 0b0011111111111111111111111100000;
export const DelayedLane1: Lane /*       */ = 0b0100000000000000000000000000000;
export const DelayedLane2: Lane /*       */ = 0b1000000000000000000000000000000;
export const DelayedLanes: Lanes /*      */ = 0b1100000000000000000000000000000;

export const TransitionLaneLength: number = 24;

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function getLaneFromPriority(priority: TaskPriority): Lanes {
  switch (priority) {
    case 'user-blocking':
      return UserBlockingLane;
    case 'user-visible':
      return UserVisibleLane;
    case 'background':
      return BackgroundLane;
  }
}

export function getPriorityFromLanes(lanes: Lanes): TaskPriority {
  return lanes & (SyncLane | ViewTransitionLane | UserBlockingLane)
    ? 'user-blocking'
    : lanes & UserVisibleLane
      ? 'user-visible'
      : lanes & (BackgroundLane | TransitionLanes | DelayedLanes)
        ? 'background'
        : 'user-visible';
}

export function getRenderLanes(options: UpdateOptions): Lanes {
  let lanes = NoLanes;
  if (options.flushSync) {
    lanes |= SyncLane;
  }
  if (options.viewTransition) {
    lanes |= ViewTransitionLane;
  }
  if (options.priority !== undefined) {
    lanes |= getLaneFromPriority(options.priority);
  }
  if (options.transition !== undefined) {
    lanes |= TransitionLane1 << (options.transition % TransitionLaneLength);
  }
  if (options.delay !== undefined) {
    lanes |= options.delay <= 100 ? DelayedLane1 : DelayedLane2;
  }
  return lanes;
}

export function getTransitionIndex(lanes: Lanes): number {
  return (
    TransitionLaneLength -
    Math.min(
      Math.clz32(lanes << Math.clz32(TransitionLanes)),
      TransitionLaneLength,
    ) -
    1
  );
}

export function inspectLanes(lanes: Lanes): string[] {
  const tags = [];
  if (lanes & SyncLane) {
    tags.push('SyncLane');
  }
  if (lanes & ViewTransitionLane) {
    tags.push('ViewTransitionLane');
  }
  if (lanes & UserBlockingLane) {
    tags.push('UserBlockingLane');
  }
  if (lanes & UserVisibleLane) {
    tags.push('UserVisibleLane');
  }
  if (lanes & BackgroundLane) {
    tags.push('BackgroundLane');
  }
  if (lanes & TransitionLanes) {
    tags.push('TransitionLane');
  }
  if (lanes & DelayedLanes) {
    tags.push('DelayedLanes');
  }
  return tags;
}
