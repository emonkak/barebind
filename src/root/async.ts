import { CommitPhase, type UpdateOptions } from '../hook.js';
import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import type { RenderHost, RequestCallbackOptions } from '../renderHost.js';
import { Runtime } from '../runtime.js';
import { MountSlot, UnmountSlot } from './root.js';

export interface AsyncRoot<T> {
  hydrate(options?: UpdateOptions): Promise<void>;
  mount(options?: UpdateOptions): Promise<void>;
  update(value: T, options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
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
    hydrate(options) {
      const hydrationTree = new HydrationTree(container);

      slot.hydrate(hydrationTree, runtime);
      hydrationTree.popNode(part.node.nodeType, part.node.nodeName);
      hydrationTree.replaceNode(part.node);

      return renderHost.requestCallback(() => {
        runtime.enqueueEffect(
          new MountSlot(slot, container),
          CommitPhase.Mutation,
        );
        return runtime.flushAsync(options);
      }, makeCallbackOptions(options));
    },
    mount(options) {
      slot.connect(runtime);

      return renderHost.requestCallback(() => {
        runtime.enqueueEffect(
          new MountSlot(slot, container),
          CommitPhase.Mutation,
        );
        return runtime.flushAsync(options);
      }, makeCallbackOptions(options));
    },
    update(value, options) {
      slot.reconcile(value, runtime);

      return renderHost.requestCallback(() => {
        runtime.enqueueEffect(slot, CommitPhase.Mutation);
        return runtime.flushAsync(options);
      }, makeCallbackOptions(options));
    },
    unmount(options) {
      slot.disconnect(runtime);

      return renderHost.requestCallback(() => {
        runtime.enqueueEffect(
          new UnmountSlot(slot, container),
          CommitPhase.Mutation,
        );
        return runtime.flushAsync(options);
      }, makeCallbackOptions(options));
    },
  };
}

function makeCallbackOptions(
  options: UpdateOptions | undefined,
): RequestCallbackOptions {
  return { priority: options?.priority ?? 'user-blocking' };
}
