import {
  AllLanes,
  type Effect,
  type Lanes,
  type Scope,
  type Session,
  Slot,
  type UpdateHandle,
  type UpdateTask,
  wrap,
} from '../core.js';
import { Runtime } from '../runtime.js';
import { createRootScope } from '../scope.js';
import {
  ClientAdapter,
  type DOMAdapterOptions,
  HydrationAdapter,
} from './adapter.js';
import { createChildNodePart, type DOMPart } from './part.js';
import type { DOMRenderer } from './renderer.js';

export interface DOMRootOptions {
  idPrefix?: string;
}

export class DOMRoot {
  private readonly _slot: Slot<DOMPart.ChildNodePart, DOMRenderer>;
  private readonly _runtime: Runtime<DOMPart, DOMRenderer>;

  constructor(
    slot: Slot<DOMPart.ChildNodePart, DOMRenderer>,
    runtime: Runtime<DOMPart, DOMRenderer>,
  ) {
    this._slot = slot;
    this._runtime = runtime;
  }

  mount(): UpdateHandle {
    const task = new MountTask(this._slot);
    return this._runtime.schedule(task);
  }

  unmount(): UpdateHandle {
    const task = new UnmountTask(this._slot);
    return this._runtime.schedule(task);
  }
}

export function createClientRoot(
  source: unknown,
  container: Element,
  options?: DOMRootOptions & DOMAdapterOptions,
) {
  const adapter = new ClientAdapter(container, options);
  const runtime = new Runtime<DOMPart, DOMRenderer>(adapter);
  return createDOMRoot(source, runtime, options);
}

export function createDOMRoot(
  source: unknown,
  runtime: Runtime<DOMPart, DOMRenderer>,
  options: DOMRootOptions = {},
): DOMRoot {
  const part = createChildNodePart(document.createComment(''));
  const scope = createRootScope({
    part,
    idPrefix: options.idPrefix ?? runtime.adapter.getIdentifier(),
    idSeq: 0,
  });
  const slot = new Slot(part, wrap(source), Object.freeze(scope));
  return new DOMRoot(slot, runtime);
}

export function createHydrationRoot(
  source: unknown,
  container: Element,
  options?: DOMRootOptions & DOMAdapterOptions,
): DOMRoot {
  const adapter = new HydrationAdapter(container, options);
  const runtime = new Runtime<DOMPart, DOMRenderer>(adapter);
  return createDOMRoot(source, runtime, options);
}

class MountSlot implements Effect {
  private _container: Element;
  private _slot: Slot<DOMPart.ChildNodePart, DOMRenderer>;

  constructor(
    container: Element,
    slot: Slot<DOMPart.ChildNodePart, DOMRenderer>,
  ) {
    this._container = container;
    this._slot = slot;
  }

  get scope(): Scope<DOMPart.ChildNodePart, DOMRenderer> {
    return this._slot.scope;
  }

  commit(): void {
    this._container.appendChild(this._slot.part.sentinelNode);
    this._slot.commit();
  }
}

class MountTask implements UpdateTask<DOMPart, DOMRenderer> {
  private _slot: Slot<DOMPart.ChildNodePart, DOMRenderer>;

  constructor(slot: Slot<DOMPart.ChildNodePart, DOMRenderer>) {
    this._slot = slot;
  }

  get scope(): Scope<DOMPart.ChildNodePart, DOMRenderer> {
    return this._slot.scope;
  }

  get pendingLanes(): Lanes {
    return AllLanes;
  }

  *start(
    session: Session<DOMPart.ChildNodePart, DOMRenderer>,
  ): Generator<Slot> {
    yield this._slot;
    session.mutationEffects.push(
      new MountSlot(session.renderer.container, this._slot),
    );
  }
}

class UnmountSlot implements Effect {
  private _container: Element;
  private _slot: Slot<DOMPart.ChildNodePart, DOMRenderer>;

  constructor(
    container: Element,
    slot: Slot<DOMPart.ChildNodePart, DOMRenderer>,
  ) {
    this._container = container;
    this._slot = slot;
  }

  get scope(): Scope<DOMPart.ChildNodePart, DOMRenderer> {
    return this._slot.scope;
  }

  commit(): void {
    this._container.removeChild(this._slot.part.sentinelNode);
    this._slot.revert();
  }
}

class UnmountTask implements UpdateTask<DOMPart, DOMRenderer> {
  private _slot: Slot<DOMPart.ChildNodePart, DOMRenderer>;

  constructor(slot: Slot<DOMPart.ChildNodePart, DOMRenderer>) {
    this._slot = slot;
  }

  get scope(): Scope<DOMPart.ChildNodePart, DOMRenderer> {
    return this._slot.scope;
  }

  get pendingLanes(): Lanes {
    return AllLanes;
  }

  *start(
    session: Session<DOMPart.ChildNodePart, DOMRenderer>,
  ): Generator<Slot> {
    this._slot.discard(session);
    session.mutationEffects.push(
      new UnmountSlot(session.renderer.container, this._slot),
    );
  }
}
