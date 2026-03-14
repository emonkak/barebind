import {
  BoundaryType,
  type Coroutine,
  createScope,
  type Effect,
  Lane,
  PartType,
  type SessionContext,
  type Slot,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateSession,
} from './core.js';
import { createTreeWalker, replaceMarkerNode } from './hydration.js';

export class Root<T> {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  private readonly _context: SessionContext;

  static create<T>(
    source: T,
    container: Element,
    context: SessionContext,
  ): Root<T> {
    const part = {
      type: PartType.ChildNode,
      node: container.ownerDocument.createComment(''),
      anchorNode: null,
      namespaceURI: container.namespaceURI,
    };
    const slot = context.resolveSlot(source, part);
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
    return this._startSession((session) => {
      const { frame, scope } = session;
      const targetTree = createTreeWalker(this._container);
      scope.boundary = {
        type: BoundaryType.Hydration,
        next: scope.boundary,
        targetTree,
      };
      this._slot.attach(session);
      frame.mutationEffects.push(new HydrateSlot(this._slot, targetTree), 0);
    }, options);
  }

  mount(options?: UpdateOptions): UpdateHandle {
    return this._startSession((session) => {
      const { frame, scope } = session;
      this._slot.attach(session);
      frame.mutationEffects.push(
        new MountSlot(this._slot, this._container),
        scope.level,
      );
    }, options);
  }

  update(source: T, options?: UpdateOptions): UpdateHandle {
    return this._startSession((session) => {
      const { frame, scope } = session;
      if (this._slot.reconcile(source, session)) {
        frame.mutationEffects.push(this._slot, scope.level);
      }
    }, options);
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    return this._startSession((session) => {
      const { frame, scope } = session;
      this._slot.detach(session);
      frame.mutationEffects.push(new UnmountSlot(this._slot), scope.level);
    }, options);
  }

  private _startSession(
    callback: (session: UpdateSession) => void,
    options?: UpdateOptions,
  ): UpdateHandle {
    const coroutine: Coroutine = {
      name: Root.name,
      scope: createScope(),
      pendingLanes: Lane.NoLane,
      resume: callback,
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
    replaceMarkerNode(this._targetTree, this._slot.part.node as Comment);
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

  constructor(slot: Slot<T>) {
    this._slot = slot;
  }

  commit(): void {
    this._slot.rollback();
    this._slot.part.node.remove();
  }
}
