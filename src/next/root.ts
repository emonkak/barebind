import type { Bindable, Effect, Slot } from './core.js';
import type { UpdateOptions } from './hook.js';
import { HydrationTree } from './hydration.js';
import { PartType } from './part.js';
import { BrowserRenderHost } from './renderHost/browser.js';
import { ServerRenderHost } from './renderHost/server.js';
import { UpdateEngine } from './updateEngine.js';

export interface BrowserRoot<T> {
  hydrate(options: UpdateOptions): Promise<void>;
  mount(options?: UpdateOptions): Promise<void>;
  update(value: Bindable<T>, options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
}

export interface ServerRoot<T> {
  hydrate(): void;
  mount(): void;
  update(value: Bindable<T>): void;
  unmount(): void;
}

export function createBrowserRoot<T>(
  value: Bindable<T>,
  container: Element,
): BrowserRoot<T> {
  const renderHost = new BrowserRenderHost();
  const context = new UpdateEngine(renderHost);
  const sentinelNode = container.ownerDocument.createComment('');
  const part = {
    type: PartType.ChildNode,
    node: sentinelNode,
    childNode: sentinelNode,
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

export function createServerRoot<T>(
  value: Bindable<T>,
  container: Element,
): ServerRoot<T> {
  const renderHost = new ServerRenderHost();
  const context = new UpdateEngine(renderHost);
  const sentinelNode = container.ownerDocument.createComment('');
  const part = {
    type: PartType.ChildNode,
    node: sentinelNode,
    childNode: sentinelNode,
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

class MountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._container.appendChild(this._slot.part.node);
    this._slot.commit();
  }
}

class UnmountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._slot.rollback();
    this._container.removeChild(this._slot.part.node);
  }
}
