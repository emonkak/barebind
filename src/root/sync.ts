import { CommitPhase } from '../hook.js';
import { HydrationTree } from '../hydration.js';
import { PartType } from '../part.js';
import type { RenderHost } from '../renderHost.js';
import { Runtime } from '../runtime.js';
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
  const runtime = new Runtime(renderHost);
  const part = {
    type: PartType.ChildNode,
    node: container.ownerDocument.createComment(''),
    childNode: null,
  } as const;
  const slot = runtime.resolveSlot(value, part);

  return {
    hydrate() {
      const hydrationTree = new HydrationTree(container);

      slot.hydrate(hydrationTree, runtime);
      hydrationTree.popNode(part.node.nodeType, part.node.nodeName);
      hydrationTree.replaceNode(part.node);

      runtime.enqueueEffect(
        new MountSlot(slot, container),
        CommitPhase.Mutation,
      );
      runtime.flushSync();
    },
    mount() {
      slot.connect(runtime);
      runtime.enqueueEffect(
        new MountSlot(slot, container),
        CommitPhase.Mutation,
      );
      runtime.flushSync();
    },
    update(value) {
      slot.reconcile(value, runtime);
      runtime.enqueueEffect(slot, CommitPhase.Mutation);
      runtime.flushSync();
    },
    unmount() {
      slot.disconnect(runtime);
      runtime.enqueueEffect(
        new UnmountSlot(slot, container),
        CommitPhase.Mutation,
      );
      runtime.flushSync();
    },
  };
}
