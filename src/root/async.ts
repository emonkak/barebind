import { type Backend, PartType, type UpdateOptions } from '../core.js';
import { HydrationNodeScanner } from '../hydration.js';
import { Runtime, type RuntimeObserver } from '../runtime.js';
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
  backend: Backend,
): AsyncRoot<T> {
  const runtime = new Runtime(backend);
  const part = {
    type: PartType.ChildNode,
    node: container.ownerDocument.createComment(''),
    childNode: null,
    namespaceURI: container.namespaceURI,
  };
  const slot = runtime.resolveSlot(value, part);

  function toCompleteOptions(
    options: UpdateOptions | undefined,
  ): Required<UpdateOptions> {
    return {
      priority: backend.getCurrentPriority(),
      viewTransition: false,
      ...options,
    };
  }

  return {
    observe(observer) {
      return runtime.observe(observer);
    },
    hydrate(options) {
      const nodeScanner = new HydrationNodeScanner(container);

      slot.hydrate(nodeScanner, runtime);

      nodeScanner.nextNode(part.node.nodeName).replaceWith(part.node);

      const completeOptions = toCompleteOptions(options);

      return backend.requestCallback(() => {
        runtime.enqueueMutationEffect(new MountSlot(slot, container));
        return runtime.flushAsync(completeOptions);
      }, completeOptions);
    },
    mount(options) {
      slot.connect(runtime);

      const completeOptions = toCompleteOptions(options);

      return backend.requestCallback(() => {
        runtime.enqueueMutationEffect(new MountSlot(slot, container));
        return runtime.flushAsync(completeOptions);
      }, completeOptions);
    },
    update(value, options) {
      slot.reconcile(value, runtime);

      const completeOptions = toCompleteOptions(options);

      return backend.requestCallback(() => {
        runtime.enqueueMutationEffect(slot);
        return runtime.flushAsync(completeOptions);
      }, completeOptions);
    },
    unmount(options) {
      slot.disconnect(runtime);

      const completeOptions = toCompleteOptions(options);

      return backend.requestCallback(() => {
        runtime.enqueueMutationEffect(new UnmountSlot(slot, container));
        return runtime.flushAsync(completeOptions);
      }, completeOptions);
    },
  };
}
