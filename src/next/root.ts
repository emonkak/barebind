import type { UpdateOptions } from '../renderContext.js';
import type { Binding, Directive, Effect, UpdateContext } from './core.js';
import { UpdateEngine } from './engine.js';
import { type Part, PartType } from './part.js';
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
  const binding = new RootBinding(
    context.resolveBinding(value, part),
    container,
  );

  return {
    mount(options) {
      context.enqueueMutationEffect(binding);
      binding.connect(context);
      return context.flushFrame(options);
    },
    update(value, options) {
      context.enqueueMutationEffect(binding);
      binding.bind(value, context);
      return context.flushFrame(options);
    },
    unmount(options) {
      context.enqueueMutationEffect(new RollbackBinding(binding));
      binding.disconnect(context);
      return context.flushFrame(options);
    },
  };
}

class RootBinding<T> implements Binding<T> {
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  private readonly _container: Element;

  constructor(binding: Binding<T>, container: Element) {
    this._pendingBinding = binding;
    this._container = container;
  }

  get directive(): Directive<T> {
    return this._pendingBinding.directive;
  }

  get value(): T {
    return this._pendingBinding.value;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  connect(context: UpdateContext): void {
    this._pendingBinding.connect(context);
  }

  bind(value: T, context: UpdateContext): void {
    this._pendingBinding = context.reconcileBinding(
      this._pendingBinding,
      value,
    );
  }

  disconnect(context: UpdateContext): void {
    this._memoizedBinding?.disconnect(context);
  }

  commit(): void {
    if (this._memoizedBinding !== null) {
      if (this._memoizedBinding !== this._pendingBinding) {
        this._memoizedBinding.rollback();
      }
    } else {
      this._container.appendChild(this._pendingBinding.part.node);
    }
    this._pendingBinding.commit();
    this._memoizedBinding = this._pendingBinding;
  }

  rollback(): void {
    this._memoizedBinding?.commit();
    this._container.removeChild(this._pendingBinding.part.node);
    this._memoizedBinding = null;
  }
}

class RollbackBinding<T> implements Effect {
  private readonly _binding: Binding<T>;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  commit(): void {
    this._binding.rollback();
  }
}
