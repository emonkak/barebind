import {
  type Lanes,
  type Scope,
  type Session,
  type UpdateHandle,
  type UpdateTask,
  type UpdateUnit,
  wrap,
} from '../core.js';
import { Runtime } from '../runtime.js';
import { createRootScope } from '../scope.js';
import { Slot } from '../slot.js';
import {
  ClientAdapter,
  type DOMAdapter,
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

  update(source: unknown): UpdateHandle {
    this._slot.update(wrap(source), this._slot.scope);
    return this._runtime.schedule(this._slot);
  }

  mount(): UpdateHandle {
    const task = new MountTask(
      this._slot,
      (this._runtime.adapter as DOMAdapter).container,
    );
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
  return createRoot(source, runtime, options);
}

export function createHydrationRoot(
  source: unknown,
  container: Element,
  options?: DOMRootOptions & DOMAdapterOptions,
): DOMRoot {
  const adapter = new HydrationAdapter(container, options);
  const runtime = new Runtime<DOMPart, DOMRenderer>(adapter);
  return createRoot(source, runtime, options);
}

export function createRoot(
  source: unknown,
  runtime: Runtime<DOMPart, DOMRenderer>,
  options: DOMRootOptions = {},
): DOMRoot {
  const document = (runtime.adapter as DOMAdapter).container.ownerDocument;
  const part = createChildNodePart(document.createComment(''));
  const scope = createRootScope({
    part,
    idPrefix: options.idPrefix ?? runtime.adapter.getIdentifier(),
    idSeq: 0,
  });
  const slot = new Slot(part, wrap(source), Object.freeze(scope));
  return new DOMRoot(slot, runtime);
}

class MountTask implements UpdateTask {
  private _slot: Slot<DOMPart.ChildNodePart, DOMRenderer>;
  private _container: Element;

  constructor(
    slot: Slot<DOMPart.ChildNodePart, DOMRenderer>,
    container: Element,
  ) {
    this._slot = slot;
    this._container = container;
  }

  get scope(): Scope<DOMPart.ChildNodePart, DOMRenderer> {
    return this._slot.scope;
  }

  get pendingLanes(): Lanes {
    return -1;
  }

  render(session: Session): Iterable<UpdateUnit> {
    return this._slot.render(session);
  }

  complete(): void {
    this._container.appendChild(this._slot.part.sentinelNode);
    this._slot.commit();
    this._slot.afterCommit();
  }
}

class UnmountTask implements UpdateTask {
  private _slot: Slot<DOMPart.ChildNodePart, DOMRenderer>;

  constructor(slot: Slot<DOMPart.ChildNodePart, DOMRenderer>) {
    this._slot = slot;
  }

  get scope(): Scope<DOMPart.ChildNodePart, DOMRenderer> {
    return this._slot.scope;
  }

  get pendingLanes(): Lanes {
    return -1;
  }

  render(_session: Session): Iterable<UpdateUnit> {
    return [];
  }

  complete(): void {
    this._slot.part.sentinelNode.remove();
    this._slot.beforeRevert();
    this._slot.revert();
  }
}
