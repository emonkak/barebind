import type { UpdateOptions } from '../hook.js';
import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import { BrowserRenderHost } from '../renderHost/browser.js';
import type { RequestCallbackOptions } from '../renderHost.js';
import { UpdateEngine } from '../updateEngine.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface BrowserRoot<T> {
  hydrate(options?: UpdateOptions): Promise<void>;
  mount(options?: UpdateOptions): Promise<void>;
  update(value: T, options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
}

export function createBrowserRoot<T>(
  value: T,
  container: Element,
  renderHost: BrowserRenderHost = new BrowserRenderHost(),
): BrowserRoot<T> {
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
      hydrationTree.popNode(part.node.nodeName);
      hydrationTree.replaceWith(part.node);
      return renderHost.requestCallback(() => {
        context.enqueueMutationEffect(new MountSlot(slot, container));
        return context.flushAsync(options);
      }, makeCallbackOptions(options));
    },
    mount(options) {
      slot.connect(context);
      return renderHost.requestCallback(() => {
        context.enqueueMutationEffect(new MountSlot(slot, container));
        return context.flushAsync(options);
      }, makeCallbackOptions(options));
    },
    update(value, options) {
      slot.reconcile(value, context);
      return renderHost.requestCallback(() => {
        context.enqueueMutationEffect(slot);
        return context.flushAsync(options);
      }, makeCallbackOptions(options));
    },
    unmount(options) {
      slot.disconnect(context);
      return renderHost.requestCallback(() => {
        context.enqueueMutationEffect(new UnmountSlot(slot, container));
        return context.flushAsync(options);
      }, makeCallbackOptions(options));
    },
  };
}

function makeCallbackOptions(
  options: UpdateOptions | undefined,
): RequestCallbackOptions {
  return { priority: options?.priority ?? 'user-blocking' };
}
