import {
  type Backend,
  HydrationTree,
  Lanes,
  PartType,
  type Slot,
} from '../core.js';
import { Runtime, type RuntimeObserver } from '../runtime.js';
import { MountSlot, UnmountSlot } from './root.js';

export class SyncRoot<T> {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  private readonly _runtime: Runtime;

  static create<T>(
    value: T,
    container: Element,
    backend: Backend,
  ): SyncRoot<T> {
    const runtime = Runtime.create(backend);
    const part = {
      type: PartType.ChildNode,
      node: container.ownerDocument.createComment(''),
      childNode: null,
      namespaceURI: container.namespaceURI,
    };
    const slot = runtime.resolveSlot(value, part);
    return new SyncRoot(slot, container, runtime);
  }

  private constructor(slot: Slot<T>, container: Element, runtime: Runtime) {
    this._slot = slot;
    this._container = container;
    this._runtime = runtime;
  }

  observe(observer: RuntimeObserver): () => void {
    return this._runtime.observe(observer);
  }

  hydrate(): void {
    const tree = new HydrationTree(this._container);
    const part = this._slot.part;

    this._slot.hydrate(tree, this._runtime);
    tree.nextNode(part.node.nodeName).replaceWith(part.node);

    this._runtime.enqueueMutationEffect(
      new MountSlot(this._slot, this._container),
    );
    this._runtime.flushSync(Lanes.SyncLane);
  }

  mount(): void {
    this._slot.connect(this._runtime);
    this._runtime.enqueueMutationEffect(
      new MountSlot(this._slot, this._container),
    );
    this._runtime.flushSync(Lanes.SyncLane);
  }

  update(value: T): void {
    this._slot.reconcile(value, this._runtime);
    this._runtime.enqueueMutationEffect(this._slot);
    this._runtime.flushSync(Lanes.SyncLane);
  }

  unmount(): void {
    this._slot.disconnect(this._runtime);
    this._runtime.enqueueMutationEffect(
      new UnmountSlot(this._slot, this._container),
    );
    this._runtime.flushSync(Lanes.SyncLane);
  }
}
