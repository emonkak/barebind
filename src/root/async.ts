import { createHydrationTree, replaceMarkerNode } from '../hydration.js';
import { Lanes, PartType, type Slot } from '../internal.js';
import {
  createRuntime,
  type RuntimeBackend,
  type RuntimeObserver,
} from '../runtime.js';
import { UpdateSession } from '../update-session.js';
import { MountSlot, UnmountSlot } from './root.js';

export class AsyncRoot<T> {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  private readonly _session: UpdateSession;

  static create<T>(
    value: T,
    container: Element,
    backend: RuntimeBackend,
  ): AsyncRoot<T> {
    const runtime = createRuntime(backend, { concurrent: true });
    const session = UpdateSession.create(Lanes.ConcurrentLane, runtime);
    const part = {
      type: PartType.ChildNode,
      node: container.ownerDocument.createComment(''),
      anchorNode: null,
      namespaceURI: container.namespaceURI,
    };
    const slot = session.resolveSlot(value, part);
    return new AsyncRoot(slot, container, session);
  }

  private constructor(
    slot: Slot<T>,
    container: Element,
    session: UpdateSession,
  ) {
    this._slot = slot;
    this._container = container;
    this._session = session;
  }

  observe(observer: RuntimeObserver): () => void {
    return this._session.addObserver(observer);
  }

  hydrate(): Promise<void> {
    const target = createHydrationTree(this._container);

    this._slot.hydrate(target, this._session);

    replaceMarkerNode(target, this._slot.part.node as Comment);

    this._session.enqueueMutationEffect(
      new MountSlot(this._slot, this._container),
    );
    return this._session.flushAsync();
  }

  mount(): Promise<void> {
    this._slot.connect(this._session);
    this._session.enqueueMutationEffect(
      new MountSlot(this._slot, this._container),
    );
    return this._session.flushAsync();
  }

  update(value: T): Promise<void> {
    this._slot.reconcile(value, this._session);
    this._session.enqueueMutationEffect(this._slot);
    return this._session.flushAsync();
  }

  unmount(): Promise<void> {
    this._slot.disconnect(this._session);
    this._session.enqueueMutationEffect(
      new UnmountSlot(this._slot, this._container),
    );
    return this._session.flushAsync();
  }
}
