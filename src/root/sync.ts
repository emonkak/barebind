import { type Backend, HydrationTree, PartType } from '../core.js';
import { Runtime, type RuntimeObserver } from '../runtime.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface SyncRoot<T> {
  observe(observer: RuntimeObserver): () => void;
  hydrate(): void;
  mount(): void;
  update(value: T): void;
  unmount(): void;
}

export function createSyncRoot<T>(
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

  return {
    observe(observer) {
      return runtime.observe(observer);
    },
    hydrate() {
      const tree = new HydrationTree(container);

      slot.hydrate(tree, runtime);

      tree.nextNode(part.node.nodeName).replaceWith(part.node);

      runtime.enqueueMutationEffect(new MountSlot(slot, container));
      runtime.flushSync();
    },
    mount() {
      slot.connect(runtime);
      runtime.enqueueMutationEffect(new MountSlot(slot, container));
      runtime.flushSync();
    },
    update(value) {
      slot.reconcile(value, runtime);
      runtime.enqueueMutationEffect(slot);
      runtime.flushSync();
    },
    unmount() {
      slot.disconnect(runtime);
      runtime.enqueueMutationEffect(new UnmountSlot(slot, container));
      runtime.flushSync();
    },
  };
}
