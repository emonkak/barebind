import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveObject,
  type EffectContext,
  type UpdateContext,
  directiveTag,
} from './coreTypes.js';
import { type HookContext, type UserHook, userHookTag } from './hook.js';
import { LinkedList } from './linkedList.js';
import type { Part } from './part.js';

export type Subscriber = () => void;

export type Subscription = () => void;

const SignalDirective: Directive<Signal<unknown>> = {
  get name(): string {
    return 'Signal';
  },
  resolveBinding(
    value: Signal<unknown>,
    part: Part,
    context: DirectiveContext,
  ): SignalBinding<unknown> {
    const binding = context.resolveBinding(value.value, part);
    return new SignalBinding(binding, value);
  },
};

export abstract class Signal<T>
  implements DirectiveObject<Signal<T>>, UserHook<T>
{
  abstract get value(): T;

  abstract get version(): number;

  get [directiveTag](): Directive<Signal<T>> {
    return SignalDirective as Directive<Signal<T>>;
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
  const TDependencies extends Signal<any>[],
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

class SignalBinding<T> implements Binding<Signal<T>> {
  private _pendingBinding: Binding<T>;

  private _memoizedBinding: Binding<T> | null = null;

  private _signal: Signal<T>;

  private _subscription: Subscription | null = null;

  constructor(binding: Binding<T>, value: Signal<T>) {
    this._pendingBinding = binding;
    this._signal = value;
  }

  get directive(): Directive<Signal<T>> {
    return SignalDirective as Directive<Signal<T>>;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  get part(): Part {
    return this._pendingBinding.part;
  }

  connect(context: UpdateContext): void {
    if (this._signal.version > 0) {
      this._pendingBinding = context.reconcileBinding(
        this._pendingBinding,
        this._signal.value,
      );
    } else {
      this._pendingBinding.connect(context);
    }
    this._subscription ??= this._createSubscription(context);
  }

  bind(signal: Signal<T>, context: UpdateContext): void {
    if (signal !== this._signal) {
      this._abortSubscription();
    }
    this._pendingBinding = context.reconcileBinding(
      this._pendingBinding,
      signal.value,
    );
    this._signal = signal;
    this._subscription ??= this._createSubscription(context);
  }

  unbind(context: UpdateContext): void {
    this._abortSubscription();
    this._memoizedBinding?.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this._abortSubscription();
    this._memoizedBinding?.disconnect(context);
  }

  commit(context: EffectContext): void {
    if (this._memoizedBinding !== this._pendingBinding) {
      this._memoizedBinding?.commit(context);
    }
    this._pendingBinding.commit(context);
    this._memoizedBinding = this._pendingBinding;
  }

  private _abortSubscription(): void {
    this._subscription?.();
    this._subscription = null;
  }

  private _createSubscription(context: UpdateContext): Subscription {
    return this._signal.subscribe(() => {
      context.scheduleUpdate(this._pendingBinding, { priority: 'background' });
    });
  }
}
