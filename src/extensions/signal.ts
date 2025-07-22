import {
  $toDirective,
  type Bindable,
  type Binding,
  type CommitContext,
  type Coroutine,
  type CustomHook,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type HookContext,
  HydrationError,
  type HydrationNodeScanner,
  Lanes,
  type Part,
  type Slot,
  type UpdateContext,
} from '../core.js';
import { LinkedList } from '../linked-list.js';

export type Subscriber = () => void;

export type Subscription = () => void;

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

  shouldBind(signal: Signal<T>): boolean {
    return this._subscription === null || signal !== this._signal;
  }

  bind(signal: Signal<T>): void {
    this._subscription?.();
    this._signal = signal;
    this._memoizedVersion = -1;
    this._subscription = null;
  }

  resume(_lanes: Lanes, context: UpdateContext): Lanes {
    this._slot.reconcile(this._signal.value, context);
    this._memoizedVersion = this._signal.version;
    return Lanes.NoLanes;
  }

  hydrate(nodeScanner: HydrationNodeScanner, context: UpdateContext): void {
    if (this._subscription !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    this._slot.hydrate(nodeScanner, context);
    this._subscription = this._subscribeSignal(context);
  }

  connect(context: UpdateContext): void {
    const version = this._signal.version;

    if (version > this._memoizedVersion) {
      this._slot.reconcile(this._signal.value, context);
      this._memoizedVersion = version;
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
      context.scheduleUpdate(this, { priority: 'background' });
    });
  }
}

export abstract class Signal<T> implements CustomHook<T>, Bindable<Signal<T>> {
  abstract get value(): T;

  abstract get version(): number;

  [$toDirective](): Directive<Signal<T>> {
    return { type: SignalDirective, value: this };
  }

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(selector: (value: T) => TResult): Signal<TResult> {
    return new Computed((dependency) => selector(dependency.value), [this]);
  }

  onCustomHook(context: HookContext): T {
    const snapshot = context.useRef<T | null>(null);

    context.useEffect(() => {
      const subscriber = () => {
        if (!Object.is(this.value, snapshot.current)) {
          context.forceUpdate();
        }
      };
      subscriber();
      return this.subscribe(subscriber);
    }, [this]);

    snapshot.current = this.value;

    return snapshot.current;
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
    const node = this._subscribers.pushBack(subscriber);

    return () => {
      this._subscribers.remove(node);
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
      this._memoizedResult = producer(...this._dependencies);
      this._memoizedVersion = version;
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
