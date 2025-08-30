import { LinkedList } from '../collections/linked-list.js';
import {
  $customHook,
  $toDirective,
  type Bindable,
  type Binding,
  type Coroutine,
  type CustomHookObject,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  HydrationError,
  type HydrationTarget,
  Lanes,
  type Part,
  type RenderContext,
  type Scope,
  type Slot,
  type UpdateSession,
} from '../internal.js';

export type Subscriber = () => void;

export type Subscription = () => void;

export type UnwrapSignals<T> = {
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
    session: DirectiveContext,
  ): SignalBinding<T> {
    const slot = session.resolveSlot(signal.value, part);
    return new SignalBinding(signal, slot);
  },
};

/**
 * @internal
 */
export class SignalBinding<T> implements Binding<Signal<T>>, Coroutine {
  scope: Scope | null = null;

  pendingLanes: Lanes = Lanes.NoLanes;

  private _value: Signal<T>;

  private _memoizedVersion: number;

  private readonly _slot: Slot<T>;

  private _subscription: Subscription | null = null;

  constructor(value: Signal<T>, slot: Slot<T>) {
    this._value = value;
    this._memoizedVersion = value.version;
    this._slot = slot;
  }

  get type(): DirectiveType<Signal<T>> {
    return SignalDirective;
  }

  get value(): Signal<T> {
    return this._value;
  }

  set value(value: Signal<T>) {
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
    this._value = value;
    this._memoizedVersion = -1;
  }

  get part(): Part {
    return this._slot.part;
  }

  shouldBind(value: Signal<T>): boolean {
    return this._subscription === null || value !== this._value;
  }

  resume(session: UpdateSession): void {
    if (this._slot.reconcile(this._value.value, session)) {
      session.frame.mutationEffects.push(this._slot);
    }
    this._memoizedVersion = this._value.version;
    this.pendingLanes = Lanes.NoLanes;
  }

  hydrate(target: HydrationTarget, session: UpdateSession): void {
    if (this._subscription !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    this._slot.hydrate(target, session);
    this._subscription = this._subscribeSignal(session);
  }

  connect(session: UpdateSession): void {
    const currentVersion = this._value.version;

    if (this._memoizedVersion < currentVersion) {
      this._slot.reconcile(this._value.value, session);
      this._memoizedVersion = currentVersion;
    } else {
      this._slot.connect(session);
    }

    this._subscription ??= this._subscribeSignal(session);
    this.scope = session.scope;
  }

  disconnect(session: UpdateSession): void {
    this._subscription?.();
    this._slot.disconnect(session);
    this._subscription = null;
  }

  commit(): void {
    this._slot.commit();
  }

  rollback(): void {
    this._slot.rollback();
  }

  private _subscribeSignal(session: UpdateSession): Subscription {
    const { context } = session;
    return this._value.subscribe(() => {
      context.scheduleUpdate(this);
    });
  }
}

export abstract class Signal<T>
  implements CustomHookObject<T>, Bindable<Signal<T>>
{
  abstract get value(): T;

  abstract get version(): number;

  [$customHook](session: RenderContext): T {
    const value = this.value;
    const snapshot = session.useRef(value);

    session.useLayoutEffect(() => {
      snapshot.current = value;
    }, [value]);

    session.useEffect(() => {
      // The guard for batch updates with microtasks.
      let guard = true;
      const checkForChanges = () => {
        if (!Object.is(this.value, snapshot.current)) {
          session.forceUpdate();
        }
        guard = false;
      };
      queueMicrotask(checkForChanges);
      return this.subscribe(() => {
        if (!guard) {
          guard = true;
          queueMicrotask(checkForChanges);
        }
      });
    }, [this]);

    return value;
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

  private _subscribers = new LinkedList<Subscriber>();

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

  set value(value: T) {
    this._value = value;
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
  private readonly _computation: (
    ...signals: UnwrapSignals<TDependencies>
  ) => TResult;

  private readonly _dependencies: TDependencies;

  private _memoizedResult: TResult | null;

  private _memoizedVersion;

  constructor(
    computation: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  );
  /**
   * @internal
   */
  constructor(
    computation: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
    initialResult: TResult,
    initialVersion: number,
  );
  constructor(
    computation: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
    initialResult: TResult | null = null,
    initialVersion = -1, // -1 is indicated an uninitialized signal.
  ) {
    super();
    this._computation = computation;
    this._dependencies = dependencies;
    this._memoizedResult = initialResult;
    this._memoizedVersion = initialVersion;
  }

  get value(): TResult {
    const currentVersion = this.version;

    if (this._memoizedVersion < currentVersion) {
      const computation = this._computation;
      this._memoizedResult = computation(
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
