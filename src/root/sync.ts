import type { Backend } from '../backend.js';
import { PartType } from '../core.js';
import { HydrationContainer } from '../hydration.js';
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
  const runtime = new Runtime(backend);
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
      const hydrationTree = new HydrationContainer(container);

      slot.hydrate(hydrationTree, runtime);

      hydrationTree
        .popNode(part.node.nodeType, part.node.nodeName)
        .replaceWith(part.node);

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
