import {
  type Coroutine,
  type Effect,
  Scope,
  type Session,
  type SessionObserver,
  type UpdateHandle,
  type UpdateOptions,
} from '../core.js';
import { NoLanes } from '../lane.js';
import { Runtime, type RuntimeOptions } from '../runtime.js';
import { Slot } from '../slot.js';
import {
  ClientAdapter,
  type DOMAdapter,
  type DOMAdapterOptions,
  HydrationAdapter,
} from './adapter.js';
import { createChildNodePart, type DOMPart } from './part.js';
import type { DOMRenderer } from './template.js';

export function createCilentRoot<T>(
  source: T,
  container: Element,
  options?: RuntimeOptions & DOMAdapterOptions,
): Root<T> {
  return createRoot(source, new ClientAdapter(container, options), options);
}

export function createHydrationRoot<T>(
  source: T,
  container: Element,
  options?: RuntimeOptions & DOMAdapterOptions,
): Root<T> {
  return createRoot(source, new HydrationAdapter(container, options), options);
}

export function createRoot<T>(
  source: T,
  adapter: DOMAdapter,
  options?: RuntimeOptions,
): Root<T> {
  const container = adapter.container;
  const part = createChildNodePart(
    container.ownerDocument.createComment(''),
    container.namespaceURI,
  );
  const runtime = new Runtime(adapter, options);
  const slot = Slot.place(source, part, runtime);
  return new Root(slot, runtime);
}

export class Root<T> {
  private readonly _slot: Slot<T, DOMPart.ChildNode, DOMRenderer>;

  private readonly _runtime: Runtime<DOMPart, DOMRenderer>;

  constructor(
    slot: Slot<T, DOMPart.ChildNode, DOMRenderer>,
    context: Runtime<DOMPart, DOMRenderer>,
  ) {
    this._slot = slot;
    this._runtime = context;
  }

  mount(options?: UpdateOptions): UpdateHandle {
    return this._startSession((session) => {
      const { frame, scope, renderer } = session;
      this._slot.attach(session);
      frame.mutationEffects.push(
        new MountSlot(this._slot, renderer.container),
        scope.level,
      );
    }, options);
  }

  observe(observer: SessionObserver): () => void {
    return this._runtime.addObserver(observer);
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    return this._startSession((session) => {
      const { frame, scope } = session;
      this._slot.detach(session);
      frame.mutationEffects.push(new UnmountSlot(this._slot), scope.level);
    }, options);
  }

  update(source: T, options?: UpdateOptions): UpdateHandle {
    return this._startSession((session) => {
      const { frame, scope } = session;
      if (this._slot.update(source, session)) {
        frame.mutationEffects.push(this._slot, scope.level);
      }
    }, options);
  }

  private _startSession(
    resume: (session: Session<DOMPart, DOMRenderer>) => void,
    options?: UpdateOptions,
  ): UpdateHandle {
    const coroutine: Coroutine<DOMPart, DOMRenderer> = {
      name: Root.name,
      scope: Object.freeze(Scope.Root()),
      pendingLanes: NoLanes,
      start(session) {
        session.frame.coroutines.push(this);
      },
      resume,
    };
    return this._runtime.scheduleUpdate(coroutine, {
      immediate: true,
      ...options,
    });
  }
}

class MountSlot<T> implements Effect {
  private readonly _slot: Slot<T, DOMPart.ChildNode>;

  private readonly _container: Element;

  constructor(
    slot: Slot<T, DOMPart.ChildNode, DOMRenderer>,
    container: Element,
  ) {
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
  private readonly _slot: Slot<T, DOMPart.ChildNode, DOMRenderer>;

  constructor(slot: Slot<T, DOMPart.ChildNode, DOMRenderer>) {
    this._slot = slot;
  }

  commit(): void {
    const { sentinelNode } = this._slot.part;
    this._slot.rollback();
    sentinelNode.remove();
  }
}
