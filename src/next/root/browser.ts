import type { Bindable } from '../core.js';
import type { UpdateOptions } from '../hook.js';
import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import { BrowserRenderHost } from '../renderHost/browser.js';
import { UpdateEngine } from '../updateEngine.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface BrowserRoot<T> {
  hydrate(options: UpdateOptions): Promise<void>;
  mount(options?: UpdateOptions): Promise<void>;
  update(value: Bindable<T>, options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
}

export function createBrowserRoot<T>(
  value: Bindable<T>,
  container: Element,
): BrowserRoot<T> {
  const renderHost = new BrowserRenderHost();
  const context = new UpdateEngine(renderHost);
  const part = {
    type: PartType.ChildNode,
    node: container.ownerDocument.createComment(''),
    childNode: null,
  } as const;
  const slot = context.resolveSlot(value, part);

  return {
    hydrate(options) {
      const hydrationTree = new HydrationTree(container);
      slot.hydrate(hydrationTree, context);
      context.enqueueMutationEffect(new MountSlot(slot, container));
      return context.flushAsync(options);
    },
    mount(options) {
      slot.connect(context);
      context.enqueueMutationEffect(new MountSlot(slot, container));
      return context.flushAsync(options);
    },
    update(value, options) {
      slot.reconcile(value, context);
      context.enqueueMutationEffect(slot);
      return context.flushAsync(options);
    },
    unmount(options) {
      slot.disconnect(context);
      context.enqueueMutationEffect(new UnmountSlot(slot, container));
      return context.flushAsync(options);
    },
  };
}
