import type { Lane, Lanes, UpdateOptions } from './core.js';

export const SyncLane: Lane /*           */ = 0b0000000000000001;
export const ViewTransitionLane: Lane /* */ = 0b0000000000000010;
export const UserBlockingLane: Lane /*   */ = 0b0000000000000100;
export const UserVisibleLane: Lane /*    */ = 0b0000000000001000;
export const BackgroundLane: Lane /*     */ = 0b0000000000010000;
export const DeferredLane: Lane /*       */ = 0b0000000000100000;
export const TransitionLanes: Lanes /*   */ = 0b11111111111111110000000000000000;
export const TransitionLane1: Lane /*    */ = 0b00000000000000010000000000000000;
export const TransitionLength: number /* */ = 16;

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

export function getRenderLanes(options: UpdateOptions): Lanes {
  let lanes = 0;

  if (options.flushSync) {
    lanes |= SyncLane;
  }

  if (options.viewTransition) {
    lanes |= ViewTransitionLane;
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

  if (options.delay !== undefined) {
    lanes |= DeferredLane;
  }

  if (options.transition !== undefined) {
    lanes |= TransitionLane1 << (options.transition % TransitionLength);
  }

  return lanes > 0 ? lanes : UserVisibleLane;
}

export function getTranstionIndex(lanes: Lanes): number {
  return 31 - Math.clz32(lanes >>> TransitionLength);
}
