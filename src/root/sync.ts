import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import type { RenderHost } from '../renderHost.js';
import { UpdateEngine } from '../updateEngine.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface SyncRoot<T> {
  hydrate(): void;
  mount(): void;
  update(value: T): void;
  unmount(): void;
}

export function createSyncRoot<T>(
  value: T,
  container: Element,
  renderHost: RenderHost,
): SyncRoot<T> {
  const context = new UpdateEngine(renderHost);
  const part = {
    type: PartType.ChildNode,
    node: container.ownerDocument.createComment(''),
    childNode: null,
  } as const;
  const slot = context.resolveSlot(value, part);

  return {
    hydrate() {
      const hydrationTree = new HydrationTree(container);
      slot.hydrate(hydrationTree, context);
      hydrationTree.popNode(part.node.nodeType, part.node.nodeName);
      hydrationTree.replaceNode(part.node);
      context.enqueueMutationEffect(new MountSlot(slot, container));
      context.flushSync();
    },
    mount() {
      slot.connect(context);
      context.enqueueMutationEffect(new MountSlot(slot, container));
      context.flushSync();
    },
    update(value) {
      slot.reconcile(value, context);
      context.enqueueMutationEffect(slot);
      context.flushSync();
    },
    unmount() {
      slot.disconnect(context);
      context.enqueueMutationEffect(new UnmountSlot(slot, container));
      context.flushSync();
    },
  };
}
