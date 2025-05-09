import {
  type Binding,
  type Directive,
  type DirectiveProtocol,
  type DirectiveValue,
  type EffectProtocol,
  type UpdateProtocol,
  directiveTag,
  resolveBindingTag,
} from './coreTypes.js';
import { nameOf } from './debug.js';
import { type HookProtocol, type UserHook, userHookTag } from './hook.js';
import { LinkedList } from './linkedList.js';
import type { Part } from './part.js';

export type Subscriber = () => void;

export type Subscription = () => void;

const SignalDirective: Directive<Signal<unknown>> = {
  [resolveBindingTag](
    value: Signal<unknown>,
    part: Part,
    context: DirectiveProtocol,
  ): SignalBinding<unknown> {
    const binding = context.prepareBinding(value.value, part);
    return new SignalBinding(binding, value);
  },
};

export function atom<TValue>(value: TValue): Atom<TValue> {
  return new Atom(value);
}

export function computed<TResult, const TDependencies extends Signal<any>[]>(
  producer: (...dependencies: TDependencies) => TResult,
  dependencies: TDependencies,
): Computed<TResult, TDependencies> {
  return new Computed(producer, dependencies);
}

export abstract class Signal<T>
  implements DirectiveValue<Signal<T>>, UserHook<T>
{
  abstract get value(): T;

  abstract get version(): number;

  get [directiveTag](): Directive<Signal<T>> {
    return SignalDirective as Directive<Signal<T>>;
  }

  get [Symbol.toStringTag](): string {
    return `Signal(${nameOf(this.value)})`;
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

  [userHookTag](context: HookProtocol): T {
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

export class SignalBinding<T> implements Binding<Signal<T>> {
  private _binding: Binding<T>;

  private _value: Signal<T>;

  private _subscription: Subscription | null = null;

  constructor(binding: Binding<T>, value: Signal<T>) {
    this._binding = binding;
    this._value = value;
  }

  get directive(): Directive<Signal<T>> {
    return SignalDirective as Directive<Signal<T>>;
  }

  get value(): Signal<T> {
    return this._value;
  }

  get part(): Part {
    return this._binding.part;
  }

  connect(context: UpdateProtocol): void {
    this._binding.connect(context);
    this._beginSubscription(context);
  }

  bind(value: Signal<T>, context: UpdateProtocol): void {
    if (value !== this._value) {
      this._abortSubscription();
    }
    this._binding = context.reconcileBinding(this._binding, value.value);
    this._value = value;
    this._beginSubscription(context);
  }

  unbind(context: UpdateProtocol): void {
    this._abortSubscription();
    this._binding.unbind(context);
  }

  disconnect(context: UpdateProtocol): void {
    this._abortSubscription();
    this._binding.disconnect(context);
  }

  commit(context: EffectProtocol): void {
    this._binding.commit(context);
  }

  private _abortSubscription(): void {
    this._subscription?.();
    this._subscription = null;
  }

  private _beginSubscription(context: UpdateProtocol): void {
    this._subscription ??= this._value.subscribe(() => {
      this._binding = context.reconcileBinding(
        this._binding,
        this._value.value,
      );
      context.scheduleUpdate(this._binding, { priority: 'background' });
    });
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
