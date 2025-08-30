import { createHydrationTree, replaceMarkerNode } from './hydration.js';
import {
  type Coroutine,
  type Effect,
  Lanes,
  PartType,
  type ScheduleOptions,
  type SessionContext,
  type Slot,
  type UpdateHandle,
} from './internal.js';

export class Root<T> {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  private readonly _context: SessionContext;

  static create<T>(
    value: T,
    container: Element,
    context: SessionContext,
  ): Root<T> {
    const part = {
      type: PartType.ChildNode,
      node: container.ownerDocument.createComment(''),
      anchorNode: null,
      namespaceURI: container.namespaceURI,
    };
    const slot = context.resolveSlot(value, part);
    return new Root(slot, container, context);
  }

  private constructor(
    slot: Slot<T>,
    container: Element,
    context: SessionContext,
  ) {
    this._slot = slot;
    this._container = container;
    this._context = context;
  }

  hydrate(options?: ScheduleOptions): UpdateHandle {
    const coroutine: Coroutine = {
      scope: null,
      pendingLanes: Lanes.DefaultLane,
      resume: (context) => {
        const target = createHydrationTree(this._container);
        this._slot.hydrate(target, context);
        replaceMarkerNode(target, this._slot.part.node as Comment);
        context.frame.mutationEffects.push(
          new MountSlot(this._slot, this._container),
        );
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }

  mount(options?: ScheduleOptions): UpdateHandle {
    const coroutine: Coroutine = {
      scope: null,
      pendingLanes: Lanes.DefaultLane,
      resume: (context) => {
        this._slot.connect(context);
        context.frame.mutationEffects.push(
          new MountSlot(this._slot, this._container),
        );
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }

  update(value: T, options?: ScheduleOptions): UpdateHandle {
    const coroutine: Coroutine = {
      scope: null,
      pendingLanes: Lanes.DefaultLane,
      resume: (context) => {
        this._slot.reconcile(value, context);
        context.frame.mutationEffects.push(this._slot);
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }

  unmount(options?: ScheduleOptions): UpdateHandle {
    const coroutine: Coroutine = {
      scope: null,
      pendingLanes: Lanes.DefaultLane,
      resume: (context) => {
        this._slot.disconnect(context);
        context.frame.mutationEffects.push(
          new UnmountSlot(this._slot, this._container),
        );
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }
}

class MountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._container.appendChild(this._slot.part.node);
    this._slot.commit();
  }
}

class UnmountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._slot.rollback();
    this._container.removeChild(this._slot.part.node);
  }
}
