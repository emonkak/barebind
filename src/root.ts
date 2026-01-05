import { createTreeWalker, replaceMarkerNode } from './hydration.js';
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
  type UpdateSession,
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
    return this._beginUpdate((session) => {
      const { frame, scope } = session;
      const targetTree = createTreeWalker(this._container);
      scope.setHydrationTargetTree(targetTree);
      this._slot.attach(session);
      frame.mutationEffects.push(new HydrateSlot(this._slot, targetTree));
    }, options);
  }

  mount(options?: UpdateOptions): UpdateHandle {
    return this._beginUpdate((session) => {
      this._slot.attach(session);
      session.frame.mutationEffects.push(
        new MountSlot(this._slot, this._container),
      );
    }, options);
  }

  update(value: T, options?: UpdateOptions): UpdateHandle {
    return this._beginUpdate((session) => {
      if (this._slot.reconcile(value, session)) {
        session.frame.mutationEffects.push(this._slot);
      }
    }, options);
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    return this._beginUpdate((session) => {
      this._slot.detach(session);
      session.frame.mutationEffects.push(
        new UnmountSlot(this._slot, this._container),
      );
    }, options);
  }

  private _beginUpdate(
    resume: (session: UpdateSession) => void,
    options?: UpdateOptions,
  ): UpdateHandle {
    const coroutine: Coroutine = {
      scope: new Scope(),
      pendingLanes: Lanes.DefaultLane,
      resume,
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
