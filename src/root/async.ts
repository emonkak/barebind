import { type Backend, Lanes, PartType, type Slot } from '../core.js';
import { createHydrationTree, replaceMarkerNode } from '../hydration.js';
import { Runtime, type RuntimeObserver } from '../runtime.js';
import { MountSlot, UnmountSlot } from './root.js';

export class AsyncRoot<T> {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  private readonly _runtime: Runtime;

  static create<T>(
    value: T,
    container: Element,
    backend: Backend,
  ): AsyncRoot<T> {
    const runtime = Runtime.create(backend, { concurrent: true });
    const part = {
      type: PartType.ChildNode,
      node: container.ownerDocument.createComment(''),
      anchorNode: null,
      namespaceURI: container.namespaceURI,
    };
    const slot = runtime.resolveSlot(value, part);
    return new AsyncRoot(slot, container, runtime);
  }

  private constructor(slot: Slot<T>, container: Element, runtime: Runtime) {
    this._slot = slot;
    this._container = container;
    this._runtime = runtime;
  }

  observe(observer: RuntimeObserver): () => void {
    return this._runtime.observe(observer);
  }

  hydrate(): Promise<void> {
    const targetTree = createHydrationTree(this._container);

    this._slot.hydrate(targetTree, this._runtime);

    replaceMarkerNode(targetTree, this._slot.part.node as Comment);

    this._runtime.enqueueMutationEffect(
      new MountSlot(this._slot, this._container),
    );
    return this._runtime.flushAsync(Lanes.ConcurrentLane);
  }

  mount(): Promise<void> {
    this._slot.connect(this._runtime);
    this._runtime.enqueueMutationEffect(
      new MountSlot(this._slot, this._container),
    );
    return this._runtime.flushAsync(Lanes.ConcurrentLane);
  }

  update(value: T): Promise<void> {
    this._slot.reconcile(value, this._runtime);
    this._runtime.enqueueMutationEffect(this._slot);
    return this._runtime.flushAsync(Lanes.ConcurrentLane);
  }

  unmount(): Promise<void> {
    this._slot.disconnect(this._runtime);
    this._runtime.enqueueMutationEffect(
      new UnmountSlot(this._slot, this._container),
    );
    return this._runtime.flushAsync(Lanes.ConcurrentLane);
  }
}
