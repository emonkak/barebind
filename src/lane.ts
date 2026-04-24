import type { Lane, Lanes, UpdateOptions } from './core.js';

export const NoLanes: Lanes /*           */ = 0b00000000000000000000000000000000;
export const HydrationLane: Lane /*      */ = 0b00000000000000000000000000000001;
export const SyncLane: Lane /*           */ = 0b00000000000000000000000000000010;
export const ViewTransitionLane: Lane /* */ = 0b00000000000000000000000000000100;
export const UserBlockingLane: Lane /*   */ = 0b00000000000000000000000000001000;
export const UserVisibleLane: Lane /*    */ = 0b00000000000000000000000000010000;
export const BackgroundLane: Lane /*     */ = 0b00000000000000000000000000100000;
export const TransitionLane1: Lane /*    */ = 0b00000000000000000000000001000000;
export const TransitionLanes: Lanes /*   */ = 0b00111111111111111111111111000000;
export const DelayedLane1: Lane /*       */ = 0b01000000000000000000000000000000;
export const DelayedLane2: Lane /*       */ = 0b10000000000000000000000000000000;
export const DelayedLanes: Lanes /*      */ = 0b11000000000000000000000000000000;

export const TransitionLength: number = 24;

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
  return lanes &
    (HydrationLane | SyncLane | ViewTransitionLane | UserBlockingLane)
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
    lanes = getLaneFromPriority(options.priority);
  }

  if (options.transition !== undefined) {
    lanes |= TransitionLane1 << (options.transition % TransitionLength);
  }

  if (options.delay !== undefined) {
    lanes |= options.delay <= 100 ? DelayedLane1 : DelayedLane2;
  }

  return lanes;
}

export function getTranstionIndex(lanes: Lanes): number {
  return (
    TransitionLength -
    Math.min(
      Math.clz32(lanes << Math.clz32(TransitionLanes)),
      TransitionLength,
    ) -
    1
  );
}
