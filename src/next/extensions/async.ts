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
  controller?: AbortController;
  fallback?: () => Bindable<T>;
  promise: Promise<Bindable<T>>;
};

type PromiseState = 'pending' | 'fulfilled' | 'rejected';

export function async<T>(
  value: AsyncValue<T>,
): DirectiveElement<AsyncValue<T>> {
  return createDirectiveElement(AsyncDirective, value);
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
    this._value.controller?.abort();
    this._value = value;
  }

  async resume(context: UpdateContext): Promise<void> {
    const state = await getPromiseState(this._value.promise);
    let value;

    if (state === 'pending') {
      this._value.promise.finally(() => {
        context.scheduleUpdate(this);
      });
      if (this._value.fallback === undefined) {
        return;
      }
      value = this._value.fallback();
    } else {
      try {
        value = await this._value.promise;
      } catch (error) {
        if (this._value.controller?.signal.aborted) {
          return;
        }
        throw error;
      }
    }

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
    this._value.controller?.abort();
  }

  commit(): void {
    this._slot?.commit();
  }

  rollback(): void {
    this._slot?.rollback();
  }
}

function getPromiseState(promise: Promise<unknown>): Promise<PromiseState> {
  const tag = Symbol();
  return Promise.race([promise, tag]).then(
    (value) => (value === tag ? 'pending' : 'fulfilled'),
    () => 'rejected',
  );
}
