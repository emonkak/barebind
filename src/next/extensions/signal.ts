import {
  type Bindable,
  BindableType,
  type Directive,
  type DirectiveContext,
  type DirectiveValue,
  type ResumableBinding,
  type Slot,
  type UpdateContext,
  bindableTag,
} from '../core.js';
import { type HookContext, type UserHook, userHookTag } from '../hook.js';
import { LinkedList } from '../linkedList.js';
import type { Part } from '../part.js';

export type Subscriber = () => void;

export type Subscription = () => void;

export const SignalDirective: Directive<Signal<any>> = {
  name: 'SignalDirective',
  resolveBinding(
    value: Signal<Bindable<unknown>>,
    part: Part,
    context: DirectiveContext,
  ): SignalBinding<unknown> {
    const slot = context.resolveSlot(value, part);
    return new SignalBinding(value, slot);
  },
};

class SignalBinding<T> implements ResumableBinding<Signal<Bindable<T>>> {
  private _signal: Signal<Bindable<T>>;

  private _version: number;

  private _slot: Slot<T>;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<Bindable<T>>, slot: Slot<T>) {
    this._signal = signal;
    this._version = signal.version;
    this._slot = slot;
  }

  get directive(): Directive<Signal<Bindable<T>>> {
    return SignalDirective;
  }

  get value(): Signal<Bindable<T>> {
    return this._signal;
  }

  get part(): Part {
    return this._slot.part;
  }

  shouldBind(signal: Signal<Bindable<T>>): boolean {
    return signal !== this._signal || this._subscription === null;
  }

  bind(signal: Signal<Bindable<T>>): void {
    this._subscription?.();
    this._subscription = null;
    this._signal = signal;
    this._version = -1;
  }

  connect(context: UpdateContext): void {
    const version = this._signal.version;
    if (this._version < this._signal.version) {
      this._slot.reconcile(this._signal.value, context);
      this._version = version;
    } else {
      this._slot.connect(context);
    }
    this._subscription ??= this._subscribeSignal(context.clone());
  }

  resume(context: UpdateContext): void {
    this._slot.reconcile(this._signal.value, context);
    this._version = this._signal.version;
  }

  disconnect(context: UpdateContext): void {
    this._subscription?.();
    this._slot.disconnect(context);
    this._subscription = null;
  }

  commit(): void {
    this._slot.commit();
  }

  rollback(): void {
    this._slot.rollback();
  }

  private _subscribeSignal(context: UpdateContext): Subscription {
    return this._signal.subscribe(() => {
      context.scheduleUpdate(this, { priority: 'background' });
    });
  }
}

export abstract class Signal<T>
  implements DirectiveValue<Signal<T>>, UserHook<T>
{
  abstract get value(): T;

  abstract get version(): number;

  get directive(): Directive<Signal<T>> {
    return SignalDirective;
  }

  get [bindableTag](): typeof BindableType.DirectiveValue {
    return BindableType.DirectiveValue;
  }

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(selector: (value: T) => TResult): Projected<T, TResult> {
    return new Projected(this, selector);
  }

  toJSON(): T {
    return this.value;
  }

  valueOf(): T {
    return this.value;
  }

  [userHookTag](context: HookContext): T {
    context.useLayoutEffect(
      () =>
        this.subscribe(() => {
          context.forceUpdate();
        }),
      [this],
    );
    return this.value;
  }
}

export class Atom<T> extends Signal<T> {
  private _value: T;

  private _version = 0;

  private readonly _subscribers = new LinkedList<Subscriber>();

  constructor(value: T) {
    super();
    this._value = value;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this.notifySubscribers();
  }

  get version(): number {
    return this._version;
  }

  notifySubscribers(): void {
    this._version += 1;
    for (
      let node = this._subscribers.front();
      node !== null;
      node = node.next
    ) {
      const subscriber = node.value;
      subscriber();
    }
  }

  setUntrackedValue(newValue: T): void {
    this._value = newValue;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const nodeRef = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(nodeRef);
    };
  }
}

export class Computed<
  TResult,
  const TDependencies extends Signal<unknown>[] = Signal<unknown>[],
> extends Signal<TResult> {
  private readonly _producer: (...signals: TDependencies) => TResult;

  private readonly _dependencies: TDependencies;

  private _memoizedValue: TResult | null = null;

  private _memoizedVersion = -1; // -1 is indicated an uninitialized signal.

  constructor(
    producer: (...dependencies: TDependencies) => TResult,
    dependencies: TDependencies,
  ) {
    super();
    this._producer = producer;
    this._dependencies = dependencies;
  }

  get value(): TResult {
    const { version } = this;
    if (this._memoizedVersion < version) {
      const producer = this._producer;
      this._memoizedVersion = version;
      this._memoizedValue = producer(...this._dependencies);
    }
    return this._memoizedValue!;
  }

  get version(): number {
    const dependencies = this._dependencies;
    let version = 0;
    for (let i = 0, l = dependencies.length; i < l; i++) {
      version += dependencies[i]!.version;
    }
    return version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const subscriptions = this._dependencies.map((dependency) =>
      dependency.subscribe(subscriber),
    );
    return () => {
      for (let i = 0, l = subscriptions.length; i < l; i++) {
        subscriptions[i]!();
      }
    };
  }
}

export class Projected<TValue, TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TValue>;

  private readonly _selector: (value: TValue) => TResult;

  constructor(signal: Signal<TValue>, selector: (value: TValue) => TResult) {
    super();
    this._signal = signal;
    this._selector = selector;
  }

  get value(): TResult {
    const selector = this._selector;
    return selector(this._signal.value)!;
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}
