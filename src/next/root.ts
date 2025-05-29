import type { UpdateOptions } from '../renderContext.js';
import type { Binding, Effect } from './directive.js';
import { UpdateEngine } from './engine.js';
import { PartType } from './part.js';
import { BrowserHost } from './renderHost.js';

export interface Root<T> {
  mount(options?: UpdateOptions): Promise<void>;
  update(value: T, options?: UpdateOptions): Promise<void>;
  unmount(options?: UpdateOptions): Promise<void>;
}

export function createRoot<T>(value: T, container: Element): Root<T> {
  const renderHost = new BrowserHost();
  const context = new UpdateEngine(renderHost);
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;
  const binding = context.resolveBinding(value, part);

  return {
    mount(options) {
      binding.connect(context);
      context.enqueueMutationEffect(new MountBinding(binding, container));
      return context.flushFrame(options);
    },
    update(value, options) {
      binding.bind(value, context);
      context.enqueueMutationEffect(binding);
      return context.flushFrame(options);
    },
    unmount(options) {
      binding.disconnect(context);
      context.enqueueMutationEffect(new UnmountBinding(binding, container));
      return context.flushFrame(options);
    },
  };
}

class MountBinding<T> implements Effect {
  private readonly _binding: Binding<T>;

  private readonly _container: Element;

  constructor(binding: Binding<T>, container: Element) {
    this._binding = binding;
    this._container = container;
  }

  commit(): void {
    this._container.appendChild(this._binding.part.node);
    this._binding.commit();
  }
}

class UnmountBinding<T> implements Effect {
  private readonly _binding: Binding<T>;

  private readonly _container: Element;

  constructor(binding: Binding<T>, container: Element) {
    this._binding = binding;
    this._container = container;
  }

  commit(): void {
    this._binding.rollback();
    this._container.removeChild(this._binding.part.node);
  }
}
