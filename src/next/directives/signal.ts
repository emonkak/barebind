import {
  BindableType,
  type Binding,
  type Directive,
  type DirectiveContext,
  type DirectiveObject,
  type ResumableBinding,
  type UpdateContext,
  bindableTag,
} from '../directive.js';
import { type HookContext, type UserHook, userHookTag } from '../hook.js';
import { LinkedList } from '../linkedList.js';
import type { Part } from '../part.js';

export type Subscriber = () => void;

export type Subscription = () => void;

export const SignalDirective: Directive<Signal<unknown>> = {
  get name(): string {
    return 'SignalDirective';
  },
  resolveBinding(
    value: Signal<unknown>,
    part: Part,
    context: DirectiveContext,
  ): SignalBinding<unknown> {
    const binding = context.resolveBinding(value, part);
    return new SignalBinding(value, binding);
  },
};

export class SignalBinding<T> implements ResumableBinding<Signal<T>> {
  private _signal: Signal<T>;

  private _binding: Binding<T>;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>, binding: Binding<T>) {
    this._signal = signal;
    this._binding = binding;
  }

  get directive(): Directive<Signal<T>> {
    return SignalDirective as Directive<Signal<T>>;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  get part(): Part {
    return this._binding.part;
  }

  resume(context: UpdateContext): void {
    this._binding.bind(this._signal.value, context);
  }

  shouldBind(signal: Signal<T>): boolean {
    return (
      signal !== this._signal || this._binding.shouldBind(this._signal.value)
    );
  }

  bind(signal: Signal<T>, context: UpdateContext): void {
    if (signal !== this._signal) {
      this._subscription?.();
      this._subscription = null;
    }
    this._binding.bind(signal.value, context);
    this._signal = signal;
  }

  connect(context: UpdateContext): void {
    this._binding.connect(context);
    this._subscription ??= this._subscribeSignal(context.clone());
  }

  disconnect(context: UpdateContext): void {
    this._subscription?.();
    this._binding.disconnect(context);
    this._subscription = null;
  }

  commit(): void {
    this._binding.commit();
  }

  rollback(): void {
    this._binding.rollback();
  }

  private _subscribeSignal(context: UpdateContext): Subscription {
    return this._signal.subscribe(() => {
      context.scheduleUpdate(this, { priority: 'background' });
    });
  }
}

export abstract class Signal<T>
  implements DirectiveObject<Signal<T>>, UserHook<T>
{
  abstract get value(): T;

  abstract get version(): number;

  get directive(): Directive<Signal<T>> {
    return SignalDirective as Directive<Signal<T>>;
  }

  get [bindableTag](): BindableType.Object {
    return BindableType.Object;
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
