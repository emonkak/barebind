import type { Bindable, Effect, Slot } from './core.js';
import type { UpdateOptions } from './hook.js';
import { HydrationTree } from './hydration.js';
import { PartType } from './part.js';
import type { RenderHost } from './renderHost.js';
import {
  BrowserRenderHost,
  type BrowserRenderHostOptions,
} from './renderHost/browser.js';
import { UpdateEngine } from './updateEngine.js';

export interface Root<T> {
  hydrate(options: UpdateOptions): Promise<void>;
  mount(options?: UpdateOptions): Promise<void>;
  update(value: Bindable<T>, options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
}

export function createRoot<T>(
  value: Bindable<T>,
  container: Element,
  renderHost: RenderHost,
): Root<T> {
  const context = new UpdateEngine(renderHost);
  const part = {
    type: PartType.ChildNode,
    node: container.ownerDocument.createComment(''),
  } as const;
  const slot = context.resolveSlot(value, part);

  return {
    hydrate(options) {
      const hydrationTree = new HydrationTree(container);
      slot.hydrate(hydrationTree, context);
      context.enqueueMutationEffect(new MountBinding(slot, container));
      return context.flushFrame(options);
    },
    mount(options) {
      slot.connect(context);
      context.enqueueMutationEffect(new MountBinding(slot, container));
      return context.flushFrame(options);
    },
    update(value, options) {
      slot.reconcile(value, context);
      context.enqueueMutationEffect(slot);
      return context.flushFrame(options);
    },
    unmount(options) {
      slot.disconnect(context);
      context.enqueueMutationEffect(new UnmountBinding(slot, container));
      return context.flushFrame(options);
    },
  };
}

export function createBrowserRoot<T>(
  value: Bindable<T>,
  container: Element,
  options?: BrowserRenderHostOptions,
): Root<T> {
  return createRoot(value, container, new BrowserRenderHost(options));
}

class MountBinding<T> implements Effect {
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

class UnmountBinding<T> implements Effect {
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
