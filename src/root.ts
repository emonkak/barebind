import { createHydrationTarget, mountMarkerNode } from './hydration.js';
import {
  type Coroutine,
  createScope,
  type Effect,
  type HydrationTarget,
  Lanes,
  PartType,
  type ScheduleOptions,
  type SessionContext,
  type Slot,
  setHydrationTarget,
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
    const scope = createScope();
    const hydrationTarget = createHydrationTarget(this._container);
    const coroutine: Coroutine = {
      scope,
      pendingLanes: Lanes.DefaultLane,
      resume: (session) => {
        const { frame } = session;
        this._slot.connect(session);
        frame.mutationEffects.push(
          new HydrateSlot(this._slot, hydrationTarget),
        );
      },
    };
    setHydrationTarget(scope, hydrationTarget);
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }

  mount(options?: ScheduleOptions): UpdateHandle {
    const scope = createScope();
    const coroutine: Coroutine = {
      scope,
      pendingLanes: Lanes.DefaultLane,
      resume: (session) => {
        this._slot.connect(session);
        session.frame.mutationEffects.push(
          new MountSlot(this._slot, this._container),
        );
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }

  update(value: T, options?: ScheduleOptions): UpdateHandle {
    const scope = createScope();
    const coroutine: Coroutine = {
      scope,
      pendingLanes: Lanes.DefaultLane,
      resume: (session) => {
        this._slot.reconcile(value, session);
        session.frame.mutationEffects.push(this._slot);
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }

  unmount(options?: ScheduleOptions): UpdateHandle {
    const scope = createScope();
    const coroutine: Coroutine = {
      scope,
      pendingLanes: Lanes.DefaultLane,
      resume: (session) => {
        this._slot.disconnect(session);
        session.frame.mutationEffects.push(
          new UnmountSlot(this._slot, this._container),
        );
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }
}

class HydrateSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _target: HydrationTarget;

  constructor(slot: Slot<T>, target: HydrationTarget) {
    this._slot = slot;
    this._target = target;
  }

  commit(): void {
    mountMarkerNode(this._target, this._slot.part.node as Comment);
    this._target.root.appendChild(this._slot.part.node);
    this._slot.commit();
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
