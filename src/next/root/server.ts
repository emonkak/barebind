import type { Bindable } from '../core.js';
import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import { ServerRenderHost } from '../renderHost/server.js';
import { UpdateEngine } from '../updateEngine.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface ServerRoot<T> {
  hydrate(): void;
  mount(): void;
  update(value: Bindable<T>): void;
  unmount(): void;
}

export function createServerRoot<T>(
  value: Bindable<T>,
  container: Element,
): ServerRoot<T> {
  const renderHost = new ServerRenderHost();
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
      context.enqueueMutationEffect(new MountSlot(slot, container));
      return context.flushSync();
    },
    mount() {
      slot.connect(context);
      context.enqueueMutationEffect(new MountSlot(slot, container));
      return context.flushSync();
    },
    update(value) {
      slot.reconcile(value, context);
      context.enqueueMutationEffect(slot);
      return context.flushSync();
    },
    unmount() {
      slot.disconnect(context);
      context.enqueueMutationEffect(new UnmountSlot(slot, container));
      return context.flushSync();
    },
  };
}
