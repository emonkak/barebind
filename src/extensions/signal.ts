import {
  $toDirectiveElement,
  type Bindable,
  type BindableObject,
  type Binding,
  type Coroutine,
  type Directive,
  type DirectiveContext,
  type DirectiveElement,
  type Slot,
  type UpdateContext,
} from '../directive.js';
import {
  $customHook,
  type CustomHook,
  type HookContext,
  type Lanes,
  NO_LANES,
} from '../hook.js';
import type { HydrationTree } from '../hydration.js';
import { LinkedList } from '../linkedList.js';
import type { Part } from '../part.js';

export type Subscriber = () => void;

export type Subscription = () => void;

export abstract class Signal<T>
  implements CustomHook<T>, BindableObject<Signal<Bindable<T>>>
{
  /**
   * @internal
   */
  static resolveBinding<T>(
    signal: Signal<Bindable<T>>,
    part: Part,
    _context: DirectiveContext,
  ): SignalBinding<T> {
    return new SignalBinding(signal, part);
  }

  abstract get value(): T;

  abstract get version(): number;

  [$customHook](context: HookContext): T {
    context.useLayoutEffect(
      () =>
        this.subscribe(() => {
          context.forceUpdate();
        }),
      [this],
    );
    return this.value;
  }

  [$toDirectiveElement](): DirectiveElement<Signal<Bindable<T>>> {
    return { directive: Signal, value: this as Signal<Bindable<T>> };
  }

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(selector: (value: T) => TResult): Signal<TResult> {
    return new Projected(this, selector);
  }

  valueOf(): T {
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
  const TDependencies extends Signal<any>[] = Signal<any>[],
> extends Signal<TResult> {
  private readonly _producer: (...signals: TDependencies) => TResult;

  private readonly _dependencies: TDependencies;

  private _memoizedResult: TResult | null;

  private _memoizedVersion;

  constructor(
    producer: (...dependencies: TDependencies) => TResult,
    dependencies: TDependencies,
  );
  /**
   * @internal
   */
  constructor(
    producer: (...dependencies: TDependencies) => TResult,
    dependencies: TDependencies,
    initialResult: TResult,
    initialVersion: number,
  );
  constructor(
    producer: (...dependencies: TDependencies) => TResult,
    dependencies: TDependencies,
    initialResult: TResult | null = null,
    initialVersion = -1, // -1 is indicated an uninitialized signal.
  ) {
    super();

    this._producer = producer;
    this._dependencies = dependencies;
    this._memoizedResult = initialResult;
    this._memoizedVersion = initialVersion;
  }

  get value(): TResult {
    const { version } = this;
    if (this._memoizedVersion < version) {
      const producer = this._producer;
      this._memoizedVersion = version;
      this._memoizedResult = producer(...this._dependencies);
    }
    return this._memoizedResult!;
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

export class Lazy<T> extends Signal<T> {
  private readonly _producer: () => Signal<T>;

  private _memoizedSignal: Signal<T> | null = null;

  constructor(producer: () => Signal<T>) {
    super();
    this._producer = producer;
  }

  get value(): T {
    this._memoizedSignal ??= this._producer();
    return this._memoizedSignal.value;
  }

  get version(): number {
    return this._memoizedSignal?.version ?? -1;
  }

  subscribe(subscriber: Subscriber): Subscription {
    this._memoizedSignal ??= this._producer();
    return this._memoizedSignal.subscribe(subscriber);
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

/**
 * @internal
 */
export class SignalBinding<T>
  implements Binding<Signal<Bindable<T>>>, Coroutine
{
  private _signal: Signal<Bindable<T>>;

  private _part: Part;

  private _slot: Slot<T> | null = null;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<Bindable<T>>, part: Part) {
    this._signal = signal;
    this._part = part;
  }

  get directive(): Directive<Signal<Bindable<T>>> {
    return Signal as Directive<Signal<Bindable<T>>>;
  }

  get value(): Signal<Bindable<T>> {
    return this._signal;
  }

  get part(): Part {
    return this._part;
  }

  shouldBind(signal: Signal<Bindable<T>>): boolean {
    return this._subscription === null || signal !== this._signal;
  }

  bind(signal: Signal<Bindable<T>>): void {
    this._subscription?.();
    this._subscription = null;
    this._signal = signal;
  }

  resume(_lanes: Lanes, context: UpdateContext): Lanes {
    this._slot?.reconcile(this._signal.value, context);
    return NO_LANES;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    this._slot ??= context.resolveSlot(this._signal.value, this._part);
    this._slot.hydrate(hydrationTree, context);
    this._subscription ??= this._subscribeSignal(context.enterRenderFrame());
  }

  connect(context: UpdateContext): void {
    if (this._slot !== null) {
      this._slot.reconcile(this._signal.value, context);
    } else {
      this._slot ??= context.resolveSlot(this._signal.value, this._part);
      this._slot.connect(context);
    }
    this._subscription ??= this._subscribeSignal(context.enterRenderFrame());
  }

  disconnect(context: UpdateContext): void {
    this._subscription?.();
    this._slot?.disconnect(context);
    this._subscription = null;
  }

  commit(): void {
    this._slot?.commit();
  }

  rollback(): void {
    this._slot?.rollback();
  }

  private _subscribeSignal(context: UpdateContext): Subscription {
    return this._signal.subscribe(() => {
      context.scheduleUpdate(this, { priority: 'background' });
    });
  }
}
