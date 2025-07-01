import type { UpdateOptions } from '../hook.js';
import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import type { RenderHost } from '../renderHost.js';
import type { RuntimeObserver } from '../runtime.js';
import { Runtime } from '../runtime.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface AsyncRoot<T> {
  observe(observer: RuntimeObserver): () => void;
  hydrate(options?: UpdateOptions): Promise<void>;
  mount(options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
  update(value: T, options?: UpdateOptions): Promise<void>;
}

export function createAsyncRoot<T>(
  value: T,
  container: Element,
  renderHost: RenderHost,
): AsyncRoot<T> {
  const runtime = new Runtime(renderHost);
  const part = {
    type: PartType.ChildNode,
    node: container.ownerDocument.createComment(''),
    childNode: null,
  } as const;
  const slot = runtime.resolveSlot(value, part);

  return {
    observe(observer) {
      return runtime.observe(observer);
    },
    hydrate(options) {
      const hydrationTree = new HydrationTree(container);

      slot.hydrate(hydrationTree, runtime);
      hydrationTree.popNode(part.node.nodeType, part.node.nodeName);
      hydrationTree.replaceNode(part.node);

      options = { priority: renderHost.getCurrentPriority(), ...options };

      return renderHost.requestCallback(() => {
        runtime.enqueueMutationEffect(new MountSlot(slot, container));
        return runtime.flushAsync(options);
      }, options);
    },
    mount(options) {
      slot.connect(runtime);

      options = { priority: renderHost.getCurrentPriority(), ...options };

      return renderHost.requestCallback(() => {
        runtime.enqueueMutationEffect(new MountSlot(slot, container));
        return runtime.flushAsync(options);
      }, options);
    },
    update(value, options) {
      slot.reconcile(value, runtime);

      options = { priority: renderHost.getCurrentPriority(), ...options };

      return renderHost.requestCallback(() => {
        runtime.enqueueMutationEffect(slot);
        return runtime.flushAsync(options);
      }, options);
    },
    unmount(options) {
      slot.disconnect(runtime);

      options = { priority: renderHost.getCurrentPriority(), ...options };

      return renderHost.requestCallback(() => {
        runtime.enqueueMutationEffect(new UnmountSlot(slot, container));
        return runtime.flushAsync(options);
      }, options);
    },
  };
}
