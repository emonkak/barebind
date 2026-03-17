import type { Lanes, UpdateOptions } from './core.js';

export const NoLanes /*            */ = 0;
export const ConcurrentLane /*     */ = 0b1;
export const SyncLane /*           */ = 0b10;
export const UserBlockingLane /*   */ = 0b100;
export const UserVisibleLane /*    */ = 0b1000;
export const BackgroundLane /*     */ = 0b10000;
export const ViewTransitionLane /* */ = 0b100000;
export const TransitionLane /*     */ = 0b1000000;

export function getPriorityFromLanes(lanes: Lanes): TaskPriority | null {
  if (lanes & BackgroundLane) {
    return 'background';
  } else if (lanes & UserVisibleLane) {
    return 'user-visible';
  } else if (lanes & UserBlockingLane) {
    return 'user-blocking';
  } else {
    return null;
  }
}

export function getSchedulingLanes(options: UpdateOptions): Lanes {
  let lanes = NoLanes;

  if (options.flushSync) {
    lanes |= SyncLane;
  }

  switch (options.priority) {
    case 'user-blocking':
      lanes |= UserBlockingLane;
      break;
    case 'user-visible':
      lanes |= UserVisibleLane;
      break;
    case 'background':
      lanes |= BackgroundLane;
      break;
  }

  if (options.transition !== undefined) {
    lanes |= TransitionLane;
  }

  if (options.viewTransition) {
    lanes |= ViewTransitionLane;
  }

  return lanes;
}
