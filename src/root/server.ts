import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import { ServerRenderHost } from '../renderHost/server.js';
import { UpdateEngine } from '../updateEngine.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface ServerRoot<T> {
  hydrate(): void;
  mount(): void;
  update(value: T): void;
  unmount(): void;
}

export function createServerRoot<T>(
  value: T,
  container: Element,
  renderHost: ServerRenderHost = new ServerRenderHost(container.ownerDocument),
): ServerRoot<T> {
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
      hydrationTree.popNode(part.node.nodeName);
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
