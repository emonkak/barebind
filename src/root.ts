import {
  BOUNDARY_TYPE_HYDRATION,
  type Coroutine,
  type Effect,
  type Part,
  Scope,
  type Session,
  type SessionContext,
  type UpdateHandle,
  type UpdateOptions,
} from './core.js';
import {
  createChildNodePart,
  createTreeWalker,
  replaceSentinelNode,
} from './dom.js';
import { NoLanes } from './lane.js';
import { Slot } from './slot.js';

export class Root<T> {
  private readonly _slot: Slot<T, Part.ChildNodePart>;

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
    const slot = Slot.place(source, part, context);
    return new Root(slot, container, context);
  }

  private constructor(
    slot: Slot<T, Part.ChildNodePart>,
    container: Element,
    context: SessionContext,
  ) {
    this._slot = slot;
    this._container = container;
    this._context = context;
  }

  hydrate(options?: UpdateOptions): UpdateHandle {
    const hydrationTarget = createTreeWalker(this._container);
    const scope = new Scope();
    scope.boundary = {
      type: BOUNDARY_TYPE_HYDRATION,
      next: null,
      target: hydrationTarget,
    };
    return this._startSession(
      scope,
      (session) => {
        const { frame } = session;
        this._slot.attach(session);
        frame.mutationEffects.push(
          new HydrateSlot(this._slot, hydrationTarget),
          0,
        );
      },
      options,
    );
  }

  mount(options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
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
    const scope = new Scope();
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
    const scope = new Scope();
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
    resume: (session: Session) => void,
    options?: UpdateOptions,
  ): UpdateHandle {
    const coroutine: Coroutine = {
      name: Root.name,
      scope: Object.freeze(scope),
      pendingLanes: NoLanes,
      start(session) {
        session.frame.coroutines.push(this);
      },
      resume,
    };
    return this._context.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }
}

class HydrateSlot<T> implements Effect {
  private readonly _slot: Slot<T, Part.ChildNodePart>;

  private readonly _hydrationTarget: TreeWalker;

  constructor(slot: Slot<T, Part.ChildNodePart>, hydrationTarget: TreeWalker) {
    this._slot = slot;
    this._hydrationTarget = hydrationTarget;
  }

  commit(): void {
    const { sentinelNode } = this._slot.part;
    replaceSentinelNode(this._hydrationTarget, sentinelNode);
    this._hydrationTarget.root.appendChild(sentinelNode);
    this._slot.commit();
  }
}

class MountSlot<T> implements Effect {
  private readonly _slot: Slot<T, Part.ChildNodePart>;

  private readonly _container: Element;

  constructor(slot: Slot<T, Part.ChildNodePart>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    const { sentinelNode } = this._slot.part;
    this._container.appendChild(sentinelNode);
    this._slot.commit();
  }
}

class UnmountSlot<T> implements Effect {
  private readonly _slot: Slot<T, Part.ChildNodePart>;

  constructor(slot: Slot<T, Part.ChildNodePart>) {
    this._slot = slot;
  }

  commit(): void {
    const { sentinelNode } = this._slot.part;
    this._slot.rollback();
    sentinelNode.remove();
  }
}
