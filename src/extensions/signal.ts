import {
  $customHook,
  $toDirective,
  type Bindable,
  type Binding,
  type CommitContext,
  type Coroutine,
  type CustomHookFunction,
  type CustomHookObject,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type HookContext,
  HydrationError,
  type HydrationTree,
  Lanes,
  type Part,
  type Slot,
  type UpdateContext,
} from '../internal.js';
import { LinkedList } from '../linked-list.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<T> = {
  [K in keyof T]: T[K] extends Signal<infer Value> ? Value : never;
};

/**
 * @internal
 */
export const SignalDirective: DirectiveType<Signal<any>> = {
  name: 'SignalDirective',
  resolveBinding<T>(
    signal: Signal<T>,
    part: Part,
    context: DirectiveContext,
  ): SignalBinding<T> {
    const slot = context.resolveSlot(signal.value, part);
    return new SignalBinding(signal, slot);
  },
};

/**
 * @internal
 */
export class SignalBinding<T> implements Binding<Signal<T>>, Coroutine {
  private _signal: Signal<T>;

  private readonly _slot: Slot<T>;

  private _memoizedVersion: number;

  private _subscription: Subscription | null = null;

  private _pendingLanes: Lanes = Lanes.NoLanes;

  constructor(signal: Signal<T>, slot: Slot<T>) {
    this._signal = signal;
    this._slot = slot;
    this._memoizedVersion = signal.version;
  }

  get type(): DirectiveType<Signal<T>> {
    return SignalDirective;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  get part(): Part {
    return this._slot.part;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  shouldBind(signal: Signal<T>): boolean {
    return this._subscription === null || signal !== this._signal;
  }

  bind(signal: Signal<T>): void {
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
    this._signal = signal;
    this._memoizedVersion = -1;
  }

  resume(_flushLanes: Lanes, context: UpdateContext): void {
    if (this._slot.reconcile(this._signal.value, context)) {
      context.enqueueMutationEffect(this);
    }
    this._memoizedVersion = this._signal.version;
    this._pendingLanes = Lanes.NoLanes;
  }

  suspend(scheduleLanes: Lanes, _context: UpdateContext): void {
    this._pendingLanes |= scheduleLanes;
  }

  hydrate(targetTree: HydrationTree, context: UpdateContext): void {
    if (this._subscription !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    this._slot.hydrate(targetTree, context);
    this._subscription = this._subscribeSignal(context);
  }

  connect(context: UpdateContext): void {
    const currentVersion = this._signal.version;

    if (this._memoizedVersion < currentVersion) {
      this._slot.reconcile(this._signal.value, context);
      this._memoizedVersion = currentVersion;
    } else {
      this._slot.connect(context);
    }

    this._subscription ??= this._subscribeSignal(context);
  }

  disconnect(context: UpdateContext): void {
    this._subscription?.();
    this._slot.disconnect(context);
    this._subscription = null;
  }

  commit(context: CommitContext): void {
    this._slot.commit(context);
  }

  rollback(context: CommitContext): void {
    this._slot.rollback(context);
  }

  private _subscribeSignal(context: UpdateContext): Subscription {
    return this._signal.subscribe(() => {
      context.scheduleUpdate(this);
    });
  }
}

export abstract class Signal<T>
  implements CustomHookObject<T>, Bindable<Signal<T>>
{
  abstract get value(): T;

  abstract get version(): number;

  [$customHook](context: HookContext): T {
    const snapshot = context.useRef<T | null>(null);

    context.useEffect(() => {
      // The guard for batch updates with microtasks.
      let guard = true;
      const subscriber = () => {
        if (!Object.is(this.value, snapshot.current)) {
          context.forceUpdate();
        }
        guard = false;
      };
      queueMicrotask(subscriber);
      return this.subscribe(() => {
        if (!guard) {
          guard = true;
          queueMicrotask(subscriber);
        }
      });
    }, [this]);

    snapshot.current = this.value;

    return snapshot.current;
  }

  [$toDirective](): Directive<Signal<T>> {
    return { type: SignalDirective, value: this };
  }

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(selector: (value: T) => TResult): Signal<TResult> {
    return new Computed<TResult, [Signal<T>]>(selector, [this]);
  }

  valueOf(): T {
    return this.value;
  }
}

export class Atom<T> extends Signal<T> {
  private _value: T;

  private _version: number;

  private readonly _subscribers = new LinkedList<Subscriber>();

  static tracked<T>(initialValue: T): CustomHookFunction<Atom<T>> {
    return (context) => {
      const signal = context.useMemo(
        () => new Atom(initialValue),
        [initialValue],
      );
      context.use(signal);
      return signal;
    };
  }

  static untracked<T>(initialValue: T): CustomHookFunction<Atom<T>> {
    return (context) => {
      return context.useMemo(() => new Atom(initialValue), [initialValue]);
    };
  }

  constructor(initialValue: T);
  /**
   * @internal
   */
  constructor(initialValue: T, initialVersion: number);
  constructor(initialValue: T, initialVersion: number = 0) {
    super();
    this._value = initialValue;
    this._version = initialVersion;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this.touch();
  }

  get version(): number {
    return this._version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const node = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(node);
    };
  }

  touch(): void {
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
}

export class Computed<
  TResult,
  const TDependencies extends readonly Signal<any>[] = Signal<any>[],
> extends Signal<TResult> {
  private readonly _producer: (
    ...signals: UnwrapSignals<TDependencies>
  ) => TResult;

  private readonly _dependencies: TDependencies;

  private _memoizedResult: TResult | null;

  private _memoizedVersion;

  static tracked<TResult, const TDependencies extends readonly Signal<any>[]>(
    producer: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  ): CustomHookFunction<Computed<TResult, TDependencies>> {
    return (context) => {
      const signal = context.useMemo(
        () => new Computed(producer, dependencies),
        dependencies,
      );
      context.use(signal);
      return signal;
    };
  }

  static untracked<TResult, const TDependencies extends readonly Signal<any>[]>(
    producer: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  ): CustomHookFunction<Computed<TResult, TDependencies>> {
    return (context) => {
      return context.useMemo(
        () => new Computed(producer, dependencies),
        dependencies,
      );
    };
  }

  constructor(
    producer: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  );
  /**
   * @internal
   */
  constructor(
    producer: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
    initialResult: TResult,
    initialVersion: number,
  );
  constructor(
    producer: (...values: UnwrapSignals<TDependencies>) => TResult,
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
    const currentVersion = this.version;

    if (this._memoizedVersion < currentVersion) {
      const producer = this._producer;
      this._memoizedResult = producer(
        ...(this._dependencies.map(
          (dependency) => dependency.value,
        ) as UnwrapSignals<TDependencies>),
      );
      this._memoizedVersion = currentVersion;
    }

    return this._memoizedResult!;
  }

  get version(): number {
    let version = 0;

    for (let i = 0, l = this._dependencies.length; i < l; i++) {
      version += this._dependencies[i]!.version;
    }

    return version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const subscriptions = this._dependencies.map((dependency) =>
      dependency.subscribe(subscriber),
    );

    return () => {
      for (let i = subscriptions.length - 1; i >= 0; i--) {
        subscriptions[i]!();
      }
    };
  }
}
