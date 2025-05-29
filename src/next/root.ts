import type { UpdateOptions } from '../renderContext.js';
import type { Bindable, Effect, Slot } from './core.js';
import { UpdateEngine } from './engine.js';
import { PartType } from './part.js';
import { BrowserRenderHost } from './renderHost.js';

export interface Root<T> {
  mount(options?: UpdateOptions): Promise<void>;
  update(value: Bindable<T>, options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
}

export function createRoot<T>(value: Bindable<T>, container: Element): Root<T> {
  const renderHost = new BrowserRenderHost();
  const context = new UpdateEngine(renderHost);
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;
  const slot = context.resolveSlot(value, part);

  return {
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
