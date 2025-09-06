import { createTreeWalker, mountMarkerNode } from './hydration.js';
import {
  type Coroutine,
  type Effect,
  Lanes,
  PartType,
  Scope,
  type SessionContext,
  type Slot,
  type UpdateHandle,
  type UpdateOptions,
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

  hydrate(options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
    const coroutine: Coroutine = {
      scope,
      pendingLanes: Lanes.DefaultLane,
      resume: (session) => {
        const targetTree = createTreeWalker(this._container);
        scope.setHydrationTarget(targetTree);
        this._slot.connect(session);
        session.frame.mutationEffects.push(
          new HydrateSlot(this._slot, targetTree),
        );
      },
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }

  mount(options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
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

  update(value: T, options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
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

  unmount(options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
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

  private readonly _targetTree: TreeWalker;

  constructor(slot: Slot<T>, targetTree: TreeWalker) {
    this._slot = slot;
    this._targetTree = targetTree;
  }

  commit(): void {
    mountMarkerNode(this._targetTree, this._slot.part.node as Comment);
    this._targetTree.root.appendChild(this._slot.part.node);
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
