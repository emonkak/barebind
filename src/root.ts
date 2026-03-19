import {
  BOUNDARY_TYPE_HYDRATION,
  type Boundary,
  type Coroutine,
  type Effect,
  type Part,
  type Scope,
  type SessionContext,
  type Slot,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateSession,
} from './core.js';
import { createTreeWalker, replaceMarkerNode } from './hydration.js';
import { NoLanes } from './lane.js';
import { createChildNodePart } from './part.js';

export class Root<T> {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  private readonly _context: SessionContext;

  static create<T>(
    source: T,
    container: Element,
    context: SessionContext,
  ): Root<T> {
    const { ownerDocument, namespaceURI } = container;
    const part = createChildNodePart(
      ownerDocument.createComment(''),
      namespaceURI,
    );
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
    const targetTree = createTreeWalker(this._container);
    const scope = createRootScope({
      type: BOUNDARY_TYPE_HYDRATION,
      next: null,
      targetTree,
    });
    return this._startSession(
      scope,
      (session) => {
        const { frame } = session;
        this._slot.attach(session);
        frame.mutationEffects.push(new HydrateSlot(this._slot, targetTree), 0);
      },
      options,
    );
  }

  mount(options?: UpdateOptions): UpdateHandle {
    const scope = createRootScope();
    return this._startSession(
      scope,
      (session) => {
        const { frame, scope } = session;
        this._slot.attach(session);
        frame.mutationEffects.push(
          new MountSlot(this._slot, this._container),
          scope.level,
        );
      },
      options,
    );
  }

  update(source: T, options?: UpdateOptions): UpdateHandle {
    const scope = createRootScope();
    return this._startSession(
      scope,
      (session) => {
        const { frame, scope } = session;
        if (this._slot.reconcile(source, session)) {
          frame.mutationEffects.push(this._slot, scope.level);
        }
      },
      options,
    );
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    const scope = createRootScope();
    return this._startSession(
      scope,
      (session) => {
        const { frame, scope } = session;
        this._slot.detach(session);
        frame.mutationEffects.push(new UnmountSlot(this._slot), scope.level);
      },
      options,
    );
  }

  private _startSession(
    scope: Scope,
    resume: (session: UpdateSession) => void,
    options?: UpdateOptions,
  ): UpdateHandle {
    const coroutine: Coroutine = {
      name: Root.name,
      scope,
      pendingLanes: NoLanes,
      start(session) {
        session.frame.coroutines.push(this);
      },
      resume,
    };
    Object.freeze(scope);
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
    const { sentinelNode } = this._slot.part as Part.ChildNodePart;
    replaceMarkerNode(this._targetTree, sentinelNode);
    this._targetTree.root.appendChild(sentinelNode);
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
    const { sentinelNode } = this._slot.part as Part.ChildNodePart;
    this._container.appendChild(sentinelNode);
    this._slot.commit();
  }
}

class UnmountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  constructor(slot: Slot<T>) {
    this._slot = slot;
  }

  commit(): void {
    const { sentinelNode } = this._slot.part as Part.ChildNodePart;
    this._slot.rollback();
    sentinelNode.remove();
  }
}

function createRootScope(boundary: Boundary | null = null): Scope {
  return Object.freeze({
    owner: null,
    level: 0,
    boundary,
  });
}
