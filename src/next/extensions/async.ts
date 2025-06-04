import {
  type Bindable,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type ResumableBinding,
  type Slot,
  type UpdateContext,
  createDirectiveElement,
} from '../core.js';
import type { Part } from '../part.js';

export type AsyncValue<T> = {
  promise: Promise<Bindable<T>>;
  options: AsyncOptions;
};

export interface AsyncOptions {
  controller?: AbortController;
}

export function async<T>(
  promise: Promise<Bindable<T>>,
  options: AsyncOptions = {},
): DirectiveElement<AsyncValue<T>> {
  return createDirectiveElement(AsyncDirective, {
    promise,
    options,
  });
}

export const AsyncDirective: Directive<AsyncValue<any>> = {
  name: 'AsyncDirective',
  resolveBinding(
    value: AsyncValue<unknown>,
    part: Part,
    _context: DirectiveContext,
  ): AsyncBinding<unknown> {
    return new AsyncBinding(value, part);
  },
};

class AsyncBinding<T> implements ResumableBinding<AsyncValue<T>> {
  private _value: AsyncValue<T>;

  private readonly _part: Part;

  private _slot: Slot<T> | null = null;

  constructor(value: AsyncValue<T>, part: Part) {
    this._value = value;
    this._part = part;
  }

  get directive(): Directive<AsyncValue<T>> {
    return AsyncDirective;
  }

  get value(): AsyncValue<T> {
    return this._value;
  }

  get part(): Part {
    return this._part;
  }

  shouldBind(value: AsyncValue<T>): boolean {
    return value.promise !== this._value.promise;
  }

  bind(value: AsyncValue<T>): void {
    this._value.options.controller?.abort();
    this._value = value;
  }

  async resume(context: UpdateContext): Promise<void> {
    const value = await this._value.promise;

    if (this._slot !== null) {
      this._slot.reconcile(value, context);
    } else {
      this._slot = context.resolveSlot(value, this._part);
      this._slot.connect(context);
    }
  }

  connect(context: UpdateContext): void {
    context.enqueueBinding(this);
  }

  disconnect(_context: UpdateContext): void {
    this._value.options.controller?.abort();
  }

  commit(): void {
    this._slot?.commit();
  }

  rollback(): void {
    this._slot?.rollback();
  }
}
